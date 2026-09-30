import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { KNOWLEDGE_DOCUMENTS, KNOWLEDGE_SOURCES, KNOWLEDGE_VERSION } from './knowledge.ts';
import { COACH_MODEL, SHARED_SAFETY, coachRequestBody, outputText, type Scope } from './coachPrompt.ts';
import { FETCH_LIMITS, FETCH_WINDOW_DAYS, buildCompFacts, buildTimeseries, dateDaysAgo, type ContextRows } from './context.ts';
import { MEMORY_LIMITS, assistantMemoryText, conversationBlock, interventionBlock, isUuid, profileBlock } from './memory.ts';
import { reviewWeeks, sanitizeWeeklyReport, weeklyBlock, weeklyQuestion } from './weekly.ts';
import { followThroughActions, switchedOffAreas } from './followThrough.ts';

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

// Status writes must not fail silently: the 'indexing' write once violated the
// table's check constraint unnoticed, which dropped the new vector store id.
// A failed write therefore aborts the request instead of continuing with a
// status the database does not reflect.
async function saveKnowledgeStatus(row: Row) {
  const { error } = await admin.from('ai_knowledge_bases').upsert({
    ...row,
    source_manifest: KNOWLEDGE_SOURCES,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Knowledge status '${row.status}' could not be saved: ${error.message}`);
}

async function ensureKnowledgeBase() {
  const key = 'capboy-seminar-v1';
  const { data: current } = await admin.from('ai_knowledge_bases').select('*').eq('key', key).maybeSingle();
  if (current?.status === 'ready' && current?.content_hash === KNOWLEDGE_VERSION && current?.vector_store_id) {
    return current.vector_store_id as string;
  }

  if (current?.content_hash === KNOWLEDGE_VERSION && current?.vector_store_id) {
    // Only the OpenAI check may fall through to a fresh store. A failed status
    // write must not be mistaken for an unusable store, or every such failure
    // would create another vector store.
    let reusable = false;
    try {
      reusable = await waitForVectorStore(current.vector_store_id);
    } catch {
      // The previous store is not usable; create a fresh one below.
    }
    if (reusable) {
      await saveKnowledgeStatus({
        key, vector_store_id: current.vector_store_id, content_hash: KNOWLEDGE_VERSION, status: 'ready', last_error: null,
      });
      return current.vector_store_id as string;
    }
  }

  await saveKnowledgeStatus({ key, content_hash: KNOWLEDGE_VERSION, status: 'pending', last_error: null });

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
    await saveKnowledgeStatus({
      key, vector_store_id: store.id, content_hash: KNOWLEDGE_VERSION, status: 'indexing', last_error: null,
    });
    const ready = await waitForVectorStore(store.id);
    if (!ready) throw new Error('Vector store indexing did not complete in time');
    await saveKnowledgeStatus({
      key, vector_store_id: store.id, content_hash: KNOWLEDGE_VERSION, status: 'ready', last_error: null,
    });
    return store.id as string;
  } catch (error) {
    // Report the original error; a failing 'failed' write must not mask it.
    try {
      await saveKnowledgeStatus({
        key, content_hash: KNOWLEDGE_VERSION, status: 'failed', last_error: String(error).slice(0, 1000),
      });
    } catch (statusError) {
      console.error('CAPBOY knowledge status write failed', statusError);
    }
    throw error;
  }
}

async function userRows(table: string, userId: string, order: string, limit: number, columns = '*') {
  const { data, error } = await admin.from(table).select(columns).eq('user_id', userId)
    .order(order, { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// PostgREST returns at most 1000 rows per request by default. Twelve weeks of
// nutrition entries or routine completions can exceed that, so they are
// loaded page by page; the query must sort by a unique key, otherwise rows
// could repeat or go missing at page borders.
const PAGE_SIZE = 1000;
async function pagedRows(query: () => any): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

// Preferences the context reads: the skinfold rule context, the pages shown
// in the profile, and whether the app has already added the sleep page to an
// older list of visible pages (until then the app shows it anyway).
const RULE_CONTEXT_KEY = 'comp:hautfalten-kontext-v1';
const VISIBLE_PAGES_KEY = 'muscledex:sichtbare-sammlungen';
const SLEEP_PAGE_MIGRATED_KEY = 'muscledex:sleep-dex-sichtbarkeit-v1';

// The areas COMP looks at together; switched-off areas are named once and
// left out. With every area on the sentence is the same as before.
const AREA_NAMES: Record<string, string> = { nutrition: 'Ernährung', sleep: 'Schlaf', routines: 'Routinen' };
const germanList = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} und ${items.at(-1)}` : items[0] || '');
function compAreaText(off: string[]) {
  const offNames = off.map((area) => AREA_NAMES[area]).filter(Boolean);
  const areas = ['Körpermaße', 'Ernährung', 'Schlaf', 'Erholung', 'Routinen', 'Training'].filter((name) => !offNames.includes(name));
  const text = `Betrachte alle Bereiche zusammen: ${germanList(areas)}.`;
  return offNames.length
    ? `${text} Im Profil ausgeschaltet hat die Person: ${germanList(offNames)} (switchedOffAreas). Dazu gibt es bewusst keine Daten: Bewerte nichts daraus, erwähne es nicht, auch nicht als fehlende Daten, und schlage dort weder Protokollieren noch Messen vor.`
    : text;
}

// Loads the rows for the shared context. The time series needs twelve weeks;
// buildCompFacts cuts the rows back to the previous windows and limits.
// Areas switched off in the profile (tracker, routines, sleep) get no rows.
async function fetchContextRows(userId: string, now: Date): Promise<ContextRows> {
  const since = dateDaysAgo(now, FETCH_WINDOW_DAYS);
  const [
    nutritionSettings, weights, skinfolds, waists, performance, sleep, checkins,
    nutritionEntries, routines, completions, preferences,
  ] = await Promise.all([
    admin.from('nutrition_settings').select('goal,custom_calorie_target,adaptive_target,height_cm,birth_date,calculation_basis,bodycomp_thresholds').eq('user_id', userId).maybeSingle(),
    userRows('weights', userId, 'gemessen_am', FETCH_LIMITS.weights, 'gemessen_am,kg'),
    userRows('skinfolds', userId, 'gemessen_am', FETCH_LIMITS.skinfolds, 'gemessen_am,falten,standardisiert,messqualitaet'),
    userRows('waist_measurements', userId, 'gemessen_am', FETCH_LIMITS.waists, 'gemessen_am,cm,standardisiert'),
    userRows('logman_performance', userId, 'performed_on', FETCH_LIMITS.performance, 'performed_on,exercise,category,estimated_1rm,volume'),
    userRows('sleep_logs', userId, 'sleep_date', FETCH_LIMITS.sleep, 'sleep_date,bedtime,wake_time,quality,energy,awakenings,tags'),
    userRows('bodycomp_checkins', userId, 'checkin_date', FETCH_LIMITS.checkins, 'checkin_date,recovery,mood,hunger,illness,travel,unusual_meals'),
    pagedRows(() => admin.from('nutrition_log_entries').select('log_date,energy_kcal,protein_g,carbs_g,fat_g').eq('user_id', userId).gte('log_date', since).order('log_date', { ascending: false }).order('id')),
    // All routines, paused ones included, so every completion has a name.
    admin.from('routines').select('id,name,period,weekdays,active,created_at').eq('user_id', userId).order('position'),
    pagedRows(() => admin.from('routine_completions').select('routine_id,completed_on').eq('user_id', userId).gte('completed_on', since).order('completed_on', { ascending: false }).order('routine_id')),
    admin.from('user_preferences').select('key,value').eq('user_id', userId).in('key', [RULE_CONTEXT_KEY, VISIBLE_PAGES_KEY, SLEEP_PAGE_MIGRATED_KEY]),
  ]);
  const failures = [nutritionSettings, routines, preferences].filter((result) => result.error);
  if (failures.length) throw failures[0].error;
  const preference = (key: string) => (preferences.data || []).find((row: Row) => row.key === key)?.value;
  const visiblePages = preference(VISIBLE_PAGES_KEY);
  const off = switchedOffAreas(Array.isArray(visiblePages) && preference(SLEEP_PAGE_MIGRATED_KEY) !== true
    ? [...visiblePages, 'sleep'] : visiblePages);
  return {
    settings: nutritionSettings.data || null,
    weights, skinfolds, waists, performance,
    sleep: off.includes('sleep') ? [] : sleep,
    checkins,
    nutritionEntries: off.includes('nutrition') ? [] : nutritionEntries,
    routines: off.includes('routines') ? [] : routines.data || [],
    completions: off.includes('routines') ? [] : completions,
    ruleContext: preference(RULE_CONTEXT_KEY) || {},
    ...(off.length ? { switchedOffAreas: off } : {}),
  };
}

// Memory of the free coach (step 5). If a table or column is missing (the
// migration is not applied yet) or a query fails, the coach answers without
// memory instead of failing, and the response says so.
const INTERVENTION_COLUMNS = 'id,action,hypothesis,target_metric,target_metric_id,expected_direction,baseline_note,start_date,review_date,status,adherence,outcome,source,updated_at';

async function loadMemory(userId: string, conversationId: string, today: string, timeseries: Row) {
  const [messages, facts, interventions] = await Promise.all([
    admin.from('ai_coach_messages').select('role,content,created_at').eq('user_id', userId).eq('conversation_id', conversationId)
      .order('created_at', { ascending: false }).limit(MEMORY_LIMITS.conversationMessages),
    admin.from('coach_profile_memory').select('category,fact,confirmed_on').eq('user_id', userId)
      .order('confirmed_on', { ascending: false }).limit(MEMORY_LIMITS.profileFacts),
    admin.from('coach_interventions').select(INTERVENTION_COLUMNS).eq('user_id', userId)
      .order('start_date', { ascending: false }).limit(MEMORY_LIMITS.interventions * 4),
  ]);
  const failed = [messages, facts, interventions].find((result) => result.error);
  if (failed) {
    console.error('CAPBOY memory unavailable', failed.error);
    return { blocks: {}, interventions: [], available: false };
  }
  return {
    blocks: {
      conversation: conversationBlock(messages.data || []),
      profile_memory: profileBlock(facts.data || []),
      intervention_log: interventionBlock(interventions.data || [], today, timeseries),
    },
    interventions: interventions.data || [],
    available: true,
  };
}

// Stores question and answer as one turn of the conversation. The answer keeps
// its full JSON in context (for the memory page); content is the short form
// the coach sees in later turns. Explicit timestamps keep the order.
async function saveTurn(userId: string, conversationId: string, question: string, result: Row) {
  const asked = new Date();
  const { error } = await admin.from('ai_coach_messages').insert([
    { user_id: userId, conversation_id: conversationId, role: 'user', content: question, context: {}, created_at: asked.toISOString() },
    { user_id: userId, conversation_id: conversationId, role: 'assistant', content: assistantMemoryText(result) || '–', context: { result }, created_at: new Date(asked.getTime() + 1).toISOString() },
  ]);
  if (error) console.error('CAPBOY memory save failed', error);
  return !error;
}

// Running experiments for the central COMP assessment, in the coach's form,
// so COMP does not propose a change in a domain that already has one.
// Without the table (migration not applied) there are none.
async function loadRunningExperiments(userId: string, today: string, timeseries: Row) {
  const { data, error } = await admin.from('coach_interventions').select(INTERVENTION_COLUMNS).eq('user_id', userId)
    .eq('status', 'aktiv').order('start_date', { ascending: false }).limit(MEMORY_LIMITS.interventions);
  if (error) console.error('CAPBOY running experiments unavailable', error);
  return error ? '' : interventionBlock(data || [], today, timeseries);
}

// Weekly check-in (step 7): the latest review before the reviewed week, for
// its focus. Without the table (migration not applied) there is none.
async function loadPreviousReview(userId: string, week: string) {
  const { data, error } = await admin.from('coach_weekly_reviews').select('week,result').eq('user_id', userId)
    .lt('week', week).order('week', { ascending: false }).limit(1).maybeSingle();
  if (error) console.error('CAPBOY previous weekly review unavailable', error);
  return error ? null : data;
}

// Stores the check-in with the app's comparison and the answer, one row per
// week; a repeated check-in for the same week replaces it.
async function saveWeeklyReview(userId: string, weekly: Row, report: Row, result: Row, conversationId: string | null) {
  const { error } = await admin.from('coach_weekly_reviews').upsert({
    user_id: userId, week: weekly.week, checkin: report, comparison: weekly.comparison, result, conversation_id: conversationId,
  }, { onConflict: 'user_id,week' });
  if (error) console.error('CAPBOY weekly review save failed', error);
  return !error;
}

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
    optionalInsights: {
      type: 'array', maxItems: 2,
      items: {
        type: 'object', additionalProperties: false,
        properties: { guidanceId: { type: 'string' }, summary: { type: 'string' } },
        required: ['guidanceId', 'summary'],
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
  required: ['title', 'status', 'confidence', 'keyDevelopment', 'basis', 'uncertainty', 'nextSteps', 'optionalInsights', 'sources'],
};

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

// Why an open point comes first, when the model left it out.
const FOLLOW_THROUGH_REASONS: Record<string, string> = {
  daten: 'Ohne diese Einträge lässt sich deine Entwicklung in diesem Bereich nicht sicher beurteilen.',
  messung: 'Ohne aktuelle Messung bleibt offen, was hinter deiner Entwicklung steckt.',
  umsetzung: 'Der Plan wird zurzeit nicht eingehalten; erst danach lässt sich seine Wirkung beurteilen.',
  verbesserung: 'Dieser Wert liegt deutlich unter einem sinnvollen Ziel.',
};

function safeOptionalSummary(value: unknown, fallback: unknown) {
  const summary = String(value || '').slice(0, 600);
  // Dosierungen stammen ausschliesslich aus den autoritativen Regeldaten
  // darunter. Nennt das Modell trotzdem eine Dosis, wird seine Formulierung
  // vollstaendig verworfen statt nur teilweise bereinigt.
  if (/\b\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\s*(?:mg|µg|mcg|g|ml|i\.?e\.?|iu)\b/i.test(summary)) {
    return String(fallback || 'Diese Seminar-Auswertung ergänzt das Gesamtbild als optionale Orientierung.').slice(0, 600);
  }
  return summary || String(fallback || 'Diese Seminar-Auswertung ergänzt das Gesamtbild als optionale Orientierung.').slice(0, 600);
}

function enforceCompSafety(result: Row, evidence: Row, followThrough: Row | null = null) {
  const allowed = new Map((evidence?.allowedActions || []).map((item: Row) => [item.id, item]));
  const steps = (result?.nextSteps || []).flatMap((step: Row) => {
    const authoritative = allowed.get(step.actionId);
    if (!authoritative) return [];
    return [{
      actionId: step.actionId,
      action: authoritative.action,
      rationale: String(step.rationale || '').slice(0, 500),
      timeframe: String(step.timeframe || '').slice(0, 120),
    }];
  });
  // An open point always comes first: if the model named none, the most
  // important one is put in front.
  const [firstCheck] = followThrough?.checks || [];
  const namesOpenPoint = steps.some((step: Row) => String(step.actionId).startsWith('umsetzung-'));
  if (firstCheck && !namesOpenPoint && allowed.has(`umsetzung-${firstCheck.id}`)) {
    steps.unshift({
      actionId: `umsetzung-${firstCheck.id}`,
      action: firstCheck.action,
      rationale: FOLLOW_THROUGH_REASONS[firstCheck.kind] || '',
      timeframe: 'die nächsten 14 Tage',
    });
  }
  const nextSteps = steps.slice(0, 3);
  const modelSummaries = new Map((result?.optionalInsights || []).map((item: Row) => [String(item.guidanceId || ''), String(item.summary || '').slice(0, 600)]));
  const optionalInsights = (evidence?.optionalSeminarGuidance || []).slice(0, 2).map((item: Row) => ({
    guidanceId: String(item.id || ''),
    bereich: String(item.bereich || '').slice(0, 160),
    titel: String(item.titel || '').slice(0, 160),
    summary: safeOptionalSummary(modelSummaries.get(String(item.id || '')), item.zusammenhang),
    punkte: (item.punkte || []).map(String).slice(0, 5),
    dosierungen: (item.dosierungen || []).slice(0, 16).map((dose: Row) => ({
      name: String(dose.name || '').slice(0, 160),
      dosierung: String(dose.dosierung || '').slice(0, 240),
      protokoll: String(dose.protokoll || '').slice(0, 200),
      optional: dose.optional === true,
    })),
    karte: String(item.karte || '').slice(0, 120),
  })).filter((item: Row) => item.guidanceId && (item.punkte.length || item.dosierungen.length));
  return {
    title: String(result?.title || 'Aktuelle Gesamtbewertung').slice(0, 120),
    status: String(result?.status || 'Gesamtbild noch unklar').slice(0, 72),
    confidence: ['niedrig', 'mittel', 'hoch'].includes(result?.confidence) ? result.confidence : 'niedrig',
    keyDevelopment: String(result?.keyDevelopment || '').slice(0, 1200),
    basis: (result?.basis || []).map(String).slice(0, 4),
    uncertainty: (result?.uncertainty || []).map(String).slice(0, 3),
    nextSteps,
    optionalInsights,
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
    // A weekly check-in asks no question of its own; the app names the week.
    const weeklyMode = scope === 'coach' && body?.mode === 'weekly';
    const question = weeklyMode ? '' : String(body?.question || '').trim().slice(0, 2000);
    if (scope === 'coach' && !weeklyMode && question.length < 2) return json({ error: 'Bitte stelle eine Frage.' }, 400);
    const webResearch = scope === 'coach' && body?.webResearch === true;
    const imageDataUrls = scope === 'coach' && Array.isArray(body?.attachments)
      ? body.attachments.slice(0, 1).flatMap((attachment: Row) => {
        const value = String(attachment?.dataUrl || '');
        return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= 3_000_000 ? [value] : [];
      })
      : [];

    // Shared context: the same facts and time series for coach and COMP.
    const now = new Date();
    const contextRows = await fetchContextRows(userId, now);
    const snapshot = buildCompFacts(contextRows, now);
    const timeseries = buildTimeseries(contextRows, now);
    // Weekly check-in: the last completed week against the one before, with
    // the user's report and the focus of the previous review.
    const reviewed = weeklyMode ? reviewWeeks(timeseries) : null;
    if (weeklyMode && !reviewed) return json({ error: 'Es gibt noch keine abgeschlossene Woche für eine Bilanz.' }, 400);
    // Only the free coach has memory. A conversation continues when the client
    // sends its id; otherwise a new one begins. A weekly check-in always
    // begins one, so follow-up questions continue from the review.
    const conversationId = scope === 'coach' ? (!weeklyMode && isUuid(body?.conversationId) ? body.conversationId as string : crypto.randomUUID()) : null;
    const memory = conversationId ? await loadMemory(userId, conversationId, now.toISOString().slice(0, 10), timeseries) : null;
    const weeklyReport = weeklyMode ? sanitizeWeeklyReport(body?.weekly, memory?.interventions || []) : null;
    const weekly = reviewed ? weeklyBlock(timeseries, weeklyReport, await loadPreviousReview(userId, reviewed.current.week), memory?.interventions || []) : null;
    const coachQuestion = weekly ? weeklyQuestion(weekly.week) : question;
    const clientEvidence = scope === 'comp' && body?.evidence && typeof body.evidence === 'object'
      ? body.evidence as Row : null;
    if (clientEvidence && JSON.stringify(clientEvidence).length > 120_000) return json({ error: 'Die COMP-Daten sind zu umfangreich.' }, 413);
    const isCentralComp = scope === 'comp' && clientEvidence;
    // Central COMP: what is missing or not followed through comes before the
    // skinfold catalogue, and COMP knows the running experiments.
    const compEvidence = isCentralComp ? {
      ...clientEvidence,
      allowedActions: [
        ...followThroughActions(timeseries.followThrough),
        ...(Array.isArray(clientEvidence!.allowedActions) ? clientEvidence!.allowedActions : []),
      ],
    } : null;
    const runningExperiments = isCentralComp ? await loadRunningExperiments(userId, now.toISOString().slice(0, 10), timeseries) : '';

    const canonicalSnapshot = { ...snapshot } as Row;
    delete canonicalSnapshot.generatedAt;
    const canonicalEvidence = clientEvidence ? { ...clientEvidence } : null;
    if (canonicalEvidence) delete canonicalEvidence.generatedAt;
    // Only the central COMP assessment reads the time series; the cache keys
    // of the other scopes stay as they were.
    const inputFingerprint = await fingerprint(isCentralComp
      ? { scope, snapshot: canonicalSnapshot, timeseries, evidence: canonicalEvidence, experiments: runningExperiments }
      : { scope, snapshot: canonicalSnapshot, evidence: canonicalEvidence });

    if (scope === 'comp' && body?.mode === 'ensure') {
      const { data: cached } = await admin.from('ai_coach_analyses').select('result,created_at,source_manifest')
        .eq('user_id', userId).eq('scope', 'comp').eq('input_fingerprint', inputFingerprint).maybeSingle();
      if (cached?.result) return json({ result: cached.result, scope, period: snapshot.period, cached: true, createdAt: cached.created_at });
    }

    const vectorStoreId = await ensureKnowledgeBase();

    const requestBody = isCentralComp ? {
      model: COACH_MODEL,
      instructions: `Du erstellst die einzige sichtbare Gesamtbewertung auf der CAPBOY-COMP-Seite. ${SHARED_SAFETY}

Formuliere knapp und verständlich: genau eine wichtigste Entwicklung, bis zu vier konkrete Grundlagen, bis zu drei Unsicherheiten und höchstens drei nächste Schritte. Jeder nächste Schritt MUSS eine actionId aus allowedActions verwenden. Übernimm den zugehörigen Aktionstext sinngleich; neue Maßnahmen sind verboten. Quellen dürfen nur aus der bereitgestellten Seminar-Wissensbasis stammen. Gib den exakten Dateinamen und, wenn im Dokument erkennbar, die Seite an. Der kurze Status muss im Hero funktionieren. Antworte auf Deutsch.

${compAreaText(contextRows.switchedOffAreas || [])} Im Verlauf steht unter followThrough, was in den letzten 14 Tagen fehlt oder nicht umgesetzt wird, nach Wichtigkeit sortiert; die App hat das berechnet. Nenne diese Punkte in keyDevelopment, basis oder uncertainty und sag klar, was fehlt und warum es zählt, ohne Vorwurf. Gibt es solche Punkte, ist der erste nächste Schritt einer davon (actionId beginnt mit „umsetzung-“), in der Regel der erste der Liste: Fehlende Daten und fällige Messungen gehen neuen Maßnahmen vor, weil sich ohne sie nichts sicher beurteilen lässt. Schlage keine neue Änderung in einem Bereich vor, in dem schon ein Experiment läuft; ist eines fällig (reviewDue), nenne das.

optionalSeminarGuidance enthält bereits regelbasiert ausgewählte Hinweise aus Hautfaltenmessung und Neurotransmitter-Test. Erstelle für jeden vorhandenen Eintrag genau ein optionalInsight mit derselben guidanceId und einer kurzen verständlichen Zusammenfassung, warum er im Gesamtbild relevant sein könnte. Diese Hinweise bleiben getrennt von nextSteps. Wiederhole keine Dosierung und erfinde keine: Namen und exakte Seminar-Dosierungen setzt der Server anschließend unverändert ein.`,
      input: [{ role: 'user', content: `Erstelle die zentrale COMP-Gesamtbewertung. Nutze zuerst die deterministischen Ergebnisse und Gegenprüfungen, dann suche nur die dafür relevanten Seminarpassagen.\n\nServerseitiger Gesamtsnapshot:\n${JSON.stringify(snapshot)}\n\nWöchentlicher Verlauf der letzten 12 Wochen (deterministisch, dieselbe Grundlage wie beim Coach; Veränderungen stehen in summary und werden nicht selbst berechnet):\n${JSON.stringify(timeseries)}\n\nLaufende Experimente:\n${runningExperiments || 'keine'}\n\nDeterministische COMP-Berechnungen, Regel-Gegenprüfungen und zulässige Aktionen aus der App:\n${JSON.stringify(compEvidence)}` }],
      reasoning: { effort: 'high' },
      max_output_tokens: 6000,
      tools: [{ type: 'file_search', vector_store_ids: [vectorStoreId], max_num_results: 8 }],
      tool_choice: 'auto',
      include: ['file_search_call.results'],
      text: {
        format: {
          type: 'json_schema',
          name: 'capboy_comp_assessment',
          strict: true,
          schema: compResultSchema,
        },
      },
    } : coachRequestBody({ scope, question: coachQuestion, snapshot, timeseries, memory: memory?.blocks, weekly, webResearch, vectorStoreId, imageDataUrls });
    const responsePayload = await openAi('/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (responsePayload.status === 'incomplete') {
      throw new Error(`OpenAI response incomplete: ${responsePayload.incomplete_details?.reason || 'unknown'}`);
    }
    const raw = outputText(responsePayload);
    if (!raw) return json({ error: 'Die Coach-Antwort war leer.' }, 502);
    const parsed = JSON.parse(raw);
    const result = isCentralComp ? enforceCompSafety(parsed, compEvidence!, timeseries.followThrough) : {
      ...parsed,
      webResearchRequested: webResearch,
      webSources: webResearch ? webSources(responsePayload) : [],
    };

    if (scope !== 'coach') {
      const { error } = await admin.from('ai_coach_analyses').upsert({
        user_id: userId,
        scope,
        result,
        model: COACH_MODEL,
        data_from: snapshot.period.from,
        data_to: snapshot.period.to,
        input_fingerprint: inputFingerprint,
        source_manifest: isCentralComp ? result.sources : [],
        knowledge_hash: KNOWLEDGE_VERSION,
      }, { onConflict: 'user_id,scope,input_fingerprint' });
      if (error) throw error;
    }

    const memorySaved = conversationId && memory?.available ? await saveTurn(userId, conversationId, coachQuestion, result) : false;
    const weeklySaved = weekly ? await saveWeeklyReview(userId, weekly, weeklyReport!, result, memorySaved ? conversationId : null) : false;
    return json({
      result, scope, period: snapshot.period, cached: false,
      ...(conversationId ? { conversationId, memoryAvailable: Boolean(memory?.available), memorySaved } : {}),
      ...(weekly ? { weekly: { week: weekly.week, from: weekly.from, to: weekly.to, previousWeek: weekly.previousWeek, comparison: weekly.comparison, saved: weeklySaved } } : {}),
    });
  } catch (error) {
    console.error('CAPBOY coach failed', error);
    return json({ error: 'Der Coach konnte die Daten gerade nicht auswerten.' }, 500);
  }
});
