import { TPL } from './template.js';
import { KONTEN } from './katalog.js';
import { katalogMitEigenen } from './eigene-uebungen.js';
import { targetSets, setsForExercise, exOf, extraSets } from './saetze.js';
import {
  istDeload,
  tageDerWoche,
  tierVon,
  prioritaetsAnpassungen,
  slotKey,
} from './prioritaet.js';

// Das Set-O-Meter zählt den geplanten vollständigen CYCLE:
// OK HEAVYS + UK HEAVYS + OK/UK MIDDLES & PUMPS.
// Direkte Sätze zählen 1, indirekte Sätze werden als ganze Sätze angezeigt,
// tragen im Vergleichsbalken aber weiterhin mit 0,5 bei.

export const KURZ = {
  'Vordere Schulter': 'Vord. Schulter',
  'Seitliche Schulter': 'Seitl. Schulter',
  'Hintere Schulter': 'Hint. Schulter',
  'Oberer Rücken': 'Ob. Rücken',
};
export const zeigName = (k) => KURZ[k] || k;
const klein = (s) => String(s || '').trim().toLowerCase();

export { istDeload, tageDerWoche };

export function zaehleCycle(payload, cycle, katalog = null) {
  katalog = katalog || katalogMitEigenen(payload?.eigeneUebungen, { nurAktive: false, mitGeloeschten: true });
  const idx = new Map(katalog.map((e) => [klein(e.n), e]));
  const konten = {};
  const direkt = {};
  const indirekt = {};
  const quellen = {};
  KONTEN.forEach((k) => {
    konten[k] = 0;
    direkt[k] = 0;
    indirekt[k] = 0;
    quellen[k] = new Map();
  });

  const prio = prioritaetsAnpassungen(payload, cycle);
  let ohneZuordnung = 0;
  const unbekannte = new Set();
  const data = (payload && payload.data) || {};
  const exAlle = (payload && payload.ex) || {};

  tageDerWoche(payload, cycle).forEach((tag) => {
    const tpl = TPL[tag];
    if (!tpl) return;
    const tier = tierVon(payload, tag, cycle);
    const zelle = ((data[tag] || {})[cycle]) || {};
    const nameTag = tpl.nameSource || tag;

    tpl.blocks.forEach((blk) => {
      if (!targetSets(blk, tier)) return;
      const eintragBlock = zelle[blk.id] || {};
      const frei = blk.type !== 'load' && blk.type !== 'middle';
      const festeNamen = ((exAlle[nameTag] || {})[blk.id]) || [];
      const namen = frei
        ? (eintragBlock.names || [])
        : (festeNamen.some((name) => String(name || '').trim())
          ? festeNamen
          : (eintragBlock.names || []));

      exOf(blk, tier).forEach((exDef, xi) => {
        const name = String(namen[xi] || '').trim();
        if (!name) return;
        const anzahl = Math.max(0,
          setsForExercise(blk, tier, xi) +
          extraSets(eintragBlock, tier, xi) +
          (prio.delta[slotKey(tag, blk.id, xi)] || 0));
        if (!anzahl) return;

        const eintrag = idx.get(klein(name));
        if (!eintrag) {
          ohneZuordnung += anzahl;
          unbekannte.add(name);
          return;
        }
        const erlaubt = exDef.konten || blk.konten || [];
        if (!erlaubt.includes(eintrag.haupt)) return;
        konten[eintrag.haupt] += anzahl;
        direkt[eintrag.haupt] += anzahl;
        eintrag.neben.forEach((nb) => {
          if (konten[nb] === undefined) return;
          konten[nb] += anzahl * 0.5;
          indirekt[nb] += anzahl;
          quellen[nb].set(name, (quellen[nb].get(name) || 0) + anzahl);
        });
      });
    });
  });

  // Der Zielmuskel des Prio-Slots ist bereits bekannt, bevor seine Übung
  // gewählt wird. Deshalb sind die zwei geplanten Sätze sofort sichtbar.
  prio.slots.forEach((slot) => {
    konten[slot.konto] += slot.anzahl;
    direkt[slot.konto] += slot.anzahl;
    const zelle = ((data[slot.tag] || {})[cycle]) || {};
    const frei = slot.tag.endsWith('-P');
    const namen = frei
      ? ((zelle[slot.blockId] || {}).names || [])
      : (((exAlle[slot.tag] || {})[slot.blockId]) || []);
    const name = String(namen[0] || '').trim();
    const eintrag = idx.get(klein(name));
    if (!eintrag || eintrag.haupt !== slot.konto) return;
    eintrag.neben.forEach((nb) => {
      if (konten[nb] === undefined) return;
      konten[nb] += slot.anzahl * 0.5;
      indirekt[nb] += slot.anzahl;
      quellen[nb].set(name, (quellen[nb].get(name) || 0) + slot.anzahl);
    });
  });

  const gesamt = KONTEN.reduce((summe, konto) => summe + konten[konto], 0) + ohneZuordnung;
  const indirektQuellen = {};
  KONTEN.forEach((konto) => {
    indirektQuellen[konto] = [...quellen[konto]]
      .map(([name, saetze]) => ({ name, saetze }))
      .sort((a, b) => b.saetze - a.saetze || a.name.localeCompare(b.name, 'de'));
  });

  return {
    konten,
    direkt,
    indirekt,
    indirektQuellen,
    ohneZuordnung,
    unbekannte: [...unbekannte],
    gesamt,
    prioritaet: prio.ergebnisse,
  };
}

export function sortiert(konten) {
  return KONTEN
    .map((konto) => ({ konto, wert: konten[konto] || 0 }))
    .sort((a, b) => b.wert - a.wert ||
      KONTEN.indexOf(a.konto) - KONTEN.indexOf(b.konto));
}
