import { toast } from './toast.js';
import { getPreference, setPreference } from './userPreferences.js';

const modules = import.meta.glob('../MUSCLEDEX-ICONS/*.svg', {
  query: '?raw', import: 'default', eager: true,
});
const wallpaperModules = import.meta.glob('../MUSCLEDEX-TAPETEN/*.svg', {
  query: '?url', import: 'default', eager: true,
});
// Reine Hintergrundmuster und zwei alte, bereits farbig gestaltete Fremdicons
// gehoeren nicht in den Wähler. Die schwarzen UI-Varianten (z. B. more_horiz)
// bleiben weiterhin verfügbar.
const hiddenPickerFiles = new Set(['pet_supplies-pattern.svg', 'home_119047.svg', 'more_icon_244655.svg']);
const icons = Object.entries(modules).filter(([path]) => !hiddenPickerFiles.has(path.split('/').at(-1))).map(([path, svg]) => {
  const file = path.split('/').at(-1);
  const id = file.replace(/_24dp.*$/i, '').replace(/\.svg$/i, '').normalize('NFC').toLocaleLowerCase('de');
  const title = id.replaceAll('_', ' ');
  // SVGs mit dem Suffix "-color.svg" behalten ihre selbst definierten
  // Farben. Alle anderen Icons duerfen weiterhin durch das jeweilige UI
  // schwarz bzw. weiss eingefaerbt werden.
  const originalColors = /-color\.svg$/i.test(file);
  // Einige Icons (z. B. Lebensmittel.svg) tragen einen XML-Prolog + DOCTYPE,
  // der beim Einfügen per innerHTML stört – deshalb entfernen.
  const bereinigt = String(svg).replace(/<\?xml[\s\S]*?\?>/gi, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').trim();
  return { id, title, svg: bereinigt, originalColors };
}).sort((a, b) => a.title.localeCompare(b.title, 'de'));
export const availableCategoryIcons = icons;
// Groß-/Kleinschreibung egal: die IDs werden beim Laden kleingeschrieben.
const iconById = (id) => icons.find((icon) => icon.id === String(id || '').normalize('NFC').toLocaleLowerCase('de'));
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const defaults = {
  body: 'body_fat', reminders: 'notifications', 'food-log': 'fork_spoon',
  recipes: 'menu_book', training: 'fitness_center', habits: 'bucket_check',
  shopping: 'emoji:🛒',
  sleep: 'emoji:😴',
  coins: 'star',
};
const storageKey = (route) => `muscledex:kategorie-icon:${route}`;
const colorKey = (route) => `muscledex:kategorie-farbe:${route}`;
const pageColorKey = (scope) => `muscledex:seitenfarbe:${scope}`;
const pagePatternKey = (scope) => `muscledex:seitenmuster:${scope}`;
let deferredPageLook = null;
let deferPageLook = false;
const defaultColors = {
  body: '#B1E7FF', reminders: '#FF3483', 'food-log': '#FBE7A3',
  recipes: '#007DCC', training: '#215E61', habits: '#245953',
  shopping: '#FFCF00',
  sleep: '#333D6D',
  coins: '#05BDE8',
};
const fixedSystemColors = {
  body: '#B1E7FF',
  'food-log': '#FBE7A3',
  training: '#215E61',
  reminders: '#525CEB',
  sleep: '#333D6D',
};
const fixedSystemPatterns = {
  body: 'wallpaper-measure',
  'food-log': 'wallpaper-pizza',
  training: 'wallpaper-dumbbell',
  reminders: 'wallpaper-burger',
  sleep: 'wallpaper-moon',
};
const colorGroups = [
  ['DEX-Farben', [
    ['Kaffeebraun', '#492426'],
    ['Creme', '#F2EBE0'],
    ['Retro Muscle Hellblau', '#B1E7FF'],
    ['Retro Muscle Navy', '#001454'],
    ['Arcadeblau', '#007DCC'],
    ['Minttürkis', '#00E0BA'],
    ['Magenta', '#91008D'],
    ['Pink', '#FF3483'],
    ['Dunkelviolett', '#450693'],
    ['Indigoblau', '#525CEB'],
    ['Dunkelgrün', '#245953'],
    ['Petrol', '#006E7F'],
    ['Electric Violet', '#8C00FF'],
    ['Retro-Lavendel', '#9772FB'],
    ['Vanillegelb', '#FFE59D'],
    ['Hot Pink', '#FF06B7'],
    ['Periwinkle', '#8CA9FF'],
  ]],
  ['Weitere Retro-Farben', [
    ['Dusty Rose', '#D35D6E'],
    ['Puderrosa', '#FFDADA'],
    ['Rosé', '#F599C6'],
    ['Pastellgrün', '#ACE1AF'],
    ['Flieder', '#B983FF'],
    ['Pastellgelb', '#FCFFA6'],
    ['Vintage Petrol', '#79B4B7'],
    ['Tiefgrün', '#064420'],
    ['Braunrosa', '#865858'],
    ['Ultra Violet', '#6F00FF'],
    ['Neonorange', '#FF6B00'],
    ['Neonblau', '#00A8FF'],
    ['Neoncyan', '#00FFF0'],
  ]],
];
const retroColors = colorGroups.flatMap(([, colors]) => colors);
export const dexEditorColors = [...new Set(retroColors.map(([, color]) => color))];

export function colorIsDark(color) {
  const hex = String(color || '').trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const channels = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithWhite >= contrastWithBlack;
}

export function categoryColor(route) {
  if (fixedSystemColors[route]) return fixedSystemColors[route];
  const saved = getPreference(colorKey(route));
  const valid = saved && retroColors.some(([, color]) => color === saved.toUpperCase());
  return valid ? saved.toUpperCase() : (defaultColors[route] || '#B1E7FF');
}

const readableInkFor = (color) => (colorIsDark(color) ? '#FFFFFF' : '#111111');

const wallpaperPatterns = Object.entries(wallpaperModules).map(([path, url]) => {
  const file = path.split('/').at(-1).replace(/\.svg$/i, '');
  const id = `wallpaper-${file.toLocaleLowerCase('de').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`;
  return [id, file.replaceAll('_', ' '), url];
}).sort((a, b) => a[1].localeCompare(b[1], 'de'));

// Dasselbe kleine Dreieckraster wie im LOGMAN Set-O-Meter. Anders als die
// dekorative Dreieck.svg bleibt dieses Motiv ruhig und regelmaessig. Als
// einfarbige Maske kann es je nach Dex-Farbe schwarz oder weiss erscheinen.
const setOMeterTriangles = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26'%3E%3Cpath d='M13 9l4.2 7h-8.4z' fill='%23000'/%3E%3C/svg%3E";

export const pagePatterns = [
  ...wallpaperPatterns,
  ['setometer-triangles', 'Set-O-Meter-Dreiecke', setOMeterTriangles],
  ['none', 'Ohne Muster'],
];
const defaultPagePattern = wallpaperPatterns[0]?.[0] || 'none';
const normalizePagePattern = (pattern) => (
  pagePatterns.some(([id]) => id === pattern) ? pattern : defaultPagePattern
);

const wallpaperStyle = (url) => url
  ? ` class="tapete-datei" style="--tapeten-vorschau:url(&quot;${escapeHtml(url)}&quot;)"`
  : '';

export function bindWallpaperLongPress(root) {
  if (!root || root.dataset.tapetenLangdruck === 'aktiv') return;
  root.dataset.tapetenLangdruck = 'aktiv';
  let timer = null;
  let target = null;
  let preview = null;
  let startX = 0;
  let startY = 0;
  const selector = '[data-pattern],[data-page-pattern],[data-pick-pattern]';
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    preview?.remove();
    preview = null;
    target = null;
  };
  root.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    target = event.target.closest(selector);
    if (!target) return;
    startX = event.clientX;
    startY = event.clientY;
    timer = setTimeout(() => {
      const tile = target?.querySelector('i');
      if (!tile) return;
      preview = document.createElement('div');
      preview.className = 'tapeten-langvorschau';
      preview.appendChild(tile.cloneNode(true));
      document.body.appendChild(preview);
      target.dataset.langdruckVorschau = 'ja';
      navigator.vibrate?.(12);
    }, 430);
  }, { passive: true });
  root.addEventListener('pointermove', (event) => {
    if (!target || Math.hypot(event.clientX - startX, event.clientY - startY) <= 9) return;
    clear();
  }, { passive: true });
  ['pointerup', 'pointercancel'].forEach((type) => root.addEventListener(type, () => {
    if (!target) return;
    const pressed = target;
    const wasPreview = Boolean(preview);
    clear();
    if (wasPreview) pressed.dataset.langdruckVorschau = 'ja';
  }, { passive: true }));
  root.addEventListener('click', (event) => {
    const button = event.target.closest(selector);
    if (!button || button.dataset.langdruckVorschau !== 'ja') return;
    delete button.dataset.langdruckVorschau;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  root.addEventListener('contextmenu', (event) => {
    if (event.target.closest(selector)) event.preventDefault();
  });
}

export function setPageLookPattern(scope, pattern) {
  const valid = normalizePagePattern(pattern);
  setPreference(pagePatternKey(scope), valid);
  return valid;
}

export function setPageLookColor(scope, color) {
  const normalized = String(color || '').toUpperCase();
  setPreference(pageColorKey(scope), normalized);
  return normalized;
}

export function pageLook(scope, fallbackColor, fallbackPattern = 'drops') {
  const fixedColor = fixedSystemColors[scope];
  const fixedPattern = fixedSystemPatterns[scope];
  const fallback = fixedColor || fallbackColor || '#F2EBE0';
  return {
    color: fixedColor || getPreference(pageColorKey(scope), fallback).toUpperCase(),
    // Alte Werte wie "drops", "triangles" oder "bones" werden beim Lesen
    // automatisch durch die erste SVG-Tapete aus MUSCLEDEX-TAPETEN ersetzt.
    pattern: fixedPattern || normalizePagePattern(getPreference(pagePatternKey(scope), fallbackPattern)),
  };
}

function writePageLook(target, look) {
  target.style.setProperty('--dex-seitenfarbe', look.color);
  target.style.setProperty('--dex-ink', readableInkFor(look.color));
  target.style.setProperty('--bg', look.color);
  target.style.setProperty('--app-bg', look.color);
  target.style.setProperty('--app-content-bg', look.color);
  target.style.setProperty('--app-chrome-bg', look.color);
  target.style.setProperty('--food-page-purple', look.color);
  target.dataset.dexMuster = look.pattern;
  const wallpaper = pagePatterns.find(([id]) => id === look.pattern)?.[2];
  if (wallpaper) target.style.setProperty('--dex-tapete', `url("${String(wallpaper).replaceAll('"', '\\"')}")`);
  else target.style.removeProperty('--dex-tapete');
  return Boolean(wallpaper);
}

function writeRootPageLook(look) {
  writePageLook(document.documentElement, look);
}

export function applyPageLook(scope, fallbackColor, fallbackPattern = 'drops') {
  const look = pageLook(scope, fallbackColor, fallbackPattern);
  if (deferPageLook) {
    deferredPageLook = look;
    return look;
  }
  writeRootPageLook(look);
  return look;
}

// Bereitet eine noch unsichtbare Zielansicht vor, ohne den Look der aktuell
// sichtbaren Seite umzuschalten. Das ist insbesondere bei dynamisch geladenen
// Dex wichtig: Die Tapete kann bereits rasterisiert werden, während Daten und
// Code-Chunk laden, und erscheint danach gemeinsam mit dem Inhalt.
export function deferNextPageLook(value = true) {
  deferPageLook = value;
  if (value) deferredPageLook = null;
}

export function pendingPageLook() {
  return deferredPageLook;
}

export function commitPendingPageLook() {
  const look = deferredPageLook;
  deferPageLook = false;
  deferredPageLook = null;
  if (!look) return;
  writeRootPageLook(look);
}

function pageLookPicker(scope, fallbackColor, fallbackPattern, onChange) {
  let selected = pageLook(scope, fallbackColor, fallbackPattern);
  const backdrop = sheet(`
    <header><h2>Seitenlook</h2><button data-sheet-close aria-label="Schließen">${materialIcon('close')}</button></header>
    <div class="dex-appearance-form seitenlook-form">
      <h3>Seitenfarbe</h3>
      <div class="sammlung-editor-farben">${dexEditorColors.map((color) => `<button type="button" data-page-color="${color}" class="${color === selected.color.toUpperCase() ? 'aktiv ' : ''}${colorIsDark(color) ? 'farbe-dunkel' : ''}" style="--farbe:${color}" aria-label="Farbe ${color}"></button>`).join('')}</div>
      <h3>Muster</h3>
      <div class="seitenmuster-auswahl">${pagePatterns.map(([id, label, url]) => `<button type="button" data-page-pattern="${id}" class="${id === selected.pattern ? 'aktiv' : ''}"><i data-muster="${id}"${wallpaperStyle(url)}></i><span>${label}</span></button>`).join('')}</div>
      <button class="btn btn-primary btn-block sammlung-editor-speichern" type="button" data-page-look-save>Seitenlook speichern</button>
    </div>`);
  const panel = backdrop.querySelector('.kategorie-sheet');
  panel.classList.add('sammlung-editor');
  bindWallpaperLongPress(panel);
  panel.onclick = (event) => {
    const color = event.target.closest('[data-page-color]');
    if (color) {
      selected = { ...selected, color: color.dataset.pageColor };
      panel.querySelectorAll('[data-page-color]').forEach((button) => button.classList.toggle('aktiv', button === color));
    }
    const pattern = event.target.closest('[data-page-pattern]');
    if (pattern) {
      selected = { ...selected, pattern: pattern.dataset.pagePattern };
      panel.querySelectorAll('[data-page-pattern]').forEach((button) => button.classList.toggle('aktiv', button === pattern));
    }
    if (!event.target.closest('[data-page-look-save]')) return;
    setPreference(pageColorKey(scope), selected.color);
    setPreference(pagePatternKey(scope), selected.pattern);
    applyPageLook(scope, fallbackColor, fallbackPattern);
    closeSheet(backdrop);
    onChange?.();
    toast('Seitenlook geändert.');
  };
}

function materialIcon(id, className = '') {
  const icon = iconById(id);
  const originalColorClass = icon?.originalColors ? ' icon-originalfarben' : '';
  return icon ? `<span class="material-svg ${className}${originalColorClass}">${icon.svg}</span>` : '';
}

export const materialIconMarkup = materialIcon;

export function categoryIconMarkup(route, className = 'kategorie-svg') {
  // Ohne gespeicherte Auswahl greift der Standard – der ebenfalls ein Emoji
  // sein darf (z. B. SLEEP-LOG 😴, EINKAUF 🛒).
  const value = getPreference(storageKey(route)) || defaults[route];
  if (typeof value === 'string' && value.startsWith('emoji:')) {
    const emoji = value.slice(6).replace(/[<>&"']/g, '');
    return `<span class="${className} kategorie-emoji" data-category-icon="${route}" title="Emoji">${emoji}</span>`;
  }
  const icon = iconById(value);
  if (!icon) return '';
  return `<span class="${className}${icon.originalColors ? ' icon-originalfarben' : ''}" data-category-icon="${route}" title="${icon.title}">${icon.svg}</span>`;
}

function sheet(markup) {
  document.querySelector('.kategorie-sheet-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop';
  backdrop.innerHTML = `<section class="kategorie-sheet" role="dialog" aria-modal="true">${markup}</section>`;
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) closeSheet(backdrop);
  });
  // Entspricht dem funktionierenden LOGMAN-Uebungswaehler: Die Lage bleibt
  // direkt am Viewport. Eine globale Body-Sperre wuerde ihren Bezugspunkt auf
  // iOS unter die transparente Statusleiste verschieben.
  backdrop.addEventListener('touchmove', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('.kategorie-sheet')) {
      event.preventDefault();
    }
  }, { passive: false });
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('offen'));
  return backdrop;
}

