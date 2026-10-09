// Volumen-Entscheidung für das Wochen-Coaching (COACHING-PLAN.md, Schritt 5).
//
// Die App entscheidet, ob eine Volumenänderung nach LOGMAN-Training.md
// (Abschnitte 7 und 8) überhaupt erlaubt ist, und bietet nur passende
// LOGMAN-Hebel an. Die KI wählt höchstens einen davon und begründet ihn; eine
// Wahl außerhalb der Liste gilt als „beibehalten“. Reihenfolge nach dem
// GPT-Review vom 05.10.2026: erst Sperren, dann je Muskel bewerten, dann nur
// zulässige Aktionen. Fehlende Werte zählen nie als gut.
//
// Reines JavaScript ohne Datenbank: capboy-coach (Deno) und die Tests (Vitest)
// laden dieselbe Datei.

import { CYCLE_TAGE, TPL } from './logman/template.js';
import { istDeload, koerperhaelfte, prioritaetsAnpassungen, slotKey, tierVon } from './logman/prioritaet.js';
import { exOf, extraSets, setsForExercise, targetSets } from './logman/saetze.js';
import { katalogMitEigenen } from './logman/eigene-uebungen.js';
import { einheitenAus, saetzeJeMuskel, trainingsAuswertung, uebungsVerlauf } from './training.js';
import { FOLLOW_THROUGH_LIMITS, durationMinutes } from './followThrough.ts';
import { reviewWeeks } from './weekly.ts';
import { currentCalorieTarget, targetPhaseDay } from './nutritionTarget.js';

export const VOLUMEN_GRENZEN = {
  // Satz-Erfüllung je Muskel und Zyklus (erledigt ÷ geplant).
  erfuellungHoch: 0.9,
  erfuellungNiedrig: 0.75,
  // Zwei Vergleiche ohne Steigerung = drei Einheiten auf demselben Stand.
  stillstand: 2,
  // Vergleichbare Zyklen: drei für die Leistung (zwei Vergleiche), die
  // letzten zwei davon für die Satz-Erfüllung.
  zyklenLeistung: 3,
  zyklenErfuellung: 2,
  // Eine Prioritätsänderung in den letzten 14 Tagen gilt als kürzlich.
  aenderungTage: 14,
  // Deload läuft oder steht im nächsten Zyklus an: Ermüdung ist dann erwartet.
  deloadAbstand: 1,
  // Erholung, Schlaf und Ernährung der letzten 14 Tage, wie followThrough.ts.
  fensterTage: 14,
  minWerte: FOLLOW_THROUGH_LIMITS.minDays,
  erholungMin: 3,
  schlafMinuten: FOLLOW_THROUGH_LIMITS.sleepMinutes,
  schlafQualitaet: FOLLOW_THROUGH_LIMITS.sleepQuality,
  kcalAnteil: 0.95,
  proteinProKg: FOLLOW_THROUGH_LIMITS.proteinPerKg,
  proteinAnteil: FOLLOW_THROUGH_LIMITS.proteinLowShare,
  // Wochenmittel der letzten drei abgeschlossenen Wochen.
  gewichtToleranzKg: -0.3,
  hautfaltenAnstiegMm: 3,
  hautfaltenWochen: 4,
};
const G = VOLUMEN_GRENZEN;

const DAY = 86_400_000;
const runde = (n, stellen = 1) => (n == null ? null : Math.round(n * 10 ** stellen) / 10 ** stellen);
const zahl = (wert) => (Number.isFinite(Number(wert)) ? Number(wert) : 0);
const mittel = (werte) => (werte.length ? werte.reduce((summe, wert) => summe + wert, 0) / werte.length : null);
const klein = (text) => String(text || '').trim().toLowerCase();
const plusTage = (datum, tage) => new Date(Date.parse(`${datum}T00:00:00Z`) + tage * DAY).toISOString().slice(0, 10);
const tag = (wert) => (typeof wert === 'string' && wert.length >= 10 ? wert.slice(0, 10) : null);
const prozent = (anteil) => `${Math.round(anteil * 100)} %`;

export const BEIBEHALTEN = { id: 'beibehalten', art: 'beibehalten', text: 'Volumen unverändert lassen.' };

/* JSON mit sortierten Schlüsseln: jsonb gibt Objekte in eigener Reihenfolge
   zurück; ein gespeicherter Stand muss trotzdem als gleich erkannt werden. */
