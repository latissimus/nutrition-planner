// Trainingsauswertung für das tägliche Coaching (COACHING-PLAN.md, Schritt 2).
//
// Aus dem LOGMAN-Spiegel (logman_spiegel.payload) rechnet die App, was der
// Coach braucht: Was wurde heute trainiert, im Vergleich zum letzten Mal? Was
// ist die nächste Einheit der Rotation und welches Ziel gilt je Übung? Wo steht
// die Leistung, wo fällt sie, wo gab es einen zu großen Lastsprung? Wie viele
// Sätze je Muskel sind im Cycle geplant und erledigt? Die App rechnet, die KI
// deutet: Der Coach bekommt fertige Zahlen und rechnet nichts nach.
//
// Alles Fachliche stammt aus LOGMANs eigenen Modulen in ./logman/ (unveränderte
// Kopie, scripts/logman-module-uebernehmen.mjs): Vorlage, Katalog, Set-O-Meter,
// e1RM-Vergleich und Sprungwarnung rechnen damit exakt wie in LOGMAN. Neu sind
// hier nur die Zusammenstellung und die doppelte Steigerung als Ziel für die
// nächste Einheit (Regel aus LOGMAN-Training.md, Abschnitt 6).
//
// Reines JavaScript ohne DOM und Datenbank: capboy-coach (Deno) und die Tests
// (Vitest) laden dieselbe Datei.

import { TPL, CYCLE_TAGE, DELOAD_TAGE, TIER_NAMES } from './logman/template.js';
import { bestE1, vergleichE1 } from './logman/progression.js';
import { staerksteSteigerung } from './logman/steigerung.js';
import { zaehleCycle } from './logman/setometer.js';
import { istDeload, prioBlock, tierVon } from './logman/prioritaet.js';
import { targetSets } from './logman/saetze.js';
import { KONTEN } from './logman/katalog.js';
import { katalogMitEigenen } from './logman/eigene-uebungen.js';

// LOGMAN läuft durch Cycle 1–7, Cycle 8 ist der Deload (log.js naechsteEinheit).
export const LETZTER_CYCLE = 7;
export const DELOAD_CYCLE = 8;
// Kleinster üblicher Gewichtsschritt. LOGMANs Sprungwarnung schlägt erst bei
// mehr als 2,5 kg UND mindestens 10 % an, dieser Schritt löst sie also nie aus.
export const LAST_SCHRITT_KG = 2.5;

const SATZART = { load: 'HEAVYS', middle: 'MIDDLES', pump: 'PUMPS' };
const PROGRESSION = new Set(['HEAVYS', 'MIDDLES']);

