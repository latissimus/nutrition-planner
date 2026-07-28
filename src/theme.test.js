import { describe, expect, it } from 'vitest';
import { gueltig } from './theme.js';

describe('Theme-Auswahl', () => {
  it('laesst nur Retro und Dark zu', () => {
    expect(gueltig('dark')).toBe('dark');
    expect(gueltig('retro')).toBe('retro');
    expect(gueltig('unbekannt')).toBe('retro');
    expect(gueltig(null)).toBe('retro');
  });
});
