/* Treue-Test gegen Formel.xlsx.
   Die Excel-Semantik wird hier unabhaengig vom Modul nachgebaut - direkt aus den
   im Sheet gelesenen Formeln - und gegen die Implementierung gefuzzt. Zweck ist,
   Abweichungen in den Verzweigungen zu finden, nicht die Formel zu erklaeren. */
import { describe, expect, it } from 'vitest';
import { alterAmMessdatum, faltenRang, kfaSumme, koerperfettAnteil, magermasse } from './ypsiFormel.js';
import formelDaten from './data/ypsi-formel.json';

// --- Konstanten woertlich wie im Sheet (Tracking!J7:P10) ---------------------
const J7 = 40, J8 = 11.2778452215, J9 = -0.7245728728, J10 = 0.575084;
const K9 = 7.8112059319, K10 = -0.2881566503;
const L9 = 0.3039697518, L10 = 0.3621642462;
const M10 = 0.5, O10 = 0.48261056945833591, P10 = -0.0061956362526380815;

// Spaltenreihenfolge Tracking!J12:V12 bzw. Grafik!D43:P43
const SPALTEN = ['kinn', 'wange', 'brust', 'trizeps', 'ruecken', 'rippe', 'huefte',
  'bauch', 'knie', 'wade', 'quadrizeps', 'beinbizeps', 'bizeps'];
// Tracking!W = SUM(J:S) -> die ersten zehn Spalten
const SUMMEN_SPALTEN = SPALTEN.slice(0, 10);

/* Tracking!W14: =IF(J14="","",SUM(J14:S14)) */
const excelSumme = (f) => {
  if (f[SPALTEN[0]] === '' || f[SPALTEN[0]] == null) return '';
  return SUMMEN_SPALTEN.reduce((sum, slug) => sum + Number(f[slug] ?? 0), 0);
};

/* Tracking!H14 */
const excelKfa = (E, F, W) => {
  if (F === '' || E === '' || W === '') return '';
  return O10 * ((K9 * F ** K10) * (L9 * E ** L10)
    * Math.abs(W - ((J8 * E ** J9) * F ** J10 + J7)) ** M10) + P10;
};

/* Tracking!G14: =F14*(100%-H14/100) */
const excelMuskel = (F, H) => (F === '' || H === '' ? '' : F * (1 - H / 100));

/* Grafik!D50 und Grafik!D51 zusammen: Abweichung, LARGE-Sortierung, Rangzuweisung.
   Die Rangzuweisung prueft der Reihe nach gegen LARGE(1..13); die erste
   Uebereinstimmung gewinnt. Gleiche Scores erhalten dadurch denselben Rang. */
const excelRaenge = (f, geschlecht) => {
  const ref = formelDaten.referenzen[geschlecht];
  const scores = SPALTEN.map((slug) => {
    const wert = f[slug];
    if (wert === '' || wert == null) return '';
    return Math.abs(wert / 4 - (ref[slug].min + ref[slug].max) / 2);
  });
  const vorhanden = scores.filter((s) => s !== '');
  // LARGE($D50:$P50, k) fuer k = 1..13
  const large = [...vorhanden].sort((a, b) => b - a);
  return SPALTEN.map((slug, index) => {
    const score = scores[index];
    if (score === '') return { slug, rang: '' };
    const position = large.findIndex((wert) => wert === score);
    return { slug, rang: position === -1 ? '' : position + 1 };
  });
};

const messung = (werte) => Object.fromEntries(SPALTEN.map((slug, i) => [slug, werte[i]]));

// Deterministischer Zufall, damit Fehlschlaege reproduzierbar bleiben.
function* zufall(seed = 42) {
  let s = seed;
  while (true) { s = (s * 1103515245 + 12345) % 2147483648; yield s / 2147483648; }
}

describe('Treue gegen Formel.xlsx', () => {
  it('bildet SUM(J:S) exakt ab', () => {
    const rnd = zufall(7);
    for (let i = 0; i < 200; i += 1) {
      const werte = SPALTEN.map(() => Math.round(rnd.next().value * 400) / 10);
      const f = messung(werte);
      expect(kfaSumme(f)).toBe(excelSumme(f));
    }
  });

  it('bildet die Körperfettformel über den ganzen Wertebereich ab', () => {
    const rnd = zufall(11);
    for (let i = 0; i < 500; i += 1) {
      const E = 150 + rnd.next().value * 60;
      const F = 45 + rnd.next().value * 80;
      const W = 20 + rnd.next().value * 200;
      expect(koerperfettAnteil({ groesseCm: E, gewichtKg: F, summe: W }))
        .toBe(excelKfa(E, F, W));
    }
  });

  it('bildet die Magermasse exakt ab', () => {
    const rnd = zufall(13);
    for (let i = 0; i < 200; i += 1) {
      const F = 45 + rnd.next().value * 80;
      const H = rnd.next().value * 45;
      expect(magermasse(F, H)).toBe(excelMuskel(F, H));
    }
  });

  it('vergibt dieselben Ränge wie die LARGE-Kette – auch bei Gleichstand', () => {
    const rnd = zufall(17);
    for (const geschlecht of ['mann', 'frau']) {
      const basis = geschlecht === 'frau' ? 'female' : 'male';
      for (let i = 0; i < 300; i += 1) {
        // Grobe Rasterung erzwingt regelmaessig Gleichstaende.
        const werte = SPALTEN.map(() => Math.round(rnd.next().value * 20) + 2);
        const f = messung(werte);
        const erwartet = Object.fromEntries(excelRaenge(f, geschlecht).map((r) => [r.slug, r.rang]));
        const tatsaechlich = Object.fromEntries(faltenRang(f, basis).map((r) => [r.slug, r.rang]));
        expect(tatsaechlich).toEqual(erwartet);
      }
    }
  });

  it('behandelt Quadrizeps und Beinbizeps bei gleichem Wert als Gleichstand', () => {
    // Beide teilen sich dieselbe Referenz; gleiche Messwerte ergeben denselben Score.
    const f = messung([4, 4, 6, 9, 9, 6, 8, 14, 5, 7, 12, 12, 3]);
    const raenge = faltenRang(f, 'male');
    const quad = raenge.find((r) => r.slug === 'quadrizeps');
    const ham = raenge.find((r) => r.slug === 'beinbizeps');
    expect(quad.score).toBe(ham.score);
    expect(quad.rang).toBe(ham.rang);

    const erwartet = Object.fromEntries(excelRaenge(f, 'mann').map((r) => [r.slug, r.rang]));
    expect(quad.rang).toBe(erwartet.quadrizeps);
    expect(ham.rang).toBe(erwartet.beinbizeps);
  });

  it('gibt bei leeren Eingaben nichts aus, wie die IF-Wächter der Vorlage', () => {
    expect(koerperfettAnteil({ groesseCm: '', gewichtKg: 85, summe: 98 })).toBeNull();
    expect(koerperfettAnteil({ groesseCm: 180, gewichtKg: '', summe: 98 })).toBeNull();
    expect(kfaSumme({ kinn: '' })).toBeNull();
  });

  it('behandelt leere Summenzellen nach vorhandenem Kinn wie Excel-SUM als null', () => {
    expect(kfaSumme({ kinn: 4, wange: 3 })).toBe(7);
  });

  it('berechnet das Alter in vollen Jahren zum Messdatum', () => {
    expect(alterAmMessdatum('1990-09-15', '2026-09-14')).toBe(35);
    expect(alterAmMessdatum('1990-09-14', '2026-09-14')).toBe(36);
    expect(alterAmMessdatum('', '2026-09-14')).toBeNull();
  });
});
