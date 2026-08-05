import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { iconMarkup } from './icons.js';
import {
  activatePush,
  disablePush,
  getPushState,
  sendTestPush,
  syncPushSubscription,
} from './push.js';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const CHECK_INTERVAL_MS = 30000;
let reminderTimer = null;
let reminderUserId = null;
let reminderStartPromise = null;

const DEFAULT_REMINDERS = [
  { type: 'meal', label: 'Fruehstueck', time: '08:00', route: '#reminders' },
  { type: 'meal', label: 'Mittagessen', time: '13:00', route: '#reminders' },
  { type: 'meal', label: 'Abendessen', time: '19:00', route: '#reminders' },
  { type: 'supplement', label: 'Supplement AM', time: '08:00', route: '#reminders' },
  { type: 'supplement', label: 'Supplement PM', time: '20:00', route: '#reminders' },
  {
    type: 'drink',
    label: 'Trinken',
    time: '09:00',
    route: '#reminders',
    metadata: { bis: '21:00', intervall_minuten: 120 },
  },
];

const TYPE_LABEL = {
  meal: 'Mahlzeit',
  supplement: 'Supplement',
  drink: 'Trinken',
  body: 'Körperwerte',
};

// Gemeinsam mit der Notification-Body-Formatierung in send-reminders/index.ts.
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

const pad = (value) => String(value).padStart(2, '0');
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const minuteKey = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const minutesFromTime = (time) => {
  const [hours, minutes] = String(time || '00:00').split(':').map((part) => Number(part));
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

function nextDrinkSlot(reminder, now) {
  const start = minutesFromTime(reminder.time);
  const end = minutesFromTime(reminder.metadata?.bis || '21:00');
  const interval = Math.max(15, Number(reminder.metadata?.intervall_minuten || 120));
  const current = now.getHours() * 60 + now.getMinutes();
  if (current < start || current > end) return null;
  return (current - start) % interval === 0 ? minuteKey(now) : null;
}

function notificationText(reminder) {
  if (reminder.type === 'meal') return { title: reminder.label, body: 'Zeit fuer deine geplante Mahlzeit.' };
  if (reminder.type === 'supplement') {
    const dosis = String(reminder.metadata?.dosis || '').trim();
    const einheit = String(reminder.metadata?.einheit || '').trim();
    const hinweis = String(reminder.metadata?.hinweis || '').trim();
    const parts = [dosis && einheit ? `${dosis} ${einheit}` : dosis || einheit, hinweisLabel(hinweis)].filter(Boolean);
    return { title: reminder.label, body: parts.join(' · ') || 'Supplement-Stack checken.' };
  }
  if (reminder.type === 'drink') return { title: reminder.label, body: 'Ein Glas Wasser einplanen.' };
  return { title: reminder.label, body: 'Geplante Erinnerung.' };
}

function hinweisLabel(value) {
  const paar = HINWEISE.find(([wert]) => wert === (value || ''));
  return paar && paar[0] ? paar[1] : '';
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
    label: reminder.label.trim(),
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
    return '<div class="msg">Push-Status wird geprüft …</div>';
  }
  if (!state.ready) {
    return `<div class="msg err">${state.reason}</div>`;
  }
  if (state.permission === 'denied') {
    return '<div class="msg err">Benachrichtigungen sind blockiert. Bitte in den System­einstellungen für diese App erlauben.</div>';
  }
  if (state.subscribed) {
    return `<div class="push-status">
      <div class="msg ok"><b>Push ist aktiv</b><span>Dieses Gerät empfängt Erinnerungen auch bei geschlossener App.</span></div>
      <div class="push-actions">
        <button class="btn btn-primary" type="button" data-test-push>Test senden</button>
        <button class="btn" type="button" data-disable-push>Auf diesem Gerät ausschalten</button>
      </div>
    </div>`;
  }
  return `<div class="pushbar">
    <span>Dieses Gerät ist noch nicht für Push registriert.</span>
    <button class="pb-go" type="button" data-activate-push>Benachrichtigungen aktivieren</button>
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
    slot.innerHTML = `<div class="msg err">${error.message}</div>`;
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

// Fasst den Reminder in ein paar Zeichen zusammen fuer die geschlossene Zeile.
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
    const teile = [dosis && einheit ? `${dosis} ${einheit}` : dosis || einheit, hinweis].filter(Boolean);
    return { time, detail: teile.join(' · ') };
  }
  return { time, detail: '' };
}

function statusBadge(completion, now = new Date()) {
  if (completion?.completed_at) return '<span class="rem-row-status ist-erledigt">✓ erledigt</span>';
  if (completion?.snoozed_until) {
    const bis = new Date(completion.snoozed_until);
    if (bis > now) {
      const uhr = `${pad(bis.getHours())}:${pad(bis.getMinutes())}`;
      return `<span class="rem-row-status ist-snoozed">⏱ bis ${uhr}</span>`;
    }
  }
  return '';
}

function reminderBodyMarkup(reminder) {
  const isDrink = reminder.type === 'drink';
  const isSupplement = reminder.type === 'supplement';
  const zeit = (reminder.time || '08:00').slice(0, 5);
  return `<div class="rem-row-body">
    <label class="rem-field"><span>Name</span>
      <input class="input" data-label maxlength="120" value="${escapeHtml(reminder.label)}">
    </label>
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
        <input class="input" data-dosis maxlength="30" placeholder="z. B. 5000" value="${escapeHtml(reminder.metadata?.dosis || '')}">
      </label>
      <label class="rem-field"><span>Einheit</span>
        <select class="input" data-einheit>
          ${EINHEITEN.map((einheit) => `<option value="${escapeHtml(einheit)}"${(reminder.metadata?.einheit || '') === einheit ? ' selected' : ''}>${einheit || '—'}</option>`).join('')}
        </select>
      </label>
    </div>
    <label class="rem-field"><span>Einnahmehinweis</span>
      <select class="input" data-hinweis>
        ${HINWEISE.map(([wert, name]) => `<option value="${escapeHtml(wert)}"${(reminder.metadata?.hinweis || '') === wert ? ' selected' : ''}>${name}</option>`).join('')}
      </select>
    </label>` : ''}
    <div class="rem-row-body-aktionen">
      <label class="switchline rem-row-aktivierung">
        <input type="checkbox" data-active${reminder.active ? ' checked' : ''}>
        <span>Aktiv</span>
      </label>
      ${reminder.id && (reminder.type === 'meal' || reminder.type === 'supplement') ? `
        <button type="button" class="btn btn-danger rem-row-loeschen" data-remove-reminder>Löschen</button>
      ` : ''}
    </div>
  </div>`;
}

