import { supabase } from './supabase.js';
import { categoryColor, colorIsDark, materialIconMarkup } from './categoryIcons.js';
import { chooseReminderIcon, reminderIconMarkup } from './reminders.js';
import { dexEntryOverviewMarkup, loadDexEntries, openDexEntryEditor, vorschaubilderEinblenden } from './dexEntries.js';
import { editEntry } from './dexEntryDetail.js';
import { bindLongPress } from './longPress.js';
import { maybePromptExternalMeditation, meditationSounds, openMeditationTimer, previewMeditationSound } from './meditationTimer.js';
import { toast } from './toast.js';
import { routineCoinValue, syncRoutineCoins } from './coinDex.js';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const periods = [
  ['morning', 'Morgens', '07:00'], ['midday', 'Mittags', '12:00'], ['evening', 'Abends', '19:00'],
];
const days = [['1', 'Mo'], ['2', 'Di'], ['3', 'Mi'], ['4', 'Do'], ['5', 'Fr'], ['6', 'Sa'], ['7', 'So']];
const today = () => new Date().toLocaleDateString('sv-SE');
const defaultMobilityExercises = [
  { name: 'Cat-Cow', prescription: '8–10 Wiederholungen' },
  { name: '90/90 Hip Switches', prescription: '8 pro Seite' },
  { name: 'World’s Greatest Stretch', prescription: '4 pro Seite' },
  { name: 'Deep Squat Hold', prescription: '45 Sekunden' },
];

function normalizeMobilityExercises(value, useDefaults = true) {
  const entries = Array.isArray(value) ? value.map((item) => ({
    name: String(item?.name || '').trim().slice(0, 100),
    prescription: String(item?.prescription || '').trim().slice(0, 100),
  })).filter((item) => item.name) : [];
  return entries.length || !useDefaults ? entries : defaultMobilityExercises.map((item) => ({ ...item }));
}

function mobilityExerciseRowMarkup(item = { name: '', prescription: '' }) {
  return `<div class="mobility-exercise-row" data-mobility-exercise>
    <input class="input" data-mobility-name maxlength="100" value="${escapeHtml(item.name)}" placeholder="Übung" required>
    <input class="input" data-mobility-prescription maxlength="100" value="${escapeHtml(item.prescription)}" placeholder="z. B. 8 pro Seite">
    <button type="button" data-mobility-remove aria-label="Übung entfernen">${materialIconMarkup('close')}</button>
  </div>`;
}

async function load(userId, signal) {
  let routinesQuery = supabase.from('routines').select('*').eq('user_id', userId).order('position');
  let completionsQuery = supabase.from('routine_completions').select('routine_id,completed_on').eq('user_id', userId).eq('completed_on', today());
  if (signal) { routinesQuery = routinesQuery.abortSignal(signal); completionsQuery = completionsQuery.abortSignal(signal); }
  const [{ data: routines, error }, { data: completions, error: completionError }, attachments] = await Promise.all([
    routinesQuery, completionsQuery, loadDexEntries(userId, { rootKey: 'habits', signal }),
  ]);
  if (error) throw error;
  if (completionError) throw completionError;
  return {
    routines: routines || [], completed: new Set((completions || []).map((item) => item.routine_id)),
    attachments: (attachments || []).filter((entry) => entry.routine_id),
  };
}

