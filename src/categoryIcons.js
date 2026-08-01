import { toast } from './toast.js';

const module = import.meta.glob([
  '../MUSCLEDEX-ICONS/Neuer Ordner/*.svg',
  '../MUSCLEDEX-ICONS/01_Glocke_Slab.svg',
], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const controls = import.meta.glob([
  '../MUSCLEDEX-ICONS/UI_chevron-left.svg',
  '../MUSCLEDEX-ICONS/UI_plus.svg',
], { query: '?raw', import: 'default', eager: true });

const records = (source) => Object.entries(source).map(([path, svg]) => {
  const file = path.split('/').at(-1);
  const title = svg.match(/<title[^>]*>([^<]+)<\/title>/)?.[1] || file.replace(/\.svg$/i, '');
  return { id: file, title, svg };
});
const icons = records(module).sort((a, b) => a.title.localeCompare(b.title, 'de'));
const iconLookup = [...icons, ...records(controls)];

const defaults = {
  body: 'Gesundheit_messdreieck.svg',
  reminders: '01_Glocke_Slab.svg',
  'food-log': 'Essen_steak.svg',
  recipes: 'Essen_recipe.svg',
  habits: 'Kategorie_habits.svg',
};

const key = (route) => `muscledex:kategorie-icon:${route}`;
const finde = (id) => iconLookup.find((icon) => icon.id === id);

export function categoryIcon(route) {
  const saved = localStorage.getItem(key(route));
  return finde(saved) || finde(defaults[route]) || icons[0];
}

export function categoryIconMarkup(route, className = 'kategorie-svg') {
  const icon = categoryIcon(route);
  return `<span class="${className}" data-category-icon="${route}" title="${icon?.title || ''}">${icon?.svg || ''}</span>`;
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
  const current = categoryIcon(route)?.id;
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>Kategorie-Icon ändern</h2><button data-sheet-close aria-label="Schließen">×</button></header>
    <div class="icon-auswahl">
      ${icons.map((icon) => `<button class="icon-option${icon.id === current ? ' aktiv' : ''}" data-icon-id="${icon.id}" aria-label="${icon.title}">${icon.svg}<span>${icon.title}</span></button>`).join('')}
    </div>`);
  backdrop.querySelector('.icon-auswahl').onclick = (event) => {
    const button = event.target.closest('[data-icon-id]');
    if (!button) return;
    localStorage.setItem(key(route), button.dataset.iconId);
    backdrop.remove();
    onChange?.();
    toast('Kategorie-Icon geändert.');
  };
}

function settingsSheet(route, onChange) {
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <div class="sheet-menue">
      <button data-action="icon">${categoryIconMarkup(route, 'sheet-list-icon')}<span>Kategorie-Icon ändern</span></button>
      <button data-action="select"><span class="sheet-zeichen">✓</span><span>Auswahl</span></button>
      <button data-action="sub"><span class="sheet-zeichen">＋</span><span>Unter-Sammlung erstellen</span></button>
    </div>`);
  backdrop.querySelector('.sheet-menue').onclick = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    backdrop.remove();
    if (action === 'icon') iconPicker(route, onChange);
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
  wrap.querySelector(':scope > .seitenkopf')?.remove();
  const bar = document.createElement('nav');
  bar.className = 'kategorie-kopf';
  bar.setAttribute('aria-label', `${title} bedienen`);
  bar.innerHTML = `
    <a class="kategorie-kopfknopf" href="#home" aria-label="Zurück zur Übersicht">${finde('UI_chevron-left.svg')?.svg || '‹'}</a>
    <div class="kategorie-kopftitel"><strong>${title}</strong></div>
    <button class="kategorie-kopfknopf kategorie-plus" type="button" aria-label="Zu ${title} hinzufügen">${finde('UI_plus.svg')?.svg || '+'}</button>
    <button class="kategorie-kopfknopf" type="button" data-category-settings aria-label="Einstellungen für ${title}">${finde('UI_schraubenschluessel.svg')?.svg || '⋯'}</button>`;
  wrap.prepend(bar);
  bar.querySelector('.kategorie-plus').onclick = () => plusAction(container, route);
  bar.querySelector('[data-category-settings]').onclick = () => settingsSheet(route, () => window.dispatchEvent(new HashChangeEvent('hashchange')));
}
