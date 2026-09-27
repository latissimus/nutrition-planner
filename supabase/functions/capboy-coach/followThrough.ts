// What is missing or not followed through, across all areas: nutrition,
// weighing, skinfolds, waist, sleep, routines and training. Computed from the
// last FOLLOW_THROUGH_DAYS completed days; today is left out because it is
// rarely complete yet. The coach names these points, and COMP may recommend
// exactly their actions. Deterministic like the rest of the context: the
// model never decides by itself what counts as a gap.
//
// Thresholds follow the app's own rules where it has one (entries on 80 % of
// the days and three weighings per week, as in the calorie calibration;
// protein 1.8 g per kg as in the initial estimate; re-measuring skinfolds
// after three to four weeks, as in the skinfold plan) and established
// guidance otherwise (at least 7 hours of sleep for adults).
//
// Routines: planned days are counted with today's weekday settings. A plan
// changed within the window can make them slightly off; the app states only
// planned and completed days, never a quota.
//
// Pure module without imports, shared with the evals.

type Row = Record<string, any>;

export const FOLLOW_THROUGH_DAYS = 14;
const LIMITS = {
  loggedShare: 0.8,
  intakeLowPercent: 70,
  intakeHighPercent: 115,
  proteinPerKg: 1.8,
  proteinLowShare: 0.8,
  weighingsPerWeek: 3,
  measurementMaxDays: 28,
  sleepMinutes: 420,
  sleepQuality: 3,
  routineShare: 0.7,
  minDays: 5,
  routineMinPlanned: 4,
};

const DAY = 86_400_000;
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const round = (value: number | null, digits = 1) => value == null ? null : Number(value.toFixed(digits));
const plusDays = (date: string, days: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);
const day = (value: unknown) => (typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : null);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
const isoWeekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;

export function durationMinutes(bedtime: string, wakeTime: string) {
  const toMinutes = (value: string) => {
    const [hours, minutes] = String(value || '0:0').split(':').map(Number);
    return (hours * 60) + minutes;
  };
  let duration = toMinutes(wakeTime) - toMinutes(bedtime);
  if (duration <= 0) duration += 24 * 60;
  return duration;
}