function editor(userId, { existing = null, templateType = 'custom', onSaved }) {
  const selectedTemplate = existing?.template_type || templateType;
  const meditation = selectedTemplate === 'meditation';
  const mobility = selectedTemplate === 'mobility';
  const fixedTimerTemplate = ['meditation', 'mobility', 'walk'].includes(selectedTemplate);
  const customTimerEnabled = selectedTemplate === 'custom' && Number(existing?.duration_minutes || 0) > 0;
  const durationOptions = selectedTemplate === 'meditation' ? [2, 5, 10, 15, 20]
    : selectedTemplate === 'mobility' ? [5, 10, 15, 20]
      : selectedTemplate === 'walk' ? [15, 30, 45, 60] : [5, 10, 15, 20];
  const defaultDuration = selectedTemplate === 'walk' ? 15 : 5;
  const selectedDuration = Number(existing?.duration_minutes || defaultDuration);
  const customDuration = selectedTemplate === 'custom' && !durationOptions.includes(selectedDuration) ? selectedDuration : '';
  const mobilityExercises = normalizeMobilityExercises(existing?.mobility_exercises, mobility);
  const defaultName = meditation ? 'Meditation' : selectedTemplate === 'mobility' ? 'Mobility' : selectedTemplate === 'walk' ? 'Spaziergang' : '';
  const defaultIcon = meditation ? 'emoji:🧘' : selectedTemplate === 'mobility' ? 'emoji:🤸' : selectedTemplate === 'walk' ? 'emoji:🚶' : 'emoji:✓';
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop routine-editor-backdrop';
  backdrop.style.setProperty('--ordner', categoryColor('habits'));
  backdrop.style.setProperty('--ordner-ink', colorIsDark(categoryColor('habits')) ? '#fff' : '#000');
  const selectedDays = new Set((existing?.weekdays || [1, 2, 3, 4, 5, 6, 7]).map(String));
  backdrop.innerHTML = `<section class="kategorie-sheet routine-editor${selectedTemplate === 'custom' ? '' : ' routine-template-editor'}" role="dialog" aria-modal="true" aria-label="Routine ${existing ? 'bearbeiten' : 'hinzufügen'}">
    <header><h2>${existing ? 'Routine bearbeiten' : 'Neue Routine'}</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <form data-routine-form>
      <div class="routine-name-row">
        <div class="dex-entry-field routine-icon-field"><span>Icon</span>
          <button type="button" class="rem-icon-waehler" data-routine-icon-open aria-label="Icon auswählen">${reminderIconMarkup(existing?.icon || defaultIcon)}</button>
          <input type="hidden" data-routine-icon value="${escapeHtml(existing?.icon || defaultIcon)}">
        </div>
        <label class="dex-entry-field"><span>Name</span><input class="input" data-routine-name maxlength="100" value="${escapeHtml(existing?.name || defaultName)}" placeholder="z. B. 10 Minuten Mobility" required></label>
      </div>
      ${fixedTimerTemplate ? `<fieldset class="routine-duration"><legend>Dauer</legend><div>${durationOptions.map((minutes) => `<button type="button" data-routine-duration="${minutes}" class="${selectedDuration === minutes ? 'aktiv' : ''}">${minutes} min</button>`).join('')}</div></fieldset>` : `
      <section class="custom-timer-settings">
        <label class="mess-zeile"><span>Timer verwenden</span><input type="checkbox" data-routine-timer-enabled${customTimerEnabled ? ' checked' : ''}></label>
        <fieldset class="routine-duration" data-custom-timer-duration${customTimerEnabled ? '' : ' hidden'}><legend>Dauer</legend>
          <div>${durationOptions.map((minutes) => `<button type="button" data-routine-duration="${minutes}" class="${selectedDuration === minutes ? 'aktiv' : ''}">${minutes} min</button>`).join('')}</div>
          <label class="custom-duration-input"><span>Eigene Zeit</span><span><input class="input" type="number" inputmode="numeric" min="1" max="240" step="1" data-routine-custom-duration value="${customDuration}" placeholder="z. B. 12"><i>min</i></span></label>
        </fieldset>
      </section>`}
      ${meditation ? `<section class="meditation-editor-settings">
        <label class="dex-entry-field"><span>Externer Meditationslink <small>optional</small></span><input class="input" type="text" inputmode="url" data-routine-external-url value="${escapeHtml(existing?.external_url || '')}" placeholder="Headspace, Calm, YouTube …"></label>
        <div class="dex-entry-field"><span>Hintergrundsound</span><div class="meditation-sound-picker"><select class="input" data-routine-ambient>
          ${meditationSounds.map(([value, label]) => `<option value="${value}"${(existing?.ambient_sound || 'off') === value ? ' selected' : ''}>${label}</option>`).join('')}
        </select><button class="btn" type="button" data-sound-preview>${materialIconMarkup('play_arrow')}<span>Anhören</span></button></div></div>
        <label class="meditation-volume"><span>Hintergrundlautstärke <output data-ambient-output>${Math.round(Number(existing?.ambient_volume ?? 0.35) * 100)} %</output></span><input type="range" min="0" max="1" step="0.05" value="${Number(existing?.ambient_volume ?? 0.35)}" data-routine-ambient-volume></label>
        <label class="meditation-volume"><span>Start-/Endsignal <output data-gong-output>${Math.round(Number(existing?.gong_volume ?? 0.7) * 100)} %</output></span><input type="range" min="0" max="1" step="0.05" value="${Number(existing?.gong_volume ?? 0.7)}" data-routine-gong-volume></label>
      </section>` : ''}
      ${mobility ? `<section class="mobility-editor-settings">
        <header><span><b>Übungsablauf</b><small>Reihenfolge, Wiederholungen oder Dauer genau festlegen.</small></span><button type="button" data-mobility-add><b>+</b><span>Übung</span></button></header>
        <div class="mobility-exercise-list" data-mobility-list>${mobilityExercises.map(mobilityExerciseRowMarkup).join('')}</div>
      </section>` : ''}
      <div class="routine-plan-row">
        <label class="dex-entry-field"><span>Tageszeit</span><select class="input" data-routine-period>${periods.map(([key, label]) => `<option value="${key}"${existing?.period === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
        <label class="dex-entry-field"><span>Uhrzeit</span><input class="input" type="time" data-routine-time value="${escapeHtml(existing?.time?.slice(0, 5) || '')}"></label>
      </div>
      <fieldset class="routine-days"><legend>Wiederholen</legend><div>${days.map(([value, label]) => `<button type="button" data-routine-day="${value}" class="${selectedDays.has(value) ? 'aktiv' : ''}" aria-pressed="${selectedDays.has(value)}">${label}</button>`).join('')}</div></fieldset>
      ${selectedTemplate === 'custom'
        ? `<label class="dex-entry-field"><span>Coins pro Abschluss</span><input class="input coin-zahlenfeld" data-routine-coins type="number" inputmode="numeric" min="0" max="50" value="${existing?.coin_reward ?? 5}" required><small class="routine-coin-info">Für diese freie Routine selbst festlegen: 0–50 Coins.</small></label>`
        : `<div class="routine-coin-fest" data-routine-coin-hint>${routineCoinValue(selectedTemplate, selectedDuration)} MUSCLE-COINS pro Abschluss</div>`}
      <label class="dex-entry-field"><span>${selectedTemplate === 'custom' ? 'Ablauf' : 'Notiz'} <small>optional</small></span><textarea class="input" data-routine-note maxlength="500" rows="3" placeholder="${selectedTemplate === 'custom' ? 'Jeden Schritt in eine neue Zeile schreiben …' : 'Kurzer Hinweis zur Durchführung …'}">${escapeHtml(existing?.note || '')}</textarea></label>
      <button class="btn btn-primary btn-block" type="submit">Routine speichern</button>
      ${existing ? '<button class="btn btn-block routine-delete" type="button" data-routine-delete>Routine löschen</button>' : ''}
    </form>
  </section>`;
  let stopSoundPreview = async () => {};
  const previewButton = backdrop.querySelector('[data-sound-preview]');
  const ambientSelect = backdrop.querySelector('[data-routine-ambient]');
  const resetPreviewButton = () => {
    if (!previewButton) return;
    previewButton.classList.remove('aktiv');
    previewButton.innerHTML = `${materialIconMarkup('play_arrow')}<span>Anhören</span>`;
  };
  const stopPreview = async () => { await stopSoundPreview(); stopSoundPreview = async () => {}; resetPreviewButton(); };
  const close = async () => { await stopPreview(); backdrop.remove(); };
  backdrop.onclick = (event) => { if (event.target === backdrop || event.target.closest('[data-sheet-close]')) close(); };
  previewButton?.addEventListener('click', async () => {
    if (previewButton.classList.contains('aktiv')) return stopPreview();
    await stopPreview();
    if (ambientSelect.value === 'off') return toast('Bitte zuerst einen Sound auswählen.');
    stopSoundPreview = await previewMeditationSound(ambientSelect.value, Number(backdrop.querySelector('[data-routine-ambient-volume]').value));
    previewButton.classList.add('aktiv');
    previewButton.innerHTML = `${materialIconMarkup('stop')}<span>Stoppen</span>`;
  });
  ambientSelect?.addEventListener('change', stopPreview);
  backdrop.querySelector('.routine-days').onclick = (event) => {
    const button = event.target.closest('[data-routine-day]');
    if (!button) return;
    button.classList.toggle('aktiv');
    button.setAttribute('aria-pressed', String(button.classList.contains('aktiv')));
  };
  backdrop.querySelector('.routine-duration')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-routine-duration]');
    if (!button) return;
    backdrop.querySelectorAll('[data-routine-duration]').forEach((item) => item.classList.toggle('aktiv', item === button));
    const customInput = backdrop.querySelector('[data-routine-custom-duration]');
    if (customInput) customInput.value = '';
    const hint = backdrop.querySelector('[data-routine-coin-hint]');
    if (hint) hint.textContent = `${routineCoinValue(selectedTemplate, Number(button.dataset.routineDuration))} MUSCLE-COINS pro Abschluss`;
  });
  backdrop.querySelector('[data-routine-custom-duration]')?.addEventListener('input', (event) => {
    if (!event.currentTarget.value) return;
    backdrop.querySelectorAll('[data-routine-duration]').forEach((button) => button.classList.remove('aktiv'));
  });
  backdrop.querySelector('[data-routine-timer-enabled]')?.addEventListener('change', (event) => {
    const duration = backdrop.querySelector('[data-custom-timer-duration]');
    if (duration) duration.hidden = !event.currentTarget.checked;
  });
  const mobilityList = backdrop.querySelector('[data-mobility-list]');
  backdrop.querySelector('[data-mobility-add]')?.addEventListener('click', () => {
    mobilityList.insertAdjacentHTML('beforeend', mobilityExerciseRowMarkup());
    mobilityList.querySelector('[data-mobility-exercise]:last-child [data-mobility-name]')?.focus({ preventScroll: true });
  });
  mobilityList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mobility-remove]');
    if (!button) return;
    const rows = mobilityList.querySelectorAll('[data-mobility-exercise]');
    if (rows.length === 1) return toast('Mindestens eine Übung eintragen.');
    button.closest('[data-mobility-exercise]')?.remove();
  });
  [['[data-routine-ambient-volume]','[data-ambient-output]'],['[data-routine-gong-volume]','[data-gong-output]']].forEach(([inputSelector, outputSelector]) => {
    const input = backdrop.querySelector(inputSelector); const output = backdrop.querySelector(outputSelector);
    input?.addEventListener('input', () => { output.textContent = `${Math.round(Number(input.value) * 100)} %`; });
  });
  backdrop.querySelector('[data-routine-icon-open]').onclick = (event) => {
    event.preventDefault();
    const button = event.currentTarget;
    const input = backdrop.querySelector('[data-routine-icon]');
    chooseReminderIcon(input.value, (value) => {
      input.value = value;
      button.innerHTML = reminderIconMarkup(value);
    }, { hostBackdrop: backdrop });
  };
  backdrop.querySelector('[data-routine-form]').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const weekdays = [...form.querySelectorAll('[data-routine-day].aktiv')].map((button) => Number(button.dataset.routineDay));
    if (!weekdays.length) return toast('Bitte mindestens einen Wochentag auswählen.');
    submit.disabled = true;
    let externalUrl = form.querySelector('[data-routine-external-url]')?.value.trim() || null;
    if (externalUrl && !/^[a-z][a-z\d+.-]*:/i.test(externalUrl)) externalUrl = `https://${externalUrl}`;
    if (externalUrl) {
      try { externalUrl = new URL(externalUrl).href; } catch { submit.disabled = false; return toast('Bitte einen gültigen Meditationslink eintragen.'); }
      if (!/^https?:/i.test(externalUrl)) { submit.disabled = false; return toast('Bitte einen HTTP- oder HTTPS-Link verwenden.'); }
    }
    const timerEnabled = fixedTimerTemplate || Boolean(form.querySelector('[data-routine-timer-enabled]')?.checked);
    const ownDuration = Number(form.querySelector('[data-routine-custom-duration]')?.value || 0);
    const chosenDuration = ownDuration || Number(form.querySelector('[data-routine-duration].aktiv')?.dataset.routineDuration || defaultDuration);
    if (timerEnabled && (chosenDuration < 1 || chosenDuration > 240)) {
      submit.disabled = false;
      return toast('Bitte eine Timerdauer zwischen 1 und 240 Minuten wählen.');
    }
    const payload = {
      user_id: userId, name: form.querySelector('[data-routine-name]').value.trim(),
      icon: form.querySelector('[data-routine-icon]').value.trim() || '✓',
      period: form.querySelector('[data-routine-period]').value,
      time: form.querySelector('[data-routine-time]').value || null,
      note: form.querySelector('[data-routine-note]').value.trim(), weekdays,
      template_type: selectedTemplate,
      duration_minutes: timerEnabled ? chosenDuration : null,
      external_url: meditation ? externalUrl : null,
      ambient_sound: meditation ? form.querySelector('[data-routine-ambient]').value : 'off',
      ambient_volume: meditation ? Number(form.querySelector('[data-routine-ambient-volume]').value) : 0.35,
      gong_volume: meditation ? Number(form.querySelector('[data-routine-gong-volume]').value) : 0.7,
      coin_reward: selectedTemplate === 'custom' ? Number(form.querySelector('[data-routine-coins]').value) : null,
      mobility_exercises: mobility ? [...form.querySelectorAll('[data-mobility-exercise]')].map((row) => ({
        name: row.querySelector('[data-mobility-name]').value.trim(),
        prescription: row.querySelector('[data-mobility-prescription]').value.trim(),
      })).filter((item) => item.name) : [],
    };
    if (mobility && !payload.mobility_exercises.length) { submit.disabled = false; return toast('Bitte mindestens eine Mobility-Übung eintragen.'); }
    const query = existing
      ? supabase.from('routines').update(payload).eq('id', existing.id).eq('user_id', userId)
      : supabase.from('routines').insert(payload);
    const { error } = await query;
    if (error) { toast('Routine konnte nicht gespeichert werden.'); submit.disabled = false; return; }
    close(); toast('Routine gespeichert'); await onSaved?.();
  };
  backdrop.querySelector('[data-routine-delete]')?.addEventListener('click', async () => {
    if (!confirm(`„${existing.name}“ wirklich löschen?`)) return;
    const { error } = await supabase.from('routines').delete().eq('id', existing.id).eq('user_id', userId);
    if (error) return toast('Routine konnte nicht gelöscht werden.');
    close(); toast('Routine gelöscht'); await onSaved?.();
  });
  document.body.append(backdrop);
  requestAnimationFrame(() => { backdrop.classList.add('offen'); backdrop.querySelector('[data-routine-name]')?.focus({ preventScroll: true }); });
}

