import { describe, expect, it } from 'vitest';
import {
  reminderNotificationTag, shouldReuseReminderLoop, shouldStartLocalReminderLoop,
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
  });

  it('verwendet den alten Loop nur ohne erzwungenen Push-Wechsel weiter', () => {
    expect(shouldReuseReminderLoop({ sameUser: true, forceRestart: false })).toBe(true);
    expect(shouldReuseReminderLoop({ sameUser: true, forceRestart: true })).toBe(false);
  });
});
