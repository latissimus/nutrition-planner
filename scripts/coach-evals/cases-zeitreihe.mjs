// Testfälle mit Wochenverlauf (Schritt 4: <timeseries>).
//
// Anders als in cases.mjs entstehen Fakten und Verlauf hier aus künstlichen
// Rohdaten - durch denselben Code wie in der Edge Function
// (supabase/functions/capboy-coach/context.ts). So passen beide Blöcke
// zueinander, und die Berechnung selbst wird mitgeprüft. Die Fälle sind ein
// eigener Satz (npm run eval:coach -- --faelle zeitreihe), damit die zwölf
// Standardfälle und ihre Baseline unverändert bleiben.
//
// Aufbau und Erwartungen wie in cases.mjs; zusätzlich trägt jeder Fall
// "zeitreihe", den Block <timeseries>.

import { FETCH_LIMITS, buildCompFacts, buildTimeseries } from '../../supabase/functions/capboy-coach/context.ts';

export const JETZT = new Date('2026-09-26T08:00:00.000Z');

// Datum n Tage vor JETZT (n = 0 ist heute).
const tag = (n) => {
  const datum = new Date(JETZT.getTime());
  datum.setUTCDate(datum.getUTCDate() - n);
  return datum.toISOString().slice(0, 10);
};

// Einzelfalten so verteilt, dass die zehn Summenfalten die gewünschte Summe ergeben.
const ANTEILE = { kinn: 0.08, wange: 0.1, brust: 0.06, trizeps: 0.08, ruecken: 0.14, rippe: 0.1, huefte: 0.13, bauch: 0.18, knie: 0.08, wade: 0.05 };
const falten = (summe) => ({
  ...Object.fromEntries(Object.entries(ANTEILE).map(([slug, anteil]) => [slug, Math.round(summe * anteil * 10) / 10])),
  quadrizeps: 7, beinbizeps: 6.5, bizeps: 4,
});

const UEBUNGEN = [['Kniebeuge', 'legs'], ['Bankdrücken', 'push'], ['Klimmzug', 'pull']];

// Rohdaten über 84 Tage, neueste zuerst, gekürzt wie beim Abruf in der Edge Function.
export function rohdaten({ ziel, kalorienziel, gewicht, ernaehrung, checkin, schlaf, training, faltenMessungen = [], taillenMessungen = [] }) {
  const zeilen = {
    settings: { goal: ziel, custom_calorie_target: kalorienziel, adaptive_target: null, height_cm: 180, birth_date: '1990-03-15', calculation_basis: 'male', bodycomp_thresholds: null },
    weights: [], skinfolds: [], waists: [], performance: [], sleep: [], checkins: [], nutritionEntries: [], dayStatus: [],
    routines: [{ id: 'r1', name: 'Kreatin', period: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6], active: true }],
    // Kreatin gleichmäßig über alle zwölf Wochen (jeden Tag außer einem pro
    // Woche), damit der Verlauf keinen scheinbaren Einnahmebeginn zeigt.
    completions: Array.from({ length: 84 }, (_, n) => n).filter((n) => n % 7 !== 6).map((n) => ({ routine_id: 'r1', completed_on: tag(n) })),
    ruleContext: {},
  };
  for (let n = 0; n < 84; n += 1) {
    const datum = tag(n);
    const kg = gewicht(n);
    if (kg != null) zeilen.weights.push({ gemessen_am: datum, kg });
    const essen = ernaehrung(n);
    if (essen) {
      zeilen.nutritionEntries.push({ log_date: datum, energy_kcal: essen.kcal, protein_g: essen.protein, carbs_g: 250, fat_g: 80 });
      zeilen.dayStatus.push({ log_date: datum, complete: essen.vollstaendig, excluded: false });
    }
    const eintrag = checkin(n);
    if (eintrag) zeilen.checkins.push({ checkin_date: datum, unusual_meals: false, illness: false, travel: false, ...eintrag });
    const nacht = schlaf(n);
    if (nacht) zeilen.sleep.push({ sleep_date: datum, awakenings: 1, tags: [], ...nacht });
    const kraft = training(n);
    if (kraft) UEBUNGEN.forEach(([exercise, category]) => zeilen.performance.push({ performed_on: datum, exercise, category, estimated_1rm: kraft, volume: 4000 }));
  }
  [...faltenMessungen].sort((a, b) => a[0] - b[0]).forEach(([n, summe]) => zeilen.skinfolds.push({ gemessen_am: tag(n), falten: falten(summe), standardisiert: true, messqualitaet: 'gut' }));
  [...taillenMessungen].sort((a, b) => a[0] - b[0]).forEach(([n, cm]) => zeilen.waists.push({ gemessen_am: tag(n), cm, standardisiert: true }));
  for (const [schluessel, grenze] of Object.entries(FETCH_LIMITS)) zeilen[schluessel] = zeilen[schluessel].slice(0, grenze);
  return zeilen;
}