function reminderRowMarkup(reminder, completion) {
  const key = reminder._key || reminder.id;
  const zusammenfassung = summaryFor(reminder);
  const badge = statusBadge(completion);
  const dimmed = completion?.completed_at ? ' ist-erledigt' : '';
  return `<details class="rem-row${dimmed}" data-reminder-key="${key}" data-type="${reminder.type}">
    <summary class="rem-row-head">
      <span class="rem-row-dot" data-type="${reminder.type}" aria-hidden="true"></span>
      <span class="rem-row-titel">
        <b>${escapeHtml(reminder.label)}</b>
        ${zusammenfassung.detail ? `<small>${escapeHtml(zusammenfassung.detail)}</small>` : ''}
        ${badge}
      </span>
      <span class="rem-row-zeit">${escapeHtml(zusammenfassung.time)}</span>
      ${reminder.id ? `<span class="rem-row-aktionen" data-actions>
        <button type="button" class="rem-row-icon${completion?.completed_at ? ' ist-aktiv' : ''}" data-done aria-label="Heute erledigt">✓</button>
        <button type="button" class="rem-row-icon${completion?.snoozed_until && new Date(completion.snoozed_until) > new Date() ? ' ist-aktiv' : ''}" data-snooze aria-label="Später erinnern">⏱</button>
      </span>` : ''}
      <span class="rem-row-chevron" aria-hidden="true">⌄</span>
    </summary>
    ${reminderBodyMarkup(reminder)}
  </details>`;
}

