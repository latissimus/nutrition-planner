import { describe, expect, it } from 'vitest';
import {
  BODY_EXPLANATIONS, adaptiveEnergyEstimate, confirmedTrendChange, evaluateBodyComp,
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
  const nutrition = dates(28, (date) => ({ date, kcal: 2300 }));
  const weights = dates(28, (date, index) => ({ date, kg: 90 - index * 0.02 }));

  it('wartet mindestens 21 Tage ab und braucht an 80 Prozent der Tage Einträge', () => {
    expect(adaptiveEnergyEstimate({ nutritionDays: nutrition.slice(0, 20), weights }).eligible).toBe(false);
    // Erst seit 18 Tagen Einträge: Die leeren Tage davor zählen nicht als Zeitraum.
    const spaetStart = adaptiveEnergyEstimate({ nutritionDays: nutrition.map((d, i) => ({ ...d, kcal: i < 10 ? 0 : 2300 })), weights });
    expect([spaetStart.eligible, spaetStart.spanDays]).toEqual([false, 18]);
    // An 20 von 28 Tagen Einträge (71 %).
    const luecken = adaptiveEnergyEstimate({ nutritionDays: nutrition.map((d, i) => ({ ...d, kcal: i < 20 ? 2300 : 0 })), weights });
    expect([luecken.eligible, luecken.coverage]).toEqual([false, 71.4]);
    expect(luecken.reason).toContain('einträge');
  });

  it('kennt keinen Haken "vollständig protokolliert" mehr', () => {
    const ohneHaken = adaptiveEnergyEstimate({ nutritionDays: nutrition.map((d) => ({ ...d, complete: false })), weights, currentTarget: 2300 });
    expect(ohneHaken.eligible).toBe(true);
    expect(ohneHaken.reason).not.toMatch(/vollständig|protokolliert/);
  });

  it('kalibriert bei wiederholt sehr niedrigen Tageseinträgen kein scheinbar präzises Ziel', () => {
    const fraglich = nutrition.map((day, index) => (index === 6 || index === 15 ? { ...day, kcal: 800 } : day));
    const result = adaptiveEnergyEstimate({ nutritionDays: fraglich, weights, currentTarget: 2300 });
    expect(result).toMatchObject({ eligible: false, doubtfulDays: 2 });
    expect(result.reason).toContain('tatsächlicher Zufuhr oder fehlenden Einträgen');
    expect(adaptiveEnergyEstimate({ nutritionDays: fraglich.map((day, index) => index === 15 ? { ...day, kcal: 2300 } : day), weights, currentTarget: 2300 }).eligible).toBe(true);
  });

  it('meldet die Abdeckung in Prozent, auch wenn Wiegungen fehlen', () => {
    const wenigWiegungen = adaptiveEnergyEstimate({ nutritionDays: nutrition, weights: weights.filter((_, i) => i % 7 === 0) });
    expect([wenigWiegungen.eligible, wenigWiegungen.coverage]).toEqual([false, 100]);
    expect(wenigWiegungen.reason).toContain('Wiegungen');
  });

  it('schätzt den Bedarf aus Zufuhr und robustem Gewichtstrend und begrenzt Änderungen', () => {
    const result = adaptiveEnergyEstimate({ nutritionDays: nutrition, weights, currentTarget: 2300 });
    expect(result.eligible).toBe(true);
    expect(result.confidence).toBe('hoch');
    expect(result.observedMaintenance).toBeGreaterThan(2300);
    expect(result.suggestedChange).toBe(100);
    expect(result.requiresConfirmation).toBe(true);
  });

  it('schlägt bei stagnierendem Gewicht im Aufbau keine Senkung Richtung Erhaltung vor', () => {
    const stableWeights = dates(28, (date) => ({ date, kg: 90 }));
    const gain = adaptiveEnergyEstimate({ nutritionDays: nutrition, weights: stableWeights, currentTarget: 2300, goal: 'gain' });
    const loss = adaptiveEnergyEstimate({ nutritionDays: nutrition, weights: stableWeights, currentTarget: 2300, goal: 'lose' });
    const maintain = adaptiveEnergyEstimate({ nutritionDays: nutrition, weights: stableWeights, currentTarget: 2300, goal: 'maintain' });
    expect(gain).toMatchObject({ eligible: true, observedMaintenance: 2300, suggestedChange: 100, suggestedTarget: 2400 });
    expect(loss).toMatchObject({ eligible: true, observedMaintenance: 2300, suggestedChange: -100, suggestedTarget: 2200 });
    expect(maintain).toMatchObject({ eligible: true, observedMaintenance: 2300, suggestedChange: 0, suggestedTarget: 2300 });
  });

  it('lässt das Aufbauziel bei einer zum Überschuss passenden Zunahme unverändert', () => {
    const gainingWeights = dates(28, (date, index) => ({ date, kg: 90 + index * 200 / 7700 }));
    const result = adaptiveEnergyEstimate({ nutritionDays: nutrition, weights: gainingWeights, currentTarget: 2300, goal: 'gain' });
    expect(result.eligible).toBe(true);
    expect(result.suggestedChange).toBe(0);
  });

  it('ändert im BodyComp-Modus nie allein aufgrund des Gewichts die Kalorien', () => {
    const result = adaptiveEnergyEstimate({ nutritionDays: nutrition, weights, currentTarget: 2300, goal: 'bodycomp' });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('allein');
  });

  it('rechnet nur mit Tagen mit Einträgen und sperrt häufigere Anpassungen als wöchentlich', () => {
    const withGaps = nutrition.map((day, index) => (index >= 10 && index < 14 ? { ...day, kcal: 0 } : day));
    const eligible = adaptiveEnergyEstimate({ nutritionDays: withGaps, weights, currentTarget: 2300 });
    expect(eligible.eligible).toBe(true);
    expect([eligible.nutritionDaysCount, eligible.averageCalories, eligible.coverage]).toEqual([24, 2300, 85.7]);
    const locked = adaptiveEnergyEstimate({ nutritionDays: withGaps, weights, currentTarget: 2300, lastAdjustmentDate: '2026-01-25T12:00:00Z' });
    expect(locked.eligible).toBe(false);
    expect(locked.reason).toContain('Woche');
  });
});

describe('Körperrekomposition', () => {
  it('bildet den 7-Tage-Schnitt und den 28-Tage-Trend aus echten Wiegungen', () => {
    const weights = dates(28, (date, index) => ({ date, kg: 90 - index * 0.1 }));
    const trend = weightTrendSummary(weights);
    expect(trend.average7Kg).toBeCloseTo(87.6, 1);
    expect(trend.weeklyKg).toBeCloseTo(-0.7, 1);
    expect(trend.trend28Kg).toBeCloseTo(-2.5, 1);
    expect(trend.confidence).toBe('hoch');
    expect(trend.category).toBe('zu_schneller_verlust');
  });

  it('ordnet die prozentuale Gewichtsänderung anhand der Orientierungsbereiche ein', () => {
    expect(weightTrendSummary(dates(28, (date, index) => ({ date, kg: 100 - index * 0.03 }))).category).toBe('langsamer_verlust');
    expect(weightTrendSummary(dates(28, (date, index) => ({ date, kg: 100 - index * 0.2 }))).category).toBe('zu_schneller_verlust');
    expect(weightTrendSummary(dates(28, (date, index) => ({ date, kg: 100 + index * 0.03 }))).category).toBe('langsame_zunahme');
  });

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
