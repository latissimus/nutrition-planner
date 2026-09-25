import { supabase } from './supabase.js';
import { confirmedTrendChange, evaluateBodyComp, weightTrendSummary } from './bodyComposition.js';
import { performanceTrend } from './logmanImport.js';
import { FALTEN, summe } from './measurements.js';
import { buildSkinfoldActionPlan, buildSkinfoldPlan } from './ypsiAssessment.js';

const round = (value, digits = 1) => Number.isFinite(Number(value))
  ? Number(Number(value).toFixed(digits)) : null;
const completeFolds = (folds = {}) => FALTEN.every(([slug]) => Number.isFinite(Number(folds?.[slug])));

function recoveryTrend(sleep = [], checkins = []) {
  const values = [
    ...sleep.map((row) => (Number(row.quality) + Number(row.energy)) / 2),
    ...checkins.map((row) => Number(row.recovery)).filter(Boolean),
  ].filter(Number.isFinite);
  if (values.length < 6) return null;
  const split = Math.floor(values.length / 2);
  const mean = (list) => list.reduce((sumValue, value) => sumValue + value, 0) / list.length;
  const difference = mean(values.slice(split)) - mean(values.slice(0, split));
  return difference > 0.3 ? 1 : difference < -0.3 ? -1 : 0;
}

function dateSpanWeeks(state) {
  const dates = [
    ...state.weights.map((row) => row.gemessen_am),
    ...state.skinfolds.map((row) => row.gemessen_am),
    ...state.waists.map((row) => row.gemessen_am),
  ].filter(Boolean).sort();
  if (dates.length < 2) return 0;
  return Math.max(0, (new Date(`${dates.at(-1)}T12:00:00`) - new Date(`${dates[0]}T12:00:00`)) / 604_800_000);
}

function allowedActions(plan) {
  if (!plan) return [];
  return ['nutrition', 'dailyLife', 'sleep'].flatMap((category) => (
    (plan.categories?.[category] || []).map((item, index) => ({
      id: `${category}-${index + 1}`,
      category,
      action: item.text,
      source: item.source,
      evidence: item.evidence || null,
    }))
  )).slice(0, 18);
}

