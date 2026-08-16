import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

// Freier USDA-FoodData-Central-Key. Vorzugsweise als Supabase-Secret setzen
// (USDA_API_KEY); der eingebettete Fallback hält die Suche ohne Secret am Laufen.
const USDA_KEY = Deno.env.get('USDA_API_KEY') || 'DqVbGq3GBsbMIiLV0MZk8lYAdbgIKF1rRFm6FhTf';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// ---------------------------------------------------------------- Übersetzung
async function translateOne(text: string, from: string, to: string): Promise<string> {
  try {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', text.slice(0, 200));
    url.searchParams.set('langpair', `${from}|${to}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (data?.responseStatus === 200 && typeof translated === 'string' && translated.trim()
      && !/MYMEMORY|QUERY LENGTH|INVALID|LIMIT/i.test(translated)) {
      return translated.trim();
    }
  } catch { /* Original als Fallback */ }
  return text;
}

// Übersetzt mehrere Texte, nutzt die food_translations-Tabelle als Cache.
async function translateMany(texts: string[], from: string, to: string): Promise<Map<string, string>> {
  const richtung = `${from}-${to}`;
  const unique = [...new Set(texts.map((t) => String(t || '').trim()).filter(Boolean))];
  const out = new Map<string, string>();
  if (!unique.length) return out;
  if (admin) {
    const { data } = await admin.from('food_translations').select('quelle,ziel')
      .eq('richtung', richtung).in('quelle', unique);
    for (const row of (data || []) as { quelle: string; ziel: string }[]) out.set(row.quelle, row.ziel);
  }
  const missing = unique.filter((t) => !out.has(t));
  const pairs = await Promise.all(missing.map(async (t) => [t, await translateOne(t, from, to)] as const));
  const store: { quelle: string; richtung: string; ziel: string }[] = [];
  for (const [quelle, ziel] of pairs) {
    out.set(quelle, ziel);
    if (ziel && ziel !== quelle) store.push({ quelle, richtung, ziel });
  }
  if (admin && store.length) {
    try { await admin.from('food_translations').upsert(store, { onConflict: 'quelle,richtung' }); }
    catch { /* Cache ist optional */ }
  }
  return out;
}

// ------------------------------------------------------------- Open Food Facts
const OFF_FIELDS = [
  'code', 'product_name', 'product_name_de', 'generic_name', 'generic_name_de', 'brands',
  'image_front_small_url', 'image_front_url', 'image_url', 'serving_quantity', 'nutriments',
].join(',');

function normalizeOff(product: Record<string, any>) {
  const nutrients = product.nutriments || {};
  const kcal = number(nutrients['energy-kcal_100g'] ?? nutrients['energy-kcal']);
  const kj = number(nutrients.energy_100g ?? nutrients.energy);
  return {
    barcode: String(product.code || '').replace(/\D/g, ''),
    name: String(product.product_name_de || product.product_name || product.generic_name_de || product.generic_name || '').trim(),
    brand: String(product.brands || '').split(',')[0].trim(),
    image_url: String(product.image_front_small_url || product.image_front_url || product.image_url || '').trim(),
    serving_g: number(product.serving_quantity),
    kcal_100g: kcal || (kj ? kj / 4.184 : 0),
    protein_100g: number(nutrients.proteins_100g),
    carbs_100g: number(nutrients.carbohydrates_100g),
    fat_100g: number(nutrients.fat_100g),
    portions: null as [string, number][] | null,
    source: 'open_food_facts',
  };
}

async function offSearch(query: string) {
  try {
    const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
    url.searchParams.set('search_terms', query);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page_size', '16');
    url.searchParams.set('fields', OFF_FIELDS);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MUSCLE-DEX/1.0 (nutrition lookup)', Accept: 'application/json', 'Accept-Language': 'de-DE,de;q=0.9' },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const payload = await res.json();
    return (payload.products || []).map(normalizeOff)
      .filter((p: Record<string, unknown>) => p.name && p.kcal_100g).slice(0, 10);
  } catch { return []; }
}

// --------------------------------------------------------- USDA FoodData Central
// In Deutschland unübliche Einheiten werden komplett verworfen.
const EXCLUDE_UNITS = /(cups?|fl\.?\s?oz|fluid\s?ounces?|ounces?|\boz\b|pounds?|\blbs?\b|pints?|quarts?|gallons?)/i;

// Erkannte Einheiten ins deutsche Ziel-Label übersetzen.
function mapPortionLabel(text: string): string | null {
  const t = String(text || '').toLowerCase();
  if (/tablespoon|tbsp/.test(t)) return '1 Esslöffel (EL)';
  if (/teaspoon|tsp/.test(t)) return '1 Teelöffel (TL)';
  if (/slice/.test(t)) return '1 Scheibe';
  if (/\blarge\b/.test(t)) return '1 Stück (groß)';
  if (/\bsmall\b/.test(t)) return '1 Stück (klein)';
  if (/\bmedium\b|\bitem\b|\bfruit\b|\bpiece\b/.test(t)) return '1 Stück (mittel)';
  return null;
}

function usdaEnergy(nutrients: Record<string, number>) {
  return nutrients['208'] || nutrients['957'] || nutrients['958'] || (nutrients['268'] ? nutrients['268'] / 4.184 : 0);
}

// Portionen kommen nur aus dem Detail-Endpoint (nicht aus der Suche).
async function usdaDetailPortions(fdcId: number): Promise<[string, number][]> {
  try {
    const res = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${USDA_KEY}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const food = await res.json();
    const out: [string, number][] = [];
    const seen = new Set<string>();
    for (const p of food.foodPortions || []) {
      const grams = number(p.gramWeight);
      if (!grams) continue;
      const text = [p.portionDescription, p.modifier, p.measureUnit?.name, p.amount].filter(Boolean).join(' ');
      if (EXCLUDE_UNITS.test(text)) continue;
      const label = mapPortionLabel(text);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push([label, Math.round(grams)]);
    }
    const rang = (l: string) => (l.includes('mittel') ? 0 : l.includes('klein') ? 1 : l.includes('groß') ? 2 : 3);
    return out.sort((a, b) => rang(a[0]) - rang(b[0]));
  } catch { return []; }
}

async function usdaSearch(queryEn: string) {
  let payload: Record<string, any>;
  try {
    const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryEn, dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'], pageSize: 10 }),
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    payload = await res.json();
  } catch { return []; }

  const foods = (payload.foods || []).slice(0, 6).map((food: Record<string, any>) => {
    const nutrients: Record<string, number> = {};
    for (const n of food.foodNutrients || []) nutrients[String(n.nutrientNumber)] = number(n.value);
    return {
      fdcId: food.fdcId as number,
      description: String(food.description || '').trim(),
      kcal_100g: usdaEnergy(nutrients),
      protein_100g: nutrients['203'] || 0,
      carbs_100g: nutrients['205'] || 0,
      fat_100g: nutrients['204'] || 0,
    };
  }).filter((f: Record<string, any>) => f.description && f.kcal_100g);

  const [portionsList, nameMap] = await Promise.all([
    Promise.all(foods.map((f: Record<string, any>) => usdaDetailPortions(f.fdcId))),
    translateMany(foods.map((f: Record<string, any>) => f.description), 'en', 'de'),
  ]);

  return foods.map((f: Record<string, any>, i: number) => {
    const portions = portionsList[i];
    return {
      barcode: '',
      name: nameMap.get(f.description) || f.description,
      brand: 'Grundnahrungsmittel',
      image_url: '',
      serving_g: portions[0]?.[1] || 100,
      kcal_100g: f.kcal_100g,
      protein_100g: f.protein_100g,
      carbs_100g: f.carbs_100g,
      fat_100g: f.fat_100g,
      portions: portions.length ? portions : null,
      source: 'usda',
    };
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Nur POST ist erlaubt.' }, 405);
  try {
    const body = await request.json();

    if (body?.action === 'barcode') {
      const barcode = String(body.barcode || '').replace(/\D/g, '');
      if (barcode.length < 8 || barcode.length > 14) return json({ error: 'Ungültiger Barcode.' }, 400);
      const url = new URL(`https://world.openfoodfacts.org/api/v3/product/${barcode}`);
      url.searchParams.set('fields', OFF_FIELDS);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MUSCLE-DEX/1.0 (nutrition lookup)', Accept: 'application/json', 'Accept-Language': 'de-DE,de;q=0.9' },
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) throw new Error(`Produktdienst nicht erreichbar (${res.status})`);
      const payload = await res.json();
      const product = payload.product ? normalizeOff({ ...payload.product, code: payload.product.code || barcode }) : null;
      return json({ product: product?.name && product.kcal_100g ? product : null });
    }

    if (body?.action === 'search') {
      const query = String(body.query || '').trim().slice(0, 100);
      if (query.length < 2) return json({ products: [] });
      // Deutsche Eingabe für die USDA-Suche ins Englische übersetzen.
      const queryEn = (await translateMany([query], 'de', 'en')).get(query) || query;
      const [usda, off] = await Promise.all([
        usdaSearch(queryEn),
        offSearch(query),
      ]);
      // Grundnahrungsmittel (USDA) zuerst, danach Markenprodukte (OFF).
      const seen = new Set<string>();
      const products: Record<string, unknown>[] = [];
      for (const product of [...usda, ...off] as Record<string, any>[]) {
        const key = String(product.name).toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        products.push(product);
      }
      return json({ products: products.slice(0, 18) });
    }

    return json({ error: 'Unbekannte Aktion.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Produktdaten konnten nicht geladen werden.' }, 502);
  }
});
