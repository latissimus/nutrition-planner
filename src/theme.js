// Die Darstellung ist eine Geraete-Vorliebe: am Handy darf Dark aktiv sein,
// waehrend derselbe Account am Rechner Retro nutzt.
const KEY = 'nutrition:theme';
const overlayQuellen = new Set();
// Overlays, die ihre eigene vollflaechige Abdunkelung mitbringen (Sheets mit
// Backdrop). Sie duerfen NICHT zusaetzlich vorgedunkelt werden – siehe
// setStatusleistenOverlay.
const overlayVollflaechig = new Set();
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
  return `#${[kanal(0), kanal(2), kanal(4)]
    .map((wert) => wert.toString(16).padStart(2, '0')).join('')}`;
}

// vollflaechig: Das Overlay legt selbst eine durchscheinende Flaeche ueber den
// ganzen Viewport. Weil "viewport-fit=cover" gesetzt ist, reicht ein
// position:fixed mit inset:0 dabei bis unter Uhrzeit und Akku – die Flaeche
// deckt die Safe Area also von sich aus ab.
//
// In dem Fall darf nichts vorgedunkelt werden. Sonst liegen zwei Schichten
// uebereinander: --statusbar-bg dunkelt html/body/#app auf 72% ab, der Backdrop
// legt nochmal 28% drauf, und die Kopfzeile landet bei 52%. Der deckende
// Schutzstreifen ueber der Safe Area traegt aber nur die 72% – dadurch wirkt
// genau der iOS-Bereich heller als alles darunter, statt mitgedunkelt zu sein.
export function setStatusleistenOverlay(quelle, offen, { vollflaechig = false } = {}) {
  if (!quelle) return;
  const root = document.documentElement;
  const warOffen = overlayQuellen.size > 0;
  if (offen) {
    overlayQuellen.add(quelle);
    if (vollflaechig) overlayVollflaechig.add(quelle);
  } else {
    overlayQuellen.delete(quelle);
    overlayVollflaechig.delete(quelle);
  }
  const istOffen = overlayQuellen.size > 0;
  // Nur wenn ALLE offenen Overlays ihre eigene Flaeche mitbringen, darf die
  // Vordunkelung entfallen – sonst steht ein Overlay ohne Backdrop ungeschuetzt da.
  const alleVollflaechig = istOffen && overlayVollflaechig.size === overlayQuellen.size;
  root.classList.toggle('statusleiste-overlay', istOffen);
  root.classList.toggle('overlay-vollflaechig', alleVollflaechig);

  // theme-color wird hier bewusst NICHT angefasst. Bei
  // apple-mobile-web-app-status-bar-style=black-translucent liest iOS das
  // Meta-Tag fuer die Symbolfarbe nicht – es schaut sich an, was die Seite in
  // dem Bereich tatsaechlich zeichnet, und waehlt Schwarz oder Weiss danach.
  // Ueber theme-color zu steuern hat deshalb nie gewirkt und nur verschleiert,
  // dass die abdunkelnde Flaeche selbst bis dort oben reichen muss.
  if (istOffen && !alleVollflaechig) {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    root.style.setProperty('--statusbar-bg', abgedunkelt(bg));
  } else {
    root.style.removeProperty('--statusbar-bg');
  }

  if (!warOffen && istOffen) {
    const scroller = document.querySelector('#view');
    overlayScrollY = scroller?.scrollTop || 0;
    root.classList.add('overlay-scroll-gesperrt');
  } else if (warOffen && !istOffen) {
    const scroller = document.querySelector('#view');
    root.classList.remove('overlay-scroll-gesperrt');
    if (scroller) scroller.scrollTop = overlayScrollY;
  }
}

export function applyTheme(theme) {
  const wert = gueltig(theme);
  // Die fruehere optionale Schatteneinstellung existiert nicht mehr. Das
  // Attribut wird auch bei einem Vite-Hot-Reload entfernt, damit ein alter
  // Browserzustand den verbindlichen Neo-Retro-Look nicht weiter ueberschreibt.
  delete document.documentElement.dataset.schatten;
  try { localStorage.removeItem('nutrition:schatten'); } catch (e) { /* optionaler Altwert */ }
  document.documentElement.dataset.theme = wert;
  requestAnimationFrame(() => {
    // theme-color folgt nur noch dem Theme. Der Vorbehalt gegen offene Overlays
    // ist entfallen, weil kein Overlay die Farbe mehr ueberschreibt.
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
