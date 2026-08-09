import { supabase } from './supabase.js';

let activeUserId = '';
let values = new Map();

const cacheKey = (userId) => `muscledex:user-preferences:${userId}`;
const dirtyKey = (userId) => `muscledex:user-preferences-dirty:${userId}`;

function readDirty(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(dirtyKey(userId)) || '[]')); }
  catch { return new Set(); }
}

function writeDirty(userId, dirty) {
  try { localStorage.setItem(dirtyKey(userId), JSON.stringify([...dirty])); }
  catch { /* Der aktuelle Arbeitsspeicher bleibt erhalten. */ }
}

function readCache(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey(userId)) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? new Map(Object.entries(parsed)) : new Map();
  } catch { return new Map(); }
}

function writeCache() {
  if (!activeUserId) return;
  try { localStorage.setItem(cacheKey(activeUserId), JSON.stringify(Object.fromEntries(values))); }
  catch { /* Die Supabase-Kopie bleibt die dauerhafte Quelle. */ }
}

function readLegacyPreferences() {
  const migrated = new Map();
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || '';
      if (!key.startsWith('muscledex:') || key.startsWith('muscledex:user-preferences:')) continue;
      const raw = localStorage.getItem(key);
      if (raw == null) continue;
      try { migrated.set(key, JSON.parse(raw)); }
      catch { migrated.set(key, raw); }
    }
  } catch { /* localStorage kann im privaten Modus gesperrt sein. */ }
  return migrated;
}

export function setPreferenceUser(userId) {
  activeUserId = userId || '';
  values = activeUserId ? readCache(activeUserId) : new Map();
}

export async function loadUserPreferences(userId) {
  setPreferenceUser(userId);
  if (!activeUserId) return;
  const cached = new Map(values);
  const { data, error } = await supabase.from('user_preferences').select('key,value').eq('user_id', activeUserId);
  if (error) {
    // Vor dem Ausrollen der Migration oder offline bleibt der getrennte
    // Geraete-Cache nutzbar; Einstellungen verschiedener Konten vermischen
    // sich trotzdem nicht mehr.
    return;
  }
  const dirty = readDirty(activeUserId);
  if (data?.length) {
    values = new Map(data.map((row) => [row.key, row.value]));
    dirty.forEach((key) => {
      if (cached.has(key)) values.set(key, cached.get(key));
    });
    if (dirty.size) {
      const pending = [...dirty].filter((key) => values.has(key))
        .map((key) => ({ user_id: activeUserId, key, value: values.get(key) }));
      const { error: syncError } = await supabase.from('user_preferences').upsert(pending, { onConflict: 'user_id,key' });
      if (!syncError) writeDirty(activeUserId, new Set());
    }
  }
  else {
    values = cached.size ? cached : readLegacyPreferences();
    if (values.size) {
      const rows = [...values].map(([key, value]) => ({ user_id: activeUserId, key, value }));
      await supabase.from('user_preferences').upsert(rows, { onConflict: 'user_id,key' });
    }
  }
  writeCache();
}

export function getPreference(key, fallback = null) {
  return values.has(key) ? values.get(key) : fallback;
}

export function setPreference(key, value) {
  if (!activeUserId) return;
  values.set(key, value);
  writeCache();
  const userId = activeUserId;
  const dirty = readDirty(userId);
  dirty.add(key);
  writeDirty(userId, dirty);
  supabase.from('user_preferences').upsert({
    user_id: userId, key, value, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,key' }).then(({ error }) => {
    if (error) console.warn('Einstellung konnte nicht synchronisiert werden:', error.message);
    else {
      const remaining = readDirty(userId);
      remaining.delete(key);
      writeDirty(userId, remaining);
    }
  });
}
