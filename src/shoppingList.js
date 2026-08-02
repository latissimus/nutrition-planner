import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { iconMarkup } from './icons.js';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// Uebernommen aus der Apple-Reminders-Einkaufsliste des Nutzers (Stand
// 02.08.2026, PDF-Export "EINKAUF 139" – 139 offene + 2 bereits abgehakte
// Eintraege = 141 gesamt, deckungsgleich mit der Anzahl hier). Reihenfolge,
// Abteilungen und Schreibweisen sind 1:1 aus der Vorlage uebernommen, auch wo
// sie uneinheitlich sind ("Mozarella", "Prastrami", "Glutenfreie Traps") –
// es ist die eigene Liste des Nutzers, keine Rechtschreibkorrektur. Leere
// Abteilungen aus der Vorlage (z. B. "Tiefkühlkost", "Konserven und Suppen")
// sind nicht mit aufgenommen; eine leere Gruppe haette in einer Checkliste
// keine Funktion.
export const DEFAULT_ITEMS = [
  // Obst und Gemüse
  { section: 'Obst und Gemüse', name: 'Gurke' },
  { section: 'Obst und Gemüse', name: 'Paprika' },
  { section: 'Obst und Gemüse', name: 'Brokkoli' },
  { section: 'Obst und Gemüse', name: 'Spinat' },
  { section: 'Obst und Gemüse', name: 'Zucchini' },
  { section: 'Obst und Gemüse', name: 'Rucola' },
  { section: 'Obst und Gemüse', name: 'Kohlrabi' },
  { section: 'Obst und Gemüse', name: 'Blumenkohl' },
  { section: 'Obst und Gemüse', name: 'Bohnen' },
  { section: 'Obst und Gemüse', name: 'Pilze' },
  { section: 'Obst und Gemüse', name: 'Zwiebeln' },
  { section: 'Obst und Gemüse', name: 'Feldsalat' },
  { section: 'Obst und Gemüse', name: 'Erbsen' },
  { section: 'Obst und Gemüse', name: 'Edamame', tags: ['Omega6'] },
  { section: 'Obst und Gemüse', name: 'Salat' },
  { section: 'Obst und Gemüse', name: 'Mais' },
  { section: 'Obst und Gemüse', name: 'Sauerkraut', tags: ['Fermentiert', 'Darm'] },
  { section: 'Obst und Gemüse', name: 'Tomaten' },
  { section: 'Obst und Gemüse', name: 'Passierte Tomaten' },
  { section: 'Obst und Gemüse', name: 'Blaubeeren' },
  { section: 'Obst und Gemüse', name: 'Bananen' },
  { section: 'Obst und Gemüse', name: 'Zitronen' },
  { section: 'Obst und Gemüse', name: 'Erdbeeren' },
  { section: 'Obst und Gemüse', name: 'Birnen' },
  { section: 'Obst und Gemüse', name: 'Äpfel' },
  { section: 'Obst und Gemüse', name: 'Himbeeren' },
  { section: 'Obst und Gemüse', name: 'Avocado' },
  { section: 'Obst und Gemüse', name: 'Honigmelone' },
  { section: 'Obst und Gemüse', name: 'Linsen' },
  { section: 'Obst und Gemüse', name: 'Süßkartoffeln' },
  { section: 'Obst und Gemüse', name: 'Kartoffeln' },
  { section: 'Obst und Gemüse', name: 'Kimchi', tags: ['Darm', 'Fermentiert'] },
  { section: 'Obst und Gemüse', name: 'Knoblauch' },
  { section: 'Obst und Gemüse', name: 'TK-Beeren Mix' },
  { section: 'Obst und Gemüse', name: 'Saure Gurken' },
  { section: 'Obst und Gemüse', name: 'Kichererbsen' },
  { section: 'Obst und Gemüse', name: 'Ingwerknolle' },
  { section: 'Obst und Gemüse', name: 'Rote Beete Saft' },
  { section: 'Obst und Gemüse', name: 'TK-Gemüse' },

  // Kräuter und Gewürze
  { section: 'Kräuter und Gewürze', name: 'Rosa Salz' },
  { section: 'Kräuter und Gewürze', name: 'Pfeffer' },
  { section: 'Kräuter und Gewürze', name: 'Zimt' },
  { section: 'Kräuter und Gewürze', name: 'Paprikapulver' },
  { section: 'Kräuter und Gewürze', name: 'Curry' },
  { section: 'Kräuter und Gewürze', name: 'Petersilie' },
  { section: 'Kräuter und Gewürze', name: 'Dill' },
  { section: 'Kräuter und Gewürze', name: 'Basilikum' },
  { section: 'Kräuter und Gewürze', name: 'Schnittlauch' },

  // Soßen und Aufstriche
  { section: 'Soßen und Aufstriche', name: 'Sojasoße fermentiert', tags: ['Fermentiert', 'Darm'] },
  { section: 'Soßen und Aufstriche', name: 'Miso', tags: ['Fermentiert', 'Darm'] },
  { section: 'Soßen und Aufstriche', name: 'Passierte Tomaten' },
  { section: 'Soßen und Aufstriche', name: 'Tomatenmark' },
  { section: 'Soßen und Aufstriche', name: 'Worcestersauce' },
  { section: 'Soßen und Aufstriche', name: 'Gehackte Tomaten' },

  // Snacks, Nüsse, Kerne
  { section: 'Snacks, Nüsse, Kerne', name: 'Erdnuss-, Haselnuss-, Mandelbutter' },
  { section: 'Snacks, Nüsse, Kerne', name: 'Mandel' },
  { section: 'Snacks, Nüsse, Kerne', name: 'Leinsamen', tags: ['Omega3'] },
  { section: 'Snacks, Nüsse, Kerne', name: 'Haselnüsse' },
  { section: 'Snacks, Nüsse, Kerne', name: 'Sonnenblumenkerne', tags: ['Omega6'] },
  { section: 'Snacks, Nüsse, Kerne', name: 'Kürbiskerne' },
  { section: 'Snacks, Nüsse, Kerne', name: 'Walnüsse', tags: ['Omega6', 'Omega3'] },
  { section: 'Snacks, Nüsse, Kerne', name: 'Chiasamen', tags: ['Omega3'] },
  { section: 'Snacks, Nüsse, Kerne', name: 'Cashews ODER' },
  { section: 'Snacks, Nüsse, Kerne', name: 'Nussmischung' },
  { section: 'Snacks, Nüsse, Kerne', name: 'Dunkle Schokolade' },
  { section: 'Snacks, Nüsse, Kerne', name: 'Pinienkerne' },
  { section: 'Snacks, Nüsse, Kerne', name: 'Pekannüsse' },
  { section: 'Snacks, Nüsse, Kerne', name: 'Flohsamenschalen' },

  // Fleisch
  { section: 'Fleisch', name: 'Rinderhackfleisch' },
  { section: 'Fleisch', name: 'Landjäger' },
  { section: 'Fleisch', name: 'Frankfurter Wurst' },
  { section: 'Fleisch', name: 'Pute ODER' },
  { section: 'Fleisch', name: 'Hähnchen' },
  { section: 'Fleisch', name: 'Frühstücksfleisch' },
  { section: 'Fleisch', name: 'Corned Beef' },
  { section: 'Fleisch', name: 'Trockenfleisch' },
  { section: 'Fleisch', name: 'Prastrami' },
  { section: 'Fleisch', name: 'Putenbrustaufschnitt' },
  { section: 'Fleisch', name: 'Steak' },

  // Fisch
  { section: 'Fisch', name: 'Thunfisch' },
  { section: 'Fisch', name: 'TK-Lachs' },
  { section: 'Fisch', name: 'Stremellachs', tags: ['Omega3'] },
  { section: 'Fisch', name: 'Garnelen' },
  { section: 'Fisch', name: 'Schlemmerfilet' },
  { section: 'Fisch', name: 'Brathering' },

  // Milchprodukte, Eier und Käse
  { section: 'Milchprodukte, Eier und Käse', name: 'Eier', tags: ['Omega6'] },
  { section: 'Milchprodukte, Eier und Käse', name: 'Gouda' },
  { section: 'Milchprodukte, Eier und Käse', name: 'Parmesan' },
  { section: 'Milchprodukte, Eier und Käse', name: 'Emmentaler' },
  { section: 'Milchprodukte, Eier und Käse', name: 'Feta' },
  { section: 'Milchprodukte, Eier und Käse', name: 'Hüttenkäse', tags: ['Darm', 'Fermentiert'] },
  { section: 'Milchprodukte, Eier und Käse', name: 'Quark, 20%' },
  { section: 'Milchprodukte, Eier und Käse', name: 'Joghurt 3,5%', tags: ['Darm', 'Fermentiert'] },
  { section: 'Milchprodukte, Eier und Käse', name: 'Irische Butter', tags: ['Omega3'] },
  { section: 'Milchprodukte, Eier und Käse', name: 'Mozarella' },
  { section: 'Milchprodukte, Eier und Käse', name: 'Cheddar', tags: ['Fermentiert', 'Darm'] },
  { section: 'Milchprodukte, Eier und Käse', name: 'Magerquark' },
  { section: 'Milchprodukte, Eier und Käse', name: 'Sahne' },
  { section: 'Milchprodukte, Eier und Käse', name: 'Milch 1,5%' },
  { section: 'Milchprodukte, Eier und Käse', name: 'Kefir' },

  // Öle und Dressings
  { section: 'Öle und Dressings', name: 'Olivenöl' },
  { section: 'Öle und Dressings', name: 'Avocadoöl' },
  { section: 'Öle und Dressings', name: 'Leinöl' },
  { section: 'Öle und Dressings', name: 'Sesamöl' },
  { section: 'Öle und Dressings', name: 'Walnussöl' },
  { section: 'Öle und Dressings', name: 'Essig' },
  { section: 'Öle und Dressings', name: 'Honig' },
  { section: 'Öle und Dressings', name: 'Ahornsirup' },

  // Carbs
  { section: 'Carbs', name: 'Glutenfreies Brot' },
  { section: 'Carbs', name: 'Haferflocken (fein)' },
  { section: 'Carbs', name: 'Reis' },
  { section: 'Carbs', name: 'Glutenfreie Traps' },
  { section: 'Carbs', name: 'Quinoa' },
  { section: 'Carbs', name: 'Hirse' },
  { section: 'Carbs', name: 'Reis/Maiswaffeln' },

  // Tierbedarf
  { section: 'Tierbedarf', name: 'Nassfutter' },
  { section: 'Tierbedarf', name: 'Trockenfutter' },
  { section: 'Tierbedarf', name: 'Streu' },
  { section: 'Tierbedarf', name: 'Leckerlies' },

  // Haushalt
  { section: 'Haushalt', name: 'Geschirrspülmittel' },
  { section: 'Haushalt', name: 'Spülmachinentabs' },
  { section: 'Haushalt', name: 'Klopapier' },
  { section: 'Haushalt', name: 'Küchenpapier' },
  { section: 'Haushalt', name: 'Essigreiniger' },
  { section: 'Haushalt', name: 'Haarspray' },

  // Sonstiges
  { section: 'Sonstiges', name: 'Limettensaft' },
  { section: 'Sonstiges', name: 'Glutenfreie Nudeln' },
  { section: 'Sonstiges', name: 'Espressobohnen' },
  { section: 'Sonstiges', name: 'Ketchup' },
  { section: 'Sonstiges', name: 'Senf' },
  { section: 'Sonstiges', name: 'Essiggurken', tags: ['Darm', 'Fermentiert'] },
  { section: 'Sonstiges', name: 'Vanillepuddingpulver' },
  { section: 'Sonstiges', name: 'Meerrettich' },
  { section: 'Sonstiges', name: 'Orangensaft' },

  // Supplements – die Notiz traegt die Dosierung aus der Vorlage, verbatim.
  { section: 'Supplements', name: 'MagnesiumKomplex', note: 'F: 3-4 vs; J. 2 vs' },
  { section: 'Supplements', name: 'MultiKomplex', note: 'F: 3x2; J: 3x1' },
  { section: 'Supplements', name: 'Chlorellas', note: 'F: 3x5; J: 3x3' },
  { section: 'Supplements', name: 'Vitamin D', note: '5-10 Tropfen F' },
  { section: 'Supplements', name: 'Kollagen Komplex', note: '1 F' },
  { section: 'Supplements', name: 'Curcumin', note: 'Bis 3x4' },
  { section: 'Supplements', name: 'Hagebuttenpulver (Galaktolipide)', note: '2 Teel. F' },
];

