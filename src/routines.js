import { supabase } from './supabase.js';
import { categoryColor, colorIsDark, materialIconMarkup } from './categoryIcons.js';
import { chooseReminderIcon, reminderIconMarkup } from './reminders.js';
import { dexEntryOverviewMarkup, loadDexEntries, openDexEntryEditor, vorschaubilderEinblenden } from './dexEntries.js';
import { toast } from './toast.js';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const periods = [
  ['morning', 'Morgens', '07:00'], ['midday', 'Mittags', '12:00'], ['evening', 'Abends', '19:00'],
];
const days = [['1', 'Mo'], ['2', 'Di'], ['3', 'Mi'], ['4', 'Do'], ['5', 'Fr'], ['6', 'Sa'], ['7', 'So']];
const today = () => new Date().toLocaleDateString('sv-SE');
const weekday = () => new Date().getDay() || 7;

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

function editor(userId, { existing = null, onSaved }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop routine-editor-backdrop';
  backdrop.style.setProperty('--ordner', categoryColor('habits'));
  const selectedDays = new Set((existing?.weekdays || [1, 2, 3, 4, 5, 6, 7]).map(String));
  backdrop.innerHTML = `<section class="kategorie-sheet routine-editor" role="dialog" aria-modal="true" aria-label="Routine ${existing ? 'bearbeiten' : 'hinzufügen'}">
    <header><h2>${existing ? 'Routine bearbeiten' : 'Neue Routine'}</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <form data-routine-form>
      <div class="routine-name-row">
        <div class="dex-entry-field routine-icon-field"><span>Icon</span>
          <button type="button" class="rem-icon-waehler" data-routine-icon-open aria-label="Icon auswählen">${reminderIconMarkup(existing?.icon || 'emoji:✓')}</button>
          <input type="hidden" data-routine-icon value="${escapeHtml(existing?.icon || 'emoji:✓')}">
        </div>
        <label class="dex-entry-field"><span>Name</span><input class="input" data-routine-name maxlength="100" value="${escapeHtml(existing?.name || '')}" placeholder="z. B. 10 Minuten Mobility" required></label>
      </div>
      <div class="routine-plan-row">
        <label class="dex-entry-field"><span>Tageszeit</span><select class="input" data-routine-period>${periods.map(([key, label]) => `<option value="${key}"${existing?.period === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
        <label class="dex-entry-field"><span>Uhrzeit</span><input class="input" type="time" data-routine-time value="${escapeHtml(existing?.time?.slice(0, 5) || '')}"></label>
      </div>
      <fieldset class="routine-days"><legend>Wiederholen</legend><div>${days.map(([value, label]) => `<button type="button" data-routine-day="${value}" class="${selectedDays.has(value) ? 'aktiv' : ''}" aria-pressed="${selectedDays.has(value)}">${label}</button>`).join('')}</div></fieldset>
      <label class="dex-entry-field"><span>Notiz <small>optional</small></span><textarea class="input" data-routine-note maxlength="500" rows="3" placeholder="Kurzer Hinweis zur Durchführung …">${escapeHtml(existing?.note || '')}</textarea></label>
      <button class="btn btn-primary btn-block" type="submit">Routine speichern</button>
      ${existing ? '<button class="btn btn-block routine-delete" type="button" data-routine-delete>Routine löschen</button>' : ''}
    </form>
  </section>`;
  const close = () => backdrop.remove();
  backdrop.onclick = (event) => { if (event.target === backdrop || event.target.closest('[data-sheet-close]')) close(); };
  backdrop.querySelector('.routine-days').onclick = (event) => {
    const button = event.target.closest('[data-routine-day]');
    if (!button) return;
    button.classList.toggle('aktiv');
    button.setAttribute('aria-pressed', String(button.classList.contains('aktiv')));
  };
  backdrop.querySelector('[data-routine-icon-open]').onclick = (event) => {
    event.preventDefault();
    const input = backdrop.querySelector('[data-routine-icon]');
    chooseReminderIcon(input.value, (value) => {
      input.value = value;
      event.currentTarget.innerHTML = reminderIconMarkup(value);
    });
  };
  backdrop.querySelector('[data-routine-form]').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const weekdays = [...form.querySelectorAll('[data-routine-day].aktiv')].map((button) => Number(button.dataset.routineDay));
    if (!weekdays.length) return toast('Bitte mindestens einen Wochentag auswählen.');
    submit.disabled = true;
    const payload = {
      user_id: userId, name: form.querySelector('[data-routine-name]').value.trim(),
      icon: form.querySelector('[data-routine-icon]').value.trim() || '✓',
      period: form.querySelector('[data-routine-period]').value,
      time: form.querySelector('[data-routine-time]').value || null,
      note: form.querySelector('[data-routine-note]').value.trim(), weekdays,
    };
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
  return `<article class="routine-row${completed ? ' erledigt' : ''}" data-routine-id="${item.id}">
    <button class="routine-check${completed && darkColor ? ' kontrast-weiss' : ''}" type="button" data-routine-check aria-pressed="${completed}" aria-label="${escapeHtml(item.name)} ${completed ? 'als offen markieren' : 'erledigen'}">${completed ? materialIconMarkup('check_small') : ''}</button>
    <span class="routine-icon" aria-hidden="true">${reminderIconMarkup(item.icon || 'emoji:✓')}</span>
    <span class="routine-copy"><b>${escapeHtml(item.name)}</b><small>${item.time ? item.time.slice(0, 5) + ' · ' : ''}${escapeHtml(dayNames)}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</small></span>
    <button class="routine-attach" type="button" data-routine-attach aria-label="Bild oder Link hinzufügen">${materialIconMarkup('place_item')}</button>
    <button class="routine-edit" type="button" data-routine-edit aria-label="${escapeHtml(item.name)} bearbeiten">${materialIconMarkup('build')}</button>
    ${attachments.length ? `<div class="routine-anhaenge">${attachments.map((entry) => dexEntryOverviewMarkup(entry, categoryColor('habits'))).join('')}</div>` : ''}
  </article>`;
}

function chooseAttachment(item, userId, onSaved) {
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop routine-attachment-backdrop offen';
  backdrop.innerHTML = `<section class="kategorie-sheet" role="dialog" aria-modal="true" aria-label="Anhang hinzufügen">
    <header><h2>Anhang hinzufügen</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="sheet-menue">
      <button type="button" data-routine-attachment="image">${materialIconMarkup('add_photo_alternate')}<span>Bild</span></button>
      <button type="button" data-routine-attachment="link">${materialIconMarkup('place_item')}<span>Link</span></button>
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
    <section class="seiten-einstieg routine-intro"><b>Heute dranbleiben</b><span data-routine-progress>Routinen werden geladen …</span></section>
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
    const scheduled = state.routines.filter((item) => item.active && item.weekdays?.includes(weekday()));
    const done = scheduled.filter((item) => state.completed.has(item.id)).length;
    const darkColor = colorIsDark(categoryColor('habits'));
    container.querySelector('[data-routine-progress]').textContent = scheduled.length ? `${done} von ${scheduled.length} für heute erledigt` : 'Heute ist keine Routine geplant.';
    container.querySelector('[data-routine-plan]').innerHTML = periods.map(([key, label]) => {
      const items = state.routines.filter((item) => item.period === key);
      return `<section class="routine-zeitblock"><header><h2>${label}</h2><small>${items.length} ${items.length === 1 ? 'Routine' : 'Routinen'}</small></header><div>${items.length
        ? items.map((item) => routineRow(item, state.completed.has(item.id), state.attachments.filter((entry) => entry.routine_id === item.id), darkColor)).join('')
        : '<p class="routine-zeitblock-leer">Noch keine Routine geplant.</p>'}</div></section>`;
    }).join('');
    vorschaubilderEinblenden(container.querySelector('[data-routine-plan]'));
  };
  paint();
  container.querySelector('[data-routine-plan]').onclick = async (event) => {
    const row = event.target.closest('[data-routine-id]');
    if (!row) return;
    const item = state.routines.find((routine) => routine.id === row.dataset.routineId);
    if (!item) return;
    if (event.target.closest('[data-routine-attach]')) return chooseAttachment(item, userId, refresh);
    if (event.target.closest('[data-routine-edit]')) return editor(userId, { existing: item, onSaved: refresh });
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
    if (completed) state.completed.delete(item.id); else state.completed.add(item.id);
    paint();
  };
  return { openRoutineEditor: () => editor(userId, { onSaved: refresh }) };
}
