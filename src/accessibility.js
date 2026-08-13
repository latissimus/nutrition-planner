const CLOSE_SELECTOR = [
  '[data-sheet-close]',
  '[data-reminder-overlay-close]',
  '[data-meditation-close]',
  '[data-close]',
  '.dex-bild-schliessen',
].join(',');

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"]):not([type="file"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const dialogState = new WeakMap();
let idCounter = 0;

function setupInputModality() {
  const root = document.documentElement;
  const keyboard = (event) => {
    if (event.key === 'Tab' || event.key.startsWith('Arrow')) root.classList.add('tastatur-bedienung');
  };
  const pointer = () => root.classList.remove('tastatur-bedienung');
  document.addEventListener('keydown', keyboard, true);
  document.addEventListener('pointerdown', pointer, true);
  document.addEventListener('touchstart', pointer, true);
  return () => {
    document.removeEventListener('keydown', keyboard, true);
    document.removeEventListener('pointerdown', pointer, true);
    document.removeEventListener('touchstart', pointer, true);
  };
}

function isVisible(element) {
  return element instanceof HTMLElement && !element.hidden && element.getClientRects().length > 0;
}

export function focusableElements(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isVisible);
}

function labelDialog(dialog) {
  if (dialog.hasAttribute('aria-label') || dialog.hasAttribute('aria-labelledby')) return;
  const heading = dialog.querySelector('h1,h2,h3');
  if (!heading) {
    dialog.setAttribute('aria-label', 'Dialog');
    return;
  }
  if (!heading.id) heading.id = `dialog-title-${++idCounter}`;
  dialog.setAttribute('aria-labelledby', heading.id);
}

function activeDialogs() {
  return [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(isVisible);
}

function updateAppInert() {
  const app = document.querySelector('#app');
  if (!app) return;
  app.inert = activeDialogs().some((dialog) => !app.contains(dialog));
}

function enhanceDialog(dialog) {
  if (!(dialog instanceof HTMLElement) || dialogState.has(dialog)) return;
  labelDialog(dialog);
  dialog.tabIndex = dialog.hasAttribute('tabindex') ? dialog.tabIndex : -1;
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialogState.set(dialog, { trigger });
  queueMicrotask(() => {
    if (!dialog.isConnected) return;
    updateAppInert();
    // Reine Aktionsdialoge starten auf der Dialogflaeche. Ein automatisch
    // fokussierter erster Button erzeugt auf iOS sonst einen sichtbaren
    // Fokusrahmen, obwohl der Nutzer weder Tastatur noch Switch-Control nutzt.
    // Formulare koennen mit data-initial-focus/autofocus weiterhin bewusst ein
    // Eingabefeld als Startziel festlegen.
    const initial = dialog.querySelector('[data-initial-focus],[autofocus]') || dialog;
    initial.focus({ preventScroll: true });
  });
}

function enhanceNode(node) {
  if (!(node instanceof Element)) return;
  if (node.matches('.dex-bild-vollbild')) {
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    if (!node.hasAttribute('aria-label')) node.setAttribute('aria-label', 'Bild im Vollbild');
  }
  if (node.matches('[role="dialog"]')) enhanceDialog(node);
  node.querySelectorAll('[role="dialog"],.dex-bild-vollbild').forEach((dialog) => {
    if (dialog.matches('.dex-bild-vollbild')) {
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      if (!dialog.hasAttribute('aria-label')) dialog.setAttribute('aria-label', 'Bild im Vollbild');
    }
    enhanceDialog(dialog);
  });
}

function restoreRemovedDialogs(node) {
  if (!(node instanceof Element)) return;
  const removed = [node, ...node.querySelectorAll('[role="dialog"]')].filter((element) => dialogState.has(element));
  removed.forEach((dialog) => {
    const { trigger } = dialogState.get(dialog) || {};
    if (trigger?.isConnected) queueMicrotask(() => {
      updateAppInert();
      trigger.focus({ preventScroll: true });
    });
  });
  queueMicrotask(updateAppInert);
}

function handleDialogKeys(event) {
  const dialogs = activeDialogs();
  const dialog = dialogs.at(-1);
  if (!dialog) return;
  if (event.key === 'Escape') {
    const close = dialog.querySelector(CLOSE_SELECTOR);
    if (!close) return;
    event.preventDefault();
    close.click();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = focusableElements(dialog);
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus({ preventScroll: true });
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function setupDialogAccessibility(root = document.body) {
  const removeInputModality = setupInputModality();
  enhanceNode(root);
  const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => {
    mutation.addedNodes.forEach(enhanceNode);
    mutation.removedNodes.forEach(restoreRemovedDialogs);
  }));
  observer.observe(root, { childList: true, subtree: true });
  document.addEventListener('keydown', handleDialogKeys, true);
  return () => {
    observer.disconnect();
    document.removeEventListener('keydown', handleDialogKeys, true);
    removeInputModality();
  };
}
