import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { iconMarkup } from './icons.js';
import { availableCategoryIcons, materialIconMarkup, categoryColor, pageLook } from './categoryIcons.js';
import {
  activatePush,
  browserPushSubscriptionExists,
  disablePush,
  getPushState,
  pushSupport,
  sendTestPush,
  syncPushSubscription,
} from './push.js';
import {
  reminderIsDueAfterOffset, reminderNotificationTag, shouldReuseReminderLoop,
  shouldStartLocalReminderLoop, supplementGroupTitle, supplementNotificationTag,
} from './notificationDelivery.js';
import { mountNutrition } from './nutrition.js';
import { createSpecialDexOverlay, SPECIAL_DEX_CLASSES } from './specialDex.js';
import { bindLongPress } from './longPress.js';
import { notifyHomeCountsChanged } from './realtime.js';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const CHECK_INTERVAL_MS = 30000;
const AUTOSAVE_MS = 700;
let reminderTimer = null;
let reminderUserId = null;
let reminderStartPromise = null;
let reminderLoopGeneration = 0;

const DEFAULT_REMINDERS = [
  { type: 'meal', label: 'Frühstück', time: '08:00', route: '#reminders', metadata: { icon: 'Frühstück', meal_slot: 'breakfast' } },
  { type: 'meal', label: 'Snack vormittags', time: '10:30', route: '#reminders', metadata: { icon: 'Snack', meal_slot: 'snack_morning' } },
  { type: 'meal', label: 'Mittagessen', time: '13:00', route: '#reminders', metadata: { icon: 'lunch_dining', meal_slot: 'lunch' } },
  { type: 'meal', label: 'Snack nachmittags', time: '16:30', route: '#reminders', metadata: { icon: 'Snack', meal_slot: 'snack_afternoon' } },
  { type: 'meal', label: 'Abendessen', time: '19:00', route: '#reminders', metadata: { icon: 'Abendessen', meal_slot: 'dinner' } },
  {
    type: 'drink',
    label: 'Trinken',
    time: '09:00',
    route: '#reminders',
    metadata: { bis: '21:00', intervall_minuten: 120, icon: 'water_drop' },
  },
];

const TYPE_LABEL = {
  meal: 'Mahlzeit',
  supplement: 'Supplement',
  drink: 'Trinken',
  body: 'Körperwerte',
  sleep: 'Schlaf',
};

// Analog zur Notification-Body-Formatierung in send-reminders/index.ts.
const EINHEITEN = ['', 'mg', 'µg', 'g', 'IE', 'ml', 'Tropfen', 'Kapsel', 'Tablette', 'TL', 'EL'];
const HINWEISE = [
  ['', 'ohne Hinweis'],
  ['nuechtern', 'Nüchtern'],
  ['zum-essen', 'Zum Essen'],
  ['nach-training', 'Nach dem Training'],
  ['vor-schlafen', 'Vor dem Schlafen'],
];

// Supplement-Symbole werden bewusst aus der Einheit abgeleitet. Die IDs
// entsprechen direkt den erwarteten Dateinamen im MUSCLEDEX-ICONS-Ordner.
const SUPPLEMENT_ICON_BY_UNIT = new Map([
  ['Kapsel', 'kapsel'],
  ['Tablette', 'tablette'],
  ['Tropfen', 'tropfen'],
  ['ml', 'flüssigkeit'],
  ['g', 'pulver'],
  ['mg', 'pulver'],
  ['µg', 'pulver'],
  ['TL', 'pulver'],
  ['EL', 'pulver'],
  ['IE', 'sonstiges'],
  ['', 'sonstiges'],
]);

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const supplementIconId = (unit = '') => SUPPLEMENT_ICON_BY_UNIT.get(String(unit).trim()) || 'sonstiges';

function reminderIconValue(reminder) {
  if (reminder.type === 'drink') return 'water_drop';
  if (reminder.type === 'supplement') {
    const iconId = supplementIconId(reminder.metadata?.einheit);
    return availableCategoryIcons.some((icon) => icon.id === iconId) ? iconId : 'pill';
  }
  if (reminder.metadata?.icon) return reminder.metadata.icon;
  if (reminder.metadata?.emoji) return `emoji:${reminder.metadata.emoji}`;
  return 'fastfood';
}

function notificationSymbol(reminder) {
  const value = reminderIconValue(reminder);
  if (value.startsWith('emoji:')) return value.replace(/^(emoji:)+/, '');
  if (reminder.type === 'meal') {
    const slot = mealSlotForReminder(reminder);
    if (slot === 'breakfast') return '🍳';
    if (slot === 'lunch') return '🍖';
    if (slot === 'dinner') return '🥩';
    if (slot === 'snack_morning' || slot === 'snack_afternoon') return '🌰';
  }
  return ({
    fastfood: '🍔', pill: '💊', kapsel: '💊', tablette: '💊', pulver: '🥄',
    tropfen: '💧', flüssigkeit: '🧴', sonstiges: '◆', water_drop: '💧', bedtime: '🌙',
  })[value] || '◆';
}

export function reminderIconMarkup(value, className = '') {
  if (String(value).startsWith('emoji:')) {
    return `<span class="reminder-emoji ${className}">${escapeHtml(String(value).slice(6))}</span>`;
  }
  const icon = availableCategoryIcons.find((item) => item.id === String(value || '').normalize('NFC'));
  return icon ? `<span class="reminder-svg ${className}">${icon.svg}</span>` : '<span class="reminder-emoji">●</span>';
}

const pad = (value) => String(value).padStart(2, '0');
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const minuteKey = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const minutesFromTime = (time) => {
  const [hours, minutes] = String(time || '00:00').split(':').map((part) => Number(part));
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};
const mealSlotForReminder = (item) => {
  if (item.metadata?.meal_slot) return item.metadata.meal_slot;
  const label = String(item.label || '').toLocaleLowerCase('de');
  if (label.includes('frühstück')) return 'breakfast';
  if (label.includes('vormittag')) return 'snack_morning';
  if (label.includes('mittagessen')) return 'lunch';
  if (label.includes('nachmittag')) return 'snack_afternoon';
  if (label.includes('abend')) return 'dinner';
  const minutes = minutesFromTime(item.time);
  if (minutes < 9 * 60 + 45) return 'breakfast';
  if (minutes < 12 * 60) return 'snack_morning';
  if (minutes < 15 * 60) return 'lunch';
  if (minutes < 18 * 60) return 'snack_afternoon';
  return 'dinner';
};

const supplementSlotForReminder = (item) => item.metadata?.meal_slot || mealSlotForReminder(item);

const isConfiguredSupplement = (item) => item.type === 'supplement'
  && !item.metadata?.deleted
  && (item.active || !/^Supplement (AM|PM)$/i.test(String(item.label || '').trim()));

const supplementsForMeal = (meal, reminders) => {
  const slot = mealSlotForReminder(meal);
  return reminders.filter((item) => isConfiguredSupplement(item)
    && supplementSlotForReminder(item) === slot);
};

const einheitLabel = (value) => ({ Kapsel: 'Kapsel(n)', Tablette: 'Tablette(n)' })[value] || value;

function nextDrinkSlot(reminder, now) {
  const start = minutesFromTime(reminder.time);
  const end = minutesFromTime(reminder.metadata?.bis || '21:00');
  const interval = Math.max(15, Number(reminder.metadata?.intervall_minuten || 120));
  const current = now.getHours() * 60 + now.getMinutes();
  if (current < start || current > end) return null;
  return (current - start) % interval === 0 ? minuteKey(now) : null;
}

function hinweisLabel(value) {
  const paar = HINWEISE.find(([wert]) => wert === (value || ''));
  return paar && paar[0] ? paar[1] : '';
}

