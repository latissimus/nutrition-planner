export const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

// "Neu" ist bewusst kein gespeicherter Zustand. Der Stern entsteht nur aus
// einem noch vorhandenen Datensatz und verschwindet deshalb automatisch,
// sobald dieser geloescht wurde oder das 24-Stunden-Fenster verlassen hat.
export function isFresh(timestamp, now = Date.now()) {
  if (!timestamp) return false;
  const createdAt = new Date(timestamp).getTime();
  return Number.isFinite(createdAt) && createdAt <= now && now - createdAt < NEW_WINDOW_MS;
}
