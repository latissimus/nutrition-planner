// Testfälle für persönliche Experimente mit Ergebnisprüfung (Schritt 6).
//
// Fakten, Verlauf und Maßnahmen-Block entstehen aus Rohdaten durch denselben
// Code wie in der Edge Function (context.ts, memory.ts, experiments.ts). So
// steht im Block genau die Messung, die die App auch im Betrieb berechnet.
// Eigener Fallsatz: npm run eval:coach -- --faelle experimente
//
// Zusätzliche Erwartungen (checks.mjs):
//   auswertung       { experimentId: [erlaubte Urteile] }
//   neuesExperiment  [erlaubte Zielgrößen] für mindestens ein neues Experiment

import { JETZT, normalerCheckin, normalerSchlaf, rohdaten } from './cases-zeitreihe.mjs';
import { FAELLE_ZEITREIHE } from './cases-zeitreihe.mjs';
import { buildCompFacts, buildTimeseries } from '../../supabase/functions/capboy-coach/context.ts';
import { interventionBlock } from '../../supabase/functions/capboy-coach/memory.ts';

const HEUTE = JETZT.toISOString().slice(0, 10);

function fall({ zeilen, daten, zeitreihe, massnahmen = [], ...rest }) {
  const fakten = daten || buildCompFacts(zeilen, JETZT);
  const verlauf = zeitreihe || buildTimeseries(zeilen, JETZT);
  const block = interventionBlock(massnahmen, HEUTE, verlauf);
  return { ...rest, daten: fakten, zeitreihe: verlauf, gedaechtnis: block ? { intervention_log: block } : {} };
}

// Schlafqualität 2 vor dem Start (2. September, KW 36), danach 4; alles andere stabil.
const schlafBesser = rohdaten({
  ziel: 'recomposition',
  kalorienziel: 2600,
  gewicht: (n) => (n % 7 === 3 ? null : [82.0, 82.1, 81.9][n % 3]),
  ernaehrung: (n) => ({ kcal: 2550, protein: 170 }),
  checkin: () => normalerCheckin(),
  schlaf: (n) => ({ ...normalerSchlaf(), quality: n > 24 ? 2 : 4, energy: n > 24 ? 2 : 4 }),
  training: (n) => ([1, 3, 5].includes(n % 7) ? 100 : null),
  faltenMessungen: [[60, 80], [30, 79], [5, 78]],
  taillenMessungen: [[62, 90], [33, 89.5], [6, 89]],
});

const krankheit = FAELLE_ZEITREIHE.find((kandidat) => kandidat.id === 'verlauf-krankheit');

// Mäßiger Schlaf ohne laufende Maßnahme.
const schlafMaessig = rohdaten({
  ziel: 'recomposition',
  kalorienziel: 2600,
  gewicht: (n) => (n % 7 === 3 ? null : [82.0, 82.1, 81.9][n % 3]),
  ernaehrung: (n) => ({ kcal: 2550, protein: 170 }),
  checkin: () => ({ recovery: 2, mood: 3, hunger: 3 }),
  schlaf: (n) => ({ bedtime: n % 3 === 0 ? '00:40' : '23:30', wake_time: '06:15', quality: 2, energy: 2 }),
  training: (n) => ([1, 3, 5].includes(n % 7) ? 100 : null),
  faltenMessungen: [[60, 80], [30, 79], [5, 78]],
  taillenMessungen: [[62, 90], [33, 89.5], [6, 89]],
});

// Schlafqualität bleibt vor und nach dem Start bei 3 von 5.
const schlafUnveraendert = rohdaten({
  ziel: 'recomposition',
  kalorienziel: 2600,
  gewicht: (n) => (n % 7 === 3 ? null : [82.0, 82.1, 81.9][n % 3]),
  ernaehrung: (n) => ({ kcal: 2550, protein: 170 }),
  checkin: () => normalerCheckin(),
  schlaf: () => ({ ...normalerSchlaf(), quality: 3, energy: 3 }),
  training: (n) => ([1, 3, 5].includes(n % 7) ? 100 : null),
  faltenMessungen: [[60, 80], [30, 79], [5, 78]],
  taillenMessungen: [[62, 90], [33, 89.5], [6, 89]],
});

const schlafExperiment = (id, adherence) => ({
  id, action: 'Letzte größere Mahlzeit spätestens drei Stunden vor dem Schlafen',
  hypothesis: 'Wenn ich früher esse, schlafe ich besser.',
  target_metric: 'Schlafqualität', target_metric_id: 'schlafqualitaet', expected_direction: 'steigt', baseline_note: 'Schlafqualität 2 von 5',
  start_date: '2026-09-02', review_date: '2026-09-23', status: 'aktiv', adherence, outcome: null, source: 'coach_empfehlung',
  updated_at: '2026-09-02T20:00:00Z',
});