export const stabilesJson = (wert) => JSON.stringify(wert, (_schluessel, inhalt) => (inhalt && typeof inhalt === 'object' && !Array.isArray(inhalt)
  ? Object.fromEntries(Object.keys(inhalt).sort().map((schluessel) => [schluessel, inhalt[schluessel]]))
  : inhalt));

/* Prioritäten wie in logman-abgleich/umrechnung.js (gleiche Fassung, Test
   prüft es): gültige Einträge mit Satzzahl und beim Tausch dem Spender. */
export function prioritaetNormalisieren(payload) {
  const roh = payload?.volumen?.prioritaet || {};
  const ergebnis = {};
  Object.keys(roh).sort().forEach((konto) => {
    const cfg = roh[konto];
    if (!cfg || !['reihenfolge', 'plus', 'tausch'].includes(cfg.modus)) return;
    const saetze = cfg.modus === 'reihenfolge' || Number(cfg.saetze) === 0 ? 0 : (Number(cfg.saetze) === 1 ? 1 : 2);
    ergebnis[konto] = { modus: cfg.modus, saetze, ...(cfg.modus === 'tausch' && cfg.spender ? { spender: String(cfg.spender) } : {}) };
  });
  return ergebnis;
}
// Der Stand mit einer anderen Priorität, um einen Zyklus mit seiner damaligen
// Vorgabe nachzurechnen.
const mitPrioritaet = (payload, prioritaet) => ({ ...payload, volumen: { ...(payload?.volumen || {}), prioritaet } });

/* LOGMAN-Volumenstand: Prioritäten je Muskel und Stufe der vier Einheiten im
   laufenden Zyklus. Jeder Wochen-Lauf speichert ihn; daran erkennt der nächste,
   ob sich das Volumen kürzlich geändert hat. */
export function volumenStand(payload, cycle) {
  const stufen = Object.fromEntries(CYCLE_TAGE.map((einheit) => [einheit, tierVon(payload, einheit, cycle)]));
  return { cycle, prioritaet: prioritaetNormalisieren(payload), stufen };
}
const standSchluessel = (stand) => stabilesJson({ prioritaet: stand?.prioritaet || {}, stufen: stand?.stufen || {} });
// Zusätzliche Sätze je passender Einheit durch eine Priorität „plus“.
export const extraSaetze = (stand, muskel) => (stand?.prioritaet?.[muskel]?.modus === 'plus' ? stand.prioritaet[muskel].saetze : 0);

// Gültiger Satz wie in training.js und LOGMANs progression.js.
const satzGueltig = (satz) => String(satz?.w ?? '').trim() !== '' && Number.isFinite(Number(String(satz.w).replace(',', '.')))
  && Number(String(satz?.r ?? '').replace(',', '.')) > 0;

/* Die geplanten Übungen einer Einheit, genau wie LOGMANs Set-O-Meter sie
   zählt (setometer.js): benannte Übungen mit Sätzen > 0 plus Prioritäts-Slots. */
export function geplanteSlots(payload, cycle, tag) {
  const tpl = TPL[tag];
  if (!tpl) return [];
  const tier = tierVon(payload, tag, cycle);
  const zelle = payload?.data?.[tag]?.[cycle] || payload?.data?.[tag]?.[String(cycle)] || {};
  const nameTag = tpl.nameSource || tag;
  const prio = prioritaetsAnpassungen(payload, cycle);
  const slots = [];
  tpl.blocks.forEach((blk) => {
    if (!targetSets(blk, tier)) return;
    const eintrag = zelle[blk.id] || {};
    const frei = blk.type !== 'load' && blk.type !== 'middle';
    const fest = payload?.ex?.[nameTag]?.[blk.id] || [];
    const namen = frei ? (eintrag.names || []) : (fest.some((name) => String(name || '').trim()) ? fest : (eintrag.names || []));
    exOf(blk, tier).forEach((_uebung, xi) => {
      const name = String(namen[xi] || '').trim();
      if (!name) return;
      const anzahl = Math.max(0, setsForExercise(blk, tier, xi) + extraSets(eintrag, tier, xi) + (prio.delta[slotKey(tag, blk.id, xi)] || 0));
      if (anzahl) slots.push({ blockId: blk.id, xi, name, anzahl });
    });
  });
  prio.slots.filter((slot) => slot.tag === tag).forEach((slot) => slots.push({ blockId: slot.blockId, xi: 0, name: '', anzahl: slot.anzahl }));
  return slots;
}

