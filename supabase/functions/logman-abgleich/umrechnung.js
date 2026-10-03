// Umrechnung eines LOGMAN-Trainingsstands in Leistungszeilen (logman_performance):
// je Übung und Tag der beste Satz als geschätztes 1RM (Epley) plus Volumen.
// Eine einzige Fassung für beide Wege: Die Edge Function logman-abgleich
// rechnet damit beim automatischen Abgleich, die App (src/logmanImport.js)
// beim Import einer Exportdatei. Zwei Kopien würden auseinanderlaufen, und ein
// falscher Wert sähe aus wie ein richtiger.
// Reines JavaScript ohne Abhängigkeiten, damit Vite und Deno es laden.

const number = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const estimatedOneRepMax = (weight, repetitions) => {
  const kg = number(weight); const reps = number(repetitions);
  return kg > 0 && reps > 0 ? kg * (1 + reps / 30) : 0;
};

// Einheiten („Tag|Cycle“, z. B. „OK-H|3“) mit mindestens einem eingetragenen
// Satz. LOGMAN legt beim bloßen Ansehen eines Tages leere Blöcke an; die
// zählen nicht.
export function einheitenMitSaetzen(input) {
  const payload = input?.training?.payload || input?.payload || input?.training || input;
  const schluessel = [];
  Object.entries(payload?.data || {}).forEach(([day, cycles]) => {
    Object.entries(cycles || {}).forEach(([cycle, blocks]) => {
      const hatSatz = Object.values(blocks || {}).some((entry) => (entry?.sets || []).some((sets) => (sets || [])
        .some((set) => number(set?.w) >= 0 && String(set?.w ?? '').trim() !== '' && number(set?.r) > 0)));
      if (hatSatz) schluessel.push(`${day}|${cycle}`);
    });
  });
  return schluessel;
}

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
