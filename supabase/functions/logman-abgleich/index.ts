import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { parseLogmanExport } from './umrechnung.js';

// LOGMAN-Abgleich: CAPBOY liest das Trainingslog des eigenen LOGMAN-Kontos
// selbst. Gekoppelt wird einmal per Code aus LOGMAN (Profil → „Mit CAPBOY
// verbinden“). Der Code wird hier gegen einen Lese-Token getauscht, der in
// LOGMAN nur ein einziges Log LESEN kann (LOGMAN-Migration
// 20261002210000_capboy_kopplung). Geschrieben wird nur in CAPBOY:
// logman_spiegel (der ganze Stand für die Auswertung) und logman_performance
// (dieselben Leistungszeilen wie beim bisherigen Export-Import).
//
// Aktionen: status, koppeln { code }, abgleichen { erzwingen?, neu? }, trennen.
// erzwingen übergeht den 30-Minuten-Abstand, neu baut die Leistungszeilen
// auch bei unveränderter LOGMAN-Version neu auf (z. B. nach dem Zurücksetzen
// in COMP).

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
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// LOGMANs öffentliche Adresse und öffentlicher Schlüssel: Sie stehen ohnehin im
// LOGMAN-Code und sind kein Geheimnis. Der Lese-Token ist das Geheimnis.
const LOGMAN_URL = Deno.env.get('LOGMAN_URL') || 'https://bjtnpmselziqpwnthukj.supabase.co';
const LOGMAN_KEY = Deno.env.get('LOGMAN_PUBLISHABLE_KEY') || 'sb_publishable_wPAzLdRgAvy46B5KMNuyCQ_-KGAbm5T';
const logman = createClient(LOGMAN_URL, LOGMAN_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Beim Öffnen der App höchstens alle 30 Minuten (Log-Volumen); der Coaching-
// Lauf um 21 Uhr gleicht mit erzwingen immer ab.
const ABGLEICH_ABSTAND_MS = 30 * 60 * 1000;

type Row = Record<string, any>;

async function kopplungLesen(userId: string) {
  const { data, error } = await admin.from('logman_kopplung').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Kopplung lesen: ${error.message}`);
  return data as Row | null;
}

async function statusAntwort(userId: string, zusatz: Row = {}) {
  const [kopplung, spiegel] = await Promise.all([
    kopplungLesen(userId),
    admin.from('logman_spiegel').select('logman_stand,abgerufen_am').eq('user_id', userId).maybeSingle().then((r) => r.data),
  ]);
  return json({
    verbunden: Boolean(kopplung),
    verbunden_am: kopplung?.verbunden_am || null,
    zuletzt_abgeglichen_am: kopplung?.zuletzt_abgeglichen_am || null,
    logman_stand: spiegel?.logman_stand || null,
    ...zusatz,
  });
}

// Leistungszeilen aus dem Stand. Einheiten ohne Datum fallen weg: Mit dem
// heutigen Datum als Ersatz entstünden bei jedem Abgleich neue Zeilen.
// Dieselbe Übung zweimal am selben Tag würde den Upsert abbrechen; es zählt
// dann der bessere Wert.
function leistungsZeilen(payload: unknown, userId: string) {
  const beste = new Map<string, Row>();
  for (const zeile of parseLogmanExport(payload, '') as Row[]) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(zeile.performed_on || ''))) continue;
    const performed_on = String(zeile.performed_on).slice(0, 10);
    const schluessel = `${performed_on}|${zeile.exercise}|${zeile.category}`;
    const bisher = beste.get(schluessel);
    if (!bisher || zeile.estimated_1rm > bisher.estimated_1rm) {
      beste.set(schluessel, { ...zeile, performed_on, user_id: userId, source: 'LOGMAN-Abgleich' });
    }
  }
  return [...beste.values()];
}

async function abgleichen(userId: string, erzwingen: boolean, neu = false) {
  const kopplung = await kopplungLesen(userId);
  if (!kopplung) return statusAntwort(userId);
  const zuletzt = kopplung.zuletzt_abgeglichen_am ? Date.parse(kopplung.zuletzt_abgeglichen_am) : 0;
  if (!erzwingen && Date.now() - zuletzt < ABGLEICH_ABSTAND_MS) {
    return statusAntwort(userId, { ergebnis: 'uebersprungen' });
  }

  const { data: spiegel } = await admin.from('logman_spiegel').select('logman_version').eq('user_id', userId).maybeSingle();
  const { data: antwort, error } = await logman.rpc('capboy_training_log', {
    p_token: kopplung.token,
    p_bekannte_version: neu ? null : spiegel?.logman_version ?? null,
  });
  if (error) {
    // In LOGMAN getrennt: Der Token gilt nicht mehr, die Kopplung hier auch nicht.
    if (/Nicht verbunden/i.test(error.message || '')) {
      await admin.from('logman_kopplung').delete().eq('user_id', userId);
      return statusAntwort(userId, { ergebnis: 'getrennt' });
    }
    throw new Error(`LOGMAN lesen: ${error.message}`);
  }
  const jetzt = new Date().toISOString();
  await admin.from('logman_kopplung').update({ zuletzt_abgeglichen_am: jetzt }).eq('user_id', userId);
  if (antwort?.status !== 'ok') return statusAntwort(userId, { ergebnis: antwort?.status === 'leer' ? 'leer' : 'unveraendert' });

  const { error: spiegelFehler } = await admin.from('logman_spiegel').upsert({
    user_id: userId,
    payload: antwort.payload || {},
    logman_version: antwort.version,
    logman_stand: antwort.updated_at || null,
    abgerufen_am: jetzt,
  });
  if (spiegelFehler) throw new Error(`Spiegel schreiben: ${spiegelFehler.message}`);

  const zeilen = leistungsZeilen(antwort.payload, userId);
  if (zeilen.length) {
    const { error: leistungFehler } = await admin.from('logman_performance')
      .upsert(zeilen, { onConflict: 'user_id,performed_on,exercise,category' });
    if (leistungFehler) throw new Error(`Leistung schreiben: ${leistungFehler.message}`);
  }
  return statusAntwort(userId, { ergebnis: 'neu', leistungswerte: zeilen.length });
}

async function koppeln(userId: string, code: string) {
  if (!code.replace(/[^A-Za-z0-9]/g, '')) return json({ error: 'Bitte den Code aus LOGMAN eingeben.' }, 400);
  const { data, error } = await logman.rpc('capboy_code_einloesen', { p_code: code });
  if (error || !data?.token) {
    const ungueltig = /ungueltig|abgelaufen/i.test(error?.message || '');
    return json({ error: ungueltig ? 'Der Code ist ungültig oder abgelaufen. Erzeuge in LOGMAN einen neuen.' : 'LOGMAN ist gerade nicht erreichbar.' }, ungueltig ? 400 : 502);
  }
  const { error: speichernFehler } = await admin.from('logman_kopplung').upsert({
    user_id: userId,
    token: data.token,
    verbunden_am: new Date().toISOString(),
    zuletzt_abgeglichen_am: null,
  });
  if (speichernFehler) throw new Error(`Kopplung speichern: ${speichernFehler.message}`);
  // Neue Kopplung, womöglich ein anderes LOGMAN-Konto: alles neu lesen.
  await admin.from('logman_spiegel').delete().eq('user_id', userId);
  return abgleichen(userId, true, true);
}

async function trennen(userId: string) {
  const kopplung = await kopplungLesen(userId);
  if (kopplung) {
    // Auch in LOGMAN ungültig machen; scheitert das, ist der Token hier
    // trotzdem weg und wird nie wieder benutzt.
    await logman.rpc('capboy_token_trennen', { p_token: kopplung.token }).then(() => {}, () => {});
    await admin.from('logman_kopplung').delete().eq('user_id', userId);
  }
  return statusAntwort(userId, { ergebnis: 'getrennt' });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Nur POST ist erlaubt.' }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Der LOGMAN-Abgleich ist noch nicht eingerichtet.' }, 503);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  const { data: userData, error: authError } = await admin.auth.getUser(token);
  if (authError || !userData?.user) return json({ error: 'Nicht angemeldet.' }, 401);
  const userId = userData.user.id;

  try {
    const body = await request.json().catch(() => ({}));
    const aktion = String(body?.aktion || 'status');
    if (aktion === 'status') return await statusAntwort(userId);
    if (aktion === 'koppeln') return await koppeln(userId, String(body?.code || '').slice(0, 40));
    if (aktion === 'abgleichen') return await abgleichen(userId, body?.erzwingen === true, body?.neu === true);
    if (aktion === 'trennen') return await trennen(userId);
    return json({ error: 'Unbekannte Aktion.' }, 400);
  } catch (error) {
    console.error('logman-abgleich', error instanceof Error ? error.message : error);
    return json({ error: 'Der Abgleich mit LOGMAN hat gerade nicht geklappt.' }, 500);
  }
});
