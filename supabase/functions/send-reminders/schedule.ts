export type ScheduledReminder = {
  type: string;
  time: string;
  weekdays?: number[];
  metadata?: Record<string, unknown>;
};

export type ScheduledOccurrence = {
  scheduledFor: string;
  localDate: string;
  occurrenceKey: string;
};

export const DELIVERY_GRACE_MINUTES = 3;

export function localParts(now: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
    const weekdays: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return {
      weekday: weekdays[value('weekday')],
      year: value('year'), month: value('month'), day: value('day'),
      hour: Number(value('hour')),
      minute: Number(value('minute')),
    };
  } catch {
    return timeZone === 'UTC' ? {
      weekday: now.getUTCDay(),
      year: String(now.getUTCFullYear()),
      month: String(now.getUTCMonth() + 1).padStart(2, '0'),
      day: String(now.getUTCDate()).padStart(2, '0'),
      hour: now.getUTCHours(), minute: now.getUTCMinutes(),
    } : localParts(now, 'UTC');
  }
}

export function localDate(now: Date, timeZone: string): string {
  const parts = localParts(now, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function minutes(time: string | undefined) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function matchesMinute(reminder: ScheduledReminder, parts: ReturnType<typeof localParts>) {
  if (!(reminder.weekdays || [0, 1, 2, 3, 4, 5, 6]).includes(parts.weekday)) return false;
  const current = parts.hour * 60 + parts.minute;
  const start = minutes(reminder.time);
  if (reminder.type !== 'drink') return current === start;
  const end = minutes(String(reminder.metadata?.bis || '21:00'));
  const interval = Math.max(15, Number(reminder.metadata?.intervall_minuten || 120));
  return current >= start && current <= end && (current - start) % interval === 0;
}

export function scheduledOccurrence(
  reminder: ScheduledReminder,
  timeZone: string,
  now: Date,
  graceMinutes = DELIVERY_GRACE_MINUTES,
): ScheduledOccurrence | null {
  const currentMinute = new Date(now);
  currentMinute.setUTCSeconds(0, 0);
  for (let delay = 0; delay <= Math.max(0, graceMinutes); delay += 1) {
    const candidate = new Date(currentMinute.getTime() - delay * 60_000);
    const parts = localParts(candidate, timeZone);
    if (!matchesMinute(reminder, parts)) continue;
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    const plannedMinute = String(parts.hour * 60 + parts.minute).padStart(4, '0');
    return {
      scheduledFor: candidate.toISOString(),
      localDate: date,
      // Der lokale Termin verhindert am Ende der Sommerzeit eine doppelte
      // Benachrichtigung fuer dieselbe sichtbare Uhrzeit.
      occurrenceKey: `schedule:${date}:${plannedMinute}`,
    };
  }
  return null;
}

export function snoozeOccurrence(snoozedUntil: string, date: string): ScheduledOccurrence {
  const scheduled = new Date(snoozedUntil);
  scheduled.setUTCSeconds(0, 0);
  const scheduledFor = scheduled.toISOString();
  return {
    scheduledFor,
    localDate: date,
    occurrenceKey: `snooze:${scheduledFor}`,
  };
}

