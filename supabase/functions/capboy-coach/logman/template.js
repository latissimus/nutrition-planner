// LOGMAN-Trainingsvorlage v4 — rollierender OK/UK-Split in CYCLES.
//
// Ein CYCLE besteht aus:
//   OK HEAVYS -> UK HEAVYS -> OK MIDDLES & PUMPS -> UK MIDDLES & PUMPS
//
// sets: [Level I, Level II, Level III]. Level II bildet den Standardplan aus
// LOGMAN-Training.md exakt ab. Level I reduziert die Dosis. Level III startet
// ebenfalls mit dem Standardplan; Zusatzsätze werden dort gezielt je Übung
// gewählt. Jede Tabellenzeile bleibt ein eigener Block, damit Wiederholungen,
// RIR und Pausen exakt zur Übung passen.

const feld = (rolle, konten) => ({ r: rolle, n: '', konten });

export const TPL = {
  'OK-H': {
    short: 'OK · HEAVYS',
    sub: 'Oberkörper · HEAVYS',
    blocks: [
      { id: 'chest_comp', mus: 'Brust', konten: ['Brust'], type: 'load', sets: [2, 2, 2], rest: 180, reps: '6–10', rir: '0–1 RIR', ex: [feld('Comp', ['Brust'])] },
      { id: 'chest_iso', mus: 'Brust', konten: ['Brust'], type: 'load', sets: [1, 2, 2], rest: 150, reps: '6–10', rir: '0–1 RIR', ex: [feld('Iso', ['Brust'])] },
      { id: 'back_thick', mus: 'Rücken · Dicke', konten: ['Oberer Rücken'], type: 'load', sets: [2, 2, 2], rest: 180, reps: '6–10', rir: '0–1 RIR', ex: [feld('Comp', ['Oberer Rücken'])] },
      { id: 'back_wide', mus: 'Rücken · Weite', konten: ['Lat'], type: 'load', sets: [1, 2, 2], rest: 180, reps: '6–10', rir: '0–1 RIR', ex: [feld('Comp', ['Lat'])] },
      { id: 'delt_iso', mus: 'Seitl./Hint. Schulter', konten: ['Seitliche Schulter', 'Hintere Schulter'], type: 'load', sets: [2, 2, 2], rest: 150, reps: '6–10', rir: '0–1 RIR', ex: [feld('Iso', ['Seitliche Schulter', 'Hintere Schulter'])] },
      { id: 'biceps_iso', mus: 'Bizeps', konten: ['Bizeps'], type: 'load', sets: [1, 2, 2], rest: 150, reps: '6–10', rir: '0–1 RIR', ex: [feld('Iso', ['Bizeps'])] },
      { id: 'triceps_iso', mus: 'Trizeps', konten: ['Trizeps'], type: 'load', sets: [1, 2, 2], rest: 150, reps: '6–10', rir: '0–1 RIR', ex: [feld('Iso', ['Trizeps'])] },
    ],
  },
  'UK-H': {
    short: 'UK · HEAVYS',
    sub: 'Unterkörper · HEAVYS',
    blocks: [
      { id: 'legs_comp', mus: 'Beine', konten: ['Quads', 'Glutes'], type: 'load', sets: [2, 2, 2], rest: 180, reps: '6–10', rir: '0–1 RIR', ex: [feld('Comp', ['Quads', 'Glutes'])] },
      { id: 'quads_iso', mus: 'Quads', konten: ['Quads'], type: 'load', sets: [1, 2, 2], rest: 150, reps: '6–10', rir: '0–1 RIR', ex: [feld('Iso', ['Quads'])] },
      { id: 'hams_glutes_iso', mus: 'Hams/Glutes', konten: ['Hams', 'Glutes'], type: 'load', sets: [1, 2, 2], rest: 150, reps: '6–10', rir: '0–1 RIR', ex: [feld('Iso', ['Hams', 'Glutes'])] },
      { id: 'calves_iso', mus: 'Waden', konten: ['Waden'], type: 'load', sets: [3, 3, 3], rest: 120, reps: '6–10', rir: '0–1 RIR', ex: [feld('Iso', ['Waden'])] },
      { id: 'abs_iso', mus: 'Abs', konten: ['Abs'], type: 'load', sets: [2, 2, 2], rest: 120, reps: '6–10', rir: '0–1 RIR', ex: [feld('Iso', ['Abs'])] },
    ],
  },
  'OK-P': {
    short: 'OK · MIDDLES & PUMPS',
    sub: 'Oberkörper · MIDDLES & PUMPS',
    blocks: [
      { id: 'chest_comp', mus: 'Brust', konten: ['Brust'], type: 'middle', sets: [2, 2, 2], rest: 150, reps: '10–15', rir: '0–2 RIR', ex: [feld('Comp', ['Brust'])] },
      { id: 'chest_iso', mus: 'Brust', konten: ['Brust'], type: 'pump', sets: [1, 2, 2], rest: 90, reps: '15–20', rir: '0–1 RIR', free: 1, ex: [feld('Iso', ['Brust'])] },
      { id: 'back_thick', mus: 'Rücken · Dicke', konten: ['Oberer Rücken'], type: 'middle', sets: [2, 2, 2], rest: 150, reps: '10–15', rir: '0–2 RIR', ex: [feld('Comp', ['Oberer Rücken'])] },
      { id: 'back_wide', mus: 'Rücken · Weite', konten: ['Lat'], type: 'middle', sets: [1, 2, 2], rest: 150, reps: '10–15', rir: '0–2 RIR', ex: [feld('Comp', ['Lat'])] },
      { id: 'delt_iso', mus: 'Seitl./Hint. Schulter', konten: ['Seitliche Schulter', 'Hintere Schulter'], type: 'pump', sets: [2, 2, 2], rest: 90, reps: '15–20', rir: '0–1 RIR', free: 1, ex: [feld('Iso', ['Seitliche Schulter', 'Hintere Schulter'])] },
      { id: 'biceps_iso', mus: 'Bizeps', konten: ['Bizeps'], type: 'middle', sets: [1, 2, 2], rest: 120, reps: '10–15', rir: '0–2 RIR', ex: [feld('Iso', ['Bizeps'])] },
      { id: 'triceps_iso', mus: 'Trizeps', konten: ['Trizeps'], type: 'middle', sets: [1, 2, 2], rest: 120, reps: '10–15', rir: '0–2 RIR', ex: [feld('Iso', ['Trizeps'])] },
    ],
  },
  'UK-P': {
    short: 'UK · MIDDLES & PUMPS',
    sub: 'Unterkörper · MIDDLES & PUMPS',
    blocks: [
      { id: 'legs_comp', mus: 'Beine', konten: ['Quads', 'Glutes'], type: 'middle', sets: [2, 2, 2], rest: 150, reps: '10–15', rir: '0–2 RIR', ex: [feld('Comp', ['Quads', 'Glutes'])] },
      { id: 'quads_iso', mus: 'Quads', konten: ['Quads'], type: 'pump', sets: [1, 2, 2], rest: 120, reps: '15–20', rir: '0–1 RIR', free: 1, ex: [feld('Iso', ['Quads'])] },
      { id: 'hams_glutes_iso', mus: 'Hams/Glutes', konten: ['Hams', 'Glutes'], type: 'pump', sets: [1, 2, 2], rest: 120, reps: '15–20', rir: '0–1 RIR', free: 1, ex: [feld('Iso', ['Hams', 'Glutes'])] },
      { id: 'calves_iso', mus: 'Waden', konten: ['Waden'], type: 'pump', sets: [3, 3, 3], rest: 90, reps: '15–20', rir: '0–1 RIR', free: 1, ex: [feld('Iso', ['Waden'])] },
      { id: 'abs_iso', mus: 'Abs', konten: ['Abs'], type: 'pump', sets: [2, 2, 2], rest: 90, reps: '15–20', rir: '0–1 RIR', free: 1, ex: [feld('Iso', ['Abs'])] },
    ],
  },
};