function closeSheet(backdrop) {
  if (!backdrop?.isConnected) return;
  backdrop.remove();
}

function notifyAppearanceChanged(route) {
  window.dispatchEvent(new CustomEvent('muscledex:appearance-changed', {
    detail: { route },
  }));
}

function iconPicker(route, onChange) {
  const current = getPreference(storageKey(route), defaults[route]);
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Kategorie-Icon ändern</h2><button data-sheet-close aria-label="Schließen">${materialIcon('close')}</button></header>
    <h3 class="icon-picker-titel">Icons</h3>
    <div class="icon-auswahl">
      ${icons.map((icon) => `<button class="icon-option${icon.id === current ? ' aktiv' : ''}${icon.originalColors ? ' icon-originalfarben' : ''}" data-icon-id="${icon.id}" aria-label="${icon.title}">${icon.svg}<span>${icon.title}</span></button>`).join('')}
    </div>
    <form class="emoji-eigen" data-emoji-form>
      <label for="eigenes-emoji">Eigenes Emoji</label>
      <div><input id="eigenes-emoji" inputmode="text" maxlength="12" placeholder="z. B. 🦾" aria-label="Eigenes Emoji"><button type="submit">Übernehmen</button></div>
    </form>`);
  backdrop.querySelector('.kategorie-sheet').onclick = (event) => {
    const button = event.target.closest('[data-icon-id]');
    if (!button) return;
    const value = button.dataset.iconId;
    setPreference(storageKey(route), value);
    notifyAppearanceChanged(route);
    closeSheet(backdrop);
    onChange?.();
    toast('Kategorie-Icon geändert.');
  };
  backdrop.querySelector('[data-emoji-form]').onsubmit = (event) => {
    event.preventDefault();
    const emoji = event.currentTarget.querySelector('input').value.trim();
    if (!emoji) return;
    setPreference(storageKey(route), `emoji:${emoji}`);
    notifyAppearanceChanged(route);
    closeSheet(backdrop);
    onChange?.();
    toast('Eigenes Emoji übernommen.');
  };
}

function appearancePicker(route, onChange, { hideIcon = false } = {}) {
  let selectedIcon = getPreference(storageKey(route), defaults[route]);
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Dex bearbeiten</h2><button data-sheet-close aria-label="Schließen">${materialIcon('close')}</button></header>
    <div class="dex-appearance-form">
      ${hideIcon ? '<p class="sheet-hinweis">Für diesen Dex gibt es keine Icon-Einstellung.</p>' : `<h3>Icon</h3>
      <div class="sammlung-editor-icons">${icons.map((icon) => `<button type="button" data-icon-id="${icon.id}" class="${icon.id === selectedIcon ? 'aktiv ' : ''}${icon.originalColors ? 'icon-originalfarben' : ''}" aria-label="Icon ${icon.title}">${icon.svg}</button>`).join('')}</div>`}
      ${hideIcon ? '' : `<label class="sammlung-emoji-eigen" for="eigenes-emoji-appearance"><span>Eigenes Emoji</span>
        <input id="eigenes-emoji-appearance" inputmode="text" maxlength="12" placeholder="z. B. 🦾" value="${selectedIcon.startsWith('emoji:') ? escapeHtml(selectedIcon.slice(6)) : ''}">
      </label>`}
      <button class="btn btn-primary btn-block sammlung-editor-speichern appearance-save" type="button">Änderungen speichern</button>
    </div>`);
  backdrop.querySelector('.kategorie-sheet').classList.add('sammlung-editor');
  bindWallpaperLongPress(backdrop.querySelector('.kategorie-sheet'));
  const emojiInput = backdrop.querySelector('#eigenes-emoji-appearance');
  backdrop.querySelector('.kategorie-sheet').onclick = (event) => {
    const iconButton = event.target.closest('[data-icon-id]');
    if (iconButton) {
      selectedIcon = iconButton.dataset.iconId;
      if (emojiInput) emojiInput.value = '';
      backdrop.querySelectorAll('[data-icon-id]').forEach((button) => button.classList.toggle('aktiv', button === iconButton));
    }
    if (!event.target.closest('.appearance-save')) return;
    const emoji = emojiInput?.value.trim() || '';
    if (!hideIcon) setPreference(storageKey(route), emoji ? `emoji:${emoji}` : selectedIcon);
    notifyAppearanceChanged(route);
    closeSheet(backdrop);
    onChange?.();
    toast('Icon geändert.');
  };
  if (emojiInput) emojiInput.oninput = () => {
    if (!emojiInput.value.trim()) return;
    backdrop.querySelectorAll('[data-icon-id]').forEach((button) => button.classList.remove('aktiv'));
  };
}

