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
  supps: 'SUPPS.svg',
  shopping: 'FOODS.svg',
  habits: 'ROUTINES.svg',
  // Der Dateiname enthält versehentlich die Endung im Namen; wird hier
  // eindeutig zugeordnet, ohne die Datei im Projektordner umzubenennen.
  sleep: 'SLEEPLOGsvg.svg',
  stress: 'STRESSNOTES.svg',
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

export function entryButtonMarkup(className = 'app-dex-menu-icon') {
  /* Derselbe kleine Desktop-Computer wie im LOGMAN. Die CAPBOY-Aktion bleibt
     unverändert: Der Knopf öffnet weiterhin das Kontextmenü der aktiven Seite. */
  return `<span class="${className} menue-computer" aria-hidden="true">
    <svg viewBox="0 0 62 55" preserveAspectRatio="xMidYMid meet">
      <defs>
        <mask id="capboy-menue-fenster-ausschnitt" maskUnits="userSpaceOnUse">
          <rect width="62" height="55" fill="#FFFFFF"/>
          <rect x="7" y="21" width="43" height="23" rx="5" fill="#000000"/>
        </mask>
      </defs>
      <rect class="menue-computer-schatten" x="6" y="5" width="53" height="47" rx="7" fill="#7560E6" mask="url(#capboy-menue-fenster-ausschnitt)"/>
      <g class="menue-computer-front">
        <rect x="2" y="2" width="54" height="47" rx="7" fill="#F2A5DA" stroke="#8968FF" stroke-width="2.3" mask="url(#capboy-menue-fenster-ausschnitt)"/>
        <path d="M9 2h40a7 7 0 0 1 7 7v8H2V9a7 7 0 0 1 7-7Z" fill="#AEEBFA"/>
        <path d="M2 17h54" fill="none" stroke="#8968FF" stroke-width="2.3"/>
        <path d="M31 11h4" fill="none" stroke="#8968FF" stroke-width="1.8" stroke-linecap="round"/>
        <rect x="38" y="7.5" width="5" height="5" fill="none" stroke="#8968FF" stroke-width="1.5"/>
        <path d="m46 7.5 5 5m0-5-5 5" fill="none" stroke="#8968FF" stroke-width="1.5" stroke-linecap="round"/>
        <rect class="menue-computer-innen" x="7" y="21" width="43" height="23" rx="5"/>
        <rect x="7" y="21" width="43" height="23" rx="5" fill="none" stroke="#8968FF" stroke-width="1.8"/>
        <text class="menue-computer-text" x="28.5" y="32.5" fill="#111111" font-family="'Work Sans'" font-size="9.6" font-style="italic" font-weight="700" text-anchor="middle" dominant-baseline="middle">MENÜ</text>
      </g>
    </svg>
  </span>`;
}
