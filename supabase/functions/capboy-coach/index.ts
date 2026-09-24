import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

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
  const values = Object.values(row.falten || {}).map(number).filter((value) => value > 0);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
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
    nutritionEntries, dayStatus, routines, completions,
  ] = await Promise.all([
    admin.from('nutrition_settings').select('goal,custom_calorie_target,adaptive_target,height_cm,birth_date').eq('user_id', userId).maybeSingle(),
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
  ]);
  const failures = [nutritionSettings, nutritionEntries, dayStatus, routines, completions].filter((result) => result.error);
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

const scopeInstruction: Record<Scope, string> = {
  coach: 'Beantworte die konkrete Frage, betrachte aber immer das Gesamtbild aus Körperkomposition, Training, Ernährung, Schlaf, Erholung und Routinen.',
  overall: 'Erstelle eine bereichsübergreifende Gesamtanalyse und priorisiere höchstens drei nächste Schritte.',
  sleep: 'Fokussiere Schlaf, beziehe Training, Ernährung, Erholung und Routinen aber ein, wenn die Daten einen Zusammenhang stützen.',
  comp: 'Interpretiere die Körperkomposition aus mehreren Signalen. Gewicht allein ist nie ein Beweis für Muskel- oder Fettveränderung.',
  skinfold: 'Priorisiere risikoarme nächste Schritte. Hautfalten erlauben keine Diagnose von Hormonen, Organen, Mängeln oder Krankheiten.',
};

function outputText(response: Row) {
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  return '';
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

    const [snapshot, historyResult] = await Promise.all([
      buildSnapshot(userId),
      admin.from('ai_coach_messages').select('role,content').eq('user_id', userId).order('created_at', { ascending: false }).limit(12),
    ]);
    if (historyResult.error) throw historyResult.error;
    const history = [...(historyResult.data || [])].reverse();
    const system = `Du bist der persönliche CAPBOY Coach für Training, Ernährung, Schlaf, Muskelaufbau, Körperkomposition und allgemeine gesundheitsorientierte Gewohnheiten.

Arbeite ausschließlich mit den bereitgestellten Nutzerdaten. Trenne klar zwischen gemessenen Fakten, plausiblen Interpretationen und Unsicherheiten. Behaupte nie Kausalität, wenn nur ein Zusammenhang sichtbar ist. Einzelwerte nie überbewerten. Gib höchstens drei konkrete, überprüfbare Empfehlungen und nenne einen realistischen Zeitraum. Veränderungen an Zielen oder Plänen werden nur vorgeschlagen, nie automatisch durchgeführt. Stelle keine Diagnosen und leite aus Hautfalten keine Hormone, Organe, Krankheiten oder Nährstoffmängel ab. Bei möglichen medizinischen Warnzeichen empfehle professionelle Abklärung. Antworte auf Deutsch, knapp und konkret. ${scopeInstruction[scope]}`;
    const input = [
      ...history.map((message) => ({ role: message.role, content: message.content })),
      {
        role: 'user',
        content: `${question || 'Erstelle jetzt die angeforderte Analyse.'}\n\nAktueller strukturierter CAPBOY-Datensnapshot:\n${JSON.stringify(snapshot)}`,
      },
    ];

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-6-sol',
        instructions: system,
        input,
        reasoning: { effort: scope === 'coach' ? 'medium' : 'high' },
        max_output_tokens: 2600,
        text: { format: { type: 'json_schema', name: 'capboy_coach_result', strict: true, schema: resultSchema } },
      }),
    });
    const responsePayload = await openAiResponse.json();
    if (!openAiResponse.ok) {
      console.error('OpenAI response failed', openAiResponse.status, responsePayload?.error?.type);
      return json({ error: 'Die Coach-Analyse konnte gerade nicht erstellt werden.' }, 502);
    }
    const raw = outputText(responsePayload);
    if (!raw) return json({ error: 'Die Coach-Antwort war leer.' }, 502);
    const result = JSON.parse(raw);

    if (scope === 'coach') {
      const assistantText = [result.summary, ...result.recommendations.map((item: Row) => item.action)].join('\n');
      const { error } = await admin.from('ai_coach_messages').insert([
        { user_id: userId, role: 'user', content: question, context: { snapshotPeriod: snapshot.period } },
        { user_id: userId, role: 'assistant', content: assistantText.slice(0, 12000), context: { result, snapshotPeriod: snapshot.period } },
      ]);
      if (error) throw error;
    } else {
      const { error } = await admin.from('ai_coach_analyses').insert({
        user_id: userId,
        scope,
        result,
        model: 'gpt-6-sol',
        data_from: snapshot.period.from,
        data_to: snapshot.period.to,
      });
      if (error) throw error;
    }

    return json({ result, scope, period: snapshot.period });
  } catch (error) {
    console.error('CAPBOY coach failed', error);
    return json({ error: 'Der Coach konnte die Daten gerade nicht auswerten.' }, 500);
  }
});

