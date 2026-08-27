import { supabase } from './supabase.js';
import {
  availableCategoryIcons, categoryColor, dexEditorColors, materialIconMarkup,
} from './categoryIcons.js';
import { toast } from './toast.js';
import mainDexSvgRaw from '../Folder.svg?raw';
import unterdexSvgRaw from '../Unterdex.svg?raw';

export const COLLECTION_COLORS = dexEditorColors;

export const COLLECTION_ICONS = availableCategoryIcons.map((icon) => icon.id);

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function prepareFolderSvg(raw, svgClass, pathClasses) {
  let index = 0;
  return raw
    .replace(/<\?xml[^>]*>\s*/i, '')
    .replace(/<!DOCTYPE[^>]*>\s*/i, '')
    .replace('<svg ', `<svg class="${svgClass}" aria-hidden="true" `)
    .replace(/<path\b([^>]*)style="[^"]*"([^>]*)\/>/g, (_match, before, after) => {
      const className = pathClasses[index] || '';
      index += 1;
      return `<path${className ? ` class="${className}"` : ''}${before}${after}/>`;
    });
}

export const mainDexFolderSvg = prepareFolderSvg(mainDexSvgRaw, 'dex-ordner-form', [
  'dex-ordner-rueckblatt',
  'dex-ordner-farbblatt',
  'dex-ordner-front',
]);

const unterdexFolderSvg = prepareFolderSvg(unterdexSvgRaw, 'dex-ordner-form dex-unterdex-form', [
  'dex-ordner-rueckblatt',
  'dex-ordner-front',
]);

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
    .eq('id', id).maybeSingle();
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

function darkCollectionColor(color) {
  const hex = String(color || '').trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 135;
}

function isSubDexItem(item) {
  return Boolean(item?.parent_id) || item?.root_key !== 'home';
}

function collectionDisplayColor(item, inheritedColor) {
  if (isSubDexItem(item)) return inheritedColor || categoryColor(item.root_key) || item.color;
  return item.color || inheritedColor || COLLECTION_COLORS[0];
}

export function collectionCardMarkup(item, count = 0, options = {}) {
  const subDex = isSubDexItem(item);
  const color = collectionDisplayColor(item, options.inheritedColor);
  const icon = subDex ? '' : `<span class="dex-ordner-kartenicon" aria-hidden="true">${collectionIconMarkup(item.icon_key)}</span>`;
  const folderSvg = subDex
    ? unterdexFolderSvg
    : mainDexFolderSvg;
  return `<div class="tuck-fach dex-ordner-testfach unter-sammlung${subDex ? ' dex-unterdex-fach' : ''}${darkCollectionColor(color) ? ' dex-ordner-dunkel' : ''}" style="--ordner:${color}">
    <a class="tuck-karte dex-datensatz-karte dex-ordner-test" href="#collection/${item.id}" data-collection-id="${item.id}">
      ${folderSvg}
      <span class="dex-ordner-inhalt">
        <span class="dex-datensatz-meta"><b>${count}</b><span>${count === 1 ? 'Eintrag' : 'Einträge'}</span></span>
        <h2>${escapeHtml(item.name)}</h2>
      </span>
      ${icon}
    </a>
  </div>`;
}

export function collectionGridMarkup(items, options = {}) {
  if (!items.length) return '';
  const counts = options.counts || new Map();
  return `<section class="unter-sammlungen-block">
    <h2>Unter-Dex (${items.length})</h2>
    <div class="unter-sammlungen-grid">${items.map((item) => collectionCardMarkup(item, counts.get(item.id)?.entries || 0, options)).join('')}</div>
  </section>`;
}

