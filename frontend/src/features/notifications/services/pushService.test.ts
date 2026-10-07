import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { initWebPush, registerWebPush } from './pushService';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

// El cliente compartido registra interceptores para adjuntar el token de
// sesión, así que el mock de axios debe exponer esa API.
vi.mock('axios', () => ({
  default: {
    isAxiosError: vi.fn(() => false),
    create: vi.fn(() => ({
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

// Clave VAPID de ejemplo en base64url. El contenido no importa: el navegador
// es falso, así que solo se verifica que la conversión no revienta.
const VAPID = 'BExamplePublicKeyVapid123';

const suscripcionFalsa = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  expirationTime: null,
  keys: { p256dh: 'clave-publica', auth: 'clave-autorizacion' },
} as unknown as PushSubscription;

const suscripcionFalsa2 = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/def456',
  expirationTime: null,
  keys: { p256dh: 'otra-clave-publica', auth: 'otra-clave-autorizacion' },
} as unknown as PushSubscription;

/** Instala el soporte de Web Push como si el navegador lo tuviera. */
const conSoporteDePush = (suscripcionExistente: PushSubscription | null = null) => {
  const subscribe = vi.fn().mockResolvedValue(suscripcionFalsa);
  const getSubscription = vi.fn().mockResolvedValue(suscripcionExistente);

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) },
  });
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
  (window as unknown as { atob: (data: string) => string }).atob = vi.fn(() => 'clave-vapid');

  return { subscribe, getSubscription };
};

/**
 * Deja el navegador sin soporte de Web Push.
 *
 * La guarda del source usa `'serviceWorker' in navigator`, así que hay que
 * ELIMINAR la propiedad: dejarla definida con valor `undefined` seguiría
 * fulfilledando el `in` y el código以为自己 tiene soporte.
 */
const sinSoporteDePush = () => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(window, 'PushManager');
};

/** Reemplaza Notification.requestPermission por el estado que se quiere probar. */
const conPermiso = (estado: NotificationPermission) => {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: { requestPermission: vi.fn().mockResolvedValue(estado) },
  });
};

describe('registerWebPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('informa que la función no está disponible cuando el navegador no soporta Web Push', async () => {
    sinSoporteDePush();

    const resultado = await registerWebPush(VAPID);

    expect(resultado.state).toBe('unsupported');
    expect(resultado.subscription).toBeNull();
    expect(resultado.message).toContain('no está soportado');
  });

  it('no intenta suscribirse cuando el permiso fue denegado', async () => {
    const { subscribe } = conSoporteDePush();
    conPermiso('denied');

    const resultado = await registerWebPush(VAPID);

    expect(resultado.state).toBe('denied');
    expect(resultado.subscription).toBeNull();
    // El motivo tiene que insofar que el permiso solo se cambia desde los ajustes.
    expect(resultado.message).toContain('ajustes del navegador');
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('distingue el permiso sin responder de un error de suscripción', async () => {
    const { subscribe } = conSoporteDePush();
    conPermiso('default');

    const resultado = await registerWebPush(VAPID);

    expect(resultado.state).toBe('default');
    expect(resultado.subscription).toBeNull();
    expect(resultado.message).toContain('sin responder');
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('obtiene la suscripción cuando el permiso está concedido', async () => {
    const { subscribe } = conSoporteDePush();
    conPermiso('granted');

    const resultado = await registerWebPush(VAPID);

    expect(resultado.state).toBe('granted');
    expect(resultado.subscription).toBe(suscripcionFalsa);
    expect(subscribe).toHaveBeenCalledTimes(1);
    // userVisibleOnly es requisito de los push services: sin esto no hay entrega.
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
  });

  it('trata la suscripción ya existente como resultado válido sin volver a pedirla', async () => {
    const { subscribe } = conSoporteDePush(suscripcionFalsa2);
    conPermiso('granted');

    const resultado = await registerWebPush(VAPID);

    expect(resultado.state).toBe('granted');
    expect(resultado.subscription).toBe(suscripcionFalsa2);
    expect(resultado.message).toContain('ya registrada');
    // Re-suscribirse sobre una suscripción activa la deja inservible.
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('no se traga el motivo cuando la suscripción falla', async () => {
    const { subscribe } = conSoporteDePush();
    subscribe.mockRejectedValue(new Error('AbortError: el usuario cerró el pedido'));
    conPermiso('granted');

    const resultado = await registerWebPush(VAPID);

    expect(resultado.subscription).toBeNull();
    expect(resultado.message).toContain('AbortError');
  });
});

describe('initWebPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registra la suscripción en el backend para el usuario indicado', async () => {
    getMock.mockResolvedValue({ data: { publicKey: VAPID } });
    postMock.mockResolvedValue({ data: { mensaje: 'ok' } });
    const { subscribe } = conSoporteDePush();
    conPermiso('granted');

    await initWebPush('carlos-patino');

    expect(getMock).toHaveBeenCalledWith('/notifications/vapid-public-key');
    expect(postMock).toHaveBeenCalledWith('/notifications/subscribe', {
      userId: 'carlos-patino',
      subscription: suscripcionFalsa,
    });
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('registra la suscripción ya existente sin volver a suscribir al navegador', async () => {
    getMock.mockResolvedValue({ data: { publicKey: VAPID } });
    postMock.mockResolvedValue({ data: { mensaje: 'ok' } });
    const { subscribe } = conSoporteDePush(suscripcionFalsa2);
    conPermiso('granted');

    await initWebPush('carlos-patino');

    expect(postMock).toHaveBeenCalledWith('/notifications/subscribe', {
      userId: 'carlos-patino',
      subscription: suscripcionFalsa2,
    });
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('no persiste nada cuando el permiso fue denegado', async () => {
    getMock.mockResolvedValue({ data: { publicKey: VAPID } });
    conSoporteDePush();
    conPermiso('denied');

    await initWebPush('carlos-patino');

    expect(postMock).not.toHaveBeenCalled();
  });

  it('no persiste nada cuando el navegador no soporta Web Push', async () => {
    getMock.mockResolvedValue({ data: { publicKey: VAPID } });
    sinSoporteDePush();

    await initWebPush('carlos-patino');

    expect(postMock).not.toHaveBeenCalled();
  });

  it('no propaga el fallo cuando el backend no entrega la clave pública', async () => {
    getMock.mockRejectedValue(new Error('500 Internal Server Error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    conSoporteDePush();
    conPermiso('granted');

    await expect(initWebPush('carlos-patino')).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});
