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
