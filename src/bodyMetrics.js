import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { curveSvg } from './curve.js';
import { FALTEN, datumKurz, heute, summe, zahl } from './measurements.js';
import { BODY_EXPLANATIONS, aggregateSkinfoldReadings, confirmedTrendChange, evaluateBodyComp, goalWeightInterpretation, weightTrendSummary } from './bodyComposition.js';
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
    <div class="body-log-hero-value"><small>AKTUELLES GEWICHT</small><strong>${latest ? display(latest.kg) : '–'}</strong><b>KG</b><span>${weeklyLabel}</span></div>
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
    <div class="guided-fold-grid">${FALTEN.map(([key, label]) => `<fieldset><legend>${label}</legend><small>${FALTEN_HILFE[key]}</small><div><input class="input" type="text" inputmode="decimal" placeholder="1" data-fold="${key}" data-reading="0"><input class="input" type="text" inputmode="decimal" placeholder="2" data-fold="${key}" data-reading="1"><input class="input" type="text" inputmode="decimal" placeholder="3 bei Abweichung" data-fold="${key}" data-reading="2"></div></fieldset>`).join('')}</div>
    <div class="falten-summe" data-skinfold-quality>Je Stelle zunächst zwei Messungen eintragen.</div>
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
  return `<details class="card body-evidence-card body-data-card special-dex-wide-card" data-weight-card><summary><span><b>Gewichtsverlauf</b><small>${latest ? `${display(latest.kg)} kg · ${trend.confidence}` : 'Noch keine Messung'}</small></span>${materialIconMarkup('chevron_right')}</summary><div class="body-data-card-content">
    ${latest ? `<div class="body-metric-grid"><span><small>HEUTE</small><b>${display(latest.kg)} kg</b></span><span><small>7-TAGE-SCHNITT</small><b>${display(trend.average7Kg)} kg</b></span><span><small>PRO WOCHE</small><b>${trend.weeklyKg > 0 ? '+' : ''}${display(trend.weeklyKg, 2)} kg · ${trend.weeklyPercent > 0 ? '+' : ''}${display(trend.weeklyPercent, 2)} %</b></span><span><small>28-TAGE-TREND</small><b>${trend.trend28Kg > 0 ? '+' : ''}${display(trend.trend28Kg, 2)} kg</b></span></div><p class="body-confidence">Vertrauensstufe: <b>${trend.confidence}</b> · ${display(trend.measurementsPerWeek)} Wiegungen pro Woche</p>` : '<p>Noch kein Gewicht eingetragen.</p>'}
    <p class="body-goal-status" data-tone="${interpretation.tone}"><b>${interpretation.label}</b><span>${interpretation.text}</span></p>
    <div>${curveSvg([{ values: state.weights.map((row) => ({ datum: row.gemessen_am, wert: row.kg })), className: 'roh' }, { values: trend.points?.map((row) => ({ datum: row.date, wert: row.kg })) || [], className: 'trend' }], { unit: 'kg' })}</div>
    ${infoDetails('Warum bewertet MUSCLEDEX den Trend?', `${BODY_EXPLANATIONS.dailyWeight} ${BODY_EXPLANATIONS.average7} ${BODY_EXPLANATIONS.trend28}`)}
    ${infoDetails('Wie oft wiegen?', BODY_EXPLANATIONS.weighingFrequency)}
  </div></details>`;
}