const zahl = (wert) => {
  const n = parseFloat(String(wert ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
// Wie progression.js: Gewicht (auch 0 bei Körpergewicht) und Wiederholungen > 0.
const satzGueltig = (satz) => String(satz?.w ?? '').trim() !== '' && zahl(satz?.w) != null && zahl(satz?.w) >= 0
  && zahl(satz?.r) != null && zahl(satz?.r) > 0;
const runde = (n, stellen = 1) => (n == null ? null : Math.round(n * 10 ** stellen) / 10 ** stellen);
const klein = (text) => String(text || '').trim().toLowerCase();
const bereichAus = (text) => {
  const treffer = String(text || '').match(/(\d+)\s*[–-]\s*(\d+)/);
  return treffer ? { von: Number(treffer[1]), bis: Number(treffer[2]) } : null;
};

/** Reihenfolge, in der LOGMAN die Einheiten durchläuft: OK-H → UK-H → OK-P → UK-P je Cycle, dann Deload. */
export function rotation() {
  const liste = [];
  for (let cycle = 1; cycle <= LETZTER_CYCLE; cycle += 1) CYCLE_TAGE.forEach((tag) => liste.push({ cycle, tag }));
  DELOAD_TAGE.forEach((tag) => liste.push({ cycle: DELOAD_CYCLE, tag }));
  return liste;
}

function blockDefinition(tag, blockId) {
  const vorlage = TPL[tag];
  if (!vorlage) return null;
  return vorlage.blocks.find((block) => block.id === blockId)
    || (String(blockId).startsWith('prio:') ? prioBlock(String(blockId).slice(5), tag) : null);
}

// Namen wie im Set-O-Meter: HEAVYS/MIDDLES aus der festen Auswahl der Phase
// (bei Deload aus dem HEAVYS-Tag, nameSource), PUMPS frei je Einheit.
function namenFuer(payload, tag, block, eintrag) {
  const frei = block.type !== 'load' && block.type !== 'middle';
  if (frei) return eintrag?.names || [];
  const quelle = TPL[tag]?.nameSource || tag;
  const fest = payload?.ex?.[quelle]?.[block.id] || [];
  return fest.some((name) => String(name || '').trim()) ? fest : (eintrag?.names || []);
}

/**
 * Alle Einheiten mit eingetragenen Sätzen, in Rotationsreihenfolge.
 * Datum: ein in LOGMAN eingestelltes hat Vorrang, sonst der Tag, an dem der
 * Abgleich die Einheit erstmals mit Sätzen sah (logman_spiegel.einheiten_gesehen).
 */
export function einheitenAus(payload, gesehen = {}) {
  const data = payload?.data || {};
  const datum = payload?.datum || {};
  return rotation().flatMap(({ cycle, tag }) => {
    const zelle = data[tag]?.[cycle] || data[tag]?.[String(cycle)];
    if (!zelle) return [];
    const uebungen = [];
    Object.entries(zelle).forEach(([blockId, eintrag]) => {
      const block = blockDefinition(tag, blockId);
      if (!block) return;
      const namen = namenFuer(payload, tag, block, eintrag);
      (eintrag?.sets || []).forEach((roh, xi) => {
        const name = String(namen[xi] || '').trim();
        const saetze = (roh || []).filter(satzGueltig).map((satz) => ({ w: zahl(satz.w), r: zahl(satz.r), rir: zahl(satz.rir) }));
        if (!name || !saetze.length) return;
        uebungen.push({
          blockId,
          name,
          muskel: block.mus,
          satzart: block.deload || istDeload(cycle) ? 'DELOAD' : (SATZART[block.type] || 'PUMPS'),
          bereich: bereichAus(block.reps),
          rirZiel: bereichAus(block.rir),
          saetze,
          bestE1: runde(bestE1(roh)),
          roh,
        });
      });
    });
    if (!uebungen.length) return [];
    const schluessel = `${tag}|${cycle}`;
    return [{
      schluessel,
      cycle,
      tag,
      einheit: TPL[tag]?.short || tag,
      level: TIER_NAMES[tierVon(payload, tag, cycle)],
      deload: istDeload(cycle),
      datum: datum[schluessel] || gesehen[schluessel] || null,
      datumQuelle: datum[schluessel] ? 'logman' : (gesehen[schluessel] ? 'abgleich' : null),
      uebungen,
    }];
  });
}

const uebungsSchluessel = (einheit, uebung) => `${einheit.tag}|${uebung.satzart}|${klein(uebung.name)}`;

// Das letzte Vorkommen derselben Übung in derselben Einheit (früherer Cycle).
function vorheriges(einheiten, bisIndex, schluessel) {
  for (let i = bisIndex - 1; i >= 0; i -= 1) {
    const treffer = einheiten[i].uebungen.find((uebung) => uebungsSchluessel(einheiten[i], uebung) === schluessel);
    if (treffer) return { einheit: einheiten[i], uebung: treffer };
  }
  return null;
}

const VERGLEICH_TEXT = { 1: 'gesteigert', 0: 'gleich', '-1': 'gefallen' };

/** Eine Einheit für den Coach: je Übung die Sätze, der Vergleich zum letzten Mal und ein zu großer Lastsprung. */
function einheitZusammenfassen(einheiten, index) {
  const einheit = einheiten[index];
  if (!einheit) return null;
  return {
    cycle: einheit.cycle,
    einheit: einheit.einheit,
    tag: einheit.tag,
    level: einheit.level,
    deload: einheit.deload,
    datum: einheit.datum,
    datumQuelle: einheit.datumQuelle,
    uebungen: einheit.uebungen.map((uebung) => {
      const ergebnis = {
        name: uebung.name,
        satzart: uebung.satzart,
        saetze: uebung.saetze,
        bestE1: uebung.bestE1,
        vergleich: null,
        differenzE1: null,
        lastsprung: null,
        rirUeberZiel: uebung.rirZiel ? uebung.saetze.some((satz) => satz.rir != null && satz.rir > uebung.rirZiel.bis) : false,
      };
      if (!PROGRESSION.has(uebung.satzart)) return ergebnis;
      const vorher = vorheriges(einheiten, index, uebungsSchluessel(einheit, uebung));
      if (!vorher) return { ...ergebnis, vergleich: 'erstmals' };
      const richtung = vergleichE1(vorher.uebung.roh, uebung.roh);
      const sprung = staerksteSteigerung(vorher.uebung.roh, uebung.roh);
      return {
        ...ergebnis,
        vergleich: richtung == null ? null : VERGLEICH_TEXT[richtung],
        vorherCycle: vorher.einheit.cycle,
        differenzE1: runde(uebung.bestE1 - vorher.uebung.bestE1),
        lastsprung: sprung ? { kg: runde(sprung.kg), prozent: sprung.prozent, empfohlenVon: sprung.von, empfohlenBis: sprung.bis } : null,
      };
    }),
  };
}

/**
 * Doppelte Steigerung (LOGMAN-Training.md, Abschnitt 6): Erst Wiederholungen
 * im Bereich steigern; haben alle Sätze mit dem schwersten Gewicht das obere
 * Ende erreicht, die Last erhöhen und am unteren Ende neu beginnen.
 */
export function zielFuer(uebung) {
  if (!uebung || !PROGRESSION.has(uebung.satzart) || !uebung.bereich) return null;
  const { von, bis } = uebung.bereich;
  const last = Math.max(...uebung.saetze.map((satz) => satz.w));
  const schwere = uebung.saetze.filter((satz) => satz.w === last);
  const besteWdh = Math.max(...schwere.map((satz) => satz.r));
  const zuLeicht = Boolean(uebung.rirZiel) && schwere.some((satz) => satz.rir != null && satz.rir > uebung.rirZiel.bis);
  if (schwere.every((satz) => satz.r >= bis)) {
    return {
      art: 'last_erhoehen',
      letztesMal: { w: last, r: besteWdh },
      vorschlag: { w: runde(last + LAST_SCHRITT_KG, 2), r: von },
      bereich: uebung.bereich,
      zuLeicht,
    };
  }
  return {
    art: 'wiederholung_mehr',
    letztesMal: { w: last, r: besteWdh },
    vorschlag: { w: last, r: Math.min(bis, besteWdh + 1) },
    bereich: uebung.bereich,
    zuLeicht,
  };
}

/**
 * Die nächste Einheit der Rotation. LOGMAN stellt nach „Diese Einheit ist
 * vollständig“ selbst auf die nächste (payload.week/day). Stehen dort schon
 * Sätze, wurde sie bereits trainiert, und die danach ist dran.
 */
export function naechsteEinheit(payload, einheiten) {
  const liste = rotation();
  // Jeder eingetragene Satz zählt, auch ohne gewählten Übungsnamen.
  const hatSaetze = (punkt) => {
    const zelle = payload?.data?.[punkt.tag]?.[punkt.cycle] || payload?.data?.[punkt.tag]?.[String(punkt.cycle)] || {};
    return Object.values(zelle).some((eintrag) => (eintrag?.sets || []).some((roh) => (roh || []).some(satzGueltig)));
  };
  let index = liste.findIndex((punkt) => punkt.cycle === Number(payload?.week) && punkt.tag === payload?.day);
  if (index < 0) {
    // Ohne gültigen Stand: nach der letzten Einheit mit Sätzen weiter.
    const letzte = einheiten.at(-1);
    index = letzte ? liste.findIndex((punkt) => punkt.cycle === letzte.cycle && punkt.tag === letzte.tag) + 1 : 0;
  } else if (hatSaetze(liste[index])) {
    index += 1;
  }
  const punkt = liste[index];
  if (!punkt) return { phaseZuEnde: true };
  const vorlage = TPL[punkt.tag];
  const tier = tierVon(payload, punkt.tag, punkt.cycle);
  const deload = istDeload(punkt.cycle);
  const uebungen = [];
  vorlage.blocks.forEach((block) => {
    if (!targetSets(block, tier)) return;
    const namen = namenFuer(payload, punkt.tag, block, {});
    (block.ex || []).forEach((_feld, xi) => {
      const name = String(namen[xi] || '').trim();
      const satzart = deload ? 'DELOAD' : (SATZART[block.type] || 'PUMPS');
      if (deload) {
        uebungen.push({ name: name || block.mus, muskel: block.mus, satzart, ziel: { art: 'deload', saetze: targetSets(block, tier), rir: bereichAus(block.rir) } });
        return;
      }
      if (!PROGRESSION.has(satzart) || !name) return;
      const schluessel = `${punkt.tag}|${satzart}|${klein(name)}`;
      const vorher = vorheriges(einheiten, einheiten.length, schluessel);
      uebungen.push({
        name,
        muskel: block.mus,
        satzart,
        ziel: vorher ? zielFuer(vorher.uebung) : { art: 'erstmals', bereich: bereichAus(block.reps) },
      });
    });
  });
  return {
    cycle: punkt.cycle,
    tag: punkt.tag,
    einheit: vorlage.short,
    level: TIER_NAMES[tier],
    deload,
    uebungen,
  };
}

/** Verlauf je Übung (HEAVYS/MIDDLES): bester e1RM je Cycle, Einheiten ohne Fortschritt, wiederholter Abfall. */
export function uebungsVerlauf(einheiten) {
  const reihen = new Map();
  einheiten.forEach((einheit) => einheit.uebungen.forEach((uebung) => {
    if (!PROGRESSION.has(uebung.satzart)) return;
    const schluessel = uebungsSchluessel(einheit, uebung);
    if (!reihen.has(schluessel)) reihen.set(schluessel, { name: uebung.name, einheit: einheit.einheit, satzart: uebung.satzart, punkte: [] });
    reihen.get(schluessel).punkte.push({ cycle: einheit.cycle, bestE1: uebung.bestE1, roh: uebung.roh });
  }));
  return [...reihen.values()].map((reihe) => {
    const vergleiche = reihe.punkte.slice(1).map((punkt, i) => vergleichE1(reihe.punkte[i].roh, punkt.roh));
    let ohneFortschritt = 0;
    for (let i = vergleiche.length - 1; i >= 0 && vergleiche[i] != null && vergleiche[i] <= 0; i -= 1) ohneFortschritt += 1;
    return {
      name: reihe.name,
      einheit: reihe.einheit,
      satzart: reihe.satzart,
      verlauf: reihe.punkte.map(({ cycle, bestE1: wert }) => ({ cycle, bestE1: wert })),
      // Zahl der letzten Vergleiche ohne Steigerung: 2 heißt drei Einheiten auf demselben Stand.
      ohneFortschritt,
      // LOGMAN-Training.md, Abschnitt 7: „Leistung fällt wiederholt“ spricht für weniger Volumen.
      faelltWiederholt: vergleiche.length >= 2 && vergleiche.at(-1) === -1 && vergleiche.at(-2) === -1,
    };
  });
}

/**
 * Sätze je Muskel im Cycle: geplant laut LOGMANs Set-O-Meter (direkt 1,
 * indirekt 0,5) und tatsächlich eingetragen, mit derselben Gewichtung über den
 * Übungskatalog (Haupt- und Nebenspieler).
 */
export function saetzeJeMuskel(payload, einheiten, cycle) {
  const geplant = zaehleCycle(payload, cycle).konten;
  const katalog = katalogMitEigenen(payload?.eigeneUebungen, { nurAktive: false, mitGeloeschten: true });
  const index = new Map(katalog.map((eintrag) => [klein(eintrag.n), eintrag]));
  const erledigt = Object.fromEntries(KONTEN.map((konto) => [konto, 0]));
  einheiten.filter((einheit) => einheit.cycle === cycle).forEach((einheit) => einheit.uebungen.forEach((uebung) => {
    const eintrag = index.get(klein(uebung.name));
    if (!eintrag) return;
    erledigt[eintrag.haupt] += uebung.saetze.length;
    eintrag.neben.forEach((konto) => { if (konto in erledigt) erledigt[konto] += uebung.saetze.length * 0.5; });
  }));
  return KONTEN
    .map((konto) => ({ muskel: konto, geplant: runde(geplant[konto] || 0), erledigt: runde(erledigt[konto]) }))
    .filter((zeile) => zeile.geplant || zeile.erledigt);
}

const tageZwischen = (von, bis) => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 86_400_000);

/**
 * Gesamte Auswertung für den Coach. heute: Datum (YYYY-MM-DD, Europe/Berlin),
 * gesehen: logman_spiegel.einheiten_gesehen.
 */
export function trainingsAuswertung(payload, { gesehen = {}, heute = null } = {}) {
  const einheiten = einheitenAus(payload, gesehen);
  const letzteIndex = einheiten.length - 1;
  const letzte = einheiten[letzteIndex] || null;
  const cycle = letzte?.cycle || Number(payload?.week) || 1;
  const datierte = einheiten.filter((einheit) => einheit.datum).map((einheit) => einheit.datum).sort();
  const zuletztTrainiert = datierte.at(-1) || null;
  return {
    stand: {
      cycle,
      deload: istDeload(cycle),
      cyclesBisDeload: istDeload(cycle) ? 0 : DELOAD_CYCLE - cycle,
      einheitenMitSaetzen: einheiten.length,
      zuletztTrainiert,
      tageSeitLetzterEinheit: heute && zuletztTrainiert ? tageZwischen(zuletztTrainiert, heute) : null,
    },
    heute: heute
      ? einheiten.map((einheit, index) => (einheit.datum === heute ? einheitZusammenfassen(einheiten, index) : null)).filter(Boolean)
      : [],
    letzteEinheit: letzte ? einheitZusammenfassen(einheiten, letzteIndex) : null,
    naechsteEinheit: naechsteEinheit(payload, einheiten),
    uebungen: uebungsVerlauf(einheiten),
    muskeln: einheiten.length ? saetzeJeMuskel(payload, einheiten, cycle) : [],
  };
}
