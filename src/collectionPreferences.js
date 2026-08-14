import { getPreference, setPreference } from './userPreferences.js';

const STORAGE_KEY = 'muscledex:sichtbare-sammlungen';
const ORDER_KEY = 'muscledex:sammlungs-reihenfolge';
const CUSTOM_HIDDEN_KEY = 'muscledex:eigene-dex-ausgeblendet';
const CUSTOM_ORDER_KEY = 'muscledex:eigene-dex-reihenfolge';
const COIN_DEX_VISIBLE_KEY = 'muscledex:coin-dex-sichtbar';

export const collectionRoutes = ['body', 'reminders', 'food-log', 'training', 'shopping', 'habits'];

export function collectionOrder() {
  try {
    const saved = getPreference(ORDER_KEY);
    if (!Array.isArray(saved)) return [...collectionRoutes];
    const valid = saved.filter((route, index) => collectionRoutes.includes(route) && saved.indexOf(route) === index);
    return [...valid, ...collectionRoutes.filter((route) => !valid.includes(route))];
  } catch {
    return [...collectionRoutes];
  }
}

export function visibleCollectionRoutes() {
  try {
    const saved = getPreference(STORAGE_KEY);
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
