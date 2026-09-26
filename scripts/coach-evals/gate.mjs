// Label-Regression und Vergleichs-Gate für den Coach-Eval.
//
// Reine Funktionen ohne API-Aufrufe, damit der Trockenlauf sie vollständig
// prüfen kann. run.mjs holt die Daten und ruft diese Funktionen auf.

import { createHash } from 'node:crypto';
import { pruefe, zahlenBefund } from './checks.mjs';
import { KRITERIEN, kriterienFuer } from './pruefer.mjs';

export const kurzHash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);
export const antwortHash = (antwort) => kurzHash(JSON.stringify(antwort));

// ---------------------------------------------------------------------------
// Label-Regression: Stimmen die menschlich bestätigten Labels noch mit den
// Antworten, den Fällen und dem aktuellen Prüfer überein?
// ---------------------------------------------------------------------------

// Aufbau der Label-Datei gegen ihre Quelle prüfen. quellText ist der rohe
// Dateiinhalt der Antwortdatei (für den quellHash), quelle das geparste JSON.
export function pruefeLabelStruktur({ labels, quelle, quellText, faelle }) {
  const fehler = [];
  if (labels?.schemaVersion !== 1) fehler.push(`unbekannte schemaVersion ${labels?.schemaVersion}`);
  if (labels?.antwortenAus?.quellHash !== kurzHash(quellText)) fehler.push('quellHash passt nicht zur Antwortdatei');
  const lauf = (fall, nummer) => quelle.laeufe.find((eintrag) => eintrag.fall === fall && eintrag.lauf === nummer);
  const gesehen = new Set();

  for (const [index, eintrag] of (labels.semantisch || []).entries()) {
    const ort = `semantisch[${index}] ${eintrag.fall} #${eintrag.lauf} ${eintrag.kriterium}`;
    for (const feld of ['fall', 'lauf', 'antwortHash', 'kriterium', 'label']) {
      if (eintrag[feld] == null || eintrag[feld] === '') fehler.push(`${ort}: Feld ${feld} fehlt`);
    }
    const schluessel = `${eintrag.fall}|${eintrag.lauf}|${eintrag.kriterium}`;
    if (gesehen.has(schluessel)) fehler.push(`${ort}: doppelt`);
    gesehen.add(schluessel);
    if (!['ja', 'nein'].includes(eintrag.label)) fehler.push(`${ort}: Label muss ja oder nein sein`);
    if (!KRITERIEN[eintrag.kriterium]) fehler.push(`${ort}: unbekanntes Kriterium`);
    const fall = faelle.find((kandidat) => kandidat.id === eintrag.fall);
    if (!fall) {
      fehler.push(`${ort}: unbekannter Fall (verwaist)`);
      continue;
    }
    if (!kriterienFuer(fall).some((kandidat) => kandidat.kriterium === eintrag.kriterium)) {
      fehler.push(`${ort}: Kriterium gilt für diesen Fall nicht (verwaist)`);
    }
    const gefunden = lauf(eintrag.fall, eintrag.lauf);
    if (!gefunden?.antwort) fehler.push(`${ort}: Lauf ohne Antwort in der Quelle (verwaist)`);
    else if (antwortHash(gefunden.antwort) !== eintrag.antwortHash) fehler.push(`${ort}: Antwort-Hash passt nicht`);
  }

  const gesehenConfidence = new Set();
  for (const [index, eintrag] of (labels.confidence || []).entries()) {
    const ort = `confidence[${index}] ${eintrag.fall} #${eintrag.lauf}`;
    const schluessel = `${eintrag.fall}|${eintrag.lauf}`;
    if (gesehenConfidence.has(schluessel)) fehler.push(`${ort}: doppelt`);
    gesehenConfidence.add(schluessel);
    const fall = faelle.find((kandidat) => kandidat.id === eintrag.fall);
    const gefunden = lauf(eintrag.fall, eintrag.lauf);
    if (!fall || !gefunden?.antwort) {
      fehler.push(`${ort}: verwaist`);
      continue;
    }
    if (antwortHash(gefunden.antwort) !== eintrag.antwortHash) fehler.push(`${ort}: Antwort-Hash passt nicht`);
    if (gefunden.antwort.confidence !== eintrag.wert) fehler.push(`${ort}: Wert ${eintrag.wert} ≠ Antwort ${gefunden.antwort.confidence}`);
    // Die Prüfung "Sicherheit passend" muss die Angemessenheit so werten wie
    // der Mensch.
    const gewertet = pruefe(fall, gefunden.antwort).find((pruefung) => pruefung.name === 'Sicherheit passend')?.bestanden;
    if (typeof eintrag.angemessen !== 'boolean') fehler.push(`${ort}: Feld angemessen fehlt`);
    else if (gewertet !== eintrag.angemessen) fehler.push(`${ort}: Mensch angemessen=${eintrag.angemessen}, Prüfung wertet ${gewertet}`);
  }
  if (!(labels.semantisch || []).length) fehler.push('keine semantischen Labels');
  return fehler;
}

