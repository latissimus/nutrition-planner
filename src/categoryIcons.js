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
const colorKey = (route) => `muscledex:kategorie-farbe:${route}`;
const defaultColors = {
  body: '#72E2FF', reminders: '#F54588', 'food-log': '#7651A8',
  recipes: '#15CCFF', habits: '#CEFC17',
};
const retroColors = [
  ['Bubblegum', '#F54588'], ['Koralle', '#FF6B6B'], ['Burnt Orange', '#E76F51'],
  ['Senf', '#D9A21B'], ['Buttergelb', '#F4D35E'], ['Avocado', '#8FAF54'],
  ['Mint', '#63C7B2'], ['Petrol', '#2A9D8F'], ['Aqua', '#15CCFF'],
  ['Puderblau', '#72E2FF'], ['Periwinkle', '#729EFE'], ['Lavendel', '#B79CED'],
  ['Violett', '#7651A8'], ['Pflaume', '#63345E'], ['Navy', '#264653'],
  ['Schokobraun', '#8B5E3C'], ['Creme', '#F2EBE0'], ['Tomatenrot', '#D94A3A'],
];

export function categoryColor(route) {
  return localStorage.getItem(colorKey(route)) || defaultColors[route] || '#72E2FF';
}

function materialIcon(id, className = '') {
  const icon = iconById(id);
  return icon ? `<span class="material-svg ${className}">${icon.svg}</span>` : '';
}

export const materialIconMarkup = materialIcon;

export function categoryIconMarkup(route, className = 'kategorie-svg') {
  const saved = localStorage.getItem(storageKey(route));
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
    <div class="icon-auswahl">
      ${icons.map((icon) => `<button class="icon-option${icon.id === current ? ' aktiv' : ''}" data-icon-id="${icon.id}" aria-label="${icon.title}">${icon.svg}<span>${icon.title}</span></button>`).join('')}
    </div>`);
  backdrop.querySelector('.icon-auswahl').onclick = (event) => {
    const button = event.target.closest('[data-icon-id]');
    if (!button) return;
    localStorage.setItem(storageKey(route), button.dataset.iconId);
    backdrop.remove();
    onChange?.();
    toast('Kategorie-Icon geändert.');
  };
}

function colorPicker(route, onChange) {
  const current = categoryColor(route).toUpperCase();
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Retrofarbe wählen</h2><button data-sheet-close aria-label="Schließen">×</button></header>
    <div class="farb-auswahl">
      ${retroColors.map(([name, color]) => `<button class="farb-option${color === current ? ' aktiv' : ''}" data-color="${color}" style="--farbe:${color}" aria-label="${name}"><i></i><span>${name}</span></button>`).join('')}
    </div>`);
  backdrop.querySelector('.farb-auswahl').onclick = (event) => {
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
      <button data-action="color">${materialIcon('brightness_empty', 'sheet-list-icon')}<span>Retrofarbe ändern</span></button>
      <button data-action="select">${materialIcon('bucket_check', 'sheet-list-icon')}<span>Auswahl</span></button>
      <button data-action="sub">${materialIcon('add', 'sheet-list-icon')}<span>Unter-Sammlung erstellen</span></button>
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
    <button class="kategorie-kopfknopf" type="button" data-category-settings aria-label="Einstellungen für ${title}">${materialIcon('settings')}</button>`;
  wrap.prepend(bar);
  bar.querySelector('.kategorie-plus').onclick = () => plusAction(container, route);
  bar.querySelector('[data-category-settings]').onclick = () => settingsSheet(route, () => window.dispatchEvent(new HashChangeEvent('hashchange')));
}
