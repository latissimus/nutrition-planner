import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const TABLES = [
  'profiles', 'skinfolds', 'weights', 'reminders', 'reminder_completions',
  'routines', 'routine_completions', 'collections', 'dex_entries', 'food_logs',
  'shopping_items', 'user_preferences', 'muscle_rewards', 'muscle_coin_ledger',
  'sleep_settings', 'sleep_schedules', 'sleep_logs',
  'shared_spaces', 'push_subscriptions', 'push_deliveries',
];
const BUCKETS = ['dex-entries', 'food-log', 'link-previews'];
const PAGE_SIZE = 1000;

async function localEnvironment() {
  const result = { ...process.env };
  for (const name of ['.env.backup.local', '.env.local']) {
    try {
      const text = await readFile(resolve(name), 'utf8');
      text.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
        if (!match || result[match[1]]) return;
        result[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
      });
    } catch { /* Datei ist optional. */ }
  }
  return result;
}

const environment = await localEnvironment();
const supabaseUrl = String(environment.SUPABASE_URL || environment.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = String(environment.SUPABASE_SERVICE_ROLE_KEY || environment.SUPABASE_SECRET_KEY || '');
if (!supabaseUrl || !serviceKey) {
  console.error('SUPABASE_URL und ein Supabase-Service-/Secret-Key fehlen. Siehe .env.backup.example.');
  process.exit(1);
}

const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = resolve('backups', `muscledex-${stamp}`);
const checksums = {};
await mkdir(target, { recursive: true });

async function fetchChecked(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  return response;
}

async function save(relativePath, body) {
  const path = resolve(target, relativePath);
  if (!path.startsWith(`${target}/`)) throw new Error('Ungültiger Sicherungspfad.');
  await mkdir(dirname(path), { recursive: true });
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  await writeFile(path, buffer);
  checksums[relativePath] = createHash('sha256').update(buffer).digest('hex');
}

async function exportTable(table) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await fetchChecked(`${supabaseUrl}/rest/v1/${table}?select=*&offset=${offset}&limit=${PAGE_SIZE}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  await save(`database/${table}.json`, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`Tabelle ${table}: ${rows.length} Zeilen`);
  return rows.length;
}

async function exportAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const response = await fetchChecked(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${PAGE_SIZE}`);
    const data = await response.json();
    const current = data.users || [];
    users.push(...current);
    if (current.length < PAGE_SIZE) break;
  }
  await save('auth/users.json', `${JSON.stringify(users, null, 2)}\n`);
  console.log(`Auth: ${users.length} Nutzer`);
  return users.length;
}

async function listObjects(bucket, prefix = '') {
  const objects = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await fetchChecked(`${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefix, limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    const page = await response.json();
    for (const object of page) {
      const path = prefix ? `${prefix}/${object.name}` : object.name;
      if (object.id) objects.push(path);
      else objects.push(...await listObjects(bucket, path));
    }
    if (page.length < PAGE_SIZE) break;
  }
  return objects;
}

async function exportBucket(bucket) {
  const objects = await listObjects(bucket);
  for (const object of objects) {
    const encodedPath = object.split('/').map(encodeURIComponent).join('/');
    const response = await fetchChecked(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`);
    await save(`storage/${bucket}/${object}`, Buffer.from(await response.arrayBuffer()));
  }
  console.log(`Storage ${bucket}: ${objects.length} Dateien`);
  return objects.length;
}

const summary = { created_at: new Date().toISOString(), project_url: supabaseUrl, tables: {}, buckets: {}, auth_users: 0 };
for (const table of TABLES) summary.tables[table] = await exportTable(table);
summary.auth_users = await exportAuthUsers();
for (const bucket of BUCKETS) summary.buckets[bucket] = await exportBucket(bucket);
await save('manifest.json', `${JSON.stringify(summary, null, 2)}\n`);
await save('SHA256SUMS.json', `${JSON.stringify(checksums, null, 2)}\n`);
console.log(`\nBackup erfolgreich: ${target}`);
