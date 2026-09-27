// Personal experiments (step 6): the metrics an experiment can target, and the
// deterministic measurement the app computes from the weekly time series when
// an experiment is reviewed. The model never computes these values itself.
// Pure module without imports: used by the Edge Function, the evals and the
// app (labels on the memory page).

type Row = Record<string, any>;

export const EXPERIMENT_DIRECTIONS = ['steigt', 'sinkt', 'stabil'] as const;

// Metric id -> label for people, unit, and the weekly value it is read from.
// "kraft" has no single weekly value; it is measured per exercise below.
export const EXPERIMENT_METRICS: Record<string, { label: string; unit: string; value?: (week: Row) => number | null }> = {
  gewicht: { label: 'Gewicht (Wochenmittel)', unit: 'kg', value: (week) => week.bodyComposition?.averageWeightKg ?? null },
  faltensumme: { label: 'Hautfaltensumme', unit: 'mm', value: (week) => week.bodyComposition?.latestSkinfoldSumMm ?? null },
  taille: { label: 'Taillenumfang', unit: 'cm', value: (week) => week.bodyComposition?.latestWaistCm ?? null },
  kraft: { label: 'Kraft (geschätztes 1RM vergleichbarer Übungen)', unit: '%' },
  trainingstage: { label: 'Trainingstage pro Woche', unit: 'Tage', value: (week) => week.training?.trainingDays ?? null },
  kalorien: { label: 'Kalorien (Ø vollständige Tage)', unit: 'kcal', value: (week) => week.nutrition?.averageKcal ?? null },
  protein: { label: 'Protein (Ø vollständige Tage)', unit: 'g', value: (week) => week.nutrition?.averageProteinG ?? null },
  protokoll: { label: 'Vollständig protokollierte Tage', unit: 'Tage', value: (week) => week.nutrition?.completeDays ?? null },
  schlafdauer: { label: 'Schlafdauer', unit: 'min', value: (week) => week.sleep?.averageDurationMinutes ?? null },
  schlafqualitaet: { label: 'Schlafqualität', unit: '1–5', value: (week) => week.sleep?.averageQuality ?? null },
  morgenenergie: { label: 'Morgenenergie', unit: '1–5', value: (week) => week.sleep?.averageMorningEnergy ?? null },
  erholung: { label: 'Erholung', unit: '1–5', value: (week) => week.recovery?.averageRecovery ?? null },
  hunger: { label: 'Hunger', unit: '1–5', value: (week) => week.recovery?.averageHunger ?? null },
};
export const EXPERIMENT_METRIC_IDS = Object.keys(EXPERIMENT_METRICS);

const round = (value: number, digits = 1) => Number(value.toFixed(digits));
// Value with unit as people write it; scales as "3.4 von 5".
const withUnit = (value: number, unit: string) => (unit === '1–5' ? `${value} von 5` : `${value} ${unit}`);
const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const MISSING = {
  start_before_timeseries: 'der Start liegt vor dem Zwölf-Wochen-Verlauf',
  start_after_timeseries: 'der Start liegt nach dem Verlauf',
  no_value_before_start: 'kein Wert vor dem Start',
  no_completed_week_with_value_after_start: 'noch keine abgeschlossene Woche mit Wert nach dem Start',
  no_comparable_exercise_before_and_after_start: 'keine vergleichbare Übung mit Werten vor und nach dem Start',
};

// Value before and after the start of an experiment, from the weekly series:
// baseline = last week with a value BEFORE the start week, current = last
// completed week with a value AFTER the start week. The start week itself
// mixes both states and is left out; so is the running, incomplete week.
// Returns null when the metric is unknown or no series exists, and a result
// with null values and a reason when one side is missing.
export function experimentMeasurement(metricId: string | null | undefined, startDate: string | null | undefined, timeseries: Row | null | undefined) {
  const metric = metricId ? EXPERIMENT_METRICS[metricId] : null;
  const weeks: Row[] = timeseries?.weeks || [];
  if (!metric || !weeks.length || !startDate) return null;
  const start = String(startDate).slice(0, 10);
  const startIndex = weeks.findIndex((week) => start >= week.from && start <= week.to);
  const empty = (reason: keyof typeof MISSING) => ({
    metric: metricId, label: metric.label, unit: metric.unit, baselineWeek: null, baselineValue: null, currentWeek: null, currentValue: null, change: null,
    reason, text: `${metric.label}: nicht messbar – ${MISSING[reason]}`,
  });
  if (startIndex < 0) return empty(start < weeks[0].from ? 'start_before_timeseries' : 'start_after_timeseries');
  const before = weeks.map((week, index) => ({ week, index })).filter(({ index }) => index < startIndex);
  const after = weeks.map((week, index) => ({ week, index })).filter(({ week, index }) => index > startIndex && !week.partial);

  if (metricId === 'kraft') {
    const changes = (timeseries?.training?.exercises || []).flatMap((exercise: Row) => {
      const values: (number | null)[] = exercise.weeklyBestEstimated1rmKg || [];
      const base = before.filter(({ index }) => values[index] != null).at(-1);
      const now = after.filter(({ index }) => values[index] != null).at(-1);
      return base && now ? [((values[now.index]! - values[base.index]!) / values[base.index]!) * 100] : [];
    });
    if (!changes.length) return empty('no_comparable_exercise_before_and_after_start');
    const change = round(mean(changes));
    return {
      metric: metricId, label: metric.label, unit: metric.unit, baselineWeek: null, baselineValue: null, currentWeek: null, currentValue: null,
      change, comparableExercises: changes.length, reason: null,
      text: `${metric.label}: Veränderung ${signed(change)} % im Mittel von ${changes.length} vergleichbaren Übungen`,
    };
  }

  const base = before.map(({ week }) => ({ week, value: metric.value!(week) })).filter(({ value }) => value != null).at(-1);
  const now = after.map(({ week }) => ({ week, value: metric.value!(week) })).filter(({ value }) => value != null).at(-1);
  if (!base) return empty('no_value_before_start');
  if (!now) return empty('no_completed_week_with_value_after_start');
  const change = round(now.value! - base.value!);
  return {
    metric: metricId, label: metric.label, unit: metric.unit,
    baselineWeek: base.week.week, baselineValue: base.value, currentWeek: now.week.week, currentValue: now.value,
    change, reason: null,
    text: `${metric.label}: ${withUnit(base.value!, metric.unit)} (${base.week.week}) → ${withUnit(now.value!, metric.unit)} (${now.week.week}), Veränderung ${metric.unit === '1–5' ? signed(change) : `${signed(change)} ${metric.unit}`}`,
  };
}
