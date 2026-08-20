const number = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const estimatedOneRepMax = (weight, repetitions) => {
  const kg = number(weight); const reps = number(repetitions);
  return kg > 0 && reps > 0 ? kg * (1 + reps / 30) : 0;
};

export function parseLogmanExport(input, fallbackDate = new Date().toISOString().slice(0, 10)) {
  const payload = input?.training?.payload || input?.payload || input?.training || input;
  const data = payload?.data || {};
  const fixedNames = payload?.ex || {};
  const dates = payload?.datum || {};
  const result = [];
  Object.entries(data).forEach(([day, cycles]) => {
    const isHeavy = day.endsWith('-H');
    const isMiddleDay = day.endsWith('-P');
    if (!isHeavy && !isMiddleDay) return;
    Object.entries(cycles || {}).forEach(([cycle, blocks]) => {
      Object.entries(blocks || {}).forEach(([blockId, entry]) => {
        // Freie Namen auf MIDDLES/PUMPS-Tagen sind PUMPS und nicht als
        // vergleichbarer Leistungsmarker vorgesehen.
        if (isMiddleDay && Array.isArray(entry?.names) && entry.names.some(Boolean)) return;
        const names = fixedNames?.[day]?.[blockId] || entry?.names || [];
        (entry?.sets || []).forEach((sets, exerciseIndex) => {
          const exercise = String(names[exerciseIndex] || '').trim();
          if (!exercise) return;
          const valid = (sets || []).map((set) => ({
            weight: number(set?.w), repetitions: number(set?.r),
          })).filter((set) => set.weight > 0 && set.repetitions > 0);
          if (!valid.length) return;
          const best = valid.reduce((winner, set) => estimatedOneRepMax(set.weight, set.repetitions) > estimatedOneRepMax(winner.weight, winner.repetitions) ? set : winner, valid[0]);
          result.push({
            performed_on: dates[`${day}|${cycle}`] || fallbackDate,
            exercise,
            category: isHeavy ? 'HEAVYS' : 'MIDDLES',
            weight_kg: best.weight,
            repetitions: best.repetitions,
            estimated_1rm: Math.round(estimatedOneRepMax(best.weight, best.repetitions) * 100) / 100,
            volume: Math.round(valid.reduce((sum, set) => sum + set.weight * set.repetitions, 0) * 100) / 100,
            source: 'LOGMAN-Import',
          });
        });
      });
    });
  });
  return result;
}

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
