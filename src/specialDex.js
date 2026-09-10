import { categoryColor, pageLook } from './categoryIcons.js';

export const SPECIAL_DEX_CLASSES = Object.freeze({
  page: 'special-dex-page',
  hero: 'special-dex-hero',
  card: 'special-dex-wide-card',
  listCard: 'special-dex-list-card',
  content: 'special-dex-content',
  stack: 'special-dex-stack',
  overlay: 'special-dex-overlay',
  sheet: 'special-dex-sheet',
});

export function prepareSpecialDexPage(container, kind) {
  if (!container) return;
  container.classList.add(SPECIAL_DEX_CLASSES.page);
  if (kind) container.dataset.specialDex = kind;
}

export function createSpecialDexOverlay({
  markup,
  className = '',
  sheetClassName = '',
  closeSelector = '[data-close]',
  colorScope = 'reminders',
  replaceSelector = '',
  ariaLabel = '',
} = {}) {
  if (replaceSelector) document.querySelector(replaceSelector)?.remove();
  const backdrop = document.createElement('div');
  const look = pageLook(colorScope, categoryColor(colorScope), 'drops');
  backdrop.className = `kategorie-sheet-backdrop ${SPECIAL_DEX_CLASSES.overlay} ${className}`.trim();
  backdrop.style.setProperty('--ordner', look.accent || look.color);
  backdrop.style.setProperty('--ordner-ink', look.accentInk || look.ink);
  backdrop.style.setProperty('--dex-seitenfarbe', look.color);
  backdrop.style.setProperty('--dex-ink', look.ink);
  backdrop.style.setProperty('--dex-accent', look.accent || look.color);
  backdrop.style.setProperty('--dex-accent-ink', look.accentInk || look.ink);
  const labelAttribute = ariaLabel ? ` aria-label="${String(ariaLabel).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"` : '';
  backdrop.innerHTML = `<section class="kategorie-sheet ${SPECIAL_DEX_CLASSES.sheet} ${sheetClassName}" role="dialog" aria-modal="true"${labelAttribute}>${markup}</section>`;
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest(closeSelector)) backdrop.remove();
  });
  backdrop.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') backdrop.remove();
  });
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.querySelector(closeSelector)?.focus({ preventScroll: true }));
  return backdrop;
}
