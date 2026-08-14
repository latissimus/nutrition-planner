import { supabase } from './supabase.js';
import { materialIconMarkup } from './categoryIcons.js';
import { toast } from './toast.js';

const BUCKET = 'dex-entries';
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function targetSheet(collections, currentCollectionId, onPick) {
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop dex-ziel-backdrop';
  const options = collections.filter((item) => item.id !== currentCollectionId);
  backdrop.innerHTML = `<section class="kategorie-sheet" role="dialog" aria-modal="true" aria-label="Ziel-Dex wählen">
    <header><h2>Ziel-Dex wählen</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="sheet-menue dex-ziel-liste">
      <button type="button" data-target-id="">${materialIconMarkup('create_new_folder', 'sheet-list-icon')}<span>Oberste Ebene</span></button>
      ${options.map((item) => `<button type="button" data-target-id="${item.id}">${materialIconMarkup(item.icon_key || 'create_new_folder', 'sheet-list-icon')}<span>${escapeHtml(item.name)}</span></button>`).join('')}
    </div>
  </section>`;
  const close = () => backdrop.remove();
  backdrop.onclick = (event) => {
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) return close();
    const button = event.target.closest('[data-target-id]');
    if (!button) return;
    close();
    onPick(button.dataset.targetId || null);
  };
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('offen'));
}

export async function startDexSelection(container, {
  userId, rootKey, currentCollectionId = null,
  onChanged = () => window.dispatchEvent(new HashChangeEvent('hashchange')),
} = {}) {
  if (container.classList.contains('dex-auswahlmodus')) return;
  const cards = [...container.querySelectorAll('.dex-ordner-test[data-collection-id],.dex-inhaltskarte[data-dex-entry-id]')];
  if (!cards.length) return toast('In diesem Dex gibt es noch nichts auszuwählen.');

  const selectedCollections = new Set();
  const selectedEntries = new Set();
  const bar = document.createElement('aside');
  bar.className = 'dex-auswahlleiste';
  bar.innerHTML = `<strong data-selection-count>0 ausgewählt</strong><span></span>
    <button type="button" data-selection-move disabled>${materialIconMarkup('create_new_folder')}<small>Verschieben</small></button>
    <button type="button" data-selection-delete disabled>${materialIconMarkup('delete_forever')}<small>Löschen</small></button>
    <button type="button" data-selection-cancel>${materialIconMarkup('close')}<small>Abbrechen</small></button>`;

  const update = () => {
    const count = selectedCollections.size + selectedEntries.size;
    bar.querySelector('[data-selection-count]').textContent = `${count} ausgewählt`;
    bar.querySelector('[data-selection-move]').disabled = count === 0;
    bar.querySelector('[data-selection-delete]').disabled = count === 0;
  };
  const cleanup = () => {
    container.classList.remove('dex-auswahlmodus');
    container.removeEventListener('click', capture, true);
    cards.forEach((card) => card.querySelector('.dex-auswahl-marker')?.remove());
    bar.remove();
  };
  const toggle = (card) => {
    const collectionId = card.dataset.collectionId;
    const entryId = card.dataset.dexEntryId;
    const set = collectionId ? selectedCollections : selectedEntries;
    const id = collectionId || entryId;
    if (!id) return;
    if (set.has(id)) set.delete(id); else set.add(id);
    card.classList.toggle('ausgewaehlt', set.has(id));
    card.querySelector('.dex-auswahl-marker').innerHTML = set.has(id) ? materialIconMarkup('check_small') : '';
    update();
  };
  const capture = (event) => {
    const card = event.target.closest('.dex-ordner-test[data-collection-id],.dex-inhaltskarte[data-dex-entry-id]');
    if (!card || !container.contains(card)) return;
    event.preventDefault();
    event.stopPropagation();
    toggle(card);
  };

  cards.forEach((card) => card.insertAdjacentHTML('beforeend', '<span class="dex-auswahl-marker" aria-hidden="true"></span>'));
  container.classList.add('dex-auswahlmodus');
  container.addEventListener('click', capture, true);
  document.body.append(bar);
  bar.querySelector('[data-selection-cancel]').onclick = cleanup;

  bar.querySelector('[data-selection-delete]').onclick = async () => {
    const count = selectedCollections.size + selectedEntries.size;
    if (!confirm(`${count} ausgewählte ${count === 1 ? 'Element' : 'Elemente'} wirklich löschen?`)) return;
    try {
      if (selectedEntries.size) {
        const ids = [...selectedEntries];
        const { data: media, error: mediaError } = await supabase.from('dex_entries')
          .select('image_path,audio_path').eq('user_id', userId).in('id', ids);
        if (mediaError) throw mediaError;
        const { error } = await supabase.from('dex_entries').delete().eq('user_id', userId).in('id', ids);
        if (error) throw error;
        const paths = (media || []).flatMap((item) => [item.image_path, item.audio_path]).filter(Boolean);
        if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      }
      if (selectedCollections.size) {
        const { error } = await supabase.from('collections').delete()
          .eq('user_id', userId).in('id', [...selectedCollections]);
        if (error) throw error;
      }
      cleanup(); toast('Auswahl gelöscht'); await onChanged?.();
    } catch (error) { toast(error.message || 'Auswahl konnte nicht gelöscht werden.'); }
  };

  bar.querySelector('[data-selection-move]').onclick = async () => {
    const { data: collections, error } = await supabase.from('collections')
      .select('id,parent_id,root_key,name,icon_key,user_id')
      .eq('user_id', userId).eq('root_key', rootKey).order('name');
    if (error) return toast('Ziel-Dex konnten nicht geladen werden.');
    const blocked = new Set(selectedCollections);
    // Auch alle Nachfahren sperren: Sonst koennte ein ausgewaehlter Dex in
    // seinen eigenen Unterbaum verschoben und damit ein Zyklus erzeugt werden.
    let foundDescendant = true;
    while (foundDescendant) {
      foundDescendant = false;
      (collections || []).forEach((item) => {
        if (item.parent_id && blocked.has(item.parent_id) && !blocked.has(item.id)) {
          blocked.add(item.id); foundDescendant = true;
        }
      });
    }
    targetSheet((collections || []).filter((item) => !blocked.has(item.id)), currentCollectionId, async (targetId) => {
      if (targetId && blocked.has(targetId)) return toast('Ein Dex kann nicht in sich selbst verschoben werden.');
      try {
        if (selectedEntries.size) {
          const { error: entryError } = await supabase.from('dex_entries')
            .update({ collection_id: targetId }).eq('user_id', userId).in('id', [...selectedEntries]);
          if (entryError) throw entryError;
        }
        if (selectedCollections.size) {
          const { error: collectionError } = await supabase.from('collections')
            .update({ parent_id: targetId }).eq('user_id', userId).in('id', [...selectedCollections]);
          if (collectionError) throw collectionError;
        }
        cleanup(); toast('Auswahl verschoben'); await onChanged?.();
      } catch (moveError) { toast(moveError.message || 'Auswahl konnte nicht verschoben werden.'); }
    });
  };
  update();
}
