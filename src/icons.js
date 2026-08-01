const ICONS = {
  body: '<path d="M5 19h14M7 19l2-9h6l2 9M9 10a3 3 0 0 1 6 0M12 7V4M9 5l3-1 3 1"/>',
  reminders: '<path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7M10 20h4"/>',
  food: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 9h-4"/>',
  recipes: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm3 0v16M11 8h4M11 12h4"/>',
  habits: '<path d="m5 12 4 4L19 6M4 4h16v16H4z"/>',
  meal: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 9h-4"/>',
  supplement: '<path d="M8 5a4 4 0 0 1 6 0l5 5a4.2 4.2 0 0 1-6 6l-5-5a4.2 4.2 0 0 1 0-6Zm3 9 6-6"/>',
  drink: '<path d="M7 4h10l-1 16H8L7 4Zm1 5h8M10 13h4"/>',
  sleep: '<path d="M18.5 15.5A7.5 7.5 0 0 1 8.5 5a7.5 7.5 0 1 0 10 10.5ZM17 4v4M15 6h4"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  folder: '<path d="M3 7.2c0-1.1.9-2 2-2h5l2 2h7c1.1 0 2 .9 2 2v8.3c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V7.2Z"/>',
  folderPlus: '<path d="M3 7.2c0-1.1.9-2 2-2h5l2 2h7c1.1 0 2 .9 2 2v8.3c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V7.2Z"/><path d="M12 10.5v5M9.5 13h5"/>',
  heart: '<path d="M20.4 5.8a5.1 5.1 0 0 0-7.2 0L12 7l-1.2-1.2a5.1 5.1 0 1 0-7.2 7.2L12 21l8.4-8a5.1 5.1 0 0 0 0-7.2Z"/>',
  star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  bolt: '<path d="m13.4 2-8 11H11l-.4 9 8-11H13l.4-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};

export const ICON_OPTIONS = [
  ['body', 'Körperwerte'],
  ['reminders', 'Erinnerung'],
  ['food', 'Essen'],
  ['recipes', 'Rezept'],
  ['habits', 'Gewohnheit'],
  ['supplement', 'Supplement'],
  ['drink', 'Trinken'],
  ['sleep', 'Schlaf'],
  ['folder', 'Ordner'],
  ['heart', 'Herz'],
  ['star', 'Stern'],
  ['bolt', 'Energie'],
  ['sun', 'Tag'],
];

export function iconMarkup(name, className = 'app-icon') {
  const path = ICONS[name] || ICONS.habits;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
    stroke-linejoin="round">${path}</svg>`;
}
