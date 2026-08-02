import { supabase } from './supabase.js';
import { categoryColor, materialIconMarkup } from './categoryIcons.js';
import { videoEmbedUrl } from './dexEntries.js';
import { toast } from './toast.js';

const BUCKET = 'dex-entries';
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

async function loadEntry(userId, id, signal) {
  let query = supabase.from('dex_entries')
    .select('id,user_id,collection_id,root_key,entry_type,title,note,url,image_path,tags,created_at,updated_at')
    .eq('id', id).eq('user_id', userId).maybeSingle();
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  if (!data) return null;
  data.color = categoryColor(data.root_key);
  if (data.collection_id) {
    const { data: collection } = await supabase.from('collections').select('color').eq('id', data.collection_id).maybeSingle();
    if (collection?.color) data.color = collection.color;
  }
  if (data.image_path) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(data.image_path, 60 * 60);
    data.preview_url = signed?.signedUrl || '';
  }
  return data;
}

function backHref(entry) {
  return entry.collection_id ? `#collection/${entry.collection_id}` : `#${entry.root_key}`;
}

function editEntry(entry, onSaved) {
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop';
  backdrop.innerHTML = `<section class="kategorie-sheet dex-entry-editor" role="dialog" aria-modal="true" aria-label="Eintrag bearbeiten">
    <header><h2>Eintrag bearbeiten</h2><button type="button" data-sheet-close aria-label="Schließen">×</button></header>
    <form data-entry-edit>
      ${entry.url ? `<label class="dex-entry-field" for="edit-entry-url"><span>Link URL</span><input id="edit-entry-url" class="input" type="url" value="${escapeHtml(entry.url)}" required></label>` : ''}
      <label class="dex-entry-field" for="edit-entry-title"><span>Titel</span><input id="edit-entry-title" class="input" maxlength="100" value="${escapeHtml(entry.title)}" required></label>
      <label class="dex-entry-field" for="edit-entry-tags"><span>Tags <small>mit Komma trennen</small></span><input id="edit-entry-tags" class="input" maxlength="200" value="${escapeHtml((entry.tags || []).join(', '))}"></label>
      <label class="dex-entry-field" for="edit-entry-note"><span>Notizen <small>optional</small></span><textarea id="edit-entry-note" class="input" maxlength="500" rows="5">${escapeHtml(entry.note || '')}</textarea></label>
      <button class="btn btn-primary btn-block dex-entry-save" type="submit">Änderungen speichern</button>
      <button class="btn btn-block dex-entry-delete" type="button" data-entry-delete>Eintrag löschen</button>
    </form>
  </section>`;
  const close = () => backdrop.remove();
  backdrop.onclick = (event) => { if (event.target === backdrop || event.target.closest('[data-sheet-close]')) close(); };
  backdrop.querySelector('[data-entry-edit]').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    const payload = {
      title: backdrop.querySelector('#edit-entry-title').value.trim(),
      note: backdrop.querySelector('#edit-entry-note').value.trim(),
      tags: backdrop.querySelector('#edit-entry-tags').value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
    };
    if (entry.url) payload.url = backdrop.querySelector('#edit-entry-url').value.trim();
    const { error } = await supabase.from('dex_entries').update(payload).eq('id', entry.id).eq('user_id', entry.user_id);
    if (error) { toast(error.message || 'Änderung fehlgeschlagen'); button.disabled = false; return; }
    close(); toast('Eintrag aktualisiert'); await onSaved?.();
  };
  backdrop.querySelector('[data-entry-delete]').onclick = async () => {
    if (!confirm(`„${entry.title}“ wirklich löschen?`)) return;
    const { error } = await supabase.from('dex_entries').delete().eq('id', entry.id).eq('user_id', entry.user_id);
    if (error) { toast(error.message || 'Löschen fehlgeschlagen'); return; }
    if (entry.image_path) await supabase.storage.from(BUCKET).remove([entry.image_path]);
    close(); toast('Dex-Eintrag gelöscht'); location.hash = backHref(entry).slice(1);
  };
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('offen'));
}

function fullscreenImage(url, title) {
  const overlay = document.createElement('div');
  overlay.className = 'dex-bild-vollbild';
  overlay.innerHTML = `<button type="button" aria-label="Vollbild schließen">×</button><img src="${escapeHtml(url)}" alt="${escapeHtml(title)}">`;
  overlay.onclick = (event) => { if (event.target === overlay || event.target.closest('button')) overlay.remove(); };
  document.body.append(overlay);
}

async function shareEntry(entry) {
  const shareData = { title: entry.title, text: entry.note || entry.title, url: entry.url || location.href };
  try {
    if (navigator.share) await navigator.share(shareData);
    else { await navigator.clipboard.writeText(shareData.url); toast('Link kopiert'); }
  } catch (error) {
    if (error?.name !== 'AbortError') toast('Teilen ist gerade nicht möglich.');
  }
}

function detailMarkup(entry) {
  const embed = videoEmbedUrl(entry.url);
  const media = entry.preview_url
    ? `<button class="dex-detail-bild" type="button" data-fullscreen><img src="${escapeHtml(entry.preview_url)}" alt="${escapeHtml(entry.title)}"></button>`
    : embed ? `<div class="dex-detail-video"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(entry.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : '';
  const tags = (entry.tags || []).map((tag) => `<span>#${escapeHtml(tag.replace(/^#/, ''))}</span>`).join('');
  return `<div class="wrap pad-bottom dex-detail-seite">
    <nav class="dex-detail-steuerung" aria-label="Eintrag bedienen">
      <a class="dex-detail-knopf" href="${backHref(entry)}" aria-label="Eintrag schließen">${materialIconMarkup('close')}</a>
      <span></span>
      <button class="dex-detail-knopf" type="button" data-entry-edit aria-label="Eintrag bearbeiten">${materialIconMarkup('build')}</button>
      <button class="dex-detail-knopf" type="button" data-entry-share aria-label="Eintrag teilen">${materialIconMarkup('upload_file')}</button>
    </nav>
    <article class="dex-detail-karte" style="--eintrag-farbe:${escapeHtml(entry.color)}">
      <span class="dex-detail-streifen" aria-hidden="true"></span>
      ${media}
      <div class="dex-detail-inhalt">
        <small>${entry.entry_type === 'image' ? 'BILD' : embed ? 'VIDEO' : 'LINK'}</small>
        <h1>${escapeHtml(entry.title)}</h1>
        ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
        ${entry.url ? `<a class="btn btn-primary dex-detail-link" href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">${materialIconMarkup('arrow_forward_ios')}<span>Link aufrufen</span></a>` : ''}
        <section class="dex-detail-tags"><h2>Tags</h2><div>${tags || '<small>Noch keine Tags vergeben.</small>'}</div></section>
        <footer>Gespeichert am ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.created_at))}</footer>
      </div>
    </article>
  </div>`;
}

export async function mountDexEntryDetail(container, { userId, id, signal }) {
  const entry = await loadEntry(userId, id, signal);
  if (signal?.aborted) return;
  if (!entry) { location.hash = 'home'; return; }
  container.innerHTML = detailMarkup(entry);
  container.querySelector('[data-entry-edit]').onclick = () => editEntry(entry, () => mountDexEntryDetail(container, { userId, id, signal }));
  container.querySelector('[data-entry-share]').onclick = () => shareEntry(entry);
  container.querySelector('[data-fullscreen]')?.addEventListener('click', () => fullscreenImage(entry.preview_url, entry.title));
}
