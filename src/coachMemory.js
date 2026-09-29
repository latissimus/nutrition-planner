import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { fensterMarkup } from './coachFenster.js';
import { sanduhrMarkup, wartetextMarkup } from './sanduhr.js';
import { EXPERIMENT_METRICS } from '../supabase/functions/capboy-coach/experiments.ts';

const COACH_CONVERSATION_KEY = 'muscledex:coach-gespraech';

/* „Was der Coach über mich weiß“ – sein Gedächtnis (Schritt 5).
   Drei Teile, alle nur für den Nutzer selbst sichtbar (RLS):
   - Über mich: feste Fakten, die der Nutzer selbst einträgt.
   - Maßnahmen: was ausprobiert wird, auf Wunsch aus einer Coach-Empfehlung.
   - Gespräche: Fragen und Antworten; der Coach sieht nur das laufende.
   Die KI schreibt hier nichts selbst. Alles ist bearbeit- und löschbar. */

export const KATEGORIEN = [
  ['ziel', 'Ziel'],
  ['verletzung', 'Verletzung'],
  ['einschraenkung', 'Einschränkung'],
  ['ausstattung', 'Ausstattung'],
  ['zeitplan', 'Zeitplan'],
  ['vorliebe', 'Vorliebe'],
  ['belastung', 'Belastung'],
  ['medizinisch', 'Medizinischer Hinweis'],
];
export const STATUS = [['aktiv', 'Läuft'], ['abgeschlossen', 'Abgeschlossen'], ['abgebrochen', 'Abgebrochen']];
export const UMSETZUNG = [['unbekannt', 'Unbekannt'], ['kaum', 'Kaum'], ['teilweise', 'Teilweise'], ['ueberwiegend', 'Überwiegend'], ['voll', 'Voll']];
// Experimente (Schritt 6): Zielgrößen aus derselben Liste, aus der die Edge
// Function die Messung berechnet.
export const ZIELGROESSEN = Object.entries(EXPERIMENT_METRICS).map(([id, metrik]) => [id, metrik.label]);
export const RICHTUNGEN = [['steigt', 'steigt'], ['sinkt', 'sinkt'], ['stabil', 'bleibt stabil']];
export const URTEILE = [['wirksam', 'wirksam'], ['nicht_wirksam', 'nicht wirksam'], ['unklar', 'unklar']];
export const ENTSCHEIDUNGEN = [['beibehalten', 'beibehalten'], ['anpassen', 'anpassen'], ['beenden', 'beenden']];
// Spalten aus der Migration von Schritt 6.
const EXPERIMENT_FELDER = ['target_metric_id', 'expected_direction', 'baseline_note'];

const escapeHtml = (value = '') => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const heute = () => new Date().toLocaleDateString('sv-SE');
const datum = (wert) => (typeof wert === 'string' && /^\d{4}-\d{2}-\d{2}/.test(wert) ? wert.slice(0, 10).split('-').reverse().join('.') : '');
const bezeichnung = (liste, wert) => liste.find(([id]) => id === wert)?.[1] || wert || '';
const kuerzen = (text, grenze) => {
  const sauber = String(text ?? '').replace(/\s+/g, ' ').trim();
  return sauber.length > grenze ? `${sauber.slice(0, grenze - 1)}…` : sauber;
};

// Fehlt eine Tabelle oder Spalte, ist die Datenbank-Migration noch nicht
// eingespielt. Die Seite sagt das dann, statt einen Fehler zu zeigen.
export function istNichtEingerichtet(error) {
  if (!error) return false;
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code)
    || /does not exist|schema cache|could not find/i.test(String(error.message || ''));
}

export function pruefeFakt({ category, fact }) {
  if (!KATEGORIEN.some(([id]) => id === category)) return 'Bitte eine Kategorie wählen.';
  const text = String(fact || '').trim();
  if (text.length < 2) return 'Bitte einen Fakt eintragen.';
  if (text.length > 500) return 'Höchstens 500 Zeichen.';
  return null;
}

