import { supabase } from './supabase.js';
import { toast } from './toast.js';

const BUCKET = 'food-log';
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const heute = () => new Date().toISOString().slice(0, 10);
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function dateLabel(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    .format(new Date(`${value}T12:00:00`));
}

function extension(file) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
}

function validateImage(file) {
  if (!file) return;
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Bitte JPG, PNG, WebP oder HEIC verwenden.');
  if (file.size > MAX_FILE_SIZE) throw new Error('Das Bild darf maximal 8 MB gross sein.');
}

async function loadEntries(userId, signal) {
  let query = supabase
    .from('food_logs')
    .select('id, title, note, eaten_at, image_path, created_at')
    .eq('user_id', userId)
    .order('eaten_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  if (signal?.aborted) return [];
  const entries = data || [];
  const paths = [...new Set(entries.map((entry) => entry.image_path).filter(Boolean))];
  if (!paths.length) return entries.map((entry) => ({ ...entry, image_url: null }));
  const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const urls = new Map((signedError ? [] : signed || []).map((item) => [item.path, item.signedUrl]));
  return entries.map((entry) => ({ ...entry, image_url: urls.get(entry.image_path) || null }));
}

async function uploadImage(userId, file) {
  validateImage(file);
  const path = `${userId}/${crypto.randomUUID()}.${extension(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

function entryMarkup(entry) {
  return `<article class="food-card card" data-food-id="${entry.id}">
    ${entry.image_url
      ? `<img class="food-image" src="${escapeHtml(entry.image_url)}" alt="${escapeHtml(entry.title)}" loading="lazy">`
      : '<div class="food-image food-placeholder" aria-hidden="true">◆</div>'}
    <div class="food-card-body">
      <span class="food-date">${dateLabel(entry.eaten_at)}</span>
      <h2>${escapeHtml(entry.title)}</h2>
      ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
      <div class="food-actions">
        <button class="btn" type="button" data-food-edit>Bearbeiten</button>
        <button class="btn btn-danger" type="button" data-food-delete>Löschen</button>
      </div>
    </div>
  </article>`;
}

export async function mountFoodLog(container, { session, signal }) {
  const userId = session.user.id;
  let entries = [];
  let editingId = null;

  container.innerHTML = `
    <div class="wrap pad-bottom">
      <div class="seitenkopf">
        <div class="seitenkopf-text">
          <span class="seitenkopf-kicker">Inspiration</span>
          <h1 class="section-title">Food-Log</h1>
        </div>
        <a class="zurueck" href="#home"><span class="pf">←</span> Übersicht</a>
      </div>
      <section class="seiten-einstieg">
        <b>Was hat richtig gut funktioniert?</b>
        <span>Halte Mahlzeiten fest und greif an ideenlosen Tagen darauf zurück.</span>
      </section>
      <details class="card food-form-card" data-food-panel>
        <summary><span class="food-add-icon">+</span><span>Neue Mahlzeit</span><small>Idee festhalten</small></summary>
        <form data-food-form>
          <input type="hidden" data-food-id>
          <label class="fld-l" for="food-title">Mahlzeit</label>
          <input class="input" id="food-title" maxlength="100" required placeholder="z. B. Turbo-Pasta">
          <label class="fld-l" for="food-note">Notiz</label>
          <textarea class="input food-note" id="food-note" maxlength="1000" placeholder="Zutaten, Anlass oder warum sie gut war"></textarea>
          <div class="food-form-grid">
            <label><span class="fld-l">Gegessen am</span><input class="input" data-food-date type="date" value="${heute()}" required></label>
            <label><span class="fld-l">Foto (optional)</span><input class="input food-file" data-food-file type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"></label>
          </div>
          <div class="food-form-actions">
            <button class="btn btn-primary" type="submit" data-food-save>Mahlzeit speichern</button>
            <button class="btn" type="button" data-food-cancel hidden>Abbrechen</button>
          </div>
        </form>
      </details>
      <div class="food-toolbar">
        <h2>Meine Ideen</h2>
        <span data-food-count></span>
      </div>
      <section class="food-grid" data-food-list aria-live="polite"><div class="daten-laden" role="status">Food-Log wird geladen …</div></section>
    </div>`;

  const form = container.querySelector('[data-food-form]');
  const panel = container.querySelector('[data-food-panel]');
  const list = container.querySelector('[data-food-list]');
  const count = container.querySelector('[data-food-count]');
  const cancelButton = container.querySelector('[data-food-cancel]');
  const titleInput = form.querySelector('#food-title');
  const noteInput = form.querySelector('#food-note');
  const dateInput = form.querySelector('[data-food-date]');
  const fileInput = form.querySelector('[data-food-file]');

  const resetForm = () => {
    editingId = null;
    form.reset();
    dateInput.value = heute();
    form.querySelector('[data-food-save]').textContent = 'Mahlzeit speichern';
    cancelButton.hidden = true;
    panel.open = false;
  };

  const renderEntries = () => {
    count.textContent = `${entries.length} ${entries.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'}`;
    list.innerHTML = entries.length
      ? entries.map(entryMarkup).join('')
      : '<div class="card food-empty"><b>Noch keine Mahlzeit gespeichert.</b><span>Deine Galerie beginnt mit dem ersten guten Essen.</span></div>';
  };

  const refresh = async () => {
    entries = await loadEntries(userId, signal);
    if (signal?.aborted) return;
    renderEntries();
  };

  list.onclick = async (event) => {
    const card = event.target.closest('[data-food-id]');
    if (!card) return;
    const entry = entries.find((item) => item.id === card.dataset.foodId);
    if (!entry) return;
    if (event.target.closest('[data-food-edit]')) {
      editingId = entry.id;
      panel.open = true;
      titleInput.value = entry.title;
      noteInput.value = entry.note || '';
      dateInput.value = entry.eaten_at;
      fileInput.value = '';
      form.querySelector('[data-food-save]').textContent = 'Änderungen speichern';
      cancelButton.hidden = false;
      titleInput.focus();
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!event.target.closest('[data-food-delete]')) return;
    if (!confirm(`„${entry.title}“ wirklich löschen?`)) return;
    const button = event.target.closest('[data-food-delete]');
    button.disabled = true;
    const { error } = await supabase.from('food_logs').delete().eq('id', entry.id).eq('user_id', userId);
    if (error) {
      button.disabled = false;
      return toast('Löschen fehlgeschlagen');
    }
    if (entry.image_path) await supabase.storage.from(BUCKET).remove([entry.image_path]);
    if (editingId === entry.id) resetForm();
    await refresh();
    toast('Mahlzeit gelöscht');
  };

  cancelButton.onclick = resetForm;
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector('[data-food-save]');
    const wasEditing = Boolean(editingId);
    const current = entries.find((item) => item.id === editingId);
    const file = fileInput.files?.[0] || null;
    let uploadedPath = null;
    button.disabled = true;
    try {
      if (file) uploadedPath = await uploadImage(userId, file);
      const payload = {
        user_id: userId,
        title: titleInput.value.trim(),
        note: noteInput.value.trim(),
        eaten_at: dateInput.value || heute(),
        image_path: uploadedPath || current?.image_path || null,
      };
      if (!payload.title) throw new Error('Bitte einen Namen eintragen.');
      const query = supabase.from('food_logs');
      const { error } = editingId
        ? await query.update(payload).eq('id', editingId).eq('user_id', userId)
        : await query.insert(payload);
      if (error) throw error;
      if (uploadedPath && current?.image_path) await supabase.storage.from(BUCKET).remove([current.image_path]);
      resetForm();
      await refresh();
      toast(wasEditing ? 'Mahlzeit aktualisiert' : 'Mahlzeit gespeichert');
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
      toast(error.message || 'Speichern fehlgeschlagen');
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  };

  try {
    await refresh();
  } catch (error) {
    list.innerHTML = `<div class="msg err">${escapeHtml(error.message)}</div>`;
  }
}
