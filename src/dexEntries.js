import { supabase } from './supabase.js';
import { colorIsDark, materialIconMarkup } from './categoryIcons.js';
import { dexEntryCardMarkup } from './dexEntryCard.js';
import { toast } from './toast.js';

const BUCKET = 'dex-entries';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function normalizeDexUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Bitte einen Link eintragen.');
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try { parsed = new URL(candidate); } catch { throw new Error('Bitte einen gültigen Link eintragen.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Es sind nur Weblinks erlaubt.');
  return parsed.href;
}

export function sourceFromUrl(value) {
  if (!value) return 'MUSCLE-DEX';
  try {
    return new URL(value).hostname.replace(/^www\./, '').toUpperCase();
  } catch { return 'LINK'; }
}

function queryScope(query, { collectionId }) {
  return collectionId ? query.eq('collection_id', collectionId) : query.is('collection_id', null);
}

export async function loadDexEntries(userId, { rootKey, collectionId = null, signal } = {}) {
  let query = supabase.from('dex_entries')
    .select('id,user_id,collection_id,root_key,entry_type,title,note,url,image_path,preview_url,provider,tags,favorite,created_at,updated_at')
    .eq('user_id', userId).eq('root_key', rootKey).order('created_at', { ascending: false });
  query = queryScope(query, { collectionId });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;

  const entries = data || [];
  await Promise.all(entries.map(async (entry) => {
    if (!entry.image_path) return;
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(entry.image_path, 60 * 60);
    entry.preview_url = signed?.signedUrl || '';
  }));
  return entries;
}

export async function loadAllDexEntries(userId, signal) {
  let query = supabase.from('dex_entries')
    .select('id,user_id,collection_id,root_key,entry_type,title,note,url,image_path,preview_url,provider,tags,favorite,created_at,updated_at')
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  const entries = data || [];
  await Promise.all(entries.map(async (entry) => {
    if (!entry.image_path) return;
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(entry.image_path, 60 * 60);
    entry.preview_url = signed?.signedUrl || '';
  }));
  return entries;
}

function editorMarkup(type) {
  const image = type === 'image';
  const note = type === 'note';
  const label = image ? 'Bild' : note ? 'Notiz' : 'Link';
  return `<section class="kategorie-sheet dex-entry-editor" role="dialog" aria-modal="true" aria-label="${label} hinzufügen">
    <header><h2>${label} hinzufügen</h2><button type="button" data-sheet-close aria-label="Schließen">×</button></header>
    <form data-dex-entry-form>
      ${image ? `<label class="dex-entry-file" for="dex-entry-image">
          <span class="dex-entry-file-icon">${materialIconMarkup('add_photo_alternate')}</span>
          <strong>Bild auswählen</strong><small>JPG, PNG, WEBP, GIF oder HEIC · maximal 8 MB</small>
          <input id="dex-entry-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" required>
          <img data-image-preview alt="Ausgewähltes Bild" hidden>
        </label>` : note ? '' : `<label class="dex-entry-field" for="dex-entry-url"><span>Link URL</span>
          <div class="dex-entry-urlfeld"><input id="dex-entry-url" type="text" inputmode="url" autocomplete="url" placeholder="Link zum Speichern einfügen …" required>${materialIconMarkup('place_item')}</div>
        </label>`}
      <label class="dex-entry-field" for="dex-entry-title"><span>Titel <small>optional</small></span>
        <input id="dex-entry-title" class="input" maxlength="100" placeholder="z. B. Schnelles Protein-Frühstück">
      </label>
      <label class="dex-entry-field" for="dex-entry-tags"><span>Tags <small>optional · mit Komma trennen</small></span>
        <input id="dex-entry-tags" class="input" maxlength="200" placeholder="z. B. Protein, Low Carb, Schnell">
      </label>
      <label class="dex-entry-field" for="dex-entry-note"><span>${note ? 'Notiz' : image ? 'Beschreibung' : 'Video-/Linkbeschreibung'} <small>${note ? '' : 'optional'}</small></span>
        <textarea id="dex-entry-note" class="input" maxlength="${note ? '4000' : '500'}" rows="${note ? '9' : '3'}" placeholder="${note ? 'Gedanken, Liste oder Checkliste festhalten …' : image ? 'Warum möchtest du das Bild im Dex behalten?' : 'Kurze Beschreibung des Inhalts …'}"${note ? ' required' : ''}></textarea>
      </label>
      <button class="btn btn-primary btn-block dex-entry-save" type="submit">${label} speichern</button>
    </form>
  </section>`;
}

