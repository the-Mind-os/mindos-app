// Mind OS service worker — web push + notification handling
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }
  const opts = {
    body: d.body || '',
    icon: d.icon || '/icon-192.png',
    data: { url: d.url || '/' },
    tag: d.tag || 'mindos',
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(d.title || 'Mind OS', opts));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.includes(url) && 'focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
