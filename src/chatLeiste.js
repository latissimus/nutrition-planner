// Chat wie bei ChatGPT (Rückmeldung 08.10., Bildschirmfotos des Nutzers):
// Coach-Antworten als schlichter Text, darunter eine Leiste mit Kopieren,
// Teilen, „…“ (kleines Menü mit Vorlesen, Quellen und – wo sinnvoll –
// „Daraus Schritte machen“) und „Quellen“ mit kleinen Seitensymbolen, die
// eine Liste von unten öffnen. Gemeinsam für Antworten (coach.js) und das
// tägliche Coaching (coaching.js).

import { escapeHtml } from './coachFenster.js';
import { coachIconMarkup } from './menuIcons.js';

// Umriss-Symbole im 24er-Raster (bis die eigenen Icons kommen).
export const SYMBOL = {
  kopieren: '<rect x="8.5" y="8.5" width="12" height="12" rx="3"/><path d="M15.5 5.5A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 5.5 15.5"/>',
  teilen: '<path d="M12 3.5v11"/><path d="M8 7.5l4-4 4 4"/><path d="M5.5 12v5.5a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3V12"/>',
  mehr: '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="3"/>',
  vorlesen: '<path d="M4 9.5v5h3.5l4.5 4V5.5l-4.5 4H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6"/><path d="M18.2 6.5a8 8 0 0 1 0 11"/>',
  stopp: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>',
  quellen: '<path d="M12 6.5c-2-1.6-4.6-2-7.5-1.6v12.6c2.9-.4 5.5 0 7.5 1.6 2-1.6 4.6-2 7.5-1.6V4.9c-2.9-.4-5.5 0-7.5 1.6z"/><path d="M12 6.5v12.6"/>',
  schritte: '<path d="M10.5 6.5h9M10.5 12h9M10.5 17.5h9"/><path d="M4 6.5l1.5 1.5L8 5.5M4 12l1.5 1.5L8 11M4 17.5l1.5 1.5L8 16.5"/>',
  seminar: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/><path d="M9.5 12h6M9.5 15.5h6"/>',
  wissen: '<path d="M9.5 17.5h5M10.5 20.5h3"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z"/>',
  kamera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.3"/>',
  fotos: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="15.5" cy="9.5" r="1.6"/><path d="M3.5 16.5l5-5 4.5 4.5 2-2 5.5 5"/>',
  dateien: '<path d="M8.5 12.5l6.2-6.2a3 3 0 0 1 4.2 4.2l-7.8 7.8a5 5 0 0 1-7.1-7.1L11.6 3.6"/>',
  bewertung: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01" stroke-width="3"/>',
  web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5z"/>',
  neu: '<path d="M12 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5v-5"/><path d="M17.6 3.9a2 2 0 0 1 2.8 2.8L13 14.1l-3.6.9.9-3.6z"/>',
  haken: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  runter: '<path d="M12 4.5v15"/><path d="M5.5 13l6.5 6.5 6.5-6.5"/>',
};
export const symbol = (name, klasse = 'coach-aktion-symbol') => `<svg class="${klasse}" viewBox="0 0 24 24" aria-hidden="true">${SYMBOL[name] || ''}</svg>`;

export function sichereUrl(value = '') {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

// Kurzer Seitenname für die Zitat-Pillen im Text, etwa „pubmed“ oder „wikipedia“.
const BEKANNTE_SEITEN = {
  'pubmed.ncbi.nlm.nih.gov': 'pubmed', 'pmc.ncbi.nlm.nih.gov': 'pmc', 'www.ncbi.nlm.nih.gov': 'ncbi',
};
export function seitenName(host = '') {
  const name = String(host).toLowerCase();
  if (BEKANNTE_SEITEN[name]) return BEKANNTE_SEITEN[name];
  const teile = name.replace(/^www\./, '').split('.');
  // co.uk, com.au …: Der Name steht davor.
  const vorne = teile.length > 2 && /^(co|com|org|ac|gov|net|edu)$/.test(teile.at(-2)) ? teile.at(-3) : teile.at(-2);
  return vorne || name;
}
const hostVon = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

/* Antworttext: Absätze, **fett**, einfache Listen. Links des Modells
   („([pubmed.ncbi.nlm.nih.gov](https://…))“) werden kleine graue Pillen mit
   dem Seitennamen wie bei ChatGPT; „[Evidenz]“ ebenso. */
const LINK = /(\()?\[([^\]\n]+)\]\((https?:\/\/[^\s)]+(?:\([^)]*\)[^\s)]*)?)\)(\))?/g;
const formatiert = (text) => escapeHtml(text)
  .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
  .replace(/\[Evidenz\]/g, '<span class="coach-zitat ist-evidenz">Evidenz</span>');
