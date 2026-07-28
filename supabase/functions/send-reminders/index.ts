import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import webpush from 'npm:web-push@3.6.7';

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

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function localParts(now: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
    const weekdays: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return {
      weekday: weekdays[value('weekday')],
      hour: Number(value('hour')),
      minute: Number(value('minute')),
    };
  } catch {
    return localParts(now, 'UTC');
  }
}

function minutes(time: string | undefined) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function isDue(reminder: Reminder, timeZone: string, now: Date) {
  const local = localParts(now, timeZone);
  if (!(reminder.weekdays || [0, 1, 2, 3, 4, 5, 6]).includes(local.weekday)) return false;
  const current = local.hour * 60 + local.minute;
  const start = minutes(reminder.time);
  if (reminder.type !== 'drink') return current === start;
  const end = minutes(String(reminder.metadata?.bis || '21:00'));
  const interval = Math.max(15, Number(reminder.metadata?.intervall_minuten || 120));
  return current >= start && current <= end && (current - start) % interval === 0;
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
  };
  return {
    title: reminder.label,
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
  for (const subscription of data as Subscription[]) {
    try {
      await send(subscription, notification());
      sent += 1;
    } catch (error) {
      await removeExpired(subscription, error);
    }
  }
  return json({ ok: sent > 0, sent }, sent > 0 ? 200 : 502);
}

async function dispatchDue() {
  const now = new Date();
  const scheduledFor = `${now.toISOString().slice(0, 16)}:00.000Z`;

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
  const due = ((reminders || []) as Reminder[])
    .filter((reminder) => isDue(reminder, zones.get(reminder.user_id) || 'UTC', now));
  if (!due.length) return json({ ok: true, due: 0, sent: 0 });

  const userIds = [...new Set(due.map((reminder) => reminder.user_id))];
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
  for (const reminder of due) {
    for (const subscription of byUser.get(reminder.user_id) || []) {
      const { data: delivery, error: claimError } = await admin
        .from('push_deliveries')
        .insert({
          reminder_id: reminder.id,
          subscription_id: subscription.id,
          scheduled_for: scheduledFor,
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
