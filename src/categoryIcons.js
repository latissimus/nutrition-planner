import { toast } from './toast.js';
import { getPreference, setPreference } from './userPreferences.js';

const modules = import.meta.glob('../MUSCLEDEX-ICONS/*.svg', {
  query: '?raw', import: 'default', eager: true,
});
// Reine Hintergrundmuster und zwei alte, bereits farbig gestaltete Fremdicons
// gehoeren nicht in den Wähler. Die schwarzen UI-Varianten (z. B. more_horiz)
// bleiben weiterhin verfügbar.
const hiddenPickerFiles = new Set(['pet_supplies-pattern.svg', 'home_119047.svg', 'more_icon_244655.svg']);
const icons = Object.entries(modules).filter(([path]) => !hiddenPickerFiles.has(path.split('/').at(-1))).map(([path, svg]) => {
  const file = path.split('/').at(-1);
  const id = file.replace(/_24dp.*$/i, '').replace(/\.svg$/i, '');
  const title = id.replaceAll('_', ' ');
  return { id, title, svg };
}).sort((a, b) => a.title.localeCompare(b.title, 'de'));
export const availableCategoryIcons = icons;
const iconById = (id) => icons.find((icon) => icon.id === id);
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const defaults = {
  body: 'body_fat', reminders: 'notifications', 'food-log': 'fork_spoon',
  recipes: 'menu_book', training: 'fitness_center', habits: 'bucket_check',
  shopping: 'shopping_cart',
};
const storageKey = (route) => `muscledex:kategorie-icon:${route}`;
const colorKey = (route) => `muscledex:kategorie-farbe:${route}`;
const pageColorKey = (scope) => `muscledex:seitenfarbe:${scope}`;
const pagePatternKey = (scope) => `muscledex:seitenmuster:${scope}`;
let deferredPageLook = null;
let deferPageLook = false;
const defaultColors = {
  body: '#A9DCE8', reminders: '#E99ABF', 'food-log': '#9B83BD',
  recipes: '#83CFE0', training: '#F2A65A', habits: '#B7C98B',
  shopping: '#A7B879',
};
const colorGroups = [
  ['Knallig-Retro', [
    ['Eisblau', '#B1F1FF'], ['Feastables Blau', '#15CCFF'],
    ['Retro Muscle Blau', '#5A78FF'], ['Königsblau', '#1532CB'],
    ['Navy', '#001454'], ['Nachtblau', '#1A1A2E'],
    ['Retro Pink', '#FF69AE'], ['Candy Pink', '#FF5DB5'],
    ['Magenta', '#FF3BB1'], ['Neonpink', '#FF2F9F'],
    ['Himbeere', '#EC1791'], ['Dunkelrosa', '#C8036F'],
    ['Rot', '#FF4347'], ['Rotorange', '#FF3E01'], ['Orange', '#FF7B42'],
    ['Mandarine', '#FF9125'], ['Signalorange', '#FF5F00'],
    ['Goldgelb', '#FFD369'], ['Gelb', '#FFED00'],
    ['Sonnengelb', '#FBCD0A'], ['Acid', '#F3FF00'],
    ['Retro Muscle Grün', '#108474'], ['Violett', '#723EC3'],
    ['Schokobraun', '#492426'],
  ]],
  ['Pastell-Retro', [
    ['Bubblegum', '#E99ABF'], ['Koralle', '#F3A09A'],
    ['Pfirsich', '#F5B69C'], ['Aprikose', '#F2A65A'],
    ['Buttergelb', '#F1D889'], ['Avocado', '#A7B879'],
    ['Pistazie', '#B7C98B'], ['Salbei', '#A8BFA0'],
    ['Eukalyptus', '#83AA9A'], ['Mint', '#9FD5C0'],
    ['Aqua', '#83CFE0'], ['Puderblau', '#A9DCE8'],
    ['Denim', '#7896BE'], ['Lavendel', '#C0A9D8'],
    ['Pastell-Violett', '#9B83BD'], ['Kakaobraun', '#A9826C'],
    ['Sand', '#D7C3A6'], ['Feastables Creme', '#F2EBE0'],
    ['Retro Muscle Off-White', '#F4F3EF'],
  ]],
];
const retroColors = colorGroups.flatMap(([, colors]) => colors);
export const dexEditorColors = [...new Set(retroColors.map(([, color]) => color))];

export function colorIsDark(color) {
  const hex = String(color || '').trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 145;
}

export function categoryColor(route) {
  const saved = getPreference(colorKey(route));
  const valid = saved && retroColors.some(([, color]) => color === saved.toUpperCase());
  return valid ? saved.toUpperCase() : (defaultColors[route] || '#A9DCE8');
}

export const pagePatterns = [
  ['drops', 'Tropfen'],
  ['triangles', 'Dreiecke'],
  ['bones', 'Knochen'],
  ['none', 'Ohne Muster'],
];

export function setPageLookPattern(scope, pattern) {
  const valid = pagePatterns.some(([id]) => id === pattern) ? pattern : 'drops';
  setPreference(pagePatternKey(scope), valid);
  return valid;
}

