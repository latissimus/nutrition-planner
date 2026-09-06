import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { from, upsert } = vi.hoisted(() => {
  const upsertMock = vi.fn(async () => ({ error: null }));
  return {
    upsert: upsertMock,
    from: vi.fn(() => ({ upsert: upsertMock })),
  };
});

vi.mock('./supabase.js', () => ({ supabase: { from } }));

import { setPreference, setPreferenceUser } from './userPreferences.js';

let storage;

beforeEach(() => {
  vi.useFakeTimers();
  from.mockClear();
  upsert.mockClear();
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    key: (index) => [...storage.keys()][index] ?? null,
    get length() { return storage.size; },
  });
});

afterEach(async () => {
  await vi.runAllTimersAsync();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('setPreference', () => {
  it('fasst schnelle Änderungen desselben Schlüssels zu einer Server-Anfrage zusammen', async () => {
    setPreferenceUser('debounce-user');
    setPreference('muscledex:letzter-dex', 'body', { syncDelay: 1500 });
    setPreference('muscledex:letzter-dex', 'sleep', { syncDelay: 1500 });
    setPreference('muscledex:letzter-dex', 'shopping', { syncDelay: 1500 });

    await vi.advanceTimersByTimeAsync(1499);
    expect(upsert).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0][0]).toEqual([
      expect.objectContaining({ key: 'muscledex:letzter-dex', value: 'shopping' }),
    ]);
  });

  it('synchronisiert einen unveränderten Wert nicht erneut', async () => {
    setPreferenceUser('same-value-user');
    setPreference('theme', 'retro', { syncDelay: 10 });
    setPreference('theme', 'retro', { syncDelay: 10 });
    await vi.advanceTimersByTimeAsync(10);

    expect(upsert).toHaveBeenCalledOnce();
  });

  it('fasst verschiedene Einstellungen in einem Upsert zusammen', async () => {
    setPreferenceUser('batch-user');
    setPreference('theme', 'dark', { syncDelay: 20 });
    setPreference('sound', false, { syncDelay: 20 });
    await vi.advanceTimersByTimeAsync(20);

    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'theme', value: 'dark' }),
      expect.objectContaining({ key: 'sound', value: false }),
    ]));
  });
});
