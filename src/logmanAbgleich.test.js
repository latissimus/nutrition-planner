import { describe, expect, it } from 'vitest';
import { betroffeneTage, einheitenDatieren, einheitenVormerken, ohneFremdeZeilen, veralteteLeistung } from '../supabase/functions/logman-abgleich/umrechnung.js';
import { abgleichSchreiben } from '../supabase/functions/logman-abgleich/schreibreihenfolge.js';

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

describe('LOGMAN-Abgleich: Schreibreihenfolge bei Fehlern', () => {
  // Kleiner Speicher wie in der Datenbank: Spiegel-Version (daran erkennt der
  // nächste Abgleich „unverändert“) und Leistungszeilen. LOGMAN steht auf 134.
  const lauf = (speicher, fehlerBei = '') => abgleichSchreiben({
    datenVormerken: async () => { speicher.schritte.push('vormerken'); },
    veralteteEntfernen: async () => {
      speicher.schritte.push('entfernen');
      if (fehlerBei === 'entfernen') throw new Error('Leistung bereinigen: Zeitüberschreitung');
      speicher.zeilen = speicher.zeilen.filter((zeile) => zeile !== 'gelöscht');
      return 1;
    },
    leistungSchreiben: async () => {
      speicher.schritte.push('schreiben');
      if (fehlerBei === 'schreiben') throw new Error('Leistung schreiben: Zeitüberschreitung');
      if (!speicher.zeilen.includes('neu')) speicher.zeilen.push('neu');
      return 1;
    },
    spiegelSchreiben: async () => {
      speicher.schritte.push('spiegel');
      speicher.version = 134;
    },
  });
  const neuerSpeicher = () => ({ version: 133, zeilen: ['gelöscht'], schritte: [] });

  it('schreibt den Spiegel erst nach dem Bereinigen und den Leistungswerten', async () => {
    const speicher = neuerSpeicher();
    expect(await lauf(speicher)).toEqual({ entfernt: 1, geschrieben: 1 });
    expect(speicher.schritte).toEqual(['vormerken', 'entfernen', 'schreiben', 'spiegel']);
    expect(speicher).toMatchObject({ version: 134, zeilen: ['neu'] });
  });

  it('lässt die alte Version stehen, wenn das Schreiben scheitert, und holt beim nächsten Abgleich alles nach', async () => {
    const speicher = neuerSpeicher();
    await expect(lauf(speicher, 'schreiben')).rejects.toThrow('Leistung schreiben');
    expect(speicher.schritte).toEqual(['vormerken', 'entfernen', 'schreiben']);
    // Spiegel 133 ≠ LOGMAN 134: Der nächste Abgleich meldet nicht „unverändert“.
    expect(speicher.version).toBe(133);
    speicher.schritte = [];
    await lauf(speicher);
    expect(speicher).toMatchObject({ version: 134, zeilen: ['neu'] });
  });

  it('schreibt nichts weiter, wenn schon das Bereinigen scheitert', async () => {
    const speicher = neuerSpeicher();
    await expect(lauf(speicher, 'entfernen')).rejects.toThrow('Leistung bereinigen');
    expect(speicher.schritte).toEqual(['vormerken', 'entfernen']);
    expect(speicher).toMatchObject({ version: 133, zeilen: ['gelöscht'] });
  });
});

describe('LOGMAN-Abgleich: Datum neuer Einheiten bleibt bei einem späteren Versuch gleich', () => {
  // Stand mit zwei Einheiten, die Sätze haben.
  const satz = { w: '80', r: '8', rir: '2' };
  const stand = (...einheiten) => ({ data: Object.fromEntries(einheiten.map((schluessel) => {
    const [tag, cycle] = schluessel.split('|');
    return [tag, { [cycle]: { b1: { sets: [[satz]] } } }];
  })) });

  it('datiert neue Einheiten mit heute, bekannte mit ihrem bisherigen Datum, beim ersten Abgleich ohne Datum', () => {
    expect(einheitenDatieren(stand('OK-H|1', 'UK-H|1'), { 'OK-H|1': '2026-10-01' }, false, '2026-10-05'))
      .toEqual({ 'OK-H|1': '2026-10-01', 'UK-H|1': '2026-10-05' });
    expect(einheitenDatieren(stand('OK-H|1'), null, true, '2026-10-05')).toEqual({ 'OK-H|1': null });
  });

  it('merkt nur neue Einheiten vor und behält verschwundene bis zum Abschluss', () => {
    expect(einheitenVormerken({ 'OK-H|1': '2026-10-01' }, { 'OK-H|1': '2026-10-01' })).toBeNull();
    expect(einheitenVormerken({ 'OK-H|1': '2026-10-01', 'OK-P|1': '2026-10-02' }, { 'OK-H|1': '2026-10-01', 'UK-H|1': '2026-10-05' }))
      .toEqual({ 'OK-H|1': '2026-10-01', 'OK-P|1': '2026-10-02', 'UK-H|1': '2026-10-05' });
  });

  it('scheitert der Spiegel am 05.10., bekommt der Versuch am 06.10. dasselbe Datum (keine Zeilen unter zwei Daten)', () => {
    const bisher = { 'OK-H|1': '2026-10-01' };
    const tag1 = einheitenDatieren(stand('OK-H|1', 'UK-H|1'), bisher, false, '2026-10-05');
    // Vorgemerkt wurde vor dem Schreiben; danach scheiterte nur der Spiegel.
    const vorgemerkt = einheitenVormerken(bisher, tag1);
    const tag2 = einheitenDatieren(stand('OK-H|1', 'UK-H|1'), vorgemerkt, false, '2026-10-06');
    expect(tag2['UK-H|1']).toBe('2026-10-05');
    // Ohne Vormerken hätte der zweite Versuch den 06.10. vergeben.
    expect(einheitenDatieren(stand('OK-H|1', 'UK-H|1'), bisher, false, '2026-10-06')['UK-H|1']).toBe('2026-10-06');
  });

  it('bereinigt beim späteren Versuch auch Einheiten, die zwischendurch verschwunden sind', () => {
    const bisher = { 'OK-H|1': '2026-10-01', 'OK-P|1': '2026-10-02' };
    const neu = einheitenDatieren(stand('OK-H|1', 'UK-H|1'), bisher, false, '2026-10-05');
    const vorgemerkt = einheitenVormerken(bisher, neu);
    // Der nächste Versuch liest den vorgemerkten Stand als „alt“: Der 02.10. bleibt betroffen.
    expect(betroffeneTage({ altGesehen: vorgemerkt, neuGesehen: neu })).toEqual(['2026-10-01', '2026-10-02', '2026-10-05']);
  });
});
