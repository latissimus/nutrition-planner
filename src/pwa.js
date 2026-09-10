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
  // updateViaCache:"none" verhindert insbesondere auf iOS, dass beim expliziten
  // Update-Check noch eine zwischengespeicherte Worker-Datei verwendet wird.
  const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
  let neuerWorker = registration.waiting || null;
  let wechselGestartet = false;
  const beobachteteWorker = new WeakSet();

  const updateButton = document.querySelector('.pwa-update-button') || document.createElement('button');
  if (!updateButton.isConnected) {
    updateButton.type = 'button';
    updateButton.className = 'pwa-update-button';
    updateButton.innerHTML = '<b>Update verfügbar</b><small>Jetzt aktualisieren</small>';
    updateButton.hidden = true;
    updateButton.setAttribute('aria-live', 'polite');
    document.body.append(updateButton);
  }

  const anzeigen = (worker) => {
    if (!worker || !navigator.serviceWorker.controller) return;
    neuerWorker = worker;
    updateButton.disabled = false;
    updateButton.querySelector('small').textContent = 'Jetzt aktualisieren';
    updateButton.hidden = false;
  };

  // register() kann bereits eine Installation anstossen, bevor sein Promise
  // aufgeloest wird. Nur auf ein spaeteres updatefound zu hoeren verpasst
  // genau diesen haeufigen App-Start-Fall. Deshalb wird auch der bereits
  // vorhandene installing-Worker sofort beobachtet.
  const beobachteWorker = (worker) => {
    if (!worker || beobachteteWorker.has(worker)) return;
    beobachteteWorker.add(worker);
    const statusPruefen = () => {
      if (worker.state === 'installed') anzeigen(worker);
    };
    worker.addEventListener('statechange', statusPruefen);
    statusPruefen();
  };

  const workerSynchronisieren = () => {
    anzeigen(registration.waiting);
    beobachteWorker(registration.installing);
  };

  workerSynchronisieren();
  registration.addEventListener('updatefound', () => {
    beobachteWorker(registration.installing);
  });

  let updatePruefung = null;
  const aufUpdatePruefen = () => {
    if (updatePruefung) return updatePruefung;
    updatePruefung = registration.update()
      .catch(() => null)
      .finally(() => {
        workerSynchronisieren();
        updatePruefung = null;
      });
    return updatePruefung;
  };

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
    if (document.visibilityState === 'visible') void aufUpdatePruefen();
  });
  window.addEventListener('pageshow', aufUpdatePruefen);
  window.addEventListener('online', aufUpdatePruefen);
  setInterval(aufUpdatePruefen, 15 * 60 * 1000);

  // Der Listener steht jetzt, bevor aktiv geprueft wird. So kann auch ein
  // Update, das exakt waehrend des App-Starts gefunden wird, nicht durchrutschen.
  await aufUpdatePruefen();
  return registration;
}
