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

function normalize(product: Record<string, any>) {
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
    source: 'open_food_facts',
  };
}

const fields = [
  'code', 'product_name', 'product_name_de', 'generic_name', 'generic_name_de', 'brands',
  'image_front_small_url', 'image_front_url', 'image_url', 'serving_quantity', 'nutriments',
].join(',');

async function openFoodFacts(url: URL) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'MUSCLE-DEX/1.0 (nutrition lookup; contact via project repository)',
      Accept: 'application/json',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.7',
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Produktdienst nicht erreichbar (${response.status})`);
  return await response.json();
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
      url.searchParams.set('fields', fields);
      const payload = await openFoodFacts(url);
      const product = payload.product ? normalize({ ...payload.product, code: payload.product.code || barcode }) : null;
      return json({ product: product?.name && product.kcal_100g ? product : null });
    }
    if (body?.action === 'search') {
      const query = String(body.query || '').trim().slice(0, 100);
      if (query.length < 2) return json({ products: [] });
      const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
      url.searchParams.set('search_terms', query);
      url.searchParams.set('search_simple', '1');
      url.searchParams.set('action', 'process');
      url.searchParams.set('json', '1');
      url.searchParams.set('page_size', '16');
      url.searchParams.set('fields', fields);
      const payload = await openFoodFacts(url);
      const products = (payload.products || []).map(normalize)
        .filter((product: Record<string, unknown>) => product.name && product.kcal_100g)
        .slice(0, 12);
      return json({ products });
    }
    return json({ error: 'Unbekannte Aktion.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Produktdaten konnten nicht geladen werden.' }, 502);
  }
});
