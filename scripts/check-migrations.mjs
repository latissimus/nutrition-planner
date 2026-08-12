import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = new URL('../supabase/migrations/', import.meta.url);
const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
const errors = [];
const versions = new Map();

for (const file of files) {
  const match = file.match(/^(\d{14})_[a-z0-9_]+\.sql$/);
  if (!match) {
    errors.push(`${file}: Dateiname muss mit einer 14-stelligen UTC-Version beginnen.`);
    continue;
  }
  if (versions.has(match[1])) errors.push(`${file}: Versionsnummer wird bereits von ${versions.get(match[1])} verwendet.`);
  versions.set(match[1], file);

  const sql = await readFile(join(directory.pathname, file), 'utf8');
  if (!sql.trim()) errors.push(`${file}: Migration ist leer.`);
  if (/^(?:<<<<<<<|=======|>>>>>>>)/m.test(sql)) errors.push(`${file}: enthält einen ungelösten Git-Konflikt.`);

  // SECURITY DEFINER läuft mit den Rechten des Funktionsbesitzers. Ein fest
  // gesetzter search_path verhindert, dass Angreifer gleichnamige Objekte aus
  // einem manipulierbaren Schema einschleusen.
  const functionBlocks = sql.split(/(?=create\s+or\s+replace\s+function)/gi).slice(1);
  functionBlocks.forEach((block, index) => {
    const header = block.split(/\bas\s+\$\$/i, 1)[0];
    if (/security\s+definer/i.test(header) && !/set\s+search_path\s*=/i.test(header)) {
      errors.push(`${file}: SECURITY DEFINER-Funktion ${index + 1} hat keinen festen search_path.`);
    }
  });
}

if (!files.length) errors.push('Keine Supabase-Migrationen gefunden.');

if (errors.length) {
  console.error(`Migrationsprüfung fehlgeschlagen:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`Migrationsprüfung erfolgreich: ${files.length} Dateien.`);
