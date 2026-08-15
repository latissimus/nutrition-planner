import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { materialIconMarkup } from './categoryIcons.js';
import { subscribeToTableChanges } from './realtime.js';
import { playInterfaceSound } from './uiSounds.js';
import { bindLongPress } from './longPress.js';

const PERIODS = [
  ['breakfast', 'Frühstück'], ['snack_morning', 'Snack vormittags'],
  ['lunch', 'Mittagessen'], ['snack_afternoon', 'Snack nachmittags'], ['dinner', 'Abendessen'],
];
const BASE_FOODS = [
  ['Apfel', 52, 0.3, 11.4, 0.2], ['Banane', 89, 1.1, 20.0, 0.3],
  ['Orange', 47, 0.9, 8.3, 0.1], ['Kartoffel, gekocht', 77, 2.0, 15.0, 0.1],
  ['Reis, gekocht', 130, 2.7, 28.0, 0.3], ['Haferflocken', 372, 13.5, 58.7, 7.0],
  ['Hähnchenbrust', 110, 23.1, 0, 1.2], ['Ei', 137, 12.3, 1.5, 9.3],
  ['Magerquark', 67, 12.0, 4.0, 0.2], ['Lachs', 208, 20.4, 0, 13.4],
  ['Brokkoli', 34, 2.8, 4.0, 0.4], ['Avocado', 160, 2.0, 1.8, 14.7],
].map(([name, kcal, protein, carbs, fat]) => ({
  barcode: '', name, brand: 'Basislebensmittel', image_url: '', serving_g: 100,
  kcal_100g: kcal, protein_100g: protein, carbs_100g: carbs, fat_100g: fat, source: 'base_food',
}));
const GOALS = {
  lose: ['Langsam reduzieren', -300], maintain: ['Gewicht halten', 0],
  gain: ['Muskelaufbau', 200], gain_fast: ['Deutlich zunehmen', 350],
};
const PAL_LEVELS = [
  [1.4, 'Wenig aktiv · überwiegend sitzend'],
  [1.5, 'Leicht aktiv · Alltag + 1–2 Trainings'],
  [1.6, 'Moderat aktiv · 3–4 Trainings'],
  [1.8, 'Sehr aktiv · 5–6 Trainings'],
  [2.0, 'Extrem aktiv · körperliche Arbeit / täglich Sport'],
];

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const pad = (value) => String(value).padStart(2, '0');
export const localDateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dateFromKey = (key) => new Date(`${key}T12:00:00`);
const shiftedDate = (key, days) => { const date = dateFromKey(key); date.setDate(date.getDate() + days); return localDateKey(date); };
const number = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const rounded = (value) => Math.max(0, Math.round(Number(value) || 0));
const decimal = (value, digits = 0) => Number(value || 0).toLocaleString('de-DE', { maximumFractionDigits: digits });
const dateLabel = (key) => key === localDateKey() ? 'Heute' : dateFromKey(key).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

export function calculateEnergyNeed({ calculationBasis, birthDate, heightCm, weightKg, bodyFatPercent, pal, goal }) {
  const birth = birthDate ? dateFromKey(birthDate) : null;
  const today = new Date();
  let exactAge = birth ? today.getFullYear() - birth.getFullYear() : 0;
  if (birth && (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()))) exactAge -= 1;
  const age = exactAge >= 14 && exactAge <= 100 ? exactAge : 0;
  const weight = number(weightKg);
  const height = number(heightCm);
  const bodyFat = number(bodyFatPercent);
  const activity = number(pal) || 1.6;
  if (!weight || !height || !age) return null;
  const useCunningham = bodyFat >= 2 && bodyFat <= 65;
  const leanMass = useCunningham ? weight * (1 - bodyFat / 100) : null;
  const resting = useCunningham
    ? 500 + 22 * leanMass
    : 10 * weight + 6.25 * height - 5 * age + (calculationBasis === 'female' ? -161 : 5);
  const maintenance = resting * activity;
  const adjustment = GOALS[goal]?.[1] || 0;
  const target = Math.max(1200, maintenance + adjustment);
  const protein = weight * 1.8;
  const fat = weight * 0.8;
  const carbs = Math.max(0, (target - protein * 4 - fat * 9) / 4);
  return {
    method: useCunningham ? 'Cunningham' : 'Mifflin–St Jeor', age,
    resting: rounded(resting), maintenance: rounded(maintenance), target: rounded(target),
    protein: rounded(protein), carbs: rounded(carbs), fat: rounded(fat),
  };
}

function total(entries, field) { return entries.reduce((sum, item) => sum + number(item[field]), 0); }

async function loadNutrition(userId, date, signal) {
  let settingsQuery = supabase.from('nutrition_settings').select('*').eq('user_id', userId).maybeSingle();
  let logQuery = supabase.from('nutrition_log_entries').select('*').eq('user_id', userId).eq('log_date', date).order('created_at');
  let recentQuery = supabase.from('nutrition_log_entries').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(40);
  let ownQuery = supabase.from('nutrition_products').select('*').eq('user_id', userId).eq('source', 'manual').order('updated_at', { ascending: false }).limit(30);
  let weightQuery = supabase.from('weights').select('kg').eq('user_id', userId).order('gemessen_am', { ascending: false }).limit(1).maybeSingle();
  if (signal) {
    settingsQuery = settingsQuery.abortSignal(signal); logQuery = logQuery.abortSignal(signal);
    recentQuery = recentQuery.abortSignal(signal); ownQuery = ownQuery.abortSignal(signal); weightQuery = weightQuery.abortSignal(signal);
  }
  const [settings, entries, recent, own, weight] = await Promise.all([settingsQuery, logQuery, recentQuery, ownQuery, weightQuery]);
  const error = settings.error || entries.error || recent.error || own.error || weight.error;
  if (error) throw error;
  return {
    settings: settings.data || {}, entries: entries.data || [], recent: recent.data || [], ownProducts: own.data || [],
    latestWeight: number(weight.data?.kg),
  };
}

