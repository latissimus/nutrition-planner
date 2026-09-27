import { describe, expect, it } from 'vitest';
import { buildCompEvidence, compCoachFrage } from './compAssessment.js';

const baseState = () => ({
  weights: [
    { gemessen_am: '2026-09-01', date: '2026-09-01', kg: 90 },
    { gemessen_am: '2026-09-08', date: '2026-09-08', kg: 89.5 },
    { gemessen_am: '2026-09-15', date: '2026-09-15', kg: 89 },
  ],
  skinfolds: [],
  waists: [
    { gemessen_am: '2026-09-01', cm: 92, standardisiert: true },
    { gemessen_am: '2026-09-08', cm: 91.5, standardisiert: true },
    { gemessen_am: '2026-09-15', cm: 91, standardisiert: true },
  ],
  performance: [],
  sleep: [],
  checkins: [],
  settings: { calculation_basis: 'male' },
});

describe('zentrale COMP-Evidenz', () => {
  it('liefert ausschließlich berechnete Fakten und feste Sicherheitsgrenzen', () => {
    const optional = [{ id: 'hautfalten', dosierungen: [{ name: 'Magnesium', dosierung: '300 mg' }] }];
    const evidence = buildCompEvidence(baseState(), {}, optional);
    expect(evidence.calculationVersion).toBe('comp-central-v1');
    expect(evidence.objectiveFacts.weight.currentKg).toBe(89);
    expect(evidence.objectiveFacts.waist.confirmedChangeCm).toBe(-1);
    expect(evidence.objectiveFacts.skinfolds.sumMm).toBeNull();
    expect(evidence.safetyBoundaries.diagnosesAllowed).toBe(false);
    expect(evidence.safetyBoundaries.automaticGoalChangesAllowed).toBe(false);
    expect(evidence.safetyBoundaries.supplementDosagesFromModelAllowed).toBe(false);
    expect(evidence.allowedActions).toEqual([]);
    expect(evidence.optionalSeminarGuidance).toBe(optional);
  });
});

describe('Mit Coach besprechen', () => {
  it('nennt die nächsten Schritte der COMP-Bewertung wörtlich und fragt nach dem Vorgehen', () => {
    const frage = compCoachFrage({ nextSteps: [
      { action: 'Trag zwei Wochen lang an jedem Tag ein, was du isst.' },
      { action: 'Wiege dich mindestens dreimal pro Woche.' },
    ] });
    expect(frage).toBe([
      'Lass uns meine COMP-Gesamtbewertung besprechen.',
      'Die nächsten Schritte daraus:',
      '1. Trag zwei Wochen lang an jedem Tag ein, was du isst.',
      '2. Wiege dich mindestens dreimal pro Woche.',
      'Wie gehe ich das konkret an, was ist dabei am wichtigsten, und was fehlt oder läuft bei mir noch nicht rund?',
    ].join('\n'));
  });

  it('bleibt ohne Schritte eine sinnvolle Frage und unter der Feldgrenze', () => {
    expect(compCoachFrage({})).not.toContain('Die nächsten Schritte');
    const lang = compCoachFrage({ nextSteps: Array(5).fill({ action: 'x'.repeat(1000) }) });
    expect(lang.split('\n').filter((zeile) => /^\d\./.test(zeile))).toHaveLength(3);
    expect(lang.length).toBeLessThan(2000);
  });
});
