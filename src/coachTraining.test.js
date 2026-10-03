import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  einheitenAus, naechsteEinheit, rotation, saetzeJeMuskel, trainingsAuswertung, uebungsVerlauf, zielFuer,
} from '../supabase/functions/capboy-coach/training.js';
import { einheitenMitSaetzen } from '../supabase/functions/logman-abgleich/umrechnung.js';
import { LOGMAN_MODULE } from '../scripts/logman-module-uebernehmen.mjs';

// Erfundene LOGMAN-Stände. Erwartete Werte von Hand nachgerechnet:
// e1RM nach Epley = Gewicht × (1 + Wdh / 30), z. B. 80 × 8 → 101,33.
const satz = (w, r, rir = '') => ({ w: String(w), r: String(r), rir: String(rir) });
const FEST = {
  'OK-H': { chest_comp: ['LH Flachbankdrücken'] },
  'UK-H': { legs_comp: ['LH Kniebeugen'] },
};
const stand = ({ week, day, data = {}, datum = {}, ex = FEST, tier = {}, eigeneUebungen } = {}) => ({
  week, day, data, datum, ex, tier, eigeneUebungen, v: 4,
});
const bank = (...saetze) => ({ chest_comp: { sets: [saetze] } });

describe('LOGMAN-Einheiten aus dem Spiegel', () => {
  it('liest nur Einheiten mit eingetragenen Sätzen, in Rotationsreihenfolge', () => {
    const payload = stand({ data: {
      'OK-H': { 2: bank(satz(80, 9)), 1: bank(satz(80, 8)) },
      // Beim bloßen Ansehen legt LOGMAN leere Blöcke an; sie zählen nicht.
      'UK-H': { 1: { legs_comp: { sets: [[satz('', '')]] } } },
    } });
    const einheiten = einheitenAus(payload);
    expect(einheiten.map((einheit) => einheit.schluessel)).toEqual(['OK-H|1', 'OK-H|2']);
    expect(einheiten[0].uebungen[0]).toMatchObject({ name: 'LH Flachbankdrücken', satzart: 'HEAVYS', bestE1: 101.3, bereich: { von: 6, bis: 10 }, rirZiel: { von: 0, bis: 1 } });
    expect(einheitenMitSaetzen(payload)).toEqual(['OK-H|1', 'OK-H|2']);
  });

  it('nimmt das LOGMAN-Datum vor dem Tag des ersten Sehens', () => {
    const payload = stand({ data: { 'OK-H': { 1: bank(satz(80, 8)), 2: bank(satz(80, 9)) } }, datum: { 'OK-H|1': '2026-09-29' } });
    const einheiten = einheitenAus(payload, { 'OK-H|1': '2026-09-30', 'OK-H|2': '2026-10-02' });
    expect(einheiten.map(({ datum, datumQuelle }) => [datum, datumQuelle])).toEqual([['2026-09-29', 'logman'], ['2026-10-02', 'abgleich']]);
  });

  it('kennt die Rotation von LOGMAN: vier Einheiten je Cycle, danach Deload', () => {
    const liste = rotation();
    expect(liste.slice(0, 5)).toEqual([
      { cycle: 1, tag: 'OK-H' }, { cycle: 1, tag: 'UK-H' }, { cycle: 1, tag: 'OK-P' }, { cycle: 1, tag: 'UK-P' }, { cycle: 2, tag: 'OK-H' },
    ]);
    expect(liste.slice(-2)).toEqual([{ cycle: 8, tag: 'OK-D' }, { cycle: 8, tag: 'UK-D' }]);
  });
});

