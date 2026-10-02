import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

// KI-Werkzeuge der App, bewusst getrennt vom Coach (capboy-coach): dessen
// geprüfter Prompt bleibt unberührt. Drei Aktionen:
//   transkribieren      Sprachnachricht aus dem Chat → Text
//   zutaten-verstehen   Rezeptbeschreibung → Zutaten mit Gramm und Suchbegriffen
//   zutaten-zuordnen    je Zutat einen Eintrag aus den Kandidaten wählen, die
//                       die App mit ihrer eigenen Lebensmittelsuche (BLS) fand
// Die Lebensmitteldaten liegen nur in der App; die Funktion sieht ausschließlich
// die Kandidaten, die die App mitschickt.

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

const MODELL = Deno.env.get('KI_WERKZEUGE_MODELL') || 'gpt-6-sol';
const TRANSKRIPTION_MODELL = Deno.env.get('TRANSKRIPTION_MODELL') || 'gpt-4o-transcribe';
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const MAX_BESCHREIBUNG = 2000;
const MAX_ZUTATEN = 30;
const MAX_KANDIDATEN = 14;

type Row = Record<string, any>;

function ausgabeText(antwort: Row) {
  const teile: string[] = [];
  for (const eintrag of antwort.output || []) {
    if (eintrag.type !== 'message') continue;
    for (const inhalt of eintrag.content || []) {
      if (inhalt.type === 'output_text' && inhalt.text) teile.push(inhalt.text);
    }
  }
  return teile.join('');
}

async function strukturiert(name: string, anweisung: string, eingabe: string, schema: Row) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELL,
      instructions: anweisung,
      input: [{ role: 'user', content: eingabe }],
      reasoning: { effort: 'low' },
      max_output_tokens: 4000,
      text: { format: { type: 'json_schema', name, strict: true, schema } },
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI ${response.status} ${String(payload?.error?.message || '').slice(0, 300)}`);
  }
  const text = ausgabeText(payload);
  if (!text) throw new Error('Leere Antwort');
  return JSON.parse(text);
}

// ---------------------------------------------------------------- Sprache

async function transkribieren(form: FormData) {
  const datei = form.get('audio');
  if (!(datei instanceof File) || !datei.size) return json({ error: 'Keine Aufnahme erhalten.' }, 400);
  if (datei.size > MAX_AUDIO_BYTES) return json({ error: 'Die Aufnahme ist zu lang.' }, 413);
  const anfrage = new FormData();
  anfrage.append('file', datei, datei.name || 'aufnahme.m4a');
  anfrage.append('model', TRANSKRIPTION_MODELL);
  anfrage.append('language', 'de');
  anfrage.append('response_format', 'json');
  // Fachwörter aus der App, damit sie richtig geschrieben ankommen.
  anfrage.append('prompt', 'Nachricht an den Fitness- und Ernährungscoach der App CAPBOY: Training, Kalorien, Protein, Kreatin, Supplements, Schlaf, Routinen, Körperfett.');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}` },
    body: anfrage,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Transkription fehlgeschlagen', response.status, payload?.error?.message);
    return json({ error: 'Die Aufnahme konnte nicht verschriftlicht werden.' }, 502);
  }
  const text = String(payload?.text || '').trim();
  return json({ text });
}

// ---------------------------------------------------------------- Rezepte

const verstehenSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['zutaten'],
  properties: {
    zutaten: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'gramm', 'anzahl', 'einheit', 'suchbegriffe'],
        properties: {
          name: { type: 'string' },
          gramm: { type: 'number' },
          anzahl: { type: ['number', 'null'] },
          einheit: { type: ['string', 'null'] },
          suchbegriffe: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const VERSTEHEN_ANWEISUNG = `Du zerlegst die Beschreibung eines Rezepts in seine einzelnen Zutaten. Sie werden danach in einer deutschen Lebensmitteldatenbank (Bundeslebensmittelschlüssel, BLS) gesucht.

Regeln:
- Nur Zutaten, die in der Beschreibung vorkommen. Nichts ergänzen, keine Beilagen erfinden.
- name: kurze deutsche Bezeichnung des Lebensmittels, ohne Menge (z. B. "Basmatireis", "Hühnerei", "Olivenöl").
- gramm: Gesamtmenge dieser Zutat im ganzen Rezept in Gramm. Steht eine Grammzahl da, übernimm sie. Bei Stück, Esslöffeln, Tassen oder ohne Angabe schätze eine übliche Menge (1 Ei ≈ 60 g, 1 EL Öl ≈ 10 g, 1 Paprika ≈ 160 g, 1 Zwiebel ≈ 80 g, 1 Prise Salz ≈ 1 g). Mengen von Trockenprodukten wie Reis oder Nudeln gelten ungekocht, sofern nicht ausdrücklich „gekocht“ dasteht.
- anzahl und einheit: nur wenn die Zutat in Stück, Scheiben oder ähnlichen zählbaren Einheiten genannt ist (z. B. anzahl 2, einheit "Stück"), sonst beide null.
- suchbegriffe: ein bis drei Suchbegriffe in der Schreibweise des BLS, vom genauesten zum allgemeinsten. Der BLS nennt zuerst das Grundlebensmittel, dann Teil oder Sorte als eigenes Wort, ohne Zusammensetzungen: "Hähnchen Brustfilet", "Hafer Flocken", "Rind Hackfleisch", "Speisequark Magerstufe", "Gemüsepaprika rot", "Hühnerei", "Teigwaren eifrei", "Reis". Also z. B. ["Hähnchen Brustfilet", "Hähnchen"] statt ["Hähnchenbrust"]. Je Suchbegriff höchstens drei Wörter, keine Zustandswörter wie "roh" oder "gekocht".
- Gleiche Zutaten zusammenfassen. Höchstens ${MAX_ZUTATEN} Zutaten.
- Ist die Beschreibung kein Rezept, gib eine leere Liste zurück.`;

const zuordnenSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['zuordnungen'],
  properties: {
    zuordnungen: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'kandidat', 'gramm', 'portion', 'anzahl'],
        properties: {
          index: { type: 'integer' },
          kandidat: { type: ['string', 'null'] },
          gramm: { type: 'number' },
          portion: { type: ['string', 'null'] },
          anzahl: { type: ['number', 'null'] },
        },
      },
    },
  },
};

const ZUORDNEN_ANWEISUNG = `Du ordnest Rezeptzutaten Einträgen einer Lebensmitteldatenbank zu. Jede Zutat bringt eine Liste von Kandidaten mit (id, Name, kcal je 100 g, Portionen).

Regeln:
- kandidat: die id des Kandidaten, der genau dieses Lebensmittel in der gemeinten Form ist. Unverarbeitet bzw. roh, wenn nicht anders beschrieben (Reis roh statt gegart, Hähnchenbrust roh statt gebraten). Keine Gerichte, in denen die Zutat nur vorkommt. Passt kein Kandidat wirklich, gib null.
- gramm: die Gesamtmenge in Gramm. Übernimm die Grammzahl der Zutat, außer du nutzt eine Portion.
- portion und anzahl: Wurde die Zutat in Stück o. ä. angegeben und hat der gewählte Kandidat eine passende Portion, gib deren Bezeichnung exakt wie in der Liste und die Anzahl an; gramm ist dann anzahl × Portionsgewicht. Sonst beide null.
- Für jede Zutat genau eine Zuordnung mit ihrem index.`;

const zahl = (wert: unknown, fallback = 0) => {
  const n = Number(wert);
  return Number.isFinite(n) ? n : fallback;
};
const kurz = (wert: unknown, laenge: number) => String(wert ?? '').trim().slice(0, laenge);