/* Die Priorität, die während eines Zyklus galt. Sicher ist eine Fassung nur
   an den Tagen strikt zwischen ihrem ersten und letzten Sehen (ab, zuletzt):
   An diesen Randtagen und in der Lücke bis zur nächsten Fassung kann die
   Änderung in LOGMAN schon oder noch nicht geschehen sein. Der Zyklus muss
   ganz in einem sicheren Zeitraum liegen, sonst null. */
export function prioritaetImZyklus(spanne, verlauf = []) {
  const treffer = (Array.isArray(verlauf) ? verlauf : []).find((eintrag) => eintrag?.ab && eintrag?.prioritaet
    && String(eintrag.ab) < spanne.von && spanne.bis < String(eintrag.zuletzt || eintrag.ab));
  return treffer ? treffer.prioritaet : null;
}

/* Vergleichbare Zyklen (GPT-Review Schritt 5, Punkt 2), aufsteigend: kein
   Deload, alle vier Einheiten mit Datum, die damalige Vorgabe ist bekannt, und
   jede geplante Übung hat mindestens einen Satz. Nur diese Zyklen gehen in
   Satz-Erfüllung und Leistung ein; eine Lücke in der Protokollierung zählt so
   nie als geringe Erfüllung. */
export function vergleichbareZyklen(payload, einheiten, verlauf = []) {
  const jeZyklus = new Map();
  einheiten.forEach((einheit) => {
    if (istDeload(einheit.cycle)) return;
    if (!jeZyklus.has(einheit.cycle)) jeZyklus.set(einheit.cycle, []);
    jeZyklus.get(einheit.cycle).push(einheit);
  });
  const zyklen = [];
  const ausgeschlossen = [];
  [...jeZyklus.keys()].sort((a, b) => a - b).forEach((cycle) => {
    const liste = jeZyklus.get(cycle);
    const tage = new Set(liste.map((einheit) => einheit.tag));
    if (!CYCLE_TAGE.every((einheit) => tage.has(einheit))) {
      ausgeschlossen.push({ cycle, grund: 'nicht alle vier Einheiten' });
      return;
    }
    const daten = liste.map((einheit) => einheit.datum);
    if (daten.some((datum) => !datum)) {
      ausgeschlossen.push({ cycle, grund: 'Einheiten ohne Datum' });
      return;
    }
    const spanne = { von: [...daten].sort()[0], bis: [...daten].sort().at(-1) };
    const prioritaet = prioritaetImZyklus(spanne, verlauf);
    if (!prioritaet) {
      ausgeschlossen.push({ cycle, grund: 'damalige Vorgabe nicht sicher bekannt' });
      return;
    }
    const damals = mitPrioritaet(payload, prioritaet);
    const luecke = CYCLE_TAGE.some((einheit) => geplanteSlots(damals, cycle, einheit).some((slot) => {
      const saetze = payload?.data?.[einheit]?.[cycle]?.[slot.blockId]?.sets?.[slot.xi]
        || payload?.data?.[einheit]?.[String(cycle)]?.[slot.blockId]?.sets?.[slot.xi] || [];
      return !saetze.some(satzGueltig);
    }));
    if (luecke) {
      ausgeschlossen.push({ cycle, grund: 'nicht vollständig protokolliert' });
      return;
    }
    zyklen.push({ cycle, prioritaet, spanne });
  });
  return { zyklen, ausgeschlossen };
}

/* Erholung, Schlaf und Ernährung der letzten 14 Tage (bis gestern) aus den
   Zeilen, die capboy-coach ohnehin lädt. */