function colorPicker(route, onChange) {
  const current = categoryColor(route).toUpperCase();
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Farbe wählen</h2><button data-sheet-close aria-label="Schließen">${materialIcon('close')}</button></header>
    ${colorGroups.map(([group, colors]) => `
      <h3 class="icon-picker-titel farbgruppe-titel">${group}</h3>
      <div class="farb-auswahl">
        ${colors.map(([name, color]) => `<button class="farb-option${color === current ? ' aktiv' : ''}" data-color="${color}" style="--farbe:${color}" aria-label="${name}"><i></i><span>${name}</span></button>`).join('')}
      </div>`).join('')}`);
  backdrop.querySelector('.kategorie-sheet').onclick = (event) => {
    const button = event.target.closest('[data-color]');
    if (!button) return;
    setPreference(colorKey(route), button.dataset.color);
    notifyAppearanceChanged(route);
    closeSheet(backdrop);
    onChange?.();
    toast('Retrofarbe geändert.');
  };
}

export function settingsSheet(route, onChange, actions = {}) {
  const showAppearance = !actions.disableAppearance && !actions.hideAppearanceIcon;
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Dex bearbeiten</h2><button data-sheet-close aria-label="Schließen">${materialIcon('close')}</button></header>
    <div class="sheet-menue">
      ${showAppearance ? `<button data-action="appearance">${materialIcon('edit', 'sheet-list-icon')}<span>${escapeHtml(actions.appearanceLabel || 'Icon ändern')}</span></button>` : ''}
      ${actions.onSelect ? `<button data-action="select">${materialIcon('select_check_box', 'sheet-list-icon')}<span>Auswahl</span></button>` : ''}
      ${actions.onRename ? `<button data-action="rename">${materialIcon('edit', 'sheet-list-icon')}<span>Umbenennen</span></button>` : ''}
      ${actions.onCreateSub ? `<button data-action="sub">${materialIcon('create_new_folder', 'sheet-list-icon')}<span>Unter-Dex erstellen</span></button>` : ''}
      ${actions.onShare ? `<button data-action="share">${materialIcon('upload_file', 'sheet-list-icon')}<span>Mit Partner teilen</span></button>` : ''}
      ${actions.onDelete ? `<button class="sheet-gefahr" data-action="delete">${materialIcon('delete_forever', 'sheet-list-icon')}<span>Dex löschen</span></button>` : ''}
    </div>`);
  backdrop.querySelector('.sheet-menue').onclick = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    closeSheet(backdrop);
    if (action === 'appearance') actions.onEditAppearance ? actions.onEditAppearance() : appearancePicker(route, onChange, { hideIcon: Boolean(actions.hideAppearanceIcon) });
    if (action === 'select') actions.onSelect?.();
    if (action === 'rename') actions.onRename?.();
    if (action === 'sub') actions.onCreateSub?.();
    if (action === 'share') actions.onShare?.();
    if (action === 'delete') actions.onDelete?.();
  };
}

