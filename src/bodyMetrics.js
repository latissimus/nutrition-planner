import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { curveSvg } from './curve.js';
import { FALTEN, datumKurz, heute, summe, zahl } from './measurements.js';
import { BODY_EXPLANATIONS, confirmedTrendChange, evaluateBodyComp, goalWeightInterpretation, weightTrendSummary } from './bodyComposition.js';
import { parseLogmanExport, performanceTrend } from './logmanImport.js';
import { materialIconMarkup } from './categoryIcons.js';
import { createSpecialDexOverlay } from './specialDex.js';
import { notifyCoinBalanceChanged, notifyHomeCountsChanged, subscribeToTablesChanges } from './realtime.js';

const FALTEN_HILFE = {
  kinn: 'Mittig unter dem Kinn eine senkrechte Falte greifen.', wange: 'Seitlich an der Wange immer dieselbe Position verwenden.',
  brust: 'Schräge Falte zwischen vorderer Achselfalte und Brustwarze.', ruecken: 'Schräge Falte direkt unterhalb des Schulterblatts.',
  rippe: 'Senkrechte Falte seitlich am Oberkörper auf gleicher Höhe.', huefte: 'Schräge Falte unmittelbar oberhalb des Beckenkamms.',
  bauch: 'Senkrechte Falte wenige Zentimeter neben dem Bauchnabel.', trizeps: 'Senkrechte Falte mittig an der Rückseite des Oberarms.',
  bizeps: 'Senkrechte Falte mittig an der Vorderseite des Oberarms.', wade: 'Senkrechte Falte an der Innenseite der Wade auf größtem Umfang.',
  quadrizeps: 'Senkrechte Falte mittig an der Vorderseite des Oberschenkels.', beinbizeps: 'Senkrechte Falte mittig an der Rückseite des Oberschenkels.',
};
const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const display = (value, digits = 1) => Number(value || 0).toLocaleString('de-DE', { maximumFractionDigits: digits });
const day = (value) => Math.floor(new Date(`${value}T12:00:00`).getTime() / 86_400_000);

