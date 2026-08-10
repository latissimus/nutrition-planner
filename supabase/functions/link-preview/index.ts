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
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=(["'])(.*?)\\1`, 'i'),
    new RegExp(`<meta[^>]+content=(["'])(.*?)\\1[^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  return patterns.map((pattern) => html.match(pattern)?.[2]).find(Boolean) || '';
}

function embeddedJsonString(html: string, key: string) {
  const match = html.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i'));
  if (!match?.[1]) return '';
  try { return JSON.parse(`"${match[1]}"`); } catch { return ''; }
}

function structuredMetadata(html: string, fallbackProvider = '') {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1]);
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== 'object') continue;
        if (Array.isArray(item)) { queue.push(...item); continue; }
        const imageValue = item.thumbnailUrl || item.image;
        const thumbnail = Array.isArray(imageValue)
          ? imageValue.map((value) => typeof value === 'string' ? value : value?.url).find(Boolean) || ''
          : typeof imageValue === 'object' ? imageValue?.url || '' : imageValue || '';
        if (item.name || item.caption || item.description || thumbnail) {
          return {
            title: String(item.name || item.headline || '').trim(),
            description: String(item.caption || item.description || '').trim(),
            thumbnail_url: typeof thumbnail === 'string' ? thumbnail : '',
            provider_name: fallbackProvider,
          };
        }
        queue.push(...Object.values(item));
      }
    } catch { /* Die naechste JSON-LD-Struktur versuchen. */ }
  }
  return {};
}

async function oembed(endpoint: string) {
  const response = await fetch(endpoint, { headers: { 'User-Agent': 'MUSCLE-DEX/1.0' }, signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error('oEmbed nicht verfügbar');
  return await response.json();
}

async function pageMetadata(url: URL, existingResponse?: Response) {
  const fetchUrl = new URL(url.href);
  // Muscle & Strength liefert fuer serverseitige Standard-Requests teilweise
  // nur die Bot-Schutzseite. Die AMP-Variante enthaelt dieselben Artikel-
  // Metadaten, ist aber ohne Challenge abrufbar.
  if (fetchUrl.hostname.toLowerCase().endsWith('muscleandstrength.com') && !fetchUrl.searchParams.has('amp')) {
    fetchUrl.searchParams.set('amp', '1');
  }
  const response = existingResponse || await fetch(fetchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    redirect: 'follow', signal: AbortSignal.timeout(6500),
  });
  let html = (await response.text()).slice(0, 1_000_000);
  // Einige redaktionelle Seiten (u. a. Muscle & Strength) liefern aus
  // Serverless-Umgebungen nur eine Bot-Schutzseite. Die übersetzte HTML-
  // Ansicht ist weiterhin öffentlich lesbar und enthält die originalen
  // title/description/og:image-Tags. Sie wird nur bei einer Challenge
  // verwendet, nie als allgemeiner Proxy.
  if (/just a moment|security verification|checking your browser/i.test(html)
    && url.hostname.toLowerCase().endsWith('muscleandstrength.com')) {
    try {
      const proxyHost = `${url.hostname.replace(/\./g, '-')}.translate.goog`;
      const proxyUrl = new URL(`https://${proxyHost}${url.pathname}`);
      url.searchParams.forEach((value, key) => proxyUrl.searchParams.set(key, value));
      proxyUrl.searchParams.set('_x_tr_sl', 'auto');
      proxyUrl.searchParams.set('_x_tr_tl', 'en');
      proxyUrl.searchParams.set('_x_tr_hl', 'en');
      const proxyResponse = await fetch(proxyUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MUSCLE-DEX/1.0)' },
        redirect: 'follow', signal: AbortSignal.timeout(8000),
      });
      if (proxyResponse.ok) html = (await proxyResponse.text()).slice(0, 1_000_000);
    } catch { /* Den normalen Fallback weiterverwenden. */ }
  }
  const structured = structuredMetadata(html, url.hostname.replace(/^www\./, '')) as Record<string, unknown>;
  const documentTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';
  const preloadImage = html.match(/<link[^>]+rel=["'][^"']*preload[^"']*["'][^>]+as=["']image["'][^>]+href=["']([^"']+)/i)?.[1] || '';
  return {
    title: content(html, 'og:title') || content(html, 'twitter:title') || String(structured.title || '') || documentTitle,
    description: content(html, 'og:description') || content(html, 'twitter:description') || content(html, 'description') || String(structured.description || ''),
    thumbnail_url: content(html, 'og:image') || content(html, 'og:image:url') || content(html, 'twitter:image') || String(structured.thumbnail_url || '') || preloadImage,
    provider_name: url.hostname.replace(/^www\./, ''),
  };
}

async function instagramMetadata(url: URL) {
  const match = url.pathname.match(/\/(reel|reels|tv|p)\/([^/?#]+)/i);
  if (!match) return await pageMetadata(url);
  const type = match[1].toLowerCase() === 'reels' ? 'reel' : match[1].toLowerCase();
  const canonical = new URL(`https://www.instagram.com/${type}/${match[2]}/`);
  let api: Record<string, unknown> = {};
  try {
    api = await oembed(`https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(canonical.href)}&omitscript=true`);
  } catch { /* Instagram kann den anonymen oEmbed-Endpunkt sperren. */ }
  let html = '';
  let embed: Record<string, unknown> = {};
  try {
    const response = await fetch(`${canonical.href}embed/captioned/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      html = (await response.text()).slice(0, 2_000_000);
      const structured = structuredMetadata(html) as Record<string, unknown>;
      embed = {
        ...structured,
        title: content(html, 'og:title') || content(html, 'twitter:title') || structured.title || '',
        description: content(html, 'og:description') || content(html, 'description') || structured.description || '',
        thumbnail_url: content(html, 'og:image') || content(html, 'twitter:image') || structured.thumbnail_url || '',
        provider_name: 'Instagram',
      };
    }
  } catch { /* Danach bleiben API- oder Originalseiten-Daten. */ }
  let page: Record<string, unknown> = {};
  try { page = await pageMetadata(canonical); } catch { /* Embed-Daten verwenden. */ }
  const fallbackDescription = embeddedJsonString(html, 'accessibility_caption')
    || embeddedJsonString(html, 'text');
  const fallbackImage = embeddedJsonString(html, 'display_url')
    || embeddedJsonString(html, 'thumbnail_src');
  return {
    ...page,
    ...embed,
    ...api,
    title: String(api.title || embed.title || page.title || '').trim(),
    description: String(api.description || api.title || embed.description || page.description || fallbackDescription || '').trim(),
    thumbnail_url: String(api.thumbnail_url || embed.thumbnail_url || page.thumbnail_url || fallbackImage || '').trim(),
    provider_name: 'Instagram',
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

async function youtubeMetadata(url: URL, encoded: string) {
  const embed = await oembed(`https://www.youtube.com/oembed?format=json&url=${encoded}`);
  try {
    const page = await pageMetadata(url);
    return {
      ...page,
      ...embed,
      // YouTubes oEmbed liefert keine Videobeschreibung. Die Open-Graph-
      // Beschreibung der Videoseite ergänzt sie, ohne Titel und Thumbnail
      // aus der stabileren oEmbed-Antwort zu verdrängen.
      description: page.description || '',
    };
  } catch {
    return embed;
  }
}

async function stablePreviewUrl(value: string) {
  if (!value) return '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) return value;
  try {
    const response = await fetch(safeUrl(value), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MUSCLE-DEX/1.0)',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: value.includes('cdninstagram.com') || value.includes('fbcdn.net') ? 'https://www.instagram.com/' : '',
      },
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
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) data = await youtubeMetadata(url, encoded);
    else if (url.hostname.includes('tiktok.com')) {
      try { data = await oembed(`https://www.tiktok.com/oembed?url=${encoded}`); }
      catch {
        try { data = await tiktokEmbedMetadata(url); }
        catch { data = await pageMetadata(url, resolvedResponse); }
      }
    }
    else if (url.hostname.includes('instagram.com')) data = await instagramMetadata(url);
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