function nutritionTarget(state) {
  const settings = state.settings || {};
  const calculated = calculateEnergyNeed({
    calculationBasis: settings.calculation_basis,
    birthDate: settings.birth_date,
    heightCm: settings.height_cm,
    weightKg: state.latestWeight,
    bodyFatPercent: settings.body_fat_percent,
    pal: settings.pal,
    goal: settings.goal,
  });
  const customTarget = number(settings.custom_calorie_target);
  const target = customTarget || calculated?.target || 0;
  const adjusted = calculated && customTarget ? {
    ...calculated,
    target: rounded(customTarget),
    carbs: rounded(Math.max(0, (customTarget - calculated.protein * 4 - calculated.fat * 9) / 4)),
  } : calculated;
  return { calculated: adjusted, target };
}

function progress(value, target) { return target ? Math.min(100, Math.max(0, value / target * 100)) : 0; }
function nutritionEnabled(state) { return state.settings?.tracking_enabled !== false; }

function trackingToggleMarkup(enabled) {
  return `<label class="nutrition-tracking-toggle">
    <span><b>Kalorien zählen</b><small>Konkrete Mahlzeiten und Makros protokollieren</small></span>
    <input type="checkbox" data-nutrition-enabled${enabled ? ' checked' : ''}>
    <i class="nutrition-switch-track" aria-hidden="true"></i>
  </label>`;
}

function summaryMarkup(state, date) {
  const enabled = nutritionEnabled(state);
  if (!enabled) return `<section class="nutrition-card nutrition-card-compact" data-nutrition-card>
    <div class="nutrition-stripe"></div>${trackingToggleMarkup(false)}
  </section>`;
  const kcal = rounded(total(state.entries, 'energy_kcal'));
  const protein = rounded(total(state.entries, 'protein_g'));
  const carbs = rounded(total(state.entries, 'carbs_g'));
  const fat = rounded(total(state.entries, 'fat_g'));
  const { calculated, target } = nutritionTarget(state);
  const remaining = Math.max(0, target - kcal);
  const over = Math.max(0, kcal - target);
  return `<section class="nutrition-card" data-nutrition-card>
    <div class="nutrition-stripe"></div>
    ${trackingToggleMarkup(true)}
    <header class="nutrition-day-nav">
      <button type="button" data-nutrition-day="-1" aria-label="Vorheriger Tag">${materialIconMarkup('arrow_back_ios')}</button>
      <div><b>${dateLabel(date)}</b><small>${dateFromKey(date).toLocaleDateString('de-DE')}</small></div>
      <button type="button" data-nutrition-day="1" aria-label="Nächster Tag"${date >= localDateKey() ? ' disabled' : ''}>${materialIconMarkup('chevron_right')}</button>
    </header>
    <div class="nutrition-balance">
      <div><small>${target ? (over ? 'ÜBER ZIEL' : 'NOCH OFFEN') : 'HEUTE'}</small><strong>${target ? decimal(over || remaining) : decimal(kcal)} <i>kcal</i></strong></div>
      <div class="nutrition-ring" style="--nutrition-progress:${progress(kcal, target) * 3.6}deg"><span>${target ? `${decimal(kcal)}<small>von ${decimal(target)}</small>` : '—<small>Ziel fehlt</small>'}</span></div>
    </div>
    <div class="nutrition-macros">
      ${[['Protein', protein, calculated?.protein], ['Carbs', carbs, calculated?.carbs], ['Fett', fat, calculated?.fat]].map(([label, value, goal]) => `<div><span><b>${label}</b><small>${decimal(value)}${goal ? ` / ${decimal(goal)}` : ''} g</small></span><i><u style="width:${progress(value, goal)}%"></u></i></div>`).join('')}
    </div>
    <details class="nutrition-calculator">
      <summary>Kalorienbedarf berechnen ${materialIconMarkup('chevron_right', 'nutrition-chevron')}</summary>
      <form data-nutrition-settings-form>${calculatorMarkup(state, calculated)}</form>
    </details>
  </section>`;
}

