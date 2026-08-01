import { describe, expect, it } from 'vitest';
import { gueltig, THEMES } from './theme.js';

describe('Theme-Auswahl', () => {
  it('laesst Retro und Dark zu', () => {
    expect(gueltig('retro')).toBe('retro');
    expect(gueltig('dark')).toBe('dark');
  });

  it('faellt auf Retro zurueck', () => {
    expect(gueltig('unbekannt')).toBe('retro');
    expect(gueltig(null)).toBe('retro');
    expect(gueltig(undefined)).toBe('retro');
  });

  it('bildet den alten Zwischenwert "standard" auf Retro ab', () => {
    // Wer die App waehrend der Umstellung benutzt hat, hat "standard" im
    // localStorage stehen. Der Wert muss auf dem heutigen Retro landen und
    // darf nicht Dark ausloesen.
    expect(gueltig('standard')).toBe('retro');
  });

  it('haelt die Themeliste und die Pruefung deckungsgleich', () => {
    expect(THEMES).toEqual(['retro', 'dark']);
    THEMES.forEach((theme) => expect(gueltig(theme)).toBe(theme));
  });
});
