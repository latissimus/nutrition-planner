import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const out = join(process.cwd(), 'MUSCLEDEX-ICONS', 'Neuer Ordner');

const designs = {
  'Essen_recipe.svg': ['Rezept', '<path d="M10 8h34c6 0 10 4 10 10v38H18c-5 0-8-3-8-8Z"/>', '<path d="M19 8v48M27 22h18M27 31h18M27 40h14M27 49h10"/>'],
  'Essen_shaker.svg': ['Shaker mit Strohhalm', '<path d="M17 19h31l-3 38H20Z"/><path d="M22 19v-8h20v8M35 11 43 3" fill="none"/>', '<path d="M18 28h29M26 38l13 11M39 38 26 49"/>'],
  'UI_clock.svg': ['Uhrzeit', '<circle cx="32" cy="32" r="25"/>', '<path d="M32 15v17l12 7"/><circle cx="32" cy="32" r="3"/>'],
  'Gesundheit_scale.svg': ['Waage in Kilogramm', '<rect x="7" y="9" width="50" height="46" rx="10"/>', '<path d="M20 20h24M22 35v13M22 41l8-6M22 41l8 7M42 37c-8-5-12 10-3 11 3 0 5-2 5-5h-5"/>'],
  'Gesundheit_bed.svg': ['Bett', '<path d="M8 16v40M8 34h48v22M8 50h48M17 34V25h12c6 0 10 3 10 9" fill="none"/>', ''],
  'Kategorie_habits.svg': ['Gewohnheiten', '<circle cx="32" cy="32" r="24"/>', '<path d="m19 32 9 9 18-20M13 17l7 1-2-7"/>'],
  'UI_calendar.svg': ['Kalender 12', '<rect x="7" y="11" width="50" height="46" rx="7"/>', '<path d="M17 5v13M47 5v13M8 23h48M20 34v14M17 37l3-3M30 38c2-7 14-6 14 1 0 4-5 6-12 11h13"/>'],
  'UI_image.svg': ['Bild', '<rect x="7" y="10" width="50" height="44" rx="6"/>', '<circle cx="21" cy="24" r="5"/><path d="m12 48 14-14 8 8 6-6 12 12"/>'],
  'UI_more.svg': ['Weitere Optionen', '<circle cx="14" cy="32" r="7"/><circle cx="32" cy="32" r="7"/><circle cx="50" cy="32" r="7"/>', ''],
  'Essen_kaese.svg': ['Käse', '<path d="M7 27 37 8l20 17v31H7Z"/>', '<path d="M8 28h48"/><circle cx="22" cy="39" r="5"/><circle cx="43" cy="47" r="6"/><circle cx="43" cy="22" r="3"/>'],
  'Essen_steak.svg': ['Steak', '<path d="M7 39C4 26 12 15 26 9c11-5 27-3 31 8 5 13-3 28-15 36-12 8-29 6-34-5-2-4-2-6-1-9Z"/>', '<circle cx="40" cy="23" r="6"/><path d="m16 37 10-7M24 47l9-6M45 38l6-5"/>'],
  'Gesundheit_bizeps.svg': ['Bizeps', '<path d="M9 16c0-6 5-10 11-10h10c5 0 9 4 9 9v10l-7 8 5 5c5-8 16-11 23-4 6 8 0 18-9 23-12 6-29 3-37-7-6-8-5-18 1-25l5-5-5-5Z"/>', '<path d="M30 47c7-8 16-9 24-5"/>'],
  'Gesundheit_meditation.svg': ['Meditation', '<circle cx="32" cy="12" r="8"/><path d="M23 27c4-8 14-8 18 0l4 10 12 10-7 8-14-11h-8L14 55l-7-8 12-10Z"/>', '<path d="M20 38c7 5 17 5 24 0M25 29l-6 9M39 29l6 9"/>'],
  'UI_schraubenschluessel.svg': ['Schraubenschlüssel', '<path d="M42 7c-11-3-21 7-16 18L9 42c-6 6-4 14 2 17 5 3 10 2 14-2l17-17c11 4 20-6 16-17l-10 10-9-3-3-9 10-10Z"/>', '<circle cx="17" cy="49" r="5"/>'],
  'UI_settings.svg': ['Einstellungen', '<path d="M28 7h8l2 7 7-3 6 6-3 7 7 3v9l-7 2 3 7-6 6-7-3-2 8h-8l-2-8-7 3-6-6 3-7-8-2v-9l8-3-3-7 6-6 7 3Z"/>', '<circle cx="32" cy="32" r="9"/>'],
  'UI_edit.svg': ['Bearbeiten', '<path d="m10 45-2 11 11-2 34-34-9-9Z"/>', '<path d="m38 17 9 9M10 45l9 9"/>'],
  'UI_camera.svg': ['Kamera', '<path d="M8 20h11l4-7h18l4 7h11v36H8Z"/>', '<circle cx="32" cy="37" r="10"/>'],
  'Gesundheit_gehirn.svg': ['Gehirn', '<path d="M29 10c-7-5-15 0-14 8-7 1-9 10-4 15-5 7 0 15 8 15 4 7 13 6 16 0 8 4 16-2 15-10 7-4 5-14-2-16 1-8-9-13-15-8Z"/>', '<path d="M32 15v34M19 27c7 0 12 5 13 11M45 28c-7 0-12 4-13 10"/>'],
  'UI_hashtag.svg': ['Hashtag', '<path d="m22 9-5 46M42 9l-5 46M9 23h46M7 42h46" fill="none"/>', ''],
  'Essen_teebeutel.svg': ['Teebeutel', '<path d="m12 30 9-10h20l9 10v28H12Z"/><rect x="46" y="5" width="12" height="14" rx="2"/>', '<path d="M31 20V8h15M24 39c5-6 13-3 13 3 0 7-8 10-13 5Z"/>'],
  'Gesundheit_timer.svg': ['Timer mit Skala', '<circle cx="32" cy="35" r="23"/><path d="M24 7h16M32 7v5M49 14l5 5" fill="none"/>', '<path d="M32 17v5M45 22l-4 4M50 35h-5M45 48l-4-4M32 53v-5M19 48l4-4M14 35h5M19 22l4 4M32 35V23"/><circle cx="32" cy="35" r="3"/>'],
  'Essen_supplement.svg': ['Geteilte Kapsel', '<path d="M11 52c-7-7-7-18 0-25L27 11c7-7 18-7 25 0s7 18 0 25L36 52c-7 7-18 7-25 0Z"/>', '<path d="m19 19 26 26"/>'],
};

function blacken(markup) {
  return markup.replaceAll('#FFFFFF', '#000').replaceAll('#fff', '#000');
}

function svg(title, shell, details) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${title}">\n  <title>${title}</title>\n  <g data-part="shadow" transform="translate(2.3 2.6)" fill="#000" stroke="#000" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">${blacken(shell)}</g>\n  <g data-part="outline" fill="#000" stroke="#000" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">${blacken(shell)}</g>\n  <g data-part="face" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${shell}</g>\n${details ? `  <g data-part="details" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${details}</g>\n` : ''}</svg>\n`;
}

await Promise.all(Object.entries(designs).map(([file, [title, shell, details]]) => writeFile(join(out, file), svg(title, shell, details))));
console.log(`${Object.keys(designs).length} Detail-Icons neu gezeichnet.`);
