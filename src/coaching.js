import { supabase } from './supabase.js';
import { escapeHtml } from './coachFenster.js';
import { aktionenMarkup, quellenAus } from './chatLeiste.js';
import { ENTSCHEIDUNGEN, URTEILE, ZIELGROESSEN } from './coachMemory.js';
import { vergleichMarkup } from './coachWeekly.js';

// Tägliches Coaching in der App (COACHING-PLAN.md, Schritt 4). Der Chat ist
// seine Heimat: Das neueste Coaching steht als Karte über dem Gespräch, und
// Rückfragen schließen an (das Gespräch trägt die id des Coachings, siehe
// capboy-coach). Ungelesen zeigt das Coach-Symbol einen Briefumschlag; die
// angesprochenen Bereiche bekommen rosa Punkte an ihren Reitern, bis man die
// Seite besucht.

// Bereich des Coachings → Reiter im Menüband.
export const COACHING_ROUTEN = {
  training: 'training',
  ernaehrung: 'reminders',
  schlaf: 'sleep',
  koerper: 'body',
  erholung: 'body',
  routinen: 'habits',
};
const BEREICH_NAMEN = {
  training: 'Training', ernaehrung: 'Ernährung', schlaf: 'Schlaf', koerper: 'Körper', erholung: 'Erholung', routinen: 'Routinen',
};
// Punkte an den Reitern gelten nur für ein frisches Coaching.
const FRISCH_STUNDEN = 36;

const besuchtKey = (id) => `capboy:coaching-besucht:${id}`;
const besuchteRouten = (id) => {
  try { return new Set(JSON.parse(localStorage.getItem(besuchtKey(id)) || '[]')); } catch { return new Set(); }
};

/** Das neueste Coaching der Person (Tag oder Woche), auch wenn es noch läuft oder fehlschlug. */
/** Ein bestimmtes Coaching, etwa ein früheres, das im Gedächtnis geöffnet wurde. */
export async function coachingNachId(userId, id) {
  const { data, error } = await supabase.from('coach_coachings')
    .select('id,art,datum,status,ergebnis,bereiche,erstellt_am,gelesen_am')
    .eq('user_id', userId).eq('id', id).maybeSingle();
  return error ? null : data;
}

export async function neuestesCoaching(userId) {
  const { data, error } = await supabase.from('coach_coachings')
    .select('id,art,datum,status,ergebnis,bereiche,erstellt_am,gelesen_am')
    .eq('user_id', userId)
    .order('datum', { ascending: false }).limit(1).maybeSingle();
  // Ohne Tabelle (Migration fehlt) gibt es schlicht kein Coaching.
  if (error) {
    if (/coach_coachings|does not exist|schema cache/i.test(error.message || '')) return null;
    throw error;
  }
  return data || null;
}

export const istFrisch = (coaching) => Boolean(coaching?.erstellt_am)
  && Date.now() - Date.parse(coaching.erstellt_am) < FRISCH_STUNDEN * 3_600_000;

/** Hinweise für Kopf und Menüband: Briefumschlag und Reiter mit Punkt. */
export function coachingHinweise(coaching) {
  if (!coaching || coaching.status !== 'bereit' || !istFrisch(coaching)) return { ungelesen: false, routen: new Set() };
  const besucht = besuchteRouten(coaching.id);
  const routen = new Set((coaching.bereiche || []).map((bereich) => COACHING_ROUTEN[bereich]).filter((route) => route && !besucht.has(route)));
  return { ungelesen: !coaching.gelesen_am, routen };
}

/** Eine Seite besucht: Ihr Punkt aus dem Coaching verschwindet. */
export function routeBesucht(coaching, route) {
  if (!coaching?.id || !route) return false;
  const routen = new Set((coaching.bereiche || []).map((bereich) => COACHING_ROUTEN[bereich]));
  if (!routen.has(route)) return false;
  const besucht = besuchteRouten(coaching.id);
  if (besucht.has(route)) return false;
  besucht.add(route);
  try { localStorage.setItem(besuchtKey(coaching.id), JSON.stringify([...besucht])); } catch {}
  return true;
}

