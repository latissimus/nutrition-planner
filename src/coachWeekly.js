// Wochen-Check-in (Schritt 7 des Coach-Plans).
//
// Ist eine Woche (Montag bis Sonntag) abgeschlossen, bietet die Coach-Seite
// den Check-in an: Wie gut wurden die laufenden Maßnahmen umgesetzt, und war
// etwas besonders? Danach bilanziert CAPBOY die Woche gegen die Vorwoche. Den
// Vergleich rechnet die App (weekly.ts in der Edge Function), die KI ordnet
// nur ein. Die Umsetzung schreibt der Nutzer selbst in seine Maßnahmen; die
// Bilanz speichert die Edge Function (Tabelle coach_weekly_reviews).

import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { UMSETZUNG, istNichtEingerichtet } from './coachMemory.js';
import { WEEKLY_NOTE_MAX, lastCompletedWeek } from '../supabase/functions/capboy-coach/weekly.ts';

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

function formularMarkup(massnahmen) {
  const optionen = (gewaehlt) => UMSETZUNG.map(([id, name]) => `<option value="${id}"${id === gewaehlt ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('');
  return `<form class="coach-woche-form" data-woche-form>
    ${massnahmen.length ? `<fieldset><legend>Wie gut hast du das diese Woche umgesetzt?</legend>
      ${massnahmen.map((massnahme) => `<label>${escapeHtml(massnahme.action)}<select data-massnahme="${escapeHtml(massnahme.id)}">${optionen(massnahme.adherence)}</select></label>`).join('')}
    </fieldset>` : ''}
    <fieldset><legend>War etwas besonders?</legend>
      <div class="coach-woche-chips">${UMSTAENDE.map(([id, name]) => `<label class="coach-woche-chip"><input type="checkbox" name="umstand" value="${id}"><span>${escapeHtml(name)}</span></label>`).join('')}</div>
    </fieldset>
    <label>Notiz (optional)<textarea name="notiz" rows="2" maxlength="${WEEKLY_NOTE_MAX}" placeholder="Zum Beispiel: ab Mittwoch erkältet"></textarea></label>
    <button class="btn btn-primary" type="submit">Wochenbilanz erstellen</button>
  </form>`;
}

// Die Karte über der Frage: offen, als Formular oder schon erledigt.
export function wochenKarteMarkup({ woche, bilanz = null, massnahmen = [], offen = false } = {}) {
  const titel = escapeHtml(wochenTitel(woche));
  if (bilanz) {
    return `<div class="coach-woche-karte ist-erledigt"><div><small>WOCHENBILANZ</small><b>${titel}</b><p>Die Bilanz dieser Woche ist erstellt.</p></div><button class="btn" type="button" data-woche-ansehen>Ansehen</button></div>`;
  }
  return `<div class="coach-woche-karte"><div><small>WOCHEN-CHECK-IN</small><b>${titel}</b><p>Die Woche ist abgeschlossen. Zwei kurze Fragen, dann ordnet CAPBOY sie im Vergleich zur Vorwoche ein und wertet fällige Experimente aus.</p></div>${offen ? formularMarkup(massnahmen) : '<button class="btn btn-primary" type="button" data-woche-starten>Check-in starten</button>'}</div>`;
}

// Ohne Tabelle (Migration fehlt) oder bei einem Fehler: kein Hinweis.
export async function istWochenbilanzFaellig(userId, heute = heuteUtc()) {
  const { data, error } = await supabase.from('coach_weekly_reviews').select('id').eq('user_id', userId).eq('week', faelligeWoche(heute).week).limit(1);
  return !error && !data?.length;
}

// Karte auf der Coach-Seite. anfragen(body) ruft die Edge Function auf;
// zeigen() zeigt Laden, Fehler oder die fertige Bilanz im Antwortbereich.
export async function mountWochenbilanz(bereich, { userId, anfragen, zeigen }) {
  const woche = faelligeWoche();
  let bilanz = null;
  let massnahmen = [];
  try {
    const [gespeichert, laufend] = await Promise.all([
      supabase.from('coach_weekly_reviews').select('week,comparison,result,conversation_id').eq('user_id', userId).eq('week', woche.week).maybeSingle(),
      supabase.from('coach_interventions').select('id,action,adherence').eq('user_id', userId).eq('status', 'aktiv').order('start_date', { ascending: false }).limit(5),
    ]);
    if (gespeichert.error) throw gespeichert.error;
    bilanz = gespeichert.data;
    massnahmen = laufend.error ? [] : laufend.data || [];
  } catch (error) {
    if (!istNichtEingerichtet(error)) console.warn('Wochen-Check-in nicht verfügbar:', error?.message);
    bereich.hidden = true;
    return;
  }
  const zeichnen = (offen = false) => {
    bereich.innerHTML = wochenKarteMarkup({ woche, bilanz, massnahmen, offen });
    bereich.hidden = false;
  };
  zeichnen();

  bereich.addEventListener('click', (event) => {
    if (event.target.closest('[data-woche-starten]')) {
      zeichnen(true);
      bereich.querySelector('select, input')?.focus();
      return;
    }
    if (event.target.closest('[data-woche-ansehen]') && bilanz) {
      zeigen({ result: bilanz.result, weekly: { ...woche, week: bilanz.week, comparison: bilanz.comparison, previousWeek: faelligeWoche(woche.from).week }, conversationId: bilanz.conversation_id });
    }
  });

  bereich.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formular = event.target;
    const knopf = formular.querySelector('button[type="submit"]');
    knopf.disabled = true;
    knopf.textContent = 'CAPBOY bilanziert …';
    zeigen({ laden: true });
    try {
      // Die Umsetzung trägt der Nutzer selbst ein, nur geänderte Werte.
      for (const auswahl of formular.querySelectorAll('[data-massnahme]')) {
        const massnahme = massnahmen.find((eintrag) => eintrag.id === auswahl.dataset.massnahme);
        if (!massnahme || massnahme.adherence === auswahl.value) continue;
        const { error } = await supabase.from('coach_interventions').update({ adherence: auswahl.value }).eq('id', massnahme.id).eq('user_id', userId);
        if (error) throw error;
        massnahme.adherence = auswahl.value;
      }
      const bericht = {
        circumstances: [...formular.querySelectorAll('[name="umstand"]:checked')].map((feld) => feld.value),
        note: String(formular.elements.notiz?.value || '').trim().slice(0, WEEKLY_NOTE_MAX),
        // Historical snapshot for this week. The server resolves the action
        // text from the authenticated user's active interventions.
        interventions: [...formular.querySelectorAll('[data-massnahme]')].map((feld) => ({
          id: feld.dataset.massnahme,
          adherence: feld.value,
        })),
      };
      const antwort = await anfragen({ scope: 'coach', mode: 'weekly', weekly: bericht });
      const gespraech = antwort.memorySaved ? antwort.conversationId : null;
      if (antwort.weekly?.saved) {
        bilanz = { week: antwort.weekly.week, comparison: antwort.weekly.comparison, result: antwort.result, conversation_id: gespraech };
        window.dispatchEvent(new CustomEvent('muscledex:wochenbilanz-erledigt', { detail: { week: antwort.weekly.week } }));
      }
      zeichnen();
      zeigen({ result: antwort.result, weekly: antwort.weekly, conversationId: gespraech });
    } catch (error) {
      knopf.disabled = false;
      knopf.textContent = 'Wochenbilanz erstellen';
      zeigen({ fehler: true });
      toast(error?.message || 'Die Wochenbilanz konnte nicht erstellt werden.');
    }
  });
}
