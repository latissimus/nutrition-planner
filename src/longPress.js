import { playInterfaceSound } from './uiSounds.js';

// Generischer Long-Press: oeffnet eine Schnellaktion statt zu navigieren.
// Per Pointer Events, damit Touch und Maus gleich behandelt werden; ein
// kurzer Tap bleibt eine normale Navigation, da preventDefault nur beim
// Long-Press selbst greift.
export function bindLongPress(root, selector, resolveOpen) {
  if (!root) return;
  const SCHWELLE_MS = 550;
  const TOLERANZ_PX = 10;
  let timer = null;
  let start = null;
  let ausgeloest = false;
  const abbrechen = () => { clearTimeout(timer); timer = null; start = null; };
  root.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const el = event.target.closest(selector);
    if (!el) return;
    ausgeloest = false;
    start = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      const open = resolveOpen(el);
      if (!open) return;
      ausgeloest = true;
      navigator.vibrate?.(10);
      playInterfaceSound('long-press');
      open();
    }, SCHWELLE_MS);
  });
  root.addEventListener('pointermove', (event) => {
    if (!timer || !start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TOLERANZ_PX) abbrechen();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((typ) => root.addEventListener(typ, abbrechen));
  root.addEventListener('click', (event) => {
    if (!ausgeloest) return;
    ausgeloest = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}