describe('Vergleich mit dem letzten Mal', () => {
  it('meldet eine Steigerung mit e1RM-Differenz', () => {
    const auswertung = trainingsAuswertung(stand({ data: { 'OK-H': { 1: bank(satz(80, 8), satz(80, 7)), 2: bank(satz(80, 9), satz(80, 8)) } } }));
    // 80 × 9 → 104,0; 80 × 8 → 101,3; Differenz 2,7.
    expect(auswertung.letzteEinheit.uebungen[0]).toMatchObject({ vergleich: 'gesteigert', bestE1: 104, differenzE1: 2.7, vorherCycle: 1, lastsprung: null });
  });

  it('warnt bei einem Lastsprung über 10 % und 2,5 kg wie LOGMAN', () => {
    const auswertung = trainingsAuswertung(stand({ data: { 'OK-H': { 1: bank(satz(80, 8)), 2: bank(satz(92.5, 6)) } } }));
    // +12,5 kg = 15,6 % → 16 %; empfohlen 5–10 %: 84 → 85 kg, 88 → 87,5 kg.
    expect(auswertung.letzteEinheit.uebungen[0].lastsprung).toEqual({ kg: 12.5, prozent: 16, empfohlenVon: 85, empfohlenBis: 87.5 });
  });

  it('erkennt Stillstand und wiederholten Abfall', () => {
    const gleich = uebungsVerlauf(einheitenAus(stand({ data: { 'OK-H': { 1: bank(satz(80, 8)), 2: bank(satz(80, 8)), 3: bank(satz(80, 8)) } } })));
    expect(gleich[0]).toMatchObject({ ohneFortschritt: 2, faelltWiederholt: false });
    const faellt = uebungsVerlauf(einheitenAus(stand({ data: { 'OK-H': { 1: bank(satz(80, 8)), 2: bank(satz(80, 7)), 3: bank(satz(80, 6)) } } })));
    expect(faellt[0]).toMatchObject({ ohneFortschritt: 2, faelltWiederholt: true });
    expect(faellt[0].verlauf.map((punkt) => punkt.bestE1)).toEqual([101.3, 98.7, 96]);
  });

  it('markiert Sätze, die leichter waren als das RIR-Ziel', () => {
    const auswertung = trainingsAuswertung(stand({ data: { 'OK-H': { 1: bank(satz(80, 8, 3)) } } }));
    expect(auswertung.letzteEinheit.uebungen[0]).toMatchObject({ vergleich: 'erstmals', rirUeberZiel: true });
  });
});

describe('Ziel für die nächste Einheit (doppelte Steigerung)', () => {
  const uebung = (...saetze) => einheitenAus(stand({ data: { 'OK-H': { 1: bank(...saetze) } } }))[0].uebungen[0];

  it('steigert zuerst die Wiederholungen', () => {
    expect(zielFuer(uebung(satz(80, 9), satz(80, 8)))).toMatchObject({ art: 'wiederholung_mehr', letztesMal: { w: 80, r: 9 }, vorschlag: { w: 80, r: 10 } });
  });

  it('erhöht die Last, wenn alle schweren Sätze das obere Ende erreichen', () => {
    expect(zielFuer(uebung(satz(80, 10), satz(80, 10)))).toMatchObject({ art: 'last_erhoehen', vorschlag: { w: 82.5, r: 6 } });
    // Maßgeblich sind die Sätze mit dem schwersten Gewicht.
    expect(zielFuer(uebung(satz(82.5, 10), satz(80, 8)))).toMatchObject({ art: 'last_erhoehen', vorschlag: { w: 85, r: 6 } });
  });

  it('setzt kein Ziel für PUMPS', () => {
    expect(zielFuer({ satzart: 'PUMPS', saetze: [{ w: 20, r: 15 }], bereich: { von: 15, bis: 20 } })).toBeNull();
  });
});

describe('Nächste Einheit der Rotation', () => {
  it('nimmt LOGMANs Stand, solange dort noch nichts eingetragen ist', () => {
    const payload = stand({ week: 3, day: 'OK-H', data: { 'OK-H': { 2: bank(satz(80, 9), satz(80, 8)) } } });
    const naechste = naechsteEinheit(payload, einheitenAus(payload));
    expect(naechste).toMatchObject({ cycle: 3, tag: 'OK-H', level: 'II', deload: false });
    expect(naechste.uebungen).toEqual([expect.objectContaining({ name: 'LH Flachbankdrücken', ziel: expect.objectContaining({ art: 'wiederholung_mehr', vorschlag: { w: 80, r: 10 } }) })]);
  });

  it('springt weiter, wenn die Einheit an LOGMANs Stand schon Sätze hat', () => {
    const payload = stand({ week: 1, day: 'UK-P', data: { 'UK-P': { 1: { legs_comp: { sets: [[satz(100, 12)]] } } } } });
    expect(naechsteEinheit(payload, einheitenAus(payload))).toMatchObject({ cycle: 2, tag: 'OK-H' });
  });

  it('geht nach Cycle 7 in den Deload und danach ist die Phase zu Ende', () => {
    const vorDeload = stand({ week: 7, day: 'UK-P', data: { 'UK-P': { 7: { legs_comp: { sets: [[satz(100, 12)]] } } } } });
    const deload = naechsteEinheit(vorDeload, einheitenAus(vorDeload));
    expect(deload).toMatchObject({ cycle: 8, tag: 'OK-D', deload: true });
    // Deload: halbe Standardsätze, 3–5 RIR, Übungen aus der HEAVYS-Auswahl.
    expect(deload.uebungen[0]).toEqual({ name: 'LH Flachbankdrücken', muskel: 'Brust', satzart: 'DELOAD', ziel: { art: 'deload', saetze: 1, rir: { von: 3, bis: 5 } } });
    const ende = stand({ week: 8, day: 'UK-D', data: { 'UK-D': { 8: { legs_comp: { sets: [[satz(80, 8)]] } } } } });
    expect(naechsteEinheit(ende, einheitenAus(ende))).toEqual({ phaseZuEnde: true });
  });

  it('beginnt einen leeren Stand bei Cycle 1', () => {
    expect(trainingsAuswertung({})).toMatchObject({
      stand: { cycle: 1, einheitenMitSaetzen: 0, zuletztTrainiert: null },
      letzteEinheit: null,
      naechsteEinheit: { cycle: 1, tag: 'OK-H', uebungen: [] },
      muskeln: [],
    });
  });
});

