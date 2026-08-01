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
const iconById = (id) => icons.find((icon) => icon.id === id);
const defaults = {
  body: 'body_fat', reminders: 'notifications', 'food-log': 'fork_spoon',
  recipes: 'menu_book', habits: 'bucket_check',
};
const storageKey = (route) => `muscledex:kategorie-icon:${route}`;
const emojis = [
  '💪','📐','🔔','🥩','🍗','🧀','🥤','💧','☕','🫖','🧠','🧘',
  '⭐','😴','🌙','🛏️','💊','⏰','📅','📷','🖼️','📖','📝','✅',
  '🔥','⚡','❤️','🏋️','🥚','🍳','🥗','🍎','🍌','🥑','🫐','🍚',
  '🍝','🍔','🥪','🛒','🧴','🧃','🎯','🛠️','🔧','⚙️','🔍','🏷️','🔗','📁',
];
const colorKey = (route) => `muscledex:kategorie-farbe:${route}`;
const defaultColors = {
  body: '#A9DCE8', reminders: '#E99ABF', 'food-log': '#9B83BD',
  recipes: '#83CFE0', habits: '#B7C98B',
};
const colorGroups = [
  ['Knallig-Retro', [
    ['Himmelblau', '#B1E7FF'], ['Cyan', '#72E2FF'],
    ['Eisblau', '#B1F1FF'], ['Hellblau', '#58DCFF'], ['Blau', '#15CCFF'],
    ['Pink', '#F54588'], ['Hot Pink', '#FF69AE'], ['Rose', '#F64974'],
    ['Orange', '#FF7B42'], ['Chartreuse', '#CEFC17'], ['Acid', '#F3FF00'],
    ['Navy', '#001454'], ['Nachtblau', '#1A1A2E'], ['Braun', '#492425'],
    ['Off-White', '#F4F3EF'], ['Creme', '#F2EBE0'],
  ]],
  ['Pastell-Retro', [
    ['Bubblegum', '#E99ABF'], ['Koralle', '#F3A09A'], ['Tomatenrot', '#D9796F'],
    ['Burnt Orange', '#D99067'], ['Senf', '#D6B45F'], ['Buttergelb', '#F1D889'],
    ['Avocado', '#A7B879'], ['Pistazie', '#B7C98B'], ['Salbei', '#A8BFA0'],
    ['Moos', '#91A77A'], ['Mint', '#9FD5C0'], ['Seafoam', '#8FCBB9'],
    ['Pastell-Petrol', '#76B7B2'], ['Aqua', '#83CFE0'], ['Puderblau', '#A9DCE8'],
    ['Periwinkle', '#9FAFE0'], ['Lavendel', '#C0A9D8'], ['Violett', '#9B83BD'],
    ['Pflaume', '#9C708E'], ['Navy', '#647C96'], ['Schokobraun', '#A9826C'],
    ['Creme', '#F2EBE0'],
  ]],
];
const retroColors = colorGroups.flatMap(([, colors]) => colors);

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
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) backdrop.remove();
  });
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('offen'));
  return backdrop;
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
    <h3 class="icon-picker-titel">Emojis</h3>
    <div class="emoji-auswahl">
      ${emojis.map((emoji) => `<button class="emoji-option${current === `emoji:${emoji}` ? ' aktiv' : ''}" data-emoji="${emoji}" aria-label="Emoji ${emoji}">${emoji}</button>`).join('')}
    </div>
    <form class="emoji-eigen" data-emoji-form>
      <label for="eigenes-emoji">Eigenes Emoji</label>
      <div><input id="eigenes-emoji" inputmode="text" maxlength="12" placeholder="z. B. 🦾" aria-label="Eigenes Emoji"><button type="submit">Übernehmen</button></div>
    </form>`);
  backdrop.querySelector('.kategorie-sheet').onclick = (event) => {
    const button = event.target.closest('[data-icon-id],[data-emoji]');
    if (!button) return;
    const value = button.dataset.iconId || `emoji:${button.dataset.emoji}`;
    localStorage.setItem(storageKey(route), value);
    backdrop.remove();
    onChange?.();
    toast('Kategorie-Icon geändert.');
  };
  backdrop.querySelector('[data-emoji-form]').onsubmit = (event) => {
    event.preventDefault();
    const emoji = event.currentTarget.querySelector('input').value.trim();
    if (!emoji) return;
    localStorage.setItem(storageKey(route), `emoji:${emoji}`);
    backdrop.remove();
    onChange?.();
    toast('Eigenes Emoji übernommen.');
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
    backdrop.remove();
    onChange?.();
    toast('Retrofarbe geändert.');
  };
}

function settingsSheet(route, onChange) {
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <div class="sheet-menue">
      <button data-action="icon">${materialIcon('edit', 'sheet-list-icon')}<span>Kategorie-Icon ändern</span></button>
      <button data-action="color">${materialIcon('brightness_empty', 'sheet-list-icon')}<span>Farbe ändern</span></button>
      <button data-action="select">${materialIcon('select_check_box', 'sheet-list-icon')}<span>Auswahl</span></button>
      <button data-action="sub">${materialIcon('create_new_folder', 'sheet-list-icon')}<span>Unter-Sammlung erstellen</span></button>
    </div>`);
  backdrop.querySelector('.sheet-menue').onclick = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    backdrop.remove();
    if (action === 'icon') iconPicker(route, onChange);
    if (action === 'color') colorPicker(route, onChange);
    if (action === 'select') toast('Die Auswahl ist für diese Sammlung vorbereitet.');
    if (action === 'sub') toast('Unter-Sammlungen ergänzen wir im nächsten Datenschritt.');
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
  } else toast('Hinzufügen wird mit den Inhalten dieser Sammlung aktiviert.');
}

export function mountCategoryChrome(container, route, title) {
  const wrap = container.querySelector(':scope > .wrap');
  if (!wrap) return;
  container.classList.add('hat-kategoriefarbe');
  container.style.setProperty('--ordner', categoryColor(route));
  wrap.querySelector(':scope > .seitenkopf')?.remove();
  const bar = document.createElement('nav');
  bar.className = 'kategorie-kopf';
  bar.setAttribute('aria-label', `${title} bedienen`);
  bar.innerHTML = `
    <a class="kategorie-kopfknopf" href="#home" aria-label="Zurück zur Übersicht">${materialIcon('arrow_back_ios')}</a>
    <div class="kategorie-kopftitel"><strong>${title}</strong></div>
    <button class="kategorie-kopfknopf kategorie-plus" type="button" aria-label="Zu ${title} hinzufügen">${materialIcon('add')}</button>
    <button class="kategorie-kopfknopf" type="button" data-category-settings aria-label="Einstellungen für ${title}">${materialIcon('build')}</button>`;
  wrap.prepend(bar);
  bar.querySelector('.kategorie-plus').onclick = () => plusAction(container, route);
  bar.querySelector('[data-category-settings]').onclick = () => settingsSheet(route, () => window.dispatchEvent(new HashChangeEvent('hashchange')));
}