function skinfoldMarkup(state) {
  const valid = state.skinfolds.filter((row) => row.total != null); const latest = valid.at(-1); const previous = valid.at(-2);
  const smallChange = latest && previous && Math.abs(latest.total - previous.total) < Math.max(2, previous.total * 0.02);
  const gapDays = latest && previous ? day(latest.gemessen_am) - day(previous.gemessen_am) : null;
  const comparable = latest && previous && latest.standardisiert && previous.standardisiert;
  return `<details class="card body-evidence-card body-data-card special-dex-list-card" data-skinfold-card><summary><span><b>12-Falten-Summe</b><small>${latest ? `${display(latest.total)} mm · ${datumKurz(latest.gemessen_am)}` : 'Noch keine Messung'}</small></span>${materialIconMarkup('chevron_right')}</summary><div class="body-data-card-content"><h2 class="section-title mini-title">12-Falten-Summe in mm – keine KFA-Schätzung</h2>
    ${latest ? `<div class="mess-kopf"><span class="mess-label">Letzte Summe</span><div class="mess-wert">${display(latest.total)} <span>mm</span></div><div class="mess-datum">${datumKurz(latest.gemessen_am)} · Messqualität ${latest.messqualitaet || 'nicht dokumentiert'}${gapDays != null ? ` · ${gapDays} Tage seit der vorherigen Messung` : ''}</div></div><p class="body-confidence">Vollständigkeit: <b>${Object.keys(latest.falten || {}).length} von 12 Stellen</b> · Vergleichbarkeit: <b>${comparable ? 'standardisiert' : previous ? 'eingeschränkt' : 'noch kein Vergleich'}</b></p>` : '<p>Noch keine Hautfaltenmessung.</p>'}
    ${smallChange ? '<p class="body-neutral-note">Die Veränderung liegt möglicherweise innerhalb der normalen Messschwankung. Noch keine Anpassung erforderlich.</p>' : ''}
    <div>${curveSvg([{ values: valid.map((row) => ({ datum: row.gemessen_am, wert: row.total })), className: 'trend', points: true }], { unit: 'mm' })}</div>
    ${infoDetails('Was wird gemessen?', BODY_EXPLANATIONS.skinfolds)}
  </div></details>`;
}

function waistMarkup(state) {
  const latest = state.waists.at(-1);
  return `<details class="card body-evidence-card body-data-card special-dex-list-card" data-waist-card><summary><span><b>Taillenumfang</b><small>${latest ? `${display(latest.cm)} cm · ${datumKurz(latest.gemessen_am)}` : 'Noch keine Messung'}</small></span>${materialIconMarkup('chevron_right')}</summary><div class="body-data-card-content">${latest ? `<div class="mess-kopf"><span class="mess-label">Zuletzt</span><div class="mess-wert">${display(latest.cm)} <span>cm</span></div><div class="mess-datum">${datumKurz(latest.gemessen_am)}</div></div>` : '<p>Noch kein Taillenumfang eingetragen.</p>'}<div>${curveSvg([{ values: state.waists.map((row) => ({ datum: row.gemessen_am, wert: Number(row.cm) })), className: 'trend', points: true }], { unit: 'cm' })}</div>${infoDetails('Richtig messen', `${BODY_EXPLANATIONS.waist} Miss immer an derselben Position, stehend und nach entspannter Ausatmung.`)}</div></details>`;
}

