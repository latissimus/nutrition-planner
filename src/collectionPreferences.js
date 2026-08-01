const STORAGE_KEY = 'muscledex:sichtbare-sammlungen';
const ORDER_KEY = 'muscledex:sammlungs-reihenfolge';

export const collectionRoutes = ['body', 'reminders', 'food-log', 'recipes', 'habits'];

export function collectionOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY));
    if (!Array.isArray(saved)) return [...collectionRoutes];
    const valid = saved.filter((route, index) => collectionRoutes.includes(route) && saved.indexOf(route) === index);
    return [...valid, ...collectionRoutes.filter((route) => !valid.includes(route))];
  } catch {
    return [...collectionRoutes];
  }
}

export function visibleCollectionRoutes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return collectionOrder();
    return collectionOrder().filter((route) => saved.includes(route));
  } catch {
    return [...collectionRoutes];
  }
}

export function collectionIsVisible(route) {
  return visibleCollectionRoutes().includes(route);
}

export function setCollectionVisible(route, visible) {
  if (!collectionRoutes.includes(route)) return;
  const selected = new Set(visibleCollectionRoutes());
  if (visible) selected.add(route);
  else selected.delete(route);
  const ordered = collectionOrder().filter((item) => selected.has(item));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered));
}

export function moveCollection(route, direction) {
  const order = collectionOrder();
  const from = order.indexOf(route);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return false;
  [order[from], order[to]] = [order[to], order[from]];
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  return true;
}
