import { categoryColor, colorIsDark } from './categoryIcons.js';

export const SPECIAL_DEX_CLASSES = Object.freeze({
  page: 'special-dex-page',
  hero: 'special-dex-hero',
  card: 'special-dex-wide-card',
  listCard: 'special-dex-list-card',
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
  const color = categoryColor(colorScope);
  backdrop.className = `kategorie-sheet-backdrop ${SPECIAL_DEX_CLASSES.overlay} ${className}`.trim();
  backdrop.style.setProperty('--ordner', color);
  backdrop.style.setProperty('--dex-seitenfarbe', color);
  backdrop.style.setProperty('--ordner-ink', colorIsDark(color) ? '#fff' : '#111');
  backdrop.style.setProperty('--dex-ink', colorIsDark(color) ? '#fff' : '#111');
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
