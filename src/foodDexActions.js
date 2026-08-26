import { materialIconMarkup } from './categoryIcons.js';

// Neutrale Dex-Aktionsleiste im aktuellen FoodDex-Look.
// FoodDex behält die alten Klassen als Kompatibilitätsanker; neue Dex können
// später direkt die neo-dex-* Klassen verwenden und eigene Inhalte/Handler
// einsetzen.
export function foodDexActionsMarkup({
  panelContent,
  panelAttributes = '',
  menuAttributes = '',
  closeAttributes = '',
  closeHref,
  menuLabel = 'Menü öffnen',
  closeLabel = 'Schließen',
}) {
  return `<div class="neo-dex-floating-actions food-dex-floating-actions">
    <div class="neo-dex-action-popover food-dex-action-popover" hidden ${panelAttributes}>
      ${panelContent}
    </div>
    <button type="button" class="neo-dex-action-button neo-dex-retro-menu food-dex-action-button food-dex-retro-menu" ${menuAttributes} aria-expanded="false" aria-label="${menuLabel}">
      <span class="neo-dex-more-dots food-dex-more-dots" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>
    <a class="neo-dex-action-button neo-dex-action-close food-dex-action-button food-dex-action-close" href="${closeHref}" ${closeAttributes} aria-label="${closeLabel}">${materialIconMarkup('close')}</a>
  </div>`;
}