// Menschliche Labels mit Prüferurteilen vergleichen.
// urteile: Map "fall|lauf" -> [{ kriterium, urteil }]
export function vergleicheLabels(labels, urteile) {
  return (labels.semantisch || []).flatMap((eintrag) => {
    const liste = urteile.get(`${eintrag.fall}|${eintrag.lauf}`);
    const urteil = liste?.find((kandidat) => kandidat.kriterium === eintrag.kriterium)?.urteil;
    if (urteil === eintrag.label) return [];
    return [`${eintrag.fall} #${eintrag.lauf} ${eintrag.kriterium}: Mensch ${eintrag.label}, Prüfer ${urteil ?? 'kein Urteil'}`];
  });
}

// ---------------------------------------------------------------------------
// Vergleichs-Gate: Darf eine neue Variante die Legacy-Baseline ersetzen?
// Bedingungen (Review vom 26.09.):
//   1. Gesamtsumme mindestens wie die Baseline
//   2. kein Fall schlechter als in der Baseline
//   3. keine harte Prüfung scheitert in einem Fall öfter als in der Baseline
//      (Sicherheit, Zahlen, Schema, Regeln und Prüferurteile)
//   4. die menschlichen Labels stimmen mit dem eingesetzten Prüfer überein
//   5. kein Urteil "unklar"
//   6. alle Prüferurteile von einem gültig kalibrierten Modellstand
//   7. insgesamt nicht mehr Zahlen ohne erkennbare Messgröße als die Baseline
//      (Review vom 26.09.: sonst kann ein Prompt die Zahlenprüfung durch
//      bloßes Umformatieren abschwächen). Je Fall nur angezeigt.
// Dazu muss der Vergleich fair sein: gleiche Fälle, gleiche Testdaten,
// gleicher Prüfer, gleich viele Läufe je Fall, und bis auf den Prompt die
// gleiche Anfrage (Modell, Einstellungen, Schema, Seminarwissen). Ein anderer
// ausgelieferter Modellstand lässt sich nicht verhindern und wird als Hinweis
// vermerkt.
// ---------------------------------------------------------------------------

// Wie oft jede harte Prüfung in diesen Läufen scheitert; ein abgebrochener
// Lauf zählt als eigene Prüfung "Lauf abgebrochen".
function harteFehlschlaege(laeufe) {
  const zaehler = new Map();
  const zaehle = (name) => zaehler.set(name, (zaehler.get(name) || 0) + 1);
  for (const lauf of laeufe) {
    if (!lauf.antwort) zaehle('Lauf abgebrochen');
    for (const pruefung of lauf.pruefungen || []) {
      if (!pruefung.weich && !pruefung.bestanden) zaehle(pruefung.name);
    }
  }
  return zaehler;
}

// Zahlen ohne erkennbare Messgröße, mit dem aktuellen Zahlenabgleich für
// beide Seiten neu gezählt - so vergleicht das Gate Gleiches mit Gleichem.
function ungebundeneZahlen(laeufe, faelle) {
  return laeufe.reduce((summe, lauf) => {
    const fall = faelle.find((kandidat) => kandidat.id === lauf.fall);
    return summe + (fall && lauf.antwort ? zahlenBefund(fall, lauf.antwort).ungebunden.length : 0);
  }, 0);
}

