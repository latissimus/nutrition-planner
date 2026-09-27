// Weekly check-in (step 7 of the coach plan): the review of the last completed
// ISO week against the week before. Every number here is computed by the app
// from the weekly time series; the model only interprets. Pure module (its
// only import is experiments.ts): used by the Edge Function, the evals and the
// app (week label, circumstances).

import { EXPERIMENT_METRICS } from './experiments.ts';

type Row = Record<string, any>;

// What the user can report about the week, id -> text the model reads.
export const WEEKLY_CIRCUMSTANCES: Record<string, string> = {
  krank: 'krank oder angeschlagen',
  unterwegs: 'unterwegs oder auf Reisen',
  stress: 'viel Stress',
  wenig_schlaf: 'wenig oder schlecht geschlafen',
  ausnahme: 'Feier, Urlaub oder andere Ausnahmetage',
};
export const WEEKLY_NOTE_MAX = 300;
const WEEKLY_ADHERENCE = new Set(['unbekannt', 'kaum', 'teilweise', 'ueberwiegend', 'voll']);
// Compared week against week: every experiment metric with a weekly value.
export const WEEKLY_METRICS = Object.keys(EXPERIMENT_METRICS).filter((id) => EXPERIMENT_METRICS[id].value);

const DAY = 86_400_000;
const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const withUnit = (value: number, unit: string) => (unit === '1–5' ? `${value} von 5` : `${value} ${unit}`);
const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

// The <user_question> of a weekly check-in: it only names the week.
export const weeklyQuestion = (week: string) => `Wochenbilanz für ${week}`;

// ISO week label and Monday-to-Sunday range of a date (UTC, as in context.ts).
export function isoWeek(date: string) {
  const day = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const monday = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY);
  const thursday = new Date(monday.getTime() + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const number = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY / 7) + 1;
  return {
    week: `${year}-W${String(number).padStart(2, '0')}`,
    from: monday.toISOString().slice(0, 10),
    to: new Date(monday.getTime() + 6 * DAY).toISOString().slice(0, 10),
  };
}

// The week a check-in reviews on a given day: the last completed week.
export function lastCompletedWeek(today: string) {
  return isoWeek(new Date(Date.parse(`${today.slice(0, 10)}T00:00:00Z`) - 7 * DAY).toISOString());
}

// The week to review in the time series and the week before: the last week
// whose Sunday is over. The series already counts a week as complete on its
// Sunday (partial is false once Sunday is today); a review waits until Monday,
// as lastCompletedWeek() does for the card in the app.
export function reviewWeeks(timeseries: Row | null | undefined) {
  const weeks: Row[] = timeseries?.weeks || [];
  const today = timeseries?.window?.to;
  const index = weeks.findLastIndex((week) => !week.partial && (!today || week.to < today));
  return index < 0 ? null : { current: weeks[index], previous: index > 0 ? weeks[index - 1] : null };
}

// Only known circumstances and a short note; anything else is dropped.
export function sanitizeWeeklyReport(report: Row | null | undefined, knownInterventions: Row[] = []) {
  const circumstances = [...new Set((Array.isArray(report?.circumstances) ? report!.circumstances : [])
    .filter((id: unknown) => typeof id === 'string' && id in WEEKLY_CIRCUMSTANCES))] as string[];
  const note = String(report?.note ?? '').replace(/\s+/g, ' ').trim().slice(0, WEEKLY_NOTE_MAX);
  // The client submits only id + adherence. Action text and active status come
  // from the authenticated user's database rows, never from client text.
  const known = new Map(knownInterventions.filter((row) => row?.status === 'aktiv').map((row) => [String(row.id), row]));
  const seen = new Set<string>();
  const interventions = (Array.isArray(report?.interventions) ? report!.interventions : []).slice(0, 12).flatMap((item: Row) => {
    const id = String(item?.id || '');
    const row = known.get(id);
    const adherence = String(item?.adherence || '');
    if (!row || seen.has(id) || !WEEKLY_ADHERENCE.has(adherence)) return [];
    seen.add(id);
    return [{ id: String(row.id), action: String(row.action || '').replace(/\s+/g, ' ').trim().slice(0, 500), adherence }];
  });
  return { circumstances, note, interventions };
}

// The focus proposed in the previous weekly review (only its actions).
export function previousFocus(row: Row | null | undefined) {
  const actions = (row?.result?.recommendations || [])
    .map((item: Row) => String(item?.action || '').trim().slice(0, 300)).filter(Boolean).slice(0, 3);
  return row?.week && actions.length ? { week: row.week, focus: actions } : null;
}

// The weeklyCheckin object embedded in <timeseries>. null when the series has
// no completed week.
export function weeklyBlock(timeseries: Row | null | undefined, report: Row | null | undefined, previousReview: Row | null = null, knownInterventions: Row[] = []) {
  const weeks = reviewWeeks(timeseries);
  if (!weeks) return null;
  const { current, previous } = weeks;
  const comparison = WEEKLY_METRICS.flatMap((id) => {
    const metric = EXPERIMENT_METRICS[id];
    const now = metric.value!(current);
    const before = previous ? metric.value!(previous) : null;
    if (now == null && before == null) return [];
    const change = now != null && before != null ? round(now - before) : null;
    const side = (value: number | null, week: Row | null) => (value != null ? `${withUnit(value, metric.unit)} (${week!.week})` : `kein Wert (${week?.week || 'keine Vorwoche'})`);
    const changeText = change == null ? '' : `, Veränderung ${metric.unit === '1–5' ? signed(change) : `${signed(change)} ${metric.unit}`}`;
    return [{
      metric: id, label: metric.label, unit: metric.unit, previous: before, current: now, change,
      text: `${metric.label}: ${side(before, previous)} → ${side(now, current)}${changeText}`,
    }];
  });
  const { circumstances, note, interventions } = sanitizeWeeklyReport(report, knownInterventions);
  return {
    week: current.week,
    from: current.from,
    to: current.to,
    previousWeek: previous?.week ?? null,
    comparison,
    notMeasuredThisWeek: WEEKLY_METRICS.filter((id) => EXPERIMENT_METRICS[id].value!(current) == null).map((id) => EXPERIMENT_METRICS[id].label),
    loggedIllnessDays: current.recovery?.illnessDays ?? 0,
    loggedTravelDays: current.recovery?.travelDays ?? 0,
    userReport: { circumstances: circumstances.map((id) => WEEKLY_CIRCUMSTANCES[id]), note },
    interventionAdherence: interventions,
    previousReview: previousFocus(previousReview),
  };
}
