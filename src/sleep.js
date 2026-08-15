import { supabase } from './supabase.js';
import { categoryColor, materialIconMarkup } from './categoryIcons.js';
import { openMeditationTimer, openSleepSoundTimer } from './meditationTimer.js';
import { setRoutineCompletion } from './routineCompletion.js';
import { subscribeToTableChanges } from './realtime.js';
import { toast } from './toast.js';

const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const TAGS = ['Meditation', 'Spätes Koffein', 'Spät gegessen', 'Alkohol', 'Spätes Training', 'Bildschirm', 'Stress', 'Abendroutine'];
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const pad = (value) => String(value).padStart(2, '0');
const localDate = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function timeToMinutes(value) {
  const [hours, minutes] = String(value || '00:00').slice(0, 5).split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

export function sleepDurationMinutes(bedtime, wakeTime) {
  const start = timeToMinutes(bedtime);
  let end = timeToMinutes(wakeTime);
  if (end <= start) end += 24 * 60;
  return Math.max(0, Math.min(24 * 60, end - start));
}

const durationLabel = (minutes) => `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min`;
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const qualityLabel = (value) => ['–', 'Sehr schlecht', 'Schlecht', 'Okay', 'Gut', 'Sehr gut'][value] || '–';

export function calculateSleepSummary(logs = []) {
  if (!logs.length) return { averageMinutes: 0, averageQuality: 0, averageEnergy: 0, consistencyMinutes: 0 };
  const bedtimes = logs.map((log) => {
    const minutes = timeToMinutes(log.bedtime);
    return minutes < 12 * 60 ? minutes + 24 * 60 : minutes;
  });
  const bedAverage = mean(bedtimes);
  return {
    averageMinutes: Math.round(mean(logs.map((log) => sleepDurationMinutes(log.bedtime, log.wake_time)))),
    averageQuality: mean(logs.map((log) => Number(log.quality))),
    averageEnergy: mean(logs.map((log) => Number(log.energy))),
    consistencyMinutes: Math.round(mean(bedtimes.map((value) => Math.abs(value - bedAverage)))),
  };
}

export function analyzeSleepTrends(logs = []) {
  if (logs.length < 6) return ['Nach sechs Morgen-Check-ins kann MUSCLE-DEX erste persönliche Zusammenhänge zeigen.'];
  const hints = [];
  TAGS.forEach((tag) => {
    const tagged = logs.filter((log) => (log.tags || []).includes(tag));
    const others = logs.filter((log) => !(log.tags || []).includes(tag));
    if (tagged.length < 3 || others.length < 3) return;
    const taggedQuality = mean(tagged.map((log) => Number(log.quality)));
    const otherQuality = mean(others.map((log) => Number(log.quality)));
    const difference = taggedQuality - otherQuality;
    if (Math.abs(difference) < 0.4) return;
    hints.push(`An Tagen mit „${tag}“ war deine Schlafqualität im Schnitt ${Math.abs(difference).toFixed(1).replace('.', ',')} Punkte ${difference > 0 ? 'höher' : 'niedriger'}.`);
  });
  const adjusted = logs.map((log) => {
    const value = timeToMinutes(log.bedtime);
    return { ...log, adjustedBedtime: value < 720 ? value + 1440 : value };
  });
  const averageBedtime = mean(adjusted.map((log) => log.adjustedBedtime));
  const regular = adjusted.filter((log) => Math.abs(log.adjustedBedtime - averageBedtime) <= 30);
  const irregular = adjusted.filter((log) => Math.abs(log.adjustedBedtime - averageBedtime) > 30);
  if (regular.length >= 3 && irregular.length >= 3) {
    const difference = mean(regular.map((log) => Number(log.energy))) - mean(irregular.map((log) => Number(log.energy)));
    if (difference >= 0.4) hints.push(`Bei einer Schlafenszeit innerhalb von 30 Minuten um deinen üblichen Rhythmus war deine Morgenenergie durchschnittlich ${difference.toFixed(1).replace('.', ',')} Punkte höher.`);
  }
  return hints.length ? hints.slice(0, 3) : ['Deine bisherigen Daten zeigen noch keinen klaren Zusammenhang. Weitere Check-ins machen die Auswertung aussagekräftiger.'];
}

function defaultSchedule(userId, weekday) {
  const weekend = weekday === 0 || weekday === 6;
  return { user_id: userId, weekday, bedtime: weekend ? '23:00' : '22:30', wake_time: weekend ? '07:30' : '06:30', active: true };
}

async function ensureSleepData(userId, signal) {
  let settingsQuery = supabase.from('sleep_settings').select('*').eq('user_id', userId).maybeSingle();
  let schedulesQuery = supabase.from('sleep_schedules').select('*').eq('user_id', userId).order('weekday');
  if (signal) { settingsQuery = settingsQuery.abortSignal(signal); schedulesQuery = schedulesQuery.abortSignal(signal); }
  let [{ data: settings, error: settingsError }, { data: schedules, error: scheduleError }] = await Promise.all([settingsQuery, schedulesQuery]);
  if (settingsError) throw settingsError;
  if (scheduleError) throw scheduleError;
  if (!settings) {
    const response = await supabase.from('sleep_settings').insert({ user_id: userId }).select('*').single();
    if (response.error) throw response.error;
    settings = response.data;
  }
  const present = new Set((schedules || []).map((item) => item.weekday));
  const missing = Array.from({ length: 7 }, (_, weekday) => weekday).filter((weekday) => !present.has(weekday));
  if (missing.length) {
    const response = await supabase.from('sleep_schedules').insert(missing.map((weekday) => defaultSchedule(userId, weekday))).select('*');
    if (response.error) throw response.error;
    schedules = [...(schedules || []), ...(response.data || [])].sort((a, b) => a.weekday - b.weekday);
  }
  return { settings, schedules };
}

async function loadState(userId, signal) {
  const sleep = await ensureSleepData(userId, signal);
  let logsQuery = supabase.from('sleep_logs').select('*').eq('user_id', userId).order('sleep_date', { ascending: false }).limit(90);
  let routinesQuery = supabase.from('routines').select('*').eq('user_id', userId).eq('period', 'evening').eq('active', true).order('position');
  let completionsQuery = supabase.from('routine_completions').select('routine_id').eq('user_id', userId).eq('completed_on', localDate());
  if (signal) {
    logsQuery = logsQuery.abortSignal(signal); routinesQuery = routinesQuery.abortSignal(signal); completionsQuery = completionsQuery.abortSignal(signal);
  }
  const [{ data: logs, error: logsError }, { data: routines, error: routinesError }, { data: completions, error: completionsError }] = await Promise.all([logsQuery, routinesQuery, completionsQuery]);
  if (logsError) throw logsError;
  if (routinesError) throw routinesError;
  if (completionsError) throw completionsError;
  return { ...sleep, logs: logs || [], routines: routines || [], completed: new Set((completions || []).map((item) => item.routine_id)) };
}

function closeOverlay(backdrop) { backdrop?.remove(); }

function planEditor({ userId, state, onSaved }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop sleep-overlay';
  backdrop.style.setProperty('--ordner', categoryColor('sleep'));
  const byDay = new Map(state.schedules.map((item) => [item.weekday, item]));
  backdrop.innerHTML = `<section class="kategorie-sheet sleep-editor" role="dialog" aria-modal="true" aria-label="Schlafplan bearbeiten">
    <header><h2>Schlafplan</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <form data-sleep-plan-form>
      <div class="sleep-plan-grid"><span>Tag</span><span>Schlafen</span><span>Aufstehen</span><span>Aktiv</span>
        ${DAY_ORDER.map((weekday) => { const item = byDay.get(weekday) || defaultSchedule(userId, weekday); return `<b>${DAYS[weekday].slice(0, 2)}</b><input class="input" type="time" data-bedtime="${weekday}" value="${String(item.bedtime).slice(0, 5)}"><input class="input" type="time" data-wake="${weekday}" value="${String(item.wake_time).slice(0, 5)}"><label class="sleep-mini-switch"><input type="checkbox" data-day-active="${weekday}"${item.active ? ' checked' : ''}><span></span></label>`; }).join('')}
      </div>
      <label class="dex-entry-field"><span>Runterfahren vorher</span><select class="input" data-wind-down>${[15, 30, 45, 60, 90].map((value) => `<option value="${value}"${state.settings.wind_down_minutes === value ? ' selected' : ''}>${value} Minuten</option>`).join('')}</select></label>
      <div class="sleep-reminder-switches">
        <label class="sleep-setting-switch"><span>Runterfahren erinnern</span><input type="checkbox" data-wind-reminder${state.settings.wind_down_reminder ? ' checked' : ''}><span class="sleep-switch-track" aria-hidden="true"></span></label>
        <label class="sleep-setting-switch"><span>Schlafenszeit erinnern</span><input type="checkbox" data-bed-reminder${state.settings.bedtime_reminder ? ' checked' : ''}><span class="sleep-switch-track" aria-hidden="true"></span></label>
        <label class="sleep-setting-switch"><span>Morgen-Check-in erinnern</span><input type="checkbox" data-morning-reminder${state.settings.morning_reminder ? ' checked' : ''}><span class="sleep-switch-track" aria-hidden="true"></span></label>
      </div>
      <p class="sleep-editor-note">Push wird über die Benachrichtigungseinstellung im MAHLZEITEN-DEX aktiviert.</p>
      <button class="btn btn-primary btn-block" type="submit">Schlafplan speichern</button>
    </form>
  </section>`;
  backdrop.onclick = (event) => { if (event.target === backdrop || event.target.closest('[data-sheet-close]')) closeOverlay(backdrop); };
  backdrop.querySelector('form').onsubmit = async (event) => {
    event.preventDefault();
    const submit = event.submitter; submit.disabled = true;
    const settings = {
      user_id: userId,
      wind_down_minutes: Number(backdrop.querySelector('[data-wind-down]').value),
      wind_down_reminder: backdrop.querySelector('[data-wind-reminder]').checked,
      bedtime_reminder: backdrop.querySelector('[data-bed-reminder]').checked,
      morning_reminder: backdrop.querySelector('[data-morning-reminder]').checked,
    };
    const schedules = DAYS.map((_, weekday) => ({
      user_id: userId, weekday,
      bedtime: backdrop.querySelector(`[data-bedtime="${weekday}"]`).value,
      wake_time: backdrop.querySelector(`[data-wake="${weekday}"]`).value,
      active: backdrop.querySelector(`[data-day-active="${weekday}"]`).checked,
    }));
    const [settingsResult, scheduleResult] = await Promise.all([
      supabase.from('sleep_settings').upsert(settings).select(),
      supabase.from('sleep_schedules').upsert(schedules, { onConflict: 'user_id,weekday' }).select(),
    ]);
    if (settingsResult.error || scheduleResult.error) { toast('Schlafplan konnte nicht gespeichert werden.'); submit.disabled = false; return; }
    closeOverlay(backdrop); toast('Schlafplan gespeichert'); await onSaved?.();
  };
  document.body.append(backdrop);
}

function ratingField(name, label, value, symbols) {
  return `<fieldset class="sleep-rating"><legend>${label}</legend><div>${symbols.map((symbol, index) => { const score = index + 1; return `<label><input type="radio" name="${name}" value="${score}"${Number(value || 3) === score ? ' checked' : ''}><span title="${score} von 5">${symbol}</span></label>`; }).join('')}</div></fieldset>`;
}

function checkinEditor({ userId, state, existing = null, onSaved }) {
  const date = existing?.sleep_date || localDate();
  const wakeDay = new Date(`${date}T12:00:00`).getDay();
  const schedule = state.schedules.find((item) => item.weekday === (wakeDay + 6) % 7) || state.schedules[0];
  const selectedTags = new Set(existing?.tags || []);
  const customTags = [...selectedTags].filter((tag) => !TAGS.includes(tag));
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop sleep-overlay';
  backdrop.style.setProperty('--ordner', categoryColor('sleep'));
  backdrop.innerHTML = `<section class="kategorie-sheet sleep-editor sleep-checkin-editor" role="dialog" aria-modal="true" aria-label="Morgen-Check-in">
    <header><div><small>+3 MUSCLE-COINS</small><h2>Morgen-Check-in</h2></div><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <form data-sleep-checkin-form>
      <label class="dex-entry-field"><span>Datum</span><input class="input" type="date" data-sleep-date value="${date}" required></label>
      <div class="sleep-time-pair"><label class="dex-entry-field"><span>Eingeschlafen</span><input class="input" type="time" data-sleep-bedtime value="${String(existing?.bedtime || schedule?.bedtime || '22:30').slice(0, 5)}" required></label><label class="dex-entry-field"><span>Aufgewacht</span><input class="input" type="time" data-sleep-wake value="${String(existing?.wake_time || schedule?.wake_time || '06:30').slice(0, 5)}" required></label></div>
      ${ratingField('quality', 'Schlafqualität', existing?.quality, ['😫', '😕', '😐', '🙂', '🤩'])}
      ${ratingField('energy', 'Energie am Morgen', existing?.energy, ['🪫', '🥱', '😐', '⚡', '🚀'])}
      <label class="dex-entry-field"><span>Wachphasen</span><input class="input" type="number" inputmode="numeric" min="0" max="30" data-awakenings value="${existing?.awakenings ?? 0}"></label>
      <fieldset class="sleep-tags"><legend>Einflüsse</legend><div>${TAGS.map((tag) => `<label><input type="checkbox" value="${tag}"${selectedTags.has(tag) ? ' checked' : ''}><span>${tag}</span></label>`).join('')}</div><input class="input" data-custom-tags value="${escapeHtml(customTags.join(', '))}" placeholder="Eigene Tags, durch Komma getrennt"></fieldset>
      <label class="dex-entry-field"><span>Notiz <small>optional</small></span><textarea class="input" rows="3" maxlength="1000" data-sleep-note placeholder="Was war anders als sonst?">${escapeHtml(existing?.note || '')}</textarea></label>
      <button class="btn btn-primary btn-block" type="submit">Check-in speichern</button>
      ${existing ? '<button class="btn btn-block sleep-delete" type="button" data-sleep-delete>Eintrag löschen</button>' : ''}
    </form>
  </section>`;
  backdrop.onclick = (event) => { if (event.target === backdrop || event.target.closest('[data-sheet-close]')) closeOverlay(backdrop); };
  backdrop.querySelector('form').onsubmit = async (event) => {
    event.preventDefault();
    const submit = event.submitter; submit.disabled = true;
    const presets = [...backdrop.querySelectorAll('.sleep-tags input[type="checkbox"]:checked')].map((input) => input.value);
    const custom = backdrop.querySelector('[data-custom-tags]').value.split(',').map((tag) => tag.trim()).filter(Boolean);
    const payload = {
      user_id: userId,
      sleep_date: backdrop.querySelector('[data-sleep-date]').value,
      bedtime: backdrop.querySelector('[data-sleep-bedtime]').value,
      wake_time: backdrop.querySelector('[data-sleep-wake]').value,
      quality: Number(backdrop.querySelector('[name="quality"]:checked').value),
      energy: Number(backdrop.querySelector('[name="energy"]:checked').value),
      awakenings: Number(backdrop.querySelector('[data-awakenings]').value || 0),
      tags: [...new Set([...presets, ...custom])].slice(0, 20),
      note: backdrop.querySelector('[data-sleep-note]').value.trim(),
    };
    const result = await supabase.from('sleep_logs').upsert(payload, { onConflict: 'user_id,sleep_date' }).select().single();
    if (result.error) { toast('Check-in konnte nicht gespeichert werden.'); submit.disabled = false; return; }
    closeOverlay(backdrop); toast(existing ? 'Check-in aktualisiert' : 'Check-in gespeichert · +3 MUSCLE-COINS'); await onSaved?.();
  };
  backdrop.querySelector('[data-sleep-delete]')?.addEventListener('click', async () => {
    if (!confirm('Diesen Schlaf-Eintrag wirklich löschen?')) return;
    const { error } = await supabase.from('sleep_logs').delete().eq('id', existing.id).eq('user_id', userId);
    if (error) return toast('Eintrag konnte nicht gelöscht werden.');
    closeOverlay(backdrop); toast('Schlaf-Eintrag gelöscht'); await onSaved?.();
  });
  document.body.append(backdrop);
}

function actionsMenu({ userId, state, onSaved }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop sleep-overlay';
  backdrop.style.setProperty('--ordner', categoryColor('sleep'));
  backdrop.innerHTML = `<section class="kategorie-sheet sleep-action-card" role="dialog" aria-modal="true" aria-label="SLEEP ergänzen"><header><h2>SLEEP</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header><div class="sheet-menue"><button type="button" data-sleep-action="checkin">${materialIconMarkup('bedtime')}<span><b>Morgen-Check-in</b><small>Schlaf und Energie festhalten</small></span></button><button type="button" data-sleep-action="plan">${materialIconMarkup('alarm')}<span><b>Schlafplan</b><small>Zeiten und Erinnerungen einstellen</small></span></button><button type="button" data-sleep-action="sound">${materialIconMarkup('dark_mode')}<span><b>Schlafsound</b><small>Mit Abschalttimer und Ausblenden</small></span></button><button type="button" data-sleep-action="routines">${materialIconMarkup('self_improvement')}<span><b>Abendroutine</b><small>Meditation und Routinen öffnen</small></span></button></div></section>`;
  const close = () => closeOverlay(backdrop);
  backdrop.onclick = (event) => {
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) return close();
    const action = event.target.closest('[data-sleep-action]')?.dataset.sleepAction;
    if (!action) return;
    close();
    if (action === 'checkin') checkinEditor({ userId, state, onSaved });
    if (action === 'plan') planEditor({ userId, state, onSaved });
    if (action === 'sound') openSleepSoundTimer();
    if (action === 'routines') location.hash = 'habits';
  };
  document.body.append(backdrop);
}

