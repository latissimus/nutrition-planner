// Woche: Titel, Umstände und der Wochenvergleich der App.
//
// Die Bilanz der Woche kommt seit Schritt 5 des Coaching-Plans automatisch als
// Wochen-Coaching am Montag um 21 Uhr (capboy-coach, wochenCoaching.ts). Den
// eigenen Rückblick gibt die Person freiwillig im Wochen-Kärtchen
// (wochenKaertchen.js). Den Vergleich rechnet die App (weekly.ts), die KI
// ordnet nur ein.

import { lastCompletedWeek } from '../supabase/functions/capboy-coach/weekly.ts';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// Kurzform der Umstände für die Auswahl; die Edge Function kennt dieselben IDs
// (WEEKLY_CIRCUMSTANCES) und gibt der KI die ausführliche Fassung.
export const UMSTAENDE = [
  ['krank', 'Krank'],
  ['unterwegs', 'Unterwegs'],
  ['stress', 'Viel Stress'],
  ['wenig_schlaf', 'Wenig Schlaf'],
  ['ausnahme', 'Feier oder Urlaub'],
];

// Die Wochen rechnet die Zeitreihe in UTC; die Karte tut es genauso.
export const heuteUtc = () => new Date().toISOString().slice(0, 10);
export const faelligeWoche = (heute = heuteUtc()) => lastCompletedWeek(heute);

const tagMonat = (datum) => `${datum.slice(8, 10)}.${datum.slice(5, 7)}.`;
export function wochenTitel({ week, from, to } = {}) {
  if (!/^\d{4}-W\d{2}$/.test(String(week || ''))) return 'Wochenbilanz';
  const zeitraum = from && to ? ` · ${tagMonat(from)}–${tagMonat(to)}${to.slice(0, 4)}` : '';
  return `KW ${Number(week.slice(6))}${zeitraum}`;
}

const zahl = (wert) => Number(wert).toLocaleString('de-DE', { maximumFractionDigits: 1 });
const mitEinheit = (wert, einheit) => (wert == null ? '–' : einheit === '1–5' ? `${zahl(wert)} von 5` : `${zahl(wert)} ${einheit}`);
const veraenderung = (wert, einheit) => {
  if (wert == null) return '–';
  const vorzeichen = wert > 0 ? '+' : wert < 0 ? '−' : '±';
  return `${vorzeichen}${zahl(Math.abs(wert))}${einheit === '1–5' ? '' : ` ${einheit}`}`;
};

// Der Wochenvergleich, wie die App ihn berechnet hat.
export function vergleichMarkup(weekly) {
  const zeilen = weekly?.comparison || [];
  if (!zeilen.length) return '';
  const kw = (woche) => (woche ? `KW ${Number(String(woche).slice(6))}` : 'Vorwoche');
  // Im Rahmen .coach-result, damit Überschrift und Abstände wie in der Antwort aussehen.
  return `<div class="coach-result"><section class="coach-result-section is-data coach-wochenvergleich">
    <h3><span>Die Woche im Vergleich</span><em>Von der App berechnet</em></h3>
    <div class="coach-tabelle"><table>
      <thead><tr><th scope="col">Messgröße</th><th scope="col">${escapeHtml(kw(weekly.previousWeek))}</th><th scope="col">${escapeHtml(kw(weekly.week))}</th><th scope="col">Veränderung</th></tr></thead>
      <tbody>${zeilen.map((zeile) => `<tr><th scope="row">${escapeHtml(zeile.label)}</th><td>${escapeHtml(mitEinheit(zeile.previous, zeile.unit))}</td><td>${escapeHtml(mitEinheit(zeile.current, zeile.unit))}</td><td>${escapeHtml(veraenderung(zeile.change, zeile.unit))}</td></tr>`).join('')}</tbody>
    </table></div>
  </section></div>`;
}
