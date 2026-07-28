import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let daten = {};
  try { daten = event.data ? event.data.json() : {}; }
  catch (e) { daten = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(daten.title || 'Nutrition Planner', {
    body: daten.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: daten.tag || 'nutrition',
    data: { url: daten.url || '' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ziel = event.notification.data?.url || '';
  event.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of fenster) {
      if ('focus' in client) {
        if (ziel) client.postMessage({ typ: 'gehe-zu', url: ziel });
        return client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(ziel ? `./${ziel}` : './') : undefined;
  })());
});