export function fensterWerte(rows, heute) {
  const von = plusTage(heute, -G.fensterTage);
  const bis = plusTage(heute, -1);
  const ohneErnaehrung = (rows.switchedOffAreas || []).includes('nutrition');
  const phaseStart = targetPhaseDay(rows.settings);
  const imFenster = (wert) => { const datum = tag(wert); return datum != null && datum >= von && datum <= bis; };
  const erholung = (rows.checkins || []).filter((zeile) => imFenster(zeile.checkin_date)).map((zeile) => zahl(zeile.recovery)).filter(Boolean);
  const naechte = (rows.sleep || []).filter((zeile) => imFenster(zeile.sleep_date) && zeile.bedtime && zeile.wake_time);
  const tage = new Map();
  (rows.nutritionEntries || []).forEach((zeile) => {
    if (!imFenster(zeile.log_date) || (phaseStart && tag(zeile.log_date) < phaseStart)) return;
    const datum = tag(zeile.log_date);
    const bisher = tage.get(datum) || { kcal: 0, protein: 0 };
    bisher.kcal += zahl(zeile.energy_kcal);
    bisher.protein += zahl(zeile.protein_g);
    tage.set(datum, bisher);
  });
  return {
    von, bis,
    erholung: { werte: erholung.length, mittel: runde(mittel(erholung)) },
    schlaf: {
      naechte: naechte.length,
      minuten: runde(mittel(naechte.map((zeile) => durationMinutes(zeile.bedtime, zeile.wake_time))), 0),
      qualitaet: runde(mittel(naechte.map((zeile) => zahl(zeile.quality)).filter(Boolean))),
    },
    ernaehrung: ohneErnaehrung ? { switchedOff: true } : {
      tage: tage.size,
      kcal: runde(mittel([...tage.values()].map((t) => t.kcal)), 0),
      protein: runde(mittel([...tage.values()].map((t) => t.protein)), 0),
    },
    kalorienZiel: ohneErnaehrung ? null : currentCalorieTarget(rows.settings, rows.weights?.[0]?.kg, new Date(`${heute}T12:00:00Z`)),
    gewichtKg: rows.weights?.[0] ? zahl(rows.weights[0].kg) || null : null,
  };
}

/* Eine Regel für „nicht repräsentativ“, gleich für die Volumensperre, die
   Experimentsperre (wochenBereinigen) und den Prompt (Regel 2): Krank- oder
   Reisetage in der bewerteten Woche oder der Vorwoche, oder ein Umstand aus
   dem Kärtchen (krank, unterwegs, viel Stress, wenig Schlaf, Feier oder
   Urlaub). Gibt die Gründe zurück, leer = repräsentativ. */
const UMSTAND_TEXT = { krank: 'krank', unterwegs: 'unterwegs', stress: 'viel Stress', wenig_schlaf: 'wenig Schlaf', ausnahme: 'Feier oder Urlaub' };
export function nichtRepraesentativ({ wochen = [], kaertchen = null } = {}) {
  const gruende = [];
  const tage = wochen.filter(Boolean).reduce((summe, w) => summe + (w.recovery?.illnessDays || 0) + (w.recovery?.travelDays || 0), 0);
  if (tage > 0) gruende.push('Krank- oder Reisetage');
  (kaertchen?.circumstances || []).forEach((id) => { if (UMSTAND_TEXT[id]) gruende.push(UMSTAND_TEXT[id]); });
  return gruende;
}

/* a) Sperren: Greift eine, bleibt das Volumen für alle Muskeln, wie es ist. */
export function sperrenPruefen({ wochen, kaertchen, training, standJetzt, fruehereStaende = [], vergleichbar, verlauf = [], heute }) {
  const sperren = [];
  const gruende = nichtRepraesentativ({ wochen, kaertchen });
  if (gruende.length) {
    sperren.push({ id: 'nicht-repraesentativ', text: `Die Woche ist nicht repräsentativ (${gruende.join(', ')}).` });
  }
  if (training?.stand?.deload || (training?.stand?.cyclesBisDeload ?? 99) <= G.deloadAbstand) {
    sperren.push({ id: 'deload', text: 'Der Deload läuft oder steht im nächsten Zyklus an; Ermüdung ist dann erwartet.' });
  }
  const grenze = heute ? new Date(Date.parse(`${heute}T00:00:00Z`) - G.aenderungTage * DAY).toISOString().slice(0, 10) : null;
  // Der erste Eintrag im Verlauf ist der Beginn der Aufzeichnung, keine Änderung.
  const prioGeaendert = grenze && (Array.isArray(verlauf) ? verlauf : []).slice(1).some((eintrag) => String(eintrag?.ab || '') >= grenze);
  if (fruehereStaende.length < 2) {
    sperren.push({ id: 'beobachten-start', text: 'Es gibt noch keine zwei Wochen-Läufe mit gespeichertem Volumenstand; erst beobachten.' });
  } else if (prioGeaendert || standSchluessel(standJetzt) !== standSchluessel(fruehereStaende[0]) || standSchluessel(fruehereStaende[0]) !== standSchluessel(fruehereStaende[1])) {
    sperren.push({ id: 'kuerzlich-geaendert', text: 'Das Volumen wurde in den letzten zwei Wochen geändert; LOGMAN-Regel 7 verlangt zwei bis drei Wochen Beobachtung.' });
  }
  const zyklen = vergleichbar?.zyklen || [];
  if (zyklen.length < G.zyklenLeistung) {
    const gruende = [...new Set((vergleichbar?.ausgeschlossen || []).map((eintrag) => eintrag.grund))];
    sperren.push({
      id: 'zu-wenig-zyklen',
      text: `Nur ${zyklen.length} von ${G.zyklenLeistung} nötigen vergleichbaren Zyklen (alle vier Einheiten vollständig protokolliert, damalige Vorgabe bekannt)${gruende.length ? `; ausgeschlossen: ${gruende.join(', ')}` : ''}.`,
    });
  }
  return sperren;
}

