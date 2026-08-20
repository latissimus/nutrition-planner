import { describe, expect, it } from 'vitest';
import {
  BODY_EXPLANATIONS, adaptiveEnergyEstimate, aggregateSkinfoldReadings, confirmedTrendChange, evaluateBodyComp,
  goalWeightInterpretation, initialEnergyEstimate, weightTrendSummary,
} from './bodyComposition.js';

const dates = (count, mapper) => Array.from({ length: count }, (_, index) => {
  const date = new Date('2026-01-01T12:00:00'); date.setDate(date.getDate() + index);
  return mapper(date.toISOString().slice(0, 10), index);
});

describe('evidenzbasierte Kalorienberechnung', () => {
  it('verwendet immer Mifflin–St. Jeor und ignoriert einen beliebigen KFA-Wert', () => {
    const base = { calculationBasis: 'male', birthDate: '1990-01-01', heightCm: 180, weightKg: 80, pal: 1.6, goal: 'maintain', referenceDate: new Date('2026-01-01') };
    expect(initialEnergyEstimate({ ...base, bodyFatPercent: 8 })).toEqual(initialEnergyEstimate({ ...base, bodyFatPercent: 40 }));
    expect(initialEnergyEstimate(base).method).toBe('Mifflin–St. Jeor');
  });

  it('berechnet im BodyComp-Modus keinen automatischen Überschuss', () => {
    const result = initialEnergyEstimate({ calculationBasis: 'female', birthDate: '1990-01-01', heightCm: 165, weightKg: 65, pal: 1.5, goal: 'bodycomp', referenceDate: new Date('2026-01-01') });
    expect(result.target).toBe(result.maintenance);
  });

  it('berechnet Mifflin–St. Jeor für beide Berechnungsbasen korrekt', () => {
    const common = { birthDate: '1990-01-01', heightCm: 180, weightKg: 80, pal: 1, goal: 'maintain', referenceDate: new Date('2026-01-01') };
    expect(initialEnergyEstimate({ ...common, calculationBasis: 'male' }).resting).toBe(1750);
    expect(initialEnergyEstimate({ ...common, calculationBasis: 'female' }).resting).toBe(1584);
  });
});

describe('adaptive Kalorienkalibrierung', () => {
  const nutrition = dates(28, (date) => ({ date, kcal: 2300, complete: true }));
  const weights = dates(28, (date, index) => ({ date, kg: 90 - index * 0.02 }));

  it('wartet mindestens 21 Tage und 80 Prozent vollständige Tage ab', () => {
    expect(adaptiveEnergyEstimate({ nutritionDays: nutrition.slice(0, 20), weights }).eligible).toBe(false);
    expect(adaptiveEnergyEstimate({ nutritionDays: nutrition.map((d, i) => ({ ...d, complete: i < 20 })), weights }).eligible).toBe(false);
  });

  it('schätzt den Bedarf aus Zufuhr und robustem Gewichtstrend und begrenzt Änderungen', () => {
    const result = adaptiveEnergyEstimate({ nutritionDays: nutrition, weights, currentTarget: 2300 });
    expect(result.eligible).toBe(true);
    expect(result.confidence).toBe('hoch');
    expect(result.observedMaintenance).toBeGreaterThan(2300);
    expect(result.suggestedChange).toBe(100);
    expect(result.requiresConfirmation).toBe(true);
  });

  it('ändert im BodyComp-Modus nie allein aufgrund des Gewichts die Kalorien', () => {
    const result = adaptiveEnergyEstimate({ nutritionDays: nutrition, weights, currentTarget: 2300, goal: 'bodycomp' });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('allein');
  });

  it('ignoriert ausdrücklich ausgeschlossene Sondertage und sperrt häufigere Anpassungen als wöchentlich', () => {
    const withTrip = nutrition.map((day, index) => index < 4 ? { ...day, excluded: true, complete: false } : day);
    const eligible = adaptiveEnergyEstimate({ nutritionDays: withTrip, weights, currentTarget: 2300 });
    expect(eligible.eligible).toBe(true);
    expect(eligible.excludedDays).toBe(4);
    const locked = adaptiveEnergyEstimate({ nutritionDays: withTrip, weights, currentTarget: 2300, lastAdjustmentDate: '2026-01-25T12:00:00Z' });
    expect(locked.eligible).toBe(false);
    expect(locked.reason).toContain('Woche');
  });
});

