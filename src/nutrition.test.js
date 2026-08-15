import { describe, expect, it } from 'vitest';
import { calculateEnergyNeed, localDateKey } from './nutrition.js';

describe('Kalorienbedarf', () => {
  it('verwendet Cunningham, wenn ein plausibler KFA vorliegt', () => {
    const result = calculateEnergyNeed({
      calculationBasis: 'male', birthDate: '1990-01-01', heightCm: 180,
      weightKg: 80, bodyFatPercent: 15, pal: 1.6, goal: 'gain',
    });
    expect(result.method).toBe('Cunningham');
    expect(result.resting).toBe(1996);
    expect(result.target).toBe(3394);
  });

  it('fällt ohne KFA auf Mifflin–St Jeor zurück', () => {
    const result = calculateEnergyNeed({
      calculationBasis: 'female', birthDate: '1990-01-01', heightCm: 170,
      weightKg: 65, bodyFatPercent: null, pal: 1.4, goal: 'maintain',
    });
    expect(result.method).toBe('Mifflin–St Jeor');
    expect(result.maintenance).toBeGreaterThan(1700);
    expect(result.maintenance).toBeLessThan(2100);
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
