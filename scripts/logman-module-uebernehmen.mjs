// Übernimmt LOGMANs reine Rechenmodule unverändert nach
// supabase/functions/capboy-coach/logman/. LOGMAN (Projekt blast-trainer)
// bleibt die einzige Quelle: Vorlage, Übungskatalog, Prioritäten, Set-O-Meter,
// Fortschritt und Sprungwarnung rechnen in CAPBOY damit exakt wie in LOGMAN.
// Nach jeder Änderung an diesen Dateien in LOGMAN erneut ausführen:
//   node scripts/logman-module-uebernehmen.mjs
// Der Test src/logmanModule.test.js meldet lokal, wenn die Kopie veraltet ist.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOGMAN_MODULE = [
  'template.js', 'katalog.js', 'eigene-uebungen.js', 'saetze.js',
  'prioritaet.js', 'setometer.js', 'progression.js', 'steigerung.js',
];

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const quelle = join(wurzel, '..', 'blast-trainer', 'src');
const ziel = join(wurzel, 'supabase', 'functions', 'capboy-coach', 'logman');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(quelle)) {
    console.error(`LOGMAN nicht gefunden: ${quelle}`);
    process.exit(1);
  }
  mkdirSync(ziel, { recursive: true });
  for (const datei of LOGMAN_MODULE) copyFileSync(join(quelle, datei), join(ziel, datei));
  console.log(`${LOGMAN_MODULE.length} LOGMAN-Module nach ${ziel} übernommen.`);
}