describe('Körperrekomposition', () => {
  it('wertet sinkende Maße bei stabiler Leistung kombiniert als wahrscheinlichen Erfolg', () => {
    const result = evaluateBodyComp({
      weeks: 4, weight: { category: 'stabil', confidence: 'hoch' },
      skinfoldDelta: -4, waistDelta: -1, performanceTrend: 1, recoveryTrend: 0,
    });
    expect(result.status).toBe('erfolgreiche_rekomposition');
  });

  it('markiert sinkendes Gewicht allein nicht als Erfolg', () => {
    const weight = weightTrendSummary(dates(28, (date, index) => ({ date, kg: 91 - index * 0.1 })));
    const result = evaluateBodyComp({ weeks: 4, weight });
    expect(result.status).not.toContain('erfolg');
  });

  it('bewertet Gewicht im BodyComp-Modus ausdrücklich neutral', () => {
    const trend = weightTrendSummary(dates(28, (date, index) => ({ date, kg: 91 + index * 0.02 })));
    expect(goalWeightInterpretation(trend, 'bodycomp').tone).toBe('neutral');
  });

  it('erklärt unvollständige kombinierte Daten statt Erfolg zu behaupten', () => {
    const result = evaluateBodyComp({ weeks: 4, weight: { category: 'stabil', confidence: 'hoch' } });
    expect(result.status).toBe('plateau');
    expect(result.suggestion).toContain('fehlen');
    expect(result.confidence).toBe('niedrig');
  });

  it('bestätigt Maßveränderungen erst nach drei standardisierten Messungen in gleicher Richtung', () => {
    expect(confirmedTrendChange([{ value: 100, standardisiert: true }, { value: 98, standardisiert: true }], (row) => row.value, 2)).toBeNull();
    expect(confirmedTrendChange([{ value: 100, standardisiert: true }, { value: 98, standardisiert: true }, { value: 96, standardisiert: true }], (row) => row.value, 2)).toBe(-4);
    expect(confirmedTrendChange([{ value: 100, standardisiert: true }, { value: 98, standardisiert: false }, { value: 96, standardisiert: true }], (row) => row.value, 2)).toBeNull();
  });
});

describe('geführte Hautfaltenmessung', () => {
  it('verlangt bei deutlicher Abweichung eine dritte Messung und speichert den Median', () => {
    const incomplete = aggregateSkinfoldReadings({ kinn: [10, 14] });
    expect(incomplete.thirdNeeded).toBe(1);
    const complete = aggregateSkinfoldReadings({ kinn: [10, 14, 11] });
    expect(complete.values.kinn).toBe(11);
  });
});

describe('verständliche Nutzerführung', () => {
  it('stellt Hilfetexte für alle zentralen Kennzahlen bereit', () => {
    expect(Object.keys(BODY_EXPLANATIONS)).toEqual(expect.arrayContaining([
      'dailyWeight', 'average7', 'trend28', 'weighingFrequency', 'skinfolds',
      'waist', 'performance', 'recovery', 'initialCalories',
    ]));
    Object.values(BODY_EXPLANATIONS).forEach((text) => expect(text.length).toBeGreaterThan(50));
  });

  it('enthält in den Hilfetexten keine verbotenen KFA- oder Hormoninterpretationen', () => {
    const text = Object.values(BODY_EXPLANATIONS).join(' ');
    expect(text).not.toMatch(/Hormonpriorität|Problemfalte|Cortisol-Falte|Stoffwechseltyp|Entgiftungsbedarf/i);
    expect(text).not.toMatch(/KFA aus Hautfalten/i);
  });
});
