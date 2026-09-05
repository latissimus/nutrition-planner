/**
 * Refresh-Koordinator ohne Postgres-Realtime.
 *
 * Ursprünglich hielt jede Ansicht eine oder mehrere Supabase-Realtime-
 * Verbindungen offen. Auf dem iPhone summierten sich diese Kanäle (bis zu
 * 22 Subscriptions über die App verteilt) zu spürbaren Aussetzern und
 * langsamen Wechseln. Für eine Solo-Nutzer-App auf einem Gerät sind Live-
 * Updates aus der Datenbank unnötig: alle Änderungen entstehen lokal und
 * werden schon per notifyHomeCountsChanged/notifyCoinBalanceChanged nach
 * jedem Save propagiert.
 *
 * subscribeToTableChanges/subscribeToTablesChanges behalten deshalb ihre
 * Signatur, hören aber nur noch auf lokale App-Events plus die Rückkehr
 * in den Vordergrund (visibilitychange). Für Sharing-Szenarien sieht die
 * andere Person Änderungen beim nächsten Aufwachen der App – nicht live,
 * aber ohne den Perf-Preis.
 */

// Lokale Ereignisse: jeder Save streut sie, jeder Refresh hört mit.
export function notifyHomeCountsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('muscledex:counts-changed'));
}

export function notifyCoinBalanceChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('muscledex:coins-changed'));
}

/* Mehrere schnelle Anfragen (z. B. ein Rezeptimport) werden zu genau
   einem Nachladen zusammengefasst. Läuft bereits ein Abruf, folgt danach
   höchstens ein weiterer mit dem dann neuesten Stand. */
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

const REFRESH_EVENTS = ['muscledex:counts-changed', 'muscledex:coins-changed'];

function attachRefresh(request, signal) {
  if (typeof window === 'undefined') return () => {};
  const listener = () => request();
  const visibility = () => { if (document.visibilityState === 'visible') request(); };
  REFRESH_EVENTS.forEach((event) => window.addEventListener(event, listener));
  document.addEventListener('visibilitychange', visibility);
  const detach = () => {
    REFRESH_EVENTS.forEach((event) => window.removeEventListener(event, listener));
    document.removeEventListener('visibilitychange', visibility);
  };
  signal?.addEventListener('abort', detach, { once: true });
  return detach;
}

export function subscribeToTableChanges({ table, signal, onChange, onError }) {
  if (!table || typeof onChange !== 'function' || signal?.aborted) return () => {};
  const refresh = createRealtimeRefresh(onChange, { onError });
  const detach = attachRefresh(refresh.request, signal);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    refresh.stop();
    detach();
  };
}

export function subscribeToTablesChanges({ tables = [], signal, onChange, onError, delay = 90 }) {
  if (!tables.length || typeof onChange !== 'function' || signal?.aborted) return () => {};
  const refresh = createRealtimeRefresh(onChange, { delay, onError });
  const detach = attachRefresh(refresh.request, signal);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    refresh.stop();
    detach();
  };
}
