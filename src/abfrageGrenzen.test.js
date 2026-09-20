import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* Ein Fehler, der sich still auszahlt: `.order('datum').limit(n)` sortiert
   aufsteigend und schneidet deshalb die NEUESTEN Datensätze ab, nicht die
   ältesten. Solange man unter n Einträgen bleibt, fällt nichts auf – danach
   friert die Reihe auf ihren Anfang ein. Gefunden in neun Abfragen; zwei
   davon waren früher schon einmal von Hand korrigiert worden, die anderen
   sieben nicht.
   Wer eine begrenzte Reihe braucht, holt sie absteigend und dreht sie danach. */
const quellen = readdirSync('src')
  .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))
  .map((name) => [name, readFileSync(`src/${name}`, 'utf8')]);

// .order('spalte')  ohne  { ascending: ... }  gefolgt von .limit(
const aufsteigendBegrenzt = /\.order\(\s*'[^']+'\s*\)\s*\.limit\(/g;

describe('Begrenzte Abfragen behalten die neuesten Datensätze', () => {
  it('findet keine aufsteigend sortierte Abfrage mit Limit', () => {
    const treffer = [];
    quellen.forEach(([name, inhalt]) => {
      inhalt.split('\n').forEach((zeile, index) => {
        aufsteigendBegrenzt.lastIndex = 0;
        if (aufsteigendBegrenzt.test(zeile)) treffer.push(`${name}:${index + 1}`);
      });
    });
    expect(treffer).toEqual([]);
  });

  it('prüft wirklich etwas – das Muster wird erkannt', () => {
    // Gegenprobe, damit die Regel nicht stillschweigend ins Leere läuft.
    const beispiel = "supabase.from('sleep_logs').select('*').order('sleep_date').limit(42)";
    aufsteigendBegrenzt.lastIndex = 0;
    expect(aufsteigendBegrenzt.test(beispiel)).toBe(true);
    const richtig = "supabase.from('sleep_logs').select('*').order('sleep_date', { ascending: false }).limit(42)";
    aufsteigendBegrenzt.lastIndex = 0;
    expect(aufsteigendBegrenzt.test(richtig)).toBe(false);
  });

  it('hat überhaupt Quelldateien gelesen', () => {
    expect(quellen.length).toBeGreaterThan(20);
  });
});
