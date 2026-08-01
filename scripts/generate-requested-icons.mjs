import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const out = join(process.cwd(), 'MUSCLEDEX-ICONS', 'Neuer Ordner');

const icons = {
  'Gesundheit_bizeps.svg': ['Bizeps', '<path d="M10 27c3-7 8-10 13-8l3-8 7 3-2 8c7 1 13 6 15 14-6 8-15 12-25 10-8-2-13-8-11-19Z"/><circle cx="28" cy="14" r="5"/>'],
  'Gesundheit_messdreieck.svg': ['Messdreieck', '<path d="M9 45 27 8l19 37Zm14-9h10l-5-11Z" fill-rule="evenodd"/>'],
  'UI_hashtag.svg': ['Hashtag', '<path d="m20 9-4 38h8l4-38Zm17 0-4 38h8l4-38ZM9 21v8h38v-8Zm-2 16v8h38v-8Z"/>'],
  'Essen_proteinshake.svg': ['Proteinshake', '<path d="M18 7h20l3 9-4 34H19l-4-34Zm-2 9h25M21 7V2h14v5M22 27h12l-6 12Z" fill-rule="evenodd"/>'],
  'Essen_steak.svg': ['Steak', '<path d="M9 30C9 17 19 8 33 8c10 0 17 5 17 14 0 15-13 28-27 28C14 50 9 42 9 30Zm15-3c0 5 4 9 9 9s9-4 9-9-4-9-9-9-9 4-9 9Z" fill-rule="evenodd"/>'],
  'Essen_fleischkeule.svg': ['Fleischkeule', '<path d="M16 38c-8-7-7-19 1-27s20-9 27-1c6 7 3 17-4 24-7 8-17 10-24 4Zm25-3 5 5 4-2 5 5-5 5-5-5-4 2-5-5Z"/>'],
  'Essen_kaese.svg': ['Käse', '<path d="M7 23 31 7l18 15v27H7Zm0 0h42M18 32a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm20 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" fill-rule="evenodd"/>'],
  'Essen_wassertropfen.svg': ['Wassertropfen', '<path d="M28 5C21 15 13 25 13 35a15 15 0 0 0 30 0C43 25 35 15 28 5Zm-7 31c1 5 4 8 9 9"/>'],
  'Essen_teebeutel.svg': ['Teebeutel', '<path d="M17 18h25v32H17Zm6 0V8c0-5 4-7 8-7s8 2 8 7v5h9v13M24 34h11v8H24Z" fill-rule="evenodd"/><circle cx="48" cy="30" r="6"/>'],
  'Gesundheit_gehirn.svg': ['Gehirn', '<path d="M20 48c-7 0-11-5-10-11-5-3-5-11 0-14-2-7 4-13 10-12 3-7 13-7 16-1 7-2 13 4 12 11 6 3 6 12 1 15 1 7-5 12-12 11-4 6-14 5-17 1Z"/><path d="M28 12v35M17 20c7 0 11 5 11 11M40 18c-7 1-12 6-12 13M16 36c5-2 10 0 12 5M40 36c-5-2-10 0-12 5" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'],
  'Gesundheit_meditation.svg': ['Meditation', '<circle cx="28" cy="12" r="8"/><path d="M18 28c4-9 16-9 20 0l5 10 9 7-6 7-13-10H23L10 52l-6-7 9-7Z"/>'],
  'UI_stern.svg': ['Stern', '<path d="m28 4 7 15 17 2-12 12 3 17-15-8-15 8 3-17L4 21l17-2Z"/>'],
  'Gesundheit_zzz.svg': ['Schlafen zZz', '<path d="M5 12h20L12 30h17v8H3l13-18H5Zm28-8h18L40 18h13v7H30l11-14h-8Zm3 29h16L42 46h12v7H32l10-13h-6Z"/>'],
  'UI_schraubenschluessel.svg': ['Schraubenschlüssel', '<path d="M38 5c-9-3-18 5-15 14L6 36c-5 5-5 12 0 17s12 5 17 0l17-17c9 3 17-6 14-15l-9 9-8-3-3-8Z"/><circle cx="15" cy="44" r="4" fill="#fff"/>'],
};

function svg(title, body) {
  const shadowBody = body.replaceAll('#fff', '#000');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${title}">\n  <title>${title}</title>\n  <g data-part="shadow" transform="translate(4 5)" fill="#000" stroke="#000" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${shadowBody}</g>\n  <g data-part="face" fill="#fff" stroke="#000" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${body}</g>\n</svg>\n`;
}

await Promise.all(Object.entries(icons).map(([file, [title, body]]) => writeFile(join(out, file), svg(title, body))));
console.log(`${Object.keys(icons).length} neue Icons erzeugt.`);
