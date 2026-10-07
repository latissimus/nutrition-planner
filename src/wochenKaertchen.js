// Wochen-Kärtchen (COACHING-PLAN.md, Schritt 5): der eigene Rückblick auf die
// Woche. Er steht von Sonntag bis Montag 21 Uhr im Chat und ersetzt den Knopf
// „Wochenbilanz starten“. Speichern kostet nichts: Es gibt keinen KI-Aufruf,
// das Wochen-Coaching am Montag um 21 Uhr liest den Rückblick mit. Er sagt,
// was die App nicht wissen kann – krank, unterwegs, wie gut die Maßnahmen
// liefen –, damit eine schwache Woche nicht falsch gedeutet wird.

import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { UMSETZUNG, istNichtEingerichtet } from './coachMemory.js';
import { UMSTAENDE, wochenTitel } from './coachWeekly.js';
import { escapeHtml, fensterMarkup } from './coachFenster.js';
import { WEEKLY_NOTE_MAX, isoWeek } from '../supabase/functions/capboy-coach/weekly.ts';

const SPAETER_KEY = 'capboy:wochen-kaertchen-spaeter';

// Berliner Zeit wie beim Wochen-Lauf (capboy-coach, berlinTeile), nicht die
// Zeitzone des Geräts: Auf Reisen zeigt das Kärtchen dieselbe Woche und Frist.
const BERLIN = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
});
function berlin(jetzt) {
  const teile = Object.fromEntries(BERLIN.formatToParts(jetzt).map((teil) => [teil.type, teil.value]));
  return { datum: `${teile.year}-${teile.month}-${teile.day}`, stunde: Number(teile.hour), wochentag: teile.weekday };
}

