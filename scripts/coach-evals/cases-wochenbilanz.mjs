// Testfälle für den Wochen-Check-in (Schritt 7).
//
// Fakten, Verlauf, Maßnahmen-Block und weeklyCheckin entstehen aus Rohdaten
// durch denselben Code wie in der Edge Function (context.ts, memory.ts,
// weekly.ts) und werden in <timeseries> eingefügt.
// Heute ist Samstag, der 26.09.2026: Bilanziert wird
// die abgeschlossene KW 38 (14.–20.09.) gegen KW 37. Die Frage ist die, die
// die App stellt (weeklyQuestion). Eigener Fallsatz:
// npm run eval:coach -- --faelle wochenbilanz
//
// Zusätzliche Erwartungen (checks.mjs, wochenPruefungen):
//   keinNeuesExperiment  true: kein neues Experiment in dieser Woche
//   nichtImBereich       [Zielgrößen], für die kein neues Experiment starten darf

import { FAELLE_ZEITREIHE, JETZT, normalerCheckin, normalerSchlaf, rohdaten } from './cases-zeitreihe.mjs';
import { buildCompFacts, buildTimeseries } from '../../supabase/functions/capboy-coach/context.ts';
import { interventionBlock } from '../../supabase/functions/capboy-coach/memory.ts';
import { weeklyBlock, weeklyQuestion } from '../../supabase/functions/capboy-coach/weekly.ts';

const HEUTE = JETZT.toISOString().slice(0, 10);

function fall({ zeilen, daten, zeitreihe, massnahmen = [], bericht = {}, vorwoche = null, ...rest }) {
  const verlauf = zeitreihe || buildTimeseries(zeilen, JETZT);
  const block = interventionBlock(massnahmen, HEUTE, verlauf);
  const wochenbericht = {
    ...bericht,
    interventions: massnahmen.map((massnahme) => ({ id: massnahme.id, adherence: massnahme.adherence })),
  };
  const wochenbilanz = weeklyBlock(verlauf, wochenbericht, vorwoche, massnahmen);
  return {
    ...rest,
    frage: weeklyQuestion(wochenbilanz.week),
    daten: daten || buildCompFacts(zeilen, JETZT),
    zeitreihe: verlauf,
    gedaechtnis: block ? { intervention_log: block } : {},
    wochenbilanz,
  };
}

const normal = (werte = {}) => rohdaten({
  ziel: 'recomposition',
  kalorienziel: 2600,
  gewicht: (n) => (n % 7 === 3 ? null : [82.0, 82.1, 81.9][n % 3]),
  ernaehrung: (n) => ({ kcal: 2550, protein: 170, vollstaendig: n % 7 !== 6 }),
  checkin: () => normalerCheckin(),
  schlaf: () => normalerSchlaf(),
  training: (n) => ([1, 3, 5].includes(n % 7) ? 100 : null),
  faltenMessungen: [[60, 80], [30, 79], [5, 78]],
  taillenMessungen: [[62, 90], [33, 89.5], [6, 89]],
  ...werte,
});

const krankheit = FAELLE_ZEITREIHE.find((kandidat) => kandidat.id === 'verlauf-krankheit');

