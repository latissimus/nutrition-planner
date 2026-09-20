import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRealtimeRefresh, passtZumBereich } from './realtime.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('createRealtimeRefresh', () => {
  it('fasst eine Ereignisserie zu einem Abruf zusammen', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const scheduler = createRealtimeRefresh(refresh, { delay: 50 });
    scheduler.request(); scheduler.request(); scheduler.request();
    await vi.advanceTimersByTimeAsync(49);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('startet nach einem laufenden Abruf höchstens einen Folgeabruf', async () => {
    vi.useFakeTimers();
    let finish;
    const refresh = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const scheduler = createRealtimeRefresh(refresh, { delay: 10 });
    scheduler.request();
    await vi.advanceTimersByTimeAsync(10);
    scheduler.request(); scheduler.request();
    await vi.advanceTimersByTimeAsync(10);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('führt nach dem Stoppen keinen Abruf mehr aus', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const scheduler = createRealtimeRefresh(refresh, { delay: 10 });
    scheduler.request(); scheduler.stop();
    await vi.runAllTimersAsync();
    expect(refresh).not.toHaveBeenCalled();
  });
});

/* Frueher loeste JEDE Speicherung in JEDER offenen Ansicht ein Nachladen aus:
   ein abgehakter Einkaufsartikel liess die sichtbare TRAINING-Seite ihre
   Ordner und Eintraege neu holen. Seit die Ereignisse ihren Bereich nennen,
   filtert der Abonnent - aber nur, wenn BEIDE Seiten einen Bereich angeben. */
describe('passtZumBereich', () => {
  it('laesst den eigenen Bereich durch', () => {
    expect(passtZumBereich('shopping', 'shopping')).toBe(true);
    expect(passtZumBereich('habits', ['habits', 'coins'])).toBe(true);
  });

  it('blockt fremde Bereiche', () => {
    expect(passtZumBereich('training', 'shopping')).toBe(false);
    expect(passtZumBereich('training', ['habits', 'coins'])).toBe(false);
  });

  it('laedt nach, wenn eine der beiden Angaben fehlt', () => {
    // Sicherheitsnetz: lieber einmal zu viel laden als veraltet anzeigen.
    expect(passtZumBereich(undefined, 'shopping')).toBe(true);
    expect(passtZumBereich('training', undefined)).toBe(true);
    expect(passtZumBereich('training', null)).toBe(true);
    expect(passtZumBereich(undefined, undefined)).toBe(true);
  });

  it('behandelt eine leere Liste als allgemein', () => {
    expect(passtZumBereich('training', [])).toBe(true);
    expect(passtZumBereich('training', [null])).toBe(true);
  });
});