/** Die Woche, auf die das Kärtchen zurückblickt, oder null außerhalb von Sonntag bis Montag 21 Uhr (Berlin). */
export function kaertchenWoche(jetzt = new Date()) {
  const { datum, stunde, wochentag } = berlin(jetzt);
  if (wochentag === 'Sun') return isoWeek(datum);
  if (wochentag === 'Mon' && stunde < 21) return isoWeek(new Date(Date.parse(`${datum}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10));
  return null;
}

function formularMarkup(woche, massnahmen, gespeichert) {
  const umstaende = new Set(gespeichert?.umstaende || []);
  const umsetzung = new Map((gespeichert?.umsetzung || []).map((eintrag) => [eintrag.id, eintrag.adherence]));
  const optionen = (gewaehlt) => UMSETZUNG.map(([id, name]) => `<option value="${id}"${id === gewaehlt ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('');
  return `<p>Wochenrückblick ${escapeHtml(wochenTitel(woche))} – freiwillig. Was die App nicht weiß, fließt am Montag um 21 Uhr ins Wochen-Coaching ein.</p>
    <form class="coach-woche-form" data-kaertchen-form>
      ${massnahmen.length ? `<fieldset><legend>Wie gut hast du das umgesetzt?</legend>
        ${massnahmen.map((massnahme) => `<label>${escapeHtml(massnahme.action)}<select data-massnahme="${escapeHtml(massnahme.id)}">${optionen(umsetzung.get(massnahme.id) || massnahme.adherence)}</select></label>`).join('')}
      </fieldset>` : ''}
      <fieldset><legend>War etwas besonders?</legend>
        <div class="coach-woche-chips">${UMSTAENDE.map(([id, name]) => `<label class="coach-woche-chip"><input type="checkbox" name="umstand" value="${id}"${umstaende.has(id) ? ' checked' : ''}><span>${escapeHtml(name)}</span></label>`).join('')}</div>
      </fieldset>
      <label>Notiz (optional)<textarea name="notiz" rows="2" maxlength="${WEEKLY_NOTE_MAX}" placeholder="Zum Beispiel: ab Mittwoch erkältet">${escapeHtml(gespeichert?.notiz || '')}</textarea></label>
      <div class="coach-woche-knoepfe"><button class="coach-merken ist-wichtig" type="submit">Rückblick speichern</button><button class="coach-merken" type="button" data-kaertchen-spaeter>Später</button></div>
    </form>`;
}

const gespeichertMarkup = (woche) => `<p>Dein Wochenrückblick ${escapeHtml(wochenTitel(woche))} ist gespeichert. Er fließt am Montag um 21 Uhr ins Wochen-Coaching ein.</p>
  <div class="coach-vorschlaege"><button type="button" data-kaertchen-aendern>Ändern</button></div>`;

/** Kärtchen im Chat. bereich: der Platz unter dem Gespräch (data-coach-woche). */
export async function mountWochenKaertchen(bereich, { userId, jetzt = new Date() }) {
  if (!bereich) return;
  const woche = kaertchenWoche(jetzt);
  let spaeter = '';
  try { spaeter = sessionStorage.getItem(SPAETER_KEY) || ''; } catch {}
  if (!woche || spaeter === woche.week) {
    bereich.hidden = true;
    return;
  }
  let gespeichert = null;
  let massnahmen = [];
  try {
    const [rueckblick, laufend] = await Promise.all([
      supabase.from('coach_wochen_checkins').select('umstaende,notiz,umsetzung').eq('user_id', userId).eq('woche', woche.week).maybeSingle(),
      supabase.from('coach_interventions').select('id,action,adherence').eq('user_id', userId).eq('status', 'aktiv').order('start_date', { ascending: false }).limit(5),
    ]);
    if (rueckblick.error) throw rueckblick.error;
    gespeichert = rueckblick.data;
    massnahmen = laufend.error ? [] : laufend.data || [];
  } catch (error) {
    // Ohne Tabelle (Migration fehlt) oder bei einem Fehler: kein Kärtchen.
    if (!istNichtEingerichtet(error)) console.warn('Wochenrückblick nicht verfügbar:', error?.message);
    bereich.hidden = true;
    return;
  }

  const zeigen = (offen) => {
    bereich.innerHTML = fensterMarkup({ klasse: 'coach-checkin coach-kaertchen', inhalt: offen ? formularMarkup(woche, massnahmen, gespeichert) : gespeichertMarkup(woche) });
    bereich.hidden = false;
  };
  zeigen(!gespeichert);

  bereich.addEventListener('click', (event) => {
    if (event.target.closest('[data-kaertchen-aendern]')) zeigen(true);
    if (event.target.closest('[data-kaertchen-spaeter]')) {
      try { sessionStorage.setItem(SPAETER_KEY, woche.week); } catch {}
      bereich.hidden = true;
    }
  });
  bereich.addEventListener('submit', async (event) => {
    if (!event.target.closest('[data-kaertchen-form]')) return;
    event.preventDefault();
    const formular = event.target;
    const knopf = formular.querySelector('button[type="submit"]');
    knopf.disabled = true;
    const zeile = {
      user_id: userId,
      woche: woche.week,
      umstaende: [...formular.querySelectorAll('[name="umstand"]:checked')].map((feld) => feld.value),
      notiz: String(formular.elements.notiz?.value || '').trim().slice(0, WEEKLY_NOTE_MAX),
      umsetzung: [...formular.querySelectorAll('[data-massnahme]')].map((feld) => ({ id: feld.dataset.massnahme, adherence: feld.value })),
      gespeichert_am: new Date().toISOString(),
    };
    try {
      // Die Umsetzung gilt auch für die Maßnahme selbst, nur geänderte Werte.
      for (const eintrag of zeile.umsetzung) {
        const massnahme = massnahmen.find((kandidat) => kandidat.id === eintrag.id);
        if (!massnahme || massnahme.adherence === eintrag.adherence) continue;
        const { error } = await supabase.from('coach_interventions').update({ adherence: eintrag.adherence }).eq('id', massnahme.id).eq('user_id', userId);
        if (error) throw error;
        massnahme.adherence = eintrag.adherence;
      }
      const { error } = await supabase.from('coach_wochen_checkins').upsert(zeile, { onConflict: 'user_id,woche' });
      if (error) throw error;
      gespeichert = zeile;
      zeigen(false);
      toast('Rückblick gespeichert.');
    } catch (error) {
      knopf.disabled = false;
      toast(error?.message || 'Der Rückblick konnte nicht gespeichert werden.');
    }
  });
}