/* Erholung „gut“ nur mit genug Werten. Fehlt etwas, heißt es „unbekannt“. */
export function erholungBewerten(fenster, aus = []) {
  const ohneSchlaf = aus.includes('sleep');
  if ((fenster?.erholung?.werte || 0) < G.minWerte || (!ohneSchlaf && (fenster?.schlaf?.naechte || 0) < G.minWerte)) return 'unbekannt';
  const erholt = fenster.erholung.mittel >= G.erholungMin;
  const geschlafen = ohneSchlaf || (fenster.schlaf.minuten >= G.schlafMinuten && fenster.schlaf.qualitaet >= G.schlafQualitaet);
  return erholt && geschlafen ? 'gut' : 'schlecht';
}

export function ernaehrungBewerten(fenster, aus = []) {
  if (aus.includes('nutrition')) return 'aus';
  const { tage, kcal, protein } = fenster?.ernaehrung || {};
  if ((tage || 0) < G.minWerte || !fenster?.kalorienZiel || !fenster?.gewichtKg || kcal == null || protein == null) return 'unbekannt';
  const genugKcal = kcal >= fenster.kalorienZiel * G.kcalAnteil;
  const genugProtein = protein >= fenster.gewichtKg * G.proteinProKg * G.proteinAnteil;
  return genugKcal && genugProtein ? 'passt' : 'passt-nicht';
}

/* Gewicht und Hautfalten aus den abgeschlossenen Wochen der Zeitreihe. */
export function koerperBewerten(abgeschlossen = []) {
  const gewichte = abgeschlossen.slice(-3).map((w) => w.bodyComposition?.averageWeightKg).filter((wert) => wert != null);
  const gewicht = gewichte.length < 2 ? 'unbekannt' : (gewichte.at(-1) - gewichte[0] >= G.gewichtToleranzKg ? 'nicht-fallend' : 'fallend');
  const falte = (w) => w.bodyComposition?.latestSkinfoldSumMm;
  const neu = abgeschlossen.slice(-G.hautfaltenWochen).filter((w) => falte(w) != null).at(-1);
  const vorher = abgeschlossen.slice(0, -G.hautfaltenWochen).filter((w) => falte(w) != null).at(-1);
  const hautfalten = !neu || !vorher ? 'unbekannt' : (falte(neu) - falte(vorher) > G.hautfaltenAnstiegMm ? 'steigend' : 'nicht-steigend');
  return { gewicht, hautfalten, gewichte, hautfaltenMm: neu && vorher ? [falte(vorher), falte(neu)] : null };
}

