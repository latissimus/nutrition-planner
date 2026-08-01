// Die Darstellung ist eine Geraete-Vorliebe: am Handy darf Dark aktiv sein,
// waehrend derselbe Account am Rechner Retro nutzt.
const KEY = 'nutrition:theme';
const overlayQuellen = new Set();
let overlayScrollY = 0;

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

function abgedunkelt(farbe, anteil = 0.28) {
  const hex = farbe.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) return farbe;
  const faktor = 1 - anteil;
  const kanal = (start) => Math.round(parseInt(hex.slice(start, start + 2), 16) * faktor);
  return `rgb(${kanal(0)} ${kanal(2)} ${kanal(4)})`;
}

export function setStatusleistenOverlay(quelle, offen) {
  if (!quelle) return;
  const root = document.documentElement;
  const warOffen = overlayQuellen.size > 0;
  if (offen) overlayQuellen.add(quelle);
  else overlayQuellen.delete(quelle);
  const istOffen = overlayQuellen.size > 0;
  root.classList.toggle('statusleiste-overlay', istOffen);

  if (istOffen) {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    const overlayBg = abgedunkelt(bg);
    root.style.setProperty('--statusbar-bg', overlayBg);
    metaFarbeSetzen(overlayBg);
  } else {
    root.style.removeProperty('--statusbar-bg');
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) metaFarbeSetzen(bg);
  }

  if (!warOffen && istOffen) {
    overlayScrollY = window.scrollY;
    root.classList.add('overlay-scroll-gesperrt');
    const scroller = document.querySelector('#view');
    if (scroller) scroller.scrollTop = overlayScrollY;
    window.scrollTo(0, 0);
  } else if (warOffen && !istOffen) {
    const scroller = document.querySelector('#view');
    overlayScrollY = scroller?.scrollTop || overlayScrollY;
    root.classList.remove('overlay-scroll-gesperrt');
    if (scroller) scroller.scrollTop = 0;
    window.scrollTo(0, overlayScrollY);
  }
}

export function applyTheme(theme) {
  const wert = gueltig(theme);
  document.documentElement.dataset.theme = wert;
  requestAnimationFrame(() => {
    const farbe = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (farbe && !overlayQuellen.size) metaFarbeSetzen(farbe);
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
