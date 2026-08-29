import { playInterfaceSound } from './uiSounds.js';

// Generischer Long-Press: oeffnet eine Schnellaktion statt zu navigieren.
// Per Pointer Events, damit Touch und Maus gleich behandelt werden; ein
// kurzer Tap bleibt eine normale Navigation, da preventDefault nur beim
// Long-Press selbst greift.
export function bindLongPress(root, selector, resolveOpen, { signal } = {}) {
  if (!root || signal?.aborted) return () => {};
  const SCHWELLE_MS = 550;
  const TOLERANZ_PX = 10;
  let timer = null;
  let start = null;
  let ausgeloest = false;
  const abbrechen = () => { clearTimeout(timer); timer = null; start = null; };
  const onPointerDown = (event) => {
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
      playInterfaceSound('hover');
      open();
    }, SCHWELLE_MS);
  };
  const onPointerMove = (event) => {
    if (!timer || !start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TOLERANZ_PX) abbrechen();
  };
  const onClick = (event) => {
    if (!ausgeloest) return;
    ausgeloest = false;
    event.preventDefault();
    event.stopPropagation();
  };
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((typ) => root.addEventListener(typ, abbrechen));
  root.addEventListener('click', onClick, true);
  const cleanup = () => {
    abbrechen();
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((typ) => root.removeEventListener(typ, abbrechen));
    root.removeEventListener('click', onClick, true);
  };
  signal?.addEventListener('abort', cleanup, { once: true });
  return cleanup;
}
