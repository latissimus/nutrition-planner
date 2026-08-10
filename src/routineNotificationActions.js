import { supabase } from './supabase.js';
import { materialIconMarkup } from './categoryIcons.js';
import { toast } from './toast.js';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const today = () => new Date().toLocaleDateString('sv-SE');

export async function openRoutineNotificationActions({ userId, routineId, onChanged }) {
  const { data: routine, error } = await supabase.from('routines')
    .select('id,name,note').eq('id', routineId).eq('user_id', userId).maybeSingle();
  if (error || !routine) return;

  document.querySelector('.routine-push-action-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop routine-push-action-backdrop';
  backdrop.innerHTML = `<section class="kategorie-sheet routine-push-actions" role="dialog" aria-modal="true" aria-label="Routine-Erinnerung">
    <header><div><small>ROUTINE</small><h2>${escapeHtml(routine.name)}</h2></div><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    ${routine.note ? `<p>${escapeHtml(routine.note)}</p>` : ''}
    <div class="routine-push-action-list">
      <button type="button" data-routine-push-action="done">${materialIconMarkup('check_small')}<span><b>Erledigt</b><small>Für heute abhaken</small></span></button>
      <button type="button" data-routine-push-action="snooze">${materialIconMarkup('schedule')}<span><b>In 1 h erinnern</b><small>Erinnerung verschieben</small></span></button>
      <button type="button" data-routine-push-action="open">${materialIconMarkup('arrow_forward')}<span><b>Öffnen</b><small>Zur Routine wechseln</small></span></button>
    </div>
  </section>`;
  const close = () => backdrop.remove();
  backdrop.onclick = async (event) => {
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) return close();
    const action = event.target.closest('[data-routine-push-action]')?.dataset.routinePushAction;
    if (!action) return;
    const button = event.target.closest('button');
    button.disabled = true;
    if (action === 'open') return close();
    try {
      const date = today();
      if (action === 'done') {
        const completedAt = new Date().toISOString();
        const [{ error: routineError }, { error: reminderError }] = await Promise.all([
          supabase.from('routine_completions').upsert({ routine_id: routineId, user_id: userId, completed_on: date }, { onConflict: 'routine_id,completed_on' }),
          supabase.from('reminder_completions').upsert({ reminder_id: routineId, user_id: userId, date, completed_at: completedAt, snoozed_until: null }, { onConflict: 'user_id,reminder_id,date' }),
        ]);
        if (routineError || reminderError) throw routineError || reminderError;
        toast('Routine für heute erledigt');
      } else {
        const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const [{ error: routineError }, { error: reminderError }] = await Promise.all([
          supabase.from('routine_completions').delete().eq('routine_id', routineId).eq('user_id', userId).eq('completed_on', date),
          supabase.from('reminder_completions').upsert({ reminder_id: routineId, user_id: userId, date, completed_at: null, snoozed_until: snoozedUntil }, { onConflict: 'user_id,reminder_id,date' }),
        ]);
        if (routineError || reminderError) throw routineError || reminderError;
        toast('Erinnerung um 1 Stunde verschoben');
      }
      close();
      await onChanged?.();
    } catch (saveError) {
      toast(saveError.message || 'Aktion konnte nicht gespeichert werden.');
      button.disabled = false;
    }
  };
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('offen'));
}
