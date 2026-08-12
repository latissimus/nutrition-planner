import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('./supabase.js', () => ({ supabase: { rpc } }));

const { localDate, setRoutineCompletion } = await import('./routineCompletion.js');

describe('atomarer Routine-Abschluss', () => {
  beforeEach(() => rpc.mockReset());

  it('sendet Abschluss und Datum an genau eine RPC', async () => {
    rpc.mockResolvedValue({ data: 12, error: null });
    await expect(setRoutineCompletion({
      routineId: 'routine-1', date: '2026-08-12', completed: true,
    })).resolves.toBe(12);

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('set_routine_completion_state', {
      target_routine: 'routine-1',
      target_date: '2026-08-12',
      is_completed: true,
      target_snoozed_until: null,
    });
  });

  it('uebergibt Snooze als unvollstaendigen Zustand', async () => {
    rpc.mockResolvedValue({ data: 4, error: null });
    await setRoutineCompletion({
      routineId: 'routine-2', date: '2026-08-12', completed: false,
      snoozedUntil: '2026-08-12T14:00:00.000Z',
    });
    expect(rpc).toHaveBeenCalledWith('set_routine_completion_state', expect.objectContaining({
      is_completed: false,
      target_snoozed_until: '2026-08-12T14:00:00.000Z',
    }));
  });

  it('gibt Datenbankfehler unveraendert weiter', async () => {
    const error = new Error('Transaktion fehlgeschlagen');
    rpc.mockResolvedValue({ data: null, error });
    await expect(setRoutineCompletion({ routineId: 'routine-3', completed: true }))
      .rejects.toBe(error);
  });

  it('erzeugt ein lokales ISO-Datum ohne UTC-Verschiebung', () => {
    expect(localDate(new Date(2026, 7, 12, 23, 30))).toBe('2026-08-12');
  });
});