function routineRow(item, completed, attachments = [], darkColor = false) {
  const dayNames = item.weekdays?.length === 7 ? 'Täglich' : days.filter(([value]) => item.weekdays?.includes(Number(value))).map(([, label]) => label).join(' · ');
  const mobility = item.template_type === 'mobility';
  const timed = Number(item.duration_minutes || 0) > 0;
  const exerciseCount = mobility ? normalizeMobilityExercises(item.mobility_exercises).length : 0;
  return `<article class="routine-row${completed ? ' erledigt' : ''}${timed ? ' hat-timer' : ''}" data-routine-id="${item.id}">
    <button class="routine-check${completed && darkColor ? ' kontrast-weiss' : ''}" type="button" data-routine-check aria-pressed="${completed}" aria-label="${escapeHtml(item.name)} ${completed ? 'als offen markieren' : 'erledigen'}">${completed ? materialIconMarkup('check_small') : ''}</button>
    <span class="routine-icon" aria-hidden="true">${reminderIconMarkup(item.icon || 'emoji:✓')}</span>
    <span class="routine-copy"><b>${escapeHtml(item.name)}</b><small>${mobility ? `${exerciseCount} Übungen · ${Number(item.duration_minutes || 5)} min · ` : ''}${item.time ? item.time.slice(0, 5) + ' · ' : ''}${escapeHtml(dayNames)}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</small></span>
    ${timed ? `<button class="routine-start" type="button" data-routine-start aria-label="${escapeHtml(item.name)}-Timer starten">${materialIconMarkup('play_arrow')}</button>` : ''}
    <button class="routine-attach" type="button" data-routine-attach aria-label="Bild oder Link hinzufügen">${materialIconMarkup('place_item')}</button>
    <button class="routine-edit" type="button" data-routine-edit aria-label="${escapeHtml(item.name)} bearbeiten">${materialIconMarkup('build')}</button>
    ${attachments.length ? `<div class="routine-anhaenge">${attachments.map((entry) => dexEntryOverviewMarkup(entry, categoryColor('habits'))).join('')}</div>` : ''}
  </article>`;
}