export function openDexEntryEditor({ type, userId, rootKey, collectionId = null, onSaved }) {
  if (!['link', 'image', 'note'].includes(type)) throw new Error('Unbekannter Eintragstyp.');
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop dex-entry-editor-backdrop';
  backdrop.innerHTML = editorMarkup(type);
  const close = () => backdrop.remove();
  backdrop.onclick = (event) => {
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) close();
  };
  backdrop.addEventListener('touchmove', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('.dex-entry-editor')) event.preventDefault();
  }, { passive: false });
  const form = backdrop.querySelector('[data-dex-entry-form]');
  const fileInput = backdrop.querySelector('#dex-entry-image');
  if (fileInput) fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    const preview = backdrop.querySelector('[data-image-preview]');
    if (!file || !preview) return;
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    backdrop.querySelector('.dex-entry-file-icon')?.setAttribute('hidden', '');
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    let uploadedPath = '';
    try {
      const titleInput = form.querySelector('#dex-entry-title');
      let url = null;
      let imagePath = null;
      let linkPreview = {};
      let title = titleInput.value.trim();
      if (type === 'link') {
        url = normalizeDexUrl(form.querySelector('#dex-entry-url').value);
        const { data: previewData } = await supabase.functions.invoke('link-preview', { body: { url } });
        linkPreview = previewData && !previewData.error ? previewData : {};
        title ||= linkPreview.title || '';
      } else if (type === 'image') {
        const file = fileInput.files?.[0];
        if (!file) throw new Error('Bitte ein Bild auswählen.');
        if (!IMAGE_TYPES.has(file.type)) throw new Error('Dieses Bildformat wird nicht unterstützt.');
        if (file.size > MAX_IMAGE_BYTES) throw new Error('Das Bild darf höchstens 8 MB groß sein.');
        const extension = (file.name.split('.').pop() || file.type.split('/').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(uploadedPath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        imagePath = uploadedPath;
        title ||= 'Gespeichertes Bild';
      } else {
        const noteText = form.querySelector('#dex-entry-note').value.trim();
        if (!noteText) throw new Error('Bitte einen Notiztext eintragen.');
        title ||= noteText.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 100) || 'Notiz';
      }
      const { data, error } = await supabase.from('dex_entries').insert({
        user_id: userId, collection_id: collectionId, root_key: rootKey,
        entry_type: type, title, note: form.querySelector('#dex-entry-note')?.value.trim() || linkPreview.description || '',
        url, image_path: imagePath,
        preview_url: linkPreview.previewUrl || null,
        provider: linkPreview.provider || null,
        tags: form.querySelector('#dex-entry-tags').value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
      }).select().single();
      if (error) throw error;
      close();
      toast(type === 'image' ? 'Bild im Dex gespeichert' : type === 'note' ? 'Notiz im Dex gespeichert' : 'Link im Dex gespeichert');
      await onSaved?.(data);
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
      toast(error.message || 'Eintrag konnte nicht gespeichert werden.');
      button.disabled = false;
    }
  };
  document.body.append(backdrop);
  requestAnimationFrame(() => {
    backdrop.classList.add('offen');
    backdrop.querySelector(type === 'link' ? '#dex-entry-url' : '#dex-entry-image')?.focus({ preventScroll: true });
  });
  return backdrop;
}

export function videoEmbedUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.hostname.includes('youtu.be')) return `https://www.youtube-nocookie.com/embed/${url.pathname.split('/').filter(Boolean)[0] || ''}`;
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v') || url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : '';
    }
    if (url.hostname.includes('vimeo.com')) {
      const id = url.pathname.match(/\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : '';
    }
    if (url.hostname.includes('tiktok.com')) {
      const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
      return id ? `https://www.tiktok.com/player/v1/${id}` : '';
    }
    // Instagram-Embeds veraendern auf iOS ihre Breite dynamisch und reagieren
    // im PWA-iframe unzuverlaessig auf Play. Die App zeigt dafuer bewusst die
    // gespeicherte Vorschau und den externen Aufruf.
    if (url.hostname.includes('instagram.com')) return '';
  } catch { return ''; }
  return '';
}

export function videoProvider(value) {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) return { name: 'YouTube', key: 'youtube' };
    if (host.includes('tiktok.com')) return { name: 'TikTok', key: 'tiktok' };
    if (host.includes('instagram.com')) return { name: 'Instagram', key: 'instagram' };
    if (host.includes('vimeo.com')) return { name: 'Vimeo', key: 'vimeo' };
  } catch { return null; }
  return null;
}

function youtubeThumbnail(value) {
  try {
    const url = new URL(value);
    const id = url.hostname.includes('youtu.be')
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.searchParams.get('v') || url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
  } catch { return ''; }
}

