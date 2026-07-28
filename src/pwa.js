export async function registriereServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  // Relativ zur Seite, weil GitHub Pages die App in einem Unterordner ausliefert.
  return navigator.serviceWorker.register('./sw.js');
}