// kind: "daten" (logging missing - later conclusions depend on it),
// "messung" (a body measurement is due), "umsetzung" (a plan is not kept),
// "verbesserung" (a value is below a sensible target). Most important first.
export function buildFollowThrough(rows: Row, now: Date) {
  const today = now.toISOString().slice(0, 10);
  const from = plusDays(today, -FOLLOW_THROUGH_DAYS);
  const to = plusDays(today, -1);
  const inWindow = (value: unknown) => { const date = day(value); return date != null && date >= from && date <= to; };
  const target = number(rows.settings?.custom_calorie_target) || number(rows.settings?.adaptive_target) || null;
  const latestWeight = rows.weights?.[0] ? number(rows.weights[0].kg) || null : null;
  const checks: Row[] = [];
  const add = (id: string, kind: string, area: string, values: Row, action: string) => checks.push({ id, kind, area, ...values, action });

  // Nutrition: days with entries, and what was entered against the targets.
  const nutritionDays = new Map<string, { kcal: number; protein: number }>();
  for (const row of rows.nutritionEntries || []) {
    if (!inWindow(row.log_date)) continue;
    const date = day(row.log_date)!;
    const current = nutritionDays.get(date) || { kcal: 0, protein: 0 };
    current.kcal += number(row.energy_kcal);
    current.protein += number(row.protein_g);
    nutritionDays.set(date, current);
  }
  const daysWithEntries = nutritionDays.size;
  const averageKcal = round(mean([...nutritionDays.values()].map((entry) => entry.kcal)), 0);
  const averageProteinG = round(mean([...nutritionDays.values()].map((entry) => entry.protein)), 0);
  const percentOfTarget = averageKcal != null && target ? round((averageKcal / target) * 100, 0) : null;
  const judgeIntake = daysWithEntries >= LIMITS.minDays && percentOfTarget != null;

  if (daysWithEntries < FOLLOW_THROUGH_DAYS * LIMITS.loggedShare) {
    add('ernaehrung-eintraege', 'daten', 'ernaehrung', { nutrition: { daysWithEntries, windowDays: FOLLOW_THROUGH_DAYS } },
      'Trag zwei Wochen lang an jedem Tag ein, was du isst und trinkst – auch an Tagen, die aus dem Rahmen fallen.');
  }
  if (judgeIntake && percentOfTarget! < LIMITS.intakeLowPercent) {
    // Either the entries are incomplete or the user eats far below the target.
    add('ernaehrung-weit-unter-ziel', 'daten', 'ernaehrung', { nutrition: { daysWithEntries, averageKcal, targetKcal: target, percentOfTarget } },
      'Prüfe zwei Wochen lang, ob wirklich alles eingetragen ist – auch Getränke, Snacks, Öl und Soßen. Isst du tatsächlich so wenig, besprich dein Kalorienziel mit dem Coach.');
  }

  // Weighing: at least three times a week.
  const weighings = (rows.weights || []).filter((row: Row) => inWindow(row.gemessen_am)).length;
  const weighingsPerWeek = round(weighings / (FOLLOW_THROUGH_DAYS / 7), 1)!;
  if (weighingsPerWeek < LIMITS.weighingsPerWeek) {
    add('gewicht-wiegen', 'daten', 'gewicht', { bodyComposition: { weightMeasurements: weighings, measurementsPerWeek: weighingsPerWeek } },
      'Wiege dich mindestens dreimal pro Woche, morgens nach dem Toilettengang und vor dem Essen.');
  }

  // Sleep: logged nights.
  const nights = (rows.sleep || []).filter((row: Row) => inWindow(row.sleep_date));
  if (nights.length < FOLLOW_THROUGH_DAYS * LIMITS.loggedShare) {
    add('schlaf-eintraege', 'daten', 'schlaf', { sleep: { checkins: nights.length, windowDays: FOLLOW_THROUGH_DAYS } },
      'Trag zwei Wochen lang jeden Morgen deinen Schlaf ein.');
  }

  // Training: imported LOGMAN values.
  const trainingDates = [...new Set((rows.performance || []).map((row: Row) => day(row.performed_on)).filter(Boolean) as string[])].sort();
  const trainingDays = trainingDates.filter((date) => date >= from && date <= to).length;
  if (!trainingDays) {
    add('training-daten', 'daten', 'training', { training: { trainingDays, lastTrainingDate: trainingDates.at(-1) || null } },
      'Importiere deine Trainingsdaten aus LOGMAN, damit der Coach deine Leistung einbeziehen kann.');
  }

  // Body measurements: skinfolds and waist every three to four weeks.
  const measurementDue = (list: Row[]) => {
    const latest = [...(list || [])].map((row) => day(row.gemessen_am)).filter(Boolean).sort().at(-1) || null;
    return { latest, daysSince: latest ? daysBetween(latest, today) : null, due: !latest || daysBetween(latest, today) > LIMITS.measurementMaxDays };
  };
  const skinfold = measurementDue(rows.skinfolds);
  if (skinfold.due) {
    add('hautfalten-messung', 'messung', 'hautfalten', { bodyComposition: { latestSkinfoldDate: skinfold.latest, daysSinceLastSkinfold: skinfold.daysSince } },
      'Miss deine Hautfalten erneut, unter denselben Bedingungen wie beim letzten Mal: gleiche Tageszeit, gleiche Körperseite.');
  } else {
    const latestRow = [...(rows.skinfolds || [])].sort((a, b) => String(b.gemessen_am).localeCompare(String(a.gemessen_am)))[0];
    if (latestRow?.standardisiert !== true) {
      add('hautfalten-standard', 'messung', 'hautfalten', { bodyComposition: { latestSkinfoldDate: skinfold.latest, latestSkinfoldStandardized: false } },
        'Miss die Hautfalten beim nächsten Mal standardisiert: gleiche Tageszeit, gleiche Körperseite, gleiche Bedingungen.');
    }
  }
  const waist = measurementDue(rows.waists);
  if (waist.due) {
    add('taille-messung', 'messung', 'taille', { bodyComposition: { latestWaistDate: waist.latest, daysSinceLastWaist: waist.daysSince } },
      'Miss deinen Taillenumfang erneut, morgens vor dem Essen an derselben Stelle.');
  }

  // Calorie target clearly exceeded.
  if (judgeIntake && percentOfTarget! > LIMITS.intakeHighPercent) {
    add('ernaehrung-ueber-ziel', 'umsetzung', 'ernaehrung', { nutrition: { daysWithEntries, averageKcal, targetKcal: target, percentOfTarget } },
      'Halte dein Kalorienziel zwei Wochen lang ein: Plane deine Mahlzeiten vorab im TRACKER und prüfe abends den Tagesstand.');
  }

  // Routines kept on clearly fewer days than planned.
  const completions = (rows.completions || []).filter((row: Row) => inWindow(row.completed_on));
  const windowDates = Array.from({ length: FOLLOW_THROUGH_DAYS }, (_, index) => plusDays(from, index));
  const routines = (rows.routines || []).filter((routine: Row) => routine.active === true).flatMap((routine: Row) => {
    const weekdays = new Set((routine.weekdays || []).map(Number));
    const created = day(routine.created_at);
    const plannedDays = windowDates.filter((date) => weekdays.has(isoWeekday(date)) && (!created || date >= created)).length;
    const completedDays = new Set(completions.filter((row: Row) => row.routine_id === routine.id).map((row: Row) => day(row.completed_on))).size;
    return plannedDays >= LIMITS.routineMinPlanned && completedDays < plannedDays * LIMITS.routineShare
      ? [{ name: String(routine.name || 'Routine').slice(0, 60), plannedDays, completedDays }] : [];
  }).sort((a: Row, b: Row) => a.completedDays / a.plannedDays - b.completedDays / b.plannedDays);
  if (routines.length) {
    add('routinen', 'umsetzung', 'routinen', { routines: routines.slice(0, 5) },
      `Hake „${routines[0].name}“ zwei Wochen lang an jedem geplanten Tag ab – oder plane die Routine seltener ein, wenn der Plan nicht zu deinem Alltag passt.`);
  }

  // Protein below 1.8 g per kg - only when the entries look complete enough.
  const proteinTargetG = latestWeight ? round(latestWeight * LIMITS.proteinPerKg, 0) : null;
  if (judgeIntake && percentOfTarget! >= LIMITS.intakeLowPercent && proteinTargetG && averageProteinG != null && averageProteinG < proteinTargetG * LIMITS.proteinLowShare) {
    add('protein-unter-ziel', 'verbesserung', 'ernaehrung', { nutrition: { daysWithEntries, averageProteinG, proteinTargetG } },
      'Plane zu jeder Hauptmahlzeit eine klare Proteinquelle ein, bis du im Schnitt dein Proteinziel erreichst.');
  }

  // Sleep duration and quality over the logged nights.
  if (nights.length >= LIMITS.minDays) {
    const averageDurationMinutes = round(mean(nights.map((row: Row) => durationMinutes(row.bedtime, row.wake_time))), 0)!;
    const averageQuality = round(mean(nights.map((row: Row) => number(row.quality)).filter(Boolean)));
    if (averageDurationMinutes < LIMITS.sleepMinutes) {
      add('schlaf-dauer', 'verbesserung', 'schlaf', { sleep: { checkins: nights.length, averageDurationMinutes } },
        'Plane zwei Wochen lang mindestens 7 Stunden Schlaf ein: Leg eine feste Zubettgehzeit fest und halte sie auch am Wochenende.');
    }
    if (averageQuality != null && averageQuality < LIMITS.sleepQuality) {
      add('schlaf-qualitaet', 'verbesserung', 'schlaf', { sleep: { checkins: nights.length, averageQuality } },
        'Halte zwei Wochen lang feste Schlafenszeiten ein und lass in der letzten Stunde vor dem Schlafen Bildschirme weg.');
    }
  }

  return { window: { from, to, days: FOLLOW_THROUGH_DAYS }, checks };
}

// The follow-through actions as allowed COMP actions, before the skinfold
// catalogue: what is missing comes first.
export function followThroughActions(followThrough: Row | null | undefined) {
  return (followThrough?.checks || []).map((check: Row) => ({
    id: `umsetzung-${check.id}`,
    category: check.area,
    action: check.action,
    source: 'app',
    evidence: null,
  }));
}
