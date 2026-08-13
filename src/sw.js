import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.addEventListener('message', (event) => {
  if (event.data?.typ === 'skip-waiting') self.skipWaiting();
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let daten = {};
  try { daten = event.data ? event.data.json() : {}; }
  catch (e) { daten = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(daten.title || 'MUSCLEDEX', {
    body: daten.body || '',
    icon: './muscledex-icon-192-v4.png',
    badge: './muscledex-icon-192-v4.png',
    tag: daten.tag || 'muscledex',
    data: {
      url: daten.url || '',
      reminderId: daten.reminderId || '',
      reminderType: daten.reminderType || '',
    },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ziel = event.notification.data?.url || '';
  const routineId = event.notification.data?.reminderType === 'habit'
    ? event.notification.data?.reminderId || '' : '';
  event.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of fenster) {
      if ('focus' in client) {
        if (routineId) client.postMessage({ typ: 'routine-aktion', routineId, url: ziel || '#habits' });
        else if (ziel) client.postMessage({ typ: 'gehe-zu', url: ziel });
        return client.focus();
      }
    }
    if (!self.clients.openWindow) return undefined;
    if (routineId) return self.clients.openWindow(`./?routineAction=${encodeURIComponent(routineId)}#habits`);
    return self.clients.openWindow(ziel ? `./${ziel}` : './');
  })());
});
