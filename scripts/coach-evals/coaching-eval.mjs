// Kleiner, eigenständiger Fallsatz für den täglichen Coaching-Modus.
// Ohne --live werden nur die Anfragen geprüft; es entstehen keine API-Kosten.
// Antworten aus --live werden vollständig für menschliche Durchsicht gespeichert.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  COACHING_SCHEMA, coachingBereinigen, coachingSystemPrompt, coachingUserPrompt,
} from '../../supabase/functions/capboy-coach/coaching.ts';
import { COACH_MODEL } from '../../supabase/functions/capboy-coach/coachPrompt.ts';
import { basis } from './cases.mjs';

const heute = '2026-10-03';
const daten = (aenderung = {}) => ({ ...basis(), generatedAt: '2026-10-03T19:00:00.000Z', ...aenderung });
const training = (datum, vergleich = 'gesteigert') => ({
  stand: { cycle: 3, deload: false, cyclesBisDeload: 4, zuletztTrainiert: datum, tageSeitLetzterEinheit: datum === heute ? 0 : 1 },
  heute: datum === heute ? [{ datum, einheit: 'OK-H', uebungen: [{ name: 'Bankdrücken', bestE1: 105, vergleich, differenzE1: vergleich === 'gesteigert' ? 2.5 : 0, saetze: [{ w: 80, r: 9, rir: 2 }] }] }] : [],
  letzteEinheit: { datum, einheit: 'OK-H', uebungen: [{ name: 'Bankdrücken', bestE1: 105, vergleich, differenzE1: vergleich === 'gesteigert' ? 2.5 : 0, saetze: [{ w: 80, r: 9, rir: 2 }] }] },
  naechsteEinheit: { einheit: 'UK-H', uebungen: [{ name: 'Kniebeuge', ziel: { art: 'wiederholung_mehr', vorschlag: { w: 100, r: 8 } } }] },
  uebungen: [{ name: 'Bankdrücken', ohneFortschritt: vergleich === 'gleich' ? 2 : 0, faelltWiederholt: false }],
  muskeln: [],
});

const faelle = [
  {
    id: 'steigerung', aenderungen: ['training'], training: training(heute),
    daten: daten(), erwarteterErsterBereich: 'training',
    manuell: 'Nennt die Verbesserung und das Ziel 100 kg × 8 für die nächste Einheit, ohne neue Last zu errechnen?',
  },
  {
    id: 'stillstand-schlaf', aenderungen: ['training', 'schlaf'], training: training(heute, 'gleich'),
    daten: daten({ sleep: { checkins: 5, averageDurationMinutes: 340, averageQuality: 2, averageMorningEnergy: 2 } }),
    erwarteterErsterBereich: 'training',
    manuell: 'Verbindet Stillstand und Schlaf als plausible Vermutung, ohne die Ursache als bewiesen darzustellen?',
  },
  {
    id: 'nachgetragenes-training', aenderungen: ['training'], training: training('2026-10-02'),
    daten: daten(), erwarteterErsterBereich: 'training',
    manuell: 'Nennt das Training vom 02.10. als nachgetragen und behauptet nicht, es sei heute absolviert worden?',
  },
  {
    id: 'pausentag-schlaf', aenderungen: ['schlaf'], training: null,
    daten: daten({ sleep: { checkins: 5, averageDurationMinutes: 370, averageQuality: 2, averageMorningEnergy: 2 } }),
    erwarteterErsterBereich: 'schlaf',
    manuell: 'Spricht über Erholung und morgen, ohne eine heutige Einheit zu erfinden?',
  },
  {
    // Körper nach Hautfalten, nicht nach Gewicht allein (Regel 10).
    id: 'koerper-falten', aenderungen: ['koerper'], training: null,
    daten: daten({ bodyComposition: { ...basis().bodyComposition, weightTrendPercent: 1.2, skinfoldChangeMm: -3, latestSkinfoldDate: heute, waistChangeCm: 0 } }),
    erwarteterErsterBereich: 'koerper',
    manuell: 'Bewertet das Gewichtsplus zusammen mit der sinkenden Faltensumme als wahrscheinlichen Muskelaufbau, statt das Gewicht allein zu bewerten?',
  },
  {
    // Trainingstypische Beschwerde; GTPS ist nur ein Beispiel (Regel 9).
    id: 'beschwerde-huefte', aenderungen: ['training', 'erholung'], training: training(heute),
    daten: daten(),
    recentCheckinNotes: [{ date: heute, text: 'Rechte Hüfte außen zieht wieder (GTPS), vor allem nach Kniebeugen.' }],
    erwarteterErsterBereich: 'training',
    manuell: 'Bezieht die Hüfte auf die Kniebeuge der nächsten Einheit, rät zu schmerzfreiem Training (Last halten, schmerzfreie Tiefe oder Stand), stellt keine eigene Diagnose und redet nicht von Notfällen?',
  },
];

const anfrage = (fall) => ({
  model: COACH_MODEL,
  instructions: coachingSystemPrompt(),
  input: [{ role: 'user', content: coachingUserPrompt({
    snapshot: fall.daten,
    timeseries: { weeks: [], recentDays: { targetKcal: 2700, days: [] } },
    training: fall.training,
    vortag: null,
    logmanStatus: { verbunden: Boolean(fall.training), frisch: Boolean(fall.training), grund: '' },
    aenderungen: fall.aenderungen,
    recentCheckinNotes: fall.recentCheckinNotes || [],
    memory: {}, heute,
  }) }],
  reasoning: { effort: 'medium' },
  max_output_tokens: 3000,
  text: { format: { type: 'json_schema', name: 'capboy_coaching', strict: true, schema: COACHING_SCHEMA } },
});

const hash = (wert) => createHash('sha256').update(JSON.stringify(wert)).digest('hex');
const anfragen = faelle.map((fall) => ({ fall, body: anfrage(fall) }));
if (!process.argv.includes('--live')) {
  console.log(`Trockenlauf: ${anfragen.length} Coaching-Fälle, keine API-Anfrage. Fälle: ${faelle.map((fall) => fall.id).join(', ')}.`);
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
    ergebnis = coachingBereinigen(JSON.parse(text));
    if (fall.erwarteterErsterBereich && ergebnis.punkte[0]?.bereich !== fall.erwarteterErsterBereich) befund.push('Erster Bereich anders als erwartet');
  } catch (error) {
    befund.push(`Antwort nicht verwendbar: ${error.message}`);
  }
  laeufe.push({ fall: fall.id, manuell: fall.manuell, antwort: text, ergebnis, befund, usage: payload.usage || null });
  console.log(`${fall.id}: ${befund.length ? befund.join('; ') : 'Struktur und Bereich okay – Inhalt manuell lesen'}`);
}
const ordner = join(dirname(fileURLToPath(import.meta.url)), 'results');
await mkdir(ordner, { recursive: true });
const datei = join(ordner, `${new Date().toISOString().replace(/[:.]/g, '-')}-coaching.json`);
await writeFile(datei, JSON.stringify({ modell: COACH_MODEL, promptHash: hash(coachingSystemPrompt()), faelleHash: hash(faelle), laeufe }, null, 2));
console.log(`Vollständige Antworten: ${datei}`);