export const FAELLE_EXPERIMENTE = [
  fall({
    id: 'experiment-wirksam',
    titel: 'Fälliges Experiment: früheres Abendessen, Schlafqualität messbar gestiegen',
    frage: 'Hat mein Experiment mit dem früheren Abendessen etwas gebracht?',
    zeilen: schlafBesser,
    massnahmen: [{
      id: 'exp-abendessen', action: 'Letzte größere Mahlzeit spätestens drei Stunden vor dem Schlafen',
      hypothesis: 'Wenn ich früher esse, schlafe ich besser, weil spätes Essen in den Check-ins mit schlechtem Schlaf zusammenfällt.',
      target_metric: 'Schlafqualität', target_metric_id: 'schlafqualitaet', expected_direction: 'steigt', baseline_note: 'Schlafqualität 2 von 5',
      start_date: '2026-09-02', review_date: '2026-09-23', status: 'aktiv', adherence: 'ueberwiegend', outcome: null, source: 'coach_empfehlung',
      updated_at: '2026-09-02T20:00:00Z',
    }],
    erwartet: {
      semantisch: [],
      sicherheit: ['niedrig', 'mittel', 'hoch'],
      muss: [],
      darfNicht: [],
      auswertung: { 'exp-abendessen': ['wirksam'] },
      hinweis: 'Zitiert die Auswertung die Messung (2 → 4 von 5) statt selbst zu rechnen, und nennt sie die Umsetzung?',
    },
  }),
  fall({
    id: 'experiment-kaum-umgesetzt',
    titel: 'Fälliges Experiment: Messwert besser, Maßnahme aber kaum umgesetzt',
    frage: 'Hat mein Experiment funktioniert?',
    zeilen: schlafBesser,
    massnahmen: [schlafExperiment('exp-kaum', 'kaum')],
    erwartet: {
      semantisch: [],
      sicherheit: ['niedrig', 'mittel'],
      muss: [],
      darfNicht: [],
      auswertung: { 'exp-kaum': ['unklar'] },
    },
  }),
  fall({
    id: 'experiment-ohne-wirkung',
    titel: 'Fälliges Experiment: gut umgesetzt, Zielwert unverändert',
    frage: 'Hat mein Experiment funktioniert?',
    zeilen: schlafUnveraendert,
    massnahmen: [schlafExperiment('exp-ohne-wirkung', 'voll')],
    erwartet: {
      semantisch: [],
      sicherheit: ['niedrig', 'mittel'],
      muss: [],
      darfNicht: [],
      auswertung: { 'exp-ohne-wirkung': ['nicht_wirksam'] },
    },
  }),
  fall({
    id: 'experiment-krankheit',
    titel: 'Fälliges Experiment: Gewicht gesunken, aber in der Krankheitswoche',
    frage: 'Mein Experiment mit weniger Snacks ist fällig. Hat es funktioniert?',
    daten: krankheit.daten,
    zeitreihe: krankheit.zeitreihe,
    massnahmen: [{
      id: 'exp-snacks', action: 'Abends keine Snacks mehr nach dem Abendessen',
      hypothesis: 'Wenn ich abends nicht mehr snacke, sinkt mein Gewicht, weil die Energiezufuhr sinkt.',
      target_metric: 'Gewicht', target_metric_id: 'gewicht', expected_direction: 'sinkt', baseline_note: 'Gewicht im Wochenmittel 86 kg',
      start_date: '2026-09-09', review_date: '2026-09-24', status: 'aktiv', adherence: 'ueberwiegend', outcome: null, source: 'nutzer',
      updated_at: '2026-09-09T20:00:00Z',
    }],
    erwartet: {
      semantisch: [
        { kriterium: 'gewebe_als_tatsache', erwartet: 'nein', zusatz: 'Gemeint ist vor allem ein Fettverlust durch das Experiment.' },
      ],
      sicherheit: ['niedrig', 'mittel'],
      muss: [
        { name: 'nennt die Krankheit als Störgröße', muster: /krank|infekt|erkrank/i },
      ],
      darfNicht: [],
      auswertung: { 'exp-snacks': ['unklar'] },
    },
  }),
  fall({
    id: 'experiment-neu-schlaf',
    titel: 'Neues Experiment für besseren Schlaf',
    frage: 'Wie kann ich meinen Schlaf verbessern?',
    zeilen: schlafMaessig,
    erwartet: {
      semantisch: [],
      sicherheit: ['niedrig', 'mittel', 'hoch'],
      muss: [],
      darfNicht: [],
      neuesExperiment: ['schlafdauer', 'schlafqualitaet', 'morgenenergie'],
    },
  }),
];