export function buildCompEvidence(state, context = {}) {
  const completeSkinfolds = state.skinfolds.filter((row) => completeFolds(row.falten));
  const latestSkinfold = completeSkinfolds.at(-1) || null;
  const previousSkinfold = completeSkinfolds.at(-2) || null;
  const latestWaist = state.waists.at(-1) || null;
  const weight = weightTrendSummary(state.weights, state.settings.bodycomp_thresholds || undefined);
  const skinfoldDelta = confirmedTrendChange(completeSkinfolds, (row) => row.total ?? summe(row.falten), 2);
  const waistDelta = confirmedTrendChange(state.waists, (row) => Number(row.cm), 0.5);
  const training = performanceTrend(state.performance);
  const recovery = recoveryTrend(state.sleep, state.checkins);
  const weeks = dateSpanWeeks(state);
  const deterministic = evaluateBodyComp({
    weight,
    skinfoldDelta,
    waistDelta,
    performanceTrend: training.direction,
    recoveryTrend: recovery,
    weeks,
  });
  const calculationBasis = state.settings.calculation_basis === 'female' ? 'female' : 'male';
  const skinfoldPlan = buildSkinfoldPlan(completeSkinfolds, calculationBasis, context);
  const actionPlan = buildSkinfoldActionPlan(skinfoldPlan, context);
  const folds = latestSkinfold?.falten || {};
  const ranked = (skinfoldPlan?.rankedFolds || []).map((item) => ({
    slug: item.slug,
    label: item.label,
    valueMm: round(item.value),
    rank: item.foldPriority,
    direction: item.richtung,
    relativeToReference: round(item.relative, 3),
  }));
  const factors = (skinfoldPlan?.factorAssessment?.factors || []).map((factor) => ({
    id: factor.id,
    factor: factor.faktor,
    status: factor.status,
    source: factor.quelle,
    unansweredQuestionIds: factor.unansweredQuestionIds,
    matchedCounterfolds: factor.matchedCounterfolds,
  }));

  return {
    calculationVersion: 'comp-central-v1',
    generatedAt: new Date().toISOString(),
    objectiveFacts: {
      weight: {
        currentKg: round(state.weights.at(-1)?.kg),
        average7Kg: weight.average7Kg ?? null,
        weeklyKg: weight.weeklyKg ?? null,
        weeklyPercent: weight.weeklyPercent ?? null,
        category: weight.category,
        confidence: weight.confidence,
        measurementsPerWeek: weight.measurementsPerWeek,
        count: state.weights.length,
      },
      skinfolds: {
        date: latestSkinfold?.gemessen_am || null,
        sumMm: latestSkinfold ? round(latestSkinfold.total ?? summe(folds)) : null,
        previousSumMm: previousSkinfold ? round(previousSkinfold.total ?? summe(previousSkinfold.falten)) : null,
        confirmedChangeMm: skinfoldDelta,
        count: completeSkinfolds.length,
        standardized: latestSkinfold?.standardisiert === true,
        measurementQuality: latestSkinfold?.messqualitaet || null,
        individualMm: Object.fromEntries(FALTEN.map(([slug]) => [slug, round(folds?.[slug])])),
        ranked,
        ratios: {
          quadricepsToHamstring: Number(folds.beinbizeps) ? round(Number(folds.quadrizeps) / Number(folds.beinbizeps), 3) : null,
          bicepsToTriceps: Number(folds.trizeps) ? round(Number(folds.bizeps) / Number(folds.trizeps), 3) : null,
          chinToCheek: Number(folds.wange) ? round(Number(folds.kinn) / Number(folds.wange), 3) : null,
        },
      },
      waist: {
        currentCm: round(latestWaist?.cm),
        confirmedChangeCm: waistDelta,
        count: state.waists.length,
        standardized: latestWaist?.standardisiert === true,
      },
      performance: {
        changePercent: training.percent,
        direction: training.direction,
        importedValues: state.performance.length,
        comparableSessions: training.comparableSessions,
      },
      recovery: {
        direction: recovery,
        sleepValues: state.sleep.length,
        checkins: state.checkins.length,
      },
      observationWeeks: round(weeks),
    },
    deterministicAssessment: deterministic,
    ruleCrossChecks: {
      leadingFold: skinfoldPlan?.topFold ? {
        slug: skinfoldPlan.topFold.slug,
        label: skinfoldPlan.topFold.label,
        rank: skinfoldPlan.topFold.foldPriority,
        direction: skinfoldPlan.topFold.richtung,
      } : null,
      activeFactor: skinfoldPlan?.factorAssessment?.activeFactor ? {
        id: skinfoldPlan.factorAssessment.activeFactor.id,
        factor: skinfoldPlan.factorAssessment.activeFactor.faktor,
        status: skinfoldPlan.factorAssessment.activeFactor.status,
        source: skinfoldPlan.factorAssessment.activeFactor.quelle,
      } : null,
      factors,
      summary: actionPlan?.summary || null,
      unansweredQuestionIds: actionPlan?.unansweredQuestionIds || [],
    },
    allowedActions: allowedActions(actionPlan),
    safetyBoundaries: {
      diagnosesAllowed: false,
      automaticGoalChangesAllowed: false,
      supplementDosagesFromModelAllowed: false,
      interactionsFromModelAllowed: false,
      recommendationsMustUseAllowedActionId: true,
    },
  };
}

export async function requestCompAssessment(evidence) {
  const { data, error } = await supabase.functions.invoke('capboy-coach', {
    body: { scope: 'comp', mode: 'ensure', evidence },
  });
  if (error) {
    let message = error.message;
    try {
      const payload = await error.context?.clone?.().json();
      if (payload?.error) message = payload.error;
    } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
