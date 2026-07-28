// Die Darstellung ist eine Geraete-Vorliebe: am Handy darf Dark aktiv sein,
// waehrend derselbe Account am Rechner Retro nutzt.
const KEY = 'nutrition:theme';

export const gueltig = (theme) => (theme === 'dark' ? 'dark' : 'retro');

export function getTheme() {
  try { return gueltig(localStorage.getItem(KEY)); }
  catch (e) { return 'retro'; }
}

function metaFarbeSetzen(farbe) {
  const alt = document.querySelector('meta[name="theme-color"]');
  if (!alt || alt.getAttribute('content') === farbe) return;
  const neu = document.createElement('meta');
  neu.name = 'theme-color';
  neu.content = farbe;
  alt.replaceWith(neu);
}

export function applyTheme(theme) {
  const wert = gueltig(theme);
  document.documentElement.dataset.theme = wert;
  requestAnimationFrame(() => {
    const farbe = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (farbe) metaFarbeSetzen(farbe);
  });
}

export function setTheme(theme) {
  const wert = gueltig(theme);
  try { localStorage.setItem(KEY, wert); } catch (e) { /* gilt nur fuer diese Sitzung */ }
  applyTheme(wert);
  return wert;
}
