export { estimatedOneRepMax, parseLogmanExport } from '../supabase/functions/logman-abgleich/umrechnung.js';

const number = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function performanceTrend(rows = []) {
  if (rows.length < 2) return { direction: null, comparableSessions: rows.length, percent: 0 };
  const byExercise = new Map();
  rows.forEach((row) => {
    const key = `${row.category}:${String(row.exercise).toLowerCase()}`;
    byExercise.set(key, [...(byExercise.get(key) || []), row]);
  });
  const changes = [...byExercise.values()].flatMap((series) => {
    const ordered = series.sort((a, b) => a.performed_on.localeCompare(b.performed_on));
    if (ordered.length < 2) return [];
    const first = number(ordered[0].estimated_1rm); const last = number(ordered.at(-1).estimated_1rm);
    return first ? [(last - first) / first * 100] : [];
  });
  if (!changes.length) return { direction: null, comparableSessions: rows.length, percent: 0 };
  const average = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  return { direction: average > 1 ? 1 : average < -1 ? -1 : 0, comparableSessions: rows.length, percent: Math.round(average * 10) / 10 };
}
