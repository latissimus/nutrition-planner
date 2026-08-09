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

async function pageMetadata(url: URL, existingResponse?: Response) {
  const response = existingResponse || await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MUSCLE-DEX/1.0)' },
    redirect: 'follow', signal: AbortSignal.timeout(6500),
  });
  const html = (await response.text()).slice(0, 1_000_000);
  return {
    title: content(html, 'og:title') || content(html, 'twitter:title'),
    description: content(html, 'og:description') || content(html, 'description'),
    thumbnail_url: content(html, 'og:image') || content(html, 'twitter:image'),
    provider_name: url.hostname.replace(/^www\./, ''),
  };
}

async function tiktokEmbedMetadata(url: URL) {
  const postId = url.pathname.match(/\/(?:video|photo)\/(\d+)/i)?.[1];
  if (!postId) throw new Error('TikTok-Beitrag nicht erkannt');
  const response = await fetch(`https://www.tiktok.com/embed/v2/${postId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MUSCLE-DEX/1.0)' },
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) throw new Error('TikTok-Embed nicht verfügbar');
  const html = await response.text();
  const stateText = html.match(/<script[^>]+id=["']__FRONTITY_CONNECT_STATE__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!stateText) throw new Error('TikTok-Metadaten nicht verfügbar');
  const state = JSON.parse(stateText);
  const pageData = Object.values(state?.source?.data || {}).find((value: any) => value?.videoData) as any;
  const videoData = pageData?.videoData || {};
  const item = videoData.itemInfos || {};
  const firstImage = videoData?.imagePostInfo?.displayImages?.[0]?.urlList?.[0] || '';
  const videoCover = item?.covers?.[0] || item?.coversMedium?.[0] || '';
  return {
    title: String(item.text || '').split(/\r?\n/)[0],
    description: String(item.text || ''),
    thumbnail_url: firstImage || videoCover,
    provider_name: 'TikTok',
  };
}

async function stablePreviewUrl(value: string) {
  if (!value) return '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) return value;
  try {
    const response = await fetch(safeUrl(value), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MUSCLE-DEX/1.0)' },
      redirect: 'follow', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return value;
    const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    };
    const extension = extensions[contentType];
    if (!extension) return value;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.byteLength > 5 * 1024 * 1024) return value;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    const hash = [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
    const path = `${hash}.${extension}`;
    const upload = await fetch(`${supabaseUrl}/storage/v1/object/link-previews/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${serviceKey}`, apikey: serviceKey,
        'content-type': contentType, 'x-upsert': 'true',
      },
      body: bytes,
    });
    if (!upload.ok) return value;
    return `${supabaseUrl}/storage/v1/object/public/link-previews/${path}`;
  } catch { return value; }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    let url = safeUrl((await request.json()).url);
    let resolvedResponse: Response | undefined;
    if (url.hostname === 'vm.tiktok.com' || url.hostname === 'vt.tiktok.com') {
      resolvedResponse = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MUSCLE-DEX/1.0)' },
        redirect: 'follow', signal: AbortSignal.timeout(6500),
      });
      url = safeUrl(resolvedResponse.url);
    }
    const encoded = encodeURIComponent(url.href);
    let data: Record<string, unknown> = {};
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) data = await oembed(`https://www.youtube.com/oembed?format=json&url=${encoded}`);
    else if (url.hostname.includes('tiktok.com')) {
      try { data = await oembed(`https://www.tiktok.com/oembed?url=${encoded}`); }
      catch {
        try { data = await tiktokEmbedMetadata(url); }
        catch { data = await pageMetadata(url, resolvedResponse); }
      }
    }
    else if (url.hostname.includes('vimeo.com')) data = await oembed(`https://vimeo.com/api/oembed.json?url=${encoded}`);
    else data = await pageMetadata(url);
    const rawPreview = String(data.thumbnail_url || '');
    let previewUrl = '';
    try { previewUrl = rawPreview ? new URL(rawPreview, url).href : ''; } catch { previewUrl = ''; }
    const stablePreview = await stablePreviewUrl(previewUrl);
    return json({
      title: String(data.title || '').slice(0, 100),
      description: String(data.description || data.author_name || '').slice(0, 500),
      previewUrl: stablePreview.slice(0, 2000),
      provider: String(data.provider_name || url.hostname.replace(/^www\./, '')).slice(0, 80),
      resolvedUrl: url.href.slice(0, 2000),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Vorschau nicht verfügbar' }, 422);
  }
});
