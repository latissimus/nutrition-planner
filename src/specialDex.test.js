import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpecialDexOverlay, prepareSpecialDexPage, SPECIAL_DEX_CLASSES } from './specialDex.js';

afterEach(() => vi.unstubAllGlobals());

describe('Special-Dex-Vorlage', () => {
  it('kennzeichnet eine Seite ohne ihre Fachlogik zu verändern', () => {
    const classes = new Set();
    const container = {
      classList: { add: (...items) => items.forEach((item) => classes.add(item)) },
      dataset: {},
    };
    prepareSpecialDexPage(container, 'meal-log');
    expect(classes.has(SPECIAL_DEX_CLASSES.page)).toBe(true);
    expect(container.dataset.specialDex).toBe('meal-log');
  });

  it('verträgt einen bereits abgebauten Container', () => {
    expect(() => prepareSpecialDexPage(null, 'sleep')).not.toThrow();
  });

  it('schließt ein gemeinsames Overlay per Schließen-Aktion und Escape', () => {
    const listeners = {};
    const backdrop = {
      style: { setProperty: vi.fn() },
      addEventListener: (type, listener) => { listeners[type] = listener; },
      querySelector: vi.fn(() => null),
      remove: vi.fn(),
      className: '',
      innerHTML: '',
    };
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => backdrop),
      body: { append: vi.fn() },
    });
    vi.stubGlobal('requestAnimationFrame', (callback) => callback());
    createSpecialDexOverlay({ markup: '<p>Info</p>', ariaLabel: 'Dex-Info' });
    expect(backdrop.innerHTML).toContain('aria-label="Dex-Info"');
    expect(backdrop.style.setProperty).toHaveBeenCalledWith('--ordner', '#4E342E');
    expect(backdrop.style.setProperty).toHaveBeenCalledWith('--ordner-ink', '#FEEFB8');
    expect(backdrop.style.setProperty).toHaveBeenCalledWith('--dex-seitenfarbe', '#FEEFB8');
    expect(backdrop.style.setProperty).toHaveBeenCalledWith('--dex-ink', '#4E342E');
    listeners.click({ target: { closest: () => true } });
    listeners.keydown({ key: 'Escape' });
    expect(backdrop.remove).toHaveBeenCalledTimes(2);
  });
});