function notificationText(reminder) {
  if (reminder.type === 'meal') {
    const note = String(reminder.metadata?.notiz || '').trim();
    return { title: `${notificationSymbol(reminder)} ${reminder.label}`, body: note || 'Zeit für deine geplante Mahlzeit.' };
  }
  if (reminder.type === 'supplement-group') {
    const supplements = reminder.metadata?.supplements || [];
    const body = supplements.map((item) => {
      const dosis = String(item.metadata?.dosis || '').trim();
      const einheit = String(item.metadata?.einheit || '').trim();
      const amount = dosis && einheit ? `${dosis} ${einheitLabel(einheit)}` : dosis || einheitLabel(einheit);
      return amount ? `${item.label} (${amount})` : item.label;
    }).join(' · ');
    return { title: `💊 ${supplementGroupTitle(reminder.metadata?.meal_slot)}`, body: body || 'Supplement-Stack checken.' };
  }
  if (reminder.type === 'supplement') {
    const dosis = String(reminder.metadata?.dosis || '').trim();
    const einheit = String(reminder.metadata?.einheit || '').trim();
    const hinweis = String(reminder.metadata?.hinweis || '').trim();
    const parts = [dosis && einheit ? `${dosis} ${einheitLabel(einheit)}` : dosis || einheitLabel(einheit), hinweisLabel(hinweis)].filter(Boolean);
    return { title: `${notificationSymbol(reminder)} ${reminder.label}`, body: parts.join(' · ') || 'Supplement-Stack checken.' };
  }
  if (reminder.type === 'drink') return { title: `${notificationSymbol(reminder)} ${reminder.label}`, body: 'Ein Glas Wasser einplanen.' };
  if (reminder.type === 'sleep') {
    const phase = reminder.metadata?.phase;
    const body = phase === 'wind-down' ? 'Zeit, Bildschirm und Tempo langsam herunterzufahren.'
      : phase === 'check-in' ? 'Wie war deine Nacht? Dein Check-in bringt 3 MUSCLE-COINS.'
        : 'Dein geplanter Schlaf beginnt jetzt.';
    return { title: `${notificationSymbol(reminder)} ${reminder.label.split(' · ')[0]}`, body };
  }
  return { title: reminder.label, body: 'Geplante Erinnerung.' };
}

async function loadReminders(userId, signal, { includeDeleted = false } = {}) {
  let query = supabase
    .from('reminders')
    .select('id, type, label, time, weekdays, active, metadata, route')
    .eq('user_id', userId)
    .order('type')
    .order('time');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return includeDeleted ? (data ?? []) : (data ?? []).filter((reminder) => !reminder.metadata?.deleted);
}