async function zutatenVerstehen(body: Row) {
  const beschreibung = kurz(body?.beschreibung, MAX_BESCHREIBUNG);
  if (beschreibung.length < 3) return json({ error: 'Beschreibe kurz, was in das Rezept kommt.' }, 400);
  const ergebnis = await strukturiert('rezept_zutaten', VERSTEHEN_ANWEISUNG, beschreibung, verstehenSchema);
  const zutaten = (Array.isArray(ergebnis?.zutaten) ? ergebnis.zutaten : []).slice(0, MAX_ZUTATEN).map((zutat: Row) => ({
    name: kurz(zutat.name, 80),
    gramm: Math.max(0, Math.min(5000, Math.round(zahl(zutat.gramm)))),
    anzahl: zutat.anzahl == null ? null : Math.max(0, zahl(zutat.anzahl)),
    einheit: zutat.einheit == null ? null : kurz(zutat.einheit, 30),
    suchbegriffe: (Array.isArray(zutat.suchbegriffe) ? zutat.suchbegriffe : []).map((begriff: unknown) => kurz(begriff, 40)).filter(Boolean).slice(0, 3),
  })).filter((zutat: Row) => zutat.name);
  return json({ zutaten });
}

async function zutatenZuordnen(body: Row) {
  const zutaten = (Array.isArray(body?.zutaten) ? body.zutaten : []).slice(0, MAX_ZUTATEN).map((zutat: Row, index: number) => ({
    index,
    name: kurz(zutat.name, 80),
    gramm: Math.max(0, Math.min(5000, zahl(zutat.gramm))),
    anzahl: zutat.anzahl == null ? null : zahl(zutat.anzahl),
    einheit: zutat.einheit == null ? null : kurz(zutat.einheit, 30),
    kandidaten: (Array.isArray(zutat.kandidaten) ? zutat.kandidaten : []).slice(0, MAX_KANDIDATEN).map((kandidat: Row) => ({
      id: kurz(kandidat.id, 12),
      name: kurz(kandidat.name, 120),
      kcal_100g: Math.round(zahl(kandidat.kcal_100g)),
      portionen: (Array.isArray(kandidat.portionen) ? kandidat.portionen : []).slice(0, 6).map((portion: unknown) => kurz(portion, 60)),
    })),
  }));
  if (!zutaten.length) return json({ zuordnungen: [] });
  const ergebnis = await strukturiert('rezept_zuordnung', ZUORDNEN_ANWEISUNG, JSON.stringify({ zutaten }), zuordnenSchema);
  const zuordnungen = (Array.isArray(ergebnis?.zuordnungen) ? ergebnis.zuordnungen : []).map((zuordnung: Row) => {
    const zutat = zutaten[zahl(zuordnung.index, -1)];
    if (!zutat) return null;
    // Nur ids, die die App selbst angeboten hat.
    const kandidat = zutat.kandidaten.some((eintrag: Row) => eintrag.id === zuordnung.kandidat) ? zuordnung.kandidat : null;
    return {
      index: zutat.index,
      kandidat,
      gramm: Math.max(0, Math.min(5000, Math.round(zahl(zuordnung.gramm, zutat.gramm)))),
      portion: zuordnung.portion == null ? null : kurz(zuordnung.portion, 60),
      anzahl: zuordnung.anzahl == null ? null : Math.max(0, zahl(zuordnung.anzahl)),
    };
  }).filter(Boolean);
  return json({ zuordnungen });
}

// ---------------------------------------------------------------- Einstieg

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Nur POST ist erlaubt.' }, 405);
  if (!supabaseUrl || !serviceRoleKey || !openAiKey) return json({ error: 'Die KI-Werkzeuge sind noch nicht eingerichtet.' }, 503);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  const { data: userData, error: authError } = await admin.auth.getUser(token);
  if (authError || !userData?.user) return json({ error: 'Nicht angemeldet.' }, 401);

  try {
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      const form = await request.formData();
      if (form.get('aktion') !== 'transkribieren') return json({ error: 'Unbekannte Aktion.' }, 400);
      return await transkribieren(form);
    }
    const body = await request.json();
    if (body?.aktion === 'zutaten-verstehen') return await zutatenVerstehen(body);
    if (body?.aktion === 'zutaten-zuordnen') return await zutatenZuordnen(body);
    return json({ error: 'Unbekannte Aktion.' }, 400);
  } catch (error) {
    console.error('ki-werkzeuge', error instanceof Error ? error.message : error);
    return json({ error: 'Die KI konnte die Anfrage gerade nicht bearbeiten.' }, 500);
  }
});