export function pageLook(scope, fallbackColor, fallbackPattern = 'drops') {
  return {
    color: getPreference(pageColorKey(scope), fallbackColor || '#F2EBE0'),
    pattern: getPreference(pagePatternKey(scope), fallbackPattern),
  };
}

export function applyPageLook(scope, fallbackColor, fallbackPattern = 'drops') {
  const look = pageLook(scope, fallbackColor, fallbackPattern);
  if (deferPageLook) {
    deferredPageLook = look;
    return look;
  }
  const root = document.documentElement;
  // Die Dex-Farbe bleibt fuer Register, Iconflaeche und Eintragsstreifen
  // zustaendig. Die Tapete darf den globalen Seitenhintergrund nicht
  // umfaerben; sie steuert hier deshalb ausschliesslich das Muster.
  root.style.removeProperty('--dex-seitenfarbe');
  delete root.dataset.dexMuster;
  return look;
}

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
  const root = document.documentElement;
  root.style.removeProperty('--dex-seitenfarbe');
  delete root.dataset.dexMuster;
}

function pageLookPicker(scope, fallbackColor, fallbackPattern, onChange) {
  let selected = pageLook(scope, fallbackColor, fallbackPattern);
  const backdrop = sheet(`
    <header><h2>Seitenlook</h2><button data-sheet-close aria-label="Schließen">${materialIcon('close')}</button></header>
    <div class="dex-appearance-form seitenlook-form">
      <h3>Seitenfarbe</h3>
      <div class="sammlung-editor-farben">${dexEditorColors.map((color) => `<button type="button" data-page-color="${color}" class="${color === selected.color.toUpperCase() ? 'aktiv ' : ''}${colorIsDark(color) ? 'farbe-dunkel' : ''}" style="--farbe:${color}" aria-label="Farbe ${color}"></button>`).join('')}</div>
      <h3>Muster</h3>
      <div class="seitenmuster-auswahl">${pagePatterns.map(([id, label]) => `<button type="button" data-page-pattern="${id}" class="${id === selected.pattern ? 'aktiv' : ''}"><i data-muster="${id}"></i><span>${label}</span></button>`).join('')}</div>
      <button class="btn btn-primary btn-block sammlung-editor-speichern" type="button" data-page-look-save>Seitenlook speichern</button>
    </div>`);
  const panel = backdrop.querySelector('.kategorie-sheet');
  panel.classList.add('sammlung-editor');
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
  return icon ? `<span class="material-svg ${className}">${icon.svg}</span>` : '';
}

export const materialIconMarkup = materialIcon;