function reminderGroups(reminders, completions) {
  const completionByReminder = new Map(completions.map((c) => [c.reminder_id, c]));
  const groups = [
    ['meal', 'Mahlzeiten', 'Frühstück, Snacks und Hauptmahlzeiten'],
    ['supplement', 'Supplemente', 'Dein Stack zur richtigen Zeit'],
    ['drink', 'Trinken', 'Regelmäßig über den Tag verteilt'],
  ];
  return groups.map(([type, title, subtitle]) => {
    const rows = reminders
      .filter((reminder) => reminder.type === type)
      .sort((a, b) => minutesFromTime(a.time) - minutesFromTime(b.time));
    if (!rows.length) return '';
    const canAdd = type === 'meal' || type === 'supplement';
    return `<details class="reminder-group" data-reminder-group="${type}" open>
      <summary class="reminder-group-head">
        <span class="reminder-group-icon" aria-hidden="true">${iconMarkup(type)}</span>
        <span><b>${title}</b><small>${subtitle}</small></span>
        <em>${rows.length}</em>
        <span class="reminder-group-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="reminder-group-list rem-liste">${rows.map((reminder) => reminderRowMarkup(reminder, completionByReminder.get(reminder.id))).join('')}</div>
      ${canAdd ? `<button class="reminder-add" type="button" data-add-reminder="${type}"><span>+</span> ${type === 'meal' ? 'Mahlzeit' : 'Supplement'} hinzufügen</button>` : ''}
    </details>`;
  }).join('');
}

