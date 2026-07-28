import { supabase } from './supabase.js';
import { toast } from './toast.js';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const CHECK_INTERVAL_MS = 30000;
let reminderTimer = null;
let reminderUserId = null;

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
  if (reminder.type === 'supplement') return { title: reminder.label, body: 'Supplement-Stack checken.' };
  if (reminder.type === 'drink') return { title: reminder.label, body: 'Ein Glas Wasser einplanen.' };
  return { title: reminder.label, body: 'Geplante Erinnerung.' };
}

async function loadReminders(userId) {
  const { data, error } = await supabase
    .from('reminders')
    .select('id, type, label, time, weekdays, active, metadata, route')
    .eq('user_id', userId)
    .order('type')
    .order('time');
  if (error) throw error;
  return data ?? [];
}

async function saveReminder(userId, reminder) {
  const payload = {
    user_id: userId,
    type: reminder.type,
    label: reminder.label.trim(),
    time: reminder.time || '08:00',
    weekdays: reminder.weekdays?.length ? reminder.weekdays : WEEKDAYS,
    active: Boolean(reminder.active),
    metadata: reminder.metadata || {},
    route: reminder.route || '#reminders',
  };
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

async function ensureDefaults(userId) {
  const current = await loadReminders(userId);
  if (current.length) return current;
  const saved = [];
  for (const reminder of DEFAULT_REMINDERS) {
    saved.push(await saveReminder(userId, { ...reminder, active: false, weekdays: WEEKDAYS }));
  }
  return saved;
}

async function maybeNotify(reminder, slot, now, userId) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const key = `nutrition-reminder:${userId}:${reminder.id}:${dateKey(now)}:${slot}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  const text = notificationText(reminder);
  const notification = new Notification(text.title, {
    body: text.body,
    tag: `nutrition-${reminder.id}-${slot}`,
    data: { url: reminder.route || '#reminders' },
  });
  notification.onclick = () => {
    window.focus();
    location.hash = (reminder.route || '#reminders').replace(/^#/, '');
    notification.close();
  };
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

export function startReminderLoop(userId) {
  if (!userId || reminderUserId === userId) return;
  if (reminderTimer) clearInterval(reminderTimer);
  reminderUserId = userId;
  tickReminders(userId);
  reminderTimer = setInterval(() => tickReminders(userId), CHECK_INTERVAL_MS);
}

function permissionMarkup() {
  if (!('Notification' in window)) {
    return '<div class="msg err">Dieser Browser unterstuetzt keine Benachrichtigungen.</div>';
  }
  if (Notification.permission === 'granted') {
    return '<div class="msg ok">Benachrichtigungen sind aktiv.</div>';
  }
  return `<div class="pushbar">
    <button class="pb-go" type="button" data-notification-permission>Benachrichtigungen aktivieren</button>
  </div>`;
}

function reminderCard(reminder) {
  const isDrink = reminder.type === 'drink';
  return `<article class="reminder-row" data-reminder-id="${reminder.id}" data-type="${reminder.type}">
    <label class="switchline">
      <input type="checkbox" data-active ${reminder.active ? 'checked' : ''}>
      <span>${TYPE_LABEL[reminder.type] || reminder.type}</span>
    </label>
    <label class="fld-l" for="rem-label-${reminder.id}">Name</label>
    <input class="input" id="rem-label-${reminder.id}" data-label value="${reminder.label}">
    <div class="reminder-grid">
      <label><span>Start</span><input class="input compact-input" data-time type="time" value="${(reminder.time || '08:00').slice(0, 5)}"></label>
      ${isDrink ? `
        <label><span>Bis</span><input class="input compact-input" data-end type="time" value="${(reminder.metadata?.bis || '21:00').slice(0, 5)}"></label>
        <label><span>Alle</span><select class="input compact-input" data-interval>
          ${[60, 90, 120, 180].map((minutes) => `<option value="${minutes}" ${Number(reminder.metadata?.intervall_minuten || 120) === minutes ? 'selected' : ''}>${minutes} min</option>`).join('')}
        </select></label>` : ''}
    </div>
  </article>`;
}

export async function mountReminders(container, { session }) {
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
        <span>Die Basis fuer planbare Tagesrhythmen.</span>
      </section>
      <section class="card" data-reminders-card>
        <div data-permission>${permissionMarkup()}</div>
        <div data-reminder-list class="reminder-list"></div>
        <button class="btn btn-primary btn-block" type="button" data-save-reminders>Erinnerungen speichern</button>
      </section>
    </div>`;

  const list = container.querySelector('[data-reminder-list]');
  const card = container.querySelector('[data-reminders-card]');
  const permissionButton = container.querySelector('[data-notification-permission]');
  if (permissionButton) {
    permissionButton.onclick = async () => {
      const permission = await Notification.requestPermission();
      container.querySelector('[data-permission]').innerHTML = permissionMarkup();
      toast(permission === 'granted' ? 'Benachrichtigungen aktiv' : 'Benachrichtigungen nicht aktiv');
    };
  }

  let reminders = [];
  try {
    reminders = await ensureDefaults(userId);
    list.innerHTML = reminders.map(reminderCard).join('');
  } catch (error) {
    list.innerHTML = `<div class="msg err">${error.message}</div>`;
    return;
  }

  card.querySelector('[data-save-reminders]').onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const rows = [...list.querySelectorAll('[data-reminder-id]')].map((row) => {
      const reminder = reminders.find((item) => item.id === row.dataset.reminderId);
      return {
        ...reminder,
        active: row.querySelector('[data-active]').checked,
        label: row.querySelector('[data-label]').value || reminder.label,
        time: row.querySelector('[data-time]').value || reminder.time,
        metadata: row.dataset.type === 'drink'
          ? {
              bis: row.querySelector('[data-end]').value || '21:00',
              intervall_minuten: Number(row.querySelector('[data-interval]').value || 120),
            }
          : reminder.metadata || {},
      };
    });
    try {
      reminders = [];
      for (const reminder of rows) reminders.push(await saveReminder(userId, reminder));
      list.innerHTML = reminders.map(reminderCard).join('');
      startReminderLoop(userId);
      toast('Erinnerungen gespeichert');
    } catch (error) {
      toast('Speichern fehlgeschlagen');
    }
    if (button.isConnected) button.disabled = false;
  };
}
