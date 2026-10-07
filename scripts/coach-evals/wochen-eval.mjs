// Kleiner Fallsatz für das Wochen-Coaching am Montag (COACHING-PLAN.md, Schritt 5).
// Ohne --live werden nur die Anfragen geprüft; es entstehen keine API-Kosten.
// Antworten aus --live werden vollständig für menschliche Durchsicht gespeichert.
// Einzelne Fälle: --nur=fall-a,fall-b. Die Volumen-Entscheidung kommt wie im
// Lauf von der App (volumen.js, eigene Tests in src/coachVolumen.test.js); hier
// steht sie fertig in jedem Fall, geprüft wird nur, was die KI daraus macht.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  wochenBereinigen, wochenSchema, wochenSystemPrompt, wochenUserPrompt,
} from '../../supabase/functions/capboy-coach/wochenCoaching.ts';
import { COACH_MODEL } from '../../supabase/functions/capboy-coach/coachPrompt.ts';
import { BEIBEHALTEN } from '../../supabase/functions/capboy-coach/volumen.js';
import { basis } from './cases.mjs';

const heute = '2026-10-05';
const daten = (aenderung = {}) => ({ ...basis(), generatedAt: '2026-10-05T19:00:00.000Z', ...aenderung });
const woche = ({ krank = 0, umstaende = [], notiz = '' } = {}) => ({
  week: '2026-W40', from: '2026-09-28', to: '2026-10-04', previousWeek: '2026-W39',
  comparison: [
    { metric: 'gewicht', label: 'Gewicht (Wochenmittel)', unit: 'kg', previous: 89.8, current: 90.1, change: 0.3, text: 'Gewicht (Wochenmittel): 89.8 kg (2026-W39) → 90.1 kg (2026-W40), Veränderung +0.3 kg' },
    { metric: 'schlafdauer', label: 'Schlafdauer', unit: 'min', previous: 425, current: 440, change: 15, text: 'Schlafdauer: 425 min (2026-W39) → 440 min (2026-W40), Veränderung +15 min' },
    { metric: 'protein', label: 'Protein (Ø Tage mit Einträgen)', unit: 'g', previous: 168, current: 172, change: 4, text: 'Protein (Ø Tage mit Einträgen): 168 g (2026-W39) → 172 g (2026-W40), Veränderung +4 g' },
  ],
  notMeasuredThisWeek: [], loggedIllnessDays: krank, loggedTravelDays: 0,
  userReport: { circumstances: umstaende, note: notiz }, interventionAdherence: [], previousReview: null,
});
const training = (vergleich = 'gleich', ohneFortschritt = 2) => ({
  stand: { cycle: 4, deload: false, cyclesBisDeload: 4, zuletztTrainiert: '2026-10-03', tageSeitLetzterEinheit: 2 },
  heute: [],
  letzteEinheit: { datum: '2026-10-03', einheit: 'UK-P', uebungen: [{ name: 'Kniebeuge', bestE1: 120, vergleich: 'gesteigert', differenzE1: 2.5 }] },
  naechsteEinheit: { einheit: 'OK-H', uebungen: [{ name: 'Bankdrücken', ziel: { art: 'wiederholung_mehr', vorschlag: { w: 80, r: 9 } } }] },
  uebungen: [{ name: 'Bankdrücken', einheit: 'OK · HEAVYS', ohneFortschritt, faelltWiederholt: vergleich === 'gefallen' }],
  muskeln: [{ muskel: 'Brust', geplant: 8, erledigt: 8 }],
});
const grundlage = { erholung: 'gut', ernaehrung: 'passt', gewicht: 'nicht-fallend', hautfalten: 'unbekannt' };
const plus1Brust = { id: 'plus1:Brust', text: 'LOGMAN: Priorität Brust auf „plus“ mit 1 Satz stellen – je passender Einheit (schwer und leicht) ein Satz, also +2 Sätze je Zyklus.' };
const prioAusBrust = { id: 'prioritaet-aus:Brust', text: 'LOGMAN: Priorität Brust entfernen – der Extra-Satz je passender Einheit fällt weg.' };
const FAELLIG = '11111111-2222-4333-8444-555555555555';

