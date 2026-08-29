import { describe, expect, it } from 'vitest';
import {
  localDate, scheduledOccurrence, scheduledOffsetOccurrence, snoozeOccurrence,
} from './schedule.ts';

const reminder = (values = {}) => ({
  type: 'meal', time: '08:00', weekdays: [0, 1, 2, 3, 4, 5, 6], metadata: {}, ...values,
});

describe('Push-Zeitplanung', () => {
  it('liefert zum exakten Zeitpunkt den geplanten Termin', () => {
    const occurrence = scheduledOccurrence(reminder(), 'Europe/Berlin', new Date('2026-08-12T06:00:20Z'));
    expect(occurrence).toEqual({
      scheduledFor: '2026-08-12T06:00:00.000Z',
      localDate: '2026-08-12',
      occurrenceKey: 'schedule:2026-08-12:0480',
    });
  });

  it('holt einen bis zu drei Minuten verspaeteten Cronjob nach', () => {
    expect(scheduledOccurrence(reminder(), 'Europe/Berlin', new Date('2026-08-12T06:03:45Z'))?.scheduledFor)
      .toBe('2026-08-12T06:00:00.000Z');
    expect(scheduledOccurrence(reminder(), 'Europe/Berlin', new Date('2026-08-12T06:04:00Z')))
      .toBeNull();
  });

  it('prueft beim Nachholen ueber Mitternacht den Tag des Termins', () => {
    const sundayReminder = reminder({ time: '23:59', weekdays: [0] });
    const occurrence = scheduledOccurrence(sundayReminder, 'Europe/Berlin', new Date('2026-08-09T22:01:00Z'));
    expect(occurrence?.localDate).toBe('2026-08-09');
    expect(occurrence?.scheduledFor).toBe('2026-08-09T21:59:00.000Z');
  });

  it('beachtet Trinkintervall und Endzeit', () => {
    const drink = reminder({
      type: 'drink', time: '09:00', metadata: { bis: '10:00', intervall_minuten: 30 },
    });
    expect(scheduledOccurrence(drink, 'Europe/Berlin', new Date('2026-08-12T07:31:00Z'))?.occurrenceKey)
      .toBe('schedule:2026-08-12:0570');
    expect(scheduledOccurrence(drink, 'Europe/Berlin', new Date('2026-08-12T08:04:00Z')))
      .toBeNull();
  });

  it('verwendet in verschiedenen Zeitzonen den korrekten lokalen Tag', () => {
    expect(localDate(new Date('2026-08-12T23:30:00Z'), 'Europe/Berlin')).toBe('2026-08-13');
    expect(localDate(new Date('2026-08-12T23:30:00Z'), 'America/New_York')).toBe('2026-08-12');
  });

  it('verwendet beim doppelten Winterzeit-Zeitpunkt denselben lokalen Schluessel', () => {
    const winterReminder = reminder({ time: '02:30', weekdays: [0] });
    const first = scheduledOccurrence(winterReminder, 'Europe/Berlin', new Date('2026-10-25T00:30:00Z'));
    const second = scheduledOccurrence(winterReminder, 'Europe/Berlin', new Date('2026-10-25T01:30:00Z'));
    expect(first?.occurrenceKey).toBe('schedule:2026-10-25:0150');
    expect(second?.occurrenceKey).toBe(first?.occurrenceKey);
    expect(second?.scheduledFor).not.toBe(first?.scheduledFor);
  });

  it('erzeugt fuer einen Snooze einen stabilen eigenen Schluessel', () => {
    expect(snoozeOccurrence('2026-08-12T14:00:42.000Z', '2026-08-12')).toEqual({
      scheduledFor: '2026-08-12T14:00:00.000Z',
      localDate: '2026-08-12',
      occurrenceKey: 'snooze:2026-08-12T14:00:00.000Z',
    });
  });

  it('plant den Supplement-Sammelpush zehn Minuten nach der Mahlzeit', () => {
    expect(scheduledOffsetOccurrence(
      reminder(), 'Europe/Berlin', new Date('2026-08-12T06:10:20Z'), 10,
    )).toEqual({
      scheduledFor: '2026-08-12T06:10:00.000Z',
      localDate: '2026-08-12',
      occurrenceKey: 'schedule:2026-08-12:0480:offset:10',
    });
  });

  it('prueft bei einem Supplement-Push nach Mitternacht den Mahlzeiten-Tag', () => {
    const sundayMeal = reminder({ time: '23:55', weekdays: [0] });
    const occurrence = scheduledOffsetOccurrence(
      sundayMeal, 'Europe/Berlin', new Date('2026-08-09T22:05:00Z'), 10,
    );
    expect(occurrence?.localDate).toBe('2026-08-09');
    expect(occurrence?.scheduledFor).toBe('2026-08-09T22:05:00.000Z');
  });
});