/* b) Je Muskel über die letzten zwei abgeschlossenen Zyklen. */
export function muskelnBewerten({ payload, einheiten, zyklen, erholung, ernaehrung, koerper }) {
  // zyklen: vergleichbare Zyklen mit ihrer damaligen Priorität. Leistung über
  // die letzten drei, Satz-Erfüllung über die letzten zwei davon.
  const fenster = zyklen.slice(-G.zyklenLeistung);
  const [a, b] = fenster.slice(-G.zyklenErfuellung);
  const z1 = a.cycle;
  const z2 = b.cycle;
  const saetze = (zyklus) => new Map(saetzeJeMuskel(mitPrioritaet(payload, zyklus.prioritaet), einheiten, zyklus.cycle).map((zeile) => [zeile.muskel, zeile]));
  const s1 = saetze(a);
  const s2 = saetze(b);
  const imFenster = new Set(fenster.map((zyklus) => zyklus.cycle));
  const katalog = katalogMitEigenen(payload?.eigeneUebungen, { nurAktive: false, mitGeloeschten: true });
  const hauptmuskel = new Map(katalog.map((eintrag) => [klein(eintrag.n), eintrag.haupt]));
  const jeMuskel = new Map();
  uebungsVerlauf(einheiten.filter((einheit) => imFenster.has(einheit.cycle))).forEach((uebung) => {
    const muskel = hauptmuskel.get(klein(uebung.name));
    if (!muskel) return;
    if (!jeMuskel.has(muskel)) jeMuskel.set(muskel, []);
    jeMuskel.get(muskel).push(uebung);
  });

  return [...s2.keys()].filter((muskel) => s1.get(muskel)?.geplant > 0 && s2.get(muskel)?.geplant > 0).map((muskel) => {
    const erfuellung = [s1.get(muskel), s2.get(muskel)].map((zeile) => runde(zeile.erledigt / zeile.geplant, 2));
    const uebungen = jeMuskel.get(muskel) || [];
    const faellt = uebungen.filter((uebung) => uebung.faelltWiederholt).map((uebung) => uebung.name);
    const stagniert = uebungen.length > 0 && uebungen.every((uebung) => uebung.ohneFortschritt >= G.stillstand);
    const leistung = !uebungen.length ? 'unklar' : (faellt.length ? 'faellt' : (stagniert ? 'stagniert' : 'steigt'));
    const gruende = [
      `Satz-Erfüllung Zyklus ${z1}: ${prozent(erfuellung[0])}, Zyklus ${z2}: ${prozent(erfuellung[1])}`,
      faellt.length ? `fällt wiederholt: ${faellt.join(', ')}` : (stagniert ? `alle Übungen seit mindestens ${G.stillstand} Vergleichen ohne Steigerung` : (uebungen.length ? 'Leistung steigt noch' : 'keine vergleichbare schwere Übung')),
    ];
    let bewertung = 'beibehalten';
    // Reduzieren nur bei wiederholt fallender Leistung (GPT-Review Schritt 5,
    // dritte Runde). Geringe Satz-Erfüllung allein kann auch eine Lücke in der
    // Protokollierung sein: Sie verhindert eine Erhöhung, reduziert aber nicht.
    if (erfuellung.every((anteil) => anteil < G.erfuellungNiedrig)) {
      gruende.push(`Satz-Erfüllung in beiden Zyklen unter ${prozent(G.erfuellungNiedrig)} – erst vollständig protokollieren`);
    }
    if (faellt.length) {
      bewertung = 'reduzieren';
    } else if (leistung === 'stagniert') {
      const fehlt = [
        erfuellung.some((anteil) => anteil < G.erfuellungHoch) && `Satz-Erfüllung unter ${prozent(G.erfuellungHoch)}`,
        erholung !== 'gut' && `Erholung ${erholung}`,
        !['passt', 'aus'].includes(ernaehrung) && `Ernährung ${ernaehrung}`,
        koerper.gewicht !== 'nicht-fallend' && `Gewicht ${koerper.gewicht}`,
        koerper.hautfalten === 'steigend' && 'Hautfalten steigen',
      ].filter(Boolean);
      if (fehlt.length) gruende.push(`keine Erhöhung: ${fehlt.join(', ')}`);
      else bewertung = 'erhoehen';
    }
    return { muskel, haelfte: koerperhaelfte(muskel), bewertung, leistung, erfuellung, gruende };
  });
}

