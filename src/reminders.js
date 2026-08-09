import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { iconMarkup } from './icons.js';
import { availableCategoryIcons } from './categoryIcons.js';
import {
  activatePush,
  disablePush,
  getPushState,
  sendTestPush,
  syncPushSubscription,
} from './push.js';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const CHECK_INTERVAL_MS = 30000;
const AUTOSAVE_MS = 700;
let reminderTimer = null;
let reminderUserId = null;
let reminderStartPromise = null;

const DEFAULT_REMINDERS = [
  { type: 'meal', label: 'Frühstück', time: '08:00', route: '#reminders', metadata: { icon: 'fastfood' } },
  { type: 'meal', label: 'Mittagessen', time: '13:00', route: '#reminders', metadata: { icon: 'fastfood' } },
  { type: 'meal', label: 'Abendessen', time: '19:00', route: '#reminders', metadata: { icon: 'fastfood' } },
  { type: 'supplement', label: 'Supplement AM', time: '08:00', route: '#reminders', metadata: { icon: 'pill' } },
  { type: 'supplement', label: 'Supplement PM', time: '20:00', route: '#reminders', metadata: { icon: 'pill' } },
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

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function reminderIconValue(reminder) {
  if (reminder.metadata?.icon) return reminder.metadata.icon;
  if (reminder.metadata?.emoji) return `emoji:${reminder.metadata.emoji}`;
  return reminder.type === 'supplement' ? 'pill' : reminder.type === 'drink' ? 'water_drop' : 'fastfood';
}

function notificationSymbol(reminder) {
  const value = reminderIconValue(reminder);
  if (value.startsWith('emoji:')) return value.slice(6);
  return ({ fastfood: '🍔', pill: '💊', water_drop: '💧' })[value] || '◆';
}

function reminderIconMarkup(value, className = '') {
  if (String(value).startsWith('emoji:')) {
    return `<span class="reminder-emoji ${className}">${escapeHtml(String(value).slice(6))}</span>`;
  }
  const icon = availableCategoryIcons.find((item) => item.id === value);
  return icon ? `<span class="reminder-svg ${className}">${icon.svg}</span>` : '<span class="reminder-emoji">●</span>';
}

const pad = (value) => String(value).padStart(2, '0');
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const minuteKey = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const minutesFromTime = (time) => {
  const [hours, minutes] = String(time || '00:00').split(':').map((part) => Number(part));
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
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
  if (reminder.type === 'meal') return { title: `${notificationSymbol(reminder)} ${reminder.label}`, body: 'Zeit für deine geplante Mahlzeit.' };
  if (reminder.type === 'supplement') {
    const dosis = String(reminder.metadata?.dosis || '').trim();
    const einheit = String(reminder.metadata?.einheit || '').trim();
    const hinweis = String(reminder.metadata?.hinweis || '').trim();
    const parts = [dosis && einheit ? `${dosis} ${einheitLabel(einheit)}` : dosis || einheitLabel(einheit), hinweisLabel(hinweis)].filter(Boolean);
    return { title: `${notificationSymbol(reminder)} ${reminder.label}`, body: parts.join(' · ') || 'Supplement-Stack checken.' };
  }
  if (reminder.type === 'drink') return { title: `${notificationSymbol(reminder)} ${reminder.label}`, body: 'Ein Glas Wasser einplanen.' };
  return { title: reminder.label, body: 'Geplante Erinnerung.' };
}

async function loadReminders(userId, signal) {
  let query = supabase
    .from('reminders')
    .select('id, type, label, time, weekdays, active, metadata, route')
    .eq('user_id', userId)
    .order('type')
    .order('time');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
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

export async function loadReminderDashboard(userId, now = new Date()) {
  const reminders = await loadReminders(userId);
  const weekday = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const today = reminders.filter((reminder) =>
    reminder.active && (reminder.weekdays || WEEKDAYS).includes(weekday));

  const meals = today
    .filter((reminder) => reminder.type === 'meal')
    .sort((a, b) => minutesFromTime(a.time) - minutesFromTime(b.time));
  const nextMeal = meals.find((reminder) => minutesFromTime(reminder.time) >= currentMinutes);

  const supplements = today.filter((reminder) => reminder.type === 'supplement');
  const drink = today.find((reminder) => reminder.type === 'drink');
  const drinkInterval = Math.max(15, Number(drink?.metadata?.intervall_minuten || 120));

  return {
    meal: nextMeal
      ? { value: String(nextMeal.time).slice(0, 5), detail: nextMeal.label }
      : meals.length
        ? { value: 'Fertig', detail: `${meals.length} heute geplant` }
        : { value: 'Kein Plan', detail: 'Heute keine aktive Mahlzeit' },
    supplement: supplements.length
      ? { value: String(supplements.length), detail: supplements.length === 1 ? 'Einnahme geplant' : 'Einnahmen geplant' }
      : { value: 'Keine', detail: 'Heute nichts aktiv' },
    drink: drink
      ? {
          value: drinkInterval % 60 === 0 ? `${drinkInterval / 60} h` : `${drinkInterval} min`,
          detail: `von ${String(drink.time).slice(0, 5)} bis ${drink.metadata?.bis || '21:00'}`,
        }
      : { value: 'Aus', detail: 'Keine aktive Erinnerung' },
  };
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
  const request = reminder.id
    ? query.update(payload).eq('id', reminder.id).eq('user_id', userId)
    : query.upsert(payload, { onConflict: 'user_id,type,label' });
  const { data, error } = await request
    .select('id, type, label, time, weekdays, active, metadata, route')
    .single();
  if (error) throw error;
  return data;
}

async function deleteReminder(userId, reminderId) {
  const { error } = await supabase.from('reminders').delete().eq('id', reminderId).eq('user_id', userId);
  if (error) throw error;
}

async function ensureDefaults(userId, signal) {
  const current = await loadReminders(userId, signal);
  if (current.length) return current;
  const payloads = DEFAULT_REMINDERS.map((reminder) => reminderPayload(userId, {
    ...reminder, active: false, weekdays: WEEKDAYS,
  }));
  let query = supabase
    .from('reminders')
    .upsert(payloads, { onConflict: 'user_id,type,label' })
    .select('id, type, label, time, weekdays, active, metadata, route');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
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
    tag: `nutrition-${reminder.id}-${slot}`,
    data: { url: reminder.route || '#reminders' },
  });
}