export const FAELLE_WOCHENBILANZ = [
  fall({
    id: 'wochenbilanz-experiment-faellig',
    titel: 'Wochenbilanz mit fälligem Experiment und Fokus der Vorwoche',
    // Schlafqualität 2 vor dem Start (2. September), danach 4.
    zeilen: normal({ schlaf: (n) => ({ ...normalerSchlaf(), quality: n > 24 ? 2 : 4, energy: n > 24 ? 2 : 4 }) }),
    massnahmen: [{
      id: 'exp-abendessen', action: 'Letzte größere Mahlzeit spätestens drei Stunden vor dem Schlafen',
      hypothesis: 'Wenn ich früher esse, schlafe ich besser.',
      target_metric: 'Schlafqualität', target_metric_id: 'schlafqualitaet', expected_direction: 'steigt', baseline_note: 'Schlafqualität 2 von 5',
      // Im Check-in eben auf "voll" gesetzt.
      start_date: '2026-09-02', review_date: '2026-09-23', status: 'aktiv', adherence: 'voll', outcome: null, source: 'coach_empfehlung',
      updated_at: '2026-09-26T07:59:00Z',
    }],
    vorwoche: { week: '2026-W37', result: { recommendations: [{ action: 'Auch am Wochenende jeden Tag vollständig protokollieren' }] } },
    erwartet: {
      semantisch: [
        { kriterium: 'behauptet_erinnerung', erwartet: 'nein', zusatz: 'Der Fokus der Vorwoche steht im mitgelieferten Wochen-Check-in (previousReview); ihn wiederzugeben ist keine Erinnerung an ein früheres Gespräch.' },
      ],
      sicherheit: ['niedrig', 'mittel', 'hoch'],
      muss: [],
      darfNicht: [],
      auswertung: { 'exp-abendessen': ['wirksam'] },
      hinweis: 'Geht die Bilanz auf den Fokus der Vorwoche ein (vollständig protokollieren: 6 von 7 Tagen) und wertet sie das Experiment aus der Messung aus?',
    },
  }),
  fall({
    id: 'wochenbilanz-krank',
    titel: 'Wochenbilanz einer Krankheitswoche mit Gewichtsabfall',
    daten: krankheit.daten,
    zeitreihe: krankheit.zeitreihe,
    bericht: { circumstances: ['krank'], note: 'Erkältung von Dienstag bis Samstag' },
    erwartet: {
      semantisch: [
        { kriterium: 'gewebe_als_tatsache', erwartet: 'nein', zusatz: 'Gemeint ist vor allem ein Fettverlust in der Krankheitswoche.' },
      ],
      sicherheit: ['niedrig', 'mittel'],
      muss: [
        { name: 'nennt die Krankheit als Störgröße', muster: /krank|erkält|infekt|erkrank/i },
      ],
      darfNicht: [],
      keinNeuesExperiment: true,
    },
  }),
  fall({
    id: 'wochenbilanz-luecken',
    titel: 'Wochenbilanz mit lückenhafter Protokollierung',
    // KW 38 (n = 6 bis 12): nur ein vollständiger Ernährungstag, eine Wiegung.
    zeilen: normal({
      gewicht: (n) => (n >= 6 && n <= 12 ? (n === 8 ? 82.0 : null) : n % 7 === 3 ? null : [82.0, 82.1, 81.9][n % 3]),
      ernaehrung: (n) => ({ kcal: 2550, protein: 170, vollstaendig: n >= 6 && n <= 12 ? n === 9 : n % 7 !== 6 }),
    }),
    erwartet: {
      semantisch: [
        { kriterium: 'benennt_datenluecken', erwartet: 'ja' },
      ],
      sicherheit: ['niedrig', 'mittel'],
      muss: [],
      darfNicht: [],
      nichtImBereich: ['kalorien', 'protein'],
    },
  }),
  fall({
    id: 'wochenbilanz-experiment-laeuft',
    titel: 'Wochenbilanz mit laufendem Schlaf-Experiment in einer Stresswoche',
    zeilen: normal({
      checkin: () => ({ recovery: 2, mood: 2, hunger: 3 }),
      schlaf: (n) => ({ bedtime: n % 3 === 0 ? '00:40' : '23:30', wake_time: '06:15', quality: 2, energy: 2 }),
    }),
    massnahmen: [{
      id: 'exp-bildschirm', action: 'Ab 22 Uhr keine Bildschirme mehr',
      hypothesis: 'Wenn ich abends auf Bildschirme verzichte, schlafe ich besser.',
      target_metric: 'Schlafqualität', target_metric_id: 'schlafqualitaet', expected_direction: 'steigt', baseline_note: 'Schlafqualität 2 von 5',
      start_date: '2026-09-14', review_date: '2026-10-05', status: 'aktiv', adherence: 'teilweise', outcome: null, source: 'coach_empfehlung',
      updated_at: '2026-09-26T07:59:00Z',
    }],
    bericht: { circumstances: ['stress'], note: 'Projektabgabe, viele Überstunden' },
    erwartet: {
      semantisch: [],
      sicherheit: ['niedrig', 'mittel', 'hoch'],
      muss: [
        { name: 'nennt den Stress als Störgröße', muster: /stress|überstunden|projekt/i },
      ],
      darfNicht: [],
      nichtImBereich: ['schlafdauer', 'schlafqualitaet', 'morgenenergie'],
      hinweis: 'Das Experiment ist erst am 05.10. fällig: keine Auswertung, kein zweites Schlaf-Experiment.',
    },
  }),
];
