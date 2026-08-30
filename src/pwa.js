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
  let neuerWorker = registration.waiting || null;
  let wechselGestartet = false;

  const updateButton = document.createElement('button');
  updateButton.type = 'button';
  updateButton.className = 'pwa-update-button';
  updateButton.innerHTML = '<b>Update verfügbar</b><small>Jetzt aktualisieren</small>';
  updateButton.hidden = true;
  document.body.append(updateButton);

  const anzeigen = (worker) => {
    if (!worker || !navigator.serviceWorker.controller) return;
    neuerWorker = worker;
    updateButton.hidden = false;
  };
  anzeigen(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') anzeigen(worker);
    });
  });

  updateButton.onclick = () => {
    if (!neuerWorker) return;
    wechselGestartet = true;
    updateButton.disabled = true;
    updateButton.querySelector('small').textContent = 'Wird installiert …';
    neuerWorker.postMessage({ typ: 'skip-waiting' });
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (wechselGestartet) location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registration.update().catch(() => {});
  });
  setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
  return registration;
}
