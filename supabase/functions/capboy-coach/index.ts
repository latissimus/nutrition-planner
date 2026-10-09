import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { KNOWLEDGE_DOCUMENTS, KNOWLEDGE_SOURCES, KNOWLEDGE_VERSION } from './knowledge.ts';
import { COACH_MODEL, anhaengeAuswerten, coachRequestBody, frageBereinigen, outputText, schritteAuftrag, type Scope } from './coachPrompt.ts';
import { bewertungsQuellenAus, seminarTitelAus, webSources } from './quellen.ts';
import { FETCH_LIMITS, FETCH_WINDOW_DAYS, buildCompFacts, buildTimeseries, dateDaysAgo, type ContextRows } from './context.ts';
import { MEMORY_LIMITS, assistantMemoryText, conversationBlock, interventionBlock, isUuid, profileBlock } from './memory.ts';
import { reviewWeeks, weeklyBlock } from './weekly.ts';
import { coachSwitchedOffAreas } from './followThrough.ts';
import webpush from 'npm:web-push@3.6.7';
import { COACHING_SCHEMA, coachingBereinigen, coachingSystemPrompt, coachingText, coachingUserPrompt, geaenderteBereiche, hatNeueDaten } from './coaching.ts';
import { trainingsAuswertung } from './training.js';
import { BEIBEHALTEN, fensterWerte, nichtRepraesentativ as wocheNichtRepraesentativ, volumenEntscheidung } from './volumen.js';
import { wochenBereinigen, wochenSchema, wochenSystemPrompt, wochenText, wochenUserPrompt } from './wochenCoaching.ts';
import { experimentMeasurement } from './experiments.ts';
import { calorieBasis, enforceCalorieBasis } from './calorieGuard.ts';
import { berlinDay, targetPhaseDay } from './nutritionTarget.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-cron-secret',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAiKey = Deno.env.get('OPENAI_API_KEY') || '';
// Tägliches Coaching: derselbe Cron-Schlüssel und dieselben Push-Schlüssel wie
// beim Erinnerungslauf (send-reminders).
const cronSecret = Deno.env.get('CRON_SECRET') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Row = Record<string, any>;


const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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


// Loads the rows for the shared context. The time series needs twelve weeks;
// buildCompFacts cuts the rows back to the previous windows and limits.
// Areas switched off in the profile (tracker, routines, sleep) get no rows.
async function fetchContextRows(userId: string, now: Date): Promise<ContextRows> {
  const since = dateDaysAgo(now, FETCH_WINDOW_DAYS);
  const [
    nutritionSettings, weights, skinfolds, waists, performance, sleep, checkins,
    nutritionEntries, routines, completions, preferences,
  ] = await Promise.all([
    admin.from('nutrition_settings').select('goal,tracking_enabled,custom_calorie_target,adaptive_target,height_cm,birth_date,calculation_basis,pal,bodycomp_thresholds,target_changed_at').eq('user_id', userId).maybeSingle(),
    userRows('weights', userId, 'gemessen_am', FETCH_LIMITS.weights, 'gemessen_am,kg'),
    userRows('skinfolds', userId, 'gemessen_am', FETCH_LIMITS.skinfolds, 'gemessen_am,falten,standardisiert,messqualitaet'),
    userRows('waist_measurements', userId, 'gemessen_am', FETCH_LIMITS.waists, 'gemessen_am,cm,standardisiert'),
    userRows('logman_performance', userId, 'performed_on', FETCH_LIMITS.performance, 'performed_on,exercise,category,estimated_1rm,volume,source'),
    userRows('sleep_logs', userId, 'sleep_date', FETCH_LIMITS.sleep, 'sleep_date,bedtime,wake_time,quality,energy,awakenings,tags'),
    userRows('bodycomp_checkins', userId, 'checkin_date', FETCH_LIMITS.checkins, 'checkin_date,recovery,mood,hunger,illness,travel,unusual_meals,note'),
    pagedRows(() => admin.from('nutrition_log_entries').select('id,log_date,period,name,amount,unit,energy_kcal,protein_g,carbs_g,fat_g').eq('user_id', userId).gte('log_date', since).order('log_date', { ascending: false }).order('id')),
    // All routines, paused ones included, so every completion has a name.
    admin.from('routines').select('id,name,period,weekdays,active,created_at').eq('user_id', userId).order('position'),
    pagedRows(() => admin.from('routine_completions').select('routine_id,completed_on').eq('user_id', userId).gte('completed_on', since).order('completed_on', { ascending: false }).order('routine_id')),
    admin.from('user_preferences').select('key,value').eq('user_id', userId).in('key', [RULE_CONTEXT_KEY, VISIBLE_PAGES_KEY, SLEEP_PAGE_MIGRATED_KEY]),
  ]);
  const failures = [nutritionSettings, routines, preferences].filter((result) => result.error);
  if (failures.length) throw failures[0].error;
  const preference = (key: string) => (preferences.data || []).find((row: Row) => row.key === key)?.value;
  const visiblePages = preference(VISIBLE_PAGES_KEY);
  const off = coachSwitchedOffAreas(Array.isArray(visiblePages) && preference(SLEEP_PAGE_MIGRATED_KEY) !== true
    ? [...visiblePages, 'sleep'] : visiblePages, nutritionSettings.data?.tracking_enabled);
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


// ---------------------------------------------------------------------------
// Tägliches Coaching um 21 Uhr (COACHING-PLAN.md, Schritt 3)
// ---------------------------------------------------------------------------

const berlinTeile = (jetzt: Date) => {
  const teile = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(jetzt).map((teil) => [teil.type, teil.value]));
  return { datum: `${teile.year}-${teile.month}-${teile.day}`, stunde: Number(teile.hour), montag: teile.weekday === 'Mon' };
};

