import { materialIconMarkup } from './categoryIcons.js';

// FoodDex und Eintragsdetail teilen absichtlich exakt dieselbe Aktionsleiste.
// Nur Inhalt und Handler des aufgeklappten Menüs unterscheiden sich.
export function foodDexActionsMarkup({
  panelContent,
  panelAttributes = '',
  menuAttributes = '',
  closeAttributes = '',
  closeHref,
  menuLabel = 'Menü öffnen',
  closeLabel = 'Schließen',
}) {
  return `<div class="food-dex-floating-actions">
    <div class="food-dex-action-popover" hidden ${panelAttributes}>
      ${panelContent}
    </div>
    <button type="button" class="food-dex-action-button food-dex-retro-menu" ${menuAttributes} aria-expanded="false" aria-label="${menuLabel}">
      <span class="food-dex-more-dots" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>
    <a class="food-dex-action-button food-dex-action-close" href="${closeHref}" ${closeAttributes} aria-label="${closeLabel}">${materialIconMarkup('close')}</a>
  </div>`;
}