export function vergleicheMitBaseline({ baseline, neu, labelNachweis, faelle }) {
  const gruende = [];
  const zahl = (datei) => datei.laeufe.filter((lauf) => lauf.bestanden).length;

  if (baseline.reproduktion?.faelleHash !== neu.reproduktion?.faelleHash) gruende.push('Testfälle unterscheiden sich von der Baseline (faelleHash)');
  if (!baseline.reproduktion?.datenVerifiziert || !neu.reproduktion?.datenVerifiziert) gruende.push('Testdaten nicht nachweisbar (datenVerifiziert)');
  if (JSON.stringify(baseline.reproduktion?.datenHashes) !== JSON.stringify(neu.reproduktion?.datenHashes)) gruende.push('Testdaten unterscheiden sich von der Baseline (datenHashes)');
  // Läufe ohne Antwort zuerst nennen: Sie sagen nichts über den Prompt.
  const ohneAntwort = neu.laeufe.filter((lauf) => !lauf.antwort);
  if (ohneAntwort.length) {
    gruende.push(`${ohneAntwort.length} von ${neu.laeufe.length} Läufen ohne Antwort (${[...new Set(ohneAntwort.map((lauf) => lauf.fehler || 'unbekannt'))].join('; ')}) – das sagt nichts über den Prompt`);
  }
  // Ohne Prüfer greift Bedingung 6; hier nur ein abweichender Prüfer.
  if (neu.pruefer && baseline.pruefer?.fingerabdruck !== neu.pruefer.fingerabdruck) gruende.push('Baseline und neue Variante wurden mit verschiedenen Prüfern bewertet');
  if (!baseline.pruefer?.vertrauenswuerdig) gruende.push('Baseline wurde nicht mit vertrauenswürdigem Prüfer bewertet');
  const alt = baseline.reproduktion || {};
  const jetzt = neu.reproduktion || {};
  for (const [feld, name] of [['angefragtesModell', 'Coach-Modell'], ['einstellungen', 'Einstellungen'], ['schemaHash', 'Antwortschema'], ['vectorStoreId', 'Seminarwissen'], ['wissensstand', 'Wissensstand']]) {
    if (JSON.stringify(alt[feld] ?? null) !== JSON.stringify(jetzt[feld] ?? null)) gruende.push(`${name} unterscheidet sich von der Baseline (${feld})`);
  }
  const hinweise = [];
  if (JSON.stringify(alt.tatsaechlicheModelle || []) !== JSON.stringify(jetzt.tatsaechlicheModelle || [])) {
    hinweise.push(`ausgelieferter Modellstand: Baseline ${(alt.tatsaechlicheModelle || []).join(', ') || '–'}, jetzt ${(jetzt.tatsaechlicheModelle || []).join(', ') || '–'}`);
  }

  // 1
  if (zahl(neu) < zahl(baseline)) gruende.push(`Gesamt ${zahl(neu)}/${neu.laeufe.length} schlechter als Baseline ${zahl(baseline)}/${baseline.laeufe.length}`);
  // 2 und 3
  const fallIds = [...new Set(baseline.laeufe.map((lauf) => lauf.fall))];
  const jeFall = fallIds.map((fall) => {
    const vorher = baseline.laeufe.filter((lauf) => lauf.fall === fall);
    const nachher = neu.laeufe.filter((lauf) => lauf.fall === fall);
    const altBestanden = vorher.filter((lauf) => lauf.bestanden).length;
    const neuBestanden = nachher.filter((lauf) => lauf.bestanden).length;
    const altFehler = harteFehlschlaege(vorher);
    const regressionen = [...harteFehlschlaege(nachher)]
      .filter(([name, anzahl]) => anzahl > (altFehler.get(name) || 0))
      .map(([name, anzahl]) => `${name} ${altFehler.get(name) || 0}→${anzahl}`);
    if (nachher.length !== vorher.length) gruende.push(`${fall}: ${nachher.length} Läufe, Baseline ${vorher.length}`);
    if (neuBestanden < altBestanden) gruende.push(`${fall}: ${neuBestanden}/${nachher.length} schlechter als Baseline ${altBestanden}/${vorher.length}`);
    if (regressionen.length) gruende.push(`${fall}: harte Prüfung scheitert öfter – ${regressionen.join(', ')}`);
    const ungebunden = { alt: ungebundeneZahlen(vorher, faelle), neu: ungebundeneZahlen(nachher, faelle) };
    return { fall, alt: `${altBestanden}/${vorher.length}`, neu: `${neuBestanden}/${nachher.length}`, regressionen, ungebunden };
  });
  const zusaetzlich = [...new Set(neu.laeufe.map((lauf) => lauf.fall))].filter((fall) => !fallIds.includes(fall));
  if (zusaetzlich.length) gruende.push(`Fälle ohne Baseline: ${zusaetzlich.join(', ')}`);
  // 4
  if (!labelNachweis?.gueltig) gruende.push(`Label-Regression fehlt oder ungültig: ${(labelNachweis?.gruende || []).join('; ') || 'kein Nachweis'}`);
  // 5
  const unklar = neu.laeufe.flatMap((lauf) => (lauf.modellUrteile || []).filter((urteil) => urteil.urteil === 'unklar').map((urteil) => `${lauf.fall} #${lauf.lauf} ${urteil.kriterium}`));
  if (unklar.length) gruende.push(`unklare Urteile: ${unklar.join(', ')}`);
  // 7
  const ungebunden = { baseline: ungebundeneZahlen(baseline.laeufe, faelle), neu: ungebundeneZahlen(neu.laeufe, faelle) };
  if (ungebunden.neu > ungebunden.baseline) gruende.push(`mehr Zahlen ohne erkennbare Messgröße: ${ungebunden.neu}, Baseline ${ungebunden.baseline}`);
  // 6
  if (!neu.pruefer?.vertrauenswuerdig) gruende.push(`Prüfer nicht vertrauenswürdig: ${(neu.pruefer?.gruende || []).join('; ') || 'nicht eingesetzt'}`);

  return { bestanden: gruende.length === 0, gruende, hinweise, ungebunden, jeFall, gesamt: { baseline: zahl(baseline), neu: zahl(neu), von: neu.laeufe.length } };
}
