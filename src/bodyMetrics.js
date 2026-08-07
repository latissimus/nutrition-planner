import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { curveSvg } from './curve.js';
import { FALTEN, datumKurz, heute, schnitt7, summe, zahl } from './measurements.js';

async function loadSkinfolds(userId, limit = 60, signal) {
  let query = supabase
    .from('skinfolds')
    .select('gemessen_am, falten')
    .eq('user_id', userId)
    .order('gemessen_am', { ascending: true })
    .limit(limit);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ datum: row.gemessen_am, falten: row.falten, summe: summe(row.falten) }));
}

async function saveSkinfolds(userId, folds, date = heute()) {
  const { error } = await supabase
    .from('skinfolds')
    .upsert({ user_id: userId, gemessen_am: date, falten: folds }, { onConflict: 'user_id,gemessen_am' });
  if (error) throw error;
}

async function loadWeights(userId, limit = 180, signal) {
  let query = supabase
    .from('weights')
    .select('gemessen_am, kg')
    .eq('user_id', userId)
    .order('gemessen_am', { ascending: true })
    .limit(limit);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ datum: row.gemessen_am, kg: Number(row.kg) }));
}

async function saveWeight(userId, kg, date = heute()) {
  const { error } = await supabase
    .from('weights')
    .upsert({ user_id: userId, gemessen_am: date, kg }, { onConflict: 'user_id,gemessen_am' });
  if (error) throw error;
}

async function deleteMeasurements(userId) {
  const skinfolds = await supabase.from('skinfolds').delete().eq('user_id', userId);
  if (skinfolds.error) throw skinfolds.error;
  const weights = await supabase.from('weights').delete().eq('user_id', userId);
  if (weights.error) throw weights.error;
}

const delta = (newValue, oldValue, unit, lowerIsBetter = true) => {
  if (oldValue == null || newValue == null) return '';
  const diff = Math.round((newValue - oldValue) * 10) / 10;
  if (diff === 0) return '<span class="delta d-hold">= gehalten</span>';
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return `<span class="delta ${good ? 'd-up' : 'd-down'}">${diff < 0 ? '▼' : '▲'} ${Math.abs(diff).toString().replace('.', ',')} ${unit}</span>`;
};

function pageHeader() {
  return `
    <div class="seitenkopf">
      <div class="seitenkopf-text">
        <span class="seitenkopf-kicker">Körperwerte</span>
        <h1 class="section-title">Messwerte</h1>
      </div>
      <a class="zurueck" href="#home"><span class="pf">←</span> Übersicht</a>
    </div>
    <section class="seiten-einstieg">
      <b>Trend statt Tagesrauschen</b>
      <span>Gewicht, 7-Tage-Schnitt und zwölf Hautfalten im Verlauf.</span>
    </section>`;
}

