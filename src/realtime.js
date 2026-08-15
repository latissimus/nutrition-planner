import { supabase } from './supabase.js';

// Lokaler Fallback für Zähler auf der Startseite. Er wird nach einem
// erfolgreichen Schreibvorgang ausgelöst, falls der Postgres-Realtime-Kanal
// auf dem Gerät verzögert oder gar nicht verbunden ist.
export function notifyHomeCountsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('muscledex:counts-changed'));
}

export function notifyCoinBalanceChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('muscledex:coins-changed'));
}

const zufallsId = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/* Mehrere schnelle Datenbankereignisse (etwa ein Rezeptimport) werden zu
   genau einem Nachladen zusammengefasst. Läuft bereits ein Abruf, folgt
   anschließend höchstens ein weiterer mit dem dann neuesten Stand. */
export function createRealtimeRefresh(onRefresh, { delay = 90, onError } = {}) {
  let timer = null;
  let running = false;
  let pending = false;
  let stopped = false;

  const run = async () => {
    timer = null;
    if (stopped) return;
    if (running) { pending = true; return; }
    running = true;
    try { await onRefresh(); }
    catch (error) { onError?.(error); }
    finally {
      running = false;
      if (pending && !stopped) {
        pending = false;
        timer = setTimeout(run, delay);
      }
    }
  };

  return {
    request() {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    },
    stop() {
      stopped = true;
      pending = false;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

export function subscribeToTableChanges({ table, signal, onChange, onError }) {
  if (!supabase || !table || typeof onChange !== 'function' || signal?.aborted) return () => {};
  const refresh = createRealtimeRefresh(onChange, { onError });
  const channel = supabase.channel(`muscledex:${table}:${zufallsId()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => refresh.request())
    .subscribe();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    refresh.stop();
    supabase.removeChannel(channel);
  };
  signal?.addEventListener('abort', close, { once: true });
  return close;
}
