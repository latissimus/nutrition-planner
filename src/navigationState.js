/**
 * Kleine, DOM-unabhaengige Navigationsbausteine. Die Animationen bleiben in
 * main.js; Richtung und Cache-Lebenszyklus lassen sich hier separat testen.
 */
export function createRouteStack(initialRoute = 'home') {
  let routes = [initialRoute || 'home'];

  return {
    navigate(targetRoute) {
      const target = targetRoute || 'home';
      if (routes[routes.length - 1] === target) return 'gleich';
      const previousIndex = routes.lastIndexOf(target);
      if (previousIndex >= 0) {
        routes = routes.slice(0, previousIndex + 1);
        return 'zurueck';
      }
      routes.push(target);
      return 'vor';
    },

    isPrevious(targetRoute) {
      return routes.length >= 2 && routes[routes.length - 2] === (targetRoute || 'home');
    },

    snapshot() {
      return [...routes];
    },

    reset(route = 'home') {
      routes = [route || 'home'];
    },
  };
}

export function createLruCache({ limit = 10, onEvict = () => {} } = {}) {
  const entries = new Map();
  const maximum = Math.max(1, Number(limit) || 10);

  const evict = (key, value) => {
    entries.delete(key);
    onEvict(value, key);
  };

  return {
    peek(key) {
      return entries.get(key);
    },

    take(key) {
      const value = entries.get(key);
      if (value !== undefined) entries.delete(key);
      return value;
    },

    set(key, value) {
      if (!key) return;
      const previous = entries.get(key);
      if (previous && previous !== value && previous.node !== value?.node) onEvict(previous, key);
      entries.delete(key);
      entries.set(key, value);
      while (entries.size > maximum) {
        const [oldestKey, oldestValue] = entries.entries().next().value;
        evict(oldestKey, oldestValue);
      }
    },

    delete(key) {
      const value = entries.get(key);
      if (value === undefined) return false;
      evict(key, value);
      return true;
    },

    clear() {
      [...entries].forEach(([key, value]) => evict(key, value));
    },

    keys() {
      return [...entries.keys()];
    },

    get size() {
      return entries.size;
    },
  };
}

export function disposeViewEntry(entry) {
  if (!entry) return;
  entry.controller?.abort?.();
  entry.node?.querySelectorAll?.('audio,video')?.forEach((media) => {
    try { media.pause?.(); } catch {}
  });
  entry.node?.querySelectorAll?.('iframe')?.forEach((frame) => frame.removeAttribute?.('src'));
  entry.node?.remove?.();
}