function bodyCompMarkup(state) {
  const weight = weightTrendSummary(state.weights, state.settings.bodycomp_thresholds || undefined);
  const skinfoldDelta = confirmedTrendChange(state.skinfolds, (row) => row.total, 2);
  const waistDelta = confirmedTrendChange(state.waists, (row) => Number(row.cm), 0.5); const performance = performanceTrend(state.performance); const recovery = recoveryTrend(state.sleep, state.checkins);
  const allDates = [...state.weights.map((row) => row.gemessen_am), ...state.skinfolds.map((row) => row.gemessen_am), ...state.waists.map((row) => row.gemessen_am)].sort();
  const weeks = allDates.length > 1 ? (day(allDates.at(-1)) - day(allDates[0])) / 7 : 0;
  const result = evaluateBodyComp({ weight, skinfoldDelta, waistDelta, performanceTrend: performance.direction, recoveryTrend: recovery, weeks });
  const thresholds = { stableLoss: -0.15, slowLoss: -0.5, stableGain: 0.15, slowGain: 0.3, ...(state.settings.bodycomp_thresholds || {}) };
  const confidenceText = result.confidence === 'hoch'
    ? 'Es liegen ein dichter Gewichtstrend und mehrere ergänzende, vergleichbare Datenquellen vor.'
    : result.confidence === 'mittel'
      ? 'Der Gewichtstrend ist brauchbar, aber mindestens eine ergänzende Datenquelle fehlt noch oder ist noch nicht bestätigt.'
      : 'Zeitraum, Messhäufigkeit oder ergänzende Vergleichsdaten reichen noch nicht für eine belastbare Einordnung.';
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
      ${infoDetails(`Vertrauensstufe: ${result.confidence}`, confidenceText)}
      <details class="body-info"><summary>Einordnung und Einschränkungen<span>?</span></summary><p>${BODY_EXPLANATIONS.recovery}</p>${result.limitations.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}</details>
      <details class="mess-neu"><summary>Orientierungsbereiche anpassen</summary><form class="body-threshold-form" data-bodycomp-thresholds><p>Die Grenzen sind Orientierung und keine biologische Exaktheit.</p><label><span>Stabil ab Verlust</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(Math.abs(thresholds.stableLoss), 2)}" data-threshold-stable-loss><i>%</i></span></label><label><span>Schneller Verlust ab</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(Math.abs(thresholds.slowLoss), 2)}" data-threshold-slow-loss><i>%</i></span></label><label><span>Langsame Zunahme ab</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(thresholds.stableGain, 2)}" data-threshold-stable-gain><i>%</i></span></label><label><span>Schnelle Zunahme ab</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(thresholds.slowGain, 2)}" data-threshold-slow-gain><i>%</i></span></label><button class="btn btn-primary" type="submit">Orientierungsbereiche speichern</button></form></details>
    </div>
  </details>`;
}

function logmanMarkup(state) {
  const trend = performanceTrend(state.performance);
  return `<details class="card body-evidence-card body-data-card special-dex-list-card" data-logman-card><summary><span><b>LOGMAN-Leistung</b><small>${state.performance.length ? `${state.performance.length} Werte · ${trend.percent > 0 ? '+' : ''}${display(trend.percent)} %` : 'Noch kein Import'}</small></span>${materialIconMarkup('chevron_right')}</summary><div class="body-data-card-content"><p>${state.performance.length ? `${state.performance.length} vergleichbare HEAVYS-/MIDDLES-Werte · Trend ${trend.percent > 0 ? '+' : ''}${display(trend.percent)} %` : 'Noch keine LOGMAN-Leistungsdaten importiert.'}</p>${infoDetails('Wie wird Leistung verwendet?', `${BODY_EXPLANATIONS.performance} Importiert werden verwendetes Gewicht, Wiederholungen, geschätzte Maximalkraft, Volumen und die Anzahl vergleichbarer HEAVYS-/MIDDLES-Einheiten.`)}</div></details>`;
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
        const readings = {};
        skinfoldForm.querySelectorAll('[data-fold]').forEach((input) => {
          readings[input.dataset.fold] ||= [];
          readings[input.dataset.fold][Number(input.dataset.reading)] = input.value;
        });
        const result = aggregateSkinfoldReadings(readings);
        const total = summe(result.values);
        const message = result.thirdNeeded ? `${result.thirdNeeded} Stelle(n) weichen deutlich ab – dort eine dritte Messung ergänzen.` : `${result.complete} von 12 Stellen vollständig · Messqualität ${result.quality}`;
        skinfoldForm.querySelector('[data-skinfold-quality]').innerHTML = `${escapeHtml(message)}${total != null ? ` · <b>${display(total)} mm</b>` : ''}`;
        skinfoldForm.querySelector('button[type="submit"]').disabled = result.complete !== 12 || result.thirdNeeded > 0;
        return { result, readings };
      };
      skinfoldForm.querySelectorAll('[data-fold]').forEach((input) => { input.oninput = updateSkinfold; });
      skinfoldForm.onsubmit = async (event) => {
        event.preventDefault();
        const { result, readings } = updateSkinfold();
        if (result.complete !== 12) return;
        const date = skinfoldForm.querySelector('[data-skinfold-date]').value;
        const isNew = !state.skinfolds.some((row) => row.gemessen_am === date);
        const standardisiert = skinfoldForm.querySelector('[data-skinfold-standard]').checked;
        const quality = standardisiert && result.quality === 'hoch' ? 'hoch' : result.quality === 'hoch' ? 'mittel' : result.quality;
        const { error } = await supabase.from('skinfolds').upsert({ user_id: userId, gemessen_am: date, falten: result.values, messreihen: readings, messqualitaet: quality, standardisiert, bedingungen: { gleiche_tageszeit: standardisiert, gleiche_seite: standardisiert, gleicher_caliper: standardisiert } }, { onConflict: 'user_id,gemessen_am' });
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