function zitatMarkup(label, url) {
  const host = new URL(url).hostname;
  const wieDomain = !/\s/.test(label) && /\.[a-z]{2,}$/i.test(label);
  const text = wieDomain || label.length > 28 ? seitenName(host) : label;
  return `<a class="coach-zitat" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}
export function inlineMarkup(roh = '') {
  const text = String(roh);
  let html = '';
  let bis = 0;
  for (const treffer of text.matchAll(LINK)) {
    const [ganz, auf, label, url, zu] = treffer;
    html += formatiert(text.slice(bis, treffer.index));
    const sicher = sichereUrl(url);
    if (!sicher) html += formatiert(`${auf || ''}${label}${zu || ''}`);
    else if (auf && zu) html += `${!treffer.index || /\s$/.test(text.slice(0, treffer.index)) ? '' : ' '}${zitatMarkup(label, sicher)}`;
    else html += `${auf || ''}<a class="coach-link" href="${escapeHtml(sicher)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>${zu || ''}`;
    bis = treffer.index + ganz.length;
  }
  return html + formatiert(text.slice(bis));
}
// Für Kopieren, Vorlesen, Teilen und Überschriften: **fett** als schlichter Text.
export const ohneFett = (text = '') => String(text ?? '').replace(/\*\*([^*\n]+)\*\*/g, '$1').replaceAll('**', '');
const LISTENPUNKT = /^\s*(?:[-–•*]|\d+[.)])\s+/;
export function textMarkup(roh = '') {
  return String(roh || '').trim().split(/\n\s*\n/).filter((absatz) => absatz.trim()).map((absatz) => {
    const zeilen = absatz.split('\n').filter((zeile) => zeile.trim());
    if (zeilen.length > 1 && zeilen.every((zeile) => LISTENPUNKT.test(zeile))) {
      const art = /^\s*\d/.test(zeilen[0]) ? 'ol' : 'ul';
      return `<${art}>${zeilen.map((zeile) => `<li>${inlineMarkup(zeile.replace(LISTENPUNKT, ''))}</li>`).join('')}</${art}>`;
    }
    return `<p>${zeilen.map(inlineMarkup).join('<br>')}</p>`;
  }).join('');
}

/* Quellen einer Antwort (statt der früheren „Datenlage“): Quelle ist nur,
   was nachweislich einging. Webseiten nur, wenn die Antwort sie zitiert;
   bloße Suchtreffer stehen getrennt als „Recherchetreffer“. */
const DATEN_BEREICHE = {
  koerper: 'Körper', training: 'Training', ernaehrung: 'Ernährung', schlaf: 'Schlaf', erholung: 'Erholung', routinen: 'Routinen',
};
export function quellenAus(result = {}) {
  const quellen = result?.sources || {};
  const web = (result?.webSources || []).flatMap((source) => {
    const url = sichereUrl(source?.url);
    const host = url && hostVon(url);
    return host ? [{ art: 'web', titel: String(source?.title || host), url, host, zitiert: source?.zitiert === true }] : [];
  }).slice(0, 8);
  const daten = (quellen.userData || []).flatMap((bereich) => (DATEN_BEREICHE[bereich] ? [DATEN_BEREICHE[bereich]] : []));
  const eintraege = [
    ...web.filter((eintrag) => eintrag.zitiert),
    ...(daten.length || quellen.ownData ? [{ art: 'daten', titel: daten.length ? `Deine Daten: ${daten.join(', ')}` : 'Deine Daten' }] : []),
    ...(quellen.seminar || []).map((titel) => ({ art: 'seminar', titel: String(titel) })),
    ...(quellen.generalKnowledge ? [{ art: 'wissen', titel: 'Allgemeines Fachwissen' }] : []),
  ];
  return { eintraege, treffer: web.filter((eintrag) => !eintrag.zitiert) };
}
export const hatQuellen = (quellen) => Boolean(quellen && (quellen.eintraege.length || quellen.treffer.length));

