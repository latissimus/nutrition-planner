// Startnachricht des Coachs in einem leeren Chat: was in den letzten 14 Tagen
// fehlt oder nicht läuft, und Knöpfe, mit denen man es direkt bespricht. Die
// Punkte rechnet dieselbe Prüfung wie für Coach und COMP (followThrough.ts),
// hier in der App und ohne KI-Aufruf.

import { supabase } from './supabase.js';
import { FOLLOW_THROUGH_DAYS, buildFollowThrough } from '../supabase/functions/capboy-coach/followThrough.ts';
import { escapeHtml, fensterMarkup } from './coachFenster.js';

const zahl = (wert) => Number(wert).toLocaleString('de-DE', { maximumFractionDigits: 1 });
const dauer = (minuten) => `${Math.floor(minuten / 60)} h ${String(Math.round(minuten % 60)).padStart(2, '0')} min`;
const gemessen = (tage) => (tage == null ? 'noch nie gemessen' : `zuletzt vor ${tage} Tagen gemessen`);

// Je offenem Punkt: die Zeile der Nachricht, der Knopf und seine Frage.
const PUNKTE = {
  'ernaehrung-eintraege': ({ nutrition }) => [`Ernährung: an ${nutrition.daysWithEntries} von ${nutrition.windowDays} Tagen eingetragen`,
    'Regelmäßig eintragen', 'Ich trage meine Ernährung nicht regelmäßig ein. Wie schaffe ich das in den nächsten zwei Wochen?'],
  'ernaehrung-weit-unter-ziel': ({ nutrition }) => [`Ernährung: im Schnitt ${zahl(nutrition.averageKcal)} kcal eingetragen, ${nutrition.percentOfTarget} % deines Ziels`,
    'Kalorien besprechen', 'Meine eingetragenen Kalorien liegen weit unter meinem Ziel. Was bedeutet das, und wie gehe ich es an?'],
  'gewicht-wiegen': ({ bodyComposition }) => [`Gewicht: ${bodyComposition.weightMeasurements} Wiegungen in ${FOLLOW_THROUGH_DAYS} Tagen`,
    'Regelmäßig wiegen', 'Ich wiege mich zu selten. Wie baue ich das in meinen Alltag ein?'],
  'schlaf-eintraege': ({ sleep }) => [`Schlaf: an ${sleep.checkins} von ${sleep.windowDays} Tagen eingetragen`,
    'Schlaf eintragen', 'Ich trage meinen Schlaf zu selten ein. Wie ändere ich das?'],
  'training-daten': ({ training }) => [training.lastTrainingDate ? `Training: keine LOGMAN-Daten in ${FOLLOW_THROUGH_DAYS} Tagen` : 'Training: noch keine LOGMAN-Daten',
    'Trainingsdaten', 'Mir fehlen Trainingsdaten aus LOGMAN. Was bringt der Import, und worauf achte ich?'],
  'hautfalten-messung': ({ bodyComposition }) => [`Hautfalten: ${gemessen(bodyComposition.daysSinceLastSkinfold)}`,
    'Hautfalten messen', 'Meine Hautfaltenmessung ist fällig. Worauf achte ich, damit sie vergleichbar ist?'],
  'hautfalten-standard': () => ['Hautfalten: letzte Messung nicht standardisiert',
    'Standardisiert messen', 'Wie messe ich meine Hautfalten standardisiert?'],
  'taille-messung': ({ bodyComposition }) => [`Taille: ${gemessen(bodyComposition.daysSinceLastWaist)}`,
    'Taille messen', 'Meine Taillenmessung ist fällig. Wie messe ich sie vergleichbar?'],
  'ernaehrung-ueber-ziel': ({ nutrition }) => [`Ernährung: im Schnitt ${zahl(nutrition.averageKcal)} kcal, ${nutrition.percentOfTarget} % deines Ziels`,
    'Kalorienziel halten', 'Ich liege deutlich über meinem Kalorienziel. Wie halte ich es besser ein?'],
  routinen: ({ routines }) => [`Routinen: ${routines[0].name} an ${routines[0].completedDays} von ${routines[0].plannedDays} geplanten Tagen${routines.length === 2 ? ', dazu eine weitere Routine' : routines.length > 2 ? `, dazu ${routines.length - 1} weitere Routinen` : ''}`,
    'Routinen durchziehen', 'Ich hake meine Routinen seltener ab als geplant. Wie bekomme ich das hin?'],
  'protein-unter-ziel': ({ nutrition }) => [`Protein: im Schnitt ${zahl(nutrition.averageProteinG)} g, Ziel ${zahl(nutrition.proteinTargetG)} g`,
    'Mehr Protein', 'Ich komme nicht auf mein Proteinziel. Wie schaffe ich das im Alltag?'],
  'schlaf-dauer': ({ sleep }) => [`Schlaf: im Schnitt ${dauer(sleep.averageDurationMinutes)}`,
    'Länger schlafen', 'Ich schlafe im Schnitt zu kurz. Was kann ich konkret ändern?'],
  'schlaf-qualitaet': ({ sleep }) => [`Schlafqualität: im Schnitt ${zahl(sleep.averageQuality)} von 5`,
    'Besser schlafen', 'Meine Schlafqualität ist niedrig. Was kann ich konkret ändern?'],
};

