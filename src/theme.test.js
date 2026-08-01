import { describe, expect, it } from 'vitest';
import { gueltig, THEMES } from './theme.js';

describe('Theme-Auswahl', () => {
  it('laesst Standard, Retro und Dark zu', () => {
    expect(gueltig('standard')).toBe('standard');
    expect(gueltig('retro')).toBe('retro');
    expect(gueltig('dark')).toBe('dark');
  });

  it('faellt auf Standard zurueck', () => {
    expect(gueltig('unbekannt')).toBe('standard');
    expect(gueltig(null)).toBe('standard');
    expect(gueltig(undefined)).toBe('standard');
  });

  it('haelt die Themeliste und die Pruefung deckungsgleich', () => {
    THEMES.forEach((theme) => expect(gueltig(theme)).toBe(theme));
  });
});
