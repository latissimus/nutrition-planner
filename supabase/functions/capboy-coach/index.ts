import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { KNOWLEDGE_DOCUMENTS, KNOWLEDGE_SOURCES, KNOWLEDGE_VERSION, YPSI_FORMULA } from './knowledge.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAiKey = Deno.env.get('OPENAI_API_KEY') || '';
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Row = Record<string, any>;
type Scope = 'coach' | 'sleep' | 'comp' | 'skinfold' | 'overall';

const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const round = (value: number | null, digits = 1) => value == null ? null : Number(value.toFixed(digits));
const dateDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Row).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

async function fingerprint(value: unknown) {
  const data = new TextEncoder().encode(JSON.stringify(stableValue(value)));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function openAi(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${openAiKey}`, ...(init.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok) {
    const detail = String(payload?.error?.message || payload?.error?.type || 'request_failed').slice(0, 500);
    throw new Error(`OpenAI ${path}: ${response.status} ${detail}`);
  }
  return payload;
}

async function waitForVectorStore(vectorStoreId: string) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const status = await openAi(`/vector_stores/${vectorStoreId}`);
    if (status.status === 'completed') return true;
    if (['expired', 'failed', 'cancelled'].includes(status.status)) return false;
    await sleep(1000);
  }
  return false;
}

async function ensureKnowledgeBase() {
  const key = 'capboy-seminar-v1';
  const { data: current } = await admin.from('ai_knowledge_bases').select('*').eq('key', key).maybeSingle();
  if (current?.status === 'ready' && current?.content_hash === KNOWLEDGE_VERSION && current?.vector_store_id) {
    return current.vector_store_id as string;
  }

  if (current?.content_hash === KNOWLEDGE_VERSION && current?.vector_store_id) {
    try {
      if (await waitForVectorStore(current.vector_store_id)) {
        await admin.from('ai_knowledge_bases').upsert({
          key,
          vector_store_id: current.vector_store_id,
          content_hash: KNOWLEDGE_VERSION,
          status: 'ready',
          source_manifest: KNOWLEDGE_SOURCES,
          last_error: null,
          updated_at: new Date().toISOString(),
        });
        return current.vector_store_id as string;
      }
    } catch {
      // The previous store is not usable; create a fresh one below.
    }
  }

  await admin.from('ai_knowledge_bases').upsert({
    key,
    content_hash: KNOWLEDGE_VERSION,
    status: 'pending',
    source_manifest: KNOWLEDGE_SOURCES,
    last_error: null,
    updated_at: new Date().toISOString(),
  });

  try {
    const prefix = `${KNOWLEDGE_VERSION.slice(0, 12)}-`;
    const listed = await openAi('/files?purpose=assistants&limit=100');
    const existingByName = new Map((listed.data || []).map((file: Row) => [file.filename, file.id]));
    const fileIds: string[] = [];
    for (const document of KNOWLEDGE_DOCUMENTS) {
      const filename = `${prefix}${document.filename}`;
      const existingId = existingByName.get(filename);
      if (existingId) {
        fileIds.push(existingId);
        continue;
      }
      const form = new FormData();
      form.append('purpose', 'assistants');
      form.append('file', new Blob([document.content], { type: 'text/plain;charset=utf-8' }), filename);
      const uploaded = await openAi('/files', { method: 'POST', body: form });
      fileIds.push(uploaded.id);
    }
    const store = await openAi('/vector_stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CAPBOY Seminarwissen', file_ids: fileIds }),
    });
    await admin.from('ai_knowledge_bases').upsert({
      key,
      vector_store_id: store.id,
      content_hash: KNOWLEDGE_VERSION,
      status: 'indexing',
      source_manifest: KNOWLEDGE_SOURCES,
      last_error: null,
      updated_at: new Date().toISOString(),
    });
    const ready = await waitForVectorStore(store.id);
    if (!ready) throw new Error('Vector store indexing did not complete in time');
    await admin.from('ai_knowledge_bases').upsert({
      key,
      vector_store_id: store.id,
      content_hash: KNOWLEDGE_VERSION,
      status: 'ready',
      source_manifest: KNOWLEDGE_SOURCES,
      last_error: null,
      updated_at: new Date().toISOString(),
    });
    return store.id as string;
  } catch (error) {
    await admin.from('ai_knowledge_bases').upsert({
      key,
      content_hash: KNOWLEDGE_VERSION,
      status: 'failed',
      source_manifest: KNOWLEDGE_SOURCES,
      last_error: String(error).slice(0, 1000),
      updated_at: new Date().toISOString(),
    });
    throw error;
  }
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

async function userRows(table: string, userId: string, order: string, limit: number, columns = '*') {
  const { data, error } = await admin.from(table).select(columns).eq('user_id', userId)
    .order(order, { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

async function buildSnapshot(userId: string) {
  const since42 = dateDaysAgo(42);
  const since30 = dateDaysAgo(30);
  const [
    nutritionSettings, weights, skinfolds, waists, performance, sleep, checkins,
    nutritionEntries, dayStatus, routines, completions, preferences,
  ] = await Promise.all([
    admin.from('nutrition_settings').select('goal,custom_calorie_target,adaptive_target,height_cm,birth_date,calculation_basis,bodycomp_thresholds').eq('user_id', userId).maybeSingle(),
    userRows('weights', userId, 'gemessen_am', 90, 'gemessen_am,kg'),
    userRows('skinfolds', userId, 'gemessen_am', 12, 'gemessen_am,falten,standardisiert,messqualitaet'),
    userRows('waist_measurements', userId, 'gemessen_am', 20, 'gemessen_am,cm,standardisiert'),
    userRows('logman_performance', userId, 'performed_on', 300, 'performed_on,exercise,category,estimated_1rm,volume'),
    userRows('sleep_logs', userId, 'sleep_date', 42, 'sleep_date,bedtime,wake_time,quality,energy,awakenings,tags'),
    userRows('bodycomp_checkins', userId, 'checkin_date', 42, 'checkin_date,recovery,mood,hunger,illness,travel,unusual_meals'),
    admin.from('nutrition_log_entries').select('log_date,energy_kcal,protein_g,carbs_g,fat_g').eq('user_id', userId).gte('log_date', since42).order('log_date', { ascending: false }),
    admin.from('nutrition_day_status').select('log_date,complete,excluded').eq('user_id', userId).gte('log_date', since42).order('log_date', { ascending: false }),
    admin.from('routines').select('id,name,period,weekdays,active').eq('user_id', userId).eq('active', true).order('position'),
    admin.from('routine_completions').select('routine_id,completed_on').eq('user_id', userId).gte('completed_on', since30),
    admin.from('user_preferences').select('value').eq('user_id', userId).eq('key', 'comp:hautfalten-kontext-v1').maybeSingle(),
  ]);
  const failures = [nutritionSettings, nutritionEntries, dayStatus, routines, completions, preferences].filter((result) => result.error);
  if (failures.length) throw failures[0].error;

  const nutritionByDay = new Map<string, { kcal: number; protein: number; carbs: number; fat: number }>();
  for (const row of nutritionEntries.data || []) {
    const current = nutritionByDay.get(row.log_date) || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    current.kcal += number(row.energy_kcal);
    current.protein += number(row.protein_g);
    current.carbs += number(row.carbs_g);
    current.fat += number(row.fat_g);
    nutritionByDay.set(row.log_date, current);
  }
  const completeDates = new Set((dayStatus.data || []).filter((row) => row.complete && !row.excluded).map((row) => row.log_date));
  const nutritionDays = [...nutritionByDay.entries()].filter(([date]) => completeDates.has(date)).map(([, values]) => values);
  const sleepDurations = sleep.map((row) => durationMinutes(row.bedtime, row.wake_time));
  const latestWeight = weights[0] ? number(weights[0].kg) : null;
  const latestFold = foldTotal(skinfolds[0]);
  const oldestFold = foldTotal(skinfolds.at(-1));
  const latestWaist = waists[0] ? number(waists[0].cm) : null;
  const oldestWaist = waists.at(-1) ? number(waists.at(-1).cm) : null;

  const exerciseGroups = new Map<string, Row[]>();
  performance.forEach((row) => {
    const key = `${row.category}:${String(row.exercise).toLowerCase()}`;
    exerciseGroups.set(key, [...(exerciseGroups.get(key) || []), row]);
  });
  const exerciseTrends = [...exerciseGroups.values()].map((rows) => relativeTrend(rows, 'performed_on', (row) => number(row.estimated_1rm))).filter((value): value is number => value != null);

  const age = nutritionSettings.data?.birth_date
    ? Math.floor((Date.now() - new Date(`${nutritionSettings.data.birth_date}T12:00:00`).getTime()) / 31_557_600_000)
    : null;
  const totalRoutineOpportunities = (routines.data || []).reduce((sum, routine) => sum + Math.max(1, (routine.weekdays || []).length) * (30 / 7), 0);
  const latestFoldValues = skinfolds[0]?.falten || {};
  const foldRanks = rankedFolds(latestFoldValues, nutritionSettings.data?.calculation_basis || 'male');

  return {
    generatedAt: new Date().toISOString(),
    period: { from: since42, to: new Date().toISOString().slice(0, 10) },
    profile: {
      age,
      heightCm: nutritionSettings.data?.height_cm || null,
      goal: nutritionSettings.data?.goal || 'unknown',
      calorieTarget: nutritionSettings.data?.adaptive_target || nutritionSettings.data?.custom_calorie_target || null,
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
      active: (routines.data || []).map((routine) => routine.name).slice(0, 12),
      completionsLast30Days: (completions.data || []).length,
      adherencePercent: totalRoutineOpportunities ? round(((completions.data || []).length / totalRoutineOpportunities) * 100, 0) : null,
    },
    ruleContext: preferences.data?.value || {},
  };
}

const resultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    confidence: { type: 'string', enum: ['niedrig', 'mittel', 'hoch'] },
    facts: { type: 'array', items: { type: 'string' } },
    interpretations: { type: 'array', items: { type: 'string' } },
    recommendations: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          action: { type: 'string' }, rationale: { type: 'string' }, timeframe: { type: 'string' },
        },
        required: ['action', 'rationale', 'timeframe'],
      },
    },
    uncertainties: { type: 'array', items: { type: 'string' } },
    followUpQuestions: { type: 'array', items: { type: 'string' } },
    safetyNote: { type: 'string' },
  },
  required: ['title', 'summary', 'confidence', 'facts', 'interpretations', 'recommendations', 'uncertainties', 'followUpQuestions', 'safetyNote'],
};

const compResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    status: { type: 'string' },
    confidence: { type: 'string', enum: ['niedrig', 'mittel', 'hoch'] },
    keyDevelopment: { type: 'string' },
    basis: { type: 'array', maxItems: 4, items: { type: 'string' } },
    uncertainty: { type: 'array', maxItems: 3, items: { type: 'string' } },
    nextSteps: {
      type: 'array', maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          actionId: { type: 'string' }, action: { type: 'string' }, rationale: { type: 'string' }, timeframe: { type: 'string' },
        },
        required: ['actionId', 'action', 'rationale', 'timeframe'],
      },
    },
    sources: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        properties: { title: { type: 'string' }, filename: { type: 'string' }, page: { type: ['integer', 'null'] } },
        required: ['title', 'filename', 'page'],
      },
    },
  },
  required: ['title', 'status', 'confidence', 'keyDevelopment', 'basis', 'uncertainty', 'nextSteps', 'sources'],
};

const scopeInstruction: Record<Scope, string> = {
  coach: 'Beantworte die konkrete Frage, betrachte aber immer das Gesamtbild aus Körperkomposition, Training, Ernährung, Schlaf, Erholung und Routinen.',
  overall: 'Erstelle eine bereichsübergreifende Gesamtanalyse und priorisiere höchstens drei nächste Schritte.',
  sleep: 'Fokussiere Schlaf, beziehe Training, Ernährung, Erholung und Routinen aber ein, wenn die Daten einen Zusammenhang stützen.',
  comp: 'Interpretiere die Körperkomposition aus mehreren Signalen. Gewicht allein ist nie ein Beweis für Muskel- oder Fettveränderung.',
  skinfold: 'Priorisiere risikoarme nächste Schritte. Hautfalten erlauben keine Diagnose von Hormonen, Organen, Mängeln oder Krankheiten.',
};

function outputText(response: Row) {
  const parts: string[] = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
    }
  }
  return parts.join('');
}

function webSources(response: Row) {
  const cited: Row[] = [];
  const retrieved: Row[] = [];
  for (const item of response.output || []) {
    if (item.type === 'web_search_call') {
      for (const source of item.action?.sources || []) retrieved.push(source);
    }
    if (item.type === 'message') {
      for (const content of item.content || []) {
        for (const annotation of content.annotations || []) {
          if (annotation.type !== 'url_citation') continue;
          cited.push(annotation.url_citation || annotation);
        }
      }
    }
  }
  return [...cited, ...retrieved].flatMap((source) => {
    try {
      const url = new URL(String(source.url || ''));
      if (!['http:', 'https:'].includes(url.protocol)) return [];
      return [{ title: String(source.title || url.hostname).slice(0, 240), url: url.href }];
    } catch {
      return [];
    }
  }).filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index).slice(0, 8);
}

function validateSources(sources: Row[] = []) {
  return sources.flatMap((source) => {
    const match = KNOWLEDGE_SOURCES.find((candidate) => candidate.filename === source.filename || candidate.title === source.title);
    if (!match) return [];
    const requestedPage = Number(source.page);
    const page = match.pages && Number.isFinite(requestedPage) && requestedPage >= 1 && requestedPage <= match.pages
      ? requestedPage : null;
    return [{ title: match.title, filename: match.filename, page }];
  }).filter((source, index, all) => all.findIndex((item) => item.filename === source.filename && item.page === source.page) === index).slice(0, 5);
}

function enforceCompSafety(result: Row, evidence: Row) {
  const allowed = new Map((evidence?.allowedActions || []).map((item: Row) => [item.id, item]));
  const nextSteps = (result?.nextSteps || []).flatMap((step: Row) => {
    const authoritative = allowed.get(step.actionId);
    if (!authoritative) return [];
    return [{
      actionId: step.actionId,
      action: authoritative.action,
      rationale: String(step.rationale || '').slice(0, 500),
      timeframe: String(step.timeframe || '').slice(0, 120),
    }];
  }).slice(0, 3);
  return {
    title: String(result?.title || 'Aktuelle Gesamtbewertung').slice(0, 120),
    status: String(result?.status || 'Gesamtbild noch unklar').slice(0, 72),
    confidence: ['niedrig', 'mittel', 'hoch'].includes(result?.confidence) ? result.confidence : 'niedrig',
    keyDevelopment: String(result?.keyDevelopment || '').slice(0, 1200),
    basis: (result?.basis || []).map(String).slice(0, 4),
    uncertainty: (result?.uncertainty || []).map(String).slice(0, 3),
    nextSteps,
    sources: validateSources(result?.sources || []),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Nur POST ist erlaubt.' }, 405);
  if (!supabaseUrl || !serviceRoleKey || !openAiKey) return json({ error: 'Coach ist noch nicht vollständig konfiguriert.' }, 503);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  const { data: userData, error: authError } = await admin.auth.getUser(token);
  if (authError || !userData?.user) return json({ error: 'Nicht angemeldet.' }, 401);
  const userId = userData.user.id;

  try {
    const body = await request.json();
    const requestedScope = String(body?.scope || 'coach') as Scope;
    const scope: Scope = ['coach', 'sleep', 'comp', 'skinfold', 'overall'].includes(requestedScope) ? requestedScope : 'coach';
    const question = String(body?.question || '').trim().slice(0, 2000);
    if (scope === 'coach' && question.length < 2) return json({ error: 'Bitte stelle eine Frage.' }, 400);
    const webResearch = scope === 'coach' && body?.webResearch === true;

    const snapshot = await buildSnapshot(userId);
    const clientEvidence = scope === 'comp' && body?.evidence && typeof body.evidence === 'object'
      ? body.evidence as Row : null;
    if (clientEvidence && JSON.stringify(clientEvidence).length > 120_000) return json({ error: 'Die COMP-Daten sind zu umfangreich.' }, 413);

    const canonicalSnapshot = { ...snapshot } as Row;
    delete canonicalSnapshot.generatedAt;
    const canonicalEvidence = clientEvidence ? { ...clientEvidence } : null;
    if (canonicalEvidence) delete canonicalEvidence.generatedAt;
    const inputFingerprint = await fingerprint({ scope, snapshot: canonicalSnapshot, evidence: canonicalEvidence });

    if (scope === 'comp' && body?.mode === 'ensure') {
      const { data: cached } = await admin.from('ai_coach_analyses').select('result,created_at,source_manifest')
        .eq('user_id', userId).eq('scope', 'comp').eq('input_fingerprint', inputFingerprint).maybeSingle();
      if (cached?.result) return json({ result: cached.result, scope, period: snapshot.period, cached: true, createdAt: cached.created_at });
    }

    const vectorStoreId = await ensureKnowledgeBase();
    const sharedSafety = `Die App hat alle objektiven Werte bereits deterministisch berechnet. Rechne keine Trends, Summen, Ränge, Verhältnisse oder Korrelationen selbst neu aus und widersprich diesen Ergebnissen nicht. Nutze file_search ausschließlich, um die berechneten Ergebnisse verständlich einzuordnen und relevante Seminarpassagen zu finden. Seminarzusammenhänge sind Hypothesen und keine Diagnosen. Behaupte nie Kausalität, wenn nur ein Zusammenhang sichtbar ist. Stelle keine medizinischen Diagnosen. Leite aus Hautfalten keine Hormone, Organe, Krankheiten oder Nährstoffmängel als Tatsache ab. Erfinde keine Supplement-Dosis, keinen Grenzwert und keine Wechselwirkung. Ziele oder Pläne dürfen nur vorgeschlagen und nie automatisch verändert werden.`;

    const isCentralComp = scope === 'comp' && clientEvidence;
    const system = isCentralComp
      ? `Du erstellst die einzige sichtbare Gesamtbewertung auf der CAPBOY-COMP-Seite. ${sharedSafety}

Formuliere knapp und verständlich: genau eine wichtigste Entwicklung, bis zu vier konkrete Grundlagen, bis zu drei Unsicherheiten und höchstens drei nächste Schritte. Jeder nächste Schritt MUSS eine actionId aus allowedActions verwenden. Übernimm den zugehörigen Aktionstext sinngleich; neue Maßnahmen sind verboten. Quellen dürfen nur aus der bereitgestellten Seminar-Wissensbasis stammen. Gib den exakten Dateinamen und, wenn im Dokument erkennbar, die Seite an. Der kurze Status muss im Hero funktionieren. Antworte auf Deutsch.`
      : `Du bist der persönliche CAPBOY Coach für Training, Ernährung, Schlaf, Muskelaufbau, Körperkomposition und gesundheitsorientierte Gewohnheiten. ${sharedSafety}

Jede Anfrage ist eigenständig; behaupte nicht, dich an frühere Gespräche zu erinnern. Trenne klar zwischen gemessenen Fakten, plausiblen Interpretationen und Unsicherheiten. Einzelwerte nie überbewerten. Gib höchstens drei konkrete, überprüfbare Empfehlungen und nenne einen realistischen Zeitraum. Bei möglichen medizinischen Warnzeichen empfehle professionelle Abklärung. ${webResearch ? 'Der Nutzer hat ausdrücklich aktuelle Webrecherche aktiviert. Führe mindestens eine Websuche durch. Bevorzuge Primärquellen, systematische Übersichten, Fachgesellschaften und öffentliche Gesundheitsbehörden. Trenne externe Erkenntnisse sichtbar von den persönlichen CAPBOY-Daten und den Seminarunterlagen.' : 'Es ist keine Webrecherche erlaubt. Nutze nur den CAPBOY-Datensnapshot, die Seminar-Wissensbasis und dein allgemeines Modellwissen.'} Antworte auf Deutsch, knapp und konkret. ${scopeInstruction[scope]}`;
    const prompt = isCentralComp
      ? `Erstelle die zentrale COMP-Gesamtbewertung. Nutze zuerst die deterministischen Ergebnisse und Gegenprüfungen, dann suche nur die dafür relevanten Seminarpassagen.\n\nServerseitiger Gesamtsnapshot:\n${JSON.stringify(snapshot)}\n\nDeterministische COMP-Berechnungen, Regel-Gegenprüfungen und zulässige Aktionen aus der App:\n${JSON.stringify(clientEvidence)}`
      : `${question || 'Erstelle jetzt die angeforderte Analyse.'}\n\nAktueller strukturierter CAPBOY-Datensnapshot:\n${JSON.stringify(snapshot)}`;

    const tools: Row[] = [{ type: 'file_search', vector_store_ids: [vectorStoreId], max_num_results: isCentralComp ? 8 : 6 }];
    const include = ['file_search_call.results'];
    if (webResearch) {
      tools.push({ type: 'web_search', search_context_size: 'medium' });
      include.push('web_search_call.action.sources');
    }
    const responsePayload = await openAi('/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-6-sol',
        instructions: system,
        input: [{ role: 'user', content: prompt }],
        reasoning: { effort: isCentralComp ? 'high' : scope === 'coach' ? 'medium' : 'high' },
        max_output_tokens: isCentralComp ? 6000 : 4000,
        tools,
        tool_choice: webResearch ? 'required' : 'auto',
        include,
        text: {
          format: {
            type: 'json_schema',
            name: isCentralComp ? 'capboy_comp_assessment' : 'capboy_coach_result',
            strict: true,
            schema: isCentralComp ? compResultSchema : resultSchema,
          },
        },
      }),
    });
    if (responsePayload.status === 'incomplete') {
      throw new Error(`OpenAI response incomplete: ${responsePayload.incomplete_details?.reason || 'unknown'}`);
    }
    const raw = outputText(responsePayload);
    if (!raw) return json({ error: 'Die Coach-Antwort war leer.' }, 502);
    const parsed = JSON.parse(raw);
    const result = isCentralComp ? enforceCompSafety(parsed, clientEvidence) : {
      ...parsed,
      webResearchRequested: webResearch,
      webSources: webResearch ? webSources(responsePayload) : [],
    };

    if (scope !== 'coach') {
      const { error } = await admin.from('ai_coach_analyses').upsert({
        user_id: userId,
        scope,
        result,
        model: 'gpt-6-sol',
        data_from: snapshot.period.from,
        data_to: snapshot.period.to,
        input_fingerprint: inputFingerprint,
        source_manifest: isCentralComp ? result.sources : [],
        knowledge_hash: KNOWLEDGE_VERSION,
      }, { onConflict: 'user_id,scope,input_fingerprint' });
      if (error) throw error;
    }

    return json({ result, scope, period: snapshot.period, cached: false });
  } catch (error) {
    console.error('CAPBOY coach failed', error);
    return json({ error: 'Der Coach konnte die Daten gerade nicht auswerten.' }, 500);
  }
});