const faelle = [
  {
    id: 'fortschritt', weekly: woche(), training: training('gesteigert', 0),
    volumen: { sperren: [], grundlage, muskeln: [{ muskel: 'Brust', bewertung: 'beibehalten', leistung: 'steigt', gruende: ['Satz-Erfüllung Zyklus 3: 100 %, Zyklus 4: 100 %', 'Leistung steigt noch'] }], aktionen: [BEIBEHALTEN] },
    erwarteteAktion: 'beibehalten',
    manuell: 'Bilanziert die Woche mit den Zahlen aus „comparison“, lässt das Volumen unverändert und erfindet keine Änderung?',
  },
  {
    id: 'stillstand-erhoehen', weekly: woche(), training: training(),
    volumen: { sperren: [], grundlage, muskeln: [{ muskel: 'Brust', bewertung: 'erhoehen', leistung: 'stagniert', gruende: ['Satz-Erfüllung Zyklus 3: 100 %, Zyklus 4: 100 %', 'alle Übungen seit mindestens 2 Vergleichen ohne Steigerung'] }], aktionen: [BEIBEHALTEN, plus1Brust] },
    erwarteteAktion: 'plus1:Brust',
    manuell: 'Wählt „plus 1“ für Brust mit den Gründen der App, nennt die zwei bis drei Wochen Beobachtung und schlägt kein zweites Trainingsexperiment vor?',
  },
  {
    id: 'abfall-reduzieren', weekly: woche(), training: training('gefallen'),
    volumen: { sperren: [], grundlage: { ...grundlage, erholung: 'schlecht' }, muskeln: [{ muskel: 'Brust', bewertung: 'reduzieren', leistung: 'faellt', gruende: ['Satz-Erfüllung Zyklus 3: 100 %, Zyklus 4: 88 %', 'fällt wiederholt: Bankdrücken'] }], aktionen: [BEIBEHALTEN, prioAusBrust] },
    erwarteteAktion: 'prioritaet-aus:Brust',
    manuell: 'Entfernt die Brust-Priorität wegen des wiederholten Abfalls, ohne andere Hebel zu erfinden?',
  },
  {
    id: 'krankheitswoche', weekly: woche({ krank: 3, umstaende: ['krank oder angeschlagen'], notiz: 'ab Mittwoch erkältet' }), training: training('gefallen'),
    volumen: { sperren: ['Die Woche ist nicht repräsentativ (Krank- oder Reisetage, krank).'], grundlage, muskeln: [], aktionen: [BEIBEHALTEN] },
    erwarteteAktion: 'beibehalten', keinNeuesExperiment: true,
    manuell: 'Nennt die Woche als nicht repräsentativ (krank), zieht keinen Trend-Schluss, ändert nichts und startet kein neues Experiment?',
  },
  {
    id: 'experiment-faellig', weekly: woche(), training: training('gesteigert', 0),
    volumen: { sperren: [], grundlage, muskeln: [], aktionen: [BEIBEHALTEN] },
    interventionLog: JSON.stringify([{
      id: FAELLIG, action: 'Jeden Abend um 23 Uhr ins Bett', hypothesis: 'Wenn ich um 23 Uhr schlafe, steigt die Schlafdauer, weil ich früher einschlafe.',
      targetMetric: 'Schlafdauer', targetMetricId: 'schlafdauer', expectedDirection: 'steigt', baselineNote: '425 min (2026-W39)',
      measurement: { text: 'Schlafdauer: 425 min vor dem Start → 440 min danach, Veränderung +15 min' },
      startDate: '2026-09-21', reviewDate: '2026-10-05', reviewDue: true, status: 'active', adherence: 'ueberwiegend', outcome: null, source: 'coach_recommendation',
    }]),
    faelligeIds: [FAELLIG], erwartetesUrteil: FAELLIG, erwarteteAktion: 'beibehalten',
    manuell: 'Urteilt genau über das fällige Experiment mit Messung und Umsetzung aus dem Eintrag, ohne neu zu rechnen?',
  },
];