function plusAction(container, route) {
  const target = route === 'reminders'
    ? container.querySelector('[data-add-reminder]')
    : route === 'food-log'
      ? container.querySelector('[data-food-panel] > summary')
      : route === 'body'
        ? container.querySelector('.mess-neu > summary')
        : null;
  if (target) {
    target.click();
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else toast('Hinzufügen wird mit den Inhalten dieses Dex aktiviert.');
}

function eintragTypWaehlen(container, route, options = {}) {
  const food = route === 'food-log' || Boolean(options.onAddRecipeLink || options.onAddOwnRecipe);
  const standardEntries = [
    options.onAddLink ? `<button data-entry-type="link">${materialIcon('bookmark_star', 'sheet-list-icon')}<span>Link</span></button>` : '',
    options.onAddNote ? `<button data-entry-type="note">${materialIcon('note_add', 'sheet-list-icon')}<span>Notiz</span></button>` : '',
    options.onAddImage ? `<button data-entry-type="image">${materialIcon('add_photo_alternate', 'sheet-list-icon')}<span>Bild</span></button>` : '',
    options.onAddAudio ? `<button data-entry-type="audio">${materialIcon('mic', 'sheet-list-icon')}<span>Tonaufnahme</span></button>` : '',
    options.onAddRoutine ? `<button data-entry-type="routine">${materialIcon('bucket_check', 'sheet-list-icon')}<span>Neue Routine</span></button>` : '',
  ].join('');
  const backdrop = sheet(`
    <header><h2>Neuer Eintrag</h2><button data-sheet-close aria-label="Schließen">${materialIcon('close')}</button></header>
    <div class="sheet-menue eintrag-typ-menue">
      ${food ? `<button data-entry-type="recipe-link">${materialIcon('bookmark_star', 'sheet-list-icon')}<span>Rezept aus Link</span></button>
        <button data-entry-type="own-recipe">${materialIcon('note_add', 'sheet-list-icon')}<span>Eigenes Rezept</span></button>
        ${options.onAddNote ? `<button data-entry-type="note">${materialIcon('note_add', 'sheet-list-icon')}<span>Notiz</span></button>` : ''}`
        : standardEntries}
    </div>`);
  backdrop.querySelector('.eintrag-typ-menue').onclick = (event) => {
    const type = event.target.closest('[data-entry-type]')?.dataset.entryType;
    if (!type) return;
    closeSheet(backdrop);
    if (type === 'recipe-link') return options.onAddRecipeLink?.();
    if (type === 'own-recipe') return options.onAddOwnRecipe?.();
    if (type === 'audio') return options.onAddAudio?.();
    if (type === 'routine') return options.onAddRoutine?.();
    if (type === 'note') {
      if (options.onAddNote) return options.onAddNote();
      return toast('Notizen sind für diesen Dex vorbereitet.');
    }
    if (type === 'link') {
      if (options.onAddLink) return options.onAddLink();
      return toast('Links sind für diesen Dex vorbereitet.');
    }
    if (type === 'image') {
      if (options.onAddImage) return options.onAddImage();
      if (route === 'food-log') return plusAction(container, route);
      return toast('Bilder sind für diesen Dex vorbereitet.');
    }
  };
}

export function mountCategoryChrome(container, route, title, options = {}) {
  const wrap = container.querySelector(':scope > .wrap');
  if (!wrap) return;
  container.classList.add('hat-kategoriefarbe', 'dex-fixkopf');
  const lookScope = options.pageLookScope || options.inheritedPageLookScope || route;
  const fallbackColor = options.pageLookColor || options.color || categoryColor(route);
  const look = applyPageLook(lookScope, fallbackColor, options.pageLookPattern || 'drops');
  const ink = readableInkFor(look.color);
  container.style.setProperty('--dex-seitenfarbe', look.color);
  container.style.setProperty('--dex-ink', ink);
  container.style.setProperty('--ordner', look.color);
  container.style.setProperty('--ordner-ink', ink);
  container.style.setProperty('--food-page-purple', look.color);
  container.dataset.dexMuster = look.pattern;
  container.classList.toggle('dex-dunkler-hintergrund', colorIsDark(look.color));
  const wallpaper = pagePatterns.find(([id]) => id === look.pattern)?.[2];
  container.classList.toggle('dex-tapete-datei', Boolean(wallpaper));
  if (wallpaper) container.style.setProperty('--dex-tapete', `url("${String(wallpaper).replaceAll('"', '\\"')}")`);
  wrap.querySelector(':scope > .seitenkopf')?.remove();
  let content = wrap.querySelector(':scope > .kategorie-scrollinhalt');
  if (!content) {
    content = document.createElement('div');
    content.className = 'kategorie-scrollinhalt';
    while (wrap.firstChild) content.appendChild(wrap.firstChild);
    wrap.appendChild(content);
  }
  const bar = document.createElement('nav');
  bar.className = 'kategorie-kopf';
  bar.setAttribute('aria-label', `${title} bedienen`);
  const safeTitle = escapeHtml(title);
  const safeMeta = escapeHtml(options.meta || '');
  const closeHref = escapeHtml(options.backHref || '#home');
  bar.innerHTML = `
    <div class="kategorie-kopftitel"><strong>${safeTitle}</strong>${safeMeta ? `<small>${safeMeta}</small>` : ''}</div>
    <button class="kategorie-kopfknopf kategorie-plus" type="button" aria-label="Eintrag in ${safeTitle} ablegen">${materialIcon('place_item')}</button>
    <button class="kategorie-kopfknopf" type="button" data-category-settings aria-label="Einstellungen für ${safeTitle}">${materialIcon('build')}</button>
    <a class="kategorie-kopfknopf kategorie-schliessen" href="${closeHref}" aria-label="${safeTitle} schließen">${materialIcon('close')}</a>`;
  bar.querySelector('.kategorie-plus')?.classList.toggle('kontrast-weiss', colorIsDark(look.color));
  wrap.insertBefore(bar, content);
  // options.onPlus umgeht das Link/Notiz/Bild-Menue vollstaendig: Dex-Typen,
  // die keine Bookmarks sammeln (z. B. die Einkaufsliste), oeffnen darueber
  // ihr eigenes Formular direkt.
  bar.querySelector('.kategorie-plus').onclick = () => (
    options.onPlus ? options.onPlus() : eintragTypWaehlen(container, route, options)
  );
  bar.querySelector('[data-category-settings]').onclick = () => settingsSheet(
    route,
    () => window.dispatchEvent(new HashChangeEvent('hashchange')),
    options,
  );
}