function planForTonight(schedules, now = new Date()) {
  return schedules.find((item) => item.weekday === now.getDay()) || schedules[0];
}

function chartMarkup(logs) {
  const points = [...logs].slice(0, 14).reverse();
  if (points.length < 2) return '<div class="sleep-chart-empty">Ab dem zweiten Check-in erscheint hier dein Verlauf.</div>';
  const durations = points.map((log) => sleepDurationMinutes(log.bedtime, log.wake_time));
  const min = Math.min(...durations, 360); const max = Math.max(...durations, 600); const range = Math.max(60, max - min);
  const coordinates = durations.map((value, index) => `${10 + (index / (durations.length - 1)) * 280},${100 - ((value - min) / range) * 80}`).join(' ');
  return `<svg class="sleep-chart" viewBox="0 0 300 120" role="img" aria-label="Schlafdauer der letzten ${points.length} Nächte"><line x1="10" y1="100" x2="290" y2="100"></line><polyline points="${coordinates}"></polyline>${coordinates.split(' ').map((point) => { const [x, y] = point.split(','); return `<circle cx="${x}" cy="${y}" r="4"></circle>`; }).join('')}</svg>`;
}

function routineMarkup(routine, completed) {
  const icon = String(routine.icon || '').replace(/^emoji:/, '') || '✓';
  return `<article class="sleep-routine${completed ? ' erledigt' : ''}" data-sleep-routine="${routine.id}"><button type="button" data-sleep-routine-check aria-label="${escapeHtml(routine.name)} ${completed ? 'wieder öffnen' : 'erledigen'}"><span>${completed ? materialIconMarkup('check_small') : ''}</span></button><i>${escapeHtml(icon)}</i><p><b>${escapeHtml(routine.name)}</b><small>${routine.time ? String(routine.time).slice(0, 5) : 'Abends'}${routine.duration_minutes ? ` · ${routine.duration_minutes} min` : ''}</small></p>${routine.template_type === 'meditation' && routine.duration_minutes ? `<button type="button" data-sleep-meditation aria-label="Meditation starten">${materialIconMarkup('play_arrow')}</button>` : ''}</article>`;
}

