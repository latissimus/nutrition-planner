// Die Darstellung ist eine Geraete-Vorliebe: am Handy darf Dark aktiv sein,
// waehrend derselbe Account am Rechner Retro nutzt.
const KEY = 'nutrition:theme';

// Zwei Darstellungen. "retro" traegt die Feastables-Palette und ist der
// Ausgangswert; im Stylesheet ist das der blanke :root-Block. data-theme wird
// trotzdem gesetzt – der Wert greift ins Leere und bleibt als Angriffspunkt
// fuer spaetere retro-spezifische Regeln stehen.
// Frueher gespeicherte Werte ("standard" aus der Zwischenstufe) fallen ueber
// gueltig() automatisch auf retro zurueck.
export const THEMES = ['retro', 'dark'];

export const gueltig = (theme) => (THEMES.includes(theme) ? theme : 'retro');

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