export function pruefeMassnahme({ action, hypothesis, target_metric: ziel, start_date: start, review_date: pruefung, status, adherence, outcome, target_metric_id: zielId, expected_direction: richtung, baseline_note: ausgangswert }) {
  const text = String(action || '').trim();
  if (text.length < 2) return 'Bitte die Maßnahme beschreiben.';
  if (text.length > 500) return 'Die Maßnahme darf höchstens 500 Zeichen haben.';
  if (String(hypothesis || '').length > 1000 || String(outcome || '').length > 1000) return 'Annahme und Ergebnis höchstens je 1000 Zeichen.';
  if (String(ziel || '').length > 300) return 'Die Zielgröße darf höchstens 300 Zeichen haben.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || ''))) return 'Bitte ein Startdatum wählen.';
  if (pruefung && !/^\d{4}-\d{2}-\d{2}$/.test(pruefung)) return 'Das Prüfdatum ist ungültig.';
  if (pruefung && pruefung < start) return 'Das Prüfdatum darf nicht vor dem Start liegen.';
  if (status && !STATUS.some(([id]) => id === status)) return 'Unbekannter Status.';
  if (adherence && !UMSETZUNG.some(([id]) => id === adherence)) return 'Unbekannte Umsetzung.';
  if (zielId && !ZIELGROESSEN.some(([id]) => id === zielId)) return 'Unbekannte Zielgröße.';
  if (richtung && !RICHTUNGEN.some(([id]) => id === richtung)) return 'Unbekannte Richtung.';
  if (String(ausgangswert || '').length > 500) return 'Der Ausgangswert darf höchstens 500 Zeichen haben.';
  return null;
}

// Nachrichten (neueste zuerst) zu Gesprächen, das neueste Gespräch zuerst.
export function gruppiereGespraeche(nachrichten = []) {
  const gespraeche = new Map();
  for (const nachricht of nachrichten) {
    if (!nachricht.conversation_id) continue;
    const eintrag = gespraeche.get(nachricht.conversation_id) || { id: nachricht.conversation_id, zuletzt: nachricht.created_at, nachrichten: [] };
    eintrag.nachrichten.push(nachricht);
    gespraeche.set(nachricht.conversation_id, eintrag);
  }
  return [...gespraeche.values()].map((gespraech) => {
    const verlauf = [...gespraech.nachrichten].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    return { id: gespraech.id, zuletzt: gespraech.zuletzt, beginn: verlauf[0]?.created_at, verlauf, fragen: verlauf.filter((nachricht) => nachricht.role === 'user').length };
  });
}

// Löscht die lokale Kopie nur dann, wenn genau dieses Gespräch betroffen ist.
// Ohne ID werden – passend zu „Alle Gespräche löschen“ – alle lokalen
// Gesprächsdaten dieses Tabs entfernt.
export function vergissLokalesGespraech(conversationId = null, storage = sessionStorage) {
  if (!conversationId) {
    storage.removeItem(COACH_CONVERSATION_KEY);
    return true;
  }
  try {
    const lokal = JSON.parse(storage.getItem(COACH_CONVERSATION_KEY) || 'null');
    if (lokal?.id !== conversationId) return false;
  } catch {
    // Eine beschädigte lokale Kopie ist ebenfalls nicht mehr verwendbar.
  }
  storage.removeItem(COACH_CONVERSATION_KEY);
  return true;
}

// Ein gespeichertes Gespräch als Runden des Chats: Frage und vollständige
// Antwort (context.result). Ältere Antworten ohne gespeichertes Ergebnis
// zeigen ihre Kurzfassung. Die Wochenbilanz bekommt ihren Wochenvergleich
// zurück; ihre Frage heißt auf dem Server "Wochenbilanz für 2026-W38". Wie im
// Chat bleiben die letzten acht Runden.
const WOCHENFRAGE = /^Wochenbilanz für (\d{4})-W(\d{2})$/;
export function gespraechRunden(nachrichten = [], bilanz = null) {
  const runden = [];
  let frage = null;
  for (const nachricht of [...nachrichten].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (nachricht.role === 'user') { frage = nachricht; continue; }
    if (nachricht.role !== 'assistant' || !frage) continue;
    const woche = String(frage.content || '').match(WOCHENFRAGE);
    const runde = {
      frage: woche ? `Wochenbilanz KW ${Number(woche[2])}` : String(frage.content || ''),
      result: nachricht.context?.result || { summary: String(nachricht.content || '') },
    };
    if (woche && bilanz?.comparison?.length) runde.weekly = { week: bilanz.week, comparison: bilanz.comparison };
    runden.push(runde);
    frage = null;
  }
  return runden.slice(-8);
}