function bestStreak(logs) {
  const dates = [...new Set(logs.map((log) => log.sleep_date))].sort();
  let best = 0; let current = 0; let previous = null;
  dates.forEach((value) => {
    const date = new Date(`${value}T12:00:00`);
    const distance = previous ? Math.round((date - previous) / 86_400_000) : 1;
    current = distance === 1 ? current + 1 : 1;
    best = Math.max(best, current); previous = date;
  });
  return best;
}

function render(container, userId, state, refresh) {
  const tonight = planForTonight(state.schedules);
  const week = state.logs.slice(0, 7);
  const summary = calculateSleepSummary(week);
  const month = state.logs.slice(0, 30);
  const monthSummary = calculateSleepSummary(month);
  const latest = state.logs[0];
  const trends = analyzeSleepTrends(state.logs.slice(0, 30));
  const duration = tonight ? sleepDurationMinutes(tonight.bedtime, tonight.wake_time) : 0;
  const content = container.querySelector('[data-sleep-content]');
  content.innerHTML = `
    <section class="sleep-tonight">
      <div class="sleep-card-icon">${materialIconMarkup('dark_mode')}</div><div><small>HEUTE NACHT</small><strong>${tonight?.active ? `${String(tonight.bedtime).slice(0, 5)} → ${String(tonight.wake_time).slice(0, 5)}` : 'Kein Plan'}</strong><span>${tonight?.active ? `${durationLabel(duration)} · ${state.settings.wind_down_minutes} min vorher runterfahren` : 'Für diese Nacht ist der Plan pausiert.'}</span></div>
      <button type="button" data-edit-sleep-plan aria-label="Schlafplan bearbeiten">${materialIconMarkup('build')}</button>
    </section>
    <section class="sleep-section">
      <header><div class="sleep-section-title">${materialIconMarkup('coffee')}<h2>Morgen-Check-in</h2></div></header>
      ${latest ? `<button class="sleep-latest" type="button" data-edit-sleep-log="${latest.id}"><span><b>${new Date(`${latest.sleep_date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</b><small>${durationLabel(sleepDurationMinutes(latest.bedtime, latest.wake_time))}</small></span><span><b>${latest.quality}/5</b><small>${qualityLabel(latest.quality)}</small></span><span><b>${latest.energy}/5</b><small>Energie</small></span>${materialIconMarkup('chevron_right')}</button>` : '<div class="sleep-empty">Noch kein Morgen-Check-in. Dein erster Eintrag bringt 3 MUSCLE-COINS.</div>'}
    </section>
    <section class="sleep-section">
      <header><div class="sleep-section-title">${materialIconMarkup('self_improvement')}<h2>Abendroutinen</h2></div></header>
      <div class="sleep-routines">${state.routines.length ? state.routines.map((routine) => routineMarkup(routine, state.completed.has(routine.id))).join('') : '<div class="sleep-empty">Lege im ROUTINEN-DEX eine Abendroutine oder Meditation an.</div>'}</div>
    </section>
    <section class="sleep-section sleep-progress">
      <header><div class="sleep-section-title">${materialIconMarkup('stat_1')}<h2>7-Tage-Verlauf</h2></div><small>${week.length} von 7 Nächten</small></header>
      <div class="sleep-stats"><div><strong>${summary.averageMinutes ? durationLabel(summary.averageMinutes) : '–'}</strong><small>Ø Schlaf</small></div><div><strong>${summary.averageQuality ? summary.averageQuality.toFixed(1).replace('.', ',') : '–'}</strong><small>Ø Qualität</small></div><div><strong>${summary.consistencyMinutes || '–'}${summary.consistencyMinutes ? ' min' : ''}</strong><small>Abweichung</small></div></div>
      ${chartMarkup(week)}
      <div class="sleep-month"><span><b>30-Tage-Blick</b><small>${month.length} Check-ins</small></span><span><b>${monthSummary.averageMinutes ? durationLabel(monthSummary.averageMinutes) : '–'}</b><small>Ø Schlaf</small></span><span><b>${bestStreak(state.logs)} Tage</b><small>Beste Serie</small></span></div>
    </section>
    <section class="sleep-section sleep-insights">
      <header><div class="sleep-section-title">${materialIconMarkup('bolt')}<h2>Deine Zusammenhänge</h2></div><small>Beobachtete Trends, keine medizinischen Ursachen</small></header>
      <div>${trends.map((hint) => `<p>${materialIconMarkup('stat_1')}<span>${escapeHtml(hint)}</span></p>`).join('')}</div>
    </section>
    ${state.logs.length ? `<section class="sleep-section sleep-history"><header><div class="sleep-section-title">${materialIconMarkup('calendar_meal')}<h2>Letzte Nächte</h2></div></header><div>${state.logs.slice(0, 14).map((log) => `<button type="button" data-edit-sleep-log="${log.id}"><span><b>${new Date(`${log.sleep_date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</b><small>${String(log.bedtime).slice(0, 5)} → ${String(log.wake_time).slice(0, 5)}</small></span><strong>${durationLabel(sleepDurationMinutes(log.bedtime, log.wake_time))}</strong><em>${'★'.repeat(log.quality)}${'☆'.repeat(5 - log.quality)}</em></button>`).join('')}</div></section>` : ''}`;

  content.querySelector('[data-edit-sleep-plan]').onclick = () => planEditor({ userId, state, onSaved: refresh });
  content.querySelectorAll('[data-edit-sleep-log]').forEach((button) => { button.onclick = () => checkinEditor({ userId, state, existing: state.logs.find((log) => log.id === button.dataset.editSleepLog), onSaved: refresh }); });
  content.querySelector('.sleep-routines')?.addEventListener('click', async (event) => {
    const row = event.target.closest('[data-sleep-routine]');
    const routine = state.routines.find((item) => item.id === row?.dataset.sleepRoutine);
    if (!routine) return;
    if (event.target.closest('[data-sleep-meditation]')) return openMeditationTimer({ userId, routine, onCompleted: refresh });
    if (!event.target.closest('[data-sleep-routine-check]')) return;
    const completed = state.completed.has(routine.id);
    try { await setRoutineCompletion({ routineId: routine.id, completed: !completed }); await refresh(); }
    catch { toast('Routine konnte nicht aktualisiert werden.'); }
  });
}

export async function mountSleepDex(container, { userId, signal, mountChrome }) {
  const color = categoryColor('sleep');
  container.innerHTML = `<div class="wrap pad-bottom sleep-dex-page"><div class="seitenkopf"><h1>SLEEP</h1></div><div data-sleep-content><div class="daten-laden">Schlafdaten werden geladen …</div></div></div>`;
  let state = await loadState(userId, signal);
  if (signal?.aborted) return;
  const refresh = async () => {
    state = await loadState(userId, signal);
    if (!signal?.aborted) render(container, userId, state, refresh);
  };
  mountChrome(container, 'sleep', 'SLEEP', {
    color, pageLookScope: 'sleep', pageLookPattern: 'drops',
    meta: state.logs.length ? `${state.logs.length} Nächte` : 'Schlaf planen',
    onPlus: () => actionsMenu({ userId, state, onSaved: refresh }),
  });
  render(container, userId, state, refresh);
  subscribeToTableChanges({ table: 'sleep_logs', signal, onChange: refresh, onError: () => {} });
  subscribeToTableChanges({ table: 'sleep_schedules', signal, onChange: refresh, onError: () => {} });
}