export function categoryIconMarkup(route, className = 'kategorie-svg') {
  const saved = getPreference(storageKey(route));
  if (saved?.startsWith('emoji:')) {
    const emoji = saved.slice(6).replace(/[<>&"']/g, '');
    return `<span class="${className} kategorie-emoji" data-category-icon="${route}" title="Emoji">${emoji}</span>`;
  }
  const icon = iconById(saved) || iconById(defaults[route]);
  if (!icon) return '';
  return `<span class="${className}" data-category-icon="${route}" title="${icon.title}">${icon.svg}</span>`;
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

function iconPicker(route, onChange) {
  const current = getPreference(storageKey(route), defaults[route]);
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Kategorie-Icon ändern</h2><button data-sheet-close aria-label="Schließen">${materialIcon('close')}</button></header>
    <h3 class="icon-picker-titel">Icons</h3>
    <div class="icon-auswahl">
      ${icons.map((icon) => `<button class="icon-option${icon.id === current ? ' aktiv' : ''}" data-icon-id="${icon.id}" aria-label="${icon.title}">${icon.svg}<span>${icon.title}</span></button>`).join('')}
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
    closeSheet(backdrop);
    onChange?.();
    toast('Kategorie-Icon geändert.');
  };
  backdrop.querySelector('[data-emoji-form]').onsubmit = (event) => {
    event.preventDefault();
    const emoji = event.currentTarget.querySelector('input').value.trim();
    if (!emoji) return;
    setPreference(storageKey(route), `emoji:${emoji}`);
    closeSheet(backdrop);
    onChange?.();
    toast('Eigenes Emoji übernommen.');
  };
}

function appearancePicker(route, onChange) {
  let selectedIcon = getPreference(storageKey(route), defaults[route]);
  let selectedColor = categoryColor(route).toUpperCase();
  let selectedPattern = pageLook(route, selectedColor, 'drops').pattern;
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Dex bearbeiten</h2><button data-sheet-close aria-label="Schließen">${materialIcon('close')}</button></header>
    <div class="dex-appearance-form">
      <h3>Farbe</h3>
      <div class="sammlung-editor-farben">${dexEditorColors.map((color) => `<button type="button" data-color="${color}" class="${color === selectedColor ? 'aktiv ' : ''}${colorIsDark(color) ? 'farbe-dunkel' : ''}" style="--farbe:${color}" aria-label="Farbe ${color}"></button>`).join('')}</div>
      <h3>Icon</h3>
      <div class="sammlung-editor-icons">${icons.map((icon) => `<button type="button" data-icon-id="${icon.id}" class="${icon.id === selectedIcon ? 'aktiv' : ''}" aria-label="Icon ${icon.title}">${icon.svg}</button>`).join('')}</div>
      <h3>Tapete</h3>
      <div class="sammlung-editor-tapeten">${pagePatterns.map(([id, label]) => `<button type="button" data-pattern="${id}" class="${id === selectedPattern ? 'aktiv' : ''}" aria-label="Tapete ${label}"><i data-muster="${id}"></i></button>`).join('')}</div>
      <label class="sammlung-emoji-eigen" for="eigenes-emoji-appearance"><span>Eigenes Emoji</span>
        <input id="eigenes-emoji-appearance" inputmode="text" maxlength="12" placeholder="z. B. 🦾" value="${selectedIcon.startsWith('emoji:') ? escapeHtml(selectedIcon.slice(6)) : ''}">
      </label>
      <button class="btn btn-primary btn-block sammlung-editor-speichern appearance-save" type="button">Änderungen speichern</button>
    </div>`);
  backdrop.querySelector('.kategorie-sheet').classList.add('sammlung-editor');
  const emojiInput = backdrop.querySelector('#eigenes-emoji-appearance');
  backdrop.querySelector('.kategorie-sheet').onclick = (event) => {
    const iconButton = event.target.closest('[data-icon-id]');
    if (iconButton) {
      selectedIcon = iconButton.dataset.iconId;
      emojiInput.value = '';
      backdrop.querySelectorAll('[data-icon-id]').forEach((button) => button.classList.toggle('aktiv', button === iconButton));
    }
    const colorButton = event.target.closest('[data-color]');
    if (colorButton) {
      selectedColor = colorButton.dataset.color;
      backdrop.querySelectorAll('[data-color]').forEach((button) => button.classList.toggle('aktiv', button === colorButton));
    }
    const patternButton = event.target.closest('[data-pattern]');
    if (patternButton) {
      selectedPattern = patternButton.dataset.pattern;
      backdrop.querySelectorAll('[data-pattern]').forEach((button) => button.classList.toggle('aktiv', button === patternButton));
    }
    if (!event.target.closest('.appearance-save')) return;
    const emoji = emojiInput.value.trim();
    setPreference(storageKey(route), emoji ? `emoji:${emoji}` : selectedIcon);
    setPreference(colorKey(route), selectedColor);
    setPageLookPattern(route, selectedPattern);
    applyPageLook(route, selectedColor, selectedPattern);
    closeSheet(backdrop);
    onChange?.();
    toast('Icon und Farbe geändert.');
  };
  emojiInput.oninput = () => {
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
    closeSheet(backdrop);
    onChange?.();
    toast('Retrofarbe geändert.');
  };
}

export function settingsSheet(route, onChange, actions = {}) {
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Dex bearbeiten</h2><button data-sheet-close aria-label="Schließen">${materialIcon('close')}</button></header>
    <div class="sheet-menue">
      <button data-action="appearance">${materialIcon('edit', 'sheet-list-icon')}<span>Icon &amp; Farbe ändern</span></button>
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
    if (action === 'appearance') actions.onEditAppearance ? actions.onEditAppearance() : appearancePicker(route, onChange);
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
    options.onAddNote ? `<button data-entry-type="note">${materialIcon('note_add', 'sheet-list-icon')}<span>Notiz</span></button>` : '',
    options.onAddLink ? `<button data-entry-type="link">${materialIcon('bookmark_star', 'sheet-list-icon')}<span>Link</span></button>` : '',
    options.onAddImage ? `<button data-entry-type="image">${materialIcon('add_photo_alternate', 'sheet-list-icon')}<span>Bild</span></button>` : '',
    options.onAddAudio ? `<button data-entry-type="audio">${materialIcon('mic', 'sheet-list-icon')}<span>Tonaufnahme</span></button>` : '',
    options.onAddRoutine ? `<button data-entry-type="routine">${materialIcon('bucket_check', 'sheet-list-icon')}<span>Neue Routine</span></button>` : '',
  ].join('');
  const backdrop = sheet(`
    <header><h2>Neuer Eintrag</h2><button data-sheet-close aria-label="Schließen">${materialIcon('close')}</button></header>
    <div class="sheet-menue eintrag-typ-menue">
      ${food ? `<button data-entry-type="recipe-link">${materialIcon('bookmark_star', 'sheet-list-icon')}<span>Rezept aus Link</span></button>
        <button data-entry-type="own-recipe">${materialIcon('note_add', 'sheet-list-icon')}<span>Eigenes Rezept</span></button>`
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
  container.style.setProperty('--ordner', options.color || categoryColor(route));
  const lookScope = options.pageLookScope || options.inheritedPageLookScope || route;
  const look = pageLook(lookScope, options.pageLookColor || options.color || categoryColor(route), options.pageLookPattern || 'drops');
  container.dataset.dexMuster = look.pattern;
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
  bar.querySelector('.kategorie-plus')?.classList.toggle('kontrast-weiss', colorIsDark(options.color || categoryColor(route)));
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
