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

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: 'Serverkonfiguration fehlt.' }, 503);
  }

  // Nur der eingeloggte Nutzer selbst darf sein Konto löschen. Die ID kommt aus
  // dem verifizierten Token, nie aus dem Request-Body – so kann niemand ein
  // fremdes Konto löschen.
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  const { data: userData, error: authError } = await admin.auth.getUser(token);
  if (authError || !userData?.user) return json({ ok: false, error: 'Nicht angemeldet.' }, 401);
  const userId = userData.user.id;

  try {
    // 1. Storage-Objekte des Nutzers physisch entfernen. Die Storage-API löscht
    //    Datei UND Datensatz; nach owner gefiltert bleiben geteilte
    //    null-owner-Objekte (z. B. link-previews) unangetastet.
    const { data: paths, error: pathError } = await admin.rpc('user_storage_paths', { ziel: userId });
    if (pathError) throw pathError;

    const byBucket = new Map<string, string[]>();
    for (const row of (paths || []) as { bucket_id: string; name: string }[]) {
      byBucket.set(row.bucket_id, [...(byBucket.get(row.bucket_id) || []), row.name]);
    }
    for (const [bucket, names] of byBucket) {
      // remove() nimmt nur eine begrenzte Anzahl Pfade pro Aufruf.
      for (const teil of chunk(names, 100)) {
        const { error: removeError } = await admin.storage.from(bucket).remove(teil);
        if (removeError) throw removeError;
      }
    }

    // 2. Auth-User löschen → kaskadiert alle DB-Daten. Der Storage-Trigger
    //    findet keine Objekte mehr und läuft leer durch.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: String((error as Error)?.message || error) }, 500);
  }
});
