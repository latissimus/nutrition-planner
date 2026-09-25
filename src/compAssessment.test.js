import { describe, expect, it } from 'vitest';
import { buildCompEvidence } from './compAssessment.js';

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
    const evidence = buildCompEvidence(baseState(), {});
    expect(evidence.calculationVersion).toBe('comp-central-v1');
    expect(evidence.objectiveFacts.weight.currentKg).toBe(89);
    expect(evidence.objectiveFacts.waist.confirmedChangeCm).toBe(-1);
    expect(evidence.objectiveFacts.skinfolds.sumMm).toBeNull();
    expect(evidence.safetyBoundaries.diagnosesAllowed).toBe(false);
    expect(evidence.safetyBoundaries.automaticGoalChangesAllowed).toBe(false);
    expect(evidence.safetyBoundaries.supplementDosagesFromModelAllowed).toBe(false);
    expect(evidence.allowedActions).toEqual([]);
  });
});