// Holt ein gespeichertes Gespräch zurück in den Chat; die nächste Frage setzt
// es fort. Die Coach-Ansicht wird neu aufgebaut, damit sie es liest (main.js).
export async function setzeGespraechFort(userId, conversationId) {
  const [nachrichten, bilanz] = await Promise.all([
    supabase.from('ai_coach_messages').select('role,content,context,created_at').eq('user_id', userId).eq('conversation_id', conversationId).order('created_at', { ascending: true }),
    supabase.from('coach_weekly_reviews').select('week,comparison').eq('user_id', userId).eq('conversation_id', conversationId).maybeSingle(),
  ]);
  if (nachrichten.error) throw nachrichten.error;
  const runden = gespraechRunden(nachrichten.data || [], bilanz.error ? null : bilanz.data);
  if (!runden.length) throw new Error('Das Gespräch enthält noch keine Antwort.');
  sessionStorage.setItem(COACH_CONVERSATION_KEY, JSON.stringify({ id: conversationId, runden }));
  window.dispatchEvent(new CustomEvent('muscledex:ansicht-neu-aufbauen', { detail: { route: 'coach' } }));
  location.hash = 'coach';
}

// Eine Coach-Empfehlung als Maßnahme, ab heute. Ein Experiment bringt
// Hypothese, Zielgröße, Richtung, Ausgangswert und Prüfdatum mit; ältere
// Antworten nur Aktion und Begründung. Ein Prüfdatum vor heute wird verworfen.
export function massnahmeAusEmpfehlung(empfehlung, tag = heute()) {
  const zielId = ZIELGROESSEN.some(([id]) => id === empfehlung?.targetMetric) ? empfehlung.targetMetric : null;
  const richtung = RICHTUNGEN.some(([id]) => id === empfehlung?.expectedDirection) ? empfehlung.expectedDirection : null;
  const pruefung = /^\d{4}-\d{2}-\d{2}$/.test(String(empfehlung?.reviewDate || '')) && empfehlung.reviewDate >= tag ? empfehlung.reviewDate : null;
  const annahme = String(empfehlung?.hypothesis || '').trim() || String(empfehlung?.rationale || '').trim();
  return {
    action: kuerzen(empfehlung?.action, 500),
    hypothesis: annahme ? kuerzen(annahme, 1000) : null,
    target_metric: zielId ? bezeichnung(ZIELGROESSEN, zielId) : null,
    start_date: tag,
    review_date: pruefung,
    status: 'aktiv',
    adherence: 'unbekannt',
    outcome: null,
    source: 'coach_empfehlung',
    target_metric_id: zielId,
    expected_direction: zielId ? richtung : null,
    baseline_note: String(empfehlung?.baseline || '').trim() ? kuerzen(empfehlung.baseline, 500) : null,
  };
}

// Übernahme einer Auswertung des Coachs: Das Ergebnis wird festgehalten.
// Beibehalten läuft ohne Prüfdatum weiter; Anpassen und Beenden schließen den
// bisherigen Versuchsaufbau ab.
export function auswertungAlsAenderung(auswertung, tag = heute()) {
  const text = `Auswertung vom ${datum(tag)}: ${bezeichnung(URTEILE, auswertung?.verdict)}, ${bezeichnung(ENTSCHEIDUNGEN, auswertung?.decision)}. ${String(auswertung?.basis || '').trim()}`;
  // „Anpassen“ beendet den bisherigen Versuchsaufbau. Die geänderte
  // Variante braucht als neues Experiment einen neuen Startwert und Termin;
  // sonst würden zwei verschiedene Bedingungen in einer Maßnahme vermischt.
  return ['anpassen', 'beenden'].includes(auswertung?.decision)
    ? { outcome: kuerzen(text, 1000), status: 'abgeschlossen' }
    : { outcome: kuerzen(text, 1000), status: 'aktiv', review_date: null };
}

// Solange die Migration von Schritt 6 fehlt, fehlen deren Spalten. Dann wird
// ohne sie gespeichert statt gar nicht. Jeder andere Fehler bleibt ein Fehler.
export async function mitExperimentRueckfall(schreiben, eintrag) {
  const erster = await schreiben(eintrag);
  if (!erster?.error || !istNichtEingerichtet(erster.error) || !EXPERIMENT_FELDER.some((feld) => feld in eintrag)) return erster;
  return schreiben(Object.fromEntries(Object.entries(eintrag).filter(([feld]) => !EXPERIMENT_FELDER.includes(feld))));
}

