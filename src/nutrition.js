import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { materialIconMarkup } from './categoryIcons.js';
import { subscribeToTableChanges } from './realtime.js';
import { playInterfaceSound } from './uiSounds.js';

const PERIODS = [
  ['morning', 'Morgens'], ['midday', 'Mittags'], ['evening', 'Abends'],
];
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
  let weightQuery = supabase.from('weights').select('kg').eq('user_id', userId).order('gemessen_am', { ascending: false }).limit(1).maybeSingle();
  if (signal) {
    settingsQuery = settingsQuery.abortSignal(signal); logQuery = logQuery.abortSignal(signal);
    recentQuery = recentQuery.abortSignal(signal); weightQuery = weightQuery.abortSignal(signal);
  }
  const [settings, entries, recent, weight] = await Promise.all([settingsQuery, logQuery, recentQuery, weightQuery]);
  const error = settings.error || entries.error || recent.error || weight.error;
  if (error) throw error;
  return {
    settings: settings.data || {}, entries: entries.data || [], recent: recent.data || [],
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

function summaryMarkup(state, date) {
  const kcal = rounded(total(state.entries, 'energy_kcal'));
  const protein = rounded(total(state.entries, 'protein_g'));
  const carbs = rounded(total(state.entries, 'carbs_g'));
  const fat = rounded(total(state.entries, 'fat_g'));
  const { calculated, target } = nutritionTarget(state);
  const remaining = Math.max(0, target - kcal);
  const over = Math.max(0, kcal - target);
  return `<section class="nutrition-card" data-nutrition-card>
    <div class="nutrition-stripe"></div>
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
    <div class="nutrition-log">${logMarkup(state.entries)}</div>
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

function logMarkup(entries) {
  if (!entries.length) return '<p class="nutrition-empty">Heute noch nichts eingetragen.</p>';
  return PERIODS.map(([period, label]) => {
    const rows = entries.filter((item) => item.period === period);
    if (!rows.length) return '';
    return `<section class="nutrition-period"><header><h3>${label}</h3><span>${decimal(total(rows, 'energy_kcal'))} kcal</span></header><div>${rows.map((item) => `<article class="nutrition-entry" data-nutrition-entry="${item.id}"><div><b>${escapeHtml(item.name)}</b><small>${decimal(item.amount, 1)} ${item.unit === 'portion' ? 'Portion' : 'g'} · ${decimal(item.protein_g, 1)} g Protein</small></div><strong>${decimal(item.energy_kcal)} kcal</strong><button type="button" data-nutrition-delete aria-label="Eintrag löschen">×</button></article>`).join('')}</div></section>`;
  }).join('');
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

function periodSelect(selected = 'morning') {
  return `<label class="nutrition-form-field"><span>Tageszeit</span><select class="input" data-log-period>${PERIODS.map(([key, label]) => `<option value="${key}"${selected === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label>`;
}

function manualEditor({ date, onSave }) {
  const backdrop = createOverlay(`<header><h2>Eigene Mahlzeit</h2><button type="button" data-nutrition-close aria-label="Schließen">×</button></header>
    <form class="nutrition-form" data-manual-food-form>
      <label class="nutrition-form-field"><span>Name</span><input class="input" data-manual-name maxlength="160" placeholder="z. B. Frühstück" required></label>
      ${periodSelect()}
      <div class="nutrition-four-grid">
        <label><span>Kalorien</span><input class="input" data-manual-kcal type="text" inputmode="decimal" placeholder="500" required></label>
        <label><span>Protein</span><input class="input" data-manual-protein type="text" inputmode="decimal" placeholder="0"></label>
        <label><span>Carbs</span><input class="input" data-manual-carbs type="text" inputmode="decimal" placeholder="0"></label>
        <label><span>Fett</span><input class="input" data-manual-fat type="text" inputmode="decimal" placeholder="0"></label>
      </div>
      <button class="btn btn-primary btn-block" type="submit" data-no-interface-sound>Eintrag speichern</button>
    </form>`);
  backdrop.querySelector('form').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter; button.disabled = true;
    const payload = {
      log_date: date, period: backdrop.querySelector('[data-log-period]').value,
      name: backdrop.querySelector('[data-manual-name]').value.trim(), amount: 1, unit: 'portion',
      energy_kcal: number(backdrop.querySelector('[data-manual-kcal]').value),
      protein_g: number(backdrop.querySelector('[data-manual-protein]').value),
      carbs_g: number(backdrop.querySelector('[data-manual-carbs]').value),
      fat_g: number(backdrop.querySelector('[data-manual-fat]').value), product_snapshot: { source: 'manual' },
    };
    if (!payload.name || !payload.energy_kcal) { button.disabled = false; return toast('Name und Kalorien eintragen'); }
    const saved = await onSave(payload);
    if (saved) backdrop.remove(); else button.disabled = false;
  };
}

function amountEditor({ product, date, onSave }) {
  const serving = number(product.serving_g) || 100;
  const backdrop = createOverlay(`<header><h2>Lebensmittel eintragen</h2><button type="button" data-nutrition-close aria-label="Schließen">×</button></header>
    <div class="nutrition-product-head">${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="">` : materialIconMarkup('fastfood')}<div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.brand || '')}</small><span>${decimal(product.kcal_100g)} kcal pro 100 g</span></div></div>
    <p class="nutrition-source">Produktdaten: <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a> · Werte vor dem Speichern prüfen</p>
    <form class="nutrition-form" data-product-amount-form>${periodSelect()}
      <label class="nutrition-form-field"><span>Menge</span><span class="nutrition-unit-field"><input class="input" data-product-amount type="text" inputmode="decimal" value="${decimal(serving, 1)}" required><i>g</i></span></label>
      <div class="nutrition-product-result" data-product-result></div>
      <button class="btn btn-primary btn-block" type="submit" data-no-interface-sound>Eintrag speichern</button>
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
  const render = () => { const data = values(); result.innerHTML = `<b>${decimal(data.energy_kcal)} kcal</b><span>${decimal(data.protein_g, 1)} P · ${decimal(data.carbs_g, 1)} C · ${decimal(data.fat_g, 1)} F</span>`; };
  amount.oninput = render; render();
  backdrop.querySelector('form').onsubmit = async (event) => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    const grams = number(amount.value); if (!grams) { button.disabled = false; return; }
    const saved = await onSave({
      log_date: date, period: backdrop.querySelector('[data-log-period]').value,
      name: product.name, amount: grams, unit: 'g', ...values(), product,
    });
    if (saved) backdrop.remove(); else button.disabled = false;
  };
}