function chooseRoutineTemplate(userId, onSaved) {
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop routine-template-backdrop offen';
  backdrop.innerHTML = `<section class="kategorie-sheet" role="dialog" aria-modal="true" aria-label="Routine auswählen">
    <header><h2>Routine hinzufügen</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="sheet-menue routine-template-list">
      <button type="button" data-routine-template="meditation"><span class="routine-template-icon">🧘</span><span><b>Meditation</b><small>Timer, Atemhilfe und Sounds</small></span></button>
      <button type="button" data-routine-template="mobility"><span class="routine-template-icon">🤸</span><span><b>Mobility</b><small>Grundlage – Übungen folgen separat</small></span></button>
      <button type="button" data-routine-template="walk"><span class="routine-template-icon">🚶</span><span><b>Spaziergang</b><small>15, 30, 45 oder 60 Minuten</small></span></button>
      <button type="button" data-routine-template="custom">${materialIconMarkup('add')}<span><b>Neue Routine</b><small>Alles selbst festlegen</small></span></button>
    </div>
  </section>`;
  const close = () => backdrop.remove();
  backdrop.onclick = (event) => {
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) return close();
    const templateType = event.target.closest('[data-routine-template]')?.dataset.routineTemplate;
    if (!templateType) return;
    close(); editor(userId, { templateType, onSaved });
  };
  document.body.append(backdrop);
}

