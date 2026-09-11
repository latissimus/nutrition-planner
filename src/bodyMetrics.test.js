import { describe, expect, it } from 'vitest';
import { weightHistoryMarkup } from './bodyMetrics.js';

describe('Gewichtsverlauf', () => {
  it('zeigt gespeicherte Wiegungen mit der neuesten zuerst', () => {
    const markup = weightHistoryMarkup([
      { gemessen_am: '2026-09-10', kg: 88.9 },
      { gemessen_am: '2026-09-11', kg: 89.9 },
    ]);

    expect(markup).toContain('Einzelne Wiegungen');
    expect(markup).toContain('89,9 kg');
    expect(markup).toContain('88,9 kg');
    expect(markup.indexOf('89,9 kg')).toBeLessThan(markup.indexOf('88,9 kg'));
  });

  it('rendert ohne Wiegungen keine leere Aufklappliste', () => {
    expect(weightHistoryMarkup([])).toBe('');
  });
});
