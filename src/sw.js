import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Produktbilder von Open Food Facts ändern sich praktisch nie. Cache-first
// verhindert, dass dieselben Vorschaubilder bei jeder Suche erneut langsam
// über das Mobilfunknetz geladen werden müssen.
registerRoute(
  ({ url, request }) => request.destination === 'image'
    && (url.hostname === 'images.openfoodfacts.org' || url.hostname.endsWith('.openfoodfacts.org')),
  async ({ request }) => {
    const cache = await caches.open('muscledex-food-images-v1');
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
    return response;
  },
);

self.addEventListener('message', (event) => {
  if (event.data?.typ === 'skip-waiting') self.skipWaiting();
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let daten = {};
  try { daten = event.data ? event.data.json() : {}; }
  catch (e) { daten = { body: event.data ? event.data.text() : '' }; }
  const title = daten.title || 'MUSCLEDEX';
  const basis = {
    body: daten.body || '',
    tag: daten.tag || 'muscledex',
    data: {
      url: daten.url || '',
      reminderId: daten.reminderId || '',
      reminderType: daten.reminderType || '',
    },
  };
  const icon = new URL('muscledex-icon-192-v4.png', self.registration.scope).href;
  // Einzelne iOS-Versionen verwerfen die komplette Notification, wenn ein
  // Icon/Badge beim Aufwecken des Workers nicht dekodiert werden kann. Apple
  // hat den Web Push dann bereits erfolgreich angenommen, der Nutzer sieht
  // aber nichts. In diesem Fall sofort ohne Branding erneut anzeigen.
  event.waitUntil((async () => {
    try {
      await self.registration.showNotification(title, { ...basis, icon, badge: icon });
    } catch {
      await self.registration.showNotification(title, basis);
    }
  })());
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
