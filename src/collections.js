import { supabase } from './supabase.js';
import {
  availableCategoryIcons, categoryEmojis, enableSheetSwipe, materialIconMarkup,
} from './categoryIcons.js';
import { toast } from './toast.js';

export const COLLECTION_COLORS = [
  '#F3C84B', '#F54588', '#9D78E8', '#5C8ED8', '#64C5AE', '#72B957', '#B9DC59', '#FF7B42',
  '#F1DCAA', '#C9C9C9', '#8CA1BD', '#BE80B9', '#B58A62', '#492426', '#E97777', '#6C5CF2',
];

export const COLLECTION_ICONS = availableCategoryIcons.map((icon) => icon.id);

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export async function loadCollections(userId, { rootKey, parentId = null, signal } = {}) {
  let query = supabase.from('collections')
    .select('id,user_id,parent_id,root_key,name,color,icon_key,position,created_at')
    .eq('user_id', userId)
    .eq('root_key', rootKey)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCollection(userId, id, signal) {
  let query = supabase.from('collections')
    .select('id,user_id,parent_id,root_key,name,color,icon_key,position,created_at')
    .eq('user_id', userId).eq('id', id).maybeSingle();
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export function collectionIconMarkup(value) {
  if (value?.startsWith('emoji:')) {
    return `<span class="dex-emoji" aria-hidden="true">${escapeHtml(value.slice(6))}</span>`;
  }
  return materialIconMarkup(value || 'create_new_folder');
}

export function collectionCardMarkup(item, count = 0) {
  return `<a class="unter-sammlung" href="#collection/${item.id}" style="--ordner:${item.color}">
    <span class="unter-sammlung-reiter" aria-hidden="true"></span>
    <span class="unter-sammlung-kartenflaeche">
      <span class="unter-sammlung-icon">${collectionIconMarkup(item.icon_key)}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <small>${count} ${count === 1 ? 'Eintrag' : 'Einträge'}</small>
    </span>
  </a>`;
}

export function collectionGridMarkup(items) {
  if (!items.length) return '';
  return `<section class="unter-sammlungen-block">
    <h2>Unter-Dex (${items.length})</h2>
    <div class="unter-sammlungen-grid">${items.map((item) => collectionCardMarkup(item)).join('')}</div>
  </section>`;
}

export async function saveCollection(userId, values, existing = null) {
  const payload = {
    user_id: userId,
    parent_id: values.parentId || null,
    root_key: values.rootKey,
    name: values.name.trim(),
    color: values.color,
    icon_key: values.iconKey,
  };
  if (!payload.name) throw new Error('Bitte einen Namen eintragen.');
  const query = supabase.from('collections');
  const { data, error } = existing
    ? await query.update({ name: payload.name, color: payload.color, icon_key: payload.icon_key })
      .eq('id', existing.id).eq('user_id', userId).select().single()
    : await query.insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCollection(userId, item) {
  const { error } = await supabase.from('collections').delete()
    .eq('id', item.id).eq('user_id', userId);
  if (error) throw error;
}

function closeEditor(backdrop) {
  backdrop?.remove();
}

export function openCollectionEditor({ userId, rootKey, parentId = null, existing = null, onSaved }) {
  const selectedColor = existing?.color || COLLECTION_COLORS[0];
  const selectedIcon = existing?.icon_key || COLLECTION_ICONS.find((icon) => icon === 'create_new_folder') || COLLECTION_ICONS[0];
  const isSubDex = Boolean(parentId || existing?.parent_id);
  const editorTitle = existing ? 'Dex bearbeiten' : (isSubDex ? 'Neuer Unter-Dex' : 'Neuer Dex');
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop sammlung-editor-backdrop';
  backdrop.innerHTML = `<section class="kategorie-sheet sammlung-editor" role="dialog" aria-modal="true" aria-label="${editorTitle}">
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>${editorTitle}</h2><button type="button" data-sheet-close aria-label="Schließen">×</button></header>
    <form data-collection-form>
      <div class="sammlung-editor-label"><label for="collection-name">Name</label><span data-name-count>${existing?.name?.length || 0}/40</span></div>
      <input class="input" id="collection-name" maxlength="40" required placeholder="z. B. Low Carb" value="${escapeHtml(existing?.name || '')}">
      <h3>Farbe</h3>
      <div class="sammlung-editor-farben">${COLLECTION_COLORS.map((color) => `<button type="button" data-pick-color="${color}" class="${color === selectedColor ? 'aktiv' : ''}" style="--farbe:${color}" aria-label="Farbe ${color}"></button>`).join('')}</div>
      <h3>Icon</h3>
      <div class="sammlung-editor-icons">${COLLECTION_ICONS.map((icon) => `<button type="button" data-pick-icon="${icon}" class="${icon === selectedIcon ? 'aktiv' : ''}" aria-label="Icon ${icon}">${materialIconMarkup(icon)}</button>`).join('')}</div>
      <h3>Apple-Emojis</h3>
      <div class="sammlung-editor-emojis">${categoryEmojis.map((emoji) => `<button type="button" data-pick-icon="emoji:${emoji}" class="${selectedIcon === `emoji:${emoji}` ? 'aktiv' : ''}" aria-label="Emoji ${emoji}">${emoji}</button>`).join('')}</div>
      <button class="btn btn-primary btn-block sammlung-editor-speichern" type="submit">${existing ? 'Änderungen speichern' : (isSubDex ? 'Unter-Dex erstellen' : 'Dex erstellen')}</button>
    </form>
  </section>`;
  let color = selectedColor;
  let iconKey = selectedIcon;
  const close = () => closeEditor(backdrop);
  backdrop.onclick = (event) => {
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) return close();
    const colorButton = event.target.closest('[data-pick-color]');
    if (colorButton) {
      color = colorButton.dataset.pickColor;
      backdrop.querySelectorAll('[data-pick-color]').forEach((button) => button.classList.toggle('aktiv', button === colorButton));
    }
    const iconButton = event.target.closest('[data-pick-icon]');
    if (iconButton) {
      iconKey = iconButton.dataset.pickIcon;
      backdrop.querySelectorAll('[data-pick-icon]').forEach((button) => button.classList.toggle('aktiv', button === iconButton));
    }
  };
  const input = backdrop.querySelector('#collection-name');
  input.oninput = () => { backdrop.querySelector('[data-name-count]').textContent = `${input.value.length}/40`; };
  backdrop.querySelector('[data-collection-form]').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const saved = await saveCollection(userId, { rootKey, parentId, name: input.value, color, iconKey }, existing);
      close();
      toast(existing ? 'Dex aktualisiert' : (isSubDex ? 'Unter-Dex erstellt' : 'Dex erstellt'));
      await onSaved?.(saved);
    } catch (error) {
      toast(error.message || 'Speichern fehlgeschlagen');
      button.disabled = false;
    }
  };
  backdrop.addEventListener('touchmove', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('.sammlung-editor')) event.preventDefault();
  }, { passive: false });
  document.body.append(backdrop);
  enableSheetSwipe(backdrop, close);
  requestAnimationFrame(() => {
    backdrop.classList.add('offen');
    input.focus({ preventScroll: true });
  });
  return backdrop;
}
