// Service Worker para Notificaciones Web Push (VAPID)
self.addEventListener('push', (event) => {
  const data = event.data
    ? event.data.json()
    : { title: 'Red Social Distribuida', body: '¡Tienes una nueva interacción!' };

  const options = {
    body: data.body || 'Nuevo contenido en tu red social',
    icon: '/icon.png',
    badge: '/badge.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Nueva Notificación', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
