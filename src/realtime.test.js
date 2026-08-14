import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRealtimeRefresh } from './realtime.js';

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
