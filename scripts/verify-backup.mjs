import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('Aufruf: npm run backup:verify -- backups/muscledex-<Zeitstempel>');
  process.exit(1);
}

const backup = resolve(source);
let checksums;
try {
  checksums = JSON.parse(await readFile(resolve(backup, 'SHA256SUMS.json'), 'utf8'));
} catch (error) {
  console.error(`Prüfsummen konnten nicht gelesen werden: ${error.message}`);
  process.exit(1);
}

const failures = [];
for (const [relativePath, expected] of Object.entries(checksums)) {
  try {
    const content = await readFile(resolve(backup, relativePath));
    const actual = createHash('sha256').update(content).digest('hex');
    if (actual !== expected) failures.push(`${relativePath}: Prüfsumme stimmt nicht`);
  } catch (error) {
    failures.push(`${relativePath}: ${error.code === 'ENOENT' ? 'Datei fehlt' : error.message}`);
  }
}

if (failures.length) {
  console.error(`Backup fehlerhaft (${failures.length} Problem${failures.length === 1 ? '' : 'e'}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Backup geprüft: ${Object.keys(checksums).length} Dateien sind unverändert.`);
