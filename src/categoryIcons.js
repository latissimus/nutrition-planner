import { toast } from './toast.js';

const modules = import.meta.glob('../MUSCLEDEX-ICONS/*.svg', {
  query: '?raw', import: 'default', eager: true,
});
const icons = Object.entries(modules).map(([path, svg]) => {
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
  recipes: 'menu_book', habits: 'bucket_check',
};
const storageKey = (route) => `muscledex:kategorie-icon:${route}`;
const colorKey = (route) => `muscledex:kategorie-farbe:${route}`;
const defaultColors = {
  body: '#A9DCE8', reminders: '#E99ABF', 'food-log': '#9B83BD',
  recipes: '#83CFE0', habits: '#B7C98B',
};
const colorGroups = [
  ['Knallig-Retro', [
    ['Himmelblau', '#B1E7FF'], ['Cyan', '#72E2FF'],
    ['Eisblau', '#B1F1FF'], ['Hellblau', '#58DCFF'], ['Blau', '#15CCFF'],
    ['Kobaltblau', '#3567C8'], ['Royalblau', '#4459D4'], ['Ultramarin', '#3F51B5'],
    ['Pink', '#F54588'], ['Hot Pink', '#FF69AE'], ['Rose', '#F64974'],
    ['Himbeere', '#D93672'], ['Magenta', '#D94AA7'], ['Kirschrot', '#D94C5C'],
    ['Orange', '#FF7B42'], ['Mandarine', '#F2943D'], ['Rostrot', '#B95E43'],
    ['Sonnengelb', '#F3C84B'], ['Chartreuse', '#CEFC17'], ['Acid', '#F3FF00'],
    ['Navy', '#001454'], ['Nachtblau', '#1A1A2E'], ['Braun', '#492425'],
    ['Indigo', '#443199'], ['Purpur', '#723EC3'], ['Electric Violet', '#8755D9'],
    ['Petrol', '#077A7D'], ['Türkis', '#03A6A1'], ['Jade', '#64E2B7'], ['Smaragd', '#35A66F'],
    ['Vanille', '#FFF58A'],
    ['Off-White', '#F4F3EF'], ['Creme', '#F2EBE0'],
  ]],
  ['Pastell-Retro', [
    ['Bubblegum', '#E99ABF'], ['Altrosa', '#D7A0B2'], ['Dusty Rose', '#C98FA2'],
    ['Koralle', '#F3A09A'], ['Pfirsich', '#F5B69C'], ['Aprikose', '#E9A777'], ['Tomatenrot', '#D9796F'],
    ['Burnt Orange', '#D99067'], ['Karamell', '#C49367'], ['Senf', '#D6B45F'], ['Ocker', '#C6A15B'], ['Buttergelb', '#F1D889'],
    ['Avocado', '#A7B879'], ['Pistazie', '#B7C98B'], ['Salbei', '#A8BFA0'],
    ['Moos', '#91A77A'], ['Olive', '#9F9D68'], ['Farn', '#7FA27D'], ['Eukalyptus', '#83AA9A'],
    ['Mint', '#9FD5C0'], ['Seafoam', '#8FCBB9'], ['Enteneisblau', '#9CC9C7'],
    ['Pastell-Petrol', '#76B7B2'], ['Aqua', '#83CFE0'], ['Puderblau', '#A9DCE8'], ['Denim', '#7896BE'],
    ['Periwinkle', '#9FAFE0'], ['Schieferblau', '#8293B1'], ['Lavendel', '#C0A9D8'], ['Flieder', '#C6AED9'], ['Violett', '#9B83BD'],
    ['Mauve', '#AD84A7'], ['Pflaume', '#9C708E'], ['Navy', '#647C96'],
    ['Taupe', '#A89282'], ['Schokobraun', '#A9826C'], ['Sand', '#D7C3A6'],
    ['Creme', '#F2EBE0'], ['Warmweiß', '#FAF5EA'],
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
  const saved = localStorage.getItem(colorKey(route));
  const valid = saved && retroColors.some(([, color]) => color === saved.toUpperCase());
  return valid ? saved.toUpperCase() : (defaultColors[route] || '#A9DCE8');
}

function materialIcon(id, className = '') {
  const icon = iconById(id);
  return icon ? `<span class="material-svg ${className}">${icon.svg}</span>` : '';
}

export const materialIconMarkup = materialIcon;

export function categoryIconMarkup(route, className = 'kategorie-svg') {
  const saved = localStorage.getItem(storageKey(route));
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
  const current = localStorage.getItem(storageKey(route)) || defaults[route];
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Kategorie-Icon ändern</h2><button data-sheet-close aria-label="Schließen">×</button></header>
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
    localStorage.setItem(storageKey(route), value);
    closeSheet(backdrop);
    onChange?.();
    toast('Kategorie-Icon geändert.');
  };
  backdrop.querySelector('[data-emoji-form]').onsubmit = (event) => {
    event.preventDefault();
    const emoji = event.currentTarget.querySelector('input').value.trim();
    if (!emoji) return;
    localStorage.setItem(storageKey(route), `emoji:${emoji}`);
    closeSheet(backdrop);
    onChange?.();
    toast('Eigenes Emoji übernommen.');
  };
}

function appearancePicker(route, onChange) {
  let selectedIcon = localStorage.getItem(storageKey(route)) || defaults[route];
  let selectedColor = categoryColor(route).toUpperCase();
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Dex bearbeiten</h2><button data-sheet-close aria-label="Schließen">×</button></header>
    <div class="dex-appearance-form">
      <h3>Farbe</h3>
      <div class="sammlung-editor-farben">${dexEditorColors.map((color) => `<button type="button" data-color="${color}" class="${color === selectedColor ? 'aktiv ' : ''}${colorIsDark(color) ? 'farbe-dunkel' : ''}" style="--farbe:${color}" aria-label="Farbe ${color}"></button>`).join('')}</div>
      <h3>Icon</h3>
      <div class="sammlung-editor-icons">${icons.map((icon) => `<button type="button" data-icon-id="${icon.id}" class="${icon.id === selectedIcon ? 'aktiv' : ''}" aria-label="Icon ${icon.title}">${icon.svg}</button>`).join('')}</div>
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
    if (!event.target.closest('.appearance-save')) return;
    const emoji = emojiInput.value.trim();
    localStorage.setItem(storageKey(route), emoji ? `emoji:${emoji}` : selectedIcon);
    localStorage.setItem(colorKey(route), selectedColor);
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
    <header><h2>Farbe wählen</h2><button data-sheet-close aria-label="Schließen">×</button></header>
    ${colorGroups.map(([group, colors]) => `
      <h3 class="icon-picker-titel farbgruppe-titel">${group}</h3>
      <div class="farb-auswahl">
        ${colors.map(([name, color]) => `<button class="farb-option${color === current ? ' aktiv' : ''}" data-color="${color}" style="--farbe:${color}" aria-label="${name}"><i></i><span>${name}</span></button>`).join('')}
      </div>`).join('')}`);
  backdrop.querySelector('.kategorie-sheet').onclick = (event) => {
    const button = event.target.closest('[data-color]');
    if (!button) return;
    localStorage.setItem(colorKey(route), button.dataset.color);
    closeSheet(backdrop);
    onChange?.();
    toast('Retrofarbe geändert.');
  };
}

function settingsSheet(route, onChange, actions = {}) {
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Dex bearbeiten</h2><button data-sheet-close aria-label="Schließen">×</button></header>
    <div class="sheet-menue">
      <button data-action="appearance">${materialIcon('edit', 'sheet-list-icon')}<span>Icon &amp; Farbe ändern</span></button>
      <button data-action="select">${materialIcon('select_check_box', 'sheet-list-icon')}<span>Auswahl</span></button>
      ${actions.onRename ? `<button data-action="rename">${materialIcon('edit', 'sheet-list-icon')}<span>Umbenennen</span></button>` : ''}
      ${actions.onCreateSub ? `<button data-action="sub">${materialIcon('create_new_folder', 'sheet-list-icon')}<span>Unter-Dex erstellen</span></button>` : ''}
      ${actions.onDelete ? `<button class="sheet-gefahr" data-action="delete">${materialIcon('delete_forever', 'sheet-list-icon')}<span>Dex löschen</span></button>` : ''}
    </div>`);
  backdrop.querySelector('.sheet-menue').onclick = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    closeSheet(backdrop);
    if (action === 'appearance') actions.onEditAppearance ? actions.onEditAppearance() : appearancePicker(route, onChange);
    if (action === 'select') toast('Die Auswahl ist für diesen Dex vorbereitet.');
    if (action === 'rename') actions.onRename?.();
    if (action === 'sub') actions.onCreateSub?.();
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
  const backdrop = sheet(`
    <header><h2>Neuer Eintrag</h2><button data-sheet-close aria-label="Schließen">×</button></header>
    <div class="sheet-menue eintrag-typ-menue">
      <button data-entry-type="note">${materialIcon('note_add', 'sheet-list-icon')}<span>Notiz</span></button>
      <button data-entry-type="link">${materialIcon('bookmark_star', 'sheet-list-icon')}<span>Link</span></button>
      <button data-entry-type="image">${materialIcon('add_photo_alternate', 'sheet-list-icon')}<span>Bild</span></button>
    </div>`);
  backdrop.querySelector('.eintrag-typ-menue').onclick = (event) => {
    const type = event.target.closest('[data-entry-type]')?.dataset.entryType;
    if (!type) return;
    closeSheet(backdrop);
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
      if (options.onPlus) return options.onPlus();
      if (route === 'food-log') return plusAction(container, route);
      return toast('Bilder sind für diesen Dex vorbereitet.');
    }
  };
}