export async function alsGelesenMarkieren(coaching) {
  if (!coaching?.id || coaching.gelesen_am || coaching.status !== 'bereit') return;
  const jetzt = new Date().toISOString();
  const { error } = await supabase.from('coach_coachings').update({ gelesen_am: jetzt }).eq('id', coaching.id);
  if (error) {
    console.warn('Coaching nicht als gelesen markiert:', error.message);
    return;
  }
  coaching.gelesen_am = jetzt;
  window.dispatchEvent(new CustomEvent('capboy:coaching-gelesen', { detail: { id: coaching.id } }));
}

const datumText = (coaching) => {
  const datum = new Date(`${coaching.datum}T12:00:00`);
  const heute = new Date().toLocaleDateString('sv-SE');
  const tag = coaching.datum === heute ? 'Heute' : datum.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${tag}, 21 Uhr`;
};

/* Ein Lauf braucht Sekunden bis wenige Minuten. Steht er nach 15 Minuten noch
   auf „läuft“, wurde die Funktion abgebrochen; dann gilt er als gescheitert. */
const HAENGT_NACH_MS = 15 * 60_000;
const haengt = (coaching) => coaching.status === 'laeuft' && Boolean(coaching.erstellt_am)
  && Date.now() - Date.parse(coaching.erstellt_am) > HAENGT_NACH_MS;

const bezeichnung = (liste, wert) => liste.find(([id]) => id === wert)?.[1] || wert || '';

/* Übernommene Urteile und Experimente einer Wochenkarte (je Coaching im
   localStorage), damit der Knopf nach dem Neuladen nicht wieder aktiv ist. */
const uebernommenKey = (id) => `capboy:coaching-uebernommen:${id}`;
export function uebernommen(coachingId) {
  try { return new Set(JSON.parse(localStorage.getItem(uebernommenKey(coachingId)) || '[]')); } catch { return new Set(); }
}
export function alsUebernommenMerken(coachingId, schluessel) {
  const liste = uebernommen(coachingId);
  liste.add(schluessel);
  try { localStorage.setItem(uebernommenKey(coachingId), JSON.stringify([...liste])); } catch {}
}

// Nur im Wochen-Coaching: Volumen, Experiment-Urteile, neues Experiment und
// der Wochenvergleich der App (zum Aufklappen, damit die Karte kurz bleibt).
function wochenteilMarkup(coaching) {
  const ergebnis = coaching.ergebnis || {};
  const erledigt = uebernommen(coaching.id);
  const knopf = (schluessel, attribut, index, text, fertig) => (erledigt.has(schluessel)
    ? `<button class="coach-merken" type="button" disabled>${escapeHtml(fertig)}</button>`
    : `<button class="coach-merken" type="button" ${attribut}="${index}">${escapeHtml(text)}</button>`);
  const aktion = ergebnis.volumen?.aktion;
  const volumen = aktion ? `<div class="coaching-volumen"><h4 class="coaching-bereich">Volumen</h4>
      <p>${escapeHtml(aktion.art === 'beibehalten' ? 'Unverändert lassen.' : aktion.text)}</p>
      ${ergebnis.volumen.begruendung ? `<small>${escapeHtml(ergebnis.volumen.begruendung)}</small>` : ''}
    </div>` : '';
  // Ein vom Coach nicht bewertetes fälliges Experiment (ergaenzt) steht als
  // „nicht bewertet“ da, ohne Knopf: Das Ergebnis trägt die Person selbst ein.
  const urteile = (ergebnis.experimente || []).map((urteil, index) => `<article class="coaching-experiment">
      <span class="coaching-bereich">Experiment · ${urteil.ergaenzt ? 'nicht bewertet' : `${escapeHtml(bezeichnung(URTEILE, urteil.verdict))} · ${escapeHtml(bezeichnung(ENTSCHEIDUNGEN, urteil.decision))}`}</span>
      <p>${escapeHtml(urteil.basis)}</p>
      ${urteil.ergaenzt ? '' : knopf(`urteil:${index}`, 'data-coaching-urteil', index, 'Ergebnis übernehmen', 'Ergebnis übernommen')}
    </article>`).join('');
  const neu = (ergebnis.neuesExperiment || []).map((empfehlung, index) => `<article class="coaching-experiment">
      <span class="coaching-bereich">${empfehlung.kind === 'experiment' ? 'Neues Experiment' : 'Beobachten'}${empfehlung.targetMetric && empfehlung.targetMetric !== 'keine' ? ` · ${escapeHtml(bezeichnung(ZIELGROESSEN, empfehlung.targetMetric))}` : ''}</span>
      <p>${escapeHtml(empfehlung.action)}</p>
      ${empfehlung.hypothesis ? `<small>${escapeHtml(empfehlung.hypothesis)}</small>` : ''}
      ${knopf(`experiment:${index}`, 'data-coaching-experiment', index, empfehlung.kind === 'experiment' ? 'Als Experiment merken' : 'Als Maßnahme merken', 'Gemerkt')}
    </article>`).join('');
  const vergleich = ergebnis.wochenvergleich?.comparison?.length
    ? `<details class="coaching-vergleich"><summary>Die Woche im Vergleich</summary>${vergleichMarkup(ergebnis.wochenvergleich)}</details>` : '';
  return volumen + urteile + neu + vergleich;
}

/* Das Coaching sieht aus wie jede Antwort des Coaches (Rückmeldung 08.10.,
   nach ChatGPT): Überschrift, die Punkte unter fetten Zwischenzeilen je
   Bereich, der Fokus genauso, darunter dieselbe Leiste. Zeit und Art stehen
   oben im „…“-Menü (coachingKopf). Laufend oder gescheitert ein klarer Status. */
export const coachingKopf = (coaching) => `${datumText(coaching)} · ${coaching.art === 'woche' ? 'Wochen-Coaching' : 'Coaching'}`;
// Das Coaching beruht auf den Daten der angesprochenen Bereiche.
export const coachingQuellen = (coaching) => quellenAus({ sources: { userData: coaching?.bereiche || [], ownData: true } });
// Als schlichter Text für Kopieren, Vorlesen und Teilen.
export function coachingText(coaching) {
  const ergebnis = coaching?.ergebnis || {};
  return [
    ergebnis.ueberschrift,
    ...(ergebnis.punkte || []).map((punkt) => punkt.text),
    ergebnis.fokus?.text ? `${coaching.art === 'woche' ? 'Fokus der Woche' : 'Fokus'}: ${ergebnis.fokus.text}` : '',
  ].filter(Boolean).join('\n\n');
}

export function coachingKarteMarkup(coaching) {
  if (!coaching) return '';
  const woche = coaching.art === 'woche';
  const marke = woche ? 'Wochen-Coaching' : 'Coaching';
  if (coaching.status === 'laeuft' && !haengt(coaching)) {
    return `<section class="coaching-karte is-status" aria-live="polite"><p>Dein ${marke} wird gerade erstellt …</p></section>`;
  }
  if (coaching.status !== 'bereit') {
    return `<section class="coaching-karte is-status is-fehler"><p>Das ${marke} konnte diesmal nicht erstellt werden. Deine Daten sind sicher; der nächste Versuch kommt mit dem nächsten Coaching. Fragen kannst du den Coach jederzeit hier im Chat.</p></section>`;
  }
  const ergebnis = coaching.ergebnis || {};
  let bereich = null;
  const punkte = (ergebnis.punkte || []).map((punkt) => {
    const name = BEREICH_NAMEN[punkt.bereich] || punkt.bereich;
    const zwischenzeile = name && name !== bereich ? `<h4 class="coaching-bereich">${escapeHtml(name)}</h4>` : '';
    bereich = name;
    return `${zwischenzeile}<p>${escapeHtml(punkt.text)}</p>`;
  }).join('');
  return `<section class="coaching-karte${woche ? ' is-woche' : ''}" aria-label="${marke}">
    <div class="coach-antwort">
      <h2>${escapeHtml(ergebnis.ueberschrift || '')}</h2>
      ${punkte}
    </div>
    ${woche ? wochenteilMarkup(coaching) : ''}
    ${ergebnis.fokus ? `<div class="coaching-fokus"><h4>${woche ? 'Fokus der Woche' : 'Fokus'}</h4><p>${escapeHtml(ergebnis.fokus.text)}</p></div>` : ''}
    ${aktionenMarkup({ quellen: coachingQuellen(coaching) })}
  </section>`;
}
