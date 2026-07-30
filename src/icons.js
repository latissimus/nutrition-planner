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
};

export const ICON_OPTIONS = Object.keys(ICONS);

export function iconMarkup(name, className = 'app-icon') {
  const path = ICONS[name] || ICONS.habits;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
    stroke-linejoin="round">${path}</svg>`;
}

const FILLED_ICONS = {
  body: '<path d="M8.2 3.2h7.6a2 2 0 0 1 2 2V8a1 1 0 0 1-2 0V5.6h-2.7a4 4 0 0 1 2.8 3.8V19a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V9.4a4 4 0 0 1 2.8-3.8H8.2V8a1 1 0 0 1-2 0V5.2a2 2 0 0 1 2-2Zm3.8 3.4a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z"/>',
  reminders: '<path d="M12 2.5a2 2 0 0 1 2 1.7 6 6 0 0 1 4 5.7v3.5l2 2.7a1.1 1.1 0 0 1-.9 1.8H4.9a1.1 1.1 0 0 1-.9-1.8l2-2.7V9.9a6 6 0 0 1 4-5.7 2 2 0 0 1 2-1.7Zm-2.6 17h5.2a2.7 2.7 0 0 1-5.2 0Z"/>',
  food: '<path d="M4 3a1 1 0 0 1 1 1v4h1V4a1 1 0 0 1 2 0v4h1V4a1 1 0 0 1 2 0v4a4 4 0 0 1-3 3.9V21a1 1 0 0 1-2 0v-9.1A4 4 0 0 1 3 8V4a1 1 0 0 1 1-1Zm12.5 0c2.5 1.5 4 4.4 4 8.5v1.3a1 1 0 0 1-1 1H18V21a1 1 0 0 1-2 0V4a1 1 0 0 1 .5-1Z"/>',
  recipes: '<path d="M5 3h5.8A3.2 3.2 0 0 1 14 6.2V20H7a3 3 0 0 1-3-3V4a1 1 0 0 1 1-1Zm10.5 3.2A3.2 3.2 0 0 1 18.7 3H20a1 1 0 0 1 1 1v13a3 3 0 0 1-3 3h-2.5V6.2Z"/>',
  habits: '<path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm11.8 5.2a1.2 1.2 0 0 0-1.7 0l-4.6 4.7-1.7-1.7a1.2 1.2 0 0 0-1.7 1.7l2.5 2.5a1.2 1.2 0 0 0 1.7 0l5.5-5.5a1.2 1.2 0 0 0 0-1.7Z"/>',
  meal: '<path d="M4 3a1 1 0 0 1 1 1v4h1V4a1 1 0 0 1 2 0v4h1V4a1 1 0 0 1 2 0v4a4 4 0 0 1-3 3.9V21a1 1 0 0 1-2 0v-9.1A4 4 0 0 1 3 8V4a1 1 0 0 1 1-1Zm12.5 0c2.5 1.5 4 4.4 4 8.5v1.3a1 1 0 0 1-1 1H18V21a1 1 0 0 1-2 0V4a1 1 0 0 1 .5-1Z"/>',
  supplement: '<path d="M8.4 3.1a5 5 0 0 1 3.6 1.5l7.4 7.4a5.1 5.1 0 0 1-7.2 7.2l-7.4-7.4a5.1 5.1 0 0 1 3.6-8.7Zm-.2 9.8 4.7-4.7-2.3-2.3a3.1 3.1 0 0 0-4.4 4.4l2 2.6Z"/>',
  drink: '<path d="M6.2 3h11.6a1.2 1.2 0 0 1 1.2 1.3l-1.1 15.5A1.3 1.3 0 0 1 16.6 21H7.4a1.3 1.3 0 0 1-1.3-1.2L5 4.3A1.2 1.2 0 0 1 6.2 3Zm1.1 6 .7 9.5h8L16.7 9H7.3Z"/>',
  sleep: '<path d="M19.7 14.3A8 8 0 0 1 9.7 4.2a1 1 0 0 0-1.2-1.3A9.5 9.5 0 1 0 21 15.5a1 1 0 0 0-1.3-1.2ZM17 3l.6 1.4L19 5l-1.4.6L17 7l-.6-1.4L15 5l1.4-.6L17 3Z"/>',
};

export function filledIconMarkup(name, className = 'app-icon') {
  const path = FILLED_ICONS[name] || FILLED_ICONS.habits;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    fill="currentColor">${path}</svg>`;
}