async function productLookup(action, value) {
  const body = action === 'barcode' ? { action, barcode: value } : { action, query: value };
  const { data, error } = await supabase.functions.invoke('food-products', { body });
  if (!error && data) return data;
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
  return { products: (payload.products || []).map(normalize).filter((product) => product.name && product.kcal_100g) };
}

function searchEditor({ date, onSave }) {
  const backdrop = createOverlay(`<header><h2>Lebensmittel suchen</h2><button type="button" data-nutrition-close aria-label="Schließen">×</button></header>
    <form class="nutrition-search-form"><input class="input" data-food-query placeholder="Produkt oder Marke" autocomplete="off"><button class="btn btn-primary" type="submit">Suchen</button></form>
    <div class="nutrition-search-results" data-food-results><p>Suche nach einem verpackten Lebensmittel.</p></div>`);
  const results = backdrop.querySelector('[data-food-results]');
  let products = [];
  backdrop.querySelector('form').onsubmit = async (event) => {
    event.preventDefault(); const query = backdrop.querySelector('[data-food-query]').value.trim(); if (query.length < 2) return;
    results.innerHTML = '<p>Produkte werden gesucht …</p>';
    try {
      products = (await productLookup('search', query)).products || [];
      results.innerHTML = products.length ? products.map((product, index) => `<button type="button" data-product-index="${index}">${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="">` : '<span></span>'}<div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.brand || '')}</small></div><strong>${decimal(product.kcal_100g)} kcal</strong></button>`).join('') : '<p>Kein passendes Produkt gefunden. Nutze „Eigene Mahlzeit“.</p>';
    } catch { results.innerHTML = '<p>Produktsuche gerade nicht erreichbar.</p>'; }
  };
  results.onclick = (event) => {
    const index = event.target.closest('[data-product-index]')?.dataset.productIndex;
    if (index == null) return; const product = products[Number(index)]; backdrop.remove(); amountEditor({ product, date, onSave });
  };
  setTimeout(() => backdrop.querySelector('[data-food-query]')?.focus(), 120);
}

function recentEditor({ recent, date, onSave }) {
  const unique = [...new Map(recent.map((item) => [`${item.name}:${item.amount}:${item.unit}`, item])).values()].slice(0, 16);
  const backdrop = createOverlay(`<header><h2>Zuletzt verwendet</h2><button type="button" data-nutrition-close aria-label="Schließen">×</button></header>
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
  const backdrop = createOverlay(`<header><h2>Barcode scannen</h2><button type="button" data-nutrition-close aria-label="Schließen">×</button></header>
    <div class="nutrition-scanner"><video playsinline muted></video><span></span></div>
    <p class="nutrition-calc-note">Barcode in den Rahmen halten. Die Kamera wird nur für die Erkennung verwendet.</p>
    <form class="nutrition-barcode-manual"><input class="input" inputmode="numeric" pattern="[0-9]*" placeholder="Barcode manuell eingeben"><button class="btn btn-primary" type="submit">Suchen</button></form>`);
  let controls = null; let detected = false;
  const stop = () => { controls?.stop?.(); backdrop.remove(); };
  backdrop.querySelector('[data-nutrition-close]').onclick = stop;
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) stop(); });
  backdrop.querySelector('form').onsubmit = (event) => {
    event.preventDefault(); const barcode = event.currentTarget.querySelector('input').value.replace(/\D/g, '');
    if (barcode.length < 8) return toast('Bitte einen gültigen Barcode eingeben');
    stop(); barcodeResult(barcode, context);
  };
  import('@zxing/browser').then(async ({ BrowserMultiFormatReader }) => {
    if (!backdrop.isConnected) return;
    const reader = new BrowserMultiFormatReader();
    controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, backdrop.querySelector('video'), (result, _error, scannerControls) => {
      if (!result || detected) return; detected = true; scannerControls.stop();
      const barcode = result.getText(); backdrop.remove(); barcodeResult(barcode, context);
    });
  }).catch(() => toast('Kamera nicht verfügbar. Barcode bitte manuell eingeben.'));
}

