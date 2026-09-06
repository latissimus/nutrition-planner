/* Dedizierte Menü-Icons für die Standardseiten im unteren Dex-Menüband.
   Sie sind bewusst getrennt vom nutzerdefinierten Kategorie-Icon-Picker: Die
   Menü-Icons bilden die visuelle Identität der Standardseiten und ändern
   sich nicht mit der Karten-Icon-Auswahl. Die SVGs enthalten eingebettete
   Bitmaps und tragen deshalb die Klasse `icon-originalfarben`, damit die
   globalen Einfärbungsregeln der Tabs nicht greifen. */
const modules = import.meta.glob('../SeitenIcons/*.svg', {
  query: '?raw', import: 'default', eager: true,
});

const routeToFile = {
  body: 'BODYLOG.svg',
  reminders: 'MEALS.svg',
  'food-log': 'COOKNOTES.svg',
  training: 'TRAINNOTES.svg',
  shopping: 'FOODS.svg',
  habits: 'ROUTINES.svg',
  // Der Dateiname enthält versehentlich die Endung im Namen; wird hier
  // eindeutig zugeordnet, ohne die Datei im Projektordner umzubenennen.
  sleep: 'SLEEPLOGsvg.svg',
};

/* Wie bei den MUSCLEDEX-ICONS werden interne IDs in eingebetteten Bitmaps
   (Serif exportiert sie als `_Image1`) pro Icon eindeutig gemacht. Zwei
   Menü-Icons auf derselben Seite würden sich sonst gegenseitig überschreiben. */
function prefixInterneIds(rawSvg, prefix) {
  return String(rawSvg)
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .trim()
    .replace(/\sid="([^"]+)"/g, (_m, id) => ` id="${prefix}${id}"`)
    .replace(/\s(xlink:href|href)="#([^"]+)"/g, (_m, attr, id) => ` ${attr}="#${prefix}${id}"`);
}

const svgByRoute = new Map();
for (const [route, file] of Object.entries(routeToFile)) {
  const entry = Object.entries(modules).find(([path]) => path.endsWith(`/${file}`));
  if (!entry) continue;
  const prefix = `mdxm-${route.replace(/[^a-z0-9_-]/gi, '-')}-`;
  svgByRoute.set(route, prefixInterneIds(entry[1], prefix));
}

export function menuIconMarkup(route, className = 'app-dex-tab-icon') {
  const svg = svgByRoute.get(route);
  if (!svg) return '';
  return `<span class="${className} icon-originalfarben" data-menu-icon="${route}">${svg}</span>`;
}

export function hasMenuIcon(route) {
  return svgByRoute.has(route);
}

/* EINTRAG.svg dient als Kontextmenü-Knopf rechts im Menüband. Wird über eine
   eigene Funktion ausgeliefert, weil der Knopf keiner Route zugeordnet ist. */
const entryEntry = Object.entries(modules).find(([path]) => path.endsWith('/EINTRAG.svg'));
const entryIconSvg = entryEntry ? prefixInterneIds(entryEntry[1], 'mdxm-entry-') : '';

export function entryButtonMarkup(className = 'app-dex-menu-icon') {
  if (!entryIconSvg) return '';
  return `<span class="${className} icon-originalfarben" aria-hidden="true">${entryIconSvg}</span>`;
}
