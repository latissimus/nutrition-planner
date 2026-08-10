import { supabase } from './supabase.js';
import { colorIsDark, materialIconMarkup } from './categoryIcons.js';
import { dexEntryCardMarkup } from './dexEntryCard.js';
import { toast } from './toast.js';
import { editEntry } from './dexEntryDetail.js';
import { bindLongPress } from './longPress.js';

const BUCKET = 'dex-entries';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/webm', 'audio/ogg']);
const ENTRY_COLUMNS = 'id,user_id,collection_id,routine_id,root_key,entry_type,title,note,url,image_path,audio_path,preview_url,provider,tags,favorite,food_kind,carb_class,prep_minutes,ingredients,created_at,updated_at';

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

export async function loadDexEntries(userId, { rootKey, collectionId = null, routineId, signal } = {}) {
  let query = supabase.from('dex_entries')
    .select(ENTRY_COLUMNS)
    .eq('root_key', rootKey).order('created_at', { ascending: false });
  query = queryScope(query, { collectionId });
  if (routineId === null) query = query.is('routine_id', null);
  else if (routineId) query = query.eq('routine_id', routineId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;

  const entries = data || [];
  await Promise.all(entries.map(async (entry) => {
    const path = entry.image_path || entry.audio_path;
    if (!path) return;
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (entry.audio_path) entry.audio_url = signed?.signedUrl || '';
    else entry.preview_url = signed?.signedUrl || '';
  }));
  return entries;
}

export async function loadAllDexEntries(userId, signal) {
  let query = supabase.from('dex_entries')
    .select(ENTRY_COLUMNS).order('created_at', { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  const entries = data || [];
  await Promise.all(entries.map(async (entry) => {
    const path = entry.image_path || entry.audio_path;
    if (!path) return;
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (entry.audio_path) entry.audio_url = signed?.signedUrl || '';
    else entry.preview_url = signed?.signedUrl || '';
  }));
  return entries;
}

function editorMarkup(type, { foodKind = null, foodMode = false, entryLabel = '' } = {}) {
  const image = type === 'image';
  const audio = type === 'audio';
  const routine = type === 'routine';
  const note = type === 'note' || routine;
  const cheatMeal = foodMode && foodKind === 'cheat_meal';
  const ownRecipe = foodMode && note && !cheatMeal;
  const label = entryLabel || (cheatMeal ? 'Cheat-Meal' : foodMode && note ? 'Eigenes Rezept' : foodMode && image ? 'Rezeptbild' : foodMode ? 'Rezeptlink' : routine ? 'Routine' : audio ? 'Tonaufnahme' : image ? 'Bild' : note ? 'Notiz' : 'Link');
  return `<section class="kategorie-sheet dex-entry-editor" role="dialog" aria-modal="true" aria-label="${label} hinzufügen">
    <header><h2>${label} hinzufügen</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <form data-dex-entry-form>
      ${image ? `<label class="dex-entry-file" for="dex-entry-image">
          <span class="dex-entry-file-icon">${materialIconMarkup('add_photo_alternate')}</span>
          <strong>Bild auswählen</strong><small>JPG, PNG, WEBP, GIF oder HEIC · maximal 8 MB</small>
          <input id="dex-entry-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" required>
          <img data-image-preview alt="Ausgewähltes Bild" hidden>
        </label>` : audio ? `<div class="dex-entry-file dex-entry-audio-file">
          <label for="dex-entry-audio">
            <span class="dex-entry-file-icon">${materialIconMarkup('mic')}</span>
            <strong>Vorhandene Tonaufnahme auswählen</strong><small>MP3, M4A, WAV, WEBM oder OGG · maximal 25 MB</small>
            <input id="dex-entry-audio" type="file" accept="audio/*">
          </label>
          <span class="dex-audio-aktionen">
            <button class="btn" type="button" data-audio-record>${materialIconMarkup('mic')} Aufnahme starten</button>
            <button class="btn" type="button" data-audio-stop hidden>Aufnahme beenden</button>
          </span>
          <strong class="dex-audio-status" data-audio-status hidden role="status">Aufnahme läuft …</strong>
          <audio data-audio-preview controls hidden></audio>
        </div>` : note ? '' : `<label class="dex-entry-field" for="dex-entry-url"><span>Link URL</span>
          <div class="dex-entry-urlfeld"><input id="dex-entry-url" type="url" inputmode="url" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" placeholder="Link zum Speichern einfügen …" required>${materialIconMarkup('place_item')}</div>
        </label>`}
      ${ownRecipe ? `<label class="dex-entry-file dex-recipe-file" for="dex-entry-image">
          <span class="dex-entry-file-icon">${materialIconMarkup('add_photo_alternate')}</span>
          <strong>Rezeptbild hinzufügen</strong><small>optional · maximal 8 MB</small>
          <input id="dex-entry-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif">
          <img data-image-preview alt="Ausgewähltes Rezeptbild" hidden>
        </label>` : ''}
      <label class="dex-entry-field" for="dex-entry-title"><span>Titel <small>optional</small></span>
        <input id="dex-entry-title" class="input" maxlength="100" placeholder="z. B. Schnelles Protein-Frühstück">
      </label>
      ${foodMode ? `<div class="food-entry-meta">
        <label class="dex-entry-field" for="dex-entry-carb"><span>Carb-Klasse</span>
          <select id="dex-entry-carb" class="input">
            <option value="unset">Nicht festgelegt</option><option value="low">Low Carb</option>
            <option value="balanced">Ausgewogen</option><option value="high">High Carb</option>
          </select>
        </label>
        <label class="dex-entry-field" for="dex-entry-prep"><span>Zubereitung <small>Minuten</small></span>
          <input id="dex-entry-prep" class="input" type="number" inputmode="numeric" min="1" max="1440" placeholder="z. B. 10">
        </label>
      </div>` : ''}
      ${foodMode && foodKind !== 'cheat_meal' ? `<label class="dex-entry-field" for="dex-entry-ingredients"><span>Zutaten <small>eine Zutat pro Zeile</small></span>
        <textarea id="dex-entry-ingredients" class="input" maxlength="4000" rows="6" placeholder="z. B.&#10;250 g Skyr&#10;30 g Haferflocken&#10;1 Banane"></textarea>
      </label>` : ''}
      <label class="dex-entry-field" for="dex-entry-tags"><span>Tags <small>optional · mit Komma trennen</small></span>
        <input id="dex-entry-tags" class="input" maxlength="200" placeholder="z. B. Protein, Low Carb, Schnell">
      </label>
      ${audio ? '' : `<label class="dex-entry-field" for="dex-entry-note"><span>${note ? 'Notiz' : image ? 'Beschreibung' : 'Video-/Linkbeschreibung'} <small>${note ? '' : 'optional'}</small></span>
        <textarea id="dex-entry-note" class="input" maxlength="${note ? '4000' : '500'}" rows="${note ? '9' : '3'}" placeholder="${note ? 'Gedanken, Liste oder Checkliste festhalten …' : image ? 'Warum möchtest du das Bild im Dex behalten?' : 'Kurze Beschreibung des Inhalts …'}"${note ? ' required' : ''}></textarea>
      </label>`}
      <button class="btn btn-primary btn-block dex-entry-save" type="submit">${label} speichern</button>
    </form>
  </section>`;
}

export function openDexEntryEditor({ type, userId, rootKey, collectionId = null, routineId = null, foodKind = null, entryLabel = '', onSaved }) {
  if (!['link', 'image', 'note', 'audio', 'routine'].includes(type)) throw new Error('Unbekannter Eintragstyp.');
  const foodMode = rootKey === 'food-log';
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop dex-entry-editor-backdrop';
  backdrop.innerHTML = editorMarkup(type, { foodKind, foodMode, entryLabel });
  let audioRecorder = null;
  let audioStream = null;
  let recordedAudioFile = null;
  const close = () => {
    audioStream?.getTracks().forEach((track) => track.stop());
    backdrop.remove();
  };
  backdrop.onclick = (event) => {
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) close();
  };
  backdrop.addEventListener('touchmove', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('.dex-entry-editor')) event.preventDefault();
  }, { passive: false });
  const form = backdrop.querySelector('[data-dex-entry-form]');
  const fileInput = backdrop.querySelector('#dex-entry-image, #dex-entry-audio');
  if (fileInput) fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    const audioPreview = backdrop.querySelector('[data-audio-preview]');
    if (audioPreview && file) {
      audioPreview.src = URL.createObjectURL(file);
      audioPreview.hidden = false;
      backdrop.querySelector('.dex-entry-file-icon')?.setAttribute('hidden', '');
      return;
    }
    const preview = backdrop.querySelector('[data-image-preview]');
    if (!file || !preview) return;
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    backdrop.querySelector('.dex-entry-file-icon')?.setAttribute('hidden', '');
  };
  const recordButton = backdrop.querySelector('[data-audio-record]');
  const stopButton = backdrop.querySelector('[data-audio-stop]');
  if (recordButton && stopButton) {
    recordButton.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!window.isSecureContext) {
        toast('Tonaufnahmen benötigen eine sichere HTTPS-Verbindung.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        toast('Direkte Tonaufnahmen werden auf diesem Gerät nicht unterstützt.');
        return;
      }
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        audioRecorder = new MediaRecorder(audioStream);
        audioRecorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        audioRecorder.onstop = () => {
          const mime = (audioRecorder.mimeType || chunks[0]?.type || 'audio/webm').split(';')[0];
          const blob = new Blob(chunks, { type: mime });
          const extension = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
          recordedAudioFile = new File([blob], `aufnahme-${Date.now()}.${extension}`, { type: mime });
          const preview = backdrop.querySelector('[data-audio-preview]');
          preview.src = URL.createObjectURL(recordedAudioFile);
          preview.hidden = false;
          backdrop.querySelector('.dex-entry-file-icon')?.setAttribute('hidden', '');
          audioStream?.getTracks().forEach((track) => track.stop());
          audioStream = null;
        };
        audioRecorder.start();
        recordButton.hidden = true;
        stopButton.hidden = false;
        backdrop.querySelector('[data-audio-status]').hidden = false;
      } catch { toast('Mikrofon konnte nicht geöffnet werden.'); }
    };
    stopButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (audioRecorder?.state === 'recording') audioRecorder.stop();
      stopButton.hidden = true;
      recordButton.hidden = false;
      backdrop.querySelector('[data-audio-status]').hidden = true;
    };
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    let uploadedPath = '';
    try {
      const titleInput = form.querySelector('#dex-entry-title');
      let url = null;
      let imagePath = null;
      let audioPath = null;
      let linkPreview = {};
      let title = titleInput.value.trim();
      if (type === 'link') {
        url = normalizeDexUrl(form.querySelector('#dex-entry-url').value);
        const { data: previewData } = await supabase.functions.invoke('link-preview', { body: { url } });
        linkPreview = previewData && !previewData.error ? previewData : {};
        if (linkPreview.resolvedUrl) url = normalizeDexUrl(linkPreview.resolvedUrl);
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
      } else if (type === 'audio') {
        const file = recordedAudioFile || fileInput.files?.[0];
        if (!file) throw new Error('Bitte eine Audioaufnahme auswählen.');
        if (!AUDIO_TYPES.has(file.type)) throw new Error('Dieses Audioformat wird nicht unterstützt.');
        if (file.size > MAX_AUDIO_BYTES) throw new Error('Die Audioaufnahme darf höchstens 25 MB groß sein.');
        const extension = (file.name.split('.').pop() || file.type.split('/').pop() || 'm4a').toLowerCase().replace(/[^a-z0-9]/g, '');
        uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(uploadedPath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        audioPath = uploadedPath;
        title ||= 'Tonaufnahme';
      } else {
        const noteText = form.querySelector('#dex-entry-note').value.trim();
        if (!noteText) throw new Error('Bitte einen Notiztext eintragen.');
        title ||= noteText.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 100) || 'Notiz';
        const file = fileInput?.files?.[0];
        if (file) {
          if (!IMAGE_TYPES.has(file.type)) throw new Error('Dieses Bildformat wird nicht unterstützt.');
          if (file.size > MAX_IMAGE_BYTES) throw new Error('Das Bild darf höchstens 8 MB groß sein.');
          const extension = (file.name.split('.').pop() || file.type.split('/').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
          uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage.from(BUCKET).upload(uploadedPath, file, { contentType: file.type, upsert: false });
          if (uploadError) throw uploadError;
          imagePath = uploadedPath;
        }
      }
      const { data, error } = await supabase.from('dex_entries').insert({
        user_id: userId, collection_id: collectionId, routine_id: routineId, root_key: rootKey,
        entry_type: type, title, note: form.querySelector('#dex-entry-note')?.value.trim() || linkPreview.description || '',
        url, image_path: imagePath, audio_path: audioPath,
        preview_url: linkPreview.previewUrl || null,
        provider: linkPreview.provider || null,
        tags: form.querySelector('#dex-entry-tags').value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
        food_kind: foodMode ? (foodKind || 'recipe') : null,
        carb_class: foodMode ? form.querySelector('#dex-entry-carb').value : null,
        prep_minutes: foodMode && form.querySelector('#dex-entry-prep').value
          ? Number(form.querySelector('#dex-entry-prep').value) : null,
        ingredients: foodMode
          ? String(form.querySelector('#dex-entry-ingredients')?.value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 100)
          : [],
      }).select().single();
      if (error) throw error;
      close();
      toast(type === 'image' ? 'Bild im Dex gespeichert' : type === 'audio' ? 'Tonaufnahme im Dex gespeichert' : type === 'routine' ? 'Routine im Dex gespeichert' : type === 'note' ? `${entryLabel || 'Notiz'} im Dex gespeichert` : 'Link im Dex gespeichert');
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
    // Audio-Dateifelder nicht automatisch fokussieren: iOS kann einen Fokus
    // auf <input type=file> faelschlich als Kamera-Capture interpretieren.
    if (type !== 'audio') backdrop.querySelector(type === 'link' ? '#dex-entry-url' : '#dex-entry-image')?.focus({ preventScroll: true });
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
    if (url.hostname.includes('instagram.com')) {
      const match = url.pathname.match(/\/(reel|reels|tv)\/([^/?#]+)/i);
      if (!match) return '';
      const type = match[1].toLowerCase() === 'reels' ? 'reel' : match[1].toLowerCase();
      return `https://www.instagram.com/${type}/${match[2]}/embed/`;
    }
  } catch { return ''; }
  return '';
}

export function videoProvider(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) return { name: 'YouTube', key: 'youtube' };
    if (host.includes('tiktok.com')) {
      if (/\/photo\//i.test(parsed.pathname)) return null;
      return { name: 'TikTok', key: 'tiktok' };
    }
    if (host.includes('instagram.com')) {
      // Instagram verwendet /p/ sowohl für Bilder als auch für Karussells und
      // teilweise für Videos. Ohne Graph-API lässt sich der Medientyp dort nicht
      // zuverlässig erkennen. Nur eindeutige Video-Pfade werden daher als Video
      // einsortiert; /p/-Beiträge bleiben bei den normalen Links.
      if (/\/(?:reel|reels|tv)\//i.test(parsed.pathname)) return { name: 'Instagram', key: 'instagram' };
      return null;
    }
    if (host.includes('vimeo.com')) return { name: 'Vimeo', key: 'vimeo' };
  } catch { return null; }
  return null;
}

export function isTikTokPhotoPost(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.hostname.toLowerCase().includes('tiktok.com') && /\/photo\//i.test(parsed.pathname);
  } catch { return false; }
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
  if (thumbnail) return `<span class="dex-inhaltskarte-vorschau hat-vorschaubild dex-video-vorschau"><img src="${thumbnail}" alt="" loading="lazy">${playable ? `<i>${materialIconMarkup('play_arrow')}</i>` : ''}</span>`;
  return `<span class="dex-inhaltskarte-vorschau dex-provider-vorschau dex-provider-${provider?.key || 'link'}">${playable ? `<i>${materialIconMarkup('play_arrow')}</i>` : ''}<b>${escapeHtml(provider?.name || sourceFromUrl(entry.url))}</b></span>`;
}

export function dexEntryOverviewMarkup(entry, color = '#A9DCE8') {
  const provider = videoProvider(entry.url);
  const isTikTokPhoto = isTikTokPhotoPost(entry.url);
  const video = entry.entry_type === 'link' && Boolean(provider);
  const type = entry.entry_type === 'routine' ? 'routine' : entry.entry_type === 'audio' ? 'audio' : entry.entry_type === 'note' ? 'note' : entry.entry_type === 'image' || isTikTokPhoto ? 'image' : video ? 'video' : 'link';
  const icon = type === 'routine' ? 'bucket_check' : type === 'audio' ? 'mic' : type === 'note' ? 'note_add' : type === 'image' ? 'add_photo_alternate' : type === 'video' ? 'play_arrow' : 'bookmark_star';
  const playable = Boolean(videoEmbedUrl(entry.url));
  const previewClass = isTikTokPhoto
    ? 'dex-foto-post-vorschau'
    : type === 'link' && entry.preview_url
      ? 'dex-artikel-vorschau'
      : '';
  return dexEntryCardMarkup({
    id: entry.id, type, title: entry.title, note: entry.note,
    favorite: Boolean(entry.favorite),
    previewUrl: entry.preview_url, previewClass,
    cardClass: [
      entry.root_key === 'food-log' && entry.entry_type === 'note' && entry.food_kind === 'recipe' ? 'eigenes-rezept' : '',
      isTikTokPhoto ? 'tiktok-foto-post' : '',
    ].filter(Boolean).join(' '), href: entry.url,
    previewMarkup: type === 'routine'
      ? `<span class="dex-inhaltskarte-vorschau dex-audio-vorschau">${materialIconMarkup('bucket_check')}<small>Routine</small></span>`
      : type === 'audio'
      ? `<span class="dex-inhaltskarte-vorschau dex-audio-vorschau">${materialIconMarkup('mic')}<small>Tonaufnahme</small></span>`
      : type === 'note'
      ? entry.preview_url ? `<span class="dex-inhaltskarte-vorschau hat-vorschaubild"><img src="${escapeHtml(entry.preview_url)}" alt="" loading="lazy"></span>`
        : '<span class="dex-inhaltskarte-vorschau dex-notiz-vorschau"><i></i><i></i><i></i><i></i></span>'
      : type === 'video' ? providerPreview(entry, provider, playable) : '',
    playable, detailHref: `#entry/${entry.id}`,
    source: type === 'link' || type === 'video' ? (entry.provider || sourceFromUrl(entry.url)) : 'BILD', color,
  }, { iconMarkup: materialIconMarkup(icon), favoriteMarkup: materialIconMarkup('favorite'), darkColor: colorIsDark(color) });
}

function groupMarkup(type, entries, color) {
  const label = type === 'favorite' ? 'Favoriten' : type === 'routine' ? 'Routinen' : type === 'own-recipe' ? 'Eigene Rezepte' : type === 'cheat-meal' ? 'Cheat-Meals' : type === 'note' ? 'Notizen' : type === 'image' ? 'Bilder' : type === 'audio' ? 'Tonaufnahmen' : type === 'video' ? 'Videos' : 'Links';
  return `<section class="dex-eintrag-gruppe dex-eintrag-gruppe-${type}">
    <h2>${label} (${entries.length})</h2>
    <div class="dex-inhaltsgrid">${entries.map((entry) => dexEntryOverviewMarkup(entry, color)).join('')}</div>
  </section>`;
}

export function vorschaubilderEinblenden(container) {
  container.querySelectorAll('.dex-inhaltskarte-vorschau img').forEach((bild) => {
    bild.closest('.dex-inhaltskarte-vorschau')?.classList.add('hat-vorschaubild');
    const anzeigen = () => requestAnimationFrame(() => {
      bild.classList.add('ist-geladen');
      bild.closest('.dex-inhaltskarte-vorschau')?.classList.add('vorschau-geladen');
    });
    if (bild.complete && bild.naturalWidth > 0) anzeigen();
    else bild.addEventListener('load', anzeigen, { once: true });
  });
}

const foodFilterDefinitions = [
  ['all', 'Alle'], ['cheat', 'Cheat-Meals'], ['low', 'Low Carb'],
  ['high', 'High Carb'], ['balanced', 'Ausgewogen'], ['favorite', 'Favoriten'],
];

function foodFiltersMarkup(active = 'all') {
  return `<nav class="food-dex-filter" aria-label="Food-Log filtern">${foodFilterDefinitions.map(([key, label]) =>
    `<button type="button" data-food-filter="${key}" class="${key === active ? 'aktiv' : ''}" aria-pressed="${key === active}">${label}</button>`).join('')}</nav>`;
}

function filterFoodEntries(entries, filter) {
  if (filter === 'cheat') return entries.filter((entry) => entry.food_kind === 'cheat_meal');
  if (filter === 'favorite') return entries.filter((entry) => entry.favorite);
  if (['low', 'high', 'balanced'].includes(filter)) return entries.filter((entry) => entry.carb_class === filter);
  return entries;
}

function entriesMarkup(entries, color, emptyText = 'Lege hier ein Cheat-Meal, ein Rezept, ein Bild oder einen Link ab.', hasChildren = false, hideEmpty = false) {
  const favorites = entries.filter((entry) => entry.favorite);
  const regular = entries.filter((entry) => !entry.favorite);
  const ownRecipes = regular.filter((entry) => entry.entry_type === 'note' && entry.root_key === 'food-log' && entry.food_kind === 'recipe');
  const cheatMeals = regular.filter((entry) => entry.entry_type === 'note' && entry.root_key === 'food-log' && entry.food_kind === 'cheat_meal');
  const notes = regular.filter((entry) => entry.entry_type === 'note' && !ownRecipes.includes(entry) && !cheatMeals.includes(entry));
  const routines = regular.filter((entry) => entry.entry_type === 'routine');
  const images = regular.filter((entry) => entry.entry_type === 'image' || (entry.entry_type === 'link' && isTikTokPhotoPost(entry.url)));
  const audio = regular.filter((entry) => entry.entry_type === 'audio');
  const videos = regular.filter((entry) => entry.entry_type === 'link' && videoProvider(entry.url));
  const links = regular.filter((entry) => entry.entry_type === 'link' && !videoProvider(entry.url) && !isTikTokPhotoPost(entry.url));
  if (entries.length) {
    return `${groupMarkup('favorite', favorites, color)}${groupMarkup('routine', routines, color)}${groupMarkup('cheat-meal', cheatMeals, color)}${groupMarkup('own-recipe', ownRecipes, color)}${groupMarkup('note', notes, color)}${groupMarkup('image', images, color)}${groupMarkup('audio', audio, color)}${groupMarkup('video', videos, color)}${groupMarkup('link', links, color)}`;
  }
  // Ein Dex mit Unter-Dex, aber (noch) ohne eigene Eintraege, ist nicht
  // "leer" – die Animation wuerde sonst faelschlich unter einem gut
  // gefuellten Unter-Dex-Raster stehen.
  if (hasChildren) return '';
  if (hideEmpty) return '';
  return `<section class="sammlung-alle"><h2>Alle Einträge (0)</h2><div class="sammlung-leer">
      <div class="dex-leer-symbol" aria-hidden="true"><i></i><b></b></div><strong>Leerer Dex</strong>
      <span>${emptyText}</span></div></section>`;
}

export async function renderDexEntries(container, {
  userId, rootKey, collectionId = null, routineId, color, signal, onChanged, foodFilters = rootKey === 'food-log', hasChildren = false, hideEmpty = false,
} = {}) {
  const slot = container.querySelector('[data-dex-entries]');
  if (!slot) return [];
  try {
    const entries = await loadDexEntries(userId, { rootKey, collectionId, routineId, signal });
    if (signal?.aborted) return [];
    let activeFilter = 'all';
    const paint = () => {
      const visibleEntries = foodFilters ? filterFoodEntries(entries, activeFilter) : entries;
      slot.innerHTML = `${foodFilters ? foodFiltersMarkup(activeFilter) : ''}<div class="dex-eintrag-listen">${entriesMarkup(visibleEntries, color, foodFilters ? 'Für diesen Filter gibt es noch keine Mahlzeit.' : undefined, hasChildren, hideEmpty)}</div>`;
      vorschaubilderEinblenden(slot);
      slot.querySelectorAll('.dex-eintrag-gruppe').forEach((group) => {
        if (!group.querySelector('.dex-inhaltskarte')) group.remove();
      });
      slot.querySelectorAll('[data-food-filter]').forEach((button) => {
        button.onclick = () => { activeFilter = button.dataset.foodFilter; paint(); };
      });
    };
    paint();
    // Long-Press auf eine Eintragskarte oeffnet direkt "Eintrag bearbeiten"
    // (Notiz, Video, Bild, Rezept – alle teilen dieselbe Karte). slot bleibt
    // beim Neuzeichnen erhalten, die Delegation ueberlebt jedes paint().
    const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
    const refreshAlles = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
    bindLongPress(slot, '.dex-inhaltskarte', (el) => {
      const entry = entriesById.get(el.dataset.dexEntryId);
      if (!entry) return null;
      return () => editEntry(entry, refreshAlles, { onDeleted: refreshAlles });
    });
    onChanged?.(entries);
    return entries;
  } catch (error) {
    if (signal?.aborted) return [];
    slot.innerHTML = `<div class="msg err">DEX-Einträge konnten nicht geladen werden: ${escapeHtml(error.message || 'Unbekannter Fehler')}</div>`;
    return [];
  }
}