function optionen(liste, gewaehlt) {
  return liste.map(([id, name]) => `<option value="${id}"${id === gewaehlt ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('');
}

function faktFormular(fakt = {}) {
  return `<form class="gedaechtnis-formular" data-fakt-formular${fakt.id ? ` data-id="${escapeHtml(fakt.id)}"` : ''}>
    <label>Kategorie<select name="category" required>${optionen(KATEGORIEN, fakt.category || 'einschraenkung')}</select></label>
    <label>Was der Coach wissen soll<textarea name="fact" rows="2" maxlength="500" required placeholder="Zum Beispiel: Knieschmerzen links bei tiefen Kniebeugen">${escapeHtml(fakt.fact || '')}</textarea></label>
    <div class="gedaechtnis-aktionen"><button class="coach-knopf ist-wichtig" type="submit">${fakt.id ? 'Änderung speichern' : 'Merken'}</button><button class="coach-knopf" type="button" data-abbrechen>Abbrechen</button></div>
  </form>`;
}

function massnahmeFormular(massnahme = {}) {
  return `<form class="gedaechtnis-formular" data-massnahme-formular${massnahme.id ? ` data-id="${escapeHtml(massnahme.id)}"` : ''}>
    <label>Maßnahme<textarea name="action" rows="2" maxlength="500" required placeholder="Zum Beispiel: Letzte Mahlzeit drei Stunden vor dem Schlafen">${escapeHtml(massnahme.action || '')}</textarea></label>
    <label>Annahme (optional)<textarea name="hypothesis" rows="2" maxlength="1000" placeholder="Wenn …, dann …, weil …">${escapeHtml(massnahme.hypothesis || '')}</textarea></label>
    <div class="gedaechtnis-zeile">
      <label>Zielgröße (optional)<select name="target_metric_id"><option value="">keine</option>${optionen(ZIELGROESSEN, massnahme.target_metric_id)}</select></label>
      <label>Erwartung<select name="expected_direction"><option value="">–</option>${optionen(RICHTUNGEN, massnahme.expected_direction)}</select></label>
    </div>
    <label>Ausgangswert (optional)<input name="baseline_note" maxlength="500" value="${escapeHtml(massnahme.baseline_note || '')}" placeholder="Zum Beispiel: Schlafqualität 2,8 von 5"></label>
    <input type="hidden" name="target_metric" value="${escapeHtml(massnahme.target_metric || '')}">
    <div class="gedaechtnis-zeile">
      <label>Start<input type="date" name="start_date" required value="${escapeHtml(massnahme.start_date || heute())}"></label>
      <label>Prüfen am<input type="date" name="review_date" value="${escapeHtml(massnahme.review_date || '')}"></label>
    </div>
    ${massnahme.id ? `<div class="gedaechtnis-zeile">
      <label>Status<select name="status">${optionen(STATUS, massnahme.status)}</select></label>
      <label>Umgesetzt<select name="adherence">${optionen(UMSETZUNG, massnahme.adherence)}</select></label>
    </div>
    <label>Ergebnis (optional)<textarea name="outcome" rows="2" maxlength="1000">${escapeHtml(massnahme.outcome || '')}</textarea></label>` : ''}
    <div class="gedaechtnis-aktionen"><button class="coach-knopf ist-wichtig" type="submit">${massnahme.id ? 'Änderung speichern' : 'Maßnahme anlegen'}</button><button class="coach-knopf" type="button" data-abbrechen>Abbrechen</button></div>
  </form>`;
}

// wochenbilanzen: null, solange die Tabelle des Wochen-Check-ins fehlt.
export function gedaechtnisMarkup({ fakten = [], massnahmen = [], gespraeche = [], wochenbilanzen = null, eingerichtet = true, tag = heute(), bearbeiten = null } = {}) {
  if (!eingerichtet) {
    return fensterMarkup({ inhalt: '<p>Das Gedächtnis ist noch nicht eingerichtet. Die Datenbank wird gerade erweitert. Bis dahin beantworte ich jede Frage ohne Gedächtnis – deine Messwerte sehe ich trotzdem.</p>' });
  }
  const faktListe = fakten.map((fakt) => (bearbeiten === `fakt:${fakt.id}` ? `<li>${faktFormular(fakt)}</li>` : `<li class="gedaechtnis-eintrag" data-id="${escapeHtml(fakt.id)}">
      <span class="gedaechtnis-chip">${escapeHtml(bezeichnung(KATEGORIEN, fakt.category))}</span>
      <p>${escapeHtml(fakt.fact)}</p>
      <small>Bestätigt am ${datum(fakt.confirmed_on)}</small>
      <div class="gedaechtnis-aktionen">
        <button class="coach-knopf" type="button" data-fakt-bestaetigen="${escapeHtml(fakt.id)}">Stimmt noch</button>
        <button class="coach-knopf" type="button" data-fakt-bearbeiten="${escapeHtml(fakt.id)}">Bearbeiten</button>
        <button class="coach-knopf" type="button" data-fakt-loeschen="${escapeHtml(fakt.id)}">Löschen</button>
      </div>
    </li>`)).join('');
  const massnahmenListe = massnahmen.map((massnahme) => {
    if (bearbeiten === `massnahme:${massnahme.id}`) return `<li>${massnahmeFormular(massnahme)}</li>`;
    const faellig = massnahme.status === 'aktiv' && massnahme.review_date && massnahme.review_date <= tag;
    return `<li class="gedaechtnis-eintrag" data-id="${escapeHtml(massnahme.id)}">
      <span class="gedaechtnis-chip">${escapeHtml(bezeichnung(STATUS, massnahme.status))}${faellig ? ' · Prüfung fällig' : ''}</span>
      <p><b>${escapeHtml(massnahme.action)}</b></p>
      ${massnahme.hypothesis ? `<p>${escapeHtml(massnahme.hypothesis)}</p>` : ''}
      <small>Seit ${datum(massnahme.start_date)}${massnahme.review_date ? ` · prüfen am ${datum(massnahme.review_date)}` : ' · kein Prüfdatum'}${massnahme.target_metric_id ? ` · Zielgröße: ${escapeHtml(bezeichnung(ZIELGROESSEN, massnahme.target_metric_id))}${massnahme.expected_direction ? ` (${escapeHtml(bezeichnung(RICHTUNGEN, massnahme.expected_direction))})` : ''}` : massnahme.target_metric ? ` · misst: ${escapeHtml(massnahme.target_metric)}` : ''} · umgesetzt: ${escapeHtml(bezeichnung(UMSETZUNG, massnahme.adherence))}${massnahme.source === 'coach_empfehlung' ? ' · aus einer Coach-Empfehlung' : ''}</small>
      ${massnahme.baseline_note ? `<p class="gedaechtnis-ergebnis">Ausgangswert: ${escapeHtml(massnahme.baseline_note)}</p>` : ''}
      ${massnahme.outcome ? `<p class="gedaechtnis-ergebnis">Ergebnis: ${escapeHtml(massnahme.outcome)}</p>` : ''}
      <div class="gedaechtnis-aktionen">
        <button class="coach-knopf" type="button" data-massnahme-bearbeiten="${escapeHtml(massnahme.id)}">Bearbeiten</button>
        <button class="coach-knopf" type="button" data-massnahme-loeschen="${escapeHtml(massnahme.id)}">Löschen</button>
      </div>
    </li>`;
  }).join('');
  const gespraechListe = gespraeche.map((gespraech) => `<li class="gedaechtnis-eintrag" data-id="${escapeHtml(gespraech.id)}">
      <details>
        <summary><b>${escapeHtml(kuerzen(gespraech.verlauf.find((nachricht) => nachricht.role === 'user')?.content || 'Gespräch', 90))}</b><small>${datum(gespraech.beginn)} · ${gespraech.fragen} ${gespraech.fragen === 1 ? 'Frage' : 'Fragen'}</small></summary>
        <ol class="gedaechtnis-verlauf">${gespraech.verlauf.map((nachricht) => `<li class="${nachricht.role === 'user' ? 'ist-frage' : 'ist-antwort'}"><small>${nachricht.role === 'user' ? 'Du' : 'Coach'}</small><p>${escapeHtml(nachricht.content)}</p></li>`).join('')}</ol>
      </details>
      <div class="gedaechtnis-aktionen"><button class="coach-knopf ist-wichtig" type="button" data-gespraech-fortsetzen="${escapeHtml(gespraech.id)}">Fortsetzen</button><button class="coach-knopf" type="button" data-gespraech-loeschen="${escapeHtml(gespraech.id)}">Löschen</button></div>
    </li>`).join('');
  const bilanzListe = (wochenbilanzen || []).map((bilanz) => `<li class="gedaechtnis-eintrag" data-id="${escapeHtml(bilanz.id)}">
      <details>
        <summary><b>KW ${Number(String(bilanz.week).slice(6))} · ${escapeHtml(String(bilanz.week).slice(0, 4))}</b><small>Erstellt am ${datum(String(bilanz.created_at || '').slice(0, 10))}</small></summary>
        <p>${escapeHtml(bilanz.result?.summary || '')}</p>
        ${(bilanz.result?.recommendations || []).length ? `<ul>${bilanz.result.recommendations.map((eintrag) => `<li>${escapeHtml(eintrag.action || '')}</li>`).join('')}</ul>` : ''}
      </details>
      <div class="gedaechtnis-aktionen"><button class="coach-knopf" type="button" data-wochenbilanz-loeschen="${escapeHtml(bilanz.id)}">Löschen</button></div>
    </li>`).join('');
  const bereich = (titel, inhalt) => fensterMarkup({ von: 'bereich', titel, bild: '', klasse: 'gedaechtnis-bereich', inhalt });
  return [
    bereich('Über mich', `<p class="gedaechtnis-hinweis">Feste Fakten, die der Coach bei jeder Antwort beachtet: Verletzungen, Ausstattung, Zeitplan, Vorlieben. Deine Messwerte kennt er ohnehin aus den Fachseiten.</p>
      ${fakten.length ? `<ul class="gedaechtnis-liste">${faktListe}</ul>` : '<p class="gedaechtnis-leer">Noch nichts eingetragen.</p>'}
      ${bearbeiten === 'fakt:neu' ? faktFormular() : '<button class="coach-knopf" type="button" data-fakt-neu>+ Fakt hinzufügen</button>'}`),
    bereich('Maßnahmen', `<p class="gedaechtnis-hinweis">Ist das Prüfdatum erreicht, bewertet der Coach die Maßnahme zuerst, bevor er etwas Neues im selben Bereich vorschlägt.</p>
      ${massnahmen.length ? `<ul class="gedaechtnis-liste">${massnahmenListe}</ul>` : '<p class="gedaechtnis-leer">Noch keine Maßnahme. Übernimm eine Empfehlung des Coachs oder lege selbst eine an.</p>'}
      ${bearbeiten === 'massnahme:neu' ? massnahmeFormular() : '<button class="coach-knopf" type="button" data-massnahme-neu>+ Maßnahme anlegen</button>'}`),
    bereich('Gespräche', `<p class="gedaechtnis-hinweis">Der Coach sieht nur das laufende Gespräch. Mit „Fortsetzen“ holst du ein früheres zurück in den Chat.</p>
      ${gespraeche.length ? `<ul class="gedaechtnis-liste">${gespraechListe}</ul><button class="coach-knopf" type="button" data-gespraeche-loeschen>Alle Gespräche löschen</button>` : '<p class="gedaechtnis-leer">Noch keine gespeicherten Gespräche.</p>'}`),
    wochenbilanzen ? bereich('Wochenbilanzen', `<p class="gedaechtnis-hinweis">Der Coach sieht davon nur den vorgeschlagenen Fokus der letzten Bilanz – in der Bilanz der folgenden Woche.</p>
      ${wochenbilanzen.length ? `<ul class="gedaechtnis-liste">${bilanzListe}</ul>` : '<p class="gedaechtnis-leer">Noch keine Wochenbilanz. Nach jeder abgeschlossenen Woche bietet die Coach-Seite den Check-in an.</p>'}`) : '',
  ].join('');
}

// --------------------------------------------------------------------------
// Datenbank
// --------------------------------------------------------------------------

async function ergebnis(anfrage) {
  const { data, error } = await anfrage;
  if (error) throw error;
  return data;
}

export async function ladeGedaechtnis(userId) {
  const [fakten, massnahmen, nachrichten] = await Promise.all([
    supabase.from('coach_profile_memory').select('id,category,fact,confirmed_on,created_at').eq('user_id', userId).order('confirmed_on', { ascending: false }),
    supabase.from('coach_interventions').select('*').eq('user_id', userId).order('start_date', { ascending: false }),
    supabase.from('ai_coach_messages').select('id,conversation_id,role,content,created_at').eq('user_id', userId).not('conversation_id', 'is', null).order('created_at', { ascending: false }).limit(300),
  ]);
  const fehler = [fakten, massnahmen, nachrichten].find((antwort) => antwort.error)?.error;
  if (fehler) {
    if (istNichtEingerichtet(fehler)) return { eingerichtet: false, fakten: [], massnahmen: [], gespraeche: [] };
    throw fehler;
  }
  const liste = [...(massnahmen.data || [])].sort((a, b) => Number(b.status === 'aktiv') - Number(a.status === 'aktiv') || String(b.start_date).localeCompare(String(a.start_date)));
  return { eingerichtet: true, fakten: fakten.data || [], massnahmen: liste, gespraeche: gruppiereGespraeche(nachrichten.data || []), wochenbilanzen: await ladeWochenbilanzen(userId) };
}

// Wochenbilanzen (Schritt 7). Fehlt deren Tabelle noch, bleibt der Rest der
// Seite nutzbar; der Bereich erscheint dann nicht (null).
async function ladeWochenbilanzen(userId) {
  const { data, error } = await supabase.from('coach_weekly_reviews').select('id,week,result,created_at').eq('user_id', userId)
    .order('week', { ascending: false }).limit(26);
  if (error) {
    if (!istNichtEingerichtet(error)) throw error;
    return null;
  }
  return data || [];
}

export async function merkeEmpfehlung(userId, empfehlung) {
  const eintrag = massnahmeAusEmpfehlung(empfehlung);
  const fehler = pruefeMassnahme(eintrag);
  if (fehler) throw new Error(fehler);
  return ergebnis(mitExperimentRueckfall((zeile) => supabase.from('coach_interventions').insert({ ...zeile, user_id: userId }).select('id').single(), eintrag));
}

export async function uebernimmAuswertung(userId, auswertung) {
  // Die Kennung stammt aus der Antwort der KI; eine erfundene wäre für die
  // Datenbank ungültig und soll dieselbe verständliche Meldung ergeben.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(auswertung?.experimentId || ''))) {
    throw new Error('Dieses Experiment ist nicht mehr gespeichert.');
  }
  const daten = await ergebnis(supabase.from('coach_interventions').update(auswertungAlsAenderung(auswertung))
    .eq('id', auswertung?.experimentId).eq('user_id', userId).select('id'));
  if (!daten?.length) throw new Error('Dieses Experiment ist nicht mehr gespeichert.');
}

// --------------------------------------------------------------------------
// Seite
// --------------------------------------------------------------------------

// Wie die Coach-Seite: Die Liste wird auch in eine zwischengespeicherte
// Ansicht geschrieben, damit sie nach einem Seitenwechsel aktuell ist.
export async function mountCoachMemoryPage(container, { userId }) {
  container.classList.add('coach-page');
  container.innerHTML = `<main class="coach-shell coach-chat coach-gedaechtnis-seite">
    <div class="gedaechtnis-inhalt">
      <header class="gedaechtnis-kopf"><h1>Was der Coach über dich weiß</h1><p>Zusätzlich zu deinen Messwerten. Du kannst alles ändern oder löschen.</p></header>
      <div class="gedaechtnis-inhalt" data-gedaechtnis aria-live="polite">${fensterMarkup({ klasse: 'is-loading', inhalt: `<p class="coach-tippt" role="status">${sanduhrMarkup()}${wartetextMarkup('Lade Gedächtnis', 'Lade noch ein bisschen')}</p>` })}</div>
    </div>
  </main>`;
  const inhalt = container.querySelector('[data-gedaechtnis]');
  let stand = null;
  let bearbeiten = null;

  const zeichnen = () => { inhalt.innerHTML = gedaechtnisMarkup({ ...stand, bearbeiten }); };
  const neuLaden = async () => {
    try {
      stand = await ladeGedaechtnis(userId);
      zeichnen();
    } catch (error) {
      inhalt.innerHTML = fensterMarkup({ klasse: 'is-fehler', inhalt: '<p>Das Gedächtnis konnte nicht geladen werden. Versuche es später erneut.</p>' });
      toast(error?.message || 'Gedächtnis konnte nicht geladen werden.');
    }
  };
  const ausfuehren = async (aktion, erfolg) => {
    try {
      await aktion();
      bearbeiten = null;
      if (erfolg) toast(erfolg);
      await neuLaden();
    } catch (error) {
      toast(error?.message || 'Das hat nicht geklappt.');
    }
  };
  const formularWerte = (formular) => Object.fromEntries(new FormData(formular).entries());
  const leerZuNull = (wert) => (String(wert ?? '').trim() ? String(wert).trim() : null);

  inhalt.addEventListener('click', (event) => {
    const knopf = event.target.closest('button');
    if (!knopf) return;
    const { dataset } = knopf;
    if ('faktNeu' in dataset) { bearbeiten = 'fakt:neu'; zeichnen(); return; }
    if ('massnahmeNeu' in dataset) { bearbeiten = 'massnahme:neu'; zeichnen(); return; }
    if ('abbrechen' in dataset) { bearbeiten = null; zeichnen(); return; }
    if (dataset.faktBearbeiten) { bearbeiten = `fakt:${dataset.faktBearbeiten}`; zeichnen(); return; }
    if (dataset.massnahmeBearbeiten) { bearbeiten = `massnahme:${dataset.massnahmeBearbeiten}`; zeichnen(); return; }
    if (dataset.faktBestaetigen) {
      ausfuehren(() => ergebnis(supabase.from('coach_profile_memory').update({ confirmed_on: heute() }).eq('id', dataset.faktBestaetigen).eq('user_id', userId)), 'Als aktuell bestätigt.');
      return;
    }
    if (dataset.faktLoeschen) {
      if (!confirm('Diesen Fakt löschen? Der Coach weiß ihn danach nicht mehr.')) return;
      ausfuehren(() => ergebnis(supabase.from('coach_profile_memory').delete().eq('id', dataset.faktLoeschen).eq('user_id', userId)), 'Gelöscht.');
      return;
    }
    if (dataset.massnahmeLoeschen) {
      if (!confirm('Diese Maßnahme löschen?')) return;
      ausfuehren(() => ergebnis(supabase.from('coach_interventions').delete().eq('id', dataset.massnahmeLoeschen).eq('user_id', userId)), 'Gelöscht.');
      return;
    }
    if (dataset.gespraechFortsetzen) {
      knopf.disabled = true;
      setzeGespraechFort(userId, dataset.gespraechFortsetzen).catch((error) => {
        knopf.disabled = false;
        toast(error?.message || 'Das Gespräch konnte nicht geladen werden.');
      });
      return;
    }
    if (dataset.gespraechLoeschen) {
      if (!confirm('Dieses Gespräch löschen?')) return;
      ausfuehren(async () => {
        await ergebnis(supabase.from('ai_coach_messages').delete().eq('user_id', userId).eq('conversation_id', dataset.gespraechLoeschen));
        vergissLokalesGespraech(dataset.gespraechLoeschen);
      }, 'Gespräch gelöscht.');
      return;
    }
    if (dataset.wochenbilanzLoeschen) {
      if (!confirm('Diese Wochenbilanz löschen? Das Gespräch dazu bleibt unter „Gespräche“.')) return;
      ausfuehren(() => ergebnis(supabase.from('coach_weekly_reviews').delete().eq('id', dataset.wochenbilanzLoeschen).eq('user_id', userId)), 'Wochenbilanz gelöscht.');
      return;
    }
    if ('gespraecheLoeschen' in dataset) {
      if (!confirm('Alle gespeicherten Gespräche löschen?')) return;
      ausfuehren(async () => {
        await ergebnis(supabase.from('ai_coach_messages').delete().eq('user_id', userId).not('conversation_id', 'is', null));
        vergissLokalesGespraech();
      }, 'Alle Gespräche gelöscht.');
    }
  });

  inhalt.addEventListener('submit', (event) => {
    const formular = event.target;
    event.preventDefault();
    const id = formular.dataset.id || null;
    const werte = formularWerte(formular);
    if ('faktFormular' in formular.dataset) {
      const fakt = { category: werte.category, fact: String(werte.fact || '').trim() };
      const fehler = pruefeFakt(fakt);
      if (fehler) { toast(fehler); return; }
      // Wer einen Fakt ändert, bestätigt ihn damit auch.
      ausfuehren(() => ergebnis(id
        ? supabase.from('coach_profile_memory').update({ ...fakt, confirmed_on: heute() }).eq('id', id).eq('user_id', userId)
        : supabase.from('coach_profile_memory').insert({ ...fakt, user_id: userId })), 'Gemerkt.');
      return;
    }
    if ('massnahmeFormular' in formular.dataset) {
      const massnahme = {
        action: String(werte.action || '').trim(),
        hypothesis: leerZuNull(werte.hypothesis),
        // Ohne gewählte Zielgröße bleibt ein früherer freier Text erhalten.
        target_metric: werte.target_metric_id ? bezeichnung(ZIELGROESSEN, werte.target_metric_id) : leerZuNull(werte.target_metric),
        target_metric_id: leerZuNull(werte.target_metric_id),
        expected_direction: werte.target_metric_id ? leerZuNull(werte.expected_direction) : null,
        baseline_note: leerZuNull(werte.baseline_note),
        start_date: werte.start_date,
        review_date: leerZuNull(werte.review_date),
        ...(id ? { status: werte.status, adherence: werte.adherence, outcome: leerZuNull(werte.outcome) } : {}),
      };
      const fehler = pruefeMassnahme(massnahme);
      if (fehler) { toast(fehler); return; }
      ausfuehren(() => ergebnis(mitExperimentRueckfall((zeile) => (id
        ? supabase.from('coach_interventions').update(zeile).eq('id', id).eq('user_id', userId)
        : supabase.from('coach_interventions').insert({ ...zeile, user_id: userId })), massnahme)), 'Gespeichert.');
    }
  });

  await neuLaden();
}
