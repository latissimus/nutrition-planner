import { describe, expect, it, vi } from 'vitest';
import { bindLongPress } from './longPress.js';

function fakeRoot() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
  };
}

describe('Long-Press-Lebenszyklus', () => {
  it('entfernt alle Handler beim Abbruch der Ansicht', () => {
    const root = fakeRoot();
    const controller = new AbortController();
    bindLongPress(root, '.card', vi.fn(), { signal: controller.signal });
    expect([...root.listeners.values()].some((listeners) => listeners.size)).toBe(true);
    controller.abort();
    expect([...root.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
  });

  it('bindet bei bereits abgebrochener Ansicht nichts', () => {
    const root = fakeRoot();
    const controller = new AbortController();
    controller.abort();
    bindLongPress(root, '.card', vi.fn(), { signal: controller.signal });
    expect(root.listeners.size).toBe(0);
  });
});