const nurArg = process.argv.find((arg) => arg.startsWith('--nur='));
if (nurArg) {
  const nur = new Set(nurArg.slice(6).split(',').filter(Boolean));
  const unbekannt = [...nur].filter((id) => !faelle.some((fall) => fall.id === id));
  if (unbekannt.length) throw new Error(`Unbekannte Fälle: ${unbekannt.join(', ')}`);
  faelle.splice(0, faelle.length, ...faelle.filter((fall) => nur.has(fall.id)));
}

const anfrage = (fall) => ({
  model: COACH_MODEL,
  instructions: wochenSystemPrompt(),
  input: [{ role: 'user', content: wochenUserPrompt({
    snapshot: daten(), timeseries: { weeks: [], recentDays: { targetKcal: 2800, days: [] } },
    weekly: fall.weekly, training: fall.training, volumen: fall.volumen, vortag: null,
    recentCheckinNotes: [], memory: { intervention_log: fall.interventionLog || '' }, heute,
  }) }],
  reasoning: { effort: 'medium' },
  max_output_tokens: 4000,
  text: { format: { type: 'json_schema', name: 'capboy_wochen_coaching', strict: true, schema: wochenSchema(fall.volumen.aktionen.map((aktion) => aktion.id)) } },
});

const hash = (wert) => createHash('sha256').update(JSON.stringify(wert)).digest('hex');
const anfragen = faelle.map((fall) => ({ fall, body: anfrage(fall) }));
if (!process.argv.includes('--live')) {
  console.log(`Trockenlauf: ${anfragen.length} Wochen-Fälle, keine API-Anfrage. Fälle: ${faelle.map((fall) => fall.id).join(', ')}.`);
  process.exit(0);
}

const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey || apiKey.length < 20) throw new Error('OPENAI_API_KEY fehlt oder sieht ungültig aus. Kein API-Aufruf gestartet.');
const laeufe = [];
for (const { fall, body } of anfragen) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${fall.id}: OpenAI ${response.status}: ${String(payload?.error?.message || 'Fehler').slice(0, 300)}`);
  const text = (payload.output || []).flatMap((item) => item.content || []).filter((part) => part.type === 'output_text').map((part) => part.text).join('');
  let ergebnis = null;
  const befund = [];
  try {
    ergebnis = wochenBereinigen(JSON.parse(text), {
      aktionen: fall.volumen.aktionen, faellige: (fall.faelligeIds || []).map((id) => ({ id })), heute,
      nichtRepraesentativ: fall.volumen.sperren.length > 0 && fall.id === 'krankheitswoche',
    });
    if (ergebnis.verworfen.length) befund.push(`verworfen: ${ergebnis.verworfen.join('; ')}`);
    if (ergebnis.experimente.some((urteil) => urteil.ergaenzt)) befund.push('Fälliges Experiment nicht bewertet (ergänzt)');
    if (ergebnis.volumen.aktion.id !== fall.erwarteteAktion) befund.push(`Volumen: ${ergebnis.volumen.aktion.id} statt ${fall.erwarteteAktion}`);
    if (fall.keinNeuesExperiment && ergebnis.neuesExperiment.length) befund.push('Neues Experiment trotz nicht repräsentativer Woche');
    if (fall.erwartetesUrteil && !ergebnis.experimente.some((urteil) => urteil.experimentId === fall.erwartetesUrteil)) befund.push('Fälliges Experiment ohne Urteil');
  } catch (error) {
    befund.push(`Antwort nicht verwendbar: ${error.message}`);
  }
  laeufe.push({ fall: fall.id, manuell: fall.manuell, antwort: text, ergebnis, befund, usage: payload.usage || null });
  console.log(`${fall.id}: ${befund.length ? befund.join('; ') : 'Struktur und Volumen okay – Inhalt manuell lesen'}`);
}
const ordner = join(dirname(fileURLToPath(import.meta.url)), 'results');
await mkdir(ordner, { recursive: true });
const datei = join(ordner, `${new Date().toISOString().replace(/[:.]/g, '-')}-wochen.json`);
await writeFile(datei, JSON.stringify({ modell: COACH_MODEL, promptHash: hash(wochenSystemPrompt()), faelleHash: hash(faelle), laeufe }, null, 2));
console.log(`Vollständige Antworten: ${datei}`);
