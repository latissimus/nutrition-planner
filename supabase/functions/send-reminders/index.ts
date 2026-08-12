import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import webpush from 'npm:web-push@3.6.7';
import {
  DELIVERY_GRACE_MINUTES, localDate, scheduledOccurrence, snoozeOccurrence,
  type ScheduledOccurrence,
} from './schedule.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-cron-secret',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';
const cronSecret = Deno.env.get('CRON_SECRET') || '';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Reminder = {
  id: string;
  user_id: string;
  type: string;
  label: string;
  time: string;
  weekdays: number[];
  metadata: Record<string, unknown>;
  route: string;
};

type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type Completion = {
  reminder_id: string;
  date: string;
  completed_at: string | null;
  snoozed_until: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function notificationSymbol(reminder: Reminder) {
  const icon = String(reminder.metadata?.icon || '');
  if (icon.startsWith('emoji:')) return icon.replace(/^(emoji:)+/, '');
  if (icon === 'fastfood' || reminder.type === 'meal') return '🍔';
  if (icon === 'pill' || reminder.type === 'supplement') return '💊';
  if (icon === 'water_drop' || reminder.type === 'drink') return '💧';
  return '◆';
}

function unitLabel(value: string) {
  return ({ Kapsel: 'Kapsel(n)', Tablette: 'Tablette(n)' } as Record<string, string>)[value] || value;
}

function notification(reminder?: Reminder) {
  if (!reminder) {
    return {
      title: 'Test erfolgreich',
      body: 'Push-Benachrichtigungen kommen auf diesem Gerät an.',
      tag: `nutrition-test-${Date.now()}`,
      url: '#reminders',
    };
  }
  const bodies: Record<string, string> = {
    meal: 'Zeit für deine geplante Mahlzeit.',
    supplement: 'Supplement-Stack checken.',
    drink: 'Ein Glas Wasser einplanen.',
    body: 'Zeit für deine geplanten Körperwerte.',
    habit: 'Zeit für deine geplante Routine.',
  };
  if (reminder.type === 'meal') {
    const note = String(reminder.metadata?.notiz || '').trim();
    return {
      title: `${notificationSymbol(reminder)} ${reminder.label}`,
      body: note || bodies.meal,
      tag: `nutrition-${reminder.id}`,
      url: reminder.route || '#reminders',
    };
  }
  // Bei Supplements Dosierung + Einheit + Hinweis in die Notification-Body ziehen
  if (reminder.type === 'supplement') {
    const dosis = String(reminder.metadata?.dosis || '').trim();
    const einheit = String(reminder.metadata?.einheit || '').trim();
    const hinweis = String(reminder.metadata?.hinweis || '').trim();
    const parts = [dosis && einheit ? `${dosis} ${unitLabel(einheit)}` : dosis || unitLabel(einheit), hinweis].filter(Boolean);
    return {
      title: `${notificationSymbol(reminder)} ${reminder.label}`,
      body: parts.length ? parts.join(' · ') : bodies.supplement,
      tag: `nutrition-${reminder.id}`,
      url: reminder.route || '#reminders',
    };
  }
  if (reminder.type === 'habit') {
    const note = String(reminder.metadata?.notiz || '').trim();
    return {
      title: `${notificationSymbol(reminder)} ${reminder.label}`,
      body: note || bodies.habit,
      tag: `nutrition-${reminder.id}`,
      url: reminder.route || '#habits',
      reminderId: reminder.id,
      reminderType: reminder.type,
    };
  }
  return {
    title: `${notificationSymbol(reminder)} ${reminder.label}`,
    body: bodies[reminder.type] || 'Geplante Erinnerung.',
    tag: `nutrition-${reminder.id}`,
    url: reminder.route || '#reminders',
  };
}

async function send(subscription: Subscription, payload: Record<string, unknown>) {
  return webpush.sendNotification({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  }, JSON.stringify(payload), { TTL: 120, urgency: 'high' });
}

async function removeExpired(subscription: Subscription, error: unknown) {
  const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
  if (statusCode === 404 || statusCode === 410) {
    await admin.from('push_subscriptions').delete().eq('id', subscription.id);
  }
}

async function testPush(userId: string) {
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .eq('user_id', userId);
  if (error) throw error;
  if (!data?.length) return json({ ok: false, error: 'Für dieses Konto ist kein Gerät registriert.' }, 409);

  let sent = 0;
  const failures: string[] = [];
  for (const subscription of data as Subscription[]) {
    try {
      await send(subscription, notification());
      sent += 1;
    } catch (error) {
      const status = Number((error as { statusCode?: number })?.statusCode || 0);
      const message = String((error as Error)?.message || error || 'Unbekannter Web-Push-Fehler');
      failures.push(`${status ? `${status}: ` : ''}${message}`.slice(0, 300));
      await removeExpired(subscription, error);
    }
  }
  return json({
    ok: sent > 0,
    sent,
    failed: failures.length,
    ...(sent ? {} : { error: failures[0] || 'Kein registriertes Gerät konnte erreicht werden.' }),
  }, sent > 0 ? 200 : 502);
}

async function dispatchDue() {
  const now = new Date();

  const [{ data: reminders, error: reminderError }, { data: profiles, error: profileError }] = await Promise.all([
    admin
      .from('reminders')
      .select('id,user_id,type,label,time,weekdays,metadata,route')
      .eq('active', true),
    admin.from('profiles').select('id,zeitzone'),
  ]);
  if (reminderError) throw reminderError;
  if (profileError) throw profileError;

  const zones = new Map((profiles || []).map((profile) => [profile.id, profile.zeitzone || 'UTC']));
  const remindersById = new Map<string, Reminder>((reminders || []).map((r: Reminder) => [r.id, r]));

  // 1. Regulär zeitplan-fällige Reminders
  const scheduled = ((reminders || []) as Reminder[]).flatMap((reminder) => {
    const occurrence = scheduledOccurrence(reminder, zones.get(reminder.user_id) || 'UTC', now);
    return occurrence ? [{ reminder, occurrence }] : [];
  });

  // 2. Reminders deren Snooze in dieser Minute abgelaufen ist (unabhängig von reminder.time)
  const { data: expiredSnoozes, error: snoozeError } = await admin
    .from('reminder_completions')
    .select('reminder_id, user_id, date, snoozed_until')
    .not('snoozed_until', 'is', null)
    .is('completed_at', null)
    .gte('snoozed_until', new Date(now.getTime() - DELIVERY_GRACE_MINUTES * 60_000).toISOString())
    .lte('snoozed_until', now.toISOString());
  if (snoozeError) throw snoozeError;
  const dueFromSnooze: { reminder: Reminder; occurrence: ScheduledOccurrence }[] = [];
  for (const row of (expiredSnoozes || []) as { reminder_id: string; user_id: string; date: string; snoozed_until: string }[]) {
    const reminder = remindersById.get(row.reminder_id);
    if (reminder) dueFromSnooze.push({ reminder, occurrence: snoozeOccurrence(row.snoozed_until, row.date) });
  }

  const dueMap = new Map<string, { reminder: Reminder; occurrence: ScheduledOccurrence }>();
  for (const item of scheduled) dueMap.set(item.reminder.id, item);
  // Ein abgelaufener Snooze hat Vorrang vor einem gleichzeitig faelligen
  // normalen Zeitplan derselben Erinnerung.
  for (const item of dueFromSnooze) dueMap.set(item.reminder.id, item);
  const due = [...dueMap.values()];
  if (!due.length) return json({ ok: true, due: 0, sent: 0 });

  const userIds = [...new Set(due.map(({ reminder }) => reminder.user_id))];

  // Alle heutigen Completions dieser User laden (verhindert doppeltes Feuern und Snooze-Skip)
  const dueDateList = [...new Set(due.map(({ occurrence }) => occurrence.localDate))];
  const { data: completionsData, error: completionsError } = await admin
    .from('reminder_completions')
    .select('reminder_id, date, completed_at, snoozed_until, id')
    .in('user_id', userIds)
    .in('date', dueDateList);
  if (completionsError) throw completionsError;
  const completionByKey = new Map<string, Completion & { id: string }>();
  for (const row of (completionsData || []) as (Completion & { id: string })[]) {
    completionByKey.set(`${row.reminder_id}:${row.date}`, row);
  }

  const { data: subscriptions, error: subscriptionError } = await admin
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .in('user_id', userIds);
  if (subscriptionError) throw subscriptionError;

  const byUser = new Map<string, Subscription[]>();
  for (const subscription of (subscriptions || []) as Subscription[]) {
    byUser.set(subscription.user_id, [...(byUser.get(subscription.user_id) || []), subscription]);
  }

  let sent = 0;
  for (const { reminder, occurrence } of due) {
    const date = occurrence.localDate;
    const completion = completionByKey.get(`${reminder.id}:${date}`);

    // Bereits heute erledigt → skip
    if (completion?.completed_at) continue;
    // Noch snoozed → skip (isDue kann true sein, Snooze zieht vor)
    if (completion?.snoozed_until && new Date(completion.snoozed_until) > now) continue;

    for (const subscription of byUser.get(reminder.user_id) || []) {
      const { data: delivery, error: claimError } = await admin
        .from('push_deliveries')
        .insert({
          reminder_id: reminder.id,
          subscription_id: subscription.id,
          scheduled_for: occurrence.scheduledFor,
          occurrence_key: occurrence.occurrenceKey,
        })
        .select('id')
        .single();
      if (claimError?.code === '23505') continue;
      if (claimError) throw claimError;

      try {
        await send(subscription, notification(reminder));
        sent += 1;
        await admin
          .from('push_deliveries')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', delivery.id);
      } catch (error) {
        await admin
          .from('push_deliveries')
          .update({ status: 'failed', error: String((error as Error)?.message || error).slice(0, 1000) })
          .eq('id', delivery.id);
        await removeExpired(subscription, error);
      }
    }

    // Snooze-Feld leeren, sobald verbraucht – sonst feuert der Snooze in jeder folgenden Minute erneut.
    if (completion?.snoozed_until && new Date(completion.snoozed_until) <= now) {
      await admin
        .from('reminder_completions')
        .update({ snoozed_until: null })
        .eq('id', completion.id);
    }
  }
  return json({ ok: true, due: due.length, sent });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !cronSecret) {
    return json({ ok: false, error: 'Push-Secrets fehlen.' }, 503);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === 'config') {
      const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return json({ ok: false, error: 'Nicht angemeldet.' }, 401);
      return json({ ok: true, publicKey: vapidPublicKey });
    }
    if (body.action === 'test') {
      const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return json({ ok: false, error: 'Nicht angemeldet.' }, 401);
      return await testPush(data.user.id);
    }

    if (request.headers.get('x-cron-secret') !== cronSecret) {
      return json({ ok: false, error: 'Nicht autorisiert.' }, 401);
    }
    return await dispatchDue();
  } catch (error) {
    return json({ ok: false, error: String((error as Error)?.message || error) }, 500);
  }
});
