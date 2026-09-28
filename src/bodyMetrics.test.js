import { describe, expect, it } from 'vitest';
import { compOptionaleSchritte, compOptionalMarkup, skinfoldEntryMarkup, skinfoldHistoryMarkup, skinfoldRecord, weightHistoryMarkup } from './bodyMetrics.js';
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
    expect(markup).toContain('data-skinfold-basis');
    expect(markup).toContain('Alle drei bis vier Wochen');
    expect(skinfoldEntryMarkup('', '', 'female')).toContain('<option value="female" selected>Weiblich</option>');
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

describe('COMP: optionale Schritte aus den Seminar-Auswertungen', () => {
  const actionPlan = {
    categories: { supplements: [
      { text: 'B-Vitamine nur unter Berücksichtigung der Gesamtzufuhr ergänzen.', source: 'seminar' },
      { text: 'Phase 1 ist dein aktueller Supplement-Schritt. Prüfe die aufgeführten Produkte.', source: 'seminar' },
      { text: 'Aus dieser Messung ergibt sich aktuell kein Supplement-Schritt.', source: 'app' },
    ] },
    protocols: [{ name: 'YPSI Quadrizeps/Beinbizeps – Phase 1', supplemente: [{ slug: 'magnesium', dosierung: '300 mg abends' }], optionale_supplemente: [] }],
  };
  const neurotransmitter = {
    complete: true,
    relevant: [{}],
    focus: { key: 'gaba', area: { label: 'GABA' }, severity: { label: 'deutlich' }, recommendations: {
      seminarFoods: [], seminarLifestyle: [], bravermanLifestyle: [],
      seminarTraining: { intensitaet: 'niedrig bis moderat', volumen: 'niedrig bis moderat' },
      seminarSupplements: ['Taurin', 'Inositol', 'B-Vitamine', 'Glycin', 'L-Theanin'],
      seminarNote: 'Gewöhnliche GABA-Supplements erhöhen GABA nicht.',
      supplements: [{ name: 'Taurin', dose: '500–1.000 mg', notiz: 'laut Dosierungstafel' }],
    } },
  };

  it('übernimmt die exakten Seminar-Dosierungen des Hautfalten-Plans und keine App- oder Verweissätze', () => {
    const [falten] = compOptionaleSchritte({ actionPlan, faltenLabel: 'Beinbizeps' });
    expect(falten.bereich).toBe('Hautfalten · Beinbizeps');
    expect(falten.punkte).toContain('B-Vitamine nur unter Berücksichtigung der Gesamtzufuhr ergänzen.');
    expect(falten.punkte.join(' ')).not.toMatch(/Phase 1 ist dein|kein Supplement-Schritt/);
    expect(falten.dosierungen).toEqual([expect.objectContaining({
      name: 'Magnesium', dosierung: '300 mg abends', protokoll: 'Quadrizeps/Beinbizeps – Phase 1', optional: false,
    })]);
    expect(falten.karte).toBe('Hautfalten');
  });

  it('übernimmt den Schwerpunkt des Neurotransmitter-Tests nur, wenn er auffällig ist', () => {
    const [nt] = compOptionaleSchritte({ neurotransmitter });
    expect(nt.bereich).toBe('Neurotransmitter · GABA (deutlich)');
    expect(nt.punkte).toEqual([
      'Training: Intensität niedrig bis moderat, Volumen niedrig bis moderat',
      'Supplemente: Taurin, Inositol, B-Vitamine, Glycin',
      'Gewöhnliche GABA-Supplements erhöhen GABA nicht.',
    ]);
    expect(nt.dosierungen).toEqual([expect.objectContaining({ name: 'Taurin', dosierung: '500–1.000 mg', optional: true })]);
    expect(compOptionaleSchritte({ neurotransmitter: { ...neurotransmitter, relevant: [] } })).toEqual([]);
    expect(compOptionaleSchritte({ neurotransmitter: { ...neurotransmitter, complete: false } })).toEqual([]);
    expect(compOptionaleSchritte({})).toEqual([]);
  });

  it('zeigt Hautfalten und Neurotransmitter als getrennte kompakte Aufklapper', () => {
    const schritte = [
      ...compOptionaleSchritte({ actionPlan, faltenLabel: 'Beinbizeps' }),
      ...compOptionaleSchritte({ neurotransmitter }),
    ];
    const markup = compOptionalMarkup(schritte);

    expect(markup.match(/<details class="comp-optional-card">/g)).toHaveLength(2);
    expect(markup).toContain('Hautfalten · Beinbizeps');
    expect(markup).toContain('Neurotransmitter · GABA (deutlich)');
    expect(markup).toContain('300 mg abends');
    expect(markup).toContain('500–1.000 mg');
    expect(markup).not.toContain('<ul><li><small>');
  });
});
