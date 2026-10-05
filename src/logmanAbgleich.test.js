import { describe, expect, it } from 'vitest';
import { betroffeneTage, ohneFremdeZeilen, veralteteLeistung } from '../supabase/functions/logman-abgleich/umrechnung.js';

// Gelöschte Sätze in LOGMAN dürfen in CAPBOY nicht als Leistung stehen bleiben;
// der Verlauf früherer Phasen und manuelle Importe bleiben aber erhalten.
const zeile = (performed_on, exercise, source = 'LOGMAN-Abgleich', id = `${performed_on}-${exercise}`) => ({
  id, performed_on, exercise, category: 'HEAVYS', source,
});

describe('LOGMAN-Abgleich: betroffene Tage', () => {
  it('nimmt die Tage datierter Einheiten aus altem und neuem Stand, LOGMAN-Datum vor erstem Sehen', () => {
    expect(betroffeneTage({
      altGesehen: { 'OK-H|1': '2026-10-01', 'UK-H|1': null },
      neuGesehen: { 'OK-H|1': '2026-10-01', 'UK-H|1': null, 'OK-P|1': '2026-10-03' },
      neuDatum: { 'UK-H|1': '2026-10-02' },
    })).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('nennt den Tag einer ganz gelöschten Einheit (nur im alten Stand)', () => {
    expect(betroffeneTage({ altGesehen: { 'OK-H|2': '2026-10-02' }, neuGesehen: {} })).toEqual(['2026-10-02']);
  });

  it('lässt nach einem Phasen-Reset alles stehen', () => {
    expect(betroffeneTage({
      altGesehen: { 'OK-H|1': '2026-09-20' }, altReset: '2026-09-01T10:00:00.000Z',
      neuGesehen: {}, neuReset: '2026-10-03T08:00:00.000Z',
    })).toEqual([]);
  });

  it('ignoriert Einheiten ohne Datum (vor der Kopplung)', () => {
    expect(betroffeneTage({ altGesehen: { 'OK-H|1': null }, neuGesehen: { 'OK-H|1': null } })).toEqual([]);
  });
});

describe('LOGMAN-Abgleich: veraltete Leistungszeilen', () => {
  const vorhanden = [
    zeile('2026-10-02', 'LH Flachbankdrücken'),
    zeile('2026-10-02', 'KH Fliegende'),
    zeile('2026-10-02', 'Kabelzug', 'LOGMAN-Import'),
    zeile('2026-09-20', 'LH Kniebeugen'),
  ];

  it('entfernt Übungen, deren Sätze gelöscht wurden', () => {
    const neu = [{ performed_on: '2026-10-02', exercise: 'LH Flachbankdrücken', category: 'HEAVYS' }];
    expect(veralteteLeistung(vorhanden, neu, ['2026-10-02']).map((z) => z.exercise)).toEqual(['KH Fliegende']);
  });

  it('entfernt alles eines betroffenen Tages, wenn die Einheit ganz gelöscht wurde', () => {
    expect(veralteteLeistung(vorhanden, [], ['2026-10-02']).map((z) => z.exercise)).toEqual(['LH Flachbankdrücken', 'KH Fliegende']);
  });

  it('lässt manuelle Importe und nicht betroffene Tage stehen', () => {
    const veraltet = veralteteLeistung(vorhanden, [], ['2026-10-02']);
    expect(veraltet.some((z) => z.source === 'LOGMAN-Import')).toBe(false);
    expect(veraltet.some((z) => z.performed_on === '2026-09-20')).toBe(false);
  });

  it('entfernt nichts, wenn der Stand unverändert ist', () => {
    const neu = vorhanden.filter((z) => z.source === 'LOGMAN-Abgleich').map(({ performed_on, exercise, category }) => ({ performed_on, exercise, category }));
    expect(veralteteLeistung(vorhanden, neu, ['2026-10-02', '2026-09-20'])).toEqual([]);
  });
});

describe('LOGMAN-Abgleich: manuelle Importe schützen', () => {
  const neu = [
    { performed_on: '2026-10-02', exercise: 'Kabelzug', category: 'HEAVYS', estimated_1rm: 60 },
    { performed_on: '2026-10-02', exercise: 'LH Flachbankdrücken', category: 'HEAVYS', estimated_1rm: 110 },
    { performed_on: '2026-10-02', exercise: 'Kabelzug', category: 'MIDDLES', estimated_1rm: 50 },
  ];

  it('schreibt keinen Schlüssel, der schon eine Zeile aus anderer Quelle hat', () => {
    const vorhanden = [zeile('2026-10-02', 'Kabelzug', 'LOGMAN-Import'), zeile('2026-10-02', 'LH Flachbankdrücken')];
    expect(ohneFremdeZeilen(neu, vorhanden).map((z) => `${z.exercise}|${z.category}`))
      .toEqual(['LH Flachbankdrücken|HEAVYS', 'Kabelzug|MIDDLES']);
  });

  it('behandelt Zeilen ohne Quelle wie manuelle und lässt andere Tage frei', () => {
    expect(ohneFremdeZeilen(neu, [zeile('2026-10-02', 'Kabelzug', null)])).toHaveLength(2);
    expect(ohneFremdeZeilen(neu, [zeile('2026-10-01', 'Kabelzug', 'LOGMAN-Import')])).toHaveLength(3);
  });
});
