// Service Worker para Notificaciones Web Push (VAPID)
self.addEventListener('push', (event) => {
  let data = { title: 'Red Social Distribuida', body: '¡Tienes una nueva interacción!' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    try {
      data.body = event.data ? event.data.text() : data.body;
    } catch (err) {
      // Ignorar
    }
  }

  const options = {
    body: data.body || 'Nuevo contenido en tu red social',
    icon: '/icon.png',
    badge: '/badge.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      postId: data.postId,
      authorUsername: data.authorUsername,
      url: data.postId ? `/posts/${data.postId}` : '/',
    },
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Nueva Notificación', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl.split('?')[0]) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