// Deload: dieselben HEAVYS-Übungen, ungefähr 50 % der Standardsätze, 3–5 RIR.
// nameSource sorgt dafür, dass keine Übungen ein zweites Mal gewählt werden.
TPL['OK-D'] = {
  short: 'OK · DELOAD',
  sub: 'Oberkörper · Deload',
  nameSource: 'OK-H',
  blocks: TPL['OK-H'].blocks.map((b) => ({
    ...b,
    sets: [Math.ceil(b.sets[1] / 2), Math.ceil(b.sets[1] / 2), Math.ceil(b.sets[1] / 2)],
    rir: '3–5 RIR',
    deload: 1,
  })),
};
TPL['UK-D'] = {
  short: 'UK · DELOAD',
  sub: 'Unterkörper · Deload',
  nameSource: 'UK-H',
  blocks: TPL['UK-H'].blocks.map((b) => ({
    ...b,
    sets: [Math.ceil(b.sets[1] / 2), Math.ceil(b.sets[1] / 2), Math.ceil(b.sets[1] / 2)],
    rir: '3–5 RIR',
    deload: 1,
  })),
};

// Alte Logs werden beim Wechsel auf Schema v4 bewusst geleert. LEGACY bleibt
// als leerer Export bestehen, damit der Import in log.js stabil bleibt.
export const LEGACY = {};
export const TIER_NAMES = ['I', 'II', 'III'];
export const CYCLE_TAGE = ['OK-H', 'UK-H', 'OK-P', 'UK-P'];
export const DELOAD_TAGE = ['OK-D', 'UK-D'];