function calculatorMarkup(state, result) {
  const value = (key, fallback = '') => escapeHtml(state.settings?.[key] ?? fallback);
  return `<p class="nutrition-calc-note">Automatisch Cunningham mit KFA, sonst Mifflin–St Jeor. Aktivität wird über den PAL-Faktor genau einmal berücksichtigt.</p>
    <div class="nutrition-calc-grid">
      <label><span>Berechnungsbasis</span><select class="input" data-calc-basis><option value="male"${value('calculation_basis', 'male') === 'male' ? ' selected' : ''}>Männlich</option><option value="female"${value('calculation_basis') === 'female' ? ' selected' : ''}>Weiblich</option></select></label>
      <label><span>Geburtsdatum</span><input class="input" type="date" data-calc-birth value="${value('birth_date')}"></label>
      <label><span>Größe</span><span class="nutrition-unit-field"><input class="input" type="text" inputmode="decimal" data-calc-height value="${value('height_cm')}" placeholder="180"><i>cm</i></span></label>
      <label><span>Gewicht</span><span class="nutrition-unit-field"><input class="input" type="text" inputmode="decimal" data-calc-weight value="${state.latestWeight || ''}" placeholder="80"><i>kg</i></span><small>Wird auch im KFA-LOG gespeichert.</small></label>
      <label><span>KFA <small>optional</small></span><span class="nutrition-unit-field"><input class="input" type="text" inputmode="decimal" data-calc-bodyfat value="${value('body_fat_percent')}" placeholder="12"><i>%</i></span></label>
      <label class="nutrition-wide"><span>Aktivität</span><select class="input" data-calc-pal>${PAL_LEVELS.map(([pal, label]) => `<option value="${pal}"${number(value('pal', 1.6)) === pal ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="nutrition-wide"><span>Ziel</span><select class="input" data-calc-goal>${Object.entries(GOALS).map(([key, [label, adjustment]]) => `<option value="${key}"${value('goal', 'maintain') === key ? ' selected' : ''}>${label}${adjustment ? ` · ${adjustment > 0 ? '+' : ''}${adjustment} kcal` : ''}</option>`).join('')}</select></label>
      <label class="nutrition-wide"><span>Eigenes Kalorienziel <small>optional</small></span><span class="nutrition-unit-field"><input class="input" type="text" inputmode="numeric" data-calc-custom value="${value('custom_calorie_target')}" placeholder="Automatisch"><i>kcal</i></span></label>
    </div>
    <div class="nutrition-calculation" data-nutrition-calculation>${calculationResultMarkup(result, number(state.settings?.custom_calorie_target))}</div>
    <button class="btn btn-primary btn-block" type="submit">Bedarf speichern</button>`;
}

function calculationResultMarkup(result, customTarget = 0) {
  return result ? `<span><small>GRUNDUMSATZ</small><b>${decimal(result.resting)} kcal</b></span><span><small>ERHALTUNG</small><b>${decimal(result.maintenance)} kcal</b></span><span><small>ZIEL</small><b>${decimal(customTarget || result.target)} kcal</b></span><p>${result.method} · Schätzung, keine Messung</p>` : '<p>Geburtsdatum, Größe und Gewicht vervollständigen.</p>';
}

function periodEntriesMarkup(entries) {
  if (!entries.length) return '';
  return `<section class="nutrition-period-inline">
    <header><span>GEGESSEN</span><b>${decimal(total(entries, 'energy_kcal'))} kcal</b></header>
    <div>${entries.map((item) => `<article class="nutrition-entry" data-nutrition-entry="${item.id}">
      <div><b>${escapeHtml(item.name)}</b><small>${decimal(item.amount, 1)} ${item.unit === 'portion' ? 'Portion' : 'g'} · ${decimal(item.protein_g, 1)} g P · ${decimal(item.carbs_g, 1)} g K · ${decimal(item.fat_g, 1)} g F</small></div>
      <strong>${decimal(item.energy_kcal)} kcal</strong>
      <button type="button" data-nutrition-delete aria-label="Eintrag löschen">×</button>
    </article>`).join('')}</div>
  </section>`;
}

function createOverlay(markup, className = '') {
  const backdrop = document.createElement('div');
  backdrop.className = `kategorie-sheet-backdrop nutrition-overlay ${className}`.trim();
  backdrop.innerHTML = `<section class="kategorie-sheet nutrition-sheet" role="dialog" aria-modal="true">${markup}</section>`;
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-nutrition-close]')) backdrop.remove();
  });
  document.body.append(backdrop);
  return backdrop;
}

function periodSelect(selected = 'breakfast') {
  return `<label class="nutrition-form-field"><span>Tageszeit</span><select class="input" data-log-period>${PERIODS.map(([key, label]) => `<option value="${key}"${selected === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label>`;
}

function gramOptions(selected = 100) {
  const current = Math.max(1, Math.round(number(selected) || 100));
  const values = new Set([current]);
  for (let grams = 5; grams <= 500; grams += 5) values.add(grams);
  for (let grams = 525; grams <= 1000; grams += 25) values.add(grams);
  return [...values].sort((a, b) => a - b)
    .map((grams) => `<option value="${grams}"${grams === current ? ' selected' : ''}>${grams} g</option>`).join('');
}

function manualEditor({ date, onSave, ownProducts = [] }) {
  const backdrop = createOverlay(`<header><h2>Eigene Mahlzeit</h2><button type="button" data-nutrition-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    ${ownProducts.length ? `<section class="nutrition-own-products"><h3>GESPEICHERTE MAHLZEITEN</h3><div>${ownProducts.map((product, index) => `<button type="button" data-own-product="${index}"><span><b>${escapeHtml(product.name)}</b><small>${decimal(product.kcal_100g)} kcal · ${decimal(product.protein_100g, 1)} P · ${decimal(product.carbs_100g, 1)} K · ${decimal(product.fat_100g, 1)} F</small></span>${materialIconMarkup('chevron_right')}</button>`).join('')}</div></section>` : ''}
    <form class="nutrition-form" data-manual-food-form>
      <label class="nutrition-form-field"><span>Name</span><input class="input" data-manual-name maxlength="160" placeholder="z. B. Protein-Porridge" required></label>
      ${periodSelect()}
      <p class="nutrition-form-hint">Nährwerte jeweils pro 100 g</p>
      <div class="nutrition-four-grid">
        <label><span>Kalorien</span><input class="input" data-manual-kcal type="text" inputmode="decimal" placeholder="250" required></label>
        <label><span>Kohlenhydrate</span><input class="input" data-manual-carbs type="text" inputmode="decimal" placeholder="0"></label>
        <label><span>Fett</span><input class="input" data-manual-fat type="text" inputmode="decimal" placeholder="0"></label>
        <label><span>Protein</span><input class="input" data-manual-protein type="text" inputmode="decimal" placeholder="0"></label>
      </div>
      <label class="nutrition-form-field"><span>Gegessene Menge</span><select class="input nutrition-gram-picker" data-manual-amount>${gramOptions(100)}</select></label>
      <div class="nutrition-product-result" data-manual-result></div>
      <button class="btn btn-primary btn-block" type="submit" data-no-interface-sound>Eintrag speichern</button>
    </form>`);
  backdrop.querySelectorAll('[data-own-product]').forEach((button) => {
    button.onclick = () => {
      const product = ownProducts[Number(button.dataset.ownProduct)];
      backdrop.remove();
      amountEditor({ product, date, onSave });
    };
  });
  const per100 = () => ({
    energy_kcal: number(backdrop.querySelector('[data-manual-kcal]').value),
    protein_g: number(backdrop.querySelector('[data-manual-protein]').value),
    carbs_g: number(backdrop.querySelector('[data-manual-carbs]').value),
    fat_g: number(backdrop.querySelector('[data-manual-fat]').value),
  });
  const scaled = () => {
    const factor = number(backdrop.querySelector('[data-manual-amount]').value) / 100;
    return Object.fromEntries(Object.entries(per100()).map(([key, value]) => [key, value * factor]));
  };
  const renderResult = () => {
    const value = scaled();
    backdrop.querySelector('[data-manual-result]').innerHTML = `<b>${decimal(value.energy_kcal)} kcal</b><span>${decimal(value.protein_g, 1)} P · ${decimal(value.carbs_g, 1)} K · ${decimal(value.fat_g, 1)} F</span>`;
  };
  backdrop.querySelectorAll('[data-manual-kcal],[data-manual-protein],[data-manual-carbs],[data-manual-fat],[data-manual-amount]').forEach((input) => { input.oninput = renderResult; });
  renderResult();
  backdrop.querySelector('form').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter; button.disabled = true;
    const name = backdrop.querySelector('[data-manual-name]').value.trim();
    const amount = number(backdrop.querySelector('[data-manual-amount]').value);
    const base = per100();
    const payload = {
      log_date: date, period: backdrop.querySelector('[data-log-period]').value,
      name, amount, unit: 'g', ...scaled(),
      product: { barcode: '', name, brand: 'Eigene Mahlzeit', image_url: '', serving_g: 100,
        kcal_100g: base.energy_kcal, protein_100g: base.protein_g,
        carbs_100g: base.carbs_g, fat_100g: base.fat_g, source: 'manual' },
    };
    if (!payload.name || !base.energy_kcal || !amount) { button.disabled = false; return toast('Name, Kalorien und Grammzahl eintragen'); }
    const saved = await onSave(payload);
    if (saved) backdrop.remove(); else button.disabled = false;
  };
}

function amountEditor({ product, date, onSave, entry = null }) {
  const serving = number(entry?.amount) || number(product.serving_g) || 100;
  const selectedPeriod = entry?.period || 'breakfast';
  const backdrop = createOverlay(`<header><h2>Lebensmittel eintragen</h2><button type="button" data-nutrition-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="nutrition-product-head">${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="">` : materialIconMarkup('fastfood')}<div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.brand || '')}</small><span>${decimal(product.kcal_100g)} kcal pro 100 g</span></div></div>
    <p class="nutrition-source">${product.source === 'manual' ? 'Eigene gespeicherte Mahlzeit' : product.source === 'base_food' ? 'Durchschnittlicher Basiswert' : 'Produktdaten: <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a>'} · Werte vor dem Speichern prüfen</p>
    <form class="nutrition-form" data-product-amount-form>${periodSelect(selectedPeriod)}
      <label class="nutrition-form-field"><span>Menge</span><select class="input nutrition-gram-picker" data-product-amount>${gramOptions(serving)}</select></label>
      <div class="nutrition-product-result" data-product-result></div>
      <button class="btn btn-primary btn-block" type="submit" data-no-interface-sound>${entry ? 'Änderungen speichern' : 'Eintrag speichern'}</button>
    </form>`);
  const amount = backdrop.querySelector('[data-product-amount]');
  const result = backdrop.querySelector('[data-product-result]');
  const values = () => {
    const factor = number(amount.value) / 100;
    return {
      energy_kcal: number(product.kcal_100g) * factor, protein_g: number(product.protein_100g) * factor,
      carbs_g: number(product.carbs_100g) * factor, fat_g: number(product.fat_100g) * factor,
    };
  };
  const render = () => { const data = values(); result.innerHTML = `<b>${decimal(data.energy_kcal)} kcal</b><span>${decimal(data.protein_g, 1)} P · ${decimal(data.carbs_g, 1)} K · ${decimal(data.fat_g, 1)} F</span>`; };
  amount.oninput = render; render();
  backdrop.querySelector('form').onsubmit = async (event) => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    const grams = number(amount.value); if (!grams) { button.disabled = false; return; }
    const saved = await onSave({
      id: entry?.id,
      product_id: entry?.product_id,
      log_date: date, period: backdrop.querySelector('[data-log-period]').value,
      name: product.name, amount: grams, unit: 'g', ...values(), product,
    });
    if (saved) backdrop.remove(); else button.disabled = false;
  };
}

async function productLookup(action, value) {
  const body = action === 'barcode' ? { action, barcode: value } : { action, query: value };
  const { data, error } = await supabase.functions.invoke('food-products', { body });
  const basis = action === 'search'
    ? BASE_FOODS.filter((product) => product.name.toLocaleLowerCase('de').includes(String(value).trim().toLocaleLowerCase('de')))
    : [];
  const mergeProducts = (products = []) => [...new Map([...basis, ...products].map((product) => [`${product.name.toLocaleLowerCase('de')}:${product.brand || ''}`, product])).values()].slice(0, 16);
  if (!error && data) return action === 'search' ? { ...data, products: mergeProducts(data.products) } : data;
  const fields = 'code,product_name,product_name_de,brands,image_front_small_url,image_front_url,serving_quantity,nutriments';
  const normalize = (product) => {
    const nutrients = product.nutriments || {};
    const kcal = number(nutrients['energy-kcal_100g']) || number(nutrients.energy_100g) / 4.184;
    return {
      barcode: String(product.code || '').replace(/\D/g, ''), name: product.product_name_de || product.product_name || '',
      brand: String(product.brands || '').split(',')[0], image_url: product.image_front_small_url || product.image_front_url || '',
      serving_g: number(product.serving_quantity), kcal_100g: kcal,
      protein_100g: number(nutrients.proteins_100g), carbs_100g: number(nutrients.carbohydrates_100g), fat_100g: number(nutrients.fat_100g), source: 'open_food_facts',
    };
  };
  if (action === 'barcode') {
    const response = await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(value)}?fields=${encodeURIComponent(fields)}`);
    const payload = await response.json(); const product = payload.product ? normalize(payload.product) : null;
    return { product: product?.name && product.kcal_100g ? product : null };
  }
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  Object.entries({ search_terms: value, search_simple: '1', action: 'process', json: '1', page_size: '12', fields }).forEach(([key, val]) => url.searchParams.set(key, val));
  const payload = await (await fetch(url)).json();
  return { products: mergeProducts((payload.products || []).map(normalize).filter((product) => product.name && product.kcal_100g)) };
}

