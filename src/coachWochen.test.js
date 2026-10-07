import { describe, expect, it } from 'vitest';
import {
  volumenFuerKi, wochenBereinigen, wochenSchema, wochenSystemPrompt, wochenText, wochenUserPrompt,
} from '../supabase/functions/capboy-coach/wochenCoaching.ts';
import { COACHING_GRENZEN, coachingSystemPrompt } from '../supabase/functions/capboy-coach/coaching.ts';
import { BEIBEHALTEN } from '../supabase/functions/capboy-coach/volumen.js';

const AKTIONEN = [
  BEIBEHALTEN,
  { id: 'plus1:Brust', art: 'erhoehen', muskel: 'Brust', text: 'LOGMAN: Priorität Brust auf „plus“ mit 1 Satz stellen.' },
];
const antwort = (aenderung = {}) => ({
  ueberschrift: 'Brust steht still – plus 1 Satz', punkte: [{ bereich: 'training', text: 'Bankdrücken seit drei Einheiten bei 101,3 kg.' }],
  experimente: [], volumen: { aktion: 'plus1:Brust', begruendung: 'Stillstand bei guter Erholung.' }, neuesExperiment: [],
  fokus: { bereich: 'training', text: 'Priorität Brust in LOGMAN setzen.' }, datenlage: 'mittel', ...aenderung,
});

describe('Wochen-Coaching: Schema und Prompt', () => {
  it('lässt als Volumen-Aktion nur die erlaubten IDs zu', () => {
    expect(wochenSchema(['beibehalten', 'plus1:Brust']).properties.volumen.properties.aktion.enum).toEqual(['beibehalten', 'plus1:Brust']);
    expect(wochenSchema([]).properties.volumen.properties.aktion.enum).toEqual(['beibehalten']);
    expect(wochenSchema(['beibehalten']).properties.neuesExperiment.maxItems).toBe(1);
  });

  it('hat dieselben Grenzen wie das Tages-Coaching und die Volumen-Regeln', () => {
    const prompt = wochenSystemPrompt();
    expect(prompt).toContain(COACHING_GRENZEN);
    expect(coachingSystemPrompt()).toContain(COACHING_GRENZEN);
    expect(prompt).toContain('If "sperren" is not empty, the only choice is "beibehalten"');
    expect(prompt).toContain('Never propose any other volume lever');
    expect(prompt).toContain('a volume change counts as this week\'s training experiment');
    // Kein Füllstoff „Repräsentative Woche: …“ (Live-Fallsatz 07.10.): nur erwähnen, wenn sie es nicht ist.
    expect(prompt).toContain('Mention representativeness only when the week is not representative');
    expect(prompt).not.toContain('and whether the week is representative');
  });

  it('bettet Wochenvergleich, Training und Volumen ohne interne Felder ein', () => {
    const volumen = {
      stand: { cycle: 3 }, sperren: [], zyklen: [2, 3],
      grundlage: { erholung: 'gut' },
      muskeln: [{ muskel: 'Brust', haelfte: 'OK', bewertung: 'erhoehen', leistung: 'stagniert', erfuellung: [1, 1], gruende: ['x'] }],
      aktionen: AKTIONEN,
    };
    expect(volumenFuerKi(volumen)).toEqual({
      sperren: [], grundlage: { erholung: 'gut' },
      muskeln: [{ muskel: 'Brust', bewertung: 'erhoehen', leistung: 'stagniert', gruende: ['x'] }],
      aktionen: AKTIONEN.map(({ id, text }) => ({ id, text })),
    });
    const prompt = wochenUserPrompt({ snapshot: {}, timeseries: { weeks: [] }, weekly: { week: '2026-W40' }, training: { stand: {} }, volumen, vortag: null, memory: {}, heute: '2026-10-05' });
    expect(prompt).toContain('"weeklyCheckin":{"week":"2026-W40"}');
    expect(prompt).toContain('"volumen":{"sperren":[]');
    expect(prompt).not.toContain('"haelfte"');
    expect(prompt).toContain('Erstelle das Wochen-Coaching für 2026-W40 (heute ist 2026-10-05).');
  });
});

