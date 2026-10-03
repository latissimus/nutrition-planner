import { TPL, CYCLE_TAGE, DELOAD_TAGE } from './template.js';
import { KONTEN } from './katalog.js';
import { targetSets, exOf, setsForExercise, extraSets } from './saetze.js';

// Prioritäten erhalten in jeder passenden OK- oder UK-Einheit einen eigenen
// Slot mit einem oder zwei Sätzen. Das Ziel muss deshalb nicht schon als
// reguläre Übung im Plan stehen.

export const slotKey = (tag, blockId, xi) => `${tag}|${blockId}|${xi}`;
export const prioBlockId = (konto) => `prio:${konto}`;
export const istDeload = (cycle) => Number(cycle) >= 8;
export const tageDerWoche = (_payload, cycle) => istDeload(cycle) ? [...DELOAD_TAGE] : [...CYCLE_TAGE];

export function tierVon(payload, tag, cycle) {
  if (istDeload(cycle)) return 0;
  const t = ((payload && payload.tier) || {})[`${tag}|${cycle}`];
  return (t === 0 || t === 1 || t === 2) ? t : 1;
}

const UK_KONTEN = new Set(['Quads', 'Hams', 'Glutes', 'Waden', 'Abduktoren', 'Abs']);
export const koerperhaelfte = (konto) => UK_KONTEN.has(konto) ? 'UK' : 'OK';
const volumenVon = (payload) => (payload && payload.volumen) || {};
export const prioritaetenVon = (payload) => volumenVon(payload).prioritaet || {};
const gueltigePrio = (cfg) => cfg &&
  (cfg.modus === 'reihenfolge' || cfg.modus === 'plus' || cfg.modus === 'tausch');
export const prioSatzanzahl = (cfg) => {
  if (cfg?.modus === 'reihenfolge' || Number(cfg?.saetze) === 0) return 0;
  return Number(cfg?.saetze) === 1 ? 1 : 2;
};

const prioWdhBereich = (konto, heavy) => {
  if (!heavy) return '15–20';
  return konto === 'Unterarme' ? '8–15' : '6–10';
};

function passendeTage(cycle, konto) {
  if (istDeload(cycle)) return [];
  const prefix = `${koerperhaelfte(konto)}-`;
  return CYCLE_TAGE.filter((tag) => tag.startsWith(prefix));
}

export function prioBlock(konto, tag, anzahl = 2) {
  const heavy = tag.endsWith('-H');
  const ok = tag.startsWith('OK-');
  const saetze = anzahl === 0 ? 0 : (anzahl === 1 ? 1 : 2);
  return {
    id: prioBlockId(konto),
    mus: konto,
    konten: [konto],
    type: heavy ? 'load' : 'pump',
    sets: [saetze, saetze, saetze],
    rest: heavy ? 150 : (ok ? 90 : 120),
    reps: prioWdhBereich(konto, heavy),
    rir: '0–1 RIR',
    free: heavy ? 0 : 1,
    prio: 1,
    ex: [{ n: '', konten: [konto], prioRollen: ['Comp', 'Iso'] }],
  };
}

export function prioMoeglichkeiten(payload, cycle, konto) {
  const anzahl = prioSatzanzahl(prioritaetenVon(payload)[konto]);
  return passendeTage(cycle, konto).map((tag) => {
    const block = prioBlock(konto, tag, anzahl);
    return {
      key: slotKey(tag, block.id, 0),
      tag,
      blockId: block.id,
      xi: 0,
      mus: konto,
      konto,
      anzahl,
      erlaubt: [konto],
      block,
    };
  });
}

// Kompatibler Name für die Set-O-Meter-Oberfläche.
export const pumpMoeglichkeiten = prioMoeglichkeiten;

function regulaereFelder(payload, cycle, konto, tag = null) {
  const result = [];
  tageDerWoche(payload, cycle).forEach((day) => {
    if (tag && day !== tag) return;
    const tpl = TPL[day];
    if (!tpl || tpl.nameSource) return;
    const tier = tierVon(payload, day, cycle);
    tpl.blocks.forEach((blk) => {
      exOf(blk, tier).forEach((exDef, xi) => {
        const erlaubt = exDef.konten || blk.konten || [];
        if (!erlaubt.includes(konto)) return;
        result.push({
          key: slotKey(day, blk.id, xi),
          tag: day,
          blockId: blk.id,
          xi,
          mus: blk.mus,
          konto,
          anzahl: setsForExercise(blk, tier, xi) +
            extraSets((((payload?.data || {})[day] || {})[cycle] || {})[blk.id], tier, xi),
          erlaubt,
        });
      });
    });
  });
  return result;
}

export function prioReihenfolgeMoeglich(payload, cycle, konto) {
  const tage = passendeTage(cycle, konto);
  return tage.length > 0 &&
    tage.every((tag) => regulaereFelder(payload, cycle, konto, tag).length > 0);
}

function bestesFeld(felder) {
  return [...felder].sort((a, b) => b.anzahl - a.anzahl || a.key.localeCompare(b.key))[0] || null;
}

