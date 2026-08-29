import { describe, expect, it } from 'vitest';
import {
  analyzeSleepTrends,
  calculateSleepSummary,
  saveSleepPlan,
  scheduleDeviationLabel,
  sleepDurationMinutes,
  sleepScheduleWeekday,
  timeToMinutes,
} from './sleep.js';

describe('SLEEP-DEX-Auswertung', () => {
  it('berechnet Schlaf über Mitternacht', () => {
    expect(timeToMinutes('22:30')).toBe(1350);
    expect(sleepDurationMinutes('22:30', '06:30')).toBe(480);
  });

  it('fasst Dauer, Qualität und Regelmäßigkeit zusammen', () => {
    const summary = calculateSleepSummary([
      { bedtime: '22:30', wake_time: '06:30', quality: 4, energy: 3 },
      { bedtime: '22:40', wake_time: '06:40', quality: 5, energy: 4 },
    ]);
    expect(summary.averageMinutes).toBe(480);
    expect(summary.averageQuality).toBe(4.5);
    expect(summary.consistencyMinutes).toBe(5);
  });

  it('bezeichnet Zusammenhänge als persönliche Beobachtung', () => {
    const logs = Array.from({ length: 6 }, (_, index) => ({
      bedtime: '22:30', wake_time: '06:30', quality: index < 3 ? 5 : 2, energy: 4,
      tags: index < 3 ? ['Meditation'] : [],
    }));
    expect(analyzeSleepTrends(logs)[0]).toContain('Meditation');
    expect(analyzeSleepTrends(logs)[0]).toContain('im Schnitt');
  });

  it('ordnet einen Morgen-Check-in dem Schlafplan des Vorabends zu', () => {
    expect(sleepScheduleWeekday('2026-08-29')).toBe(5);
    const label = scheduleDeviationLabel(
      { sleep_date: '2026-08-29', bedtime: '23:15' },
      [
        { weekday: 5, bedtime: '23:00', active: true },
        { weekday: 6, bedtime: '20:00', active: true },
      ],
    );
    expect(label).toBe('Schlafenszeit 15 min später als im Schlafplan');
  });

  it('speichert Einstellungen vor den Zeiten, damit Reminder konsistent bleiben', async () => {
    const order = [];
    const client = {
      from(table) {
        return {
          upsert() {
            order.push(table);
            return { select: async () => ({ error: null }) };
          },
        };
      },
    };
    const result = await saveSleepPlan('user-1', { user_id: 'user-1' }, [], client);
    expect(result.error).toBeNull();
    expect(order).toEqual(['sleep_settings', 'sleep_schedules']);
  });

  it('bricht das Planspeichern nach einem Einstellungsfehler ab', async () => {
    const order = [];
    const client = {
      from(table) {
        return {
          upsert() {
            order.push(table);
            return { select: async () => ({ error: table === 'sleep_settings' ? new Error('fehlgeschlagen') : null }) };
          },
        };
      },
    };
    const result = await saveSleepPlan('user-1', { user_id: 'user-1' }, [], client);
    expect(result.error).toBeInstanceOf(Error);
    expect(order).toEqual(['sleep_settings']);
  });
});