function addMenu(context) {
  const backdrop = createOverlay(`<header><h2>Kalorien eintragen</h2><button type="button" data-nutrition-close aria-label="Schließen">×</button></header>
    <div class="sheet-menue nutrition-add-menu">
      <button type="button" data-nutrition-action="scan">${materialIconMarkup('photo_camera')}<span><b>Barcode scannen</b><small>Verpacktes Produkt erkennen</small></span></button>
      <button type="button" data-nutrition-action="search">${materialIconMarkup('search')}<span><b>Lebensmittel suchen</b><small>Open Food Facts durchsuchen</small></span></button>
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
  let state = { settings: {}, entries: [], recent: [], latestWeight: 0 };
  const render = () => { container.innerHTML = summaryMarkup(state, date); bind(); };
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
      }
      const row = {
        user_id: userId, log_date: payload.log_date || date, period: payload.period || 'morning', product_id: productId,
        name: payload.name, amount: payload.amount || 1, unit: payload.unit || 'portion',
        energy_kcal: payload.energy_kcal || 0, protein_g: payload.protein_g || 0,
        carbs_g: payload.carbs_g || 0, fat_g: payload.fat_g || 0,
        product_snapshot: payload.product || payload.product_snapshot || {},
      };
      const { error } = await supabase.from('nutrition_log_entries').insert(row);
      if (error) throw error;
      playInterfaceSound('bonus', { retrigger: 'restart' }); toast('Kalorien eingetragen'); await refresh(); return true;
    } catch (error) { toast(error.message || 'Eintrag konnte nicht gespeichert werden'); return false; }
  };
  function bind() {
    container.querySelectorAll('[data-nutrition-day]').forEach((button) => {
      button.onclick = async () => {
        date = shiftedDate(date, Number(button.dataset.nutritionDay));
        automaticToday = date === localDateKey();
        await refresh();
      };
    });
    const calculatorForm = container.querySelector('[data-nutrition-settings-form]');
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
    container.querySelectorAll('[data-nutrition-delete]').forEach((button) => {
      button.onclick = async () => {
        const id = button.closest('[data-nutrition-entry]').dataset.nutritionEntry;
        if (!confirm('Diesen Kalorieneintrag löschen?')) return;
        const { error } = await supabase.from('nutrition_log_entries').delete().eq('id', id).eq('user_id', userId);
        if (error) return toast('Eintrag konnte nicht gelöscht werden');
        playInterfaceSound('error', { retrigger: 'restart' }); await refresh();
      };
    });
  }
  container.innerHTML = '<section class="nutrition-card"><p class="nutrition-empty">Kalorien werden geladen …</p></section>';
  try { await refresh(); }
  catch (error) { container.innerHTML = `<section class="nutrition-card"><p class="nutrition-empty">Kalorien-Log konnte nicht geladen werden.<br><small>${escapeHtml(error.message)}</small></p></section>`; }
  subscribeToTableChanges({ table: 'nutrition_log_entries', signal, onChange: refresh });
  subscribeToTableChanges({ table: 'nutrition_settings', signal, onChange: refresh });
  const dayWatcher = setInterval(() => {
    const today = localDateKey();
    if (!automaticToday || date === today || signal?.aborted) return;
    date = today; refresh().catch(() => {});
  }, 60000);
  signal?.addEventListener('abort', () => clearInterval(dayWatcher), { once: true });
  return { openAddMenu: () => addMenu({ date, recent: state.recent, onSave: saveEntry }) };
}
