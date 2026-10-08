import { describe, expect, it, vi, beforeEach } from 'vitest';
import { obtenerConversaciones, obtenerHistorial } from './chatApi';
import type { ChatMessage, ConversacionChat } from '../types/chat.types';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

// El cliente compartido registra interceptores para adjuntar el token de sesión y para borrar la
// sesión cuando el servidor responde 401, así que el doble de axios tiene que exponer esa API.
vi.mock('axios', () => ({
  default: {
    isAxiosError: vi.fn(() => false),
    create: vi.fn(() => ({
      get: getMock,
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

describe('obtenerHistorial', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('pide GET /chat/historial con los dos participantes y devuelve los mensajes', async () => {
    const historial: ChatMessage[] = [
      { id: 'm1', emisorId: 'carlos', destinatarioId: 'paulo', contenido: 'hola', timestamp: 1 },
      { id: 'm2', emisorId: 'paulo', destinatarioId: 'carlos', contenido: 'que tal', timestamp: 2 },
    ];
    getMock.mockResolvedValue({ data: historial });

    const resultado = await obtenerHistorial('carlos', 'paulo');

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/chat/historial', {
      params: { userA: 'carlos', userB: 'paulo' },
    });
    expect(resultado).toEqual(historial);
  });

  it('devuelve la lista vacía que devuelve el servidor cuando esa pareja nunca se escribió', async () => {
    // Vacío es un resultado legítimo y el backend lo responde con 200: convertirlo en error haría
    // que una conversación nueva se viera como una avería.
    getMock.mockResolvedValue({ data: [] });

    expect(await obtenerHistorial('carlos', 'paulo')).toEqual([]);
  });

  it('propaga el error para que el widget avise en vez de fingir que no hay historial', async () => {
    // Si el fallo se convirtiera en lista vacía, la pantalla mostraría "no hay mensajes" después de
    // un fallo de red, y nadie sabría que hay un problema.
    getMock.mockRejectedValue(new Error('Request failed with status code 500'));

    await expect(obtenerHistorial('carlos', 'paulo')).rejects.toThrow(/status code 500/);
  });
});

describe('obtenerConversaciones', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('pide GET /chat/conversaciones del usuario y devuelve la bandeja', async () => {
    const conversaciones: ConversacionChat[] = [
      {
        id: 'paulo-orrala',
        username: 'paulo',
        nombre: 'Paulo Orrala',
        avatarUrl: 'https://cdn/paulo.png',
        ultimoMensaje: 'que tal',
        fechaUltimoMensaje: 1700000005000,
      },
      {
        id: 'elena-vega',
        username: 'elena',
        ultimoMensaje: 'hola',
        fechaUltimoMensaje: 1700000000000,
      },
    ];
    getMock.mockResolvedValue({ data: conversaciones });

    const resultado = await obtenerConversaciones('carlos');

    expect(getMock).toHaveBeenCalledTimes(1);
    // Va por el cliente compartido y no por un fetch pelado: es lo que adjunta el token de sesión.
    expect(getMock).toHaveBeenCalledWith('/chat/conversaciones', { params: { userId: 'carlos' } });
    expect(resultado).toEqual(conversaciones);
  });

  it('devuelve la lista vacía de quien nunca ha escrito con nadie', async () => {
    getMock.mockResolvedValue({ data: [] });

    expect(await obtenerConversaciones('carlos')).toEqual([]);
  });

  it('propaga el 400 de una petición sin identificador en vez de devolver una bandeja vacía', async () => {
    // Bandeja vacía y llamada mal formada tienen que seguir siendo dos cosas distintas: si no, la
    // interfaz no puede avisar de que le falte el dato.
    getMock.mockRejectedValue(new Error('Request failed with status code 400'));

    await expect(obtenerConversaciones('')).rejects.toThrow(/status code 400/);
  });
});