// Kleines Snooze-Popover, das an der Position der Snooze-Taste erscheint.
function snoozePopover(anchor, onChoose) {
  const previous = document.querySelector('.rem-snooze-menu');
  if (previous) previous.remove();
  const menu = document.createElement('div');
  menu.className = 'rem-snooze-menu';
  menu.innerHTML = `
    <button type="button" data-choice="15">+15 Min</button>
    <button type="button" data-choice="60">+1 Std</button>
    <button type="button" data-choice="tomorrow">Morgen früh</button>
    <button type="button" data-choice="clear">Snooze aufheben</button>`;
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 6}px`;
  menu.style.left = `${Math.max(8, rect.right + window.scrollX - 180)}px`;
  document.body.append(menu);
  const closeAndPick = (event) => {
    const button = event.target.closest('[data-choice]');
    if (!button) return;
    onChoose(button.dataset.choice);
    menu.remove();
    document.removeEventListener('click', clickOutside, true);
  };
  const clickOutside = (event) => {
    if (menu.contains(event.target)) return;
    menu.remove();
    document.removeEventListener('click', clickOutside, true);
  };
  menu.addEventListener('click', closeAndPick);
  setTimeout(() => document.addEventListener('click', clickOutside, true), 0);
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
      <section class="seiten-einstieg">
        <b>Mahlzeiten, Supplements, Wasser</b>
        <span>Tippen für Details, Häkchen für erledigt, Uhr für später.</span>
      </section>
      <section class="card" data-reminders-card>
        <div data-permission>${permissionMarkup()}</div>
        <div data-reminder-list class="reminder-list"><div class="daten-laden" role="status">Mahlzeiten werden geladen …</div></div>
        <button class="btn btn-primary btn-block" type="button" data-save-reminders>Änderungen speichern</button>
      </section>
    </div>`;

  const list = container.querySelector('[data-reminder-list]');
  const card = container.querySelector('[data-reminders-card]');
  renderPushControls(container, userId);

  let reminders = [];
  let completions = [];
  const relist = () => {
    list.innerHTML = reminderGroups(reminders, completions);
  };
  try {
    const [reminderListe, completionListe] = await Promise.all([
      ensureDefaults(userId, signal),
      loadCompletionsToday(userId, signal).catch(() => []),
    ]);
    if (signal?.aborted) return;
    reminders = reminderListe;
    completions = completionListe;
    relist();
  } catch (error) {
    list.innerHTML = `<div class="msg err">${error.message}</div>`;
    return;
  }

  // Werte aus dem DOM in die Reminder-Objekte spiegeln (nur die ausgeklappten
  // Zeilen ueberschreiben; geschlossene Zeilen behalten ihre Werte).
  const readFromDom = () => [...list.querySelectorAll('[data-reminder-key]')].map((row) => {
    const reminder = reminders.find((item) => (item._key || item.id) === row.dataset.reminderKey);
    if (!reminder) return null;
    const body = row.querySelector('.rem-row-body');
    if (!body) return reminder;
    const active = body.querySelector('[data-active]')?.checked;
    const label = body.querySelector('[data-label]')?.value || reminder.label;
    const time = body.querySelector('[data-time]')?.value || reminder.time;
    let metadata = reminder.metadata || {};
    if (row.dataset.type === 'drink') {
      metadata = {
        bis: body.querySelector('[data-end]')?.value || '21:00',
        intervall_minuten: Number(body.querySelector('[data-interval]')?.value || 120),
      };
    } else if (row.dataset.type === 'supplement') {
      metadata = {
        ...(metadata || {}),
        dosis: body.querySelector('[data-dosis]')?.value.trim() || '',
        einheit: body.querySelector('[data-einheit]')?.value || '',
        hinweis: body.querySelector('[data-hinweis]')?.value || '',
      };
    }
    return { ...reminder, active: Boolean(active), label, time, metadata };
  }).filter(Boolean);

  // Ein einziger Klick-Handler auf der Liste bedient alle Zeilen-Interaktionen.
  list.addEventListener('click', async (event) => {
    // Neue Zeile anlegen
    const addButton = event.target.closest('[data-add-reminder]');
    if (addButton) {
      const type = addButton.dataset.addReminder;
      reminders = readFromDom();
      reminders.push({
        id: null, _key: `new:${crypto.randomUUID()}`, type,
        label: type === 'meal' ? 'Neue Mahlzeit' : 'Neues Supplement',
        time: type === 'meal' ? '12:00' : '08:00',
        weekdays: WEEKDAYS, active: false, metadata: {}, route: '#reminders',
      });
      relist();
      const details = list.querySelector(`[data-reminder-key="${reminders.at(-1)._key}"]`);
      if (details) {
        details.open = true;
        const input = details.querySelector('[data-label]');
        input?.focus(); input?.select();
      }
      return;
    }

    // Zeile aus dem Server loeschen
    const remove = event.target.closest('[data-remove-reminder]');
    if (remove) {
      const row = remove.closest('[data-reminder-key]');
      const key = row.dataset.reminderKey;
      const reminder = reminders.find((r) => (r._key || r.id) === key);
      if (!reminder) return;
      if (!confirm(`„${reminder.label}“ wirklich löschen?`)) return;
      if (reminder.id) {
        const { error } = await supabase.from('reminders').delete().eq('id', reminder.id).eq('user_id', userId);
        if (error) { toast('Löschen fehlgeschlagen'); return; }
      }
      reminders = reminders.filter((r) => (r._key || r.id) !== key);
      completions = completions.filter((c) => c.reminder_id !== reminder.id);
      relist();
      toast('Erinnerung gelöscht');
      return;
    }

    // Erledigt-Toggle (nur wenn Reminder schon persistiert ist)
    const done = event.target.closest('[data-done]');
    if (done) {
      event.preventDefault(); event.stopPropagation();
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
        relist();
        toast(bereits?.completed_at ? 'Erledigt-Markierung entfernt' : 'Für heute erledigt');
      } catch (error) {
        toast('Konnte Status nicht speichern');
      }
      return;
    }

    // Snooze
    const snooze = event.target.closest('[data-snooze]');
    if (snooze) {
      event.preventDefault(); event.stopPropagation();
      const row = snooze.closest('[data-reminder-key]');
      const key = row.dataset.reminderKey;
      const reminder = reminders.find((r) => (r._key || r.id) === key);
      if (!reminder?.id) return;
      snoozePopover(snooze, async (choice) => {
        try {
          let snoozedUntil = null;
          if (choice === '15' || choice === '60') {
            const delta = Number(choice) * 60 * 1000;
            snoozedUntil = new Date(Date.now() + delta).toISOString();
          } else if (choice === 'tomorrow') {
            const morgen = new Date();
            morgen.setDate(morgen.getDate() + 1);
            morgen.setHours(8, 0, 0, 0);
            snoozedUntil = morgen.toISOString();
          }
          const neu = await upsertCompletion(userId, reminder.id, {
            snoozed_until: snoozedUntil,
            completed_at: null,
          });
          completions = completions.filter((c) => c.reminder_id !== reminder.id).concat(neu);
          relist();
          toast(snoozedUntil ? 'Später erinnern gesetzt' : 'Snooze aufgehoben');
        } catch (error) {
          toast('Konnte Snooze nicht speichern');
        }
      });
    }
  });

  card.querySelector('[data-save-reminders]').onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const rows = readFromDom();
    try {
      reminders = [];
      for (const reminder of rows) reminders.push(await saveReminder(userId, reminder));
      relist();
      startReminderLoop(userId);
      toast('Erinnerungen gespeichert');
    } catch (error) {
      toast('Speichern fehlgeschlagen');
    }
    if (button.isConnected) button.disabled = false;
  };
}