function providerPreview(entry, provider, playable) {
  const thumbnail = provider?.key === 'youtube' ? youtubeThumbnail(entry.url) : '';
  if (thumbnail) return `<span class="dex-inhaltskarte-vorschau dex-video-vorschau"><img src="${thumbnail}" alt="" loading="lazy">${playable ? `<i>${materialIconMarkup('play_arrow')}</i>` : ''}</span>`;
  return `<span class="dex-inhaltskarte-vorschau dex-provider-vorschau dex-provider-${provider?.key || 'link'}">${playable ? `<i>${materialIconMarkup('play_arrow')}</i>` : ''}<b>${escapeHtml(provider?.name || sourceFromUrl(entry.url))}</b></span>`;
}

export function dexEntryOverviewMarkup(entry, color = '#A9DCE8') {
  const provider = videoProvider(entry.url);
  const video = entry.entry_type === 'link' && Boolean(provider);
  const type = entry.entry_type === 'note' ? 'note' : entry.entry_type === 'image' ? 'image' : video ? 'video' : 'link';
  const icon = type === 'note' ? 'note_add' : type === 'image' ? 'add_photo_alternate' : type === 'video' ? 'play_arrow' : 'bookmark_star';
  const playable = Boolean(videoEmbedUrl(entry.url));
  return dexEntryCardMarkup({
    id: entry.id, type, title: entry.title, note: entry.note,
    favorite: Boolean(entry.favorite),
    previewUrl: entry.preview_url, href: entry.url,
    previewMarkup: type === 'note'
      ? '<span class="dex-inhaltskarte-vorschau dex-notiz-vorschau"><i></i><i></i><i></i><i></i></span>'
      : type === 'video' ? providerPreview(entry, provider, playable) : '',
    playable, detailHref: `#entry/${entry.id}`,
    source: type === 'link' || type === 'video' ? (entry.provider || sourceFromUrl(entry.url)) : 'BILD', color,
  }, { iconMarkup: materialIconMarkup(icon), favoriteMarkup: materialIconMarkup('favorite'), darkColor: colorIsDark(color) });
}

function groupMarkup(type, entries, color) {
  const label = type === 'favorite' ? 'Favoriten' : type === 'note' ? 'Notizen' : type === 'image' ? 'Bilder' : type === 'video' ? 'Videos' : 'Links';
  return `<section class="dex-eintrag-gruppe dex-eintrag-gruppe-${type}">
    <h2>${label} (${entries.length})</h2>
    <div class="dex-inhaltsgrid">${entries.map((entry) => dexEntryOverviewMarkup(entry, color)).join('')}</div>
  </section>`;
}

export async function renderDexEntries(container, { userId, rootKey, collectionId = null, color, signal, onChanged } = {}) {
  const slot = container.querySelector('[data-dex-entries]');
  if (!slot) return [];
  try {
    const entries = await loadDexEntries(userId, { rootKey, collectionId, signal });
    if (signal?.aborted) return [];
    const favorites = entries.filter((entry) => entry.favorite);
    const regular = entries.filter((entry) => !entry.favorite);
    const notes = regular.filter((entry) => entry.entry_type === 'note');
    const images = regular.filter((entry) => entry.entry_type === 'image');
    const videos = regular.filter((entry) => entry.entry_type === 'link' && videoProvider(entry.url));
    const links = regular.filter((entry) => entry.entry_type === 'link' && !videoProvider(entry.url));
    slot.innerHTML = entries.length
      ? `${groupMarkup('favorite', favorites, color)}${groupMarkup('note', notes, color)}${groupMarkup('image', images, color)}${groupMarkup('video', videos, color)}${groupMarkup('link', links, color)}`
      : `<section class="sammlung-alle"><h2>Alle Einträge (0)</h2><div class="sammlung-leer">
          <div class="dex-leer-symbol" aria-hidden="true"><i></i><b></b></div><strong>Leerer Dex</strong>
          <span>Lege hier eine Notiz, ein Bild oder einen Link ab.</span></div></section>`;
    slot.querySelectorAll('.dex-eintrag-gruppe').forEach((group) => {
      if (!group.querySelector('.dex-inhaltskarte')) group.remove();
    });
    onChanged?.(entries);
    return entries;
  } catch (error) {
    if (signal?.aborted) return [];
    slot.innerHTML = `<div class="msg err">DEX-Einträge konnten nicht geladen werden: ${escapeHtml(error.message || 'Unbekannter Fehler')}</div>`;
    return [];
  }
}
