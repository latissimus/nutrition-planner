import { describe, expect, it } from 'vitest';
import { calculateEnergyNeed, localDateKey, saveNutritionDayStatus } from './nutrition.js';

describe('Tagesabschluss im Tracker', () => {
  it('schreibt nur das gewählte Konto und Datum, ohne Lebensmittel oder Ziel zu ändern', async () => {
    const calls = [];
    const client = { from(table) { calls.push(table); return { upsert(row, options) { calls.push(row, options); return Promise.resolve({ error: null }); } }; } };
    expect((await saveNutritionDayStatus('user-1', '2026-10-07', true, client)).error).toBeNull();
    expect(calls).toEqual(['nutrition_day_status', { user_id: 'user-1', log_date: '2026-10-07', complete: true, excluded: false }, { onConflict: 'user_id,log_date' }]);
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
