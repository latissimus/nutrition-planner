const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function safeUrl(value: unknown) {
  const url = new URL(String(value || ''));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Ungültiger Link');
  const host = url.hostname.toLowerCase();
  const privateIpv4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0' || host === '169.254.169.254'
    || host.endsWith('.local') || privateIpv4.test(host)) throw new Error('Lokale Links sind nicht erlaubt');
  return url;
}

function content(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  return patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) || '';
}

async function oembed(endpoint: string) {
  const response = await fetch(endpoint, { headers: { 'User-Agent': 'MUSCLE-DEX/1.0' }, signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error('oEmbed nicht verfügbar');
  return await response.json();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = safeUrl((await request.json()).url);
    const encoded = encodeURIComponent(url.href);
    let data: Record<string, unknown> = {};
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) data = await oembed(`https://www.youtube.com/oembed?format=json&url=${encoded}`);
    else if (url.hostname.includes('tiktok.com')) data = await oembed(`https://www.tiktok.com/oembed?url=${encoded}`);
    else if (url.hostname.includes('vimeo.com')) data = await oembed(`https://vimeo.com/api/oembed.json?url=${encoded}`);
    else {
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MUSCLE-DEX/1.0)' }, redirect: 'follow', signal: AbortSignal.timeout(6500) });
      const html = (await response.text()).slice(0, 1_000_000);
      data = {
        title: content(html, 'og:title') || content(html, 'twitter:title'),
        description: content(html, 'og:description') || content(html, 'description'),
        thumbnail_url: content(html, 'og:image') || content(html, 'twitter:image'),
        provider_name: url.hostname.replace(/^www\./, ''),
      };
    }
    const rawPreview = String(data.thumbnail_url || '');
    let previewUrl = '';
    try { previewUrl = rawPreview ? new URL(rawPreview, url).href : ''; } catch { previewUrl = ''; }
    return json({
      title: String(data.title || '').slice(0, 100),
      description: String(data.description || data.author_name || '').slice(0, 500),
      previewUrl: previewUrl.slice(0, 2000),
      provider: String(data.provider_name || url.hostname.replace(/^www\./, '')).slice(0, 80),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Vorschau nicht verfügbar' }, 422);
  }
});