async function loadCompletionsToday(userId, signal) {
  const today = dateKey(new Date());
  let query = supabase
    .from('reminder_completions')
    .select('id, reminder_id, date, completed_at, snoozed_until')
    .eq('user_id', userId)
    .eq('date', today);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function upsertCompletion(userId, reminderId, patch) {
  const today = dateKey(new Date());
  const { data, error } = await supabase.from('reminder_completions')
    .upsert({ user_id: userId, reminder_id: reminderId, date: today, ...patch }, { onConflict: 'user_id,reminder_id,date' })
    .select('id, reminder_id, date, completed_at, snoozed_until')
    .single();
  if (error) throw error;
  return data;
}

function reminderPayload(userId, reminder) {
  return {
    user_id: userId,
    type: reminder.type,
    label: (reminder.label || '').trim() || TYPE_LABEL[reminder.type] || 'Erinnerung',
    time: reminder.time || '08:00',
    weekdays: reminder.weekdays?.length ? reminder.weekdays : WEEKDAYS,
    active: Boolean(reminder.active),
    metadata: reminder.metadata || {},
    route: reminder.route || '#reminders',
  };
}

async function saveReminder(userId, reminder) {
  const payload = reminderPayload(userId, reminder);
  const query = supabase.from('reminders');
  // Kein Upsert-on-conflict mehr: Die Label-Uniqueness liegt jetzt in zwei
  // partiellen Indizes (Supplements per Name+Zeit, Rest per Name), die ein
  // PostgREST-Upsert ohne Prädikat nicht adressieren kann. Neue Zeilen daher
  // per Insert; ein echter Konflikt wirft 23505 und wird oben abgefangen.
  const request = reminder.id
    ? query.update(payload).eq('id', reminder.id).eq('user_id', userId)
    : query.insert(payload);
  let { data, error } = await request
    .select('id, type, label, time, weekdays, active, metadata, route')
    .single();
  if (error && reminder.type === 'supplement'
    && (error.code === '23505' || String(error.message || '').includes('reminders_supplement_uniq'))) {
    let existingQuery = query
      .select('id, metadata')
      .eq('user_id', userId)
      .eq('type', 'supplement')
      .eq('label', payload.label)
      .eq('time', payload.time)
      .limit(1);
    if (reminder.id) existingQuery = existingQuery.neq('id', reminder.id);
    const existing = await existingQuery.maybeSingle();
    if (!existing.error && existing.data?.id) {
      const updatePayload = {
        ...payload,
        active: true,
        metadata: { ...(existing.data.metadata || {}), ...(payload.metadata || {}), deleted: false },
      };
      if (reminder.id && reminder.id !== existing.data.id) {
        await query
          .update({ active: false, metadata: { ...(reminder.metadata || {}), deleted: true } })
          .eq('id', reminder.id)
          .eq('user_id', userId);
      }
      ({ data, error } = await query
        .update(updatePayload)
        .eq('id', existing.data.id)
        .eq('user_id', userId)
        .select('id, type, label, time, weekdays, active, metadata, route')
        .single());
    }
  }
  if (error) throw error;
  notifyHomeCountsChanged();
  return data;
}

async function deleteReminder(userId, reminderId) {
  const { data: existing, error: loadError } = await supabase.from('reminders')
    .select('metadata').eq('id', reminderId).eq('user_id', userId).single();
  if (loadError) throw loadError;
  const { error } = await supabase.from('reminders')
    .update({ active: false, metadata: { ...(existing?.metadata || {}), deleted: true } })
    .eq('id', reminderId).eq('user_id', userId);
  if (error) throw error;
  notifyHomeCountsChanged();
}

async function ensureDefaults(userId, signal) {
  let current = await loadReminders(userId, signal, { includeDeleted: true });
  // Frühere Versionen legten zwei generische Supplement-Zeilen an. Sie waren
  // keine echten Nutzerdaten und sollen bei bestehenden Konten einmalig
  // verschwinden, damit sie nicht weiter im Meal-Log auftauchen.
  const alteStandardSupps = current.filter((reminder) => reminder.type === 'supplement'
    && !reminder.metadata?.deleted
    && /^Supplement (AM|PM)$/i.test(String(reminder.label || '').trim()));
  if (alteStandardSupps.length) {
    await Promise.all(alteStandardSupps.map(async (reminder) => {
      const metadata = { ...(reminder.metadata || {}), deleted: true };
      const { error } = await supabase.from('reminders').update({ active: false, metadata })
        .eq('id', reminder.id).eq('user_id', userId);
      if (error) throw error;
      reminder.active = false;
      reminder.metadata = metadata;
    }));
  }
  const existing = new Set(current.map((reminder) => `${reminder.type}:${reminder.label}`));
  const payloads = DEFAULT_REMINDERS.filter((reminder) => !existing.has(`${reminder.type}:${reminder.label}`)).map((reminder) => reminderPayload(userId, {
    ...reminder, active: false, weekdays: WEEKDAYS,
  }));
  if (!payloads.length) return current.filter((reminder) => !reminder.metadata?.deleted);
  // Nur die noch fehlenden Defaults werden eingefügt (oben nach `existing`
  // gefiltert), daher genügt ein Insert – kein Upsert-on-conflict nötig.
  let query = supabase
    .from('reminders')
    .insert(payloads)
    .select('id, type, label, time, weekdays, active, metadata, route');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return [...current, ...(data ?? [])].filter((reminder) => !reminder.metadata?.deleted);
}

async function maybeNotify(reminder, slot, now, userId) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const key = `nutrition-reminder:${userId}:${reminder.id}:${dateKey(now)}:${slot}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  const text = notificationText(reminder);
  const worker = await navigator.serviceWorker?.ready;
  if (!worker) return;
  await worker.showNotification(text.title, {
    body: text.body,
    // Derselbe Tag wie beim serverseitigen Web Push: Sollte ein alter lokaler
    // Timer ausnahmsweise noch einen Tick schaffen, ersetzt iOS die Meldung,
    // statt zwei identische Benachrichtigungen nebeneinander zu zeigen.
    tag: reminder.type === 'supplement-group'
      ? supplementNotificationTag(reminder.metadata?.meal_reminder_id)
      : reminderNotificationTag(reminder.id),
    data: {
      url: reminder.route || '#reminders',
      reminderId: reminder.id,
      reminderType: reminder.type,
    },
  });
}

async function tickReminders(userId) {
  let reminders = [];
  try { reminders = await loadReminders(userId); }
  catch (error) { return; }
  const now = new Date();
  const today = now.getDay();
  const currentMinute = minuteKey(now);
  // Normale Mahlzeiten, Trinkintervalle usw. feuern zu ihrer eigenen Zeit.
  reminders.filter((reminder) => reminder.active && reminder.type !== 'supplement' && (reminder.weekdays || WEEKDAYS).includes(today)).forEach((reminder) => {
    const slot = reminder.type === 'drink' ? nextDrinkSlot(reminder, now) : reminder.time?.slice(0, 5);
    if (slot === currentMinute) maybeNotify(reminder, slot, now, userId);
  });
  // Alle Supplements eines Mahlzeitenblocks werden zehn Minuten nach dessen
  // Uhrzeit in genau einer Meldung zusammengefasst. Der Ursprungstag wird aus
  // `now - 10 min` ermittelt, damit auch Mahlzeiten kurz vor Mitternacht stimmen.
  reminders.filter((reminder) => reminder.active && reminder.type === 'meal').forEach((meal) => {
    const supplements = supplementsForMeal(meal, reminders);
    if (!supplements.length || !reminderIsDueAfterOffset(meal, now, 10)) return;
    const grouped = {
      id: `${meal.id}:supplements`,
      type: 'supplement-group',
      route: meal.route,
      metadata: {
        meal_reminder_id: meal.id,
        meal_slot: mealSlotForReminder(meal),
        supplements,
      },
    };
    maybeNotify(grouped, currentMinute, now, userId);
  });
}

export async function startReminderLoop(userId, { forceRestart = false } = {}) {
  if (!userId) return;
  if (shouldReuseReminderLoop({ sameUser: reminderUserId === userId, forceRestart })) return reminderStartPromise;
  const generation = ++reminderLoopGeneration;
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = null;
  reminderUserId = userId;
  reminderStartPromise = (async () => {
    const browserSubscription = await browserPushSubscriptionExists().catch(() => false);
    const serverPushActive = await syncPushSubscription(userId).catch(() => false);
    if (reminderUserId !== userId || reminderLoopGeneration !== generation) return;
    if (reminderTimer) clearInterval(reminderTimer);
    reminderTimer = null;
    if (!shouldStartLocalReminderLoop({
      serverPushActive,
      browserSubscriptionExists: browserSubscription,
    })) return;
    tickReminders(userId);
    reminderTimer = setInterval(() => tickReminders(userId), CHECK_INTERVAL_MS);
  })().finally(() => {
    if (reminderUserId === userId && reminderLoopGeneration === generation) reminderStartPromise = null;
  });
  return reminderStartPromise;
}

function permissionMarkup(state) {
  if (!state) {
    return '<div class="rem-push-status rem-push-loading">Push-Status wird geprüft …</div>';
  }
  if (!state.ready) {
    return `<div class="rem-push-status rem-push-warn">${escapeHtml(state.reason)}</div>`;
  }
  if (state.permission === 'denied') {
    return '<div class="rem-push-status rem-push-warn">Benachrichtigungen sind blockiert. Bitte in den System­einstellungen für diese App erlauben.</div>';
  }
  if (state.subscribed) {
    return `<div class="rem-push-status rem-push-ok">
      <div class="rem-push-titel"><span class="rem-push-haken" aria-hidden="true">✓</span><b>Push ist aktiv</b></div>
      <span class="rem-push-untertitel">Dieses Gerät empfängt Erinnerungen auch bei geschlossener App.</span>
      <div class="rem-push-aktionen">
        <button class="btn rem-push-test" type="button" data-test-push>Test senden</button>
        <button class="btn rem-push-refresh" type="button" data-refresh-push aria-label="Status aktualisieren">↻</button>
        <button class="btn rem-push-off" type="button" data-disable-push>Ausschalten</button>
      </div>
    </div>`;
  }
  return `<div class="rem-push-status rem-push-off-state">
    <span>Dieses Gerät ist noch nicht für Push registriert.</span>
    <button class="btn btn-primary rem-push-activate" type="button" data-activate-push>Benachrichtigungen aktivieren</button>
  </div>`;
}

async function renderPushControls(container, userId) {
  const slot = container.querySelector('[data-permission]');
  if (!slot) return;
  slot.innerHTML = permissionMarkup();

  let state;
  try {
    state = await getPushState();
  } catch (error) {
    slot.innerHTML = `<div class="rem-push-status rem-push-warn">${escapeHtml(error.message)}</div>`;
    return;
  }
  slot.innerHTML = permissionMarkup(state);

  const activate = slot.querySelector('[data-activate-push]');
  if (activate) {
    activate.onclick = async () => {
      activate.disabled = true;
      try {
        await activatePush(userId);
        await renderPushControls(container, userId);
        await startReminderLoop(userId, { forceRestart: true });
        toast('Push-Benachrichtigungen aktiviert');
      } catch (error) {
        toast(error.message || 'Push konnte nicht aktiviert werden');
        await renderPushControls(container, userId);
      }
    };
  }

  const test = slot.querySelector('[data-test-push]');
  if (test) {
    test.onclick = async () => {
      test.disabled = true;
      try {
        await sendTestPush();
        toast('Testnachricht wurde gesendet');
      } catch (error) {
        toast(error.message || 'Testnachricht fehlgeschlagen');
      } finally {
        if (test.isConnected) test.disabled = false;
      }
    };
  }

  const refresh = slot.querySelector('[data-refresh-push]');
  if (refresh) {
    refresh.onclick = async () => {
      refresh.disabled = true;
      await renderPushControls(container, userId);
    };
  }

  const disable = slot.querySelector('[data-disable-push]');
  if (disable) {
    disable.onclick = async () => {
      disable.disabled = true;
      try {
        await disablePush();
        reminderUserId = null;
        await startReminderLoop(userId, { forceRestart: true });
        await renderPushControls(container, userId);
        toast('Push auf diesem Gerät ausgeschaltet');
      } catch (error) {
        toast(error.message || 'Push konnte nicht ausgeschaltet werden');
        if (disable.isConnected) disable.disabled = false;
      }
    };
  }
}

// Zusammenfassung der Zeile im geschlossenen Zustand.
function summaryFor(reminder) {
  const time = String(reminder.time || '').slice(0, 5);
  if (reminder.type === 'drink') {
    const interval = Number(reminder.metadata?.intervall_minuten || 120);
    const bis = String(reminder.metadata?.bis || '21:00').slice(0, 5);
    const intervall = interval % 60 === 0 ? `alle ${interval / 60}h` : `alle ${interval}min`;
    return { time: intervall, detail: `${time}–${bis}` };
  }
  if (reminder.type === 'supplement') {
    const dosis = String(reminder.metadata?.dosis || '').trim();
    const einheit = String(reminder.metadata?.einheit || '').trim();
    const hinweis = hinweisLabel(reminder.metadata?.hinweis);
    const teile = [dosis && einheit ? `${dosis} ${einheitLabel(einheit)}` : dosis || einheitLabel(einheit), hinweis].filter(Boolean);
    return { time, detail: teile.join(' · ') };
  }
  return { time, detail: String(reminder.metadata?.notiz || '').trim() };
}

function statusBadge(completion) {
  if (completion?.completed_at) return '<span class="rem-row-status ist-erledigt">Heute erledigt</span>';
  return '';
}

function reminderBodyMarkup(reminder, completion) {
  const isDrink = reminder.type === 'drink';
  const isSupplement = reminder.type === 'supplement';
  const zeit = (reminder.time || '08:00').slice(0, 5);
  if (isSupplement) {
    return `<div class="rem-row-body">
      <label class="rem-field"><span>Name</span>
        <input class="input" data-label maxlength="120" value="${escapeHtml(reminder.label)}">
      </label>
      <div class="rem-field-reihe">
        <label class="rem-field"><span>Dosis</span>
          <input class="input" data-dosis type="number" inputmode="decimal" min="0" step="any" placeholder="z. B. 5000" value="${escapeHtml(reminder.metadata?.dosis || '')}">
        </label>
        <label class="rem-field"><span>Einheit</span>
          <select class="input" data-einheit>
            ${EINHEITEN.map((einheit) => `<option value="${escapeHtml(einheit)}"${(reminder.metadata?.einheit || '') === einheit ? ' selected' : ''}>${einheit ? einheitLabel(einheit) : '—'}</option>`).join('')}
          </select>
        </label>
      </div>
      <label class="rem-field"><span>Einnahmehinweis</span>
        <select class="input" data-hinweis>
          ${HINWEISE.map(([wert, name]) => `<option value="${escapeHtml(wert)}"${(reminder.metadata?.hinweis || '') === wert ? ' selected' : ''}>${name}</option>`).join('')}
        </select>
      </label>
      <button type="button" class="btn btn-primary rem-speichern" data-save-reminder>Änderungen speichern</button>
      ${reminder.id ? '<button type="button" class="btn btn-block routine-delete" data-remove-reminder>Eintrag löschen</button>' : ''}
    </div>`;
  }
  return `<div class="rem-row-body">
    ${isDrink ? `<label class="rem-field"><span>Name</span>
      <input class="input" data-label maxlength="120" value="${escapeHtml(reminder.label)}">
    </label>` : `<div class="rem-name-reihe">
      <div class="rem-field rem-icon-field"><span>Icon</span>
        <button type="button" class="rem-icon-waehler" data-reminder-icon-open aria-label="Icon auswählen">${reminderIconMarkup(reminderIconValue(reminder))}</button>
        <input type="hidden" data-icon-value value="${escapeHtml(reminderIconValue(reminder))}">
      </div>
      <label class="rem-field"><span>Name</span>
        <input class="input" data-label maxlength="120" value="${escapeHtml(reminder.label)}">
      </label>
    </div>`}
    <div class="rem-field-reihe${isDrink ? ' rem-trinkzeiten' : ''}">
      <label class="rem-field"><span>Start</span>
        <input class="input" data-time type="time" value="${zeit}">
      </label>
      ${isDrink ? `
        <label class="rem-field"><span>Bis</span>
          <input class="input" data-end type="time" value="${(reminder.metadata?.bis || '21:00').slice(0, 5)}">
        </label>
        <label class="rem-field"><span>Alle</span>
          <select class="input" data-interval>
            ${[60, 90, 120, 180, 240].map((minutes) => `<option value="${minutes}"${Number(reminder.metadata?.intervall_minuten || 120) === minutes ? ' selected' : ''}>${minutes} min</option>`).join('')}
          </select>
        </label>` : ''}
    </div>
    ${!isDrink ? `<label class="rem-field"><span>Notiz</span>
      <textarea class="input rem-mahlzeit-notiz" data-meal-note maxlength="240" rows="3" placeholder="z. B. 40 g Haferflocken, Banane und Protein">${escapeHtml(reminder.metadata?.notiz || '')}</textarea>
    </label>` : ''}
    <div class="rem-row-body-aktionen">
      <label class="rem-switch">
        <input type="checkbox" data-active${reminder.active ? ' checked' : ''}>
        <span class="rem-switch-thumb"></span>
        <span class="rem-switch-label">Aktiv</span>
      </label>
    </div>
    <button type="button" class="btn btn-primary rem-speichern" data-save-reminder>Änderungen speichern</button>
    ${reminder.id && reminder.type === 'meal' ? `
      <button type="button" class="btn btn-block routine-delete" data-remove-reminder>Eintrag löschen</button>
    ` : ''}
  </div>`;
}

function reminderRowMarkup(reminder, completion) {
  const key = reminder._key || reminder.id;
  const zusammenfassung = summaryFor(reminder);
  const badge = statusBadge(completion);
  const dimmed = completion?.completed_at ? ' ist-erledigt' : '';
  const inaktiv = reminder.active ? '' : ' ist-inaktiv';
  const commonAttrs = `data-reminder-key="${key}" data-type="${reminder.type}"${['meal', 'supplement'].includes(reminder.type) ? ` data-meal-slot="${reminder.type === 'supplement' ? supplementSlotForReminder(reminder) : mealSlotForReminder(reminder)}"` : ''}`;
  const head = `
    <span class="rem-row-emoji" aria-hidden="true">${reminderIconMarkup(reminderIconValue(reminder))}</span>
    <span class="rem-row-titel">
      <b>${escapeHtml(reminder.label)}</b>
      <small class="rem-row-art">${reminder.type === 'supplement' ? 'SUPPLEMENT' : reminder.type === 'drink' ? 'TRINKEN' : 'MAHLZEIT'}</small>
      ${zusammenfassung.detail ? `<small>${escapeHtml(zusammenfassung.detail)}</small>` : ''}
      ${badge}
    </span>
    ${reminder.type === 'supplement' ? '' : `<span class="rem-row-zeit">${escapeHtml(zusammenfassung.time)}</span>`}
    ${reminder.type === 'drink' ? '<span class="rem-row-chevron" aria-hidden="true">⌄</span>' : ''}`;
  if (reminder.type === 'drink') {
    return `<details class="rem-row${dimmed}${inaktiv}" ${commonAttrs}>
      <summary class="rem-row-head">${head}</summary>
      ${reminderBodyMarkup(reminder, completion)}
    </details>`;
  }
  return `<div class="rem-row${dimmed}${inaktiv}" ${commonAttrs}>
    <div class="rem-row-head">${head}</div>
  </div>`;
}

function reminderGroups(reminders, completions) {
  const completionByReminder = new Map(completions.map((c) => [c.reminder_id, c]));
  const drink = reminders.find((item) => item.type === 'drink');
  const interval = Number(drink?.metadata?.intervall_minuten || 120);
  const periods = [
    ['breakfast', 'FRÜHSTÜCK', 'Frühstück', 0, 9 * 60 + 45],
    ['snack_morning', 'SNACK', 'Snack', 9 * 60 + 45, 12 * 60],
    ['lunch', 'MITTAGESSEN', 'lunch_dining', 12 * 60, 15 * 60],
    ['snack_afternoon', 'SNACK', 'Snack', 15 * 60, 18 * 60],
    ['dinner', 'ABENDESSEN', 'Abendessen', 18 * 60, 24 * 60],
  ];
  const timed = reminders.filter((item) => item.type === 'supplement')
    .sort((a, b) => minutesFromTime(a.time) - minutesFromTime(b.time));
  const timeline = periods.map(([period, title, fallbackIcon, start, end]) => {
    const slotReminder = reminders.find((item) => item.type === 'meal' && mealSlotForReminder(item) === period);
    const rows = timed.filter((item) => supplementSlotForReminder(item) === period);
    const note = (slotReminder?.metadata?.notiz || '').trim();
    const slotKey = slotReminder?._key || slotReminder?.id;
    return `<section class="mahl-zeitblock mahl-zeitblock-${period} ${SPECIAL_DEX_CLASSES.card} ${SPECIAL_DEX_CLASSES.listCard}">
      <header class="mahl-slot-kopf">
        <div class="mahl-slot-titel">
          <div class="mahl-slot-heading"><h2>${title}</h2>
            ${slotReminder ? `<button type="button" class="som-info-knopf mahl-slot-info mahl-slot-info-edit${note ? ' hat-info' : ''}" data-slot-info-edit data-slot-key="${slotKey}" aria-label="Info zu ${title} bearbeiten">i</button>` : ''}
          </div>
          ${slotReminder ? `<label class="mahl-slot-zeit"><span class="mahl-slot-zeit-anzeige" aria-hidden="true">${escapeHtml(String(slotReminder.time || '').slice(0, 5))}</span><input type="time" value="${escapeHtml(String(slotReminder.time || '').slice(0, 5))}" data-slot-time data-slot-key="${slotReminder._key || slotReminder.id}" aria-label="Uhrzeit für ${title}"></label>` : ''}
        </div>
        ${slotReminder ? `<div class="mahl-slot-rechts">
          <label class="mahl-mini-switch" aria-label="${title} aktivieren">
            <input type="checkbox" data-slot-active data-slot-key="${slotReminder._key || slotReminder.id}"${slotReminder.active ? ' checked' : ''}>
            <i class="mahl-mini-switch-track" aria-hidden="true"></i>
          </label>
        </div>
        ` : ''}
      </header>
      <div class="mahl-timeline"><div data-period-reminders>${rows.length
        ? rows.map((reminder) => reminderRowMarkup(reminder, completionByReminder.get(reminder.id))).join('')
        : '<p class="mahl-leerzeile" data-reminder-empty>Noch keine Einträge</p>'}</div>
        <div data-nutrition-period="${period}"></div>
      </div>
    </section>`;
  }).join('');
  const water = `<section class="mahl-zeitblock mahl-trinken ${SPECIAL_DEX_CLASSES.card} ${SPECIAL_DEX_CLASSES.listCard}">
    <header><h2>TRINKEN</h2></header>
    <div class="mahl-timeline">${drink
      ? reminderRowMarkup(drink, completionByReminder.get(drink.id))
      : '<p class="mahl-leerzeile">Noch kein Trinkintervall</p>'}</div>
  </section>`;
  return `<div class="mahl-tagesplan ${SPECIAL_DEX_CLASSES.stack}">${timeline}${water}</div>
    <button hidden data-add-reminder="supplement"></button><button hidden data-add-reminder="drink"></button>`;
}

function reminderOverlay(markup) {
  return createSpecialDexOverlay({
    markup,
    className: 'reminder-overlay offen',
    sheetClassName: 'sammlung-editor',
    closeSelector: '[data-reminder-overlay-close]',
    replaceSelector: '.reminder-overlay',
  });
}

function choosePeriod(type, onSelected) {
  const supplement = type === 'supplement';
  const backdrop = reminderOverlay(`
    <header><h2>${supplement ? 'Supplement eintragen' : 'Mahlzeit eintragen'}</h2><button data-reminder-overlay-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <p class="rem-overlay-hinweis">Wann soll es eingetragen werden?</p>
    <div class="sheet-menue rem-period-menu">
      <button type="button" data-period="breakfast"><span>Frühstück</span></button>
      <button type="button" data-period="snack_morning"><span>Snack vormittags</span></button>
      <button type="button" data-period="lunch"><span>Mittagessen</span></button>
      <button type="button" data-period="snack_afternoon"><span>Snack nachmittags</span></button>
      <button type="button" data-period="dinner"><span>Abendessen</span></button>
    </div>`);
  backdrop.classList.add('rem-period-overlay');
  backdrop.querySelector('.rem-period-menu').onclick = (event) => {
    const period = event.target.closest('[data-period]')?.dataset.period;
    if (!period) return;
    backdrop.remove();
    onSelected(period);
  };
}

export function chooseReminderIcon(current, onSelected, { hostBackdrop = null } = {}) {
  const markup = `
    <header><h2>Icon auswählen</h2><button class="rem-icon-close" data-reminder-overlay-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="sammlung-editor-icons rem-icon-grid">${availableCategoryIcons.map((icon) => `<button type="button" data-rem-icon="${icon.id}" class="${current === icon.id ? 'aktiv' : ''}" aria-label="${escapeHtml(icon.title)}">${icon.svg}</button>`).join('')}</div>
    <form class="sammlung-emoji-eigen rem-eigenes-emoji" data-rem-emoji-form>
      <label for="rem-eigenes-emoji"><span>Eigenes Emoji</span>
        <input id="rem-eigenes-emoji" inputmode="text" maxlength="12" placeholder="z. B. 🍳" value="${current.startsWith('emoji:') ? escapeHtml(current.slice(6)) : ''}">
      </label>
      <button class="btn btn-primary" type="submit">Emoji übernehmen</button>
    </form>`;
  let root;
  let close;
  if (hostBackdrop) {
    const original = hostBackdrop.querySelector(':scope > .kategorie-sheet');
    const picker = document.createElement('section');
    picker.className = 'kategorie-sheet sammlung-editor rem-icon-picker-sheet';
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-modal', 'true');
    picker.innerHTML = markup;
    original.replaceWith(picker);
    root = picker;
    close = () => picker.replaceWith(original);
    picker.querySelector('[data-reminder-overlay-close]').onclick = close;
  } else {
    const backdrop = reminderOverlay(markup);
    root = backdrop;
    close = () => backdrop.remove();
  }
  root.querySelector('.rem-icon-grid').onclick = (event) => {
    const value = event.target.closest('[data-rem-icon]')?.dataset.remIcon;
    if (!value) return;
    close();
    onSelected(value);
  };
  root.querySelector('[data-rem-emoji-form]').onsubmit = (event) => {
    event.preventDefault();
    const emoji = event.currentTarget.querySelector('input').value.trim();
    if (!emoji) return;
    close();
    onSelected(`emoji:${emoji}`);
  };
}

export async function mountReminders(container, { session, signal }) {
  const userId = session.user.id;
  // Gewählte Dex-Ordnerfarbe (wie die Kartenstreifen) für die Platzhalter-Felder der Einträge.
  container.style.setProperty('--ordner', pageLook('reminders', categoryColor('reminders'), 'wallpaper-burger').color);
  container.innerHTML = `
    <div class="wrap pad-bottom">
      <div class="${SPECIAL_DEX_CLASSES.content} ${SPECIAL_DEX_CLASSES.stack}" data-nutrition-root></div>
      <section class="${SPECIAL_DEX_CLASSES.content}" data-reminders-card>
        <div data-reminder-list class="reminder-list"><div class="daten-laden" role="status">Mahlzeiten werden geladen …</div></div>
      </section>
    </div>`;

  const list = container.querySelector('[data-reminder-list]');
  let nutritionActions = null;
  const nutritionPromise = mountNutrition(container.querySelector('[data-nutrition-root]'), { userId, signal })
    .then((actions) => { nutritionActions = actions; });

  let reminders = [];
  let completions = [];
  const rerender = () => {
    list.innerHTML = reminderGroups(reminders, completions);
    nutritionActions?.renderIntegrated?.();
    const meta = container.querySelector('[data-food-scroll-meta]');
    if (meta) meta.textContent = '5 Mahlzeiten';
  };
  const rerenderRow = (key) => {
    const row = list.querySelector(`[data-reminder-key="${key}"]`);
    if (!row) return;
    const reminder = reminders.find((r) => (r._key || r.id) === key);
    const completion = completions.find((c) => c.reminder_id === reminder?.id);
    if (!reminder) return;
    const open = row.open;
    row.outerHTML = reminderRowMarkup(reminder, completion);
    const wieder = list.querySelector(`[data-reminder-key="${key}"]`);
    if (wieder && open) wieder.open = true;
  };

  try {
    const [reminderListe, completionListe] = await Promise.all([
      ensureDefaults(userId, signal),
      loadCompletionsToday(userId, signal).catch(() => []),
    ]);
    if (signal?.aborted) return;
    reminders = reminderListe;
    completions = completionListe;
    rerender();
  } catch (error) {
    list.innerHTML = `<div class="msg err">${escapeHtml(error.message)}</div>`;
    return;
  }

  // Autosave-Registry pro Reminder-Key mit Debounce, damit Tippen im Namen
  // nicht bei jedem Tastenanschlag ein Roundtrip macht.
  const saveTimers = new Map();
  const dirtyPatches = new Map();
  signal?.addEventListener('abort', () => {
    saveTimers.forEach((timer) => clearTimeout(timer));
    saveTimers.clear();
    dirtyPatches.clear();
  }, { once: true });
  const scheduleSave = (key) => {
    if (saveTimers.has(key)) clearTimeout(saveTimers.get(key));
    saveTimers.set(key, setTimeout(() => flushSave(key), AUTOSAVE_MS));
  };
  const flushSave = async (key) => {
    saveTimers.delete(key);
    const patch = dirtyPatches.get(key);
    if (!patch) return;
    dirtyPatches.delete(key);
    const bisher = reminders.find((r) => (r._key || r.id) === key);
    if (!bisher) return;
    const zusammen = {
      ...bisher,
      ...patch,
      metadata: { ...(bisher.metadata || {}), ...(patch.metadata || {}) },
    };
    try {
      const gespeichert = await saveReminder(userId, zusammen);
      // ID kann sich aendern (neuer Eintrag), key im DOM darf aber gleich bleiben
      const index = reminders.findIndex((r) => (r._key || r.id) === key);
      if (index >= 0) reminders[index] = { ...gespeichert, _key: bisher._key };
      startReminderLoop(userId);
      return true;
    } catch (error) {
      toast('Speichern fehlgeschlagen');
      return false;
    }
  };

  const patchFromBody = (row) => {
    const body = row.querySelector('.rem-row-body');
    if (!body) return null;
    const patch = {};
    const labelInput = body.querySelector('[data-label]');
    if (labelInput) patch.label = labelInput.value.trim();
    const timeInput = body.querySelector('[data-time]');
    if (timeInput) patch.time = timeInput.value;
    const activeInput = body.querySelector('[data-active]');
    if (activeInput) patch.active = activeInput.checked;
    if (row.dataset.type === 'drink') {
      patch.metadata = {
        icon: 'water_drop',
        bis: body.querySelector('[data-end]')?.value || '21:00',
        intervall_minuten: Number(body.querySelector('[data-interval]')?.value || 120),
      };
    } else if (row.dataset.type === 'supplement') {
      const einheit = body.querySelector('[data-einheit]')?.value || '';
      patch.metadata = {
        icon: supplementIconId(einheit),
        meal_slot: row.dataset.mealSlot || 'breakfast',
        dosis: body.querySelector('[data-dosis]')?.value.trim() || '',
        einheit,
        hinweis: body.querySelector('[data-hinweis]')?.value || '',
      };
    } else {
      patch.metadata = {
        icon: body.querySelector('[data-icon-value]')?.value || reminderIconValue({ type: 'meal', metadata: {} }),
        notiz: body.querySelector('[data-meal-note]')?.value.trim() || '',
        meal_slot: row.dataset.mealSlot || mealSlotForReminder({ label: patch.label, time: patch.time, metadata: {} }),
      };
    }
    return patch;
  };

  const ensureReminderPush = async () => {
    // pushSupport() ist synchron und verbraucht die Nutzergeste nicht.
    const support = pushSupport();
    if (!support.ready) {
      toast(support.reason);
      return false;
    }
    if (Notification.permission === 'denied') {
      toast('Benachrichtigungen sind in den iPhone-Einstellungen für diese App blockiert.');
      return false;
    }
    // iOS/Safari öffnet den System-Dialog nur, wenn requestPermission SYNCHRON
    // in der Nutzergeste läuft – noch vor jedem await. Deshalb hier zuerst,
    // bevor getPushState()/der Service-Worker die transiente Aktivierung
    // verbraucht. Ohne das blieb der Switch stumm und es kam keine Abfrage.
    if (Notification.permission !== 'granted') {
      let permission;
      try { permission = await Notification.requestPermission(); }
      catch { permission = 'denied'; }
      if (permission !== 'granted') {
        toast('Benachrichtigungen wurden nicht erlaubt.');
        return false;
      }
    }
    try {
      // Legt bei erteilter Erlaubnis ein frisches Abo an bzw. repariert ein
      // fehlendes serverseitiges Abo (Selbstheilung nach Neuinstallation).
      await activatePush(userId);
      // forceRestart: sobald das Server-Abo steht, muss ein evtl. aus der App-
      // Startphase noch laufender lokaler Loop abgebaut werden – sonst feuern
      // lokaler Loop und Server-Push parallel (doppelte Benachrichtigung).
      await startReminderLoop(userId, { forceRestart: true });
      toast('Benachrichtigungen auf diesem Gerät aktiviert');
      return true;
    } catch (error) {
      toast(error.message || 'Benachrichtigungen konnten nicht aktiviert werden');
      return false;
    }
  };

  // Autosave beim Verlassen eines Feldes und beim Aendern (Toggle sofort speichern).
  list.addEventListener('change', async (event) => {
    const row = event.target.closest('[data-reminder-key]');
    if (!row) return;
    const key = row.dataset.reminderKey;
    const patch = patchFromBody(row);
    if (!patch) return;
    if (event.target.matches('[data-active]') && event.target.checked) await ensureReminderPush();
    dirtyPatches.set(key, patch);
    // Aktiv-Toggle und Selects sofort speichern; Text-Inputs sind ohnehin change=blur.
    await flushSave(key);
  });
  list.addEventListener('input', (event) => {
    if (event.target.matches('input[type="text"], input[type="time"], input:not([type]), textarea')) {
      const row = event.target.closest('[data-reminder-key]');
      if (!row) return;
      const key = row.dataset.reminderKey;
      const patch = patchFromBody(row);
      if (!patch) return;
      dirtyPatches.set(key, patch);
      scheduleSave(key);
    }
  });

  const createReminder = async (type, period = '') => {
    const times = { breakfast: '08:00', snack_morning: '10:30', lunch: '13:00', snack_afternoon: '16:30', dinner: '19:00' };
    const mealForPeriod = reminders.find((item) => item.type === 'meal' && mealSlotForReminder(item) === period);
    // Default-Namen unter den Supplements eindeutig halten, damit zwei neue
    // Supplements (auch im selben Slot) nicht am Unique-Index kollidieren –
    // umbenannt wird ohnehin direkt danach.
    let label = type === 'meal' ? 'Neue Mahlzeit' : type === 'drink' ? 'Trinken' : 'Neues Supplement';
    if (type === 'supplement') {
      const belegt = new Set(reminders.filter((r) => r.type === 'supplement' && !r.metadata?.deleted).map((r) => r.label));
      let n = 2;
      while (belegt.has(label)) label = `Neues Supplement ${n++}`;
    }
    const neu = {
      id: null, _key: `new:${crypto.randomUUID()}`, type,
      label,
      time: type === 'drink' ? '09:00' : (mealForPeriod?.time || times[period] || '08:00'),
      weekdays: WEEKDAYS, active: type === 'supplement',
      metadata: {
        icon: type === 'supplement' ? 'pill' : type === 'drink' ? 'water_drop' : 'fastfood',
        ...(type === 'supplement' && period ? { meal_slot: period } : {}),
      },
      route: '#reminders',
    };
    reminders.push(neu);
    try {
      const gespeichert = await saveReminder(userId, neu);
      Object.assign(neu, gespeichert);
    } catch (error) {
      reminders = reminders.filter((item) => item !== neu);
      rerender();
      toast(error.message || 'Erinnerung konnte nicht angelegt werden');
      return;
    }
    rerender();
    const details = list.querySelector(`[data-reminder-key="${neu._key}"]`);
    if (details) {
      details.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (type === 'drink') {
        details.open = true;
        const input = details.querySelector('[data-label]');
        input?.focus(); input?.select();
      } else {
        openReminderSheet(neu);
      }
    }
    toast('Erinnerung angelegt');
  };

  list.addEventListener('click', async (event) => {
    const iconButton = event.target.closest('[data-reminder-icon-open]');
    if (iconButton) {
      const row = iconButton.closest('[data-reminder-key]');
      const valueInput = row?.querySelector('[data-icon-value]');
      if (!row || !valueInput) return;
      chooseReminderIcon(valueInput.value, (value) => {
        valueInput.value = value;
        iconButton.innerHTML = reminderIconMarkup(value);
        const key = row.dataset.reminderKey;
        dirtyPatches.set(key, patchFromBody(row));
      });
      return;
    }

    const saveButton = event.target.closest('[data-save-reminder]');
    if (saveButton) {
      const row = saveButton.closest('[data-reminder-key]');
      const key = row?.dataset.reminderKey;
      if (!row || !key) return;
      const patch = patchFromBody(row);
      if (patch.active) await ensureReminderPush();
      dirtyPatches.set(key, patch);
      saveButton.disabled = true;
      const saved = await flushSave(key);
      if (saved) {
        rerender();
        toast('Erinnerung gespeichert');
      } else if (saveButton.isConnected) saveButton.disabled = false;
      return;
    }

    // Neue Zeile anlegen
    const addButton = event.target.closest('[data-add-reminder]');
    if (addButton) {
      const type = addButton.dataset.addReminder;
      if (type === 'meal' || type === 'supplement') choosePeriod(type, (period) => createReminder(type, period));
      else await createReminder(type);
      return;
    }

    // Loeschen
    const remove = event.target.closest('[data-remove-reminder]');
    if (remove) {
      const row = remove.closest('[data-reminder-key]');
      const key = row.dataset.reminderKey;
      const reminder = reminders.find((r) => (r._key || r.id) === key);
      if (!reminder) return;
      if (!confirm(`„${reminder.label}“ wirklich löschen?`)) return;
      if (reminder.id) {
        if (saveTimers.has(key)) clearTimeout(saveTimers.get(key));
        saveTimers.delete(key);
        dirtyPatches.delete(key);
        try { await deleteReminder(userId, reminder.id); }
        catch { toast('Löschen fehlgeschlagen'); return; }
      }
      reminders = reminders.filter((r) => (r._key || r.id) !== key);
      completions = completions.filter((c) => c.reminder_id !== reminder.id);
      rerender();
      toast('Erinnerung gelöscht');
      return;
    }

    // Erledigt-Toggle (nur wenn Reminder schon eine ID hat)
    const done = event.target.closest('[data-done]');
    if (done) {
      event.preventDefault();
      const row = done.closest('[data-reminder-key]');
      const key = row.dataset.reminderKey;
      const reminder = reminders.find((r) => (r._key || r.id) === key);
      if (!reminder?.id) return;
      const bereits = completions.find((c) => c.reminder_id === reminder.id);
      try {
        const neu = await upsertCompletion(userId, reminder.id, {
          completed_at: bereits?.completed_at ? null : new Date().toISOString(),
          snoozed_until: null,
        });
        completions = completions.filter((c) => c.reminder_id !== reminder.id).concat(neu);
        rerenderRow(key);
        toast(bereits?.completed_at ? 'Erledigt-Markierung entfernt' : 'Für heute erledigt');
      } catch (error) {
        toast('Konnte Status nicht speichern');
      }
    }
  });

  // Mahlzeit und Supplement bekommen bei Long-Press ein Overlay-Sheet zum
  // Bearbeiten und Löschen — kein inline-Aufklappen mehr.
  const openReminderSheet = (reminder) => {
    const key = reminder._key || reminder.id;
    const title = reminder.type === 'supplement' ? 'Supplement' : 'Mahlzeit';
    const markup = `
      <header><h2>${title}</h2><button type="button" data-reminder-overlay-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
      <div class="rem-row rem-row-sheet" data-reminder-key="${key}" data-type="${reminder.type}"${['meal', 'supplement'].includes(reminder.type) ? ` data-meal-slot="${reminder.type === 'supplement' ? supplementSlotForReminder(reminder) : mealSlotForReminder(reminder)}"` : ''}>
        ${reminderBodyMarkup(reminder, completions.find((c) => c.reminder_id === reminder.id))}
      </div>`;
    const backdrop = reminderOverlay(markup);
    const sheet = backdrop.querySelector('.kategorie-sheet');
    const row = sheet.querySelector('[data-reminder-key]');

    sheet.addEventListener('click', async (event) => {
      const iconButton = event.target.closest('[data-reminder-icon-open]');
      if (iconButton) {
        const valueInput = row.querySelector('[data-icon-value]');
        if (!valueInput) return;
        chooseReminderIcon(valueInput.value, (value) => {
          valueInput.value = value;
          iconButton.innerHTML = reminderIconMarkup(value);
          dirtyPatches.set(key, patchFromBody(row));
        }, { hostBackdrop: backdrop });
        return;
      }
      const saveButton = event.target.closest('[data-save-reminder]');
      if (saveButton) {
        const patch = patchFromBody(row);
        if (patch?.active) await ensureReminderPush();
        dirtyPatches.set(key, patch);
        saveButton.disabled = true;
        const saved = await flushSave(key);
        if (saved) {
          rerender();
          toast('Erinnerung gespeichert');
          backdrop.remove();
        } else if (saveButton.isConnected) saveButton.disabled = false;
        return;
      }
      const remove = event.target.closest('[data-remove-reminder]');
      if (remove) {
        const aktuell = reminders.find((r) => (r._key || r.id) === key);
        if (!aktuell) return;
        if (!confirm(`„${aktuell.label}“ wirklich löschen?`)) return;
        if (aktuell.id) {
          if (saveTimers.has(key)) clearTimeout(saveTimers.get(key));
          saveTimers.delete(key);
          dirtyPatches.delete(key);
          try { await deleteReminder(userId, aktuell.id); }
          catch { toast('Löschen fehlgeschlagen'); return; }
        }
        reminders = reminders.filter((r) => (r._key || r.id) !== key);
        completions = completions.filter((c) => c.reminder_id !== aktuell.id);
        rerender();
        toast('Erinnerung gelöscht');
        backdrop.remove();
      }
    });

    sheet.addEventListener('change', async (event) => {
      const patch = patchFromBody(row);
      if (!patch) return;
      if (event.target.matches('[data-active]') && event.target.checked) await ensureReminderPush();
      dirtyPatches.set(key, patch);
      await flushSave(key);
    });
    sheet.addEventListener('input', (event) => {
      if (event.target.matches('input[type="text"], input[type="time"], input:not([type]), textarea')) {
        const patch = patchFromBody(row);
        if (!patch) return;
        dirtyPatches.set(key, patch);
        scheduleSave(key);
      }
    });

    requestAnimationFrame(() => {
      row.querySelector('[data-label]')?.focus({ preventScroll: true });
    });
  };

  const openSlotInfo = (reminder) => {
    const title = reminder.label || 'Mahlzeit';
    const notiz = reminder.metadata?.notiz || '';
    const backdrop = reminderOverlay(`
      <header><h2>Info · ${escapeHtml(title)}</h2><button type="button" data-reminder-overlay-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
      <form data-slot-info-form class="rem-row-body">
        <label class="rem-field"><span>Wichtig für ${escapeHtml(title)}</span>
          <textarea class="input rem-mahlzeit-notiz" data-slot-info-note maxlength="500" rows="6" placeholder="z. B. 40 g Haferflocken, Banane, Whey">${escapeHtml(notiz)}</textarea>
        </label>
        <button type="submit" class="btn btn-primary rem-speichern">Speichern</button>
      </form>`);
    backdrop.classList.add('slot-info-overlay');
    const form = backdrop.querySelector('[data-slot-info-form]');
    const textarea = form.querySelector('[data-slot-info-note]');
    requestAnimationFrame(() => textarea.focus({ preventScroll: true }));
    form.onsubmit = async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      const aktuell = reminders.find((r) => (r._key || r.id) === (reminder._key || reminder.id));
      if (!aktuell) { backdrop.remove(); return; }
      aktuell.metadata = { ...(aktuell.metadata || {}), notiz: textarea.value.trim() };
      try {
        const saved = await saveReminder(userId, aktuell);
        Object.assign(aktuell, saved);
        rerender();
        toast('Info gespeichert');
        backdrop.remove();
      } catch {
        toast('Speichern fehlgeschlagen');
        button.disabled = false;
      }
    };
  };

  list.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-slot-info-edit]');
    if (editButton) {
      event.preventDefault();
      const reminder = reminders.find((r) => (r._key || r.id) === editButton.dataset.slotKey);
      if (reminder) openSlotInfo(reminder);
      return;
    }
  });

  bindLongPress(list, '.rem-row:not([data-type="drink"])', (row) => {
    const key = row.dataset.reminderKey;
    const reminder = reminders.find((r) => (r._key || r.id) === key);
    return reminder ? () => openReminderSheet(reminder) : null;
  }, { signal });

  list.addEventListener('change', async (event) => {
    const slotSwitch = event.target.closest('[data-slot-active]');
    if (!slotSwitch) return;
    const key = slotSwitch.dataset.slotKey;
    const reminder = reminders.find((r) => (r._key || r.id) === key);
    if (!reminder) return;
    const willBeActive = slotSwitch.checked;
    slotSwitch.disabled = true;
    try {
      if (willBeActive) await ensureReminderPush();
      reminder.active = willBeActive;
      const saved = await saveReminder(userId, reminder);
      Object.assign(reminder, saved);
      startReminderLoop(userId);
      const row = list.querySelector(`[data-reminder-key="${key}"]`);
      if (row) row.classList.toggle('ist-inaktiv', !willBeActive);
      toast(willBeActive ? 'Benachrichtigung aktiviert' : 'Benachrichtigung ausgeschaltet');
    } catch {
      slotSwitch.checked = !willBeActive;
      reminder.active = !willBeActive;
      toast('Speichern fehlgeschlagen');
    } finally {
      if (slotSwitch.isConnected) slotSwitch.disabled = false;
    }
  });

  list.addEventListener('focusin', (event) => {
    const timeInput = event.target.closest('[data-slot-time]');
    if (timeInput) timeInput.dataset.initialTime = timeInput.value;
  });

  list.addEventListener('focusout', async (event) => {
    const timeInput = event.target.closest('[data-slot-time]');
    if (!timeInput) return;
    if (timeInput.dataset.initialTime === timeInput.value) return;
    const key = timeInput.dataset.slotKey;
    const reminder = reminders.find((item) => (item._key || item.id) === key);
    if (!reminder) return;
    timeInput.disabled = true;
    const wasActive = reminder.active;
    const previousTime = reminder.time;
    reminder.time = timeInput.value || reminder.time;
    const visibleTime = timeInput.closest('.mahl-slot-zeit')?.querySelector('.mahl-slot-zeit-anzeige');
    if (visibleTime) visibleTime.textContent = String(reminder.time).slice(0, 5);
    reminder.active = true;
    try {
      if (!wasActive) await ensureReminderPush();
      const saved = await saveReminder(userId, reminder);
      Object.assign(reminder, saved);
      startReminderLoop(userId);
      toast('Uhrzeit gespeichert');
    } catch {
      reminder.time = previousTime;
      timeInput.value = previousTime;
      if (visibleTime) visibleTime.textContent = String(previousTime).slice(0, 5);
      toast('Uhrzeit konnte nicht gespeichert werden');
    } finally {
      if (timeInput.isConnected) timeInput.disabled = false;
    }
  });

  await nutritionPromise;
  nutritionActions?.renderIntegrated?.();
  return {
    meta: '5 Mahlzeiten',
    openAddMenu() {
      const backdrop = createSpecialDexOverlay({
        className: 'mahl-add-backdrop offen',
        sheetClassName: 'mahl-add-sheet',
        closeSelector: '[data-close]',
        replaceSelector: '.mahl-add-backdrop',
        markup: `
        <header><h2>Eintrag hinzufügen</h2><button type="button" data-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
        ${nutritionActions?.isEnabled?.() ? `<section class="mahl-add-gruppe">
          <div class="sheet-menue mahl-add-unterpunkte">
            <button type="button" data-add-type="nutrition:scan">${materialIconMarkup('photo_camera')}<span><b>Barcode</b><small>Produkt scannen</small></span></button>
            <button type="button" data-add-type="nutrition:search">${materialIconMarkup('search')}<span><b>Suche</b><small>Lebensmittel finden</small></span></button>
            <button type="button" data-add-type="nutrition:recipe">${materialIconMarkup('menu_book')}<span><b>Rezept</b><small>Aus dem Food-Dex übernehmen</small></span></button>
            <button type="button" data-add-type="nutrition:manual">${materialIconMarkup('edit')}<span><b>Eigenes Lebensmittel</b><small>Werte selbst eintragen</small></span></button>
          </div>
        </section>` : ''}
        <h3 class="mahl-add-zwischenkopf">Planung</h3>
        <div class="sheet-menue">
          <button type="button" data-add-type="supplement">${iconMarkup('supplement')}<span>Supplement</span></button>
          <button type="button" data-add-type="drink">${iconMarkup('drink')}<span>Trinkplan</span></button>
        </div>`,
      });
      backdrop.onclick = (event) => {
        if (event.target === backdrop || event.target.closest('[data-close]')) return backdrop.remove();
        const type = event.target.closest('[data-add-type]')?.dataset.addType;
        if (!type) return;
        backdrop.remove();
        if (type.startsWith('nutrition:')) {
          nutritionActions?.openAction?.(type.split(':')[1]);
          return;
        }
        if (type === 'drink' && reminders.some((item) => item.type === 'drink')) {
          list.querySelector('[data-type="drink"] > summary')?.click();
          list.querySelector('[data-type="drink"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        list.querySelector(`[data-add-reminder="${type}"]`)?.click();
      };
      document.body.append(backdrop);
    },
  };
}