function searchEditor({ date, onSave }) {
  const backdrop = createOverlay(`<header><h2>Lebensmittel suchen</h2><button type="button" data-nutrition-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <form class="nutrition-search-form"><input class="input" data-food-query placeholder="Produkt oder Marke" autocomplete="off"><button class="btn btn-primary" type="submit">Suchen</button></form>
    <div class="nutrition-search-results" data-food-results><p>Suche nach einem Basislebensmittel, Produkt oder einer Marke.</p></div>`);
  const results = backdrop.querySelector('[data-food-results]');
  let products = [];
  backdrop.querySelector('form').onsubmit = async (event) => {
    event.preventDefault(); const query = backdrop.querySelector('[data-food-query]').value.trim(); if (query.length < 2) return;
    results.innerHTML = '<p>Produkte werden gesucht …</p>';
    const streamingSound = playInterfaceSound('streaming', { loop: true, retrigger: 'restart' });
    try {
      products = (await productLookup('search', query)).products || [];
      results.innerHTML = products.length ? products.map((product, index) => `<button type="button" data-product-index="${index}">${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="" loading="${index < 4 ? 'eager' : 'lazy'}" decoding="async"${index < 2 ? ' fetchpriority="high"' : ''}>` : '<span></span>'}<div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.brand || '')}</small></div><strong>${decimal(product.kcal_100g)} kcal</strong></button>`).join('') : '<p>Kein passendes Produkt gefunden. Nutze „Eigene Mahlzeit“.</p>';
      results.querySelectorAll('img').forEach((image) => {
        const reveal = () => image.classList.add('ist-geladen');
        if (image.complete) reveal(); else image.addEventListener('load', reveal, { once: true });
      });
    } catch { results.innerHTML = '<p>Produktsuche gerade nicht erreichbar.</p>'; }
    finally { streamingSound?.stop?.(); }
  };
  results.onclick = (event) => {
    const index = event.target.closest('[data-product-index]')?.dataset.productIndex;
    if (index == null) return; const product = products[Number(index)]; backdrop.remove(); amountEditor({ product, date, onSave });
  };
  setTimeout(() => backdrop.querySelector('[data-food-query]')?.focus(), 120);
}

function recentEditor({ recent, date, onSave }) {
  const unique = [...new Map(recent.map((item) => [`${item.name}:${item.amount}:${item.unit}`, item])).values()].slice(0, 16);
  const backdrop = createOverlay(`<header><h2>Zuletzt verwendet</h2><button type="button" data-nutrition-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="nutrition-recent">${unique.length ? unique.map((item, index) => `<button type="button" data-recent-index="${index}"><span><b>${escapeHtml(item.name)}</b><small>${decimal(item.amount, 1)} ${item.unit === 'portion' ? 'Portion' : 'g'}</small></span><strong>${decimal(item.energy_kcal)} kcal</strong></button>`).join('') : '<p>Noch keine früheren Einträge.</p>'}</div>`);
  backdrop.querySelector('.nutrition-recent').onclick = async (event) => {
    const index = event.target.closest('[data-recent-index]')?.dataset.recentIndex; if (index == null) return;
    const old = unique[Number(index)];
    const saved = await onSave({ ...old, id: undefined, user_id: undefined, created_at: undefined, log_date: date, product: null });
    if (saved) backdrop.remove();
  };
}

async function barcodeResult(barcode, { date, onSave }, closeCurrent) {
  toast('Produkt wird gesucht …');
  try {
    const product = (await productLookup('barcode', barcode)).product;
    if (!product) return toast('Barcode nicht gefunden. Du kannst das Produkt manuell eintragen.');
    closeCurrent?.(); amountEditor({ product, date, onSave });
  } catch { toast('Produktdaten konnten nicht geladen werden.'); }
}

function scannerEditor(context) {
  const backdrop = createOverlay(`<header><h2>Barcode scannen</h2><button type="button" data-nutrition-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="nutrition-scanner"><video playsinline muted></video><span></span></div>
    <div class="nutrition-scanner-tools"><button type="button" data-scanner-torch hidden aria-pressed="false" aria-label="Kameralicht einschalten">${materialIconMarkup('light_mode')}<span>Kameralicht</span></button></div>
    <p class="nutrition-scanner-status" data-scanner-status>Kamera wird gestartet …</p>
    <p class="nutrition-calc-note nutrition-scanner-help">Barcode in den Rahmen halten. Die Kamera wird nur für die Erkennung verwendet.</p>
    <form class="nutrition-barcode-manual"><input class="input" inputmode="numeric" pattern="[0-9]*" placeholder="Barcode manuell eingeben"><button class="btn btn-primary" type="submit">Suchen</button></form>`);
  let controls = null; let stream = null; let detected = false;
  const stop = () => {
    controls?.stop?.();
    stream?.getTracks?.().forEach((track) => track.stop());
    backdrop.remove();
  };
  backdrop.querySelector('[data-nutrition-close]').onclick = stop;
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) stop(); });
  backdrop.querySelector('form').onsubmit = (event) => {
    event.preventDefault(); const barcode = event.currentTarget.querySelector('input').value.replace(/\D/g, '');
    if (barcode.length < 8) return toast('Bitte einen gültigen Barcode eingeben');
    stop(); barcodeResult(barcode, context);
  };
  import('@zxing/browser').then(async ({ BrowserMultiFormatReader }) => {
    if (!backdrop.isConnected) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera wird von diesem Browser nicht unterstützt');
    const video = backdrop.querySelector('video');
    const status = backdrop.querySelector('[data-scanner-status]');
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
    });
    video.srcObject = stream;
    await video.play();
    if (status) status.textContent = 'Scanner aktiv';
    const torch = backdrop.querySelector('[data-scanner-torch]');
    const track = stream.getVideoTracks()[0];
    if (BrowserMultiFormatReader.mediaStreamIsTorchCompatibleTrack(track)) {
      torch.hidden = false;
      torch.onclick = async (event) => {
        event.stopPropagation();
        const enabled = torch.getAttribute('aria-pressed') !== 'true';
        try {
          await BrowserMultiFormatReader.mediaStreamSetTorch(track, enabled);
          torch.setAttribute('aria-pressed', String(enabled));
          torch.setAttribute('aria-label', enabled ? 'Kameralicht ausschalten' : 'Kameralicht einschalten');
        } catch { toast('Die Taschenlampe konnte nicht geschaltet werden.'); }
      };
    }
    const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 80, delayBetweenScanSuccess: 350 });
    controls = await reader.decodeFromStream(stream, video, (result, _error, scannerControls) => {
      if (!result || detected) return; detected = true; scannerControls.stop();
      const barcode = result.getText();
      stream?.getTracks?.().forEach((track) => track.stop());
      backdrop.remove(); barcodeResult(barcode, context);
    });
  }).catch((error) => {
    backdrop.querySelector('[data-scanner-status]')?.replaceChildren(document.createTextNode('Kamera nicht verfügbar'));
    toast(error?.name === 'NotAllowedError' ? 'Kamerazugriff wurde nicht erlaubt.' : 'Kamera nicht verfügbar. Barcode bitte manuell eingeben.');
  });
}

function addMenu(context) {
  const backdrop = createOverlay(`<header><h2>Mahlzeit eintragen</h2><button type="button" data-nutrition-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="sheet-menue nutrition-add-menu">
      <button type="button" data-nutrition-action="scan">${materialIconMarkup('photo_camera')}<span><b>Barcode scannen</b><small>Verpacktes Produkt erkennen</small></span></button>
      <button type="button" data-nutrition-action="search">${materialIconMarkup('search')}<span><b>Lebensmittel suchen</b><small>Basislebensmittel und Produkte</small></span></button>
      <button type="button" data-nutrition-action="manual">${materialIconMarkup('edit')}<span><b>Eigene Mahlzeit</b><small>Kalorien und Makros selbst eintragen</small></span></button>
      <button type="button" data-nutrition-action="recent">${materialIconMarkup('calendar_meal')}<span><b>Zuletzt verwendet</b><small>Frühere Mahlzeit wiederholen</small></span></button>
    </div>`);
  backdrop.querySelector('.nutrition-add-menu').onclick = (event) => {
    const action = event.target.closest('[data-nutrition-action]')?.dataset.nutritionAction; if (!action) return;
    backdrop.remove();
    if (action === 'scan') scannerEditor(context);
    if (action === 'search') searchEditor(context);
    if (action === 'manual') manualEditor(context);
    if (action === 'recent') recentEditor(context);
  };
}

export async function mountNutrition(container, { userId, signal }) {
  let date = localDateKey();
  let automaticToday = true;
  let state = { settings: {}, entries: [], recent: [], ownProducts: [], latestWeight: 0 };
  const deleteEntry = async (button) => {
    const id = button.closest('[data-nutrition-entry]')?.dataset.nutritionEntry;
    if (!id || !confirm('Diesen Kalorieneintrag löschen?')) return;
    const { error } = await supabase.from('nutrition_log_entries').delete().eq('id', id).eq('user_id', userId);
    if (error) return toast('Eintrag konnte nicht gelöscht werden');
    await refresh();
  };
  const editEntry = (entry) => {
    const snapshot = entry?.product_snapshot || {};
    const amount = Math.max(1, number(entry?.amount));
    const product = {
      ...snapshot,
      name: snapshot.name || entry.name,
      serving_g: number(snapshot.serving_g) || 100,
      kcal_100g: number(snapshot.kcal_100g) || number(entry.energy_kcal) / amount * 100,
      protein_100g: number(snapshot.protein_100g) || number(entry.protein_g) / amount * 100,
      carbs_100g: number(snapshot.carbs_100g) || number(entry.carbs_g) / amount * 100,
      fat_100g: number(snapshot.fat_100g) || number(entry.fat_g) / amount * 100,
    };
    amountEditor({ product, date, onSave: saveEntry, entry });
  };
  const renderIntegrated = () => {
    const root = container.closest('.wrap') || container.parentElement;
    const enabled = nutritionEnabled(state);
    root?.querySelectorAll('[data-nutrition-period]').forEach((slot) => {
      const entries = enabled ? state.entries.filter((item) => item.period === slot.dataset.nutritionPeriod) : [];
      slot.innerHTML = periodEntriesMarkup(entries);
      slot.querySelectorAll('[data-nutrition-delete]').forEach((button) => { button.onclick = () => deleteEntry(button); });
      const block = slot.closest('.mahl-zeitblock');
      const count = block?.querySelector('[data-period-count]');
      const reminderCount = Number(count?.dataset.reminderCount || 0);
      if (count) count.textContent = String(reminderCount + entries.length);
      const empty = block?.querySelector('[data-reminder-empty]');
      if (empty) empty.hidden = entries.length > 0;
    });
  };
  const render = () => { container.innerHTML = summaryMarkup(state, date); bind(); renderIntegrated(); };
  const refresh = async () => { state = await loadNutrition(userId, date, signal); if (!signal?.aborted) render(); };
  const saveEntry = async (payload) => {
    try {
      let productId = payload.product_id || null;
      if (payload.product?.barcode) {
        const product = payload.product;
        const { data, error } = await supabase.from('nutrition_products').upsert({
          user_id: userId, barcode: product.barcode, name: product.name, brand: product.brand || null,
          image_url: product.image_url || null, serving_g: product.serving_g || null,
          kcal_100g: product.kcal_100g, protein_100g: product.protein_100g || 0,
          carbs_100g: product.carbs_100g || 0, fat_100g: product.fat_100g || 0,
          source: 'open_food_facts', source_snapshot: product,
        }, { onConflict: 'user_id,barcode' }).select('id').single();
        if (error) throw error; productId = data.id;
      } else if (payload.product?.source === 'manual') {
        const product = payload.product;
        const existing = await supabase.from('nutrition_products').select('id')
          .eq('user_id', userId).eq('source', 'manual').eq('name', product.name).limit(1).maybeSingle();
        if (existing.error) throw existing.error;
        const values = {
          user_id: userId, barcode: null, name: product.name, brand: 'Eigene Mahlzeit', image_url: null,
          serving_g: 100, kcal_100g: product.kcal_100g, protein_100g: product.protein_100g || 0,
          carbs_100g: product.carbs_100g || 0, fat_100g: product.fat_100g || 0,
          source: 'manual', source_snapshot: product,
        };
        const savedProduct = existing.data?.id
          ? await supabase.from('nutrition_products').update(values).eq('id', existing.data.id).eq('user_id', userId).select('id').single()
          : await supabase.from('nutrition_products').insert(values).select('id').single();
        if (savedProduct.error) throw savedProduct.error;
        productId = savedProduct.data.id;
      }
      const row = {
        user_id: userId, log_date: payload.log_date || date, period: payload.period || 'breakfast', product_id: productId,
        name: payload.name, amount: payload.amount || 1, unit: payload.unit || 'portion',
        energy_kcal: payload.energy_kcal || 0, protein_g: payload.protein_g || 0,
        carbs_g: payload.carbs_g || 0, fat_g: payload.fat_g || 0,
        product_snapshot: payload.product || payload.product_snapshot || {},
      };
      const request = payload.id
        ? supabase.from('nutrition_log_entries').update(row).eq('id', payload.id).eq('user_id', userId)
        : supabase.from('nutrition_log_entries').insert(row);
      const { error } = await request;
      if (error) throw error;
      playInterfaceSound('bonus', { retrigger: 'restart' });
      toast(payload.id ? 'Mahlzeit aktualisiert' : 'Kalorien eingetragen');
      await refresh(); return true;
    } catch (error) { toast(error.message || 'Eintrag konnte nicht gespeichert werden'); return false; }
  };
  function bind() {
    const trackingToggle = container.querySelector('[data-nutrition-enabled]');
    if (trackingToggle) trackingToggle.onchange = async () => {
      trackingToggle.disabled = true;
      const enabled = trackingToggle.checked;
      const { error } = await supabase.from('nutrition_settings').upsert({
        user_id: userId, tracking_enabled: enabled,
      }, { onConflict: 'user_id' });
      if (error) {
        trackingToggle.disabled = false;
        trackingToggle.checked = !enabled;
        return toast('Kalorienzählen konnte nicht umgestellt werden');
      }
      state.settings = { ...state.settings, tracking_enabled: enabled };
      render();
    };
    container.querySelectorAll('[data-nutrition-day]').forEach((button) => {
      button.onclick = async () => {
        date = shiftedDate(date, Number(button.dataset.nutritionDay));
        automaticToday = date === localDateKey();
        await refresh();
      };
    });
    const calculatorForm = container.querySelector('[data-nutrition-settings-form]');
    if (!calculatorForm) return;
    const updateCalculatorPreview = () => {
      const preview = calculateEnergyNeed({
        calculationBasis: calculatorForm.querySelector('[data-calc-basis]').value,
        birthDate: calculatorForm.querySelector('[data-calc-birth]').value,
        heightCm: calculatorForm.querySelector('[data-calc-height]').value,
        weightKg: calculatorForm.querySelector('[data-calc-weight]').value,
        bodyFatPercent: calculatorForm.querySelector('[data-calc-bodyfat]').value,
        pal: calculatorForm.querySelector('[data-calc-pal]').value,
        goal: calculatorForm.querySelector('[data-calc-goal]').value,
      });
      calculatorForm.querySelector('[data-nutrition-calculation]').innerHTML = calculationResultMarkup(preview, number(calculatorForm.querySelector('[data-calc-custom]').value));
    };
    calculatorForm.addEventListener('input', updateCalculatorPreview);
    calculatorForm.addEventListener('change', updateCalculatorPreview);
    calculatorForm.onsubmit = async (event) => {
      event.preventDefault(); const form = event.currentTarget; const submit = event.submitter; submit.disabled = true;
      const payload = {
        user_id: userId, calculation_basis: form.querySelector('[data-calc-basis]').value,
        birth_date: form.querySelector('[data-calc-birth]').value || null,
        height_cm: number(form.querySelector('[data-calc-height]').value) || null,
        body_fat_percent: number(form.querySelector('[data-calc-bodyfat]').value) || null,
        pal: number(form.querySelector('[data-calc-pal]').value) || 1.6,
        goal: form.querySelector('[data-calc-goal]').value,
        custom_calorie_target: rounded(number(form.querySelector('[data-calc-custom]').value)) || null,
      };
      const enteredWeight = number(form.querySelector('[data-calc-weight]').value);
      if (!payload.birth_date || !payload.height_cm || !enteredWeight) { submit.disabled = false; return toast('Geburtsdatum, Größe und Gewicht werden benötigt'); }
      if (payload.height_cm < 100 || payload.height_cm > 250 || enteredWeight <= 0 || enteredWeight >= 500) { submit.disabled = false; return toast('Größe oder Gewicht liegen außerhalb des gültigen Bereichs'); }
      if (payload.body_fat_percent && (payload.body_fat_percent < 2 || payload.body_fat_percent > 65)) { submit.disabled = false; return toast('Bitte einen KFA zwischen 2 und 65 % eintragen'); }
      if (payload.custom_calorie_target && (payload.custom_calorie_target < 800 || payload.custom_calorie_target > 10000)) { submit.disabled = false; return toast('Das eigene Kalorienziel muss zwischen 800 und 10.000 kcal liegen'); }
      const [settingsResult, weightResult] = await Promise.all([
        supabase.from('nutrition_settings').upsert(payload).select(),
        supabase.from('weights').upsert({ user_id: userId, gemessen_am: localDateKey(), kg: enteredWeight }, { onConflict: 'user_id,gemessen_am' }).select(),
      ]);
      if (settingsResult.error || weightResult.error) { submit.disabled = false; return toast('Bedarf konnte nicht gespeichert werden'); }
      toast('Kalorienbedarf gespeichert'); await refresh();
    };
  }
  container.innerHTML = '<section class="nutrition-card"><p class="nutrition-empty">Kalorien werden geladen …</p></section>';
  try { await refresh(); }
  catch (error) { container.innerHTML = `<section class="nutrition-card"><p class="nutrition-empty">Kalorien-Log konnte nicht geladen werden.<br><small>${escapeHtml(error.message)}</small></p></section>`; }
  subscribeToTableChanges({ table: 'nutrition_log_entries', signal, onChange: refresh });
  subscribeToTableChanges({ table: 'nutrition_settings', signal, onChange: refresh });
  bindLongPress(container.closest('.wrap') || container.parentElement, '[data-nutrition-entry]', (element) => {
    const entry = state.entries.find((item) => item.id === element.dataset.nutritionEntry);
    return entry ? () => editEntry(entry) : null;
  });
  const dayWatcher = setInterval(() => {
    const today = localDateKey();
    if (!automaticToday || date === today || signal?.aborted) return;
    date = today; refresh().catch(() => {});
  }, 60000);
  signal?.addEventListener('abort', () => clearInterval(dayWatcher), { once: true });
  return {
    isEnabled: () => nutritionEnabled(state),
    renderIntegrated,
    openAddMenu: () => addMenu({ date, recent: state.recent, ownProducts: state.ownProducts, onSave: saveEntry }),
  };
}
