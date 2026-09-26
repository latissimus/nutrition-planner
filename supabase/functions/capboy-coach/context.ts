// Shared deterministic context of the free coach and the central COMP
// assessment: the facts (<comp_facts>) and the weekly time series
// (<timeseries>), both computed from the same rows. Pure functions without
// database access or npm imports, so the Edge Function and the evals in
// scripts/coach-evals run exactly the same code.

import { YPSI_FORMULA } from './knowledge.ts';

type Row = Record<string, any>;

// Rows as the Edge Function loads them, newest first.
export type ContextRows = {
  settings: Row | null;       // nutrition_settings
  weights: Row[];             // gemessen_am, kg
  skinfolds: Row[];           // gemessen_am, falten, standardisiert, messqualitaet
  waists: Row[];              // gemessen_am, cm, standardisiert
  performance: Row[];         // performed_on, exercise, category, estimated_1rm, volume
  sleep: Row[];               // sleep_date, bedtime, wake_time, quality, energy, awakenings, tags
  checkins: Row[];            // checkin_date, recovery, mood, hunger, illness, travel, unusual_meals
  nutritionEntries: Row[];    // log_date, energy_kcal, protein_g, carbs_g, fat_g
  dayStatus: Row[];           // log_date, complete, excluded
  routines: Row[];            // all routines (active and paused), ordered by position
  completions: Row[];         // routine_id, completed_on (last FETCH_WINDOW_DAYS days)
  ruleContext: Row;           // user_preferences comp:hautfalten-kontext-v1
};

// The facts keep their previous windows and row limits exactly; the time
// series looks back twelve weeks and therefore loads more rows. buildCompFacts
// cuts the rows back to the previous limits (secured by the fixture in
// scripts/coach-evals/fixtures).
export const FACT_WINDOW_DAYS = 42;
export const FACT_COMPLETION_DAYS = 30;
export const TIMESERIES_WEEKS = 12;
export const FETCH_WINDOW_DAYS = TIMESERIES_WEEKS * 7;
export const FACT_LIMITS = { weights: 90, skinfolds: 12, waists: 20, performance: 300, sleep: 42, checkins: 42 };
// Each at most one request (PostgREST caps a request at 1000 rows).
export const FETCH_LIMITS = { weights: 400, skinfolds: 40, waists: 60, performance: 1000, sleep: 120, checkins: 120 };
// At most this many exercises appear in the time series (most weeks with data first).
const MAX_EXERCISES = 15;

const DAY = 86_400_000;
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const round = (value: number | null, digits = 1) => value == null ? null : Number(value.toFixed(digits));

