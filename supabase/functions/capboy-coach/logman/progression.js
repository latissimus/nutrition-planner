import { TPL } from './template.js';

// Auswertung der progressiv getrackten HEAVYS und MIDDLES.
//
// Warum ein geschaetztes 1RM und nicht einfach das Gewicht: 80 kg × 8 und
// 85 kg × 6 sind beide
// ein Fortschritt, aber ueber die reine Last nicht vergleichbar. Das geschaetzte
// Einer-Maximum (Epley) bringt Last und Wiederholungen auf eine Zahl – so bleibt
// eine Steigerung sichtbar, egal ob sie ueber Gewicht oder Wdh. kam.
//
// Reines Modul ohne DOM: Eine falsche Kurve sieht aus wie eine richtige.

export const e1rm = (w, r) => {
  const last = parseFloat(String(w).replace(',', '.'));
  const wdh = parseFloat(r);
  if (!Number.isFinite(last) || last < 0 || !Number.isFinite(wdh) || wdh <= 0) return 0;
  return last * (1 + wdh / 30);
};

const satzGueltig = (s) => {
  if (!s || String(s.w ?? '').trim() === '' || String(s.r ?? '').trim() === '') return false;
  const gewicht = parseFloat(String(s.w).replace(',', '.'));
  const wdh = parseFloat(s.r);
  return Number.isFinite(gewicht) && gewicht >= 0 && Number.isFinite(wdh) && wdh > 0;
};

// Bester Satz einer Uebung an einem Tag.
export const bestE1 = (saetze) =>
  (saetze || []).reduce((m, s) => (satzGueltig(s) ? Math.max(m, e1rm(s.w, s.r)) : m), 0);

// Vergleich zweier Trainingseintraege. Jede echte Aenderung zaehlt: Ein
// absoluter 1RM-Puffer wuerde kleine Lasten benachteiligen (bei 7 kg veraendert
// eine Wiederholung den Epley-Wert nur um rund 0,23 kg).
export const vergleichE1 = (vorher, heute) => {
  const alt = bestE1(vorher);
  const neu = bestE1(heute);
  if (!(vorher || []).some(satzGueltig) || !(heute || []).some(satzGueltig)) return null;
  const differenz = neu - alt;
  const rundungstoleranz = Math.max(alt, neu, 1) * 1e-10;
  if (differenz > rundungstoleranz) return 1;
  if (differenz < -rundungstoleranz) return -1;
  return 0;
};

/**
 * Reihen je getrackter Übung aus dem gespeicherten Payload.
 * @returns [{ name, punkte: [{ week, e1 }] }] – `week` bleibt als interner
 *          Zahlenkey erhalten, bezeichnet in Schema v4 aber den CYCLE.
 */
function reihenFuerTypen(payload, typen) {
  const data = (payload && payload.data) || {};
  const namenAll = (payload && payload.ex) || {};
  const proUebung = new Map();

  Object.keys(data).forEach((tag) => {
    const tplTag = TPL[tag];
    if (!tplTag) return;
    Object.keys(data[tag] || {}).forEach((wkStr) => {
      const woche = Number(wkStr);
      if (woche >= 8) return;
      const zelle = data[tag][wkStr] || {};
      Object.keys(zelle).forEach((bid) => {
        const blk = tplTag.blocks.find((b) => b.id === bid);
        const istPrio = bid.startsWith('prio:');
        const type = blk?.type || (istPrio && tag.endsWith('-H') ? 'load' : null);
        // PUMPS, CLUSTERS und Deload sind keine Progressions-Marker.
        if (!typen.includes(type)) return;
        const eintrag = zelle[bid] || {};
        // Alte 10–15er-Daten liegen noch als frei gewählte Namen im Cycle.
        // Neue MIDDLES und alle HEAVYS lesen ihre feste Auswahl aus payload.ex.
        const namen = eintrag.names || (namenAll[tplTag.nameSource || tag] || {})[bid] || [];
        (eintrag.sets || []).forEach((saetze, xi) => {
          const name = String(namen[xi] || '').trim();
          if (!name) return;
          const best = bestE1(saetze);
          if (!(saetze || []).some(satzGueltig)) return;
          // Derselbe Name darf bei HEAVYS und MIDDLES zwei getrennte Reihen
          // bilden, weil Last und Wiederholungsbereich nicht vergleichbar sind.
          const key = `${type}|${name.toLowerCase()}`;
          if (!proUebung.has(key)) proUebung.set(key, {
            name,
            type,
            typ: type === 'middle' ? 'MIDDLES' : 'HEAVYS',
            wochen: new Map(),
          });
          const reihe = proUebung.get(key);
          const bisher = reihe.wochen.get(woche);
          if (bisher === undefined || best > bisher) reihe.wochen.set(woche, best);
        });
      });
    });
  });

  return [...proUebung.values()]
    .map((e) => ({
      name: e.name,
      type: e.type,
      typ: e.typ,
      punkte: [...e.wochen.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([week, wert]) => ({ week, e1: Math.round(wert * 10) / 10 })),
    }))
    .filter((e) => e.punkte.length >= 2)
    .sort((a, b) => b.punkte.length - a.punkte.length || a.name.localeCompare(b.name, 'de'));
}