export function prioritaetsAnpassungen(payload, cycle) {
  const prioritaet = prioritaetenVon(payload);
  const delta = {};
  const ergebnisse = {};
  const slots = [];
  const reservierteSpender = new Set();

  KONTEN.forEach((ziel) => {
    const cfg = prioritaet[ziel];
    if (!gueltigePrio(cfg)) return;
    if (cfg.modus === 'reihenfolge') {
      ergebnisse[ziel] = { status: 'aktiv', modus: 'reihenfolge', slots: [] };
      return;
    }
    const zielSlots = prioMoeglichkeiten(payload, cycle, ziel);
    if (!zielSlots.length) {
      ergebnisse[ziel] = { status: 'ziel-fehlt', modus: cfg.modus };
      return;
    }

    if (cfg.modus === 'plus') {
      slots.push(...zielSlots);
      ergebnisse[ziel] = { status: 'aktiv', modus: 'plus', slots: zielSlots };
      return;
    }

    const spender = cfg.spender;
    if (!spender || spender === ziel || gueltigePrio(prioritaet[spender]) ||
        koerperhaelfte(spender) !== koerperhaelfte(ziel)) {
      ergebnisse[ziel] = { status: 'spender-fehlt', modus: 'tausch', spender };
      return;
    }

    const spenderFelder = [];
    let vollstaendig = true;
    zielSlots.forEach((slot) => {
      const feld = bestesFeld(regulaereFelder(payload, cycle, spender, slot.tag)
        .filter((f) => !reservierteSpender.has(f.key) && f.anzahl >= slot.anzahl));
      if (!feld) vollstaendig = false;
      else spenderFelder.push(feld);
    });
    if (!vollstaendig || spenderFelder.length !== zielSlots.length) {
      ergebnisse[ziel] = { status: 'spender-fehlt', modus: 'tausch', spender };
      return;
    }

    spenderFelder.forEach((feld) => {
      reservierteSpender.add(feld.key);
      delta[feld.key] = (delta[feld.key] || 0) - prioSatzanzahl(cfg);
    });
    slots.push(...zielSlots);
    ergebnisse[ziel] = {
      status: 'aktiv',
      modus: 'tausch',
      slots: zielSlots,
      spender,
      spenderName: cfg.spenderName || spender,
      spenderFelder,
    };
  });

  return { delta, ergebnisse, slots };
}

export function prioBloecke(payload, cycle, tag) {
  const anpassung = prioritaetsAnpassungen(payload, cycle);
  return anpassung.slots
    .filter((slot) => slot.tag === tag)
    .map((slot) => slot.block);
}

// Prioritäten stehen innerhalb ihrer Körperhälfte zuerst. Bei mehreren Zielen
// gilt die Reihenfolge, in der sie im Set-O-Meter aktiviert wurden. Reguläre
// Blöcke bleiben vollständig erhalten; ein Zusatzslot steht direkt hinter dem
// passenden regulären Block. Ein neuer Muskel ohne regulären Block (z. B.
// Unterarme) erscheint als eigener Prioritätsblock in derselben oberen Gruppe.
export function sortiereBloeckeNachPrioritaet(payload, cycle, tag, basisBloecke) {
  const basis = [...basisBloecke];
  if (istDeload(cycle)) return basis;
  const prioritaet = prioritaetenVon(payload);
  const reihenfolge = Object.keys(prioritaet).filter((konto) => gueltigePrio(prioritaet[konto]));
  if (!reihenfolge.length) return basis;

  const extras = prioBloecke(payload, cycle, tag);
  const verwendetBasis = new Set();
  const verwendetExtras = new Set();
  const oben = [];

  reihenfolge.forEach((konto) => {
    let hatRegulaerenBlock = false;
    basis.forEach((blk, index) => {
      if (verwendetBasis.has(index) || !(blk.konten || []).includes(konto)) return;
      oben.push(blk);
      verwendetBasis.add(index);
      hatRegulaerenBlock = true;
    });
    extras.forEach((extra, index) => {
      if (verwendetExtras.has(index) || extra.konten?.[0] !== konto) return;
      oben.push({ ...extra, angedockt: hatRegulaerenBlock ? 1 : 0 });
      verwendetExtras.add(index);
    });
  });

  extras.forEach((extra, index) => {
    if (!verwendetExtras.has(index)) oben.push(extra);
  });
  basis.forEach((blk, index) => {
    if (!verwendetBasis.has(index)) oben.push(blk);
  });
  return oben;
}

// Ein Spender muss in beiden passenden Einheiten die gewählte Satzanzahl
// bereitstellen können. Vorschläge stehen nach bereits geplanter Cycle-Arbeit.
export function spenderKandidaten(payload, cycle, ziel, cycleWerte = {}) {
  if (istDeload(cycle)) return [];
  const prioritaet = prioritaetenVon(payload);
  const zielHaelfte = koerperhaelfte(ziel);
  const tage = passendeTage(cycle, ziel);
  const konten = cycleWerte.konten || {};
  const direkt = cycleWerte.direkt || {};
  const indirekt = cycleWerte.indirekt || {};
  const anzahl = prioSatzanzahl(prioritaet[ziel]);

  return KONTEN
    .filter((konto) => konto !== ziel &&
      koerperhaelfte(konto) === zielHaelfte &&
      !gueltigePrio(prioritaet[konto]))
    .map((konto) => {
      const felder = tage.map((tag) => bestesFeld(regulaereFelder(payload, cycle, konto, tag)
        .filter((f) => f.anzahl >= anzahl)));
      if (felder.some((f) => !f)) return null;
      return {
        konto,
        key: konto,
        label: konto,
        name: `${koerperhaelfte(konto)} HEAVYS + MIDDLES & PUMPS`,
        direkt: direkt[konto] || 0,
        indirekt: indirekt[konto] || 0,
        wert: konten[konto] || 0,
        verfuegbar: Math.min(...felder.map((f) => f.anzahl)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.wert - a.wert || b.direkt - a.direkt ||
      KONTEN.indexOf(a.konto) - KONTEN.indexOf(b.konto))
    .map((e, index, alle) => ({
      ...e,
      viel: alle[0]?.wert > 0 && e.wert >= alle[0].wert * 0.75,
      gruende: [
        'beide Einheiten',
        ...(index === 0 && e.wert > 0 ? ['höchste Cycle-Arbeit'] : []),
      ],
    }));
}
