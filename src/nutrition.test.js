import { describe, expect, it } from 'vitest';
import { calculateEnergyNeed, localDateKey } from './nutrition.js';
import { berlinDay, currentCalorieTarget, nutritionTargetStatus, targetPhaseDay } from '../supabase/functions/capboy-coach/nutritionTarget.js';
import { buildFollowThrough } from '../supabase/functions/capboy-coach/followThrough.ts';
import { fensterWerte } from '../supabase/functions/capboy-coach/volumen.js';
import { buildCompFacts, buildTimeseries, dateDaysAgo } from '../supabase/functions/capboy-coach/context.ts';
import { goalLabel, goalSettingsUpdate } from './nutritionGoals.js';

describe('Automatischer Kalorien-Zielbereich', () => {
  it('verwendet auf COMP und im Tracker dasselbe Ziel und verwirft nur das alte adaptive Ziel', () => {
    expect(goalLabel('bodycomp')).toContain('BodyComp');
    expect(goalSettingsUpdate({ goal: 'gain' }, 'lose')).toEqual({
      goal: 'lose', adaptive_target: null, adaptive_updated_at: null,
      adaptive_rejected_target: null, adaptive_rejected_at: null,
    });
    expect(goalSettingsUpdate({ goal: 'gain' }, 'gain')).toEqual({ goal: 'gain' });
    expect(() => goalSettingsUpdate({ goal: 'gain' }, 'unbekannt')).toThrow('Unbekanntes Ziel');
  });
  it('verwendet ±10 % inklusive der Grenzen, ohne Vollständigkeit zu behaupten', () => {
    expect(nutritionTargetStatus(2160, 2400)).toBe('im_zielbereich');
    expect(nutritionTargetStatus(2640, 2400)).toBe('im_zielbereich');
    expect(nutritionTargetStatus(2159, 2400)).toBe('unter_zielbereich');
    expect(nutritionTargetStatus(2641, 2400)).toBe('ueber_zielbereich');
    expect(nutritionTargetStatus(0, 2400, false)).toBe('keine_eintraege');
    expect(nutritionTargetStatus(2400, null)).toBe('kein_ziel');
  });

  it('gibt dem Coach das gleiche berechnete Ziel wie dem Tracker, auch ohne gespeichertes Ziel', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    const settings = { calculation_basis: 'male', birth_date: '1990-01-01', height_cm: 180, pal: 1.6, goal: 'maintain' };
    const expected = calculateEnergyNeed({ calculationBasis: 'male', birthDate: '1990-01-01', heightCm: 180,
      weightKg: 80, pal: 1.6, goal: 'maintain', referenceDate: now }).target;
    expect(currentCalorieTarget(settings, 80, now)).toBe(expected);
    expect(currentCalorieTarget({ ...settings, adaptive_target: 2300, custom_calorie_target: 2500 }, 80, now)).toBe(2500);
    expect(currentCalorieTarget(settings, null, now)).toBeNull();
  });

  it('benutzt für COMP, die Lückenprüfung und das Wochenvolumen dasselbe Ziel', () => {
    const now = new Date('2026-10-08T21:30:00Z');
    const settings = { calculation_basis: 'male', birth_date: '1990-01-01', height_cm: 180, pal: 1.6, goal: 'gain' };
    const weights = [{ kg: 80 }];
    const target = currentCalorieTarget(settings, 80, now);
    const nutritionEntries = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']
      .map((log_date) => ({ log_date, energy_kcal: 1000, protein_g: 80 }));
    const rows = { settings, weights, nutritionEntries };
    expect(berlinDay(now)).toBe('2026-10-08');
    expect(buildFollowThrough(rows, now).checks.find((check) => check.id === 'ernaehrung-weit-unter-ziel')?.nutrition.targetKcal).toBe(target);
    expect(fensterWerte(rows, '2026-10-08').kalorienZiel).toBe(target);
  });

  it('beginnt in Berlin nach Mitternacht bereits den nächsten Auswertungstag', () => {
    expect(berlinDay(new Date('2026-10-08T22:30:00Z'))).toBe('2026-10-09');
    expect(berlinDay(new Date('2026-12-08T23:30:00Z'))).toBe('2026-12-09');
    expect(targetPhaseDay({ target_changed_at: '2026-10-07T22:30:00Z' })).toBe('2026-10-08');
    expect(dateDaysAgo(new Date('2026-10-08T22:30:00Z'), 0)).toBe('2026-10-09');
    expect(dateDaysAgo(new Date('2026-10-08T22:30:00Z'), 1)).toBe('2026-10-08');
    const empty = { settings: null, weights: [], skinfolds: [], waists: [], performance: [], sleep: [], checkins: [],
      nutritionEntries: [], routines: [], completions: [], ruleContext: {} };
    expect(buildCompFacts(empty, new Date('2026-10-08T22:30:00Z')).period.to).toBe('2026-10-09');
  });

  it('vergleicht Tage vor einem Zielwechsel nicht nachträglich mit dem neuen Ziel', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    const settings = { goal: 'gain', custom_calorie_target: 2600, target_changed_at: '2026-10-07T22:30:00Z' };
    const rows = { settings, weights: [{ gemessen_am: '2026-10-07', kg: 80 }], skinfolds: [], waists: [], performance: [], sleep: [], checkins: [],
      nutritionEntries: [
        { log_date: '2026-10-06', energy_kcal: 2100, protein_g: 150 },
        { log_date: '2026-10-08', energy_kcal: 2500, protein_g: 150 },
      ], routines: [], completions: [], ruleContext: {} };
    const recent = buildTimeseries(rows, now).recentDays;
    expect(recent.targetPhaseFrom).toBe('2026-10-08');
    expect(recent.days.find((day) => day.date === '2026-10-06')).toMatchObject({ targetKcal: null, differenceKcal: null, targetStatus: 'zielphase_unbekannt' });
    expect(recent.days.find((day) => day.date === '2026-10-08')).toMatchObject({ targetKcal: 2600, differenceKcal: -100, targetStatus: 'im_zielbereich' });
    expect(recent.averageDifferenceKcalOnPastDaysWithEntries).toBeNull();
    expect(buildFollowThrough(rows, now).checks.some((check) => check.id === 'ernaehrung-weit-unter-ziel')).toBe(false);
  });

  it('mischt für die Volumenentscheidung keine Ernährung aus zwei Zielphasen', () => {
    const result = fensterWerte({
      settings: { custom_calorie_target: 2500, target_changed_at: '2026-10-04T10:00:00Z' },
      weights: [{ kg: 80 }],
      nutritionEntries: [
        { log_date: '2026-10-01', energy_kcal: 1500, protein_g: 80 },
        { log_date: '2026-10-04', energy_kcal: 2500, protein_g: 160 },
      ],
    }, '2026-10-05');
    expect(result.ernaehrung).toMatchObject({ tage: 1, kcal: 2500, protein: 160 });
  });
});

