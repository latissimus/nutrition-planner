import { supabase } from './supabase.js';
import { loadAllDexEntries } from './dexEntries.js';
import { noteToText } from './richText.js';

export const KNOWLEDGE_ROOTS = ['food-log', 'essen', 'training', 'supps', 'stress'];

const ROOT_LABELS = {
  'food-log': 'REZEPTE',
  essen: 'ESSEN',
  training: 'TRAINING',
  supps: 'SUPPS',
  stress: 'MIND',
};

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function normalizeKnowledgeSearch(value = '') {
  return String(value).trim().toLocaleLowerCase('de').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
}

function valuesText(values) {
  return values.flat(Infinity).filter((value) => value !== null && value !== undefined)
    .map((value) => typeof value === 'object' ? JSON.stringify(value) : String(value)).join(' ');
}

function entrySearchText(entry) {
  return valuesText([
    entry.title, noteToText(entry.note), entry.tags, entry.provider, entry.url,
    entry.training_class, entry.food_kind, entry.carb_class, entry.ingredients,
    (entry.ingredient_items || []).map((item) => item?.name || ''),
  ]);
}

function excerpt(text, max = 150) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export function filterKnowledgeItems(items, query, activeRoot = 'all') {
  const terms = normalizeKnowledgeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return items.filter((item) => {
    if (activeRoot !== 'all' && item.rootKey !== activeRoot) return false;
    const searchable = normalizeKnowledgeSearch(item.searchText);
    return terms.every((term) => searchable.includes(term));
  });
}

async function loadKnowledgeCollections(signal) {
  let query = supabase.from('collections')
    .select('id,parent_id,root_key,name,created_at')
    .in('root_key', KNOWLEDGE_ROOTS);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function prepareItems(entries, collections) {
  const allowed = new Set(KNOWLEDGE_ROOTS);
  const folders = new Map(collections.map((folder) => [folder.id, folder]));
  const folderPath = (folder) => {
    const names = [];
    const seen = new Set();
    let current = folder;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      current = folders.get(current.parent_id);
    }
    return names.join(' › ');
  };
  const folderItems = collections.filter((folder) => allowed.has(folder.root_key)).map((folder) => ({
    id: folder.id,
    kind: 'folder',
    rootKey: folder.root_key,
    title: folder.name || 'Unterordner',
    meta: folderPath(folder),
    excerpt: 'Unterordner',
    href: `#collection/${folder.id}`,
    searchText: valuesText([folder.name, folderPath(folder), ROOT_LABELS[folder.root_key]]),
  }));
  const entryItems = entries.filter((entry) => allowed.has(entry.root_key)).map((entry) => {
    const folder = folders.get(entry.collection_id);
    const note = noteToText(entry.note);
    const tags = Array.isArray(entry.tags) ? entry.tags.join(' · ') : String(entry.tags || '');
    return {
      id: entry.id,
      kind: 'entry',
      rootKey: entry.root_key,
      title: entry.title || 'Ohne Titel',
      meta: folder ? folderPath(folder) : ROOT_LABELS[entry.root_key],
      excerpt: excerpt(note || tags || entry.provider || entry.url || 'Eintrag'),
      href: `#entry/${entry.id}`,
      searchText: valuesText([entrySearchText(entry), folder ? folderPath(folder) : '', ROOT_LABELS[entry.root_key]]),
    };
  });
  return [...folderItems, ...entryItems];
}

function resultMarkup(item) {
  const label = ROOT_LABELS[item.rootKey] || item.rootKey;
  return `<a class="wissenssuche-treffer" href="${item.href}">
    <span class="wissenssuche-treffer-kopf"><small>${escapeHtml(label)}</small><i>${item.kind === 'folder' ? 'ORDNER' : 'EINTRAG'}</i></span>
    <strong>${escapeHtml(item.title)}</strong>
    ${item.excerpt ? `<span>${escapeHtml(item.excerpt)}</span>` : ''}
    ${item.meta && item.meta !== label ? `<em>${escapeHtml(item.meta)}</em>` : ''}
  </a>`;
}

function groupedResultsMarkup(items) {
  return KNOWLEDGE_ROOTS.map((rootKey) => {
    const group = items.filter((item) => item.rootKey === rootKey);
    if (!group.length) return '';
    return `<section class="wissenssuche-gruppe">
      <h2>${ROOT_LABELS[rootKey]} <span>${group.length}</span></h2>
      <div>${group.map(resultMarkup).join('')}</div>
    </section>`;
  }).join('');
}

export async function mountKnowledgeSearch(view, { signal } = {}) {
  view.classList.add('wissenssuche-seite');
  view.innerHTML = `<div class="wissenssuche-scroll">
    <div class="wissenssuche-wrap">
      <header class="wissenssuche-titel">
        <span>Wissenssammlung</span>
        <h1>WISSEN DURCHSUCHEN</h1>
      </header>
      <label class="wissenssuche-feld" for="wissenssuche-input">
        <span aria-hidden="true"></span>
        <input id="wissenssuche-input" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Titel, Notizen, Tags …">
        <button type="button" data-search-clear aria-label="Suche leeren" hidden>×</button>
      </label>
      <nav class="wissenssuche-filter" aria-label="Wissensbereich filtern">
        <button type="button" class="aktiv" data-search-root="all" aria-pressed="true">Alle</button>
        ${KNOWLEDGE_ROOTS.map((root) => `<button type="button" data-search-root="${root}" aria-pressed="false">${ROOT_LABELS[root]}</button>`).join('')}
      </nav>
      <div class="wissenssuche-status" role="status">Wissen wird geladen …</div>
      <div class="wissenssuche-ergebnisse" data-search-results></div>
    </div>
  </div>`;

  const input = view.querySelector('#wissenssuche-input');
  const clear = view.querySelector('[data-search-clear]');
  const status = view.querySelector('.wissenssuche-status');
  const results = view.querySelector('[data-search-results]');
  let activeRoot = 'all';
  let items = [];
  const draw = () => {
    const query = input.value.trim();
    clear.hidden = !query;
    results.innerHTML = '';
    if (!query) {
      status.hidden = false;
      status.innerHTML = '<b>Dein gesammeltes Wissen an einem Ort.</b>';
      return;
    }
    const matches = filterKnowledgeItems(items, query, activeRoot);
    status.hidden = Boolean(matches.length);
    status.innerHTML = matches.length ? '' : '<b>Nichts gefunden.</b><span>Versuche einen anderen Begriff oder einen anderen Wissensbereich.</span>';
    results.innerHTML = groupedResultsMarkup(matches);
  };
  input.addEventListener('input', draw);
  clear.addEventListener('click', () => { input.value = ''; draw(); input.focus(); });
  view.querySelector('.wissenssuche-filter').addEventListener('click', (event) => {
    const button = event.target.closest('[data-search-root]');
    if (!button) return;
    activeRoot = button.dataset.searchRoot;
    view.querySelectorAll('[data-search-root]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('aktiv', active);
      item.setAttribute('aria-pressed', String(active));
    });
    draw();
  });

  try {
    const [entries, collections] = await Promise.all([
      loadAllDexEntries(null, signal),
      loadKnowledgeCollections(signal),
    ]);
    if (signal?.aborted) return;
    items = prepareItems(entries, collections);
    draw();
    requestAnimationFrame(() => input.focus({ preventScroll: true }));
  } catch (error) {
    if (signal?.aborted) return;
    console.warn('Wissenssuche konnte nicht geladen werden:', error.message);
    status.hidden = false;
    status.innerHTML = '<b>Suche konnte nicht geladen werden.</b><span>Bitte versuche es später erneut.</span>';
  }
}
