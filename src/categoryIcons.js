import { toast } from './toast.js';
import notificationSvg from '../MUSCLEDEX-ICONS/notifications_24dp_E3E3E3_FILL1_wght700_GRAD200_opsz24.svg?raw';

export function categoryIconMarkup(route, className = 'kategorie-svg') {
  if (route !== 'reminders') return '';
  return `<span class="${className}" data-category-icon="reminders" title="Erinnerungen">${notificationSvg}</span>`;
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
  toast('Aktuell ist nur das Erinnerungs-Icon vorhanden.');
}

function settingsSheet(route, onChange) {
  const backdrop = sheet(`
    <div class="sheet-griff" aria-hidden="true"></div>
    <div class="sheet-menue">
      <button data-action="icon"><span class="sheet-zeichen">●</span><span>Kategorie-Icon ändern</span></button>
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
    <a class="kategorie-kopfknopf" href="#home" aria-label="Zurück zur Übersicht">‹</a>
    <div class="kategorie-kopftitel"><strong>${title}</strong></div>
    <button class="kategorie-kopfknopf kategorie-plus" type="button" aria-label="Zu ${title} hinzufügen">+</button>
    <button class="kategorie-kopfknopf" type="button" data-category-settings aria-label="Einstellungen für ${title}">⋯</button>`;
  wrap.prepend(bar);
  bar.querySelector('.kategorie-plus').onclick = () => plusAction(container, route);
  bar.querySelector('[data-category-settings]').onclick = () => settingsSheet(route, () => window.dispatchEvent(new HashChangeEvent('hashchange')));
}
