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

export function supplementNotificationTag(mealReminderId) {
  return `nutrition-${mealReminderId}-supplements`;
}

export function supplementGroupTitle(mealSlot) {
  return ({
    breakfast: 'Morgen-Supplements',
    snack_morning: 'Vormittags-Supplements',
    lunch: 'Mittagssupplements',
    snack_afternoon: 'Nachmittags-Supplements',
    dinner: 'Abend-Supplements',
  })[mealSlot] || 'Supplements';
}

export function reminderIsDueAfterOffset(reminder, now, offsetMinutes) {
  const origin = new Date(now.getTime() - Math.max(0, offsetMinutes) * 60_000);
  const weekdays = reminder.weekdays || [0, 1, 2, 3, 4, 5, 6];
  const [hour, minute] = String(reminder.time || '00:00').split(':').map(Number);
  return weekdays.includes(origin.getDay())
    && origin.getHours() === hour
    && origin.getMinutes() === minute;
}

export function shouldReuseReminderLoop({ sameUser, forceRestart }) {
  return sameUser && !forceRestart;
}