export function mountCategoryChrome(container, route, title, options = {}) {
  const wrap = container.querySelector(':scope > .wrap');
  if (!wrap) return;
  container.classList.add('hat-kategoriefarbe');
  container.style.setProperty('--ordner', options.color || categoryColor(route));
  wrap.querySelector(':scope > .seitenkopf')?.remove();
  const bar = document.createElement('nav');
  bar.className = 'kategorie-kopf';
  bar.setAttribute('aria-label', `${title} bedienen`);
  const safeTitle = escapeHtml(title);
  const safeMeta = escapeHtml(options.meta || '');
  bar.innerHTML = `
    <div class="kategorie-kopftitel"><strong>${safeTitle}</strong>${safeMeta ? `<small>${safeMeta}</small>` : ''}</div>
    <button class="kategorie-kopfknopf kategorie-plus" type="button" aria-label="Eintrag in ${safeTitle} ablegen">${materialIcon('place_item')}</button>
    <button class="kategorie-kopfknopf" type="button" data-category-settings aria-label="Einstellungen für ${safeTitle}">${materialIcon('build')}</button>
    <a class="kategorie-kopfknopf kategorie-schliessen" href="#home" aria-label="${safeTitle} schließen">${materialIcon('close')}</a>`;
  bar.querySelector('.kategorie-plus')?.classList.toggle('kontrast-weiss', colorIsDark(options.color || categoryColor(route)));
  wrap.prepend(bar);
  bar.querySelector('.kategorie-plus').onclick = () => eintragTypWaehlen(container, route, options);
  bar.querySelector('[data-category-settings]').onclick = () => settingsSheet(
    route,
    () => window.dispatchEvent(new HashChangeEvent('hashchange')),
    options,
  );
}
