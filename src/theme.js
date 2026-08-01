// Die Darstellung ist eine Geraete-Vorliebe: am Handy darf Dark aktiv sein,
// waehrend derselbe Account am Rechner Retro nutzt.
const KEY = 'nutrition:theme';

// Drei Darstellungen: der Feastables-Standard, das urspruengliche RetroMuscle
// und Dark. "standard" ist der Ausgangswert und braucht deshalb kein
// data-theme-Attribut – es ist der :root-Block im Stylesheet.
export const THEMES = ['standard', 'retro', 'dark'];

export const gueltig = (theme) => (THEMES.includes(theme) ? theme : 'standard');

export function getTheme() {
  try { return gueltig(localStorage.getItem(KEY)); }
  catch (e) { return 'standard'; }
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

// Der harte Versatzschatten ist eine eigene Entscheidung, kein Teil des Themes:
// Jedes Theme laesst sich mit und ohne fuehren. Deshalb ein zweiter Schluessel
// und ein zweites Attribut, statt die Themeliste zu verdoppeln.
const SCHATTEN_KEY = 'nutrition:schatten';

export function getSchatten() {
  try { return localStorage.getItem(SCHATTEN_KEY) !== 'aus'; }
  catch (e) { return true; }
}

export function applySchatten(an) {
  // Nur das Ausschalten braucht ein Attribut – an ist der Normalfall.
  if (an) delete document.documentElement.dataset.schatten;
  else document.documentElement.dataset.schatten = 'aus';
}

export function setSchatten(an) {
  try { localStorage.setItem(SCHATTEN_KEY, an ? 'an' : 'aus'); }
  catch (e) { /* gilt nur fuer diese Sitzung */ }
  applySchatten(an);
  return an;
}
