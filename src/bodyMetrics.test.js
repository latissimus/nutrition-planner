import { describe, expect, it } from 'vitest';
import { skinfoldEntryMarkup, skinfoldHistoryMarkup, skinfoldRecord, weightHistoryMarkup } from './bodyMetrics.js';
import { FALTEN, summe } from './measurements.js';
import { SUMMEN_FALTEN } from './ypsiFormel.js';

describe('Gewichtsverlauf', () => {
  it('zeigt gespeicherte Wiegungen mit der neuesten zuerst', () => {
    const markup = weightHistoryMarkup([
      { gemessen_am: '2026-09-10', kg: 88.9 },
      { gemessen_am: '2026-09-11', kg: 89.9 },
    ]);

    expect(markup).toContain('Einzelne Wiegungen');
    expect(markup).toContain('89,9 kg');
    expect(markup).toContain('88,9 kg');
    expect(markup.indexOf('89,9 kg')).toBeLessThan(markup.indexOf('88,9 kg'));
  });

  it('rendert ohne Wiegungen keine leere Aufklappliste', () => {
    expect(weightHistoryMarkup([])).toBe('');
  });
});

describe('Hautfaltenverlauf', () => {
  const falten = {
    kinn: 3, wange: 4, brust: 5, ruecken: 6, rippe: 7, huefte: 8,
    bauch: 9, trizeps: 10, bizeps: 11, knie: 5, wade: 12, quadrizeps: 13, beinbizeps: 14,
  };

  it('zeigt frühere Messungen mit Summe und allen Einzelwerten', () => {
    const markup = skinfoldHistoryMarkup([
      { gemessen_am: '2026-09-10', falten },
      { gemessen_am: '2026-09-12', falten: { ...falten, kinn: 4 } },
    ]);

    expect(markup).toContain('Einzelne Hautfaltenmessungen');
    expect(markup).toContain('Kinn');
    expect(markup).toContain('Beinbizeps');
    expect(markup.indexOf('12.09.26')).toBeLessThan(markup.indexOf('10.09.26'));
  });

  it('speichert ausschließlich von der Datenbank erlaubte Qualitätswerte', () => {
    const standardized = skinfoldRecord({ userId: 'user-1', date: '2026-09-13', values: falten, standardisiert: true, groesseCm: 180, gewichtKg: 85 });
    const unstandardized = skinfoldRecord({ userId: 'user-1', date: '2026-09-13', values: falten, standardisiert: false });

    expect(standardized.messqualitaet).toBe('hoch');
    expect(unstandardized.messqualitaet).toBe('niedrig');
    expect(['niedrig', 'mittel', 'hoch']).toContain(standardized.messqualitaet);
    expect(standardized).toMatchObject({ groesse_cm: 180, gewicht_kg: 85 });
  });

  it('rendert ohne Messungen keine leere Aufklappliste', () => {
    expect(skinfoldHistoryMarkup([])).toBe('');
  });

  it('gibt jedem Messfeld eine stabile mobile Weiter-Reihenfolge', () => {
    const markup = skinfoldEntryMarkup();

    expect(markup.match(/name="skinfold-/g)).toHaveLength(FALTEN.length);
    expect(markup.match(/enterkeyhint="next"/g)).toHaveLength(FALTEN.length - 1);
    expect(markup.match(/enterkeyhint="done"/g)).toHaveLength(1);
    expect(markup).toContain('data-skinfold-weight');
    expect(markup).toContain('Alle drei bis vier Wochen');
  });

  it('rechnet das Knie in die Summe, Oberschenkel und Bizeps aber nicht', () => {
    expect(FALTEN.map(([key]) => key)).toContain('knie');
    expect(SUMMEN_FALTEN).toContain('knie');

    const vollstaendig = Object.fromEntries(FALTEN.map(([key]) => [key, 10]));
    expect(summe(vollstaendig)).toBe(SUMMEN_FALTEN.length * 10);

    // Quadrizeps, Beinbizeps und Bizeps aendern die Summe nicht.
    expect(summe({ ...vollstaendig, quadrizeps: 40, beinbizeps: 40, bizeps: 40 }))
      .toBe(SUMMEN_FALTEN.length * 10);

    const { knie, ...ohneKnie } = vollstaendig;
    expect(summe(ohneKnie)).toBe((SUMMEN_FALTEN.length - 1) * 10);
  });

  it('weist unvollständige Altmessungen zum Nachtragen aus', () => {
    const ohneKnie = Object.fromEntries(FALTEN.filter(([key]) => key !== 'knie').map(([key]) => [key, 10]));
    const markup = skinfoldHistoryMarkup([{ gemessen_am: '2026-05-04', falten: ohneKnie, total: null }]);

    expect(markup).toContain('ist-unvollstaendig');
    expect(markup).toContain('Knie');
    expect(markup).toContain('1 fehlt');
  });
});
