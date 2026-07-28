import { describe, expect, it } from 'vitest';
import { FALTEN, schnitt7, summe, zahl } from './measurements.js';

describe('measurements', () => {
  it('parses decimal commas', () => {
    expect(zahl('84,2')).toBe(84.2);
    expect(zahl('')).toBeNull();
  });

  it('only sums complete skinfold sets', () => {
    const complete = Object.fromEntries(FALTEN.map(([key]) => [key, 10]));
    expect(summe(complete)).toBe(120);
    expect(summe({ ...complete, kinn: '' })).toBeNull();
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
