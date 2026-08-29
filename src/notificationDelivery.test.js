import { describe, expect, it } from 'vitest';
import {
  reminderIsDueAfterOffset, reminderNotificationTag, shouldReuseReminderLoop,
  shouldStartLocalReminderLoop, supplementGroupTitle, supplementNotificationTag,
} from './notificationDelivery.js';

describe('Erinnerungs-Zustellweg', () => {
  it('startet keinen lokalen Loop bei serverseitigem Push', () => {
    expect(shouldStartLocalReminderLoop({
      serverPushActive: true, browserSubscriptionExists: true,
    })).toBe(false);
  });

  it('startet bei einem vorhandenen Browser-Abo auch nach Sync-Fehler keinen zweiten Weg', () => {
    expect(shouldStartLocalReminderLoop({
      serverPushActive: false, browserSubscriptionExists: true,
    })).toBe(false);
  });

  it('verwendet den lokalen Ersatz nur ganz ohne Push-Abo', () => {
    expect(shouldStartLocalReminderLoop({
      serverPushActive: false, browserSubscriptionExists: false,
    })).toBe(true);
  });

  it('verwendet fuer lokalen und serverseitigen Versand denselben Tag', () => {
    expect(reminderNotificationTag('abc')).toBe('nutrition-abc');
    expect(supplementNotificationTag('abc')).toBe('nutrition-abc-supplements');
  });

  it('benennt die Supplement-Gruppen nach ihrem Mahlzeitenblock', () => {
    expect(supplementGroupTitle('breakfast')).toBe('Morgen-Supplements');
    expect(supplementGroupTitle('lunch')).toBe('Mittagssupplements');
    expect(supplementGroupTitle('dinner')).toBe('Abend-Supplements');
  });

  it('leitet den Supplement-Termin zehn Minuten von der Mahlzeit ab', () => {
    const meal = { time: '08:00', weekdays: [6] };
    expect(reminderIsDueAfterOffset(meal, new Date(2026, 7, 29, 8, 10), 10)).toBe(true);
    expect(reminderIsDueAfterOffset(meal, new Date(2026, 7, 29, 8, 9), 10)).toBe(false);
  });

  it('verwendet den alten Loop nur ohne erzwungenen Push-Wechsel weiter', () => {
    expect(shouldReuseReminderLoop({ sameUser: true, forceRestart: false })).toBe(true);
    expect(shouldReuseReminderLoop({ sameUser: true, forceRestart: true })).toBe(false);
  });
});