async function queryState(userId, signal) {
  const abort = (query) => signal ? query.abortSignal(signal) : query;
  const results = await Promise.all([
    abort(supabase.from('skinfolds').select('*').eq('user_id', userId).order('gemessen_am').limit(60)),
    abort(supabase.from('weights').select('*').eq('user_id', userId).order('gemessen_am').limit(180)),
    abort(supabase.from('waist_measurements').select('*').eq('user_id', userId).order('gemessen_am').limit(60)),
    abort(supabase.from('logman_performance').select('*').eq('user_id', userId).order('performed_on').limit(500)),
    abort(supabase.from('sleep_logs').select('sleep_date,quality,energy').eq('user_id', userId).order('sleep_date').limit(60)),
    abort(supabase.from('bodycomp_checkins').select('*').eq('user_id', userId).order('checkin_date').limit(60)),
    abort(supabase.from('nutrition_settings').select('goal,bodycomp_thresholds').eq('user_id', userId).maybeSingle()),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  return {
    skinfolds: (results[0].data || []).map((row) => ({ ...row, total: summe(row.falten) })),
    weights: (results[1].data || []).map((row) => ({ ...row, date: row.gemessen_am, kg: Number(row.kg) })),
    waists: results[2].data || [], performance: results[3].data || [],
    sleep: results[4].data || [], checkins: results[5].data || [], settings: results[6].data || {},
  };
}

function recoveryTrend(sleep, checkins) {
  const values = [...sleep.map((row) => (Number(row.quality) + Number(row.energy)) / 2), ...checkins.map((row) => Number(row.recovery)).filter(Boolean)];
  if (values.length < 6) return null;
  const split = Math.floor(values.length / 2); const mean = (list) => list.reduce((sumValue, value) => sumValue + value, 0) / list.length;
  const difference = mean(values.slice(split)) - mean(values.slice(0, split));
  return difference > 0.3 ? 1 : difference < -0.3 ? -1 : 0;
}

function infoDetails(title, text) { return `<details class="body-info"><summary>${title}<span aria-hidden="true">?</span></summary><p>${text}</p></details>`; }

function bodyHeroMarkup(state) {
  const latest = state.weights.at(-1);
  const trend = weightTrendSummary(state.weights, state.settings.bodycomp_thresholds || undefined);
  const recentDays = new Set(state.weights
    .filter((row) => day(heute()) - day(row.gemessen_am) < 7)
    .map((row) => row.gemessen_am)).size;
  const progress = Math.min(100, Math.round(recentDays / 7 * 100));
  const weekly = Number(trend.weeklyKg || 0);
  const weeklyLabel = latest
    ? `${weekly > 0 ? '+' : ''}${display(weekly, 2)} kg pro Woche`
    : 'Noch keine Messung';
  return `<section class="body-log-hero special-dex-hero" style="--body-progress:${progress}%">
    <div class="body-log-ring"><span><b>${latest ? display(trend.average7Kg) : '–'}</b><small>7-TAGE Ø</small></span></div>
    <div class="body-log-hero-value"><small>AKTUELLES GEWICHT</small><div class="body-log-hero-number"><strong>${latest ? display(latest.kg) : '–'}</strong>${latest ? '<b>kg</b>' : ''}</div><span>${latest ? `Ø ${weeklyLabel}` : weeklyLabel}</span></div>
    <button class="body-analysis-info" type="button" aria-expanded="false" aria-label="Body-Log-Auswertung erklären">i</button>
  </section>
  <div class="body-analysis-help" hidden>
    <p>Der <b>Body-Log</b> bewertet nicht einzelne Tageswerte, sondern deinen geglätteten Gewichtsverlauf.</p>
    <p>Ergänzende Daten wie <b>Taillenumfang</b>, <b>12-Falten-Summe</b>, Training und Erholung helfen dabei, Veränderungen sinnvoll einzuordnen.</p>
  </div>`;
}

function weightEntryMarkup() {
  return `<form class="gew-eingabe body-entry-form" data-weight-form>
    <label class="falte gew-feld"><span>Datum</span><span class="input gew-datum-eingabe"><input type="date" value="${heute()}" data-weight-date></span></label>
    <label class="falte gew-feld"><span>Gewicht</span><span class="gew-wert-eingabe"><input class="input gew-in" type="text" inputmode="decimal" placeholder="84,2" data-weight-value><i>kg</i></span></label>
    <button class="btn btn-primary" type="submit">Gewicht speichern</button>
  </form>`;
}

function waistEntryMarkup() {
  return `<form class="body-inline-form body-entry-form" data-waist-form>
    <label><span>Datum</span><input class="input" type="date" value="${heute()}" data-waist-date></label>
    <label><span>Taillenumfang</span><span class="nutrition-unit-field"><input class="input" type="text" inputmode="decimal" placeholder="90,0" data-waist-value><i>cm</i></span></label>
    <label class="body-standard"><input type="checkbox" data-waist-standard><span>Unter standardisierten Bedingungen gemessen</span></label>
    <button class="btn btn-primary" type="submit">Taillenumfang speichern</button>
  </form>`;
}

function skinfoldEntryMarkup() {
  return `<form class="body-entry-form" data-skinfold-form>
    <p class="body-guide">Alle zwei bis vier Wochen · gleiche Tageszeit und Körperseite · gleiche Messperson und gleicher Caliper · ähnliche Hydrierungs- und Ernährungsbedingungen.</p>
    <label class="fld-l">Datum<input class="input" type="date" value="${heute()}" data-skinfold-date></label>
    <label class="body-standard"><input type="checkbox" data-skinfold-standard><span>Standardisierte Bedingungen eingehalten</span></label>
    <div class="guided-fold-grid">${FALTEN.map(([key, label]) => `<fieldset><legend>${label}</legend><small>${FALTEN_HILFE[key]}</small><div><input class="input" type="text" inputmode="decimal" placeholder="mm" aria-label="${label} in Millimetern" data-fold="${key}"></div></fieldset>`).join('')}</div>
    <div class="falten-summe" data-skinfold-quality>0 von 12 Falten eingetragen.</div>
    <button class="btn btn-primary btn-block" type="submit" disabled>Messung speichern</button>
  </form>`;
}

function recoveryEntryMarkup() {
  return `<form class="body-checkin-form body-entry-form" data-bodycomp-checkin>
    <label><span>Datum</span><input class="input" type="date" value="${heute()}" data-checkin-date></label>
    ${[['recovery','Erholung'],['mood','Stimmung'],['hunger','Hunger']].map(([key, label]) => `<label><span>${label}</span><select class="input" data-checkin-${key}>${[1,2,3,4,5].map((value) => `<option value="${value}">${value} von 5</option>`).join('')}</select></label>`).join('')}
    <div><label><input type="checkbox" data-checkin-illness> Krankheit</label><label><input type="checkbox" data-checkin-travel> Reise</label><label><input type="checkbox" data-checkin-unusual> außergewöhnliche Mahlzeiten</label></div>
    <button class="btn btn-primary" type="submit">Check-in speichern</button>
  </form>`;
}

function logmanEntryMarkup() {
  return `<div class="body-entry-form"><p>Wähle einen JSON-Export aus LOGMAN. Vorhandene Werte desselben Tages werden aktualisiert.</p><label class="body-file-input"><span>LOGMAN-JSON-Export auswählen</span><input type="file" accept="application/json,.json" data-logman-import></label><p data-logman-status></p></div>`;
}

function weightMarkup(state) {
  const trend = weightTrendSummary(state.weights, state.settings.bodycomp_thresholds || undefined); const latest = state.weights.at(-1);
  const interpretation = goalWeightInterpretation(trend, state.settings.goal || 'maintain');
  return `<section class="card body-evidence-card body-data-card special-dex-wide-card" data-weight-card><header class="body-data-card-head"><span><b>Gewichtsverlauf</b><small>${latest ? `${display(latest.kg)} kg · ${state.weights.length} ${state.weights.length === 1 ? 'Messung' : 'Messungen'}` : 'Noch keine Messung'}</small></span></header><div class="body-data-card-content">
    ${latest ? `<div class="body-metric-grid"><span><small>AKTUELL</small><b>${display(latest.kg)} kg</b></span><span><small>7-TAGE-SCHNITT</small><b>${display(trend.average7Kg)} kg</b></span><span><small>PRO WOCHE</small><b>${trend.weeklyKg > 0 ? '+' : ''}${display(trend.weeklyKg, 2)} kg</b></span><span><small>28-TAGE-ÄNDERUNG</small><b>${trend.trend28Kg > 0 ? '+' : ''}${display(trend.trend28Kg, 2)} kg</b></span></div>` : '<div class="body-chart-empty"><b>Noch kein Gewicht</b><span>Trage über den Hinzufügen-Button deine erste Wiegung ein.</span></div>'}
    <div class="body-chart-block"><header><b>VERLAUF</b><small>Tageswerte und 7-Tage-Schnitt</small></header>
    <p class="body-goal-status" data-tone="${interpretation.tone}"><b>${interpretation.label}</b><span>${interpretation.text}</span></p>
    ${curveSvg([{ values: state.weights.map((row) => ({ datum: row.gemessen_am, wert: row.kg })), className: 'roh', points: true }, { values: trend.points?.map((row) => ({ datum: row.date, wert: row.kg })) || [], className: 'trend' }], { unit: 'kg' })}</div>
    ${infoDetails('Warum bewertet MUSCLEDEX den Trend?', `${BODY_EXPLANATIONS.dailyWeight} ${BODY_EXPLANATIONS.average7} ${BODY_EXPLANATIONS.trend28}`)}
    ${infoDetails('Wie oft wiegen?', BODY_EXPLANATIONS.weighingFrequency)}
  </div></section>`;
}

function skinfoldMarkup(state) {
  const valid = state.skinfolds.filter((row) => row.total != null); const latest = valid.at(-1); const previous = valid.at(-2);
  const smallChange = latest && previous && Math.abs(latest.total - previous.total) < Math.max(2, previous.total * 0.02);
  return `<section class="card body-evidence-card body-data-card special-dex-list-card" data-skinfold-card><header class="body-data-card-head"><span><b>12-Falten-Summe</b><small>${latest ? `${display(latest.total)} mm · ${datumKurz(latest.gemessen_am)}` : 'Noch keine Messung'}</small></span></header><div class="body-data-card-content"><h2 class="section-title mini-title">12-Falten-Summe in mm – keine KFA-Schätzung</h2>
    ${latest ? `<div class="body-latest-value"><small>LETZTE SUMME</small><strong>${display(latest.total)} <b>mm</b></strong><span>${datumKurz(latest.gemessen_am)}</span></div>` : '<div class="body-chart-empty"><b>Noch keine Faltenmessung</b><span>Nach der ersten vollständigen 12-Falten-Messung erscheint hier die Summe.</span></div>'}
    ${smallChange ? '<p class="body-neutral-note">Die Veränderung liegt möglicherweise innerhalb der normalen Messschwankung. Noch keine Anpassung erforderlich.</p>' : ''}
    <div class="body-chart-block"><header><b>VERLAUF</b><small>Summe aller 12 Falten</small></header>${curveSvg([{ values: valid.map((row) => ({ datum: row.gemessen_am, wert: row.total })), className: 'trend', points: true }], { unit: 'mm' })}</div>
    ${infoDetails('Was wird gemessen?', BODY_EXPLANATIONS.skinfolds)}
  </div></section>`;
}

function waistMarkup(state) {
  const latest = state.waists.at(-1);
  return `<section class="card body-evidence-card body-data-card special-dex-list-card" data-waist-card><header class="body-data-card-head"><span><b>Taillenumfang</b><small>${latest ? `${display(latest.cm)} cm · ${datumKurz(latest.gemessen_am)}` : 'Noch keine Messung'}</small></span></header><div class="body-data-card-content">${latest ? `<div class="body-latest-value"><small>LETZTER WERT</small><strong>${display(latest.cm)} <b>cm</b></strong><span>${datumKurz(latest.gemessen_am)}</span></div>` : '<div class="body-chart-empty"><b>Noch kein Taillenumfang</b><span>Trage über den Hinzufügen-Button deine erste Messung ein.</span></div>'}<div class="body-chart-block"><header><b>VERLAUF</b><small>Taillenumfang in Zentimetern</small></header>${curveSvg([{ values: state.waists.map((row) => ({ datum: row.gemessen_am, wert: Number(row.cm) })), className: 'trend', points: true }], { unit: 'cm' })}</div>${infoDetails('Richtig messen', `${BODY_EXPLANATIONS.waist} Miss immer an derselben Position, stehend und nach entspannter Ausatmung.`)}</div></section>`;
}

function bodyCompMarkup(state) {
  const weight = weightTrendSummary(state.weights, state.settings.bodycomp_thresholds || undefined);
  const skinfoldDelta = confirmedTrendChange(state.skinfolds, (row) => row.total, 2);
  const waistDelta = confirmedTrendChange(state.waists, (row) => Number(row.cm), 0.5); const performance = performanceTrend(state.performance); const recovery = recoveryTrend(state.sleep, state.checkins);
  const allDates = [...state.weights.map((row) => row.gemessen_am), ...state.skinfolds.map((row) => row.gemessen_am), ...state.waists.map((row) => row.gemessen_am)].sort();
  const weeks = allDates.length > 1 ? (day(allDates.at(-1)) - day(allDates[0])) / 7 : 0;
  const result = evaluateBodyComp({ weight, skinfoldDelta, waistDelta, performanceTrend: performance.direction, recoveryTrend: recovery, weeks });
  const thresholds = { stableLoss: -0.15, slowLoss: -0.5, stableGain: 0.15, slowGain: 0.3, ...(state.settings.bodycomp_thresholds || {}) };
  return `<details class="card bodycomp-status special-dex-wide-card" data-bodycomp-card>
    <summary><span><b>Körpertrend</b><small>${escapeHtml(result.message)}</small></span>${materialIconMarkup('chevron_right')}</summary>
    <div class="body-data-card-content">
      <p class="bodycomp-message">${escapeHtml(result.message)}</p>
      ${result.suggestion ? `<p>${escapeHtml(result.suggestion)}</p>` : ''}
      <div class="bodycomp-sources">
        <span>Gewicht <b>${weight.category || 'unklar'}</b></span>
        <span>Faltensumme <b>${skinfoldDelta == null ? 'noch nicht bestätigt' : `${skinfoldDelta > 0 ? '+' : ''}${display(skinfoldDelta)} mm`}</b></span>
        <span>Taille <b>${waistDelta == null ? 'noch nicht bestätigt' : `${waistDelta > 0 ? '+' : ''}${display(waistDelta)} cm`}</b></span>
        <span>LOGMAN-Leistung <b>${performance.direction == null ? 'Import fehlt' : `${performance.percent > 0 ? '+' : ''}${display(performance.percent)} %`}</b></span>
        <span>Schlaf & Erholung <b>${recovery == null ? 'noch unklar' : recovery > 0 ? 'verbessert' : recovery < 0 ? 'verschlechtert' : 'stabil'}</b></span>
      </div>
      <details class="body-info"><summary>Einordnung und Einschränkungen<span>?</span></summary><p>${BODY_EXPLANATIONS.recovery}</p>${result.limitations.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}</details>
      <details class="mess-neu"><summary>Orientierungsbereiche anpassen</summary><form class="body-threshold-form" data-bodycomp-thresholds><div class="body-threshold-explanation"><b>Was bedeuten diese Werte?</b><p>Der Body-Log vergleicht die durchschnittliche Gewichtsänderung pro Woche mit deinem aktuellen 7-Tage-Schnitt. Innerhalb der beiden ersten Grenzen gilt das Gewicht als stabil. Werden die äußeren Grenzen überschritten, wird die Ab- oder Zunahme als schnell eingeordnet. Die Werte sind Orientierung und keine biologische Exaktheit.</p></div><label><span>Gewichtsverlust erkannt ab</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(Math.abs(thresholds.stableLoss), 2)}" data-threshold-stable-loss><i>%</i></span></label><label><span>Schneller Verlust ab</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(Math.abs(thresholds.slowLoss), 2)}" data-threshold-slow-loss><i>%</i></span></label><label><span>Gewichtszunahme erkannt ab</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(thresholds.stableGain, 2)}" data-threshold-stable-gain><i>%</i></span></label><label><span>Schnelle Zunahme ab</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(thresholds.slowGain, 2)}" data-threshold-slow-gain><i>%</i></span></label><button class="btn btn-primary" type="submit">Orientierungsbereiche speichern</button></form></details>
    </div>
  </details>`;
}

function logmanMarkup(state) {
  const trend = performanceTrend(state.performance);
  const baselines = new Map();
  [...state.performance]
    .sort((a, b) => a.performed_on.localeCompare(b.performed_on))
    .forEach((row) => {
      const key = `${row.category}:${String(row.exercise).toLowerCase()}`;
      if (!baselines.has(key) && Number(row.estimated_1rm) > 0) baselines.set(key, Number(row.estimated_1rm));
    });
  const daily = [...state.performance.reduce((days, row) => {
    const date = row.performed_on;
    const value = Number(row.estimated_1rm || 0);
    const baseline = baselines.get(`${row.category}:${String(row.exercise).toLowerCase()}`);
    if (!date || !value || !baseline) return days;
    const current = days.get(date) || { sum: 0, count: 0 };
    current.sum += value / baseline * 100;
    current.count += 1;
    days.set(date, current);
    return days;
  }, new Map())].map(([datum, value]) => ({ datum, wert: value.sum / value.count }));
  return `<section class="card body-evidence-card body-data-card special-dex-list-card" data-logman-card><header class="body-data-card-head"><span><b>LOGMAN-Leistung</b><small>${state.performance.length ? `${state.performance.length} Werte · ${trend.percent > 0 ? '+' : ''}${display(trend.percent)} %` : 'Noch kein Import'}</small></span></header><div class="body-data-card-content">${state.performance.length ? `<div class="body-latest-value"><small>VERGLEICHBARER TREND</small><strong>${trend.percent > 0 ? '+' : ''}${display(trend.percent)} <b>%</b></strong><span>${trend.comparableSessions} importierte Leistungswerte</span></div>` : '<div class="body-chart-empty"><b>Noch keine LOGMAN-Daten</b><span>Importiere einen LOGMAN-Export über den Hinzufügen-Button.</span></div>'}<div class="body-chart-block"><header><b>VERLAUF</b><small>Leistungsindex · erster Wert = 100</small></header>${curveSvg([{ values: daily, className: 'trend', points: true }], { unit: '%' })}</div>${infoDetails('Wie wird Leistung verwendet?', `${BODY_EXPLANATIONS.performance} Der Verlauf normalisiert jede Übung auf ihren ersten importierten Wert. Dadurch werden unterschiedliche Übungen nicht als absolute Kilogrammwerte miteinander vermischt.`)}</div></section>`;
}

export async function mountBodyMetrics(container, { session, profile, onProfileUpdated, signal }) {
  const userId = session.user.id;
  let state;
  let activeRender = null;
  let renderQueued = false;

  const renderOnce = async () => {
    state = await queryState(userId, signal);
    if (signal?.aborted) return;
    container.innerHTML = `<div class="wrap pad-bottom body-metrics-wrap">
      ${bodyHeroMarkup(state)}
      ${bodyCompMarkup(state)}
      ${weightMarkup(state)}
      ${skinfoldMarkup(state)}
      ${waistMarkup(state)}
      ${logmanMarkup(state)}
      <details class="card mess-neu body-settings-card special-dex-list-card"><summary>Messung & Daten verwalten</summary><div class="body-settings-content"><h3>Erinnerung für Hautfaltenmessung</h3><div data-skinfold-settings></div><button class="phase-reset" type="button" data-delete-measurements>Messdaten zurücksetzen</button></div></details>
    </div>`;
    bind();
  };

  const render = async () => {
    if (activeRender) {
      renderQueued = true;
      return activeRender;
    }
    activeRender = (async () => {
      do {
        renderQueued = false;
        await renderOnce();
      } while (renderQueued && !signal?.aborted);
    })();
    try {
      await activeRender;
    } finally {
      activeRender = null;
    }
  };

  const entryOptions = {
    weight: { title: 'Gewicht eintragen', markup: weightEntryMarkup },
    waist: { title: 'Taillenumfang eintragen', markup: waistEntryMarkup },
    skinfold: { title: '12-Falten-Messung', markup: skinfoldEntryMarkup },
    recovery: { title: 'Erholung protokollieren', markup: recoveryEntryMarkup },
    logman: { title: 'LOGMAN-Import', markup: logmanEntryMarkup },
  };

  const bindEntryOverlay = (overlay) => {
    const closeAndRender = async () => { overlay.remove(); await render(); };
    const weightForm = overlay.querySelector('[data-weight-form]');
    if (weightForm) weightForm.onsubmit = async (event) => {
      event.preventDefault();
      const kg = zahl(weightForm.querySelector('[data-weight-value]').value);
      const date = weightForm.querySelector('[data-weight-date]').value;
      if (!kg || kg <= 0 || kg >= 500) return toast('Bitte ein gültiges Gewicht eintragen');
      const isNew = !state.weights.some((row) => row.gemessen_am === date);
      const { error } = await supabase.from('weights').upsert({ user_id: userId, gemessen_am: date, kg }, { onConflict: 'user_id,gemessen_am' });
      if (error) return toast('Gewicht konnte nicht gespeichert werden');
      notifyHomeCountsChanged();
      if (isNew) notifyCoinBalanceChanged();
      toast(isNew ? 'Gewicht gespeichert · +1 MUSCLE-COIN' : 'Gewicht aktualisiert');
      await closeAndRender();
    };

    const waistForm = overlay.querySelector('[data-waist-form]');
    if (waistForm) waistForm.onsubmit = async (event) => {
      event.preventDefault();
      const cm = zahl(waistForm.querySelector('[data-waist-value]').value);
      const date = waistForm.querySelector('[data-waist-date]').value;
      if (!cm || cm < 30 || cm > 250) return toast('Bitte einen gültigen Taillenumfang eintragen');
      const isNew = !state.waists.some((row) => row.gemessen_am === date);
      const { error } = await supabase.from('waist_measurements').upsert({ user_id: userId, gemessen_am: date, cm, standardisiert: waistForm.querySelector('[data-waist-standard]').checked }, { onConflict: 'user_id,gemessen_am' });
      if (error) return toast('Taillenumfang konnte nicht gespeichert werden');
      if (isNew) notifyCoinBalanceChanged();
      toast(isNew ? 'Taillenumfang gespeichert · +1 MUSCLE-COIN' : 'Taillenumfang aktualisiert');
      await closeAndRender();
    };

    const skinfoldForm = overlay.querySelector('[data-skinfold-form]');
    if (skinfoldForm) {
      const updateSkinfold = () => {
        const values = {};
        skinfoldForm.querySelectorAll('[data-fold]').forEach((input) => {
          const value = zahl(input.value);
          if (value != null && value >= 0) values[input.dataset.fold] = value;
        });
        const complete = Object.keys(values).length;
        const total = summe(values);
        const message = `${complete} von 12 Falten eingetragen`;
        skinfoldForm.querySelector('[data-skinfold-quality]').innerHTML = `${escapeHtml(message)}${total != null ? ` · <b>${display(total)} mm</b>` : ''}`;
        skinfoldForm.querySelector('button[type="submit"]').disabled = complete !== 12;
        return { values, complete };
      };
      skinfoldForm.querySelectorAll('[data-fold]').forEach((input) => { input.oninput = updateSkinfold; });
      skinfoldForm.onsubmit = async (event) => {
        event.preventDefault();
        const { values, complete } = updateSkinfold();
        if (complete !== 12) return;
        const date = skinfoldForm.querySelector('[data-skinfold-date]').value;
        const isNew = !state.skinfolds.some((row) => row.gemessen_am === date);
        const standardisiert = skinfoldForm.querySelector('[data-skinfold-standard]').checked;
        const readings = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, [value]]));
        const { error } = await supabase.from('skinfolds').upsert({ user_id: userId, gemessen_am: date, falten: values, messreihen: readings, messqualitaet: standardisiert ? 'standardisiert' : 'nicht standardisiert', standardisiert, bedingungen: { gleiche_tageszeit: standardisiert, gleiche_seite: standardisiert, gleicher_caliper: standardisiert } }, { onConflict: 'user_id,gemessen_am' });
        if (error) return toast('Messung konnte nicht gespeichert werden');
        notifyHomeCountsChanged();
        if (isNew) notifyCoinBalanceChanged();
        toast(isNew ? '12-Falten-Summe gespeichert · +1 MUSCLE-COIN' : '12-Falten-Summe aktualisiert');
        await closeAndRender();
      };
    }

    const checkinForm = overlay.querySelector('[data-bodycomp-checkin]');
    if (checkinForm) checkinForm.onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const { error } = await supabase.from('bodycomp_checkins').upsert({ user_id: userId, checkin_date: form.querySelector('[data-checkin-date]').value, recovery: Number(form.querySelector('[data-checkin-recovery]').value), mood: Number(form.querySelector('[data-checkin-mood]').value), hunger: Number(form.querySelector('[data-checkin-hunger]').value), illness: form.querySelector('[data-checkin-illness]').checked, travel: form.querySelector('[data-checkin-travel]').checked, unusual_meals: form.querySelector('[data-checkin-unusual]').checked }, { onConflict: 'user_id,checkin_date' });
      if (error) return toast('Check-in konnte nicht gespeichert werden');
      toast('Erholung protokolliert');
      await closeAndRender();
    };

    const importInput = overlay.querySelector('[data-logman-import]');
    if (importInput) importInput.onchange = async (event) => {
      const status = overlay.querySelector('[data-logman-status]');
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const rows = parseLogmanExport(parsed).map((row) => ({ ...row, user_id: userId }));
        if (!rows.length) throw new Error('Keine vergleichbaren HEAVYS-/MIDDLES-Werte gefunden.');
        const { error } = await supabase.from('logman_performance').upsert(rows, { onConflict: 'user_id,performed_on,exercise,category' });
        if (error) throw error;
        status.textContent = `${rows.length} Leistungswerte importiert.`;
        toast('LOGMAN-Leistung importiert');
        await closeAndRender();
      } catch (error) {
        status.textContent = error.message || 'Import fehlgeschlagen.';
      }
    };
    requestAnimationFrame(() => overlay.querySelector('input:not([type="checkbox"]),select')?.focus({ preventScroll: true }));
  };

  const openEntryOverlay = (kind) => {
    const config = entryOptions[kind];
    if (!config) return;
    const overlay = createSpecialDexOverlay({
      colorScope: 'body',
      replaceSelector: '[data-body-entry-overlay]',
      className: 'body-entry-overlay',
      sheetClassName: `body-entry-sheet body-entry-sheet-${kind}`,
      ariaLabel: config.title,
      markup: `<header><h2>${config.title}</h2><button type="button" data-close aria-label="Schließen">${materialIconMarkup('close')}</button></header><div class="body-entry-content">${config.markup()}</div>`,
    });
    overlay.dataset.bodyEntryOverlay = '';
    bindEntryOverlay(overlay);
  };

  const openAddMenu = () => {
    const overlay = createSpecialDexOverlay({
      colorScope: 'body',
      replaceSelector: '[data-body-add-overlay]',
      className: 'body-add-overlay',
      sheetClassName: 'body-add-sheet',
      ariaLabel: 'Messung hinzufügen',
      markup: `<header><h2>Messung hinzufügen</h2><button type="button" data-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
        <div class="kategorie-sheet-menu body-add-menu">
          <button type="button" data-body-add="weight">${materialIconMarkup('monitor_weight')}<span><b>Gewicht</b><small>Neue Wiegung eintragen</small></span></button>
          <button type="button" data-body-add="waist">${materialIconMarkup('measuring_tape')}<span><b>Taillenumfang</b><small>Umfang dokumentieren</small></span></button>
          <button type="button" data-body-add="skinfold">${materialIconMarkup('body_fat')}<span><b>12-Falten-Messung</b><small>Geführte Messung starten</small></span></button>
          <button type="button" data-body-add="recovery">${materialIconMarkup('favorite')}<span><b>Erholungs-Check-in</b><small>Erholung, Stimmung und Hunger</small></span></button>
          <button type="button" data-body-add="logman">${materialIconMarkup('upload_file')}<span><b>LOGMAN-Import</b><small>Leistungsdaten ergänzen</small></span></button>
        </div>`,
    });
    overlay.dataset.bodyAddOverlay = '';
    overlay.querySelectorAll('[data-body-add]').forEach((button) => {
      button.onclick = () => {
        const kind = button.dataset.bodyAdd;
        overlay.remove();
        openEntryOverlay(kind);
      };
    });
  };

  const bind = () => {
    const infoButton = container.querySelector('.body-analysis-info');
    const infoHelp = container.querySelector('.body-analysis-help');
    infoButton.onclick = () => {
      const open = infoHelp.hidden;
      infoHelp.hidden = !open;
      infoButton.setAttribute('aria-expanded', String(open));
    };
    container.querySelector('[data-bodycomp-thresholds]').onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; const stableLoss = zahl(form.querySelector('[data-threshold-stable-loss]').value); const slowLoss = zahl(form.querySelector('[data-threshold-slow-loss]').value); const stableGain = zahl(form.querySelector('[data-threshold-stable-gain]').value); const slowGain = zahl(form.querySelector('[data-threshold-slow-gain]').value); if (!(stableLoss > 0 && slowLoss > stableLoss && stableGain > 0 && slowGain > stableGain)) return toast('Bitte aufsteigende, positive Prozentgrenzen eintragen'); const bodycomp_thresholds = { stableLoss: -stableLoss, slowLoss: -slowLoss, stableGain, slowGain }; const { error } = await supabase.from('nutrition_settings').upsert({ user_id: userId, bodycomp_thresholds }, { onConflict: 'user_id' }); if (error) return toast('Orientierungsbereiche konnten nicht gespeichert werden'); toast('Orientierungsbereiche gespeichert'); await render(); };
    const settings = container.querySelector('[data-skinfold-settings]');
    settings.innerHTML = `<div class="mess-einst"><label class="switchline mess-erinnerung-switch"><input type="checkbox" data-reminder-active${profile.falten_erinnerung ? ' checked' : ''}><i class="switchline-track"></i></label><label class="mess-zeile"><span>alle</span><select class="input compact-input" data-reminder-weeks>${[2,3,4].map((weeks) => `<option value="${weeks}"${profile.falten_intervall_wochen === weeks ? ' selected' : ''}>${weeks} Wochen</option>`).join('')}</select></label><label class="mess-zeile"><span>um</span><input class="input compact-input" type="time" value="${String(profile.falten_uhrzeit || '08:00').slice(0,5)}" data-reminder-time></label></div>`;
    settings.querySelectorAll('input,select').forEach((field) => { field.onchange = async () => { const values = { falten_erinnerung: settings.querySelector('[data-reminder-active]').checked, falten_intervall_wochen: Number(settings.querySelector('[data-reminder-weeks]').value), falten_uhrzeit: settings.querySelector('[data-reminder-time]').value, zeitzone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin' }; const { error } = await supabase.from('profiles').update(values).eq('id', userId); if (error) return toast('Einstellung nicht gespeichert'); Object.assign(profile, values); onProfileUpdated?.(profile); toast('Erinnerung gespeichert'); }; });
    container.querySelector('[data-delete-measurements]').onclick = async () => { if (!confirm('Alle Gewichts-, Hautfalten- und Taillenmessungen löschen?')) return; const results = await Promise.all(['skinfolds','weights','waist_measurements'].map((table) => supabase.from(table).delete().eq('user_id', userId))); if (results.some((result) => result.error)) return toast('Messdaten konnten nicht vollständig gelöscht werden'); notifyHomeCountsChanged(); toast('Messdaten zurückgesetzt'); await render(); };
  };
  container.innerHTML = '<div class="wrap"><section class="card"><p>Body-Log wird geladen …</p></section></div>';
  try {
    await render();
  } catch (error) {
    if (!signal?.aborted) container.innerHTML = `<div class="wrap"><section class="card"><p class="msg err">Body-Log konnte nicht geladen werden.<br><small>${escapeHtml(error.message)}</small></p></section></div>`;
  }
  subscribeToTablesChanges({
    tables: ['weights', 'skinfolds', 'waist_measurements', 'bodycomp_checkins', 'logman_performance', 'nutrition_settings'],
    signal,
    onChange: render,
  });
  return {
    meta: `${state?.weights?.length || 0} Wiegungen`,
    openAddMenu,
  };
}