// Bestehende Schnittstelle für die bisherigen Tests und mögliche Aufrufer.
export const heavyReihen = (payload) => reihenFuerTypen(payload, ['load']);

// Die Progressionsseite führt beide Double-Progression-Satzarten auf.
export const progressionsReihen = (payload) => reihenFuerTypen(payload, ['load', 'middle']);

// Datenschutzarmer Fortschritts-Export: ausschliesslich die tatsaechlich
// geloggten HEAVYS- und MIDDLES-Saetze. Profil, Notizen, PUMPS und sonstiger
// Oberflaechenzustand verlassen die App dabei nicht.
export function progressionsExportZeilen(payload) {
  const data = payload?.data || {};
  const festeNamen = payload?.ex || {};
  const datum = payload?.datum || {};
  const tier = payload?.tier || {};
  const levelNamen = ['I', 'II', 'III'];
  const zeilen = [];

  Object.keys(data).forEach((tag) => {
    const tplTag = TPL[tag];
    if (!tplTag || tag.endsWith('-D')) return;
    Object.keys(data[tag] || {})
      .map(Number)
      .filter((cycle) => Number.isFinite(cycle) && cycle > 0 && cycle < 8)
      .sort((a, b) => a - b)
      .forEach((cycle) => {
        const zelle = data[tag][String(cycle)] || data[tag][cycle] || {};
        Object.keys(zelle).forEach((blockId) => {
          const block = tplTag.blocks.find((b) => b.id === blockId);
          const istPrio = blockId.startsWith('prio:');
          const type = block?.type || (istPrio && tag.endsWith('-H') ? 'load' : null);
          if (type !== 'load' && type !== 'middle') return;
          const eintrag = zelle[blockId] || {};
          const namen = eintrag.names || (festeNamen[tplTag.nameSource || tag] || {})[blockId] || [];
          (eintrag.sets || []).forEach((saetze, xi) => {
            const name = String(namen[xi] || '').trim();
            if (!name) return;
            (saetze || []).forEach((satz, satzIndex) => {
              if (!satzGueltig(satz)) return;
              const gewicht = parseFloat(String(satz.w).replace(',', '.'));
              const wiederholungen = parseFloat(satz.r);
              zeilen.push({
                cycle,
                datum: datum[`${tag}|${cycle}`] || '',
                einheit: tplTag.short,
                level: levelNamen[Number(tier[`${tag}|${cycle}`] ?? 1)] || 'II',
                satzart: type === 'middle' ? 'MIDDLES' : 'HEAVYS',
                muskel: block?.mus || blockId.slice('prio:'.length),
                rolle: block?.ex?.[xi]?.r || (istPrio ? 'Comp/Iso' : ''),
                uebung: name,
                satz: satzIndex + 1,
                gewicht,
                wiederholungen,
                rir: String(satz.rir ?? '').trim(),
                ein_rm: Math.round(e1rm(gewicht, wiederholungen) * 10) / 10,
              });
            });
          });
        });
      });
  });

  return zeilen.sort((a, b) => a.cycle - b.cycle || a.einheit.localeCompare(b.einheit, 'de') ||
    a.muskel.localeCompare(b.muskel, 'de') || a.uebung.localeCompare(b.uebung, 'de') || a.satz - b.satz);
}

const csvZelle = (wert) => `"${String(wert ?? '').replace(/"/g, '""')}"`;

export function progressionsCsv(payload) {
  const kopf = ['Cycle', 'Datum', 'Einheit', 'Level', 'Satzart', 'Muskel', 'Comp/Iso',
    'Übung', 'Satz', 'Gewicht (kg)', 'Wiederholungen', 'RIR', '1RM (kg)'];
  const zeilen = progressionsExportZeilen(payload).map((z) => [
    z.cycle, z.datum, z.einheit, z.level, z.satzart, z.muskel, z.rolle,
    z.uebung, z.satz, String(z.gewicht).replace('.', ','), z.wiederholungen,
    z.rir, String(z.ein_rm).replace('.', ','),
  ]);
  return '\uFEFF' + [kopf, ...zeilen].map((zeile) => zeile.map(csvZelle).join(';')).join('\r\n');
}

// Veraenderung vom ersten zum letzten Punkt, in kg und Prozent.
export function verlauf(punkte) {
  if (!punkte || punkte.length < 2) return null;
  const erst = punkte[0].e1;
  const letzt = punkte[punkte.length - 1].e1;
  return {
    erst,
    letzt,
    kg: Math.round((letzt - erst) * 10) / 10,
    prozent: erst === 0 ? null : Math.round(((letzt - erst) / erst) * 1000) / 10,
  };
}
