/**
 * Sichtbarer Perf-Overlay für Dex-Wechsel.
 *
 * Aktivieren:  URL mit #perf öffnen, oder in der Konsole:
 *              localStorage.setItem('muscledex:perf','1'); location.reload();
 * Deaktivieren:localStorage.removeItem('muscledex:perf'); location.reload();
 *
 * Der Router markiert per mark() die Zwischenschritte eines Route-Wechsels;
 * das Overlay zeigt danach ein Wasserfall-Balken pro Schritt. Nur Debug-
 * Werkzeug — hat keinen Einfluss auf die App, wenn nicht aktiviert.
 */

const KEY = 'muscledex:perf-aus';
let versteckt = false;
let overlay = null;
let start = 0;
let route = '';
let marks = [];

function istAktiv() {
  if (versteckt) return false;
  try {
    if (typeof window === 'undefined') return false;
    // Nur ausgeschaltet, wenn Nutzer den × im Overlay geklickt hat.
    return localStorage.getItem(KEY) !== '1';
  } catch { return true; }
}

function ensureOverlay() {
  if (!istAktiv() || typeof document === 'undefined') return null;
  if (overlay && document.body.contains(overlay)) return overlay;
  overlay = document.createElement('div');
  overlay.setAttribute('data-perf-overlay', '');
  overlay.style.cssText = [
    'position:fixed', 'z-index:2147483647',
    'top:calc(env(safe-area-inset-top,0px) + 4px)',
    'right:6px', 'left:6px',
    'font:600 10px/1.25 ui-monospace,SFMono-Regular,Menlo,monospace',
    'color:#fff', 'background:rgba(0,0,0,.85)', 'padding:6px 8px 6px 8px',
    'border-radius:8px', 'max-height:40vh', 'overflow:hidden',
    'text-shadow:0 1px 1px #000',
    'pointer-events:auto',
  ].join(';');
  const zu = document.createElement('button');
  zu.type = 'button';
  zu.textContent = '×';
  zu.setAttribute('aria-label', 'Perf-Overlay ausblenden');
  zu.style.cssText = [
    'position:absolute', 'top:2px', 'right:4px',
    'width:22px', 'height:22px', 'border:0', 'background:transparent',
    'color:#fff', 'font:900 18px/1 sans-serif', 'cursor:pointer',
    'padding:0',
  ].join(';');
  zu.onclick = () => {
    try { localStorage.setItem(KEY, '1'); } catch {}
    versteckt = true;
    overlay?.remove();
    overlay = null;
  };
  overlay.append(zu);
  document.body.append(overlay);
  return overlay;
}

function farbe(label) {
  if (label.startsWith('modul')) return '#63E2FF';
  if (label.startsWith('query') || label.startsWith('load')) return '#F5C4B3';
  if (label.startsWith('render') || label.startsWith('paint')) return '#C0DD97';
  if (label === 'fertig') return '#FF69AE';
  return '#EAEEFA';
}

export function startRoute(routeName) {
  if (!istAktiv()) return;
  route = routeName;
  start = performance.now();
  marks = [];
}

export function mark(label) {
  if (!istAktiv() || !start) return;
  const jetzt = performance.now();
  const t = jetzt - start;
  const vorher = marks.length ? marks[marks.length - 1].t : 0;
  marks.push({ label, t, delta: t - vorher });
}

export function finishRoute() {
  if (!istAktiv() || !start) return;
  mark('fertig');
  const box = ensureOverlay();
  if (!box) return;
  const gesamt = marks[marks.length - 1].t;
  const zeilen = marks.map((m) => {
    const anteil = Math.min(100, Math.max(1, Math.round(m.delta / Math.max(gesamt, 1) * 100)));
    const balken = '█'.repeat(Math.max(1, Math.round(anteil / 4)));
    const zeit = Math.round(m.delta);
    return `<div style="display:flex;gap:6px;align-items:baseline">
      <span style="color:${farbe(m.label)};min-width:74px">${m.label}</span>
      <span style="color:${farbe(m.label)};min-width:36px;text-align:right">${zeit} ms</span>
      <span style="color:${farbe(m.label)};opacity:.6">${balken}</span>
    </div>`;
  }).join('');
  // Inhalte in einen inneren Container, damit der ×-Knopf oben rechts erhalten bleibt.
  let inner = box.querySelector(':scope > [data-perf-inhalt]');
  if (!inner) {
    inner = document.createElement('div');
    inner.setAttribute('data-perf-inhalt', '');
    inner.style.paddingRight = '22px';
    box.append(inner);
  }
  inner.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
    <b>${route}</b><span style="color:#FF69AE">Σ ${Math.round(gesamt)} ms</span>
  </div>${zeilen}`;
  start = 0;
}

export function abortRoute() {
  if (!istAktiv()) return;
  start = 0;
  marks = [];
}
