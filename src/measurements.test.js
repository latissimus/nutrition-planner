import { describe, expect, it } from 'vitest';
import { FALTEN, schnitt7, summe, zahl } from './measurements.js';
import { SUMMEN_FALTEN } from './ypsiFormel.js';

describe('measurements', () => {
  it('parses decimal commas', () => {
    expect(zahl('84,2')).toBe(84.2);
    expect(zahl('')).toBeNull();
  });

  it('bildet die Excel-Summe, sobald Kinn vorhanden ist', () => {
    const complete = Object.fromEntries(FALTEN.map(([key]) => [key, 10]));
    expect(summe(complete)).toBe(SUMMEN_FALTEN.length * 10);
    expect(summe({ ...complete, kinn: '' })).toBeNull();
    expect(summe({ kinn: 10, wange: 5 })).toBe(15);
  });

  it('calculates a calendar based seven day average', () => {
    const trend = schnitt7([
      { datum: '2026-07-01', kg: 80 },
      { datum: '2026-07-02', kg: 82 },
      { datum: '2026-07-10', kg: 78 },
    ]);
    expect(trend[1].kg).toBe(81);
    expect(trend[2].kg).toBe(78);
  });
});