describe('Wochen-Coaching: Antwort bereinigen', () => {
  it('übernimmt eine erlaubte Volumen-Aktion und markiert Training', () => {
    const ergebnis = wochenBereinigen(antwort(), { aktionen: AKTIONEN });
    expect(ergebnis.volumen.aktion.id).toBe('plus1:Brust');
    expect(ergebnis.bereiche).toEqual(['training']);
  });

  it('macht aus einer Aktion außerhalb der Liste „beibehalten“', () => {
    const ergebnis = wochenBereinigen(antwort({ volumen: { aktion: 'plus2:Brust', begruendung: 'mehr' } }), { aktionen: AKTIONEN });
    expect(ergebnis.volumen.aktion).toBe(BEIBEHALTEN);
  });

  it('nimmt Urteile nur zu fälligen Experimenten, je eines', () => {
    const urteil = (id) => ({ experimentId: id, verdict: 'unklar', decision: 'beibehalten', basis: 'Messung unvollständig.' });
    const ergebnis = wochenBereinigen(antwort({ experimente: [urteil('a'), urteil('a'), urteil('b')] }), { aktionen: AKTIONEN, faellige: [{ id: 'a' }] });
    expect(ergebnis.experimente.map((eintrag) => eintrag.experimentId)).toEqual(['a']);
    expect(ergebnis.experimente[0].ergaenzt).toBeUndefined();
  });

  it('ergänzt ein fehlendes oder ungültiges Urteil sichtbar als „unklar, nicht bewertet“', () => {
    const faellige = [{ id: 'a', measurement: 'Schlafdauer: 425 min → 440 min, Veränderung +15 min', adherence: 'ueberwiegend' }, { id: 'c' }];
    const ergebnis = wochenBereinigen(antwort({ experimente: [{ experimentId: 'c', verdict: 'super', decision: 'beibehalten', basis: 'x' }] }), { aktionen: AKTIONEN, faellige });
    expect(ergebnis.experimente).toEqual([
      { experimentId: 'a', verdict: 'unklar', decision: 'beibehalten', ergaenzt: true, basis: 'Vom Wochen-Coaching nicht bewertet – bitte selbst prüfen. Schlafdauer: 425 min → 440 min, Veränderung +15 min Umsetzung: ueberwiegend.' },
      { experimentId: 'c', verdict: 'unklar', decision: 'beibehalten', ergaenzt: true, basis: 'Vom Wochen-Coaching nicht bewertet – bitte selbst prüfen.' },
    ]);
  });

  it('nimmt höchstens ein neues Experiment und keine Sicherheits-Empfehlung', () => {
    const experiment = { kind: 'experiment', action: 'Schlafenszeit 23 Uhr', rationale: 'r', timeframe: '14 Tage', hypothesis: 'Wenn …', baseline: '6,5 h (KW 40)', targetMetric: 'schlafdauer', expectedDirection: 'steigt', reviewDate: '2026-10-19' };
    const regeln = { aktionen: AKTIONEN, heute: '2026-10-05' };
    expect(wochenBereinigen(antwort({ neuesExperiment: [experiment, experiment] }), regeln).neuesExperiment).toHaveLength(1);
    expect(wochenBereinigen(antwort({ neuesExperiment: [{ ...experiment, kind: 'sicherheit' }] }), regeln).neuesExperiment).toEqual([]);
    expect(wochenBereinigen(antwort({ neuesExperiment: [{ ...experiment, targetMetric: 'erfunden' }] }), regeln).neuesExperiment).toEqual([]);
  });

  it('prüft ein neues Experiment deterministisch vor dem Speichern', () => {
    const schlaf = { kind: 'experiment', action: 'Schlafenszeit 23 Uhr', rationale: 'r', timeframe: '14 Tage, Abbruch bei …', hypothesis: 'Wenn ich um 23 Uhr schlafe, steigt die Schlafdauer, weil …', baseline: '425 min (2026-W40)', targetMetric: 'schlafdauer', expectedDirection: 'steigt', reviewDate: '2026-10-19' };
    const regeln = { aktionen: AKTIONEN, heute: '2026-10-05' };
    const ohneVolumen = (eintrag, mehr = {}) => wochenBereinigen(antwort({ volumen: { aktion: 'beibehalten', begruendung: '' }, neuesExperiment: [eintrag] }), { ...regeln, ...mehr });
    expect(ohneVolumen(schlaf).neuesExperiment).toHaveLength(1);
    // Prüfdatum: mindestens 14 Tage, bei Hautfalten, Taille und Kraft 21 Tage, höchstens 56.
    expect(ohneVolumen({ ...schlaf, reviewDate: '2026-10-12' }).verworfen.join()).toContain('Prüfdatum');
    expect(ohneVolumen({ ...schlaf, targetMetric: 'faltensumme', expectedDirection: 'sinkt', reviewDate: '2026-10-19' }).neuesExperiment).toEqual([]);
    expect(ohneVolumen({ ...schlaf, targetMetric: 'faltensumme', expectedDirection: 'sinkt', reviewDate: '2026-10-26' }).neuesExperiment).toHaveLength(1);
    expect(ohneVolumen({ ...schlaf, reviewDate: '2026-12-31' }).neuesExperiment).toEqual([]);
    // Nicht repräsentative Woche, laufendes Experiment im selben Bereich, fehlende Hypothese.
    expect(ohneVolumen(schlaf, { nichtRepraesentativ: true }).verworfen.join()).toContain('nicht repräsentativ');
    expect(ohneVolumen(schlaf, { laufendeMetriken: ['schlafqualitaet'] }).verworfen.join()).toContain('im Bereich schlaf läuft schon');
    expect(ohneVolumen(schlaf, { laufendeMetriken: ['protein'] }).neuesExperiment).toHaveLength(1);
    expect(ohneVolumen({ ...schlaf, hypothesis: '' }).neuesExperiment).toEqual([]);
    // „Beobachten“ ist auch in einer nicht repräsentativen Woche erlaubt.
    expect(ohneVolumen({ ...schlaf, kind: 'beobachtung', reviewDate: '' }, { nichtRepraesentativ: true }).neuesExperiment[0]).toMatchObject({ kind: 'beobachtung', hypothesis: '', reviewDate: '', expectedDirection: 'keine' });
  });

  it('kein zweites Trainingsexperiment neben einer Volumenänderung', () => {
    const kraft = { kind: 'experiment', action: 'Pausen 3 Minuten', rationale: 'r', timeframe: '4 Wochen', hypothesis: 'Wenn …', baseline: '101,3 kg (Zyklus 4)', targetMetric: 'kraft', expectedDirection: 'steigt', reviewDate: '2026-10-30' };
    const mitAenderung = wochenBereinigen(antwort({ neuesExperiment: [kraft] }), { aktionen: AKTIONEN, heute: '2026-10-05' });
    expect(mitAenderung.volumen.aktion.id).toBe('plus1:Brust');
    expect(mitAenderung.neuesExperiment).toEqual([]);
    expect(mitAenderung.verworfen.join()).toContain('schon das Trainingsexperiment');
    const ohneAenderung = wochenBereinigen(antwort({ volumen: { aktion: 'beibehalten', begruendung: '' }, neuesExperiment: [kraft] }), { aktionen: AKTIONEN, heute: '2026-10-05' });
    expect(ohneAenderung.neuesExperiment).toHaveLength(1);
  });

  it('speichert keine leere Karte', () => {
    expect(() => wochenBereinigen(antwort({ punkte: [] }), { aktionen: AKTIONEN })).toThrow('Coaching-Antwort');
  });

  it('fasst das Wochen-Coaching fürs Gesprächsgedächtnis zusammen', () => {
    const text = wochenText(wochenBereinigen(antwort(), { aktionen: AKTIONEN }));
    expect(text).toContain('Wochen-Coaching: Brust steht still');
    expect(text).toContain('Volumen: LOGMAN: Priorität Brust');
    expect(text).toContain('Fokus der Woche: Priorität Brust in LOGMAN setzen.');
  });
});
