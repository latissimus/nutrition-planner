import { supabase } from './supabase.js';
import { categoryColor, colorIsDark, materialIconMarkup } from './categoryIcons.js';
import { sourceFromUrl, videoEmbedUrl, videoProvider, mountIngredientEditor, ingredientLine } from './dexEntries.js';
import { noteEditorMarkup, mountNoteEditors, readNote, renderNoteHtml, noteToText } from './richText.js';
import { toast } from './toast.js';
import { optimizeImageFile, uploadExtension } from './imageProcessing.js';
import { dexStoragePath } from './storagePaths.js';
import { playInterfaceSound } from './uiSounds.js';
import { notifyHomeCountsChanged } from './realtime.js';

const BUCKET = 'dex-entries';
const ENTRY_COLUMNS = 'id,user_id,collection_id,root_key,entry_type,title,note,url,image_path,audio_path,preview_url,provider,tags,favorite,food_kind,carb_class,training_class,prep_minutes,ingredients,ingredient_items,created_at,updated_at';
const TRAINING_CLASSES = [
  ['unset', 'Nicht festgelegt'], ['exercise', 'Übungen'], ['recovery', 'Regeneration'],
  ['tips', 'Tipps'], ['injury', 'Verletzung'],
];
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// Rezept-Zutaten in der Detailansicht: strukturierte Einträge (Name · Gramm ·
// kcal) mit Summe; für ältere Rezepte Rückfall auf die reine Textliste.
function ingredientsSection(entry) {
  if (entry.root_key !== 'food-log' || entry.food_kind !== 'recipe') return '';
  const items = Array.isArray(entry.ingredient_items) ? entry.ingredient_items : [];
  if (items.length) {
    const total = items.reduce((acc, it) => {
      const factor = (Number(it.grams) || 0) / 100;
      acc.grams += Number(it.grams) || 0;
      acc.kcal += (Number(it.kcal_100g) || 0) * factor;
      acc.protein += (Number(it.protein_100g) || 0) * factor;
      acc.carbs += (Number(it.carbs_100g) || 0) * factor;
      acc.fat += (Number(it.fat_100g) || 0) * factor;
      return acc;
    }, { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 });
    const rows = items.map((it) => {
      const menge = (Number(it.unitGrams) || 0) > 0 && it.unitLabel
        ? `${it.count} × ${escapeHtml(it.unitLabel)} <small>(${Math.round(Number(it.grams) || 0)} g)</small>`
        : `${Math.round(Number(it.grams) || 0)} g`;
      return `<li><span class="dex-zutat-name">${escapeHtml(it.name)}</span><span class="dex-zutat-gramm">${menge}</span><strong>${Math.round((Number(it.kcal_100g) || 0) * (Number(it.grams) || 0) / 100)} kcal</strong></li>`;
    }).join('');
    return `<section class="dex-detail-zutaten"><h2>Zutaten</h2><ul class="dex-zutaten-detail">${rows}</ul>
      <p class="dex-zutaten-summe">Gesamt: ${Math.round(total.grams)} g · ${Math.round(total.kcal)} kcal · ${Math.round(total.protein)} P · ${Math.round(total.carbs)} K · ${Math.round(total.fat)} F</p></section>`;
  }
  if (entry.ingredients?.length) {
    return `<section class="dex-detail-zutaten"><h2>Zutaten</h2><ul>${entry.ingredients.map((ingredient) => `<li>${escapeHtml(ingredient)}</li>`).join('')}</ul></section>`;
  }
  return '';
}

async function loadEntry(userId, id, signal) {
  let query = supabase.from('dex_entries')
    .select(ENTRY_COLUMNS)
    .eq('id', id).maybeSingle();
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  if (!data) return null;
  data.color = categoryColor(data.root_key);
  const rootNames = { home: 'Meine Dex-Einträge', 'food-log': 'Food-Dex', training: 'Training-Dex', reminders: 'Meal-Log', body: 'Körperwerte', habits: 'Routinen', sleep: 'Sleep-Log' };
  data.dex_name = rootNames[data.root_key] || 'MUSCLE-DEX';
  if (data.collection_id) {
    const { data: collection } = await supabase.from('collections').select('name,color').eq('id', data.collection_id).maybeSingle();
    if (collection?.color) data.color = collection.color;
    if (collection?.name) data.dex_name = collection.name;
  }
  if (data.image_path || data.audio_path) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(data.image_path || data.audio_path, 60 * 60);
    if (data.audio_path) data.audio_url = signed?.signedUrl || '';
    else data.preview_url = signed?.signedUrl || '';
  }
  return data;
}

