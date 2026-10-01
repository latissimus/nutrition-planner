import { tonDauerBeobachten } from './uiSounds.js';

/* Vorübergehende Messung für ruckelnde Symbole (nur auf Wunsch aktiv).
   Fünfmal schnell auf das CAPBOY-Logo tippen schaltet sie ein oder aus. Nach
   jedem Tipp zeichnet sie 1,5 Sekunden lang pro Frame auf, wo die sichtbaren
   Symbole stehen, welche ersetzt werden und ob Frames ausfallen. Das Ergebnis
   erscheint oben als Tafel; ein Tipp darauf schließt sie. */
const SCHALTER = 'capboy:ruckel-diagnose';
const DAUER_MS = 1500;
const SYMBOLE = [
  '.app-dex-tab>span', '.app-dex-kapsel svg', '.app-dex-kapsel img', '.nav-av',
  '.material-svg', '.icon-originalfarben', '[data-category-icon]', 'button svg',
].join(',');

const istAn = () => { try { return localStorage.getItem(SCHALTER) === '1'; } catch { return false; } };

function name(element) {
  const traeger = element.closest('[aria-label],[href],[data-sammlung],button');
  const text = traeger?.getAttribute('aria-label') || traeger?.getAttribute('href') || traeger?.dataset?.sammlung || '';
  const ort = element.closest('.app-dex-dock') ? 'Menüband' : element.closest('.app-dex-header') ? 'Header'
    : element.closest('.kategorie-sheet-backdrop') ? 'Sheet' : 'Seite';
  return `${ort}: ${text.slice(0, 28) || element.className?.baseVal || element.className || element.tagName}`;
}

function sichtbareSymbole() {
  const hoehe = window.innerHeight;
  return [...document.querySelectorAll(SYMBOLE)].filter((element) => {
    if (element.parentElement?.closest(SYMBOLE)) return false;
    const r = element.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < hoehe;
  }).slice(0, 80);
}

const rechteck = (element) => {
  const r = element.getBoundingClientRect();
  return [r.left, r.top, r.width, r.height];
};

let laeuft = false;
let marken = null;
let markenStart = 0;
// Zeitmarken aus main.js (Seitenwechsel, Übergang, Tausch). Nur während einer
// laufenden Messung aufgezeichnet.
export function ruckelMarke(text) {
  if (marken) marken.push(`${Math.round(performance.now() - markenStart)} ${text}`);
}

function messen() {
  if (laeuft) return;
  laeuft = true;
  const start = performance.now();
  marken = [];
  markenStart = start;
  const ziele = sichtbareSymbole().map((element) => ({ element, name: name(element), erste: rechteck(element), max: 0, spruenge: [] }));
  const ersetzt = [];
  const beobachter = new MutationObserver((eintraege) => {
    for (const eintrag of eintraege) {
      for (const knoten of eintrag.removedNodes) {
        if (knoten instanceof Element && (knoten.matches(SYMBOLE) || knoten.querySelector(SYMBOLE))) {
          ersetzt.push(`${Math.round(performance.now() - start)} ms: ${name(eintrag.target instanceof Element ? eintrag.target : knoten)}`);
        }
      }
    }
  });
  beobachter.observe(document.body, { childList: true, subtree: true });
  const ausfaelle = [];
  let vorher = start;
  let ersterFrame = true;
  const frame = (jetzt) => {
    if (ersterFrame) { ersterFrame = false; ruckelMarke('erster Frame'); }
    if (jetzt - vorher > 34) ausfaelle.push(`${Math.round(vorher - start)}–${Math.round(jetzt - start)} ms`);
    vorher = jetzt;
    for (const ziel of ziele) {
      if (!ziel.element.isConnected) { ziel.weg ??= Math.round(jetzt - start); continue; }
      const jetztR = rechteck(ziel.element);
      const abweichung = Math.max(...jetztR.map((wert, index) => Math.abs(wert - ziel.erste[index])));
      if (ziel.letzte) {
        const sprung = Math.max(...jetztR.map((wert, index) => Math.abs(wert - ziel.letzte[index])));
        if (sprung > 0.2) ziel.spruenge.push(`${Math.round(jetzt - start)}:${sprung.toFixed(1)}`);
      }
      ziel.letzte = jetztR;
      ziel.max = Math.max(ziel.max, abweichung);
    }
    if (jetzt - start < DAUER_MS) requestAnimationFrame(frame);
    else auswerten();
  };
  requestAnimationFrame(frame);

  function auswerten() {
    beobachter.disconnect();
    laeuft = false;
    const ablauf = marken || [];
    marken = null;
    const bewegt = ziele.filter((ziel) => ziel.max > 0.2 || ziel.weg != null);
    const zeilen = [
      `Ablauf (ms): ${ablauf.length ? ablauf.join(' · ') : '–'}`,
      `Ausgefallene Frames: ${ausfaelle.length ? ausfaelle.slice(0, 8).join(', ') : 'keine'}`,
      `Symbole gemessen: ${ziele.length}`,
      `Bewegt/ersetzt: ${bewegt.length}`,
      ...bewegt.slice(0, 14).map((ziel) => (ziel.weg != null
        ? `• ${ziel.name} – ersetzt nach ${ziel.weg} ms`
        : `• ${ziel.name} – max ${ziel.max.toFixed(1)} px, Schritte ${ziel.spruenge.slice(0, 6).join(' ')}`)),
      `Ausgetauschte Knoten: ${ersetzt.length}`,
      ...ersetzt.slice(0, 6).map((zeile) => `• ${zeile}`),
    ];
    tafelZeigen(zeilen.join('\n'));
  }
}

function tafelZeigen(text) {
  document.querySelector('.ruckel-diagnose')?.remove();
  const tafel = document.createElement('pre');
  tafel.className = 'ruckel-diagnose';
  tafel.textContent = text;
  Object.assign(tafel.style, {
    position: 'fixed', zIndex: '5000', top: 'calc(env(safe-area-inset-top) + 6px)', left: '8px', right: '8px',
    margin: '0', padding: '10px 12px', maxHeight: '48vh', overflow: 'auto', whiteSpace: 'pre-wrap',
    background: 'rgba(0,0,0,.86)', color: '#fff', border: '1px solid #fff', borderRadius: '12px',
    font: '500 11px/1.4 "JetBrains Mono", monospace', pointerEvents: 'auto',
  });
  tafel.addEventListener('click', (event) => { event.stopPropagation(); tafel.remove(); });
  document.body.append(tafel);
}

export function ruckelDiagnoseEinrichten() {
  tonDauerBeobachten((cue, dauer) => ruckelMarke(`Ton ${cue} ${Math.round(dauer)} ms`));
  let logoTipps = [];
  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('.app-dex-brand')) return;
    const jetzt = performance.now();
    logoTipps = [...logoTipps.filter((zeit) => jetzt - zeit < 1500), jetzt];
    if (logoTipps.length < 5) return;
    logoTipps = [];
    const an = !istAn();
    try { localStorage.setItem(SCHALTER, an ? '1' : '0'); } catch {}
    tafelZeigen(an ? 'Messung an: Tippe jetzt dorthin, wo es ruckelt.\nDanach erscheint hier das Ergebnis.' : 'Messung aus.');
  }, true);
  document.addEventListener('pointerup', (event) => {
    if (!istAn() || event.target.closest?.('.ruckel-diagnose,.app-dex-brand')) return;
    messen();
  }, true);
}
