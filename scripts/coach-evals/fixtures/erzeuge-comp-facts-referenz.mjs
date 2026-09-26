// Erzeugt die Referenz für buildCompFacts aus der BISHERIGEN Snapshot-Berechnung.
//
//   node scripts/coach-evals/fixtures/erzeuge-comp-facts-referenz.mjs [commit]
//
// Holt buildSnapshot() samt Hilfsfunktionen und knowledge.ts aus dem Commit
// vor dem Umbau (Vorgabe 3d89c44, letzte Änderung der alten index.ts), lässt
// sie gegen eine nachgebaute Datenbank mit den festen Rohdaten aus
// kontext-tabellen.json laufen - Zeit eingefroren, Zeitzone UTC - und
// schreibt das Ergebnis nach comp-facts-referenz.json. Der Trockenlauf
// vergleicht buildCompFacts() aus context.ts mit dieser Datei.
//
// Die Referenz entsteht also nicht aus dem neuen Code, sondern aus dem alten.
// Nur so beweist der Vergleich, dass der Umbau nichts verändert hat.

import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const commit = process.argv[2] || '3d89c44';
const hier = new URL('.', import.meta.url).pathname;
const alt = (pfad) => execSync(`git show ${commit}:${pfad}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const index = alt('supabase/functions/capboy-coach/index.ts');
const ausschnitt = (von, bis) => {
  const start = index.indexOf(von);
  const ende = index.indexOf(bis, start);
  if (start < 0 || ende < 0) throw new Error(`Abschnitt "${von}" nicht gefunden – passt der Commit?`);
  return index.slice(start, ende);
};
const helfer = ausschnitt('const number = ', 'const sleep = ');
const berechnung = ausschnitt('function durationMinutes(', 'const compResultSchema');
if (!berechnung.includes('async function buildSnapshot(userId: string)')) throw new Error('buildSnapshot fehlt im Commit');

const ordner = mkdtempSync(join(tmpdir(), 'comp-facts-referenz-'));
try {
  writeFileSync(join(ordner, 'knowledge.ts'), alt('supabase/functions/capboy-coach/knowledge.ts'));
  writeFileSync(join(ordner, 'lauf.ts'), `
import { readFileSync } from 'node:fs';
import { YPSI_FORMULA } from './knowledge.ts';
type Row = Record<string, any>;
const fixture = JSON.parse(readFileSync(${JSON.stringify(join(hier, 'kontext-tabellen.json'))}, 'utf8'));

// Eingefrorene Zeit: new Date() und Date.now() liefern den Zeitpunkt der Fixture.
const FEST = Date.parse(fixture.jetzt);
const Echt = Date;
class FesteZeit extends Echt {
  constructor(...args: any[]) { if (args.length) super(...(args as [any])); else super(FEST); }
  static now() { return FEST; }
}
(globalThis as any).Date = FesteZeit;

// Nachgebaute Datenbank: eq (außer user_id und key), gte, order, limit, maybeSingle.
function abfrage(tabelle: string) {
  const filter: ((zeile: Row) => boolean)[] = [];
  const sortierung: [string, boolean][] = [];
  let grenze: number | null = null;
  const api: any = {
    select: () => api,
    eq: (spalte: string, wert: unknown) => { if (spalte !== 'user_id' && spalte !== 'key') filter.push((zeile) => zeile[spalte] === wert); return api; },
    gte: (spalte: string, wert: string) => { filter.push((zeile) => String(zeile[spalte]) >= wert); return api; },
    order: (spalte: string, optionen: Row = {}) => { sortierung.push([spalte, optionen.ascending !== false]); return api; },
    limit: (anzahl: number) => { grenze = anzahl; return api; },
    maybeSingle: () => Promise.resolve({ data: tabelle === 'nutrition_settings' ? fixture.nutrition_settings : fixture.user_preferences, error: null }),
    then: (fertig: any) => {
      let zeilen = (fixture[tabelle] as Row[]).filter((zeile) => filter.every((passt) => passt(zeile)));
      for (const [spalte, aufsteigend] of [...sortierung].reverse()) {
        zeilen = [...zeilen].sort((a, b) => (aufsteigend ? 1 : -1) * String(a[spalte]).localeCompare(String(b[spalte]), 'en', { numeric: true }));
      }
      if (grenze != null) zeilen = zeilen.slice(0, grenze);
      fertig({ data: zeilen, error: null });
    },
  };
  return api;
}
const admin = { from: abfrage };

${helfer}
${berechnung}
console.log(JSON.stringify(await buildSnapshot('fixture')));
`);
  const ausgabe = execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', join(ordner, 'lauf.ts')], {
    encoding: 'utf8', env: { ...process.env, TZ: 'UTC' }, maxBuffer: 16 * 1024 * 1024,
  });
  const referenz = {
    zweck: 'Erwartete Ausgabe von buildCompFacts für kontext-tabellen.json, erzeugt aus der bisherigen buildSnapshot()-Berechnung.',
    quelle: { commit, datei: 'supabase/functions/capboy-coach/index.ts', funktion: 'buildSnapshot' },
    erzeugtMit: 'node scripts/coach-evals/fixtures/erzeuge-comp-facts-referenz.mjs',
    snapshot: JSON.parse(ausgabe),
  };
  writeFileSync(join(hier, 'comp-facts-referenz.json'), `${JSON.stringify(referenz, null, 2)}\n`);
  console.log(`Referenz aus ${commit} geschrieben: ${join(hier, 'comp-facts-referenz.json')}`);
} finally {
  rmSync(ordner, { recursive: true, force: true });
}
