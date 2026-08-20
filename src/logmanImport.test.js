import { describe, expect, it } from 'vitest';
import { parseLogmanExport, performanceTrend } from './logmanImport.js';

describe('LOGMAN-Import', () => {
  it('übernimmt nur vergleichbare HEAVYS und feste MIDDLES', () => {
    const rows = parseLogmanExport({ training: { payload: {
      ex: { 'OK-H': { row: ['Rudern'] }, 'OK-P': { press: ['Brustpresse'] } },
      datum: { 'OK-H|1': '2026-01-01', 'OK-P|1': '2026-01-03' },
      data: {
        'OK-H': { 1: { row: { sets: [[{ w: 80, r: 8 }]] } } },
        'OK-P': { 1: { press: { sets: [[{ w: 60, r: 12 }]] }, pump: { names: ['Fliegende'], sets: [[{ w: 20, r: 20 }]] } } },
      },
    } } });
    expect(rows.map((row) => row.category)).toEqual(['HEAVYS', 'MIDDLES']);
    expect(rows[0].estimated_1rm).toBeGreaterThan(80);
  });

  it('bewertet mehrere vergleichbare Einheiten vorsichtig als Trend', () => {
    const trend = performanceTrend([
      { category: 'HEAVYS', exercise: 'Rudern', performed_on: '2026-01-01', estimated_1rm: 100 },
      { category: 'HEAVYS', exercise: 'Rudern', performed_on: '2026-02-01', estimated_1rm: 104 },
    ]);
    expect(trend.direction).toBe(1);
    expect(trend.percent).toBe(4);
  });
});