describe('Heute, Abstand und Sätze je Muskel', () => {
  it('findet die heutige Einheit und zählt die Tage seit dem letzten Training', () => {
    const payload = stand({ data: { 'OK-H': { 1: bank(satz(80, 8)) }, 'UK-H': { 1: { legs_comp: { sets: [[satz(100, 8)]] } } } } });
    const auswertung = trainingsAuswertung(payload, { gesehen: { 'OK-H|1': '2026-09-29', 'UK-H|1': '2026-10-01' }, heute: '2026-10-03' });
    expect(auswertung.heute).toEqual([]);
    expect(auswertung.stand).toMatchObject({ zuletztTrainiert: '2026-10-01', tageSeitLetzterEinheit: 2 });
    const amTag = trainingsAuswertung(payload, { gesehen: { 'UK-H|1': '2026-10-03' }, heute: '2026-10-03' });
    expect(amTag.heute.map((einheit) => einheit.tag)).toEqual(['UK-H']);
  });

  it('zählt erledigte Sätze je Muskel wie das Set-O-Meter (Nebenspieler halb)', () => {
    const payload = stand({ data: { 'OK-H': { 1: bank(satz(80, 8), satz(80, 8)) } } });
    const muskeln = saetzeJeMuskel(payload, einheitenAus(payload), 1);
    // LH Flachbankdrücken: Brust voll, Trizeps und Vordere Schulter je halb. Geplant ist Level II: 2 Sätze.
    expect(muskeln.find((zeile) => zeile.muskel === 'Brust')).toEqual({ muskel: 'Brust', geplant: 2, erledigt: 2 });
    expect(muskeln.find((zeile) => zeile.muskel === 'Trizeps')).toEqual({ muskel: 'Trizeps', geplant: 1, erledigt: 1 });
  });

  it('wertet PUMPS und Deload nicht als Progression', () => {
    const payload = stand({ data: {
      'OK-P': { 1: { chest_iso: { names: ['Kabel Fliegende'], sets: [[satz(20, 15)]] } }, 2: { chest_iso: { names: ['Kabel Fliegende'], sets: [[satz(25, 15)]] } } },
      'OK-D': { 8: bank(satz(70, 8)) },
    } });
    const auswertung = trainingsAuswertung(payload);
    const pumps = einheitenAus(payload).find((einheit) => einheit.schluessel === 'OK-P|2').uebungen[0];
    expect(pumps.satzart).toBe('PUMPS');
    expect(auswertung.letzteEinheit).toMatchObject({ tag: 'OK-D', deload: true });
    expect(auswertung.letzteEinheit.uebungen[0]).toMatchObject({ satzart: 'DELOAD', vergleich: null });
    expect(auswertung.uebungen).toEqual([]);
  });
});

describe('Kopie der LOGMAN-Module', () => {
  const quelle = join(process.cwd(), '..', 'blast-trainer', 'src');
  // Nur lokal prüfbar, wo LOGMAN daneben liegt (nicht auf GitHub).
  it.skipIf(!existsSync(quelle))('ist identisch mit LOGMAN (sonst: node scripts/logman-module-uebernehmen.mjs)', () => {
    for (const datei of LOGMAN_MODULE) {
      const kopie = readFileSync(join(process.cwd(), 'supabase', 'functions', 'capboy-coach', 'logman', datei), 'utf8');
      expect(kopie, datei).toBe(readFileSync(join(quelle, datei), 'utf8'));
    }
  });
});
