import { supabase } from './supabase.js';

export const localDate = (date = new Date()) => date.toLocaleDateString('sv-SE');

/**
 * Einziger Schreibweg fuer Abschluss, Zuruecknehmen und Snooze einer Routine.
 * Die zugehoerige RPC garantiert, dass Routine, Erinnerung und Coins nie in
 * unterschiedlichen Zustaenden zurueckbleiben.
 */
export async function setRoutineCompletion({ routineId, date = localDate(), completed, snoozedUntil = null }) {
  if (!routineId) throw new Error('Routine fehlt.');
  const { data, error } = await supabase.rpc('set_routine_completion_state', {
    target_routine: routineId,
    target_date: date,
    is_completed: Boolean(completed),
    target_snoozed_until: snoozedUntil,
  });
  if (error) throw error;
  return Number(data || 0);
}

