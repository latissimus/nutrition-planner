import { getPreference, setPreference } from './userPreferences.js';

const STORAGE_KEY = 'muscledex:sichtbare-sammlungen';
const ORDER_KEY = 'muscledex:sammlungs-reihenfolge';
const CUSTOM_HIDDEN_KEY = 'muscledex:eigene-dex-ausgeblendet';
const CUSTOM_ORDER_KEY = 'muscledex:eigene-dex-reihenfolge';
const COIN_DEX_VISIBLE_KEY = 'muscledex:coin-dex-sichtbar';
const SLEEP_DEX_MIGRATED_KEY = 'muscledex:sleep-dex-sichtbarkeit-v1';
const STRESS_DEX_MIGRATED_KEY = 'muscledex:stress-dex-sichtbarkeit-v1';
const SUPPS_DEX_MIGRATED_KEY = 'muscledex:supps-dex-sichtbarkeit-v1';
const SUPPS_DEX_ORDER_MIGRATED_KEY = 'muscledex:supps-dex-reihenfolge-v1';
const ESSEN_DEX_MIGRATED_KEY = 'muscledex:essen-dex-sichtbarkeit-v1';
const ESSEN_DEX_ORDER_MIGRATED_KEY = 'muscledex:essen-dex-reihenfolge-v1';

export const collectionRoutes = ['food-log', 'essen', 'reminders', 'supps', 'sleep', 'shopping', 'habits', 'training', 'body', 'stress'];

function suppsInBestehendeReihenfolgeEinfuegen(saved) {
  const withoutSupps = saved.filter((route) => route !== 'supps');
  const trackerIndex = withoutSupps.indexOf('reminders');
  withoutSupps.splice(trackerIndex >= 0 ? trackerIndex + 1 : withoutSupps.length, 0, 'supps');
  return withoutSupps;
}

function essenInBestehendeReihenfolgeEinfuegen(saved) {
  const withoutEssen = saved.filter((route) => route !== 'essen');
  const rezepteIndex = withoutEssen.indexOf('food-log');
  withoutEssen.splice(rezepteIndex >= 0 ? rezepteIndex + 1 : 0, 0, 'essen');
  return withoutEssen;
}

export function collectionOrder() {
  try {
    let saved = getPreference(ORDER_KEY);
    if (!Array.isArray(saved)) return [...collectionRoutes];
    if (!getPreference(SUPPS_DEX_ORDER_MIGRATED_KEY, false)) {
      saved = suppsInBestehendeReihenfolgeEinfuegen(saved);
      setPreference(ORDER_KEY, saved);
      setPreference(SUPPS_DEX_ORDER_MIGRATED_KEY, true);
    }
    if (!getPreference(ESSEN_DEX_ORDER_MIGRATED_KEY, false)) {
      saved = essenInBestehendeReihenfolgeEinfuegen(saved);
      setPreference(ORDER_KEY, saved);
      setPreference(ESSEN_DEX_ORDER_MIGRATED_KEY, true);
    }
    const valid = saved.filter((route, index) => collectionRoutes.includes(route) && saved.indexOf(route) === index);
    return [...valid, ...collectionRoutes.filter((route) => !valid.includes(route))];
  } catch {
    return [...collectionRoutes];
  }
}

export function visibleCollectionRoutes() {
  try {
    let saved = getPreference(STORAGE_KEY);
    if (Array.isArray(saved) && !getPreference(SLEEP_DEX_MIGRATED_KEY, false)) {
      saved = [...new Set([...saved, 'sleep'])];
      setPreference(STORAGE_KEY, saved);
      setPreference(SLEEP_DEX_MIGRATED_KEY, true);
    }
    if (Array.isArray(saved) && !getPreference(STRESS_DEX_MIGRATED_KEY, false)) {
      saved = [...new Set([...saved, 'stress'])];
      setPreference(STORAGE_KEY, saved);
      setPreference(STRESS_DEX_MIGRATED_KEY, true);
    }
    if (Array.isArray(saved) && !getPreference(SUPPS_DEX_MIGRATED_KEY, false)) {
      saved = [...new Set([...saved, 'supps'])];
      setPreference(STORAGE_KEY, saved);
      setPreference(SUPPS_DEX_MIGRATED_KEY, true);
    }
    if (Array.isArray(saved) && !getPreference(ESSEN_DEX_MIGRATED_KEY, false)) {
      saved = [...new Set([...saved, 'essen'])];
      setPreference(STORAGE_KEY, saved);
      setPreference(ESSEN_DEX_MIGRATED_KEY, true);
    }
    if (!Array.isArray(saved)) return collectionOrder();
    return collectionOrder().filter((route) => saved.includes(route));
  } catch {
    return [...collectionRoutes];
  }
}

export function collectionIsVisible(route) {
  return visibleCollectionRoutes().includes(route);
}

export function coinDexIsVisible() {
  return getPreference(COIN_DEX_VISIBLE_KEY, true) !== false;
}

export function setCoinDexVisible(visible) {
  setPreference(COIN_DEX_VISIBLE_KEY, Boolean(visible));
}

export function setCollectionVisible(route, visible) {
  if (!collectionRoutes.includes(route)) return;
  const selected = new Set(visibleCollectionRoutes());
  if (visible) selected.add(route);
  else selected.delete(route);
  const ordered = collectionOrder().filter((item) => selected.has(item));
  setPreference(STORAGE_KEY, ordered);
}

export function moveCollection(route, direction) {
  const order = collectionOrder();
  const from = order.indexOf(route);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return false;
  [order[from], order[to]] = [order[to], order[from]];
  setPreference(ORDER_KEY, order);
  return true;
}

const gespeicherteListe = (key) => {
  try { const value = getPreference(key); return Array.isArray(value) ? value : []; }
  catch { return []; }
};

export function orderCustomCollections(items) {
  const ids = items.map((item) => item.id);
  const saved = gespeicherteListe(CUSTOM_ORDER_KEY).filter((id, index, all) => ids.includes(id) && all.indexOf(id) === index);
  const order = [...saved, ...ids.filter((id) => !saved.includes(id))];
  const byId = new Map(items.map((item) => [item.id, item]));
  return order.map((id) => byId.get(id)).filter(Boolean);
}

export const customCollectionIsVisible = (id) => !gespeicherteListe(CUSTOM_HIDDEN_KEY).includes(id);

export function setCustomCollectionVisible(id, visible) {
  const hidden = new Set(gespeicherteListe(CUSTOM_HIDDEN_KEY));
  if (visible) hidden.delete(id); else hidden.add(id);
  setPreference(CUSTOM_HIDDEN_KEY, [...hidden]);
}

export function moveCustomCollection(items, id, direction) {
  const order = orderCustomCollections(items).map((item) => item.id);
  const from = order.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return false;
  [order[from], order[to]] = [order[to], order[from]];
  setPreference(CUSTOM_ORDER_KEY, order);
  return true;
}
