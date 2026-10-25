/* Required for iPhone Home Screen web push. No chore data is cached. */
self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data?.json() || {}; }
  catch { msg = { body: event.data?.text() || 'Your turn is up!' }; }
  event.waitUntil(self.registration.showNotification(msg.title || 'ChorePop ✨', {
    body: msg.body || 'Your chore is ready.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: msg.tag || 'chorepop',
    renotify: true,
    data: { url: '/' }
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) return client.focus();
    }
    return clients.openWindow(event.notification.data?.url || '/');
  })());
});
