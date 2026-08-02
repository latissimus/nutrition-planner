import { describe, expect, it } from 'vitest';
import { isFresh, NEW_WINDOW_MS } from './freshness.js';

describe('DEX-Neustatus', () => {
  const now = new Date('2026-08-02T12:00:00Z').getTime();

  it('zeigt vorhandene Eintraege innerhalb von 24 Stunden als neu', () => {
    expect(isFresh(new Date(now - NEW_WINDOW_MS + 1).toISOString(), now)).toBe(true);
  });

  it('zeigt ohne vorhandenen Datensatz keinen Stern', () => {
    expect(isFresh(null, now)).toBe(false);
  });

  it('entfernt den Neustatus nach 24 Stunden', () => {
    expect(isFresh(new Date(now - NEW_WINDOW_MS).toISOString(), now)).toBe(false);
  });
});
