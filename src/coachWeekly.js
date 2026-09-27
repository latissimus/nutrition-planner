// Wochen-Check-in (Schritt 7 des Coach-Plans).
//
// Ist eine Woche (Montag bis Sonntag) abgeschlossen, bietet die Coach-Seite
// den Check-in an: Wie gut wurden die laufenden Maßnahmen umgesetzt, und war
// etwas besonders? Danach bilanziert der Coach die Woche gegen die Vorwoche. Den
// Vergleich rechnet die App (weekly.ts in der Edge Function), die KI ordnet
// nur ein. Die Umsetzung schreibt der Nutzer selbst in seine Maßnahmen; die
// Bilanz speichert die Edge Function (Tabelle coach_weekly_reviews).

import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { UMSETZUNG, istNichtEingerichtet } from './coachMemory.js';
import { fensterMarkup } from './coachFenster.js';
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
    ${massnahmen.length ? `<fieldset><legend>Wie gut hast du das umgesetzt?</legend>
      ${massnahmen.map((massnahme) => `<label>${escapeHtml(massnahme.action)}<select data-massnahme="${escapeHtml(massnahme.id)}">${optionen(massnahme.adherence)}</select></label>`).join('')}
    </fieldset>` : ''}
    <fieldset><legend>War etwas besonders?</legend>
      <div class="coach-woche-chips">${UMSTAENDE.map(([id, name]) => `<label class="coach-woche-chip"><input type="checkbox" name="umstand" value="${id}"><span>${escapeHtml(name)}</span></label>`).join('')}</div>
    </fieldset>
    <label>Notiz (optional)<textarea name="notiz" rows="2" maxlength="${WEEKLY_NOTE_MAX}" placeholder="Zum Beispiel: ab Mittwoch erkältet"></textarea></label>
    <div class="coach-woche-knoepfe"><button class="coach-merken ist-wichtig" type="submit">Wochenbilanz erstellen</button><button class="coach-merken" type="button" data-woche-spaeter>Später</button></div>
  </form>`;
}

// Solange die Bilanz der Woche fehlt: eine Nachricht des Coachs als letzte
// im Chat. "Später" blendet sie bis zum nächsten Öffnen aus.
export function wochenHinweisMarkup(woche) {
  const kw = /^\d{4}-W\d{2}$/.test(String(woche?.week || '')) ? `KW ${Number(woche.week.slice(6))}` : 'Woche';
  return fensterMarkup({
    klasse: 'coach-woche-hinweis',
    inhalt: `<p>Die ${escapeHtml(kw)} ist vorbei. Wollen wir Bilanz ziehen? Ich vergleiche sie mit der Vorwoche.</p>
      <div class="coach-vorschlaege"><button type="button" data-woche-starten>Wochenbilanz starten</button><button type="button" data-woche-hinweis-weg>Später</button></div>`,
  });
}

// Die Fragen des Check-ins als Nachricht des Coachs im Chat.
export function wochenFrageMarkup({ woche, massnahmen = [] } = {}) {
  const kw = /^\d{4}-W\d{2}$/.test(String(woche?.week || '')) ? `KW ${Number(woche.week.slice(6))}` : 'Woche';
  return `<p>Die ${escapeHtml(kw)} ist vorbei. Zwei kurze Fragen, dann bilanziere ich sie gegen die Vorwoche${massnahmen.length ? ' und schaue auf deine Experimente' : ''}.</p>${formularMarkup(massnahmen)}`;
}

// Was der Nutzer angegeben hat, als seine Nachricht im Chat.
export function checkinText({ woche, massnahmen = [], bericht = {} } = {}) {
  const umsetzung = (bericht.interventions || []).map((eintrag) => {
    const massnahme = massnahmen.find((kandidat) => kandidat.id === eintrag.id);
    const stufe = UMSETZUNG.find(([id]) => id === eintrag.adherence)?.[1] || eintrag.adherence;
    return massnahme ? `${massnahme.action}: ${stufe}` : '';
  }).filter(Boolean);
  const umstaende = (bericht.circumstances || []).map((id) => UMSTAENDE.find(([kandidat]) => kandidat === id)?.[1]).filter(Boolean);
  return [
    `Wochen-Check-in ${wochenTitel(woche)}`,
    ...umsetzung.map((zeile) => `Umgesetzt – ${zeile}`),
    `Besonders: ${umstaende.length ? umstaende.join(', ') : 'nichts'}`,
    bericht.note ? `Notiz: ${bericht.note}` : '',
  ].filter(Boolean).join('\n');
}

// Ohne Tabelle (Migration fehlt) oder bei einem Fehler: kein Hinweis.
export async function istWochenbilanzFaellig(userId, heute = heuteUtc()) {
  const { data, error } = await supabase.from('coach_weekly_reviews').select('id').eq('user_id', userId).eq('week', faelligeWoche(heute).week).limit(1);
  return !error && !data?.length;
}

// Hinweis auf der Coach-Seite. anfragen(body) ruft die Edge Function auf.
// zeigen() gehört zur Chatseite: { frage } hängt die Fragen als Nachricht an
// und gibt das Fenster zurück; { laden, text }, { fehler } und
// { text, result, weekly, conversationId } zeigen den weiteren Verlauf.
export async function mountWochenbilanz(bereich, { userId, anfragen, zeigen }) {
  const woche = faelligeWoche();
  let massnahmen = [];
  try {
    const [gespeichert, laufend] = await Promise.all([
      supabase.from('coach_weekly_reviews').select('id').eq('user_id', userId).eq('week', woche.week).maybeSingle(),
      supabase.from('coach_interventions').select('id,action,adherence').eq('user_id', userId).eq('status', 'aktiv').order('start_date', { ascending: false }).limit(5),
    ]);
    if (gespeichert.error) throw gespeichert.error;
    // Schon bilanziert: kein Hinweis. Die Bilanz steht unter „Was der Coach über mich weiß“.
    if (gespeichert.data) {
      bereich.hidden = true;
      return;
    }
    massnahmen = laufend.error ? [] : laufend.data || [];
  } catch (error) {
    if (!istNichtEingerichtet(error)) console.warn('Wochen-Check-in nicht verfügbar:', error?.message);
    bereich.hidden = true;
    return;
  }
  const hinweisZeigen = (sichtbar) => {
    bereich.innerHTML = sichtbar ? wochenHinweisMarkup(woche) : '';
    bereich.hidden = !sichtbar;
  };
  hinweisZeigen(true);

  async function absenden(event) {
    event.preventDefault();
    const formular = event.target;
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
    const text = checkinText({ woche, massnahmen, bericht });
    zeigen({ laden: true, text });
    try {
      // Die Umsetzung trägt der Nutzer selbst ein, nur geänderte Werte.
      for (const eintrag of bericht.interventions) {
        const massnahme = massnahmen.find((kandidat) => kandidat.id === eintrag.id);
        if (!massnahme || massnahme.adherence === eintrag.adherence) continue;
        const { error } = await supabase.from('coach_interventions').update({ adherence: eintrag.adherence }).eq('id', massnahme.id).eq('user_id', userId);
        if (error) throw error;
        massnahme.adherence = eintrag.adherence;
      }
      const antwort = await anfragen({ scope: 'coach', mode: 'weekly', weekly: bericht });
      if (antwort.weekly?.saved) {
        window.dispatchEvent(new CustomEvent('muscledex:wochenbilanz-erledigt', { detail: { week: antwort.weekly.week } }));
      } else {
        hinweisZeigen(true);
      }
      zeigen({ text, result: antwort.result, weekly: antwort.weekly, conversationId: antwort.memorySaved ? antwort.conversationId : null });
    } catch (error) {
      zeigen({ fehler: true });
      hinweisZeigen(true);
      toast(error?.message || 'Die Wochenbilanz konnte nicht erstellt werden.');
    }
  }

  bereich.addEventListener('click', (event) => {
    if (event.target.closest('[data-woche-hinweis-weg]')) {
      hinweisZeigen(false);
      return;
    }
    if (!event.target.closest('[data-woche-starten]')) return;
    hinweisZeigen(false);
    const fenster = zeigen({ frage: wochenFrageMarkup({ woche, massnahmen }) });
    if (!fenster) return;
    fenster.querySelector('[data-woche-form]')?.addEventListener('submit', absenden);
    fenster.querySelector('[data-woche-spaeter]')?.addEventListener('click', () => {
      fenster.remove();
      hinweisZeigen(true);
    });
  });
}