// Katalog-Reihenfolge der Abteilungen: Erstauftreten in DEFAULT_ITEMS. Damit
// zeigt das Abteilungs-Auswahlfeld beim Hinzufuegen dieselbe Reihenfolge wie
// die Vorlage, unabhaengig davon, was der Nutzer inzwischen abgehakt hat.
export const KNOWN_SECTIONS = [...new Set(DEFAULT_ITEMS.map((item) => item.section))];

const SELECT_COLUMNS = 'id,section,name,note,tags,checked,position';

async function loadItems(userId, signal) {
  let query = supabase.from('shopping_items').select(SELECT_COLUMNS)
    .eq('user_id', userId).order('position', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function ensureDefaults(userId, signal) {
  const current = await loadItems(userId, signal);
  if (current.length) return current;
  const payloads = DEFAULT_ITEMS.map((item) => ({
    user_id: userId,
    section: item.section,
    name: item.name,
    note: item.note || null,
    tags: item.tags || [],
    checked: false,
  }));
  let query = supabase.from('shopping_items')
    .upsert(payloads, { onConflict: 'user_id,section,name' })
    .select(SELECT_COLUMNS);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).sort((a, b) => a.position - b.position);
}

// Gruppiert nach Abteilung, in der Reihenfolge des ersten Auftretens –
// dieselbe Postgres-position-Sortierung traegt beide: neue Positionen landen
// am Ende ihrer Abteilung, neue Abteilungen als eigene Gruppe am Ende.
export function groupBySection(items) {
  const groups = new Map();
  items.forEach((item) => {
    const key = item.section || 'Sonstiges';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return [...groups.entries()];
}

async function toggleItem(userId, id, checked) {
  const { error } = await supabase.from('shopping_items').update({ checked }).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

async function resetChecked(userId) {
  const { error } = await supabase.from('shopping_items').update({ checked: false })
    .eq('user_id', userId).eq('checked', true);
  if (error) throw error;
}

async function addItem(userId, name, section) {
  const cleanName = name.trim();
  if (!cleanName) return null;
  const cleanSection = (section || '').trim() || 'Sonstiges';
  const { data, error } = await supabase.from('shopping_items')
    .insert({ user_id: userId, section: cleanSection, name: cleanName })
    .select(SELECT_COLUMNS).single();
  if (error) {
    // 23505 = unique_violation: derselbe Artikel steht in derselben
    // Abteilung schon auf der Liste – kein Fehler, sondern ein Hinweis.
    if (error.code === '23505') { toast(`„${cleanName}“ steht schon auf der Liste.`); return null; }
    throw error;
  }
  return data;
}

async function deleteItem(userId, id) {
  const { error } = await supabase.from('shopping_items').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

function itemRow(item) {
  const tags = (item.tags || []).map((tag) => `<span class="einkauf-tag">#${escapeHtml(tag)}</span>`).join('');
  return `<label class="einkauf-row${item.checked ? ' ist-abgehakt' : ''}" data-item-id="${item.id}">
    <input type="checkbox" data-item-check ${item.checked ? 'checked' : ''}>
    <span class="einkauf-row-text">
      <span class="einkauf-row-name">${escapeHtml(item.name)}</span>
      ${item.note ? `<small class="einkauf-row-note">${escapeHtml(item.note)}</small>` : ''}
      ${tags ? `<span class="einkauf-row-tags">${tags}</span>` : ''}
    </span>
    <button class="einkauf-row-loeschen" type="button" data-item-delete aria-label="${escapeHtml(item.name)} entfernen">${iconMarkup('trash')}</button>
  </label>`;
}

function sectionGroup(section, items) {
  const offen = items.filter((item) => item.checked).length;
  return `<details class="reminder-group einkauf-gruppe" data-section="${escapeHtml(section)}" open>
    <summary class="reminder-group-head">
      <span class="reminder-group-icon" aria-hidden="true">${iconMarkup('folder')}</span>
      <span><b>${escapeHtml(section)}</b></span>
      <em>${offen}/${items.length}</em>
      <span class="reminder-group-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div class="reminder-group-list einkauf-liste">${items.map(itemRow).join('')}</div>
  </details>`;
}

function renderList(container, items) {
  const slot = container.querySelector('[data-einkauf-liste]');
  if (!slot) return;
  if (!items.length) {
    slot.innerHTML = `<div class="tuck-leer">${iconMarkup('folder')}<b>Noch nichts auf der Liste</b><span>Trag oben deinen ersten Artikel ein.</span></div>`;
  } else {
    slot.innerHTML = groupBySection(items).map(([section, gruppe]) => sectionGroup(section, gruppe)).join('');
  }
  const checkedCount = items.filter((item) => item.checked).length;
  const status = container.querySelector('[data-einkauf-status]');
  if (status) status.textContent = `${checkedCount} von ${items.length} abgehakt`;
  const reset = container.querySelector('[data-reset-all]');
  if (reset) reset.hidden = checkedCount === 0;
}

function befuelleAbteilungen(container, items) {
  const select = container.querySelector('[data-new-section]');
  if (!select) return;
  const vorherigeWahl = select.value;
  const bekannt = [...new Set([...KNOWN_SECTIONS, ...items.map((item) => item.section)])];
  select.innerHTML = bekannt.map((section) => `<option value="${escapeHtml(section)}">${escapeHtml(section)}</option>`).join('');
  select.value = bekannt.includes(vorherigeWahl) ? vorherigeWahl : 'Sonstiges';
}

export async function mountShoppingList(container, { session, signal }) {
  const userId = session.user.id;
  container.innerHTML = `
    <div class="wrap pad-bottom">
      <div class="seitenkopf">
        <div class="seitenkopf-text">
          <span class="seitenkopf-kicker">Einkaufsliste</span>
          <h1 class="section-title">Einkauf</h1>
        </div>
        <a class="zurueck" href="#home"><span class="pf">←</span> Übersicht</a>
      </div>
      <section class="seiten-einstieg">
        <b>Antippen zum Abhaken</b>
        <span>Unten neue Artikel ergänzen, nach Abteilung sortiert.</span>
      </section>
      <form class="einkauf-formular" data-add-form>
        <input class="input" type="text" data-new-name maxlength="120" placeholder="Neuer Artikel, z. B. Hafermilch" autocomplete="off" required>
        <div class="einkauf-formular-zeile">
          <select class="input" data-new-section aria-label="Abteilung"></select>
          <button class="btn btn-primary" type="submit">Hinzufügen</button>
        </div>
      </form>
      <div class="einkauf-kopfzeile">
        <span data-einkauf-status role="status" aria-live="polite">Wird geladen …</span>
        <button class="einkauf-reset" type="button" data-reset-all hidden>Häkchen zurücksetzen</button>
      </div>
      <div data-einkauf-liste><div class="daten-laden" role="status">Einkaufsliste wird geladen …</div></div>
    </div>`;

  befuelleAbteilungen(container, []);

  let items = [];
  try {
    items = await ensureDefaults(userId, signal);
    if (signal?.aborted) return;
    renderList(container, items);
    befuelleAbteilungen(container, items);
  } catch (error) {
    if (signal?.aborted) return;
    const slot = container.querySelector('[data-einkauf-liste]');
    if (slot) slot.innerHTML = `<div class="msg err">Einkaufsliste konnte nicht geladen werden: ${escapeHtml(error.message || 'Unbekannter Fehler')}</div>`;
    return;
  }

  const liste = container.querySelector('[data-einkauf-liste]');
  liste.addEventListener('change', async (event) => {
    const checkbox = event.target.closest('[data-item-check]');
    if (!checkbox) return;
    const row = checkbox.closest('[data-item-id]');
    const id = row.dataset.itemId;
    const item = items.find((eintrag) => eintrag.id === id);
    if (!item) return;
    const zuvor = item.checked;
    item.checked = checkbox.checked;
    row.classList.toggle('ist-abgehakt', item.checked);
    try {
      await toggleItem(userId, id, item.checked);
      renderList(container, items);
    } catch (error) {
      item.checked = zuvor;
      checkbox.checked = zuvor;
      row.classList.toggle('ist-abgehakt', zuvor);
      toast('Änderung konnte nicht gespeichert werden.');
    }
  });

  liste.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-item-delete]');
    if (!button) return;
    const row = button.closest('[data-item-id]');
    const id = row.dataset.itemId;
    const item = items.find((eintrag) => eintrag.id === id);
    if (!item || !confirm(`„${item.name}“ von der Liste entfernen?`)) return;
    try {
      await deleteItem(userId, id);
      items = items.filter((eintrag) => eintrag.id !== id);
      renderList(container, items);
      befuelleAbteilungen(container, items);
      toast(`„${item.name}“ entfernt.`);
    } catch (error) {
      toast('Löschen fehlgeschlagen.');
    }
  });

  container.querySelector('[data-add-form]').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const nameFeld = form.querySelector('[data-new-name]');
    const sectionFeld = form.querySelector('[data-new-section]');
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const neu = await addItem(userId, nameFeld.value, sectionFeld.value);
      if (neu) {
        items.push(neu);
        renderList(container, items);
        befuelleAbteilungen(container, items);
        nameFeld.value = '';
        toast(`„${neu.name}“ hinzugefügt.`);
      }
    } catch (error) {
      toast('Artikel konnte nicht gespeichert werden.');
    } finally {
      submit.disabled = false;
      nameFeld.focus();
    }
  };

  container.querySelector('[data-reset-all]').onclick = async () => {
    const button = container.querySelector('[data-reset-all]');
    button.disabled = true;
    try {
      await resetChecked(userId);
      items.forEach((item) => { item.checked = false; });
      renderList(container, items);
      toast('Alle Häkchen zurückgesetzt.');
    } catch (error) {
      toast('Zurücksetzen fehlgeschlagen.');
    } finally {
      button.disabled = false;
    }
  };
}