export function mountBodyMetrics(container, { session, profile, onProfileUpdated, signal }) {
  const userId = session.user.id;
  container.innerHTML = `
    <div class="wrap pad-bottom">
      ${pageHeader()}
      <section class="card" data-skinfold-card>
        <h2 class="section-title mini-title">Hautfalten</h2>
        <div class="mess-kopf" data-skinfold-head>laedt...</div>
        <div data-skinfold-curve></div>
        <details class="mess-neu" open>
          <summary>Neue Messung</summary>
          <div data-skinfold-form></div>
        </details>
        <details class="mess-neu">
          <summary>Worauf achten?</summary>
          <p class="mess-hinweis">Vergleichbar wird die Messung bei gleicher Person, gleicher Tageszeit und gleichem Zustand.</p>
        </details>
        <details class="mess-neu">
          <summary>Erinnerung</summary>
          <div data-skinfold-settings></div>
        </details>
      </section>
      <section class="card" data-weight-card>
        <h2 class="section-title mini-title">Gewicht</h2>
        <div class="mess-kopf" data-weight-head>laedt...</div>
        <div data-weight-curve></div>
        <div data-weight-form></div>
      </section>
      <button class="phase-reset" type="button" data-delete-measurements>Messdaten zurücksetzen</button>
    </div>`;

  const skinfoldCard = container.querySelector('[data-skinfold-card]');
  const weightCard = container.querySelector('[data-weight-card]');
  const skinfoldForm = skinfoldCard.querySelector('[data-skinfold-form]');
  const weightForm = weightCard.querySelector('[data-weight-form]');

  async function renderSkinfolds() {
    try {
      const rows = await loadSkinfolds(userId, 60, signal);
      if (signal?.aborted) return;
      const valid = rows.filter((row) => row.summe != null);
      const last = valid[valid.length - 1];
      const previous = valid[valid.length - 2];
      skinfoldCard.querySelector('[data-skinfold-head]').innerHTML = last
        ? `<span class="mess-label">Summe</span>
           <div class="mess-wert">${last.summe.toString().replace('.', ',')} <span>mm</span>${delta(last.summe, previous?.summe, 'mm')}</div>
           <div class="mess-datum">gemessen am ${datumKurz(last.datum)}</div>`
        : '<div class="mess-leer">Noch keine Hautfalten-Messung.</div>';
      skinfoldCard.querySelector('[data-skinfold-curve]').innerHTML = curveSvg([
        { values: valid.map((row) => ({ datum: row.datum, wert: row.summe })), className: 'trend', points: true },
      ], { unit: 'mm' });
    } catch (error) {
      skinfoldCard.querySelector('[data-skinfold-head]').innerHTML = `<div class="msg err">${error.message}</div>`;
    }
  }

  skinfoldForm.innerHTML = `
    <label class="fld-l" for="skinfold-date">Datum</label>
    <input class="input" id="skinfold-date" type="date" value="${heute()}">
    <div class="falten-grid">
      ${FALTEN.map(([key, label]) => `<label class="falte"><span>${label}</span>
        <input class="input falte-in" data-fold="${key}" type="text" inputmode="decimal" placeholder="-"></label>`).join('')}
    </div>
    <div class="falten-summe" data-skinfold-sum>Summe <b>-</b></div>
    <button class="btn btn-primary btn-block" type="button" data-save-skinfolds>Messung speichern</button>`;

  const fields = [...skinfoldForm.querySelectorAll('.falte-in')];
  const updateSum = () => {
    const folds = {};
    fields.forEach((field) => { folds[field.dataset.fold] = field.value; });
    const total = summe(folds);
    const missing = fields.filter((field) => zahl(field.value) === null).length;
    skinfoldForm.querySelector('[data-skinfold-sum]').innerHTML = total != null
      ? `Summe <b>${total.toString().replace('.', ',')} mm</b>`
      : `Summe <b>-</b> <span class="mess-fehlt">noch ${missing} von 12</span>`;
    skinfoldForm.querySelector('[data-save-skinfolds]').disabled = total == null;
    return total;
  };
  fields.forEach((field) => { field.oninput = updateSum; });
  updateSum();

  skinfoldForm.querySelector('[data-save-skinfolds]').onclick = async (event) => {
    const folds = {};
    fields.forEach((field) => { folds[field.dataset.fold] = zahl(field.value); });
    if (summe(folds) == null) return;
    event.currentTarget.disabled = true;
    try {
      await saveSkinfolds(userId, folds, skinfoldForm.querySelector('#skinfold-date').value || heute());
      fields.forEach((field) => { field.value = ''; });
      updateSum();
      await renderSkinfolds();
      toast('Messung gespeichert');
    } catch (error) {
      toast('Speichern fehlgeschlagen');
    }
    updateSum();
  };

  const settings = skinfoldCard.querySelector('[data-skinfold-settings]');
  settings.innerHTML = `<div class="mess-einst">
    <label class="mess-zeile"><span>aktiv</span>
      <input type="checkbox" id="skinfold-reminder" ${profile.falten_erinnerung ? 'checked' : ''}></label>
    <label class="mess-zeile"><span>alle</span>
      <select class="input compact-input" id="skinfold-interval">
        ${[1, 2, 3, 4].map((weeks) => `<option value="${weeks}" ${profile.falten_intervall_wochen === weeks ? 'selected' : ''}>${weeks} Woche${weeks > 1 ? 'n' : ''}</option>`).join('')}
      </select></label>
    <label class="mess-zeile"><span>um</span>
      <input class="input compact-input" id="skinfold-time" type="time" value="${(profile.falten_uhrzeit || '08:00').slice(0, 5)}"></label>
  </div>`;

  const saveSettings = async () => {
    const values = {
      falten_erinnerung: settings.querySelector('#skinfold-reminder').checked,
      falten_intervall_wochen: Number(settings.querySelector('#skinfold-interval').value),
      falten_uhrzeit: settings.querySelector('#skinfold-time').value || '08:00',
      zeitzone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
    };
    const { error } = await supabase.from('profiles').update(values).eq('id', userId);
    if (error) return toast('Einstellung nicht gespeichert');
    Object.assign(profile, values);
    onProfileUpdated?.(profile);
    toast('Erinnerung gespeichert');
  };
  settings.querySelectorAll('input, select').forEach((field) => { field.onchange = saveSettings; });

  weightForm.innerHTML = `<div class="gew-eingabe">
    <input class="input" id="weight-date" type="date" value="${heute()}">
    <input class="input" id="weight-value" type="text" inputmode="decimal" placeholder="84,2">
    <span class="gew-einheit">kg</span>
    <button class="btn btn-primary" type="button" data-save-weight>Speichern</button>
  </div>`;

  async function renderWeights() {
    try {
      const rows = await loadWeights(userId, 180, signal);
      if (signal?.aborted) return;
      const trend = schnitt7(rows);
      const lastTrend = trend[trend.length - 1];
      const dayNumber = (iso) => Math.floor(new Date(`${iso}T12:00:00`).getTime() / 86400000);
      const weekBefore = trend.find((point) => lastTrend && dayNumber(lastTrend.datum) - dayNumber(point.datum) <= 7);
      weightCard.querySelector('[data-weight-head]').innerHTML = lastTrend
        ? `<span class="mess-label">7-Tage-Schnitt</span>
           <div class="mess-wert">${lastTrend.kg.toFixed(1).replace('.', ',')} <span>kg</span>${delta(lastTrend.kg, weekBefore && weekBefore !== lastTrend ? weekBefore.kg : null, 'kg')}</div>
           <div class="mess-datum">zuletzt gewogen ${datumKurz(rows[rows.length - 1].datum)}</div>`
        : '<div class="mess-leer">Noch kein Gewicht eingetragen.</div>';
      weightCard.querySelector('[data-weight-curve]').innerHTML = curveSvg([
        { values: rows.map((row) => ({ datum: row.datum, wert: row.kg })), className: 'roh' },
        { values: trend.map((row) => ({ datum: row.datum, wert: row.kg })), className: 'trend' },
      ], { unit: 'kg' });
      const today = rows.find((row) => row.datum === heute());
      if (today) weightForm.querySelector('#weight-value').value = today.kg.toFixed(1).replace('.', ',');
    } catch (error) {
      weightCard.querySelector('[data-weight-head]').innerHTML = `<div class="msg err">${error.message}</div>`;
    }
  }

  weightForm.querySelector('[data-save-weight]').onclick = async (event) => {
    const kg = zahl(weightForm.querySelector('#weight-value').value);
    if (kg == null || kg <= 0 || kg >= 500) return toast('Bitte ein Gewicht in kg eintragen');
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await saveWeight(userId, kg, weightForm.querySelector('#weight-date').value || heute());
      await renderWeights();
      toast('Gewicht gespeichert');
    } catch (error) {
      toast('Speichern fehlgeschlagen');
    }
    if (button.isConnected) button.disabled = false;
  };

  container.querySelector('[data-delete-measurements]').onclick = async (event) => {
    if (!confirm('Alle Hautfalten- und Gewichts-Messungen loeschen?')) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await deleteMeasurements(userId);
      weightForm.querySelector('#weight-value').value = '';
      await renderSkinfolds();
      await renderWeights();
      toast('Messdaten zurueckgesetzt');
    } catch (error) {
      toast('Zuruecksetzen fehlgeschlagen');
    }
    if (button.isConnected) button.disabled = false;
  };

  return Promise.all([renderSkinfolds(), renderWeights()]);
}