/* c) Nur zulässige LOGMAN-Hebel. */
export function zulaessigeAktionen(muskeln, stand) {
  const aktionen = [BEIBEHALTEN];
  muskeln.forEach(({ muskel, bewertung }) => {
    const extra = extraSaetze(stand, muskel);
    if (bewertung === 'erhoehen' && extra < 2) {
      const neu = extra + 1;
      aktionen.push({
        id: `plus${neu}:${muskel}`, art: 'erhoehen', muskel,
        text: `LOGMAN: Priorität ${muskel} auf „plus“ mit ${neu} ${neu === 1 ? 'Satz' : 'Sätzen'} stellen – je passender Einheit (schwer und leicht) ${neu === 1 ? 'ein Satz' : 'zwei Sätze'}, also +${2 * neu} Sätze je Zyklus.`,
      });
    }
    if (bewertung === 'reduzieren' && extra === 2) {
      aktionen.push({ id: `plus1:${muskel}`, art: 'reduzieren', muskel, text: `LOGMAN: Priorität ${muskel} von „plus 2“ auf „plus 1“ senken – je passender Einheit ein Satz weniger.` });
    }
    if (bewertung === 'reduzieren' && extra === 1) {
      aktionen.push({ id: `prioritaet-aus:${muskel}`, art: 'reduzieren', muskel, text: `LOGMAN: Priorität ${muskel} entfernen – der Extra-Satz je passender Einheit fällt weg.` });
    }
  });
  ['OK', 'UK'].forEach((haelfte) => {
    const ohnePrio = muskeln.filter((m) => m.haelfte === haelfte && m.bewertung === 'reduzieren' && extraSaetze(stand, m.muskel) === 0);
    const einheiten = CYCLE_TAGE.filter((einheit) => einheit.startsWith(`${haelfte}-`));
    const schonKompakt = einheiten.every((einheit) => stand?.stufen?.[einheit] === 0);
    if (ohnePrio.length >= 2 && !schonKompakt) {
      aktionen.push({
        id: `kompakt:${haelfte}`, art: 'reduzieren', haelfte,
        text: `LOGMAN: ${haelfte}-Einheiten (${einheiten.join(', ')}) auf Stufe Kompakt stellen – betrifft alle Muskeln dieser Hälfte (${ohnePrio.map((m) => m.muskel).join(', ')} zeigen Abfall).`,
      });
    }
  });
  return aktionen;
}

/** Die von der KI gewählte Aktion, nur wenn die App sie angeboten hat. */
export const aktionWaehlen = (id, aktionen) => aktionen.find((aktion) => aktion.id === id) || BEIBEHALTEN;

/**
 * Gesamte Volumen-Entscheidung für den Wochen-Lauf.
 * heute: YYYY-MM-DD (Europe/Berlin); timeseries: Zeitreihe von capboy-coach;
 * fenster: fensterWerte(); aus: ausgeschaltete Bereiche; kaertchen: Bericht
 * aus dem Wochen-Kärtchen; fruehereStaende: volumen_stand früherer Wochen-
 * Läufe, neuester zuerst.
 */
export function volumenEntscheidung({ payload, gesehen = {}, heute, timeseries, fenster, aus = [], kaertchen = null, fruehereStaende = [], prioritaetVerlauf = [] }) {
  const einheiten = einheitenAus(payload, gesehen);
  const training = trainingsAuswertung(payload, { gesehen, heute });
  const vergleichbar = vergleichbareZyklen(payload, einheiten, prioritaetVerlauf);
  const zyklen = vergleichbar.zyklen;
  const stand = volumenStand(payload, training.stand.cycle);
  const bewertet = reviewWeeks(timeseries);
  const wochen = [bewertet?.previous || null, bewertet?.current || null];
  const sperren = sperrenPruefen({ wochen, kaertchen, training, standJetzt: stand, fruehereStaende, vergleichbar, verlauf: prioritaetVerlauf, heute });
  const abgeschlossen = (timeseries?.weeks || []).filter((w) => !w.partial && (!bewertet || w.to <= bewertet.current.to));
  const erholung = erholungBewerten(fenster, aus);
  const ernaehrung = ernaehrungBewerten(fenster, aus);
  const koerper = koerperBewerten(abgeschlossen);
  const grundlage = { erholung, ernaehrung, gewicht: koerper.gewicht, hautfalten: koerper.hautfalten, fenster };
  const zyklenNummern = zyklen.slice(-G.zyklenLeistung).map((zyklus) => zyklus.cycle);
  if (sperren.length) return { stand, sperren, zyklen: zyklenNummern, ausgeschlossen: vergleichbar.ausgeschlossen, grundlage, muskeln: [], aktionen: [BEIBEHALTEN] };
  const muskeln = muskelnBewerten({ payload, einheiten, zyklen, erholung, ernaehrung, koerper });
  return { stand, sperren, zyklen: zyklenNummern, ausgeschlossen: vergleichbar.ausgeschlossen, grundlage, muskeln, aktionen: zulaessigeAktionen(muskeln, stand) };
}