describe('Kalorienbedarf', () => {
  it('verwendet unabhängig von einem historischen KFA immer Mifflin–St. Jeor', () => {
    const withBodyFat = calculateEnergyNeed({
      calculationBasis: 'male', birthDate: '1990-01-01', heightCm: 180,
      weightKg: 80, bodyFatPercent: 15, pal: 1.6, goal: 'gain',
    });
    const withoutBodyFat = calculateEnergyNeed({
      calculationBasis: 'male', birthDate: '1990-01-01', heightCm: 180,
      weightKg: 80, bodyFatPercent: null, pal: 1.6, goal: 'gain',
    });
    expect(withBodyFat.method).toBe('Mifflin–St. Jeor');
    expect(withBodyFat).toEqual(withoutBodyFat);
  });

  it('kennzeichnet die Berechnung als Schätzung mit plausibler Spanne', () => {
    const result = calculateEnergyNeed({
      calculationBasis: 'female', birthDate: '1990-01-01', heightCm: 170,
      weightKg: 65, bodyFatPercent: null, pal: 1.4, goal: 'maintain',
    });
    expect(result.method).toBe('Mifflin–St. Jeor');
    expect(result.maintenance).toBeGreaterThan(1700);
    expect(result.maintenance).toBeLessThan(2100);
    expect(result.maintenanceRange[0]).toBeLessThan(result.maintenance);
    expect(result.maintenanceRange[1]).toBeGreaterThan(result.maintenance);
  });

  it('berechnet ohne vollständige Körperdaten kein scheinpräzises Ziel', () => {
    expect(calculateEnergyNeed({ heightCm: 180, weightKg: 80 })).toBeNull();
  });
});

describe('Lokales Tagesdatum', () => {
  it('formatiert das Datum ohne UTC-Verschiebung', () => {
    expect(localDateKey(new Date(2026, 7, 15, 0, 5))).toBe('2026-08-15');
  });
});
