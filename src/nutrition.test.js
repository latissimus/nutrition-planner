import { describe, expect, it } from 'vitest';
import { calculateEnergyNeed, localDateKey } from './nutrition.js';

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