const SEITE = { daten: 'CAPBOY', seminar: 'Seminar', wissen: 'Coach' };
// Kleines rundes Bild: Favicon der Seite, sonst Coach, Dokument oder Glühbirne.
// Lädt ein Favicon nicht, setzt coach.js den Anfangsbuchstaben ein.
function bildMarkup(eintrag) {
  if (eintrag.art === 'web') {
    return `<img class="coach-quelle-bild" src="https://icons.duckduckgo.com/ip3/${encodeURIComponent(eintrag.host)}.ico" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-zeichen="${escapeHtml(eintrag.host.slice(0, 1).toUpperCase())}">`;
  }
  if (eintrag.art === 'daten') return `<span class="coach-quelle-bild ist-daten">${coachIconMarkup('coach-quelle-gesicht')}</span>`;
  return `<span class="coach-quelle-bild ist-${eintrag.art}">${symbol(eintrag.art, 'coach-quelle-symbol')}</span>`;
}

export function quellenChipMarkup(quellen) {
  if (!hatQuellen(quellen)) return '';
  const bilder = [...quellen.eintraege, ...quellen.treffer].slice(0, 3).map(bildMarkup).join('');
  const name = quellen.eintraege.length ? 'Quellen' : 'Recherche';
  return `<button type="button" class="coach-quellen-chip" data-aktion="quellen" aria-haspopup="dialog"><span class="coach-quellen-bilder">${bilder}</span><span>${name}</span></button>`;
}

export function quellenSheetMarkup(quellen) {
  if (!hatQuellen(quellen)) return '';
  const zeile = (eintrag) => {
    const inhalt = `<span class="coach-quelle-seite">${bildMarkup(eintrag)}<span>${escapeHtml(eintrag.art === 'web' ? eintrag.host : SEITE[eintrag.art])}</span></span><b>${escapeHtml(eintrag.titel)}</b>`;
    return eintrag.art === 'web'
      ? `<li><a href="${escapeHtml(eintrag.url)}" target="_blank" rel="noopener noreferrer">${inhalt}</a></li>`
      : `<li><div>${inhalt}</div></li>`;
  };
  return `${quellen.eintraege.length ? `<h3 class="coach-sheet-titel">Quellen</h3><ul class="coach-quellen-liste">${quellen.eintraege.map(zeile).join('')}</ul>` : ''}
    ${quellen.treffer.length ? `<h3 class="coach-sheet-titel">Recherchetreffer</h3><p class="coach-sheet-hinweis">Bei der Websuche gefunden. Nicht jeder Treffer floss in die Antwort ein.</p><ul class="coach-quellen-liste">${quellen.treffer.map(zeile).join('')}</ul>` : ''}`;
}

// Leiste unter einer Antwort. „…“ öffnet das kleine Menü (menueMarkup).
export function aktionenMarkup({ quellen = null, schritte = false } = {}) {
  return `<div class="coach-aktionen" role="toolbar" aria-label="Aktionen zur Antwort">
    <button type="button" data-aktion="kopieren" aria-label="Kopieren">${symbol('kopieren')}</button>
    <button type="button" data-aktion="teilen" aria-label="Teilen">${symbol('teilen')}</button>
    <button type="button" data-aktion="mehr" aria-label="Mehr" aria-haspopup="menu" aria-expanded="false"${schritte ? ' data-schritte-moeglich' : ''}>${symbol('mehr')}</button>
    ${quellenChipMarkup(quellen)}
  </div>`;
}

// Oben Zeit und Art der Antwort, darunter Vorlesen, Quellen und – nur wo die
// Antwort zu etwas führt, das man tun kann – „Daraus Schritte machen“.
export function menueMarkup({ kopf = '', vorlesen = false, quellen = false, schritte = false } = {}) {
  const punkt = (name, text, bild = name) => `<button type="button" role="menuitem" data-menue="${name}">${symbol(bild)}<span>${escapeHtml(text)}</span></button>`;
  return `${kopf ? `<p class="coach-menue-kopf">${escapeHtml(kopf)}</p>` : ''}
    ${punkt('vorlesen', vorlesen ? 'Vorlesen beenden' : 'Vorlesen', vorlesen ? 'stopp' : 'vorlesen')}
    ${quellen ? punkt('quellen', 'Quellen') : ''}
    ${schritte ? `<hr>${punkt('schritte', 'Daraus Schritte machen')}` : ''}`;
}

export function zeitText(iso) {
  const datum = new Date(iso || '');
  if (!iso || Number.isNaN(datum.getTime())) return '';
  return datum.toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
