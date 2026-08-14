import { describe, expect, it } from 'vitest';
import { analyzeSleepTrends, calculateSleepSummary, sleepDurationMinutes, timeToMinutes } from './sleep.js';

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
});
