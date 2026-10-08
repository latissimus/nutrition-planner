import { describe, expect, it } from 'vitest';
import { calculateEnergyNeed, localDateKey } from './nutrition.js';
import { currentCalorieTarget, nutritionTargetStatus } from '../supabase/functions/capboy-coach/nutritionTarget.js';

describe('Automatischer Kalorien-Zielbereich', () => {
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
