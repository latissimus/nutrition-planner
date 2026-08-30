export async function registriereServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  if (import.meta.env.DEV) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames
        .filter((name) => name.startsWith('workbox-precache'))
        .map((name) => caches.delete(name)));
    }
    return null;
  }
  // Relativ zur Seite, weil GitHub Pages die App in einem Unterordner ausliefert.
  const registration = await navigator.serviceWorker.register('./sw.js');
  let reloadGestartet = false;
  const aktivieren = (worker) => {
    if (!worker || !navigator.serviceWorker.controller) return;
    worker.postMessage({ typ: 'skip-waiting' });
  };
  aktivieren(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') aktivieren(worker);
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadGestartet) return;
    reloadGestartet = true;
    location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registration.update().catch(() => {});
  });
  setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
  return registration;
}