function backHref(entry) {
  return entry.collection_id ? `#collection/${entry.collection_id}` : `#${entry.root_key}`;
}

export function editEntry(entry, onSaved, { onDeleted } = {}) {
  const ownRecipe = entry.root_key === 'food-log' && entry.entry_type === 'note' && entry.food_kind === 'recipe';
  const fixedTrainingClass = TRAINING_CLASSES.some(([key]) => key === entry.training_class);
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop';
  backdrop.innerHTML = `<section class="kategorie-sheet dex-entry-editor" role="dialog" aria-modal="true" aria-label="Eintrag bearbeiten">
    <header><h2>Eintrag bearbeiten</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <form data-entry-edit>
      ${entry.url ? `<label class="dex-entry-field" for="edit-entry-url"><span>Link URL</span><input id="edit-entry-url" class="input" type="url" inputmode="url" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" value="${escapeHtml(entry.url)}" required></label>` : ''}
      ${ownRecipe ? `<label class="dex-entry-file dex-recipe-file" for="edit-entry-image">
        ${entry.preview_url ? `<img data-edit-image-preview src="${escapeHtml(entry.preview_url)}" alt="Aktuelles Rezeptbild">` : `<span class="dex-entry-file-icon">${materialIconMarkup('add_photo_alternate')}</span>`}
        <strong>${entry.image_path ? 'Rezeptbild wechseln' : 'Rezeptbild hinzufügen'}</strong><small>optional · maximal 8 MB</small>
        <input id="edit-entry-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif">
      </label>` : ''}
      <label class="dex-entry-field" for="edit-entry-title"><span>Titel <small>${ownRecipe ? '' : 'optional'}</small></span><input id="edit-entry-title" class="input" maxlength="100" value="${escapeHtml(entry.title)}"${ownRecipe ? ' required' : ''}></label>
      ${entry.root_key === 'food-log' ? `<div class="food-entry-meta">
        <label class="dex-entry-field" for="edit-entry-carb"><span>Carb-Klasse</span><select id="edit-entry-carb" class="input">
          <option value="unset"${!entry.carb_class || entry.carb_class === 'unset' ? ' selected' : ''}>Nicht festgelegt</option>
          <option value="low"${entry.carb_class === 'low' ? ' selected' : ''}>Low Carb</option>
          <option value="balanced"${entry.carb_class === 'balanced' ? ' selected' : ''}>Ausgewogen</option>
          <option value="high"${entry.carb_class === 'high' ? ' selected' : ''}>High Carb</option>
          <option value="cheat"${entry.carb_class === 'cheat' ? ' selected' : ''}>Cheat</option>
        </select></label>
        <label class="dex-entry-field" for="edit-entry-prep"><span>Zubereitung <small>Minuten</small></span><input id="edit-entry-prep" class="input" type="number" min="1" max="1440" value="${entry.prep_minutes || ''}" placeholder="z. B. 10"></label>
      </div>` : ''}
      ${entry.root_key === 'food-log' && entry.food_kind === 'recipe' ? `<div class="dex-entry-field dex-zutaten"><span>Zutaten <small>aus der Lebensmittel-Datenbank</small></span>
        <div class="dex-zutaten-liste" data-zutaten-liste></div>
        <button type="button" class="btn dex-zutat-add" data-zutat-add>${materialIconMarkup('add')}<span>Zutat hinzufügen</span></button>
      </div>` : ''}
      ${entry.root_key === 'training' ? `<label class="dex-entry-field" for="edit-entry-training-class"><span>Training-Klasse</span><select id="edit-entry-training-class" class="input">
        ${TRAINING_CLASSES.map(([key, label]) => `<option value="${key}"${(entry.training_class || 'unset') === key ? ' selected' : ''}>${label}</option>`).join('')}
        <option value="custom"${entry.training_class && !fixedTrainingClass ? ' selected' : ''}>Eigene Klasse …</option>
      </select></label>
      <label class="dex-entry-field" for="edit-entry-training-class-custom" data-edit-training-class-custom${fixedTrainingClass || !entry.training_class ? ' hidden' : ''}><span>Eigene Klasse</span>
        <input id="edit-entry-training-class-custom" class="input" maxlength="32" value="${fixedTrainingClass ? '' : escapeHtml(entry.training_class || '')}" placeholder="z. B. Technik">
      </label>` : ''}
      <label class="dex-entry-field" for="edit-entry-tags"><span>Tags <small>mit Komma trennen</small></span><input id="edit-entry-tags" class="input" maxlength="200" value="${escapeHtml((entry.tags || []).join(', '))}"></label>
      <div class="dex-entry-field"><span>${entry.entry_type === 'routine' ? 'Routine' : entry.entry_type === 'note' ? 'Notiz' : 'Notizen'} <small>${['note', 'routine'].includes(entry.entry_type) && !ownRecipe ? '' : 'optional'}</small></span>${noteEditorMarkup('edit-entry-note', entry.note || '', { required: ['note', 'routine'].includes(entry.entry_type) && !ownRecipe })}</div>
      <button class="btn btn-primary btn-block dex-entry-save" type="submit">Änderungen speichern</button>
      <button class="btn btn-block dex-entry-delete" type="button" data-entry-delete>Eintrag löschen</button>
    </form>
  </section>`;
  const close = () => backdrop.remove();
  backdrop.onclick = (event) => { if (event.target === backdrop || event.target.closest('[data-sheet-close]')) close(); };
  const recipeIngredients = mountIngredientEditor(backdrop, entry.ingredient_items || []);
  mountNoteEditors(backdrop);
  const trainingClassSelect = backdrop.querySelector('#edit-entry-training-class');
  const trainingClassCustom = backdrop.querySelector('[data-edit-training-class-custom]');
  trainingClassSelect?.addEventListener('change', () => {
    trainingClassCustom.hidden = trainingClassSelect.value !== 'custom';
    if (!trainingClassCustom.hidden) backdrop.querySelector('#edit-entry-training-class-custom')?.focus({ preventScroll: true });
  });
  const replacementInput = backdrop.querySelector('#edit-entry-image');
  replacementInput?.addEventListener('change', () => {
    const file = replacementInput.files?.[0];
    if (!file) return;
    let preview = backdrop.querySelector('[data-edit-image-preview]');
    if (!preview) {
      preview = document.createElement('img');
      preview.dataset.editImagePreview = '';
      preview.alt = 'Neues Rezeptbild';
      replacementInput.closest('.dex-entry-file').prepend(preview);
    }
    preview.src = URL.createObjectURL(file);
    backdrop.querySelector('.dex-entry-file-icon')?.remove();
  });
  backdrop.querySelector('[data-entry-edit]').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    let replacementPath = '';
    try {
      const payload = {
        title: backdrop.querySelector('#edit-entry-title').value.trim(),
        note: readNote(backdrop.querySelector('#edit-entry-note')),
        tags: backdrop.querySelector('#edit-entry-tags').value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
      };
      if (ownRecipe && !payload.title) throw new Error('Bitte einen Titel für das Rezept eintragen.');
      if (entry.root_key === 'food-log') {
        payload.carb_class = backdrop.querySelector('#edit-entry-carb').value;
        payload.prep_minutes = backdrop.querySelector('#edit-entry-prep').value
          ? Number(backdrop.querySelector('#edit-entry-prep').value) : null;
        if (entry.food_kind === 'recipe') {
          const zutaten = recipeIngredients.getItems();
          payload.ingredient_items = zutaten;
          payload.ingredients = zutaten.map(ingredientLine);
        }
      }
      if (entry.root_key === 'training') {
        payload.training_class = trainingClassSelect.value === 'custom'
          ? backdrop.querySelector('#edit-entry-training-class-custom').value.trim()
          : trainingClassSelect.value;
        if (!payload.training_class) throw new Error('Bitte eine eigene Klasse benennen.');
      }
      if (entry.url) payload.url = backdrop.querySelector('#edit-entry-url').value.trim();
      const file = replacementInput?.files?.[0];
      if (file) {
        const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);
        if (!allowed.has(file.type)) throw new Error('Dieses Bildformat wird nicht unterstützt.');
        if (file.size > 8 * 1024 * 1024) throw new Error('Das Bild darf höchstens 8 MB groß sein.');
        const uploadFile = await optimizeImageFile(file);
        const extension = uploadExtension(uploadFile);
        replacementPath = dexStoragePath(entry.user_id, entry.root_key, extension);
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(replacementPath, uploadFile, {
          cacheControl: '31536000', contentType: uploadFile.type,
        });
        if (uploadError) throw uploadError;
        payload.image_path = replacementPath;
      }
      const { error } = await supabase.from('dex_entries').update(payload).eq('id', entry.id).eq('user_id', entry.user_id);
      if (error) throw error;
      if (replacementPath && entry.image_path) await supabase.storage.from(BUCKET).remove([entry.image_path]);
      close(); toast('Eintrag aktualisiert'); await onSaved?.();
    } catch (error) {
      if (replacementPath) await supabase.storage.from(BUCKET).remove([replacementPath]);
      toast(error.message || 'Änderung fehlgeschlagen'); button.disabled = false;
    }
  };
  backdrop.querySelector('[data-entry-delete]').onclick = async () => {
    if (!confirm(`„${entry.title}“ wirklich löschen?`)) return;
    const { error } = await supabase.from('dex_entries').delete().eq('id', entry.id).eq('user_id', entry.user_id);
    if (error) { toast(error.message || 'Löschen fehlgeschlagen'); return; }
    notifyHomeCountsChanged();
    if (entry.image_path || entry.audio_path) await supabase.storage.from(BUCKET).remove([entry.image_path || entry.audio_path]);
    close(); toast('Dex-Eintrag gelöscht');
    if (onDeleted) onDeleted();
    else location.hash = backHref(entry).slice(1);
  };
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('offen'));
}

function fullscreenImage(url, title) {
  const overlay = document.createElement('div');
  overlay.className = 'dex-bild-vollbild';
  overlay.innerHTML = `<button class="dex-detail-knopf dex-bild-schliessen" type="button" aria-label="Vollbild schließen">${materialIconMarkup('close')}</button><img src="${escapeHtml(url)}" alt="${escapeHtml(title)}">`;
  overlay.onclick = (event) => { if (event.target === overlay || event.target.closest('button')) overlay.remove(); };
  document.body.append(overlay);
}

async function shareEntry(entry) {
  const shareData = { title: entry.title, text: noteToText(entry.note) || entry.title, url: entry.url || location.href };
  try {
    if (navigator.share) await navigator.share(shareData);
    else { await navigator.clipboard.writeText(shareData.url); toast('Link kopiert'); }
  } catch (error) {
    if (error?.name !== 'AbortError') toast('Teilen ist gerade nicht möglich.');
  }
}

function detailMarkup(entry) {
  const embed = videoEmbedUrl(entry.url);
  const provider = videoProvider(entry.url);
  const media = entry.entry_type === 'audio' && entry.audio_url
    ? `<div class="dex-detail-audio">${materialIconMarkup('mic')}<audio controls preload="metadata" src="${escapeHtml(entry.audio_url)}"></audio></div>`
    : entry.image_path && entry.preview_url
    ? `<button class="dex-detail-bild" type="button" data-fullscreen><img src="${escapeHtml(entry.preview_url)}" alt="${escapeHtml(entry.title)}"></button>`
    : embed ? `<div class="dex-detail-video${provider?.key === 'instagram' ? ' dex-detail-video-instagram' : ''}"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(entry.title || provider?.name || 'Video')}" loading="lazy" scrolling="no" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`
      : entry.preview_url ? `<div class="dex-detail-linkvorschau"><img src="${escapeHtml(entry.preview_url)}" alt=""></div>`
        : provider ? `<div class="dex-detail-provider"><strong>${escapeHtml(entry.provider || provider.name)}</strong><span>Vorschau dieses Videos</span></div>` : '';
  const tags = (entry.tags || []).map((tag) => `<span>#${escapeHtml(tag.replace(/^#/, ''))}</span>`).join('');
  const savedAt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.created_at));
  const carbLabels = { low: 'Low Carb', high: 'High Carb', balanced: 'Ausgewogen', cheat: 'Cheat' };
  const foodMeta = entry.root_key === 'food-log' && (entry.food_kind === 'cheat_meal' || carbLabels[entry.carb_class] || entry.prep_minutes)
    ? `<div class="dex-detail-foodmeta">
        ${entry.food_kind === 'cheat_meal' ? '<span>Cheat-Meal</span>' : ''}
        ${carbLabels[entry.carb_class] ? `<span>${carbLabels[entry.carb_class]}</span>` : ''}
        ${entry.prep_minutes ? `<span>${entry.prep_minutes} Min.</span>` : ''}
      </div>` : '';
  const trainingLabels = { exercise: 'Übungen', recovery: 'Regeneration', tips: 'Tipps', injury: 'Verletzung' };
  const trainingMeta = entry.root_key === 'training' && entry.training_class && entry.training_class !== 'unset'
    ? `<div class="dex-detail-foodmeta"><span>${escapeHtml(trainingLabels[entry.training_class] || entry.training_class)}</span></div>` : '';
  const ingredients = ingredientsSection(entry);
  const contrastClass = colorIsDark(entry.color) ? ' dex-detail-dunkel' : '';
  return `<div class="dex-detail-overlay${contrastClass}" role="dialog" aria-modal="true" aria-label="Eintrag anzeigen">
    <article class="dex-detail-karte dex-detail-popup" style="--eintrag-farbe:${escapeHtml(entry.color)}">
      <header class="dex-detail-popup-kopf">
        <span class="dex-detail-popup-typ">${entry.entry_type === 'routine' ? 'ROUTINE' : entry.entry_type === 'audio' ? 'TONAUFNAHME' : entry.entry_type === 'note' ? 'NOTIZ' : entry.entry_type === 'image' ? 'BILD' : embed ? 'VIDEO' : 'LINK'}</span>
        <div class="dex-detail-popup-aktionen">
          <button class="dex-detail-knopf dex-detail-menu-trigger" type="button" data-entry-menu aria-expanded="false" aria-label="Eintragsmenü">${materialIconMarkup('more_horiz')}</button>
          <a class="dex-detail-knopf dex-detail-popup-schliessen" href="${backHref(entry)}" aria-label="Eintrag schließen">${materialIconMarkup('close')}</a>
        </div>
        <div class="dex-detail-popup-menü" data-entry-menu-panel hidden>
          <button type="button" data-entry-favorite data-no-interface-sound aria-pressed="${entry.favorite ? 'true' : 'false'}">${materialIconMarkup('favorite')}<span>${entry.favorite ? 'Aus Favoriten entfernen' : 'Als Favorit markieren'}</span></button>
          ${entry.url ? `<button type="button" data-entry-refresh>${materialIconMarkup('refresh')}<span>Vorschau aktualisieren</span></button>` : ''}
          <button type="button" data-entry-edit>${materialIconMarkup('build')}<span>Bearbeiten</span></button>
          <button type="button" data-entry-share>${materialIconMarkup('upload_file')}<span>Teilen</span></button>
        </div>
      </header>
      ${media}
      <div class="dex-detail-inhalt">
        ${entry.title ? `<h1>${escapeHtml(entry.title)}</h1>` : ''}
        ${foodMeta}
        ${trainingMeta}
        ${ingredients}
        ${entry.note ? `<div class="dex-detail-notiztext">${renderNoteHtml(entry.note)}</div>` : ''}
        ${entry.url ? `<div class="dex-detail-herkunft"><span><b>Quelle</b>${escapeHtml(entry.provider || provider?.name || sourceFromUrl(entry.url))}</span><span><b>Gespeichert</b>${savedAt}</span></div>` : `<div class="dex-detail-herkunft"><span><b>Gespeichert</b>${savedAt}</span></div>`}
        ${entry.url ? `<a class="btn btn-primary dex-detail-link" href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">${materialIconMarkup('arrow_forward_ios')}<span>Link aufrufen</span></a>` : ''}
        <section class="dex-detail-tags"><h2>Tags</h2><div>${tags || '<small>Noch keine Tags vergeben.</small>'}</div></section>
        <footer>MUSCLE-DEX</footer>
      </div>
    </article>
  </div>`;
}

export async function mountDexEntryDetail(container, { userId, id, signal }) {
  const entry = await loadEntry(userId, id, signal);
  if (signal?.aborted) return;
  if (!entry) { location.hash = 'home'; return; }
  container.innerHTML = detailMarkup(entry);
  const overlay = container.querySelector('.dex-detail-overlay');
  overlay?.addEventListener('click', (event) => {
    if (event.target === overlay) location.hash = backHref(entry).slice(1);
  });
  const onEscape = (event) => {
    if (event.key === 'Escape' && document.body.contains(overlay)) {
      location.hash = backHref(entry).slice(1);
      window.removeEventListener('keydown', onEscape);
    }
  };
  window.addEventListener('keydown', onEscape);
  const menuTrigger = container.querySelector('[data-entry-menu]');
  const menuPanel = container.querySelector('[data-entry-menu-panel]');
  menuTrigger?.addEventListener('click', () => {
    const open = menuPanel?.hasAttribute('hidden');
    if (!menuPanel) return;
    menuPanel.toggleAttribute('hidden', !open);
    menuTrigger.setAttribute('aria-expanded', String(open));
  });
  const favoriteButton = container.querySelector('[data-entry-favorite]');
  favoriteButton.onclick = async (event) => {
    const button = event.currentTarget;
    const favorite = button.getAttribute('aria-pressed') !== 'true';
    button.disabled = true;
    const { error } = await supabase.from('dex_entries').update({ favorite }).eq('id', entry.id).eq('user_id', userId);
    if (error) { toast(error.message || 'Favorit konnte nicht geändert werden.'); button.disabled = false; return; }
    playInterfaceSound(favorite ? 'level-up' : 'error', { retrigger: 'restart' });
    toast(favorite ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt');
    await mountDexEntryDetail(container, { userId, id, signal });
  };
  const refreshButton = container.querySelector('[data-entry-refresh]');
  if (refreshButton) {
    refreshButton.onclick = async () => {
      if (!entry.url) return;
      refreshButton.disabled = true;
      refreshButton.classList.add('rotiert');
      const streamingSound = playInterfaceSound('streaming', { loop: true, retrigger: 'restart' });
      try {
        const { data: previewData, error: previewError } = await supabase.functions.invoke('link-preview', { body: { url: entry.url } });
        if (previewError) throw previewError;
        if (!previewData || previewData.error) throw new Error(previewData?.error || 'Vorschau konnte nicht geladen werden.');
        const patch = {
          url: previewData.resolvedUrl || entry.url,
          preview_url: previewData.previewUrl || null,
          provider: previewData.provider || entry.provider || null,
        };
        // Beim ersten Speichern konnten Plattformen wie TikTok bei Foto-Posts
        // noch leere Metadaten liefern. Ein Refresh fuellt fehlende Werte nach,
        // laesst aber vom Nutzer bearbeitete Titel und Notizen unangetastet.
        const genericTitle = /^(video|instagram|instagram[- ]?video|reel)$/i.test(entry.title?.trim() || '');
        if ((!entry.title?.trim() || genericTitle) && previewData.title) patch.title = previewData.title;
        if (!entry.note?.trim() && previewData.description) patch.note = previewData.description;
        const { error: updateError } = await supabase.from('dex_entries').update(patch).eq('id', entry.id).eq('user_id', userId);
        if (updateError) throw updateError;
        streamingSound?.stop();
        toast('Vorschau aktualisiert');
        await mountDexEntryDetail(container, { userId, id, signal });
      } catch (error) {
        streamingSound?.stop();
        toast(error.message || 'Vorschau konnte nicht aktualisiert werden.');
        refreshButton.classList.remove('rotiert');
        refreshButton.disabled = false;
      }
    };
  }
  container.querySelector('[data-entry-edit]').onclick = () => editEntry(entry, () => mountDexEntryDetail(container, { userId, id, signal }));
  container.querySelector('[data-entry-share]').onclick = () => shareEntry(entry);
  container.querySelector('[data-fullscreen]')?.addEventListener('click', () => fullscreenImage(entry.preview_url, entry.title));
}