// Vor dem Coaching die LOGMAN-Einheiten frisch holen (logman-abgleich, Weg
// für den Zeitplan). Ein Fehler darf nicht als frischer Trainingsstand gelten.
async function logmanVorDemCoaching(userId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/logman-abgleich`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}`, apikey: anonKey, 'x-cron-secret': cronSecret },
      body: JSON.stringify({ aktion: 'abgleichen', erzwingen: true, userId }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const status = await response.json();
    if (status?.ergebnis === 'getrennt') return { verbunden: false, frisch: false, grund: 'LOGMAN-Verbindung getrennt' };
    return { verbunden: status?.verbunden === true, frisch: status?.verbunden === true, grund: '' };
  } catch (error) {
    console.error('Coaching: LOGMAN-Abgleich fehlgeschlagen', error instanceof Error ? error.message : error);
    return { verbunden: false, frisch: false, grund: 'LOGMAN-Abgleich fehlgeschlagen' };
  }
}

async function coachingPush(userId: string, datum: string, ueberschrift: string, titel = 'Coaching') {
  if (!vapidPublicKey || !vapidPrivateKey) return 0;
  const { data, error } = await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', userId);
  if (error || !data?.length) return 0;
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  let gesendet = 0;
  for (const abo of data as Row[]) {
    try {
      await webpush.sendNotification(
        { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
        JSON.stringify({ title: titel, body: ueberschrift, tag: `coaching-${datum}`, url: '#coach' }),
        { TTL: 6 * 3600, urgency: 'normal' },
      );
      gesendet += 1;
    } catch (fehler) {
      const status = Number((fehler as { statusCode?: number })?.statusCode || 0);
      // Abgelaufene Abos wie beim Erinnerungslauf entfernen.
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', abo.id);
    }
  }
  return gesendet;
}

/* Ein Coaching je Person und Tag, egal welcher Art (Schritt 5: Eindeutigkeit
   Person + Datum). Die eindeutige Zeile wird vor dem API-Aufruf angelegt:
   parallele Läufe können denselben Tag nicht doppelt berechnen. */
async function coachingFuerNutzer(userId: string, jetzt: Date, heute: string) {
  const { data: vorhanden, error: vorhandenFehler } = await admin.from('coach_coachings').select('id,status').eq('user_id', userId).eq('datum', heute).maybeSingle();
  if (vorhandenFehler) throw vorhandenFehler;
  if (vorhanden) return 'schon_erledigt';
  const logmanStatus = await logmanVorDemCoaching(userId);
  const [rows, revisionResult, letzterResult] = await Promise.all([
    fetchContextRows(userId, jetzt),
    admin.from('coach_input_revisions').select('revision,quellen_revisionen').eq('user_id', userId).maybeSingle(),
    admin.from('coach_coachings').select('input_revision').eq('user_id', userId)
      .order('erstellt_am', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (revisionResult.error) throw revisionResult.error;
  if (letzterResult.error) throw letzterResult.error;
  const revision = Number(revisionResult.data?.revision || 0);
  const letzteRevision = Number(letzterResult.data?.input_revision || 0);
  if (!hatNeueDaten(revision, letzteRevision)) return 'nichts_neues';
  const manuellerTrainingsstand = rows.performance.some((zeile) => zeile.source !== 'LOGMAN-Abgleich');
  const aenderungen = geaenderteBereiche(revisionResult.data?.quellen_revisionen || {}, letzteRevision, rows.switchedOffAreas || [])
    .filter((bereich) => bereich !== 'training' || logmanStatus.frisch || manuellerTrainingsstand);
  if (!aenderungen.length) return 'nichts_relevantes';

  // Die Unique-Constraint ist der atomare Anspruch. Auch ein Fehler bleibt als
  // Status stehen, damit derselbe Datenstand keinen zweiten KI-Aufruf erzeugt.
  const { data: anspruch, error: anspruchFehler } = await admin.from('coach_coachings').insert({
    user_id: userId, art: 'tag', datum: heute, status: 'laeuft', input_revision: revision,
  }).select('id').single();
  if (anspruchFehler?.code === '23505') return 'schon_erledigt';
  if (anspruchFehler) throw anspruchFehler;
  try {
    const [spiegelResult, vortagResult] = await Promise.all([
      logmanStatus.frisch
        ? admin.from('logman_spiegel').select('payload,einheiten_gesehen').eq('user_id', userId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin.from('coach_coachings').select('datum,ergebnis').eq('user_id', userId).eq('status', 'bereit').lt('datum', heute)
        .order('datum', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (spiegelResult.error) throw spiegelResult.error;
    if (vortagResult.error) throw vortagResult.error;
    const spiegel = spiegelResult.data;
    const vortag = vortagResult.data;
    const training = spiegel ? trainingsAuswertung(spiegel.payload, { gesehen: spiegel.einheiten_gesehen || {}, heute }) : null;
    if (!logmanStatus.frisch) rows.performance = rows.performance.filter((zeile) => zeile.source !== 'LOGMAN-Abgleich');
    const snapshot: Row = buildCompFacts(rows, jetzt);
    if (!logmanStatus.frisch && !rows.performance.length) snapshot.training = { status: logmanStatus.grund || 'LOGMAN nicht verbunden' };
    const timeseries = buildTimeseries(rows, jetzt);
    const recentCheckinNotes = rows.checkins.filter((zeile) => String(zeile.note || '').trim()).slice(0, 5)
      .map((zeile) => ({ date: zeile.checkin_date, text: String(zeile.note).trim().slice(0, 300) }));
    // Gedächtnis ohne Gespräch: nur bestätigte Fakten und laufende Experimente.
    const memory = await loadMemory(userId, crypto.randomUUID(), heute, timeseries);
    const antwort = await openAi('/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(90_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: COACH_MODEL,
        instructions: coachingSystemPrompt(snapshot.profile?.goal),
        input: [{ role: 'user', content: coachingUserPrompt({
          snapshot, timeseries, training, logmanStatus, aenderungen, recentCheckinNotes,
          vortag: vortag ? { datum: vortag.datum, ...(vortag.ergebnis || {}) } : null,
          memory: { profile_memory: memory.blocks.profile_memory, intervention_log: memory.blocks.intervention_log },
          heute,
        }) }],
        reasoning: { effort: 'medium' },
        max_output_tokens: 3000,
        text: { format: { type: 'json_schema', name: 'capboy_coaching', strict: true, schema: COACHING_SCHEMA } },
      }),
    });
    if (antwort.status === 'incomplete') throw new Error(`OpenAI response incomplete: ${antwort.incomplete_details?.reason || 'unknown'}`);
    const roh = outputText(antwort);
    if (!roh) throw new Error('Leere Coaching-Antwort');
    const ergebnis = coachingBereinigen(JSON.parse(roh));
    const { error } = await admin.from('coach_coachings').update({
      status: 'bereit', ergebnis, bereiche: ergebnis.bereiche, modell: COACH_MODEL,
    }).eq('id', anspruch.id).eq('status', 'laeuft');
    if (error) throw error;
    // Erste Nachricht im Gespräch zum Coaching (Gesprächs-id = Coaching-id).
    const { error: gespraechFehler } = await admin.from('ai_coach_messages').insert({
      user_id: userId, conversation_id: anspruch.id, role: 'assistant', content: coachingText(ergebnis),
      context: { coaching: ergebnis, coachingId: anspruch.id },
    });
    if (gespraechFehler) console.error('Coaching nicht im Gesprächsgedächtnis abgelegt', userId, gespraechFehler.message);
    try {
      await coachingPush(userId, heute, ergebnis.ueberschrift);
    } catch (pushFehler) {
      console.error('Coaching gespeichert, Push fehlgeschlagen', userId, pushFehler instanceof Error ? pushFehler.message : pushFehler);
    }
    return 'erstellt';
  } catch (error) {
    const { error: statusFehler } = await admin.from('coach_coachings').update({
      status: 'fehlgeschlagen', fehler: String((error as Error)?.message || error).slice(0, 500),
    }).eq('id', anspruch.id).eq('status', 'laeuft');
    if (statusFehler) console.error('Coaching-Fehlerstatus konnte nicht gespeichert werden', userId, statusFehler);
    throw error;
  }
}

/* Wochen-Coaching am Montag (COACHING-PLAN.md, Schritt 5): ersetzt den
   Tageslauf. Läuft, wenn die abgeschlossene Woche Daten hat; sonst kein
   Aufruf und keine Kosten. Der Anspruch ist dieselbe Zeile je Person und Tag. */
async function wochenCoachingFuerNutzer(userId: string, jetzt: Date, heute: string) {
  const { data: vorhanden, error: vorhandenFehler } = await admin.from('coach_coachings').select('id').eq('user_id', userId).eq('datum', heute).maybeSingle();
  if (vorhandenFehler) throw vorhandenFehler;
  if (vorhanden) return 'schon_erledigt';
  const logmanStatus = await logmanVorDemCoaching(userId);
  const [rows, revisionResult] = await Promise.all([
    fetchContextRows(userId, jetzt),
    admin.from('coach_input_revisions').select('revision').eq('user_id', userId).maybeSingle(),
  ]);
  if (revisionResult.error) throw revisionResult.error;
  if (!logmanStatus.frisch) rows.performance = rows.performance.filter((zeile) => zeile.source !== 'LOGMAN-Abgleich');
  const timeseries = buildTimeseries(rows, jetzt);
  const reviewed = reviewWeeks(timeseries);
  if (!reviewed) return 'keine_woche';
  const woche = reviewed.current.week;

  const [kaertchenResult, spiegelResult, staendeResult, vortagResult] = await Promise.all([
    admin.from('coach_wochen_checkins').select('umstaende,notiz,umsetzung').eq('user_id', userId).eq('woche', woche).maybeSingle(),
    logmanStatus.frisch
      ? admin.from('logman_spiegel').select('payload,einheiten_gesehen,prioritaet_verlauf').eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin.from('coach_coachings').select('datum,volumen_stand').eq('user_id', userId).eq('art', 'woche')
      .not('volumen_stand', 'is', null).lt('datum', heute).order('datum', { ascending: false }).limit(2),
    admin.from('coach_coachings').select('datum,ergebnis').eq('user_id', userId).eq('status', 'bereit').lt('datum', heute)
      .order('datum', { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const ergebnis of [kaertchenResult, spiegelResult, staendeResult, vortagResult]) if (ergebnis.error) throw ergebnis.error;
  const kaertchen = kaertchenResult.data
    ? { circumstances: kaertchenResult.data.umstaende || [], note: kaertchenResult.data.notiz || '', interventions: kaertchenResult.data.umsetzung || [] }
    : null;
  const memory = await loadMemory(userId, crypto.randomUUID(), heute, timeseries);
  const weekly = weeklyBlock(timeseries, kaertchen, await loadPreviousReview(userId, woche), memory.interventions || []);
  if (!weekly) return 'keine_woche';
  const spiegel = spiegelResult.data;
  const hatTraining = rows.performance.some((zeile) => {
    const tag = String(zeile.performed_on || '').slice(0, 10);
    return tag >= weekly.from && tag <= weekly.to;
  });
  if (!hatTraining && !weekly.comparison.some((zeile: Row) => zeile.current != null)) return 'keine_daten';

  const training = spiegel ? trainingsAuswertung(spiegel.payload, { gesehen: spiegel.einheiten_gesehen || {}, heute }) : null;
  const volumen = spiegel
    ? volumenEntscheidung({
      payload: spiegel.payload, gesehen: spiegel.einheiten_gesehen || {}, heute, timeseries,
      fenster: fensterWerte(rows, heute), aus: rows.switchedOffAreas || [], kaertchen,
      fruehereStaende: (staendeResult.data || []).map((zeile: Row) => zeile.volumen_stand),
      prioritaetVerlauf: spiegel.prioritaet_verlauf || [],
    })
    : { stand: null, sperren: [{ id: 'logman', text: logmanStatus.grund || 'Kein aktueller LOGMAN-Stand.' }], muskeln: [], aktionen: [BEIBEHALTEN], grundlage: null };

  const { data: anspruch, error: anspruchFehler } = await admin.from('coach_coachings').insert({
    user_id: userId, art: 'woche', datum: heute, status: 'laeuft',
    input_revision: Number(revisionResult.data?.revision || 0), volumen_stand: volumen.stand,
  }).select('id').single();
  if (anspruchFehler?.code === '23505') return 'schon_erledigt';
  if (anspruchFehler) throw anspruchFehler;
  try {
    const snapshot: Row = buildCompFacts(rows, jetzt);
    if (!logmanStatus.frisch && !rows.performance.length) snapshot.training = { status: logmanStatus.grund || 'LOGMAN nicht verbunden' };
    const recentCheckinNotes = rows.checkins.filter((zeile) => String(zeile.note || '').trim()).slice(0, 5)
      .map((zeile) => ({ date: zeile.checkin_date, text: String(zeile.note).trim().slice(0, 300) }));
    const vortag = vortagResult.data;
    const aktionsIds = volumen.aktionen.map((aktion: Row) => aktion.id);
    const antwort = await openAi('/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(120_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: COACH_MODEL,
        instructions: wochenSystemPrompt(snapshot.profile?.goal),
        input: [{ role: 'user', content: wochenUserPrompt({
          snapshot, timeseries, weekly, training, volumen, recentCheckinNotes,
          vortag: vortag ? { datum: vortag.datum, ...(vortag.ergebnis || {}) } : null,
          memory: { profile_memory: memory.blocks.profile_memory, intervention_log: memory.blocks.intervention_log },
          heute,
        }) }],
        reasoning: { effort: 'medium' },
        max_output_tokens: 4000,
        text: { format: { type: 'json_schema', name: 'capboy_wochen_coaching', strict: true, schema: wochenSchema(aktionsIds) } },
      }),
    });
    if (antwort.status === 'incomplete') throw new Error(`OpenAI response incomplete: ${antwort.incomplete_details?.reason || 'unknown'}`);
    const roh = outputText(antwort);
    if (!roh) throw new Error('Leere Wochen-Coaching-Antwort');
    // Regeln für Experimente gelten deterministisch vor dem Speichern
    // (wochenBereinigen): fällige Urteile vollständig, neue Experimente nur
    // regelkonform.
    const laufend = (memory.interventions || []).filter((zeile: Row) => zeile.status === 'aktiv');
    const faellige = laufend
      .filter((zeile: Row) => zeile.review_date && String(zeile.review_date).slice(0, 10) <= heute)
      .map((zeile: Row) => ({
        id: String(zeile.id),
        measurement: experimentMeasurement(zeile.target_metric_id, zeile.start_date, timeseries)?.text || '',
        adherence: zeile.adherence || 'unbekannt',
      }));
    // Dieselbe Regel wie die Volumensperre (volumen.js) und Prompt-Regel 2.
    const nichtRepraesentativ = wocheNichtRepraesentativ({ wochen: [reviewed.previous, reviewed.current], kaertchen }).length > 0;
    const bereinigt = wochenBereinigen(JSON.parse(roh), {
      aktionen: volumen.aktionen, faellige, heute, nichtRepraesentativ,
      laufendeMetriken: laufend.map((zeile: Row) => zeile.target_metric_id).filter(Boolean),
    });
    if (bereinigt.verworfen.length) console.log('Wochen-Coaching: verworfen', userId, bereinigt.verworfen.join(' | '));
    const ergebnis = {
      ...bereinigt,
      // Von der App, nicht von der KI: der Wochenvergleich für die Karte.
      wochenvergleich: { week: weekly.week, previousWeek: weekly.previousWeek, from: weekly.from, to: weekly.to, comparison: weekly.comparison },
    };
    const { error } = await admin.from('coach_coachings').update({
      status: 'bereit', ergebnis, bereiche: ergebnis.bereiche, modell: COACH_MODEL,
    }).eq('id', anspruch.id).eq('status', 'laeuft');
    if (error) throw error;
    // Bilanz der Woche auch im bisherigen Verlauf, damit die nächste Woche den
    // Fokus kennt (previousFocus liest recommendations[].action).
    await saveWeeklyReview(userId, weekly, kaertchen || {}, {
      ...ergebnis, recommendations: [{ action: ergebnis.fokus.text }, ...ergebnis.neuesExperiment],
    }, anspruch.id);
    const { error: gespraechFehler } = await admin.from('ai_coach_messages').insert({
      user_id: userId, conversation_id: anspruch.id, role: 'assistant', content: wochenText(ergebnis),
      context: { coaching: ergebnis, coachingId: anspruch.id, art: 'woche' },
    });
    if (gespraechFehler) console.error('Wochen-Coaching nicht im Gesprächsgedächtnis abgelegt', userId, gespraechFehler.message);
    try {
      await coachingPush(userId, heute, ergebnis.ueberschrift, 'Wochen-Coaching');
    } catch (pushFehler) {
      console.error('Wochen-Coaching gespeichert, Push fehlgeschlagen', userId, pushFehler instanceof Error ? pushFehler.message : pushFehler);
    }
    return 'erstellt';
  } catch (error) {
    const { error: statusFehler } = await admin.from('coach_coachings').update({
      status: 'fehlgeschlagen', fehler: String((error as Error)?.message || error).slice(0, 500),
    }).eq('id', anspruch.id).eq('status', 'laeuft');
    if (statusFehler) console.error('Wochen-Coaching-Fehlerstatus konnte nicht gespeichert werden', userId, statusFehler);
    throw error;
  }
}

// Lauf über alle Konten. Nur um 21 Uhr in Europe/Berlin, außer erzwingen
// (Test für ein einzelnes Konto über denselben geschützten Weg).
async function coachingLauf({ erzwingen = false, userId = null as string | null } = {}) {
  const jetzt = new Date();
  const { datum, stunde, montag } = berlinTeile(jetzt);
  if (!erzwingen && stunde !== 21) return;
  const konten = userId ? [{ id: userId }] : await pagedRows(() => admin.from('profiles').select('id').order('id'));
  for (let index = 0; index < konten.length; index += 2) {
    await Promise.all(konten.slice(index, index + 2).map(async (konto: Row) => {
      try {
        // Montags ersetzt das Wochen-Coaching den Tageslauf (höchstens ein
        // bezahlter Lauf je Person und Tag).
        const ergebnis = montag ? await wochenCoachingFuerNutzer(konto.id, jetzt, datum) : await coachingFuerNutzer(konto.id, jetzt, datum);
        console.log(montag ? 'Wochen-Coaching' : 'Coaching', konto.id, ergebnis);
      } catch (error) {
        console.error('Coaching fehlgeschlagen', konto.id, error instanceof Error ? error.message : error);
      }
    }));
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Nur POST ist erlaubt.' }, 405);
  if (!supabaseUrl || !serviceRoleKey || !openAiKey) return json({ error: 'Coach ist noch nicht vollständig konfiguriert.' }, 503);

  // Zeitplan (pg_cron, Migration 20261003120000): berechtigt allein über
  // x-cron-secret. Die Antwort kommt sofort, das Coaching läuft im Hintergrund
  // weiter (der Zeitplan wartet nur 5 Sekunden).
  const cronKopf = request.headers.get('x-cron-secret');
  if (cronKopf) {
    if (!cronSecret || cronKopf !== cronSecret) return json({ error: 'Nicht autorisiert.' }, 401);
    const auftrag = await request.json().catch(() => ({}));
    if (auftrag?.mode !== 'coaching-lauf') return json({ error: 'Unbekannter Auftrag.' }, 400);
    if (auftrag?.erzwingen === true && !isUuid(auftrag?.userId)) return json({ error: 'Testlauf nur für ein einzelnes Konto.' }, 400);
    const lauf = coachingLauf({
      erzwingen: auftrag?.erzwingen === true,
      userId: isUuid(auftrag?.userId) ? auftrag.userId as string : null,
    });
    const laufzeit = (globalThis as Row).EdgeRuntime;
    if (laufzeit?.waitUntil) laufzeit.waitUntil(lauf);
    else await lauf;
    return json({ ok: true }, 202);
  }

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  const { data: userData, error: authError } = await admin.auth.getUser(token);
  if (authError || !userData?.user) return json({ error: 'Nicht angemeldet.' }, 401);
  const userId = userData.user.id;

  try {
    const body = await request.json();
    // Seit Schritt 6 des Coaching-Plans gibt es hier nur noch den Chat. Die
    // Seiten-Auswertungen (COMP „Neu bewerten“, Schlaf, Hautfalten, Gesamtbild)
    // und die Wochenbilanz im Chat sind entfallen: Bewertet wird im täglichen
    // Coaching und montags im Wochen-Coaching (Zeitplan oben).
    if (String(body?.scope || 'coach') !== 'coach' || body?.mode === 'weekly') {
      return json({ error: 'Diese Auswertung gibt es nicht mehr. Bewertet wird jeden Abend im Coaching; Fragen beantwortet der Coach im Chat.' }, 410);
    }
    const scope: Scope = 'coach';
    const question = String(body?.question || '').trim().slice(0, 2000);
    if (question.length < 2) return json({ error: 'Bitte stelle eine Frage.' }, 400);
    const webResearch = body?.webResearch === true;
    // Schritt 4b: „Frage“ beantwortet nur die Frage. Ohne Angabe (ältere
    // App-Version) bleibt es bei „Bewertung & Schritte“. „Daraus Schritte
    // machen“ ist eine Bewertung mit eigenem Auftrag aus Frage und Antwort.
    const modus: 'frage' | 'bewertung' = body?.modus === 'frage' ? 'frage' : 'bewertung';
    const schritteText = modus === 'bewertung' ? schritteAuftrag(body?.schritteAus) : null;
    // Ein Anhang aus Kamera, Fotos oder Dateien (Bild, PDF oder Text).
    const { imageDataUrls, dateien, texte } = anhaengeAuswerten(body?.attachments);

    // Dieselben Fakten und Zeitreihen wie im Coaching.
    const now = new Date();
    const contextRows = await fetchContextRows(userId, now);
    const snapshot = buildCompFacts(contextRows, now);
    const timeseries = buildTimeseries(contextRows, now);
    const limits = calorieBasis(contextRows.nutritionEntries, now, targetPhaseDay(contextRows.settings), !contextRows.switchedOffAreas?.includes('nutrition'));
    // Ein Gespräch geht weiter, wenn die App seine id schickt; sonst beginnt ein neues.
    const conversationId = isUuid(body?.conversationId) ? body.conversationId as string : crypto.randomUUID();
    const memory = await loadMemory(userId, conversationId, berlinDay(now), timeseries);
    const vectorStoreId = await ensureKnowledgeBase();

    const requestBody = coachRequestBody({ scope, question: schritteText || question, snapshot, timeseries, memory: memory?.blocks, limits, webResearch, vectorStoreId, imageDataUrls, dateien, texte, modus });
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
    const geparst = JSON.parse(raw);
    const result = enforceCalorieBasis({
      ...(modus === 'frage'
        ? frageBereinigen(geparst, { seminarTitel: seminarTitelAus(responsePayload) })
        : { ...geparst, modus, sources: bewertungsQuellenAus(geparst, responsePayload) }),
      webResearchRequested: webResearch,
      webSources: webResearch ? webSources(responsePayload) : [],
    }, limits);

    // Im Gedächtnis steht bei „Daraus Schritte machen“, zu welcher Frage.
    const bezug = schritteText ? String(body?.schritteAus?.frage || '').trim().slice(0, 300) : '';
    const gespeicherteFrage = schritteText && bezug ? `${question} (zur Frage: ${bezug})` : question;
    const memorySaved = memory?.available ? await saveTurn(userId, conversationId, gespeicherteFrage, result) : false;
    return json({
      result, scope, period: snapshot.period, cached: false,
      conversationId, memoryAvailable: Boolean(memory?.available), memorySaved,
    });
  } catch (error) {
    console.error('CAPBOY coach failed', error);
    return json({ error: 'Der Coach konnte die Daten gerade nicht auswerten.' }, 500);
  }
});
