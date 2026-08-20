import { supabase } from './supabase.js';

export const EXPORT_PAGE_SIZE = 500;

// Nur nutzereigene oder fuer den Nutzer bestimmte Daten. Push-Abos enthalten
// private Schluessel und werden deshalb bewusst nicht in die Datei geschrieben.
export const EXPORT_TABLES = [
  ['hautfalten', 'skinfolds', 'user_id', ['id']],
  ['gewicht', 'weights', 'user_id', ['id']],
  ['taillenumfang', 'waist_measurements', 'user_id', ['id']],
  ['externe_kfa_messwerte', 'external_body_fat_measurements', 'user_id', ['id']],
  ['bodycomp_checkins', 'bodycomp_checkins', 'user_id', ['checkin_date']],
  ['logman_leistung', 'logman_performance', 'user_id', ['performed_on', 'id']],
  ['erinnerungen', 'reminders', 'user_id', ['id']],
  ['erinnerungsstatus', 'reminder_completions', 'user_id', ['date', 'reminder_id']],
  ['routinen', 'routines', 'user_id', ['id']],
  ['routinen_abschluesse', 'routine_completions', 'user_id', ['completed_on', 'routine_id']],
  ['dex', 'collections', 'user_id', ['id']],
  ['dex_eintraege', 'dex_entries', 'user_id', ['id']],
  ['food_log_altbestand', 'food_logs', 'user_id', ['id']],
  ['einkaufsliste', 'shopping_items', 'user_id', ['id']],
  ['einstellungen', 'user_preferences', 'user_id', ['key']],
  ['coin_belohnungen', 'muscle_rewards', 'user_id', ['id']],
  ['coin_verlauf', 'muscle_coin_ledger', 'user_id', ['id']],
  ['schlaf_einstellungen', 'sleep_settings', 'user_id', ['user_id']],
  ['schlaf_plan', 'sleep_schedules', 'user_id', ['weekday']],
  ['schlaf_protokoll', 'sleep_logs', 'user_id', ['sleep_date']],
  ['ernaehrungs_einstellungen', 'nutrition_settings', 'user_id', ['user_id']],
  ['ernaehrungs_produkte', 'nutrition_products', 'user_id', ['id']],
  ['kalorien_protokoll', 'nutrition_log_entries', 'user_id', ['log_date', 'created_at']],
  ['ernaehrungs_tagesqualitaet', 'nutrition_day_status', 'user_id', ['log_date']],
];

async function loadAllRows(table, userColumn, orderColumns, userId, signal, pageSize = EXPORT_PAGE_SIZE) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select('*').eq(userColumn, userId);
    orderColumns.forEach((column) => { query = query.order(column, { ascending: true }); });
    query = query.range(from, from + pageSize - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message || 'Daten konnten nicht geladen werden.'}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function loadShares(userId, signal) {
  let query = supabase.from('shared_spaces').select('id,owner_id,partner_id,scope,created_at')
    .or(`owner_id.eq.${userId},partner_id.eq.${userId}`);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw new Error(`shared_spaces: ${error.message || 'Freigaben konnten nicht geladen werden.'}`);
  return data || [];
}

function storageReferences(daten) {
  return {
    hinweis: 'Die JSON-Datei enthält Speicherpfade und Metadaten, aber nicht die Binärdateien selbst.',
    food_log: daten.food_log_altbestand.map((row) => row.image_path).filter(Boolean),
    dex_eintraege: daten.dex_eintraege.flatMap((row) => [row.image_path, row.audio_path]).filter(Boolean),
  };
}

export function exportFileName(date = new Date()) {
  return `muscledex-export-${date.toISOString().slice(0, 10)}.json`;
}

export async function createFullDataExport({ session, profile, theme, signal, onProgress } = {}) {
  const userId = session?.user?.id;
  if (!userId) throw new Error('Du bist nicht angemeldet.');
  const daten = {};
  for (let index = 0; index < EXPORT_TABLES.length; index += 1) {
    const [key, table, userColumn, orderColumns] = EXPORT_TABLES[index];
    onProgress?.({ current: index + 1, total: EXPORT_TABLES.length + 1, key });
    daten[key] = await loadAllRows(table, userColumn, orderColumns, userId, signal);
  }
  onProgress?.({ current: EXPORT_TABLES.length + 1, total: EXPORT_TABLES.length + 1, key: 'freigaben' });
  daten.freigaben = await loadShares(userId, signal);

  return {
    format: 'MUSCLEDEX-Datenexport',
    format_version: 1,
    exportiert_am: new Date().toISOString(),
    konto: {
      id: userId,
      email: session.user.email || '',
      erstellt_am: session.user.created_at || null,
      profil: profile || null,
      lokale_darstellung: theme || null,
    },
    daten,
    medien: storageReferences(daten),
    nicht_enthalten: [
      'Passwort und Anmeldetokens',
      'Push-Abonnements und kryptografische Push-Schlüssel',
      'Binärdateien aus dem privaten Medienspeicher',
      'Daten anderer Nutzer aus lediglich geteilten Bereichen',
    ],
  };
}