async function tickReminders(userId) {
  let reminders = [];
  try { reminders = await loadReminders(userId); }
  catch (error) { return; }
  const now = new Date();
  const today = now.getDay();
  const currentMinute = minuteKey(now);
  reminders.filter((reminder) => reminder.active && (reminder.weekdays || WEEKDAYS).includes(today)).forEach((reminder) => {
    const slot = reminder.type === 'drink' ? nextDrinkSlot(reminder, now) : reminder.time?.slice(0, 5);
    if (slot === currentMinute) maybeNotify(reminder, slot, now, userId);
  });
}

export async function startReminderLoop(userId) {
  if (!userId) return;
  if (reminderUserId === userId) return reminderStartPromise;
  reminderUserId = userId;
  reminderStartPromise = (async () => {
    const serverPushActive = await syncPushSubscription(userId).catch(() => false);
    if (reminderUserId !== userId) return;
    if (reminderTimer) clearInterval(reminderTimer);
    reminderTimer = null;
    if (serverPushActive) return;
    tickReminders(userId);
    reminderTimer = setInterval(() => tickReminders(userId), CHECK_INTERVAL_MS);
  })().finally(() => {
    if (reminderUserId === userId) reminderStartPromise = null;
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
        await startReminderLoop(userId);
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
        await startReminderLoop(userId);
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
  return { time, detail: '' };
}

function statusBadge(completion) {
  if (completion?.completed_at) return '<span class="rem-row-status ist-erledigt">Heute erledigt</span>';
  return '';
}

function reminderBodyMarkup(reminder, completion) {
  const isDrink = reminder.type === 'drink';
  const isSupplement = reminder.type === 'supplement';
  const zeit = (reminder.time || '08:00').slice(0, 5);
  return `<div class="rem-row-body">
    <div class="rem-name-reihe">
      <div class="rem-field rem-icon-field"><span>Icon</span>
        <button type="button" class="rem-icon-waehler" data-reminder-icon-open aria-label="Icon auswählen">${reminderIconMarkup(reminderIconValue(reminder))}</button>
        <input type="hidden" data-icon-value value="${escapeHtml(reminderIconValue(reminder))}">
      </div>
      <label class="rem-field"><span>Name</span>
        <input class="input" data-label maxlength="120" value="${escapeHtml(reminder.label)}">
      </label>
    </div>
    <div class="rem-field-reihe">
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
    ${isSupplement ? `<div class="rem-field-reihe">
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
    </label>` : ''}
    <div class="rem-row-body-aktionen">
      <label class="rem-switch">
        <input type="checkbox" data-active${reminder.active ? ' checked' : ''}>
        <span class="rem-switch-thumb"></span>
        <span class="rem-switch-label">Aktiv</span>
      </label>
      ${reminder.id ? `<button type="button" class="rem-erledigt-btn${completion?.completed_at ? ' ist-aktiv' : ''}" data-done>
        ${completion?.completed_at ? 'Heute erledigt ✓' : 'Für heute erledigt'}
      </button>` : ''}
    </div>
    <button type="button" class="btn btn-primary rem-speichern" data-save-reminder>Änderungen speichern</button>
    ${reminder.id && (reminder.type === 'meal' || reminder.type === 'supplement') ? `
      <button type="button" class="rem-row-loeschen" data-remove-reminder>Erinnerung löschen</button>
    ` : ''}
  </div>`;
}

function reminderRowMarkup(reminder, completion) {
  const key = reminder._key || reminder.id;
  const zusammenfassung = summaryFor(reminder);
  const badge = statusBadge(completion);
  const dimmed = completion?.completed_at ? ' ist-erledigt' : '';
  const inaktiv = reminder.active ? '' : ' ist-inaktiv';
  return `<details class="rem-row${dimmed}${inaktiv}" data-reminder-key="${key}" data-type="${reminder.type}">
    <summary class="rem-row-head">
      <span class="rem-row-emoji" aria-hidden="true">${reminderIconMarkup(reminderIconValue(reminder))}</span>
      <span class="rem-row-titel">
        <b>${escapeHtml(reminder.label)}</b>
        <small class="rem-row-art">${reminder.type === 'supplement' ? 'SUPPLEMENT' : reminder.type === 'drink' ? 'TRINKEN' : 'MAHLZEIT'}</small>
        ${zusammenfassung.detail ? `<small>${escapeHtml(zusammenfassung.detail)}</small>` : ''}
        ${badge}
      </span>
      <span class="rem-row-zeit">${escapeHtml(zusammenfassung.time)}</span>
      <span class="rem-row-chevron" aria-hidden="true">⌄</span>
    </summary>
    ${reminderBodyMarkup(reminder, completion)}
  </details>`;
}

function reminderGroups(reminders, completions) {
  const completionByReminder = new Map(completions.map((c) => [c.reminder_id, c]));
  const drink = reminders.find((item) => item.type === 'drink');
  const interval = Number(drink?.metadata?.intervall_minuten || 120);
  const periods = [
    ['MORGENS', 0, 11 * 60],
    ['MITTAGS', 11 * 60, 17 * 60],
    ['ABENDS', 17 * 60, 24 * 60],
  ];
  const timed = reminders.filter((item) => item.type !== 'drink')
    .sort((a, b) => minutesFromTime(a.time) - minutesFromTime(b.time));
  const timeline = periods.map(([title, start, end]) => {
    const rows = timed.filter((item) => minutesFromTime(item.time) >= start && minutesFromTime(item.time) < end);
    return `<section class="mahl-zeitblock">
      <header><h2>${title}</h2><span>${rows.length}</span></header>
      <div class="mahl-timeline">${rows.length
        ? rows.map((reminder) => reminderRowMarkup(reminder, completionByReminder.get(reminder.id))).join('')
        : '<p class="mahl-leerzeile">Keine Erinnerungen</p>'}</div>
    </section>`;
  }).join('');
  const water = `<section class="mahl-zeitblock mahl-trinken">
    <header><h2>TRINKEN</h2><span>${drink ? '1' : '0'}</span></header>
    <div class="mahl-timeline">${drink
      ? reminderRowMarkup(drink, completionByReminder.get(drink.id))
      : '<p class="mahl-leerzeile">Noch kein Trinkintervall</p>'}</div>
  </section>`;
  return `<div class="mahl-hinzufuegen" aria-label="Erinnerung hinzufügen">
      <button type="button" data-add-reminder="meal"><b>+</b><span>Mahlzeit</span></button>
      <button type="button" data-add-reminder="supplement"><b>+</b><span>Supplement</span></button>
      ${drink ? '' : '<button class="mahl-trinken-add" type="button" data-add-reminder="drink"><b>+</b><span>Trinkintervall</span></button>'}
    </div>
    <div class="mahl-tagesplan">${timeline}${water}</div>
    <button hidden data-add-reminder="meal"></button><button hidden data-add-reminder="supplement"></button><button hidden data-add-reminder="drink"></button>`;
}

function reminderOverlay(markup) {
  document.querySelector('.reminder-overlay')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop reminder-overlay offen';
  backdrop.innerHTML = `<section class="kategorie-sheet sammlung-editor" role="dialog" aria-modal="true">${markup}</section>`;
  backdrop.onclick = (event) => {
    if (event.target === backdrop || event.target.closest('[data-reminder-overlay-close]')) backdrop.remove();
  };
  document.body.append(backdrop);
  return backdrop;
}

function choosePeriod(type, onSelected) {
  const backdrop = reminderOverlay(`
    <header><h2>${type === 'meal' ? 'Mahlzeit' : 'Supplement'} eintragen</h2><button data-reminder-overlay-close aria-label="Schließen">×</button></header>
    <p class="rem-overlay-hinweis">Wann soll die Erinnerung erscheinen?</p>
    <div class="sheet-menue rem-period-menu">
      <button type="button" data-period="morning"><span>Morgens</span></button>
      <button type="button" data-period="midday"><span>Mittags</span></button>
      <button type="button" data-period="evening"><span>Abends</span></button>
    </div>`);
  backdrop.querySelector('.rem-period-menu').onclick = (event) => {
    const period = event.target.closest('[data-period]')?.dataset.period;
    if (!period) return;
    backdrop.remove();
    onSelected(period);
  };
}

function chooseReminderIcon(current, onSelected) {
  const backdrop = reminderOverlay(`
    <header><h2>Icon auswählen</h2><button data-reminder-overlay-close aria-label="Schließen">×</button></header>
    <div class="sammlung-editor-icons rem-icon-grid">${availableCategoryIcons.map((icon) => `<button type="button" data-rem-icon="${icon.id}" class="${current === icon.id ? 'aktiv' : ''}" aria-label="${escapeHtml(icon.title)}">${icon.svg}</button>`).join('')}</div>
    <form class="sammlung-emoji-eigen rem-eigenes-emoji" data-rem-emoji-form>
      <label for="rem-eigenes-emoji"><span>Eigenes Emoji</span>
        <input id="rem-eigenes-emoji" inputmode="text" maxlength="12" placeholder="z. B. 🍳" value="${current.startsWith('emoji:') ? escapeHtml(current.slice(6)) : ''}">
      </label>
      <button class="btn btn-primary" type="submit">Emoji übernehmen</button>
    </form>`);
  backdrop.querySelector('.rem-icon-grid').onclick = (event) => {
    const value = event.target.closest('[data-rem-icon]')?.dataset.remIcon;
    if (!value) return;
    backdrop.remove();
    onSelected(value);
  };
  backdrop.querySelector('[data-rem-emoji-form]').onsubmit = (event) => {
    event.preventDefault();
    const emoji = event.currentTarget.querySelector('input').value.trim();
    if (!emoji) return;
    backdrop.remove();
    onSelected(`emoji:${emoji}`);
  };
}

export async function mountReminders(container, { session, signal }) {
  const userId = session.user.id;
  container.innerHTML = `
    <div class="wrap pad-bottom">
      <div class="seitenkopf">
        <div class="seitenkopf-text">
          <span class="seitenkopf-kicker">Erinnerungen</span>
          <h1 class="section-title">Wecker</h1>
        </div>
        <a class="zurueck" href="#home"><span class="pf">←</span> Übersicht</a>
      </div>
      <section class="mahl-intro">
        <b>ERINNERUNGEN</b>
        <span>Mahlzeiten, Supplements und Trinkintervalle einfach planen.</span>
      </section>
      <section data-reminders-card>
        <div data-reminder-list class="reminder-list"><div class="daten-laden" role="status">Mahlzeiten werden geladen …</div></div>
      </section>
    </div>`;

  const list = container.querySelector('[data-reminder-list]');

  let reminders = [];
  let completions = [];
  const rerender = () => { list.innerHTML = reminderGroups(reminders, completions); };
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
    const patch = {
      label: body.querySelector('[data-label]')?.value.trim(),
      time: body.querySelector('[data-time]')?.value,
      active: body.querySelector('[data-active]')?.checked,
    };
    if (row.dataset.type === 'drink') {
      patch.metadata = {
        icon: body.querySelector('[data-icon-value]')?.value || reminderIconValue({ type: 'drink', metadata: {} }),
        bis: body.querySelector('[data-end]')?.value || '21:00',
        intervall_minuten: Number(body.querySelector('[data-interval]')?.value || 120),
      };
    } else if (row.dataset.type === 'supplement') {
      patch.metadata = {
        icon: body.querySelector('[data-icon-value]')?.value || reminderIconValue({ type: 'supplement', metadata: {} }),
        dosis: body.querySelector('[data-dosis]')?.value.trim() || '',
        einheit: body.querySelector('[data-einheit]')?.value || '',
        hinweis: body.querySelector('[data-hinweis]')?.value || '',
      };
    } else {
      patch.metadata = { icon: body.querySelector('[data-icon-value]')?.value || reminderIconValue({ type: 'meal', metadata: {} }) };
    }
    return patch;
  };

  const ensureReminderPush = async () => {
    try {
      const state = await getPushState();
      if (state.subscribed) return true;
      if (!state.ready) {
        toast(state.reason);
        return false;
      }
      await activatePush(userId);
      await startReminderLoop(userId);
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
    if (event.target.matches('input[type="text"], input[type="time"], input:not([type])')) {
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
    const times = { morning: '08:00', midday: '13:00', evening: '19:00' };
    const neu = {
      id: null, _key: `new:${crypto.randomUUID()}`, type,
      label: type === 'meal' ? 'Neue Mahlzeit' : type === 'drink' ? 'Trinken' : 'Neues Supplement',
      time: type === 'drink' ? '09:00' : (times[period] || '08:00'),
      weekdays: WEEKDAYS, active: false,
      metadata: { icon: type === 'supplement' ? 'pill' : type === 'drink' ? 'water_drop' : 'fastfood' }, route: '#reminders',
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
      details.open = true;
      details.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = details.querySelector('[data-label]');
      input?.focus(); input?.select();
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

  return {
    openAddMenu() {
      document.querySelector('.mahl-add-backdrop')?.remove();
      const backdrop = document.createElement('div');
      backdrop.className = 'kategorie-sheet-backdrop mahl-add-backdrop offen';
      backdrop.innerHTML = `<section class="kategorie-sheet mahl-add-sheet" role="dialog" aria-modal="true">
        <header><h2>Zum Tagesplan</h2><button type="button" data-close aria-label="Schließen">×</button></header>
        <div class="sheet-menue">
          <button type="button" data-add-type="meal">${iconMarkup('meal')}<span>Mahlzeit</span></button>
          <button type="button" data-add-type="supplement">${iconMarkup('supplement')}<span>Supplement</span></button>
          <button type="button" data-add-type="drink">${iconMarkup('drink')}<span>Trinkplan</span></button>
        </div>
      </section>`;
      backdrop.onclick = (event) => {
        if (event.target === backdrop || event.target.closest('[data-close]')) return backdrop.remove();
        const type = event.target.closest('[data-add-type]')?.dataset.addType;
        if (!type) return;
        backdrop.remove();
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