export async function saveCollection(userId, values, existing = null) {
  const payload = {
    user_id: userId,
    parent_id: values.parentId || null,
    root_key: values.rootKey,
    name: values.name.trim(),
    color: values.color || existing?.color || categoryColor(values.rootKey) || COLLECTION_COLORS[0],
    icon_key: values.iconKey || existing?.icon_key || 'create_new_folder',
  };
  if (!payload.name) throw new Error('Bitte einen Namen eintragen.');
  const query = supabase.from('collections');
  const { data, error } = existing
    ? await query.update({ name: payload.name, color: payload.color, icon_key: payload.icon_key })
      .eq('id', existing.id).select().single()
    : await query.insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCollection(userId, item) {
  const { error } = await supabase.from('collections').delete()
    .eq('id', item.id);
  if (error) throw error;
}

function closeEditor(backdrop) {
  backdrop?.remove();
}

export function openCollectionEditor({ userId, rootKey, parentId = null, existing = null, onSaved }) {
  const selectedColor = existing?.color || categoryColor(rootKey) || COLLECTION_COLORS[0];
  const selectedIcon = existing?.icon_key || COLLECTION_ICONS.find((icon) => icon === 'create_new_folder') || COLLECTION_ICONS[0];
  const isSubDex = Boolean(parentId || existing?.parent_id) || rootKey !== 'home';
  const showIconPicker = !isSubDex;
  const showColorPicker = !isSubDex;
  const editorTitle = existing ? 'Dex bearbeiten' : (isSubDex ? 'Neuer Unter-Dex' : 'Neuer Dex');
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop sammlung-editor-backdrop';
  backdrop.innerHTML = `<section class="kategorie-sheet sammlung-editor" role="dialog" aria-modal="true" aria-label="${editorTitle}">
    <div class="sheet-griff" aria-hidden="true"></div>
    <header><h2>${editorTitle}</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <form data-collection-form>
      <div class="sammlung-editor-label"><label for="collection-name">Name</label><span data-name-count>${existing?.name?.length || 0}/40</span></div>
      <input class="input" id="collection-name" maxlength="40" required placeholder="z. B. Low Carb" value="${escapeHtml(existing?.name || '')}">
      ${showColorPicker ? `<h3>Farbe</h3>
        <div class="sammlung-editor-farben">${COLLECTION_COLORS.map((value) => `<button type="button" data-pick-color="${value}" class="${value.toUpperCase() === selectedColor.toUpperCase() ? 'aktiv ' : ''}${darkCollectionColor(value) ? 'farbe-dunkel' : ''}" style="--farbe:${value}" aria-label="Farbe ${value}"></button>`).join('')}</div>` : ''}
      ${showIconPicker ? `<h3>Icon</h3>
        <div class="sammlung-editor-icons">${COLLECTION_ICONS.map((icon) => `<button type="button" data-pick-icon="${icon}" class="${icon === selectedIcon ? 'aktiv' : ''}" aria-label="Icon ${icon}">${materialIconMarkup(icon)}</button>`).join('')}</div>
        <label class="sammlung-emoji-eigen" for="collection-emoji"><span>Eigenes Emoji</span>
          <input id="collection-emoji" inputmode="text" maxlength="12" placeholder="z. B. 🦾" value="${selectedIcon.startsWith('emoji:') ? escapeHtml(selectedIcon.slice(6)) : ''}">
        </label>` : ''}
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
      return;
    }
    const iconButton = event.target.closest('[data-pick-icon]');
    if (iconButton) {
      iconKey = iconButton.dataset.pickIcon;
      backdrop.querySelector('#collection-emoji').value = '';
      backdrop.querySelectorAll('[data-pick-icon]').forEach((button) => button.classList.toggle('aktiv', button === iconButton));
    }
  };
  const input = backdrop.querySelector('#collection-name');
  const emojiInput = backdrop.querySelector('#collection-emoji');
  input.oninput = () => { backdrop.querySelector('[data-name-count]').textContent = `${input.value.length}/40`; };
  if (emojiInput) emojiInput.oninput = () => {
    const emoji = emojiInput.value.trim();
    if (!emoji) return;
    iconKey = `emoji:${emoji}`;
    backdrop.querySelectorAll('[data-pick-icon]').forEach((button) => button.classList.remove('aktiv'));
  };
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
  requestAnimationFrame(() => {
    backdrop.classList.add('offen');
    input.focus({ preventScroll: true });
  });
  return backdrop;
}
