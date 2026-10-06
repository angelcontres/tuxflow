import { api } from '../../../shared/api/client';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export const initWebPush = async (userId: string) => {
  try {
    const { data } = await api.get<{ publicKey: string }>('/notifications/vapid-public-key');
    const result = await registerWebPush(data.publicKey);
    if (result.state === 'granted' && result.subscription) {
      await api.post('/notifications/subscribe', { userId, subscription: result.subscription });
    }
  } catch (err) {
    console.error('Error initializing web push:', err);
  }
};

export interface RegisterResult {
  state: NotificationPermissionState;
  subscription: PushSubscription | null;
  message: string;
}

export const registerWebPush = async (vapidPublicKey: string): Promise<RegisterResult> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      state: 'unsupported',
      subscription: null,
      message: 'Web Push no está soportado en este navegador',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
      return {
        state: 'denied',
        subscription: null,
        message:
          'Permiso de notificaciones denegado. Puedes habilitarlo desde los ajustes del navegador.',
      };
    }
    if (permission !== 'granted') {
      return {
        state: 'default',
        subscription: null,
        message: 'Permiso de notificaciones sin responder. Aún no se ha obtenido autorización.',
      };
    }

    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      return {
        state: 'granted',
        subscription: existingSubscription,
        message: 'Suscripción Web Push ya registrada',
      };
    }

    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });

    return {
      state: 'granted',
      subscription,
      message: 'Suscripción Web Push obtenida correctamente',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return {
      state: 'default',
      subscription: null,
      message: `Error al obtener la suscripción: ${message}`,
    };
  }
};

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