export function dateDaysAgo(now: Date, days: number) {
  const date = new Date(now.getTime());
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function durationMinutes(bedtime: string, wakeTime: string) {
  const toMinutes = (value: string) => {
    const [hours, minutes] = String(value || '0:0').split(':').map(Number);
    return (hours * 60) + minutes;
  };
  let duration = toMinutes(wakeTime) - toMinutes(bedtime);
  if (duration <= 0) duration += 24 * 60;
  return duration;
}

function foldTotal(row: Row | undefined) {
  if (!row) return null;
  if (Number.isFinite(Number(row.total))) return Number(row.total);
  const values = (YPSI_FORMULA.summenfalten.slugs || []).map((slug) => number(row.falten?.[slug])).filter((value) => value >= 0);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function rankedFolds(folds: Row = {}, calculationBasis = 'male') {
  const sex = calculationBasis === 'female' ? 'frau' : 'mann';
  const references = YPSI_FORMULA.referenzen[sex] as Row;
  const ranked = Object.entries(references).flatMap(([slug, reference]: [string, any]) => {
    const value = Number(folds?.[slug]);
    if (!Number.isFinite(value) || value < 0) return [];
    const middle = (Number(reference.min) + Number(reference.max)) / 2;
    return [{ slug, valueMm: value, reference: middle, score: Math.abs(value / 4 - middle), direction: value / 4 > middle ? 'ueber' : value / 4 < middle ? 'unter' : 'exakt' }];
  });
  const scores = ranked.map((item) => item.score).sort((left, right) => right - left);
  return ranked.map((item) => ({ ...item, rank: scores.indexOf(item.score) + 1 }))
    .sort((left, right) => left.rank - right.rank || right.score - left.score);
}

function relativeTrend(rows: Row[], dateKey: string, value: (row: Row) => number | null) {
  const sorted = [...rows].sort((a, b) => String(a[dateKey]).localeCompare(String(b[dateKey])));
  const usable = sorted.map(value).filter((item): item is number => item != null && Number.isFinite(item));
  if (usable.length < 2 || !usable[0]) return null;
  return round(((usable.at(-1)! - usable[0]) / usable[0]) * 100, 1);
}

// Facts of the last six weeks - the former snapshot of the coach, unchanged.
export function buildCompFacts(rows: ContextRows, now: Date) {
  const since42 = dateDaysAgo(now, FACT_WINDOW_DAYS);
  const since30 = dateDaysAgo(now, FACT_COMPLETION_DAYS);
  const settings = rows.settings;
  const weights = rows.weights.slice(0, FACT_LIMITS.weights);
  const skinfolds = rows.skinfolds.slice(0, FACT_LIMITS.skinfolds);
  const waists = rows.waists.slice(0, FACT_LIMITS.waists);
  const performance = rows.performance.slice(0, FACT_LIMITS.performance);
  const sleep = rows.sleep.slice(0, FACT_LIMITS.sleep);
  const checkins = rows.checkins.slice(0, FACT_LIMITS.checkins);
  const nutritionEntries = rows.nutritionEntries.filter((row) => String(row.log_date) >= since42);
  const dayStatus = rows.dayStatus.filter((row) => String(row.log_date) >= since42);
  const routines = rows.routines.filter((routine) => routine.active === true);
  const completions = rows.completions.filter((row) => String(row.completed_on) >= since30);

  const nutritionByDay = new Map<string, { kcal: number; protein: number; carbs: number; fat: number }>();
  for (const row of nutritionEntries) {
    const current = nutritionByDay.get(row.log_date) || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    current.kcal += number(row.energy_kcal);
    current.protein += number(row.protein_g);
    current.carbs += number(row.carbs_g);
    current.fat += number(row.fat_g);
    nutritionByDay.set(row.log_date, current);
  }
  const completeDates = new Set(dayStatus.filter((row) => row.complete && !row.excluded).map((row) => row.log_date));
  const nutritionDays = [...nutritionByDay.entries()].filter(([date]) => completeDates.has(date)).map(([, values]) => values);
  const sleepDurations = sleep.map((row) => durationMinutes(row.bedtime, row.wake_time));
  const latestWeight = weights[0] ? number(weights[0].kg) : null;
  const latestFold = foldTotal(skinfolds[0]);
  const oldestFold = foldTotal(skinfolds.at(-1));
  const latestWaist = waists[0] ? number(waists[0].cm) : null;
  const oldestWaist = waists.at(-1) ? number(waists.at(-1)!.cm) : null;

  const exerciseGroups = new Map<string, Row[]>();
  performance.forEach((row) => {
    const key = `${row.category}:${String(row.exercise).toLowerCase()}`;
    exerciseGroups.set(key, [...(exerciseGroups.get(key) || []), row]);
  });
  const exerciseTrends = [...exerciseGroups.values()].map((group) => relativeTrend(group, 'performed_on', (row) => number(row.estimated_1rm))).filter((value): value is number => value != null);

  const age = settings?.birth_date
    ? Math.floor((now.getTime() - new Date(`${settings.birth_date}T12:00:00`).getTime()) / 31_557_600_000)
    : null;
  const totalRoutineOpportunities = routines.reduce((sum, routine) => sum + Math.max(1, (routine.weekdays || []).length) * (30 / 7), 0);
  const latestFoldValues = skinfolds[0]?.falten || {};
  const foldRanks = rankedFolds(latestFoldValues, settings?.calculation_basis || 'male');

  return {
    generatedAt: now.toISOString(),
    period: { from: since42, to: now.toISOString().slice(0, 10) },
    profile: {
      age,
      heightCm: settings?.height_cm || null,
      goal: settings?.goal || 'unknown',
      calorieTarget: settings?.adaptive_target || settings?.custom_calorie_target || null,
    },
    bodyComposition: {
      currentWeightKg: latestWeight,
      weightMeasurements: weights.length,
      weightTrendPercent: relativeTrend(weights, 'gemessen_am', (row) => number(row.kg)),
      latestSkinfoldSumMm: latestFold,
      skinfoldChangeMm: latestFold != null && oldestFold != null ? round(latestFold - oldestFold) : null,
      skinfoldMeasurements: skinfolds.length,
      latestSkinfoldDate: skinfolds[0]?.gemessen_am || null,
      latestSkinfoldsMm: latestFoldValues,
      skinfoldRanking: foldRanks,
      skinfoldRatios: {
        quadricepsToHamstring: number(latestFoldValues.beinbizeps) ? round(number(latestFoldValues.quadrizeps) / number(latestFoldValues.beinbizeps), 3) : null,
        bicepsToTriceps: number(latestFoldValues.trizeps) ? round(number(latestFoldValues.bizeps) / number(latestFoldValues.trizeps), 3) : null,
        chinToCheek: number(latestFoldValues.wange) ? round(number(latestFoldValues.kinn) / number(latestFoldValues.wange), 3) : null,
      },
      measurementQuality: skinfolds[0]?.messqualitaet || null,
      standardized: skinfolds[0]?.standardisiert === true,
      latestWaistCm: latestWaist,
      waistChangeCm: latestWaist != null && oldestWaist != null ? round(latestWaist - oldestWaist) : null,
      waistMeasurements: waists.length,
    },
    training: {
      importedValues: performance.length,
      comparableExercises: exerciseTrends.length,
      averagePerformanceChangePercent: round(mean(exerciseTrends)),
    },
    sleep: {
      checkins: sleep.length,
      averageDurationMinutes: round(mean(sleepDurations), 0),
      averageQuality: round(mean(sleep.map((row) => number(row.quality)))),
      averageMorningEnergy: round(mean(sleep.map((row) => number(row.energy)))),
      averageAwakenings: round(mean(sleep.map((row) => number(row.awakenings)))),
      recentTags: [...new Set(sleep.slice(0, 14).flatMap((row) => row.tags || []))].slice(0, 12),
    },
    recovery: {
      checkins: checkins.length,
      averageRecovery: round(mean(checkins.map((row) => number(row.recovery)).filter(Boolean))),
      averageMood: round(mean(checkins.map((row) => number(row.mood)).filter(Boolean))),
      averageHunger: round(mean(checkins.map((row) => number(row.hunger)).filter(Boolean))),
      illnessDays: checkins.filter((row) => row.illness).length,
    },
    nutrition: {
      completeDays: nutritionDays.length,
      averageKcal: round(mean(nutritionDays.map((day) => day.kcal)), 0),
      averageProteinG: round(mean(nutritionDays.map((day) => day.protein)), 0),
      averageCarbsG: round(mean(nutritionDays.map((day) => day.carbs)), 0),
      averageFatG: round(mean(nutritionDays.map((day) => day.fat)), 0),
    },
    routines: {
      active: routines.map((routine) => routine.name).slice(0, 12),
      completionsLast30Days: completions.length,
      adherencePercent: totalRoutineOpportunities ? round((completions.length / totalRoutineOpportunities) * 100, 0) : null,
    },
    ruleContext: rows.ruleContext || {},
  };
}

// --------------------------------------------------------------------------
// Weekly time series
// --------------------------------------------------------------------------

// Monday of the ISO week of a YYYY-MM-DD date, as YYYY-MM-DD (UTC).
function mondayOf(date: string) {
  const day = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const offset = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - offset * DAY).toISOString().slice(0, 10);
}

function isoWeekLabel(monday: string) {
  const thursday = new Date(new Date(`${monday}T00:00:00Z`).getTime() + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

const plusDays = (date: string, days: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);

// Weekly aggregates of the last TIMESERIES_WEEKS ISO weeks (Monday to Sunday),
// oldest first, the current week marked as partial. Field names follow the
// facts so the same measurement has the same name in both blocks. A value is
// null when the week has no data for it. Changes are computed here, never by
// the model.
export function buildTimeseries(rows: ContextRows, now: Date, weeks = TIMESERIES_WEEKS) {
  const today = now.toISOString().slice(0, 10);
  const currentMonday = mondayOf(today);
  const mondays = Array.from({ length: weeks }, (_, index) => plusDays(currentMonday, -7 * (weeks - 1 - index)));
  const first = mondays[0];
  const inWindow = (date: unknown) => typeof date === 'string' && date.slice(0, 10) >= first && date.slice(0, 10) <= today;
  const byWeek = <T extends Row>(list: T[], key: string) => {
    const groups = new Map<string, T[]>(mondays.map((monday) => [monday, []]));
    for (const row of list) {
      if (!inWindow(row[key])) continue;
      groups.get(mondayOf(row[key]))?.push(row);
    }
    // Oldest first within the week, so "latest" is the last entry.
    for (const group of groups.values()) group.sort((a, b) => String(a[key]).localeCompare(String(b[key])));
    return groups;
  };

  const weights = byWeek(rows.weights, 'gemessen_am');
  const skinfolds = byWeek(rows.skinfolds, 'gemessen_am');
  const waists = byWeek(rows.waists, 'gemessen_am');
  const performance = byWeek(rows.performance, 'performed_on');
  const sleep = byWeek(rows.sleep, 'sleep_date');
  const checkins = byWeek(rows.checkins, 'checkin_date');
  const entries = byWeek(rows.nutritionEntries, 'log_date');
  const status = byWeek(rows.dayStatus, 'log_date');
  const completions = byWeek(rows.completions, 'completed_on');

  const series = mondays.map((monday) => {
    const sunday = plusDays(monday, 6);
    const weekWeights = weights.get(monday)!;
    const weekFolds = skinfolds.get(monday)!;
    const weekWaists = waists.get(monday)!;
    const weekSleep = sleep.get(monday)!;
    const weekCheckins = checkins.get(monday)!;
    const completeDates = new Set(status.get(monday)!.filter((row) => row.complete && !row.excluded).map((row) => row.log_date));
    const days = new Map<string, { kcal: number; protein: number }>();
    for (const row of entries.get(monday)!) {
      if (!completeDates.has(row.log_date)) continue;
      const current = days.get(row.log_date) || { kcal: 0, protein: 0 };
      current.kcal += number(row.energy_kcal);
      current.protein += number(row.protein_g);
      days.set(row.log_date, current);
    }
    const latestFold = weekFolds.at(-1);
    const latestWaist = weekWaists.at(-1);
    return {
      week: isoWeekLabel(monday),
      from: monday,
      to: sunday > today ? today : sunday,
      partial: sunday > today,
      bodyComposition: {
        weightMeasurements: weekWeights.length,
        averageWeightKg: round(mean(weekWeights.map((row) => number(row.kg)))),
        skinfoldMeasurements: weekFolds.length,
        latestSkinfoldSumMm: latestFold ? round(foldTotal(latestFold)) : null,
        latestSkinfoldStandardized: latestFold ? latestFold.standardisiert === true : null,
        latestSkinfoldQuality: latestFold?.messqualitaet || null,
        waistMeasurements: weekWaists.length,
        latestWaistCm: latestWaist ? round(number(latestWaist.cm)) : null,
      },
      nutrition: {
        completeDays: days.size,
        averageKcal: round(mean([...days.values()].map((day) => day.kcal)), 0),
        averageProteinG: round(mean([...days.values()].map((day) => day.protein)), 0),
      },
      training: {
        trainingDays: new Set(performance.get(monday)!.map((row) => String(row.performed_on).slice(0, 10))).size,
      },
      routines: {
        completions: completions.get(monday)!.length,
      },
      sleep: {
        checkins: weekSleep.length,
        averageDurationMinutes: round(mean(weekSleep.map((row) => durationMinutes(row.bedtime, row.wake_time))), 0),
        averageQuality: round(mean(weekSleep.map((row) => number(row.quality)))),
        averageMorningEnergy: round(mean(weekSleep.map((row) => number(row.energy)))),
      },
      recovery: {
        checkins: weekCheckins.length,
        averageRecovery: round(mean(weekCheckins.map((row) => number(row.recovery)).filter(Boolean))),
        averageMood: round(mean(weekCheckins.map((row) => number(row.mood)).filter(Boolean))),
        averageHunger: round(mean(weekCheckins.map((row) => number(row.hunger)).filter(Boolean))),
        illnessDays: weekCheckins.filter((row) => row.illness).length,
        travelDays: weekCheckins.filter((row) => row.travel).length,
      },
    };
  });

  // Changes between the first and the last week with data, so the model can
  // name a development without calculating it.
  const change = (values: (number | null)[]) => {
    const present = values.map((value, index) => ({ value, index })).filter((item) => item.value != null);
    if (present.length < 2) return { change: null, fromWeek: null, toWeek: null };
    const [start, end] = [present[0], present.at(-1)!];
    return { change: round(end.value! - start.value!), fromWeek: series[start.index].week, toWeek: series[end.index].week };
  };
  const weight = change(series.map((week) => week.bodyComposition.averageWeightKg));
  const folds = change(series.map((week) => week.bodyComposition.latestSkinfoldSumMm));
  const waist = change(series.map((week) => week.bodyComposition.latestWaistCm));

  // Routine completions per week and routine. Deliberately no adherence rate:
  // weekdays and active state are only known as they are today, earlier plan
  // changes cannot be reconstructed, so a historical quota would be invented.
  const routineIds = new Map(rows.routines.map((routine) => [routine.id, routine]));
  const routineSeries = [...rows.routines, ...[...new Set(rows.completions.map((row) => row.routine_id))]
    .filter((id) => !routineIds.has(id)).map((id) => ({ id, name: null, active: null }))]
    .map((routine) => {
      const weekly = mondays.map((monday) => completions.get(monday)!.filter((row) => row.routine_id === routine.id).length);
      return { name: routine.name ?? null, active: routine.active ?? null, weeklyCompletions: weekly, totalCompletions: weekly.reduce((sum, value) => sum + value, 0) };
    })
    .filter((routine) => routine.active === true || routine.totalCompletions > 0);

  // Training development per comparable exercise: best estimated 1RM per
  // week; comparable means at least two weeks with a value. The change runs
  // from the first to the last such week. Categories average their
  // exercises' changes.
  const exerciseGroups = new Map<string, Row[]>();
  for (const row of rows.performance) {
    if (!inWindow(row.performed_on) || !Number.isFinite(Number(row.estimated_1rm)) || Number(row.estimated_1rm) <= 0) continue;
    const key = `${row.category}:${String(row.exercise).toLowerCase()}`;
    exerciseGroups.set(key, [...(exerciseGroups.get(key) || []), row]);
  }
  const exercises = [...exerciseGroups.values()].map((group) => {
    const weekly = mondays.map((monday) => {
      const values = group.filter((row) => mondayOf(row.performed_on) === monday).map((row) => Number(row.estimated_1rm));
      return values.length ? round(Math.max(...values)) : null;
    });
    const present = weekly.map((value, index) => ({ value, index })).filter((item) => item.value != null);
    const [start, end] = [present[0], present.at(-1)];
    const comparable = present.length >= 2;
    return {
      exercise: group[0].exercise,
      category: group[0].category ?? null,
      sessions: new Set(group.map((row) => String(row.performed_on).slice(0, 10))).size,
      weeksWithValue: present.length,
      weeklyBestEstimated1rmKg: weekly,
      estimated1rmChangePercent: comparable ? round(((end!.value! - start!.value!) / start!.value!) * 100) : null,
      changeFromWeek: comparable ? isoWeekLabel(mondays[start!.index]) : null,
      changeToWeek: comparable ? isoWeekLabel(mondays[end!.index]) : null,
      comparable,
    };
  });
  const comparableExercises = exercises.filter((exercise) => exercise.comparable)
    .sort((a, b) => b.weeksWithValue - a.weeksWithValue || String(a.exercise).localeCompare(String(b.exercise)));
  const categories = [...new Set(comparableExercises.map((exercise) => exercise.category))].map((category) => {
    const own = comparableExercises.filter((exercise) => exercise.category === category);
    return { category, comparableExercises: own.length, averageEstimated1rmChangePercent: round(mean(own.map((exercise) => exercise.estimated1rmChangePercent!))) };
  }).sort((a, b) => String(a.category).localeCompare(String(b.category)));

  const events = rows.checkins
    .filter((row) => inWindow(row.checkin_date))
    .flatMap((row) => [
      row.illness ? { date: row.checkin_date, type: 'illness' } : null,
      row.travel ? { date: row.checkin_date, type: 'travel' } : null,
      row.unusual_meals ? { date: row.checkin_date, type: 'unusual_meals' } : null,
    ].filter(Boolean) as { date: string; type: string }[])
    .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

  return {
    window: { from: first, to: today, weeks },
    summary: {
      weightChangeKg: weight.change, weightChangeFromWeek: weight.fromWeek, weightChangeToWeek: weight.toWeek,
      skinfoldChangeMm: folds.change, skinfoldChangeFromWeek: folds.fromWeek, skinfoldChangeToWeek: folds.toWeek,
      waistChangeCm: waist.change, waistChangeFromWeek: waist.fromWeek, waistChangeToWeek: waist.toWeek,
      weeksWithWeight: series.filter((week) => week.bodyComposition.weightMeasurements > 0).length,
      weeksWithCompleteNutrition: series.filter((week) => week.nutrition.completeDays > 0).length,
    },
    weeks: series,
    events,
    routines: routineSeries,
    training: {
      categories,
      exercises: comparableExercises.slice(0, MAX_EXERCISES).map(({ comparable, ...exercise }) => exercise),
      comparableExercisesTotal: comparableExercises.length,
      nonComparableExercises: exercises.length - comparableExercises.length,
    },
  };
}