const ZUERST = ['Was zuerst?', 'Was fehlt bei mir gerade, was läuft nicht rund, und was soll ich zuerst angehen?'];
const ALLGEMEIN = [
  ['Wie lief meine Woche?', 'Wie lief meine letzte Woche?'],
  ['Was kann ich verbessern?', 'Was kann ich gerade am meisten verbessern?'],
];
const knoepfe = (liste) => `<div class="coach-vorschlaege">${liste.map(([text, frage]) => `<button type="button" data-vorschlag="${escapeHtml(frage)}">${escapeHtml(text)}</button>`).join('')}</div>`;

// punkte: Ergebnis von buildFollowThrough; null, solange es lädt; fehler, wenn
// die Daten nicht zu laden waren (dann nie "nichts offen" behaupten).
export function startMarkup({ punkte = null, fehler = false, neu = false } = {}) {
  const gruss = neu ? 'Neues Gespräch.' : 'Hi!';
  let inhalt;
  if (fehler) {
    inhalt = `<p>${gruss} Frag mich zu Training, Ernährung, Schlaf oder Körper.</p>${knoepfe(ALLGEMEIN)}`;
  } else if (!punkte) {
    inhalt = `<p>${gruss} Ich schaue kurz, was bei dir gerade offen ist …</p>`;
  } else {
    const offen = (punkte.checks || []).flatMap((punkt) => (PUNKTE[punkt.id] ? [PUNKTE[punkt.id](punkt)] : []));
    inhalt = offen.length
      ? `<p>${gruss} Das ist in den letzten ${FOLLOW_THROUGH_DAYS} Tagen offen:</p><ul class="coach-offen">${offen.map(([zeile]) => `<li>${escapeHtml(zeile)}</li>`).join('')}</ul>${knoepfe([ZUERST, ...offen.slice(0, 2).map(([, text, frage]) => [text, frage])])}`
      : `<p>${gruss} In den letzten ${FOLLOW_THROUGH_DAYS} Tagen ist nichts offen: Du trägst ein, misst und ziehst deine Routinen durch.</p>${knoepfe(ALLGEMEIN)}`;
  }
  return fensterMarkup({ klasse: 'coach-welcome', inhalt });
}

// Die Zeilen, die die Prüfung braucht, in der Form der Edge Function.
// Training und Körpermaße: nur die letzte Messung, das genügt der Prüfung.
export async function ladeOffenePunkte(userId, jetzt = new Date()) {
  const seit = new Date(jetzt.getTime() - (FOLLOW_THROUGH_DAYS + 1) * 86_400_000).toISOString().slice(0, 10);
  const neueste = (tabelle, spalten, datum, grenze) => supabase.from(tabelle).select(spalten).eq('user_id', userId).order(datum, { ascending: false }).limit(grenze);
  const abSeit = (tabelle, spalten, datum) => supabase.from(tabelle).select(spalten).eq('user_id', userId).gte(datum, seit);
  const antworten = await Promise.all([
    supabase.from('nutrition_settings').select('custom_calorie_target,adaptive_target').eq('user_id', userId).maybeSingle(),
    neueste('weights', 'gemessen_am,kg', 'gemessen_am', 60),
    neueste('skinfolds', 'gemessen_am,standardisiert', 'gemessen_am', 1),
    neueste('waist_measurements', 'gemessen_am', 'gemessen_am', 1),
    neueste('logman_performance', 'performed_on', 'performed_on', 1),
    abSeit('sleep_logs', 'sleep_date,bedtime,wake_time,quality', 'sleep_date'),
    abSeit('nutrition_log_entries', 'log_date,energy_kcal,protein_g', 'log_date'),
    supabase.from('routines').select('id,name,weekdays,active,created_at').eq('user_id', userId),
    abSeit('routine_completions', 'routine_id,completed_on', 'completed_on'),
  ]);
  const fehler = antworten.find((antwort) => antwort.error)?.error;
  if (fehler) throw fehler;
  const [settings, weights, skinfolds, waists, performance, sleep, nutritionEntries, routines, completions] = antworten.map((antwort) => antwort.data);
  return buildFollowThrough({
    settings, weights: weights || [], skinfolds: skinfolds || [], waists: waists || [], performance: performance || [],
    sleep: sleep || [], nutritionEntries: nutritionEntries || [], routines: routines || [], completions: completions || [],
  }, jetzt);
}
