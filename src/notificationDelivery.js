/**
 * Der lokale 30-Sekunden-Loop ist nur ein Ersatz fuer Browser ohne aktives
 * Web-Push-Abo. Ein vorhandenes Abo hat immer Vorrang – auch wenn dessen
 * erneute Supabase-Synchronisierung gerade wegen eines Netzfehlers scheitert.
 */
export function shouldStartLocalReminderLoop({ serverPushActive, browserSubscriptionExists }) {
  return !serverPushActive && !browserSubscriptionExists;
}

export function reminderNotificationTag(reminderId) {
  return `nutrition-${reminderId}`;
}

export function shouldReuseReminderLoop({ sameUser, forceRestart }) {
  return sameUser && !forceRestart;
}