function fall({ zeilen, ...rest }) {
  return { ...rest, daten: buildCompFacts(zeilen, JETZT), zeitreihe: buildTimeseries(zeilen, JETZT) };
}

export const normalerSchlaf = () => ({ bedtime: '23:00', wake_time: '06:45', quality: 3, energy: 3 });
export const normalerCheckin = () => ({ recovery: 3, mood: 3, hunger: 3 });

export const FAELLE_ZEITREIHE = [
  fall({
    id: 'verlauf-reise-stillstand',
    titel: 'Zehn Wochen Abnahme, dann zwei Wochen Stillstand während einer Reise mit lückenhaftem Protokoll',
    frage: 'Mein Gewicht bewegt sich seit zwei Wochen nicht mehr. Soll ich jetzt die Kalorien senken?',
    zeilen: rohdaten({
      ziel: 'fat_loss',
      kalorienziel: 2300,
      // Bis vor zwei Wochen gleichmäßig von 94,0 auf 90,6 kg, seitdem um 90,6 kg.
      gewicht: (n) => (n % 7 === 3 ? null : n >= 14 ? Math.round((90.6 + (n - 14) * 0.05) * 10) / 10 : [90.6, 90.7, 90.5][n % 3]),
      ernaehrung: (n) => (n >= 14
        ? { kcal: 2250, protein: 170, vollstaendig: n % 7 !== 6 }
        : { kcal: [1, 9, 12].includes(n) ? 2350 : 900, protein: 150, vollstaendig: [1, 9, 12].includes(n) }),
      checkin: (n) => ({ ...normalerCheckin(), travel: n >= 8 && n <= 12, unusual_meals: n >= 8 && n <= 11 }),
      schlaf: (n) => ({ ...normalerSchlaf(), quality: n >= 8 && n <= 12 ? 2 : 3 }),
      training: (n) => ([1, 3, 5].includes(n % 7) && !(n >= 8 && n <= 12) ? 100 : null),
      faltenMessungen: [[70, 92], [42, 89], [16, 87]],
      taillenMessungen: [[77, 96], [49, 95], [21, 94], [2, 94]],
    }),
    erwartet: {
      semantisch: [
        { kriterium: 'benennt_datenluecken', erwartet: 'ja', zusatz: 'Gemeint ist vor allem das lückenhafte Ernährungsprotokoll der letzten zwei Wochen.' },
      ],
      sicherheit: ['niedrig', 'mittel'],
      muss: [
        { name: 'bezieht die Reise als Störgröße ein', muster: /reise|urlaub|unterwegs/i },
      ],
      darfNicht: [],
      hinweis: 'Bleibt der Rat bei "jetzt nicht senken, erst vollständig protokollieren"? Eine an Bedingungen geknüpfte spätere Anpassung ist vertretbar.',
    },
  }),
  fall({
    id: 'verlauf-rekomposition',
    titel: 'Zwölf Wochen stabile Waage, sinkende Hautfalten und Taille, steigende Kraft',
    frage: 'Ich trainiere seit drei Monaten, aber die Waage bewegt sich kaum. Bringt das überhaupt etwas?',
    zeilen: rohdaten({
      ziel: 'recomposition',
      kalorienziel: 2600,
      gewicht: (n) => (n % 7 === 2 || n % 7 === 5 ? null : [82.0, 82.1, 81.9][n % 3]),
      ernaehrung: (n) => ({ kcal: 2580, protein: 175, vollstaendig: n % 7 !== 6 }),
      checkin: () => normalerCheckin(),
      schlaf: () => normalerSchlaf(),
      training: (n) => ([0, 2, 4, 6].includes(n % 7) ? Math.round((100 + (83 - n) * 0.1) * 10) / 10 : null),
      faltenMessungen: [[77, 84], [49, 81], [21, 78], [3, 76]],
      taillenMessungen: [[80, 90.5], [52, 89.8], [24, 89], [4, 88.5]],
    }),
    erwartet: {
      semantisch: [
        { kriterium: 'erkennt_rekomposition', erwartet: 'ja' },
        { kriterium: 'empfiehlt_kalorienreduktion', erwartet: 'nein', zusatz: 'Jede Senkung der Kalorien oder Vergrößerung des Defizits zählt.' },
        { kriterium: 'gewebe_als_tatsache', erwartet: 'nein', zusatz: 'Gemeint ist ein Muskelaufbau oder Fettverlust, der als gesichert dargestellt wird.' },
      ],
      sicherheit: ['mittel', 'hoch'],
      muss: [
        { name: 'bezieht Falten, Taille oder Kraft ein', muster: /hautfalt|faltensumme|taille|kraft|leistung/i },
      ],
      darfNicht: [],
    },
  }),
  fall({
    id: 'verlauf-krankheit',
    titel: 'Gewichtsabfall in einer Krankheitswoche nach langem stabilem Verlauf',
    frage: 'Ich habe in den letzten zwei Wochen deutlich abgenommen. Verliere ich endlich Fett?',
    zeilen: rohdaten({
      ziel: 'fat_loss',
      kalorienziel: 2400,
      // Lange um 86 kg, in der Krankheitswoche auf gut 84,7 kg, zuletzt 85,3 kg.
      gewicht: (n) => (n % 7 === 4 ? null : n <= 5 ? 85.3 : n <= 12 ? [84.8, 84.6, 84.9][n % 3] : Math.round((86 + (n - 13) * 0.01) * 10) / 10),
      ernaehrung: (n) => ({ kcal: n >= 7 && n <= 11 ? 1400 : 2350, protein: n >= 7 && n <= 11 ? 90 : 160, vollstaendig: n % 7 !== 6 }),
      checkin: (n) => (n >= 7 && n <= 11 ? { recovery: 1, mood: 2, hunger: 1, illness: true } : normalerCheckin()),
      schlaf: (n) => (n >= 7 && n <= 11 ? { bedtime: '21:30', wake_time: '08:00', quality: 2, energy: 1 } : normalerSchlaf()),
      training: (n) => ([1, 3, 5].includes(n % 7) && !(n >= 6 && n <= 12) ? 110 : null),
      faltenMessungen: [[60, 80], [30, 79]],
      taillenMessungen: [[62, 91], [33, 90.5]],
    }),
    erwartet: {
      semantisch: [
        { kriterium: 'gewebe_als_tatsache', erwartet: 'nein', zusatz: 'Gemeint ist vor allem ein Fettverlust.' },
      ],
      sicherheit: ['niedrig', 'mittel'],
      muss: [
        { name: 'erkennt die Krankheit als Störgröße', muster: /krank|infekt|erkrank/i },
      ],
      darfNicht: [],
    },
  }),
];
