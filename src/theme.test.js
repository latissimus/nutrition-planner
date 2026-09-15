import { describe, expect, it } from 'vitest';
import { gueltig, THEMES, HUELLEN_TOKENS, huellenFarbe } from './theme.js';

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

/* Seitenflaeche, Header und Dock werden per JS inline auf :root gefaerbt.
   Inline schlaegt jede Stylesheet-Regel ohne !important – im Dark Mode muessen
   diese vier Tokens deshalb ungesetzt bleiben, damit der Stylesheet-Wert
   (das einheitliche Navy) stehen bleibt. */
describe('Hüllenfarbe je Theme', () => {
  it('deckt genau die vier Hüllen-Tokens ab', () => {
    expect([...HUELLEN_TOKENS]).toEqual(['--bg', '--app-bg', '--app-content-bg', '--app-chrome-bg']);
  });

  it('gibt im Retro-Look die Seitenfarbe durch', () => {
    expect(huellenFarbe('retro', '#B1E7FF')).toBe('#B1E7FF');
  });

  it('unterdrückt die Seitenfarbe im Dark Mode', () => {
    expect(huellenFarbe('dark', '#B1E7FF')).toBeNull();
    expect(huellenFarbe('dark', '#3F236F')).toBeNull();
  });

  it('behandelt unbekannte Themes wie Retro', () => {
    expect(huellenFarbe('standard', '#B1E7FF')).toBe('#B1E7FF');
    expect(huellenFarbe(undefined, '#B1E7FF')).toBe('#B1E7FF');
  });

  it('räumt ohne Farbe auf, statt einen leeren Wert zu setzen', () => {
    expect(huellenFarbe('retro', '')).toBeNull();
    expect(huellenFarbe('retro', '   ')).toBeNull();
    expect(huellenFarbe('retro', null)).toBeNull();
  });
});