function chooseAttachment(item, userId, onSaved) {
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop routine-attachment-backdrop offen';
  backdrop.innerHTML = `<section class="kategorie-sheet" role="dialog" aria-modal="true" aria-label="Anhang hinzufügen">
    <header><h2>Anhang hinzufügen</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="sheet-menue">
      <button type="button" data-routine-attachment="link">${materialIconMarkup('place_item')}<span>Link</span></button>
      <button type="button" data-routine-attachment="image">${materialIconMarkup('add_photo_alternate')}<span>Bild</span></button>
    </div>
  </section>`;
  const close = () => backdrop.remove();
  backdrop.onclick = (event) => {
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) return close();
    const type = event.target.closest('[data-routine-attachment]')?.dataset.routineAttachment;
    if (!type) return;
    close();
    openDexEntryEditor({
      type, userId, rootKey: 'habits', routineId: item.id,
      entryLabel: type === 'image' ? 'Routine-Bild' : 'Routine-Link', onSaved,
    });
  };
  document.body.append(backdrop);
}

export async function mountRoutines(container, { session, signal }) {
  const userId = session.user.id;
  container.innerHTML = `<div class="wrap pad-bottom routinen-seite">
    <div class="seitenkopf"><h1>ROUTINEN</h1></div>
    <div class="routine-plan" data-routine-plan><div class="daten-laden">Routinen werden geladen …</div></div>
    <div class="dex-eintraege routine-notizen" data-dex-entries></div>
  </div>`;
  let state = await load(userId, signal);
  if (signal?.aborted) return {};
  const refresh = async () => {
    state = await load(userId, signal);
    paint();
  };
  const paint = () => {
    const darkColor = colorIsDark(categoryColor('habits'));
    container.querySelector('[data-routine-plan]').innerHTML = periods.map(([key, label]) => {
      const items = state.routines.filter((item) => item.period === key);
      return `<section class="routine-zeitblock"><header><h2>${label}</h2><small>${items.length} ${items.length === 1 ? 'Routine' : 'Routinen'}</small></header><div>${items.length
        ? items.map((item) => routineRow(item, state.completed.has(item.id), state.attachments.filter((entry) => entry.routine_id === item.id), darkColor)).join('')
        : '<p class="routine-zeitblock-leer">Noch keine Routine geplant.</p>'}</div></section>`;
    }).join('');
    vorschaubilderEinblenden(container.querySelector('[data-routine-plan]'));
  };
  paint();
  const plan = container.querySelector('[data-routine-plan]');
  plan.onclick = async (event) => {
    const row = event.target.closest('[data-routine-id]');
    if (!row) return;
    const item = state.routines.find((routine) => routine.id === row.dataset.routineId);
    if (!item) return;
    if (event.target.closest('[data-routine-start]')) return openMeditationTimer({
      userId, routine: item, onCompleted: refresh,
      mobilityExercises: item.template_type === 'mobility' ? normalizeMobilityExercises(item.mobility_exercises) : [],
    });
    if (event.target.closest('[data-routine-attach]')) return chooseAttachment(item, userId, refresh);
    if (event.target.closest('[data-routine-edit]')) return editor(userId, { existing: item, onSaved: refresh });
    if (event.target.closest('.routine-anhaenge')) return;
    if (!event.target.closest('[data-routine-check]')) return;
    const completed = state.completed.has(item.id);
    const query = completed
      ? supabase.from('routine_completions').delete().eq('routine_id', item.id).eq('completed_on', today()).eq('user_id', userId)
      : supabase.from('routine_completions').insert({ routine_id: item.id, user_id: userId, completed_on: today() });
    const { error } = await query;
    if (error) return toast('Status konnte nicht gespeichert werden.');
    // Die Push-Erinnerung teilt sich nach der Migration die ID der Routine.
    // Der Zusatzschritt bleibt absichtlich best effort, damit das Abhaken auch
    // vor dem Einspielen der Migration weiterhin funktioniert.
    if (completed) {
      await supabase.from('reminder_completions').delete()
        .eq('reminder_id', item.id).eq('date', today()).eq('user_id', userId);
    } else {
      await supabase.from('reminder_completions').upsert({
        reminder_id: item.id, user_id: userId, date: today(),
        completed_at: new Date().toISOString(), snoozed_until: null,
      }, { onConflict: 'user_id,reminder_id,date' });
    }
    try { await syncRoutineCoins(item.id, today(), !completed); }
    catch { toast('Routine gespeichert – Coins konnten noch nicht synchronisiert werden.'); }
    if (completed) state.completed.delete(item.id); else state.completed.add(item.id);
    paint();
  };
  bindLongPress(plan, '.routine-anhaenge .dex-inhaltskarte', (element) => {
    const entry = state.attachments.find((item) => item.id === element.dataset.dexEntryId);
    if (!entry) return null;
    return () => editEntry(entry, refresh, { onDeleted: refresh });
  });
  maybePromptExternalMeditation({ userId, routines: state.routines, onCompleted: refresh });
  return { openRoutineEditor: () => chooseRoutineTemplate(userId, refresh) };
}
