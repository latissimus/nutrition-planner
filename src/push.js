import { supabase } from './supabase.js';

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();

function base64UrlToBytes(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export function pushSupport() {
  if (!window.isSecureContext) {
    return { ready: false, reason: 'Benachrichtigungen benötigen die veröffentlichte HTTPS-App.' };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ready: false, reason: 'Dieser Browser unterstützt keine Push-Benachrichtigungen.' };
  }
  if (isIos() && !isStandalone()) {
    return { ready: false, reason: 'Auf dem iPhone zuerst „Zum Home-Bildschirm“ wählen und die App dort öffnen.' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { ready: false, reason: 'Der Push-Dienst ist noch nicht vollständig eingerichtet.' };
  }
  return { ready: true, reason: '' };
}

async function registration(update = false) {
  const current = await navigator.serviceWorker.ready;
  if (update) await current.update().catch(() => {});
  return current;
}

async function saveSubscription(userId, subscription) {
  const json = subscription.toJSON();
  const payload = {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent.slice(0, 500),
    last_seen_at: new Date().toISOString(),
  };
  if (!payload.endpoint || !payload.p256dh || !payload.auth) {
    throw new Error('Das Gerät hat kein vollständiges Push-Abo geliefert.');
  }
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'endpoint' });
  if (error) throw error;
  return subscription;
}

export async function getPushState() {
  const support = pushSupport();
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  if (!support.ready) return { ...support, permission, subscribed: false };
  const current = await registration();
  const subscription = await current.pushManager.getSubscription();
  return {
    ready: true,
    reason: '',
    permission,
    subscribed: Boolean(subscription),
  };
}

export async function activatePush(userId) {
  const support = pushSupport();
  if (!support.ready) throw new Error(support.reason);

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Benachrichtigungen wurden nicht erlaubt.');
  }

  const current = await registration();
  let subscription = await current.pushManager.getSubscription();
  if (!subscription) {
    subscription = await current.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    });
  }
  await saveSubscription(userId, subscription);
  return subscription;
}

export async function syncPushSubscription(userId) {
  const support = pushSupport();
  if (!support.ready || Notification.permission !== 'granted') return false;
  const current = await registration(true);
  const subscription = await current.pushManager.getSubscription();
  if (!subscription) return false;
  await saveSubscription(userId, subscription);
  return true;
}

export async function disablePush() {
  const support = pushSupport();
  if (!support.ready) return;
  const current = await registration();
  const subscription = await current.pushManager.getSubscription();
  if (!subscription) return;
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint);
  if (error) throw error;
  await subscription.unsubscribe();
}

export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke('send-reminders', {
    body: { action: 'test' },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Testnachricht konnte nicht gesendet werden.');
  return data;
}
