// Warnung bei zu grossem Gewichtssprung zwischen zwei Einheiten derselben
// festen Uebung (HEAVYS/MIDDLES). Reine Anzeige: liest Eingaben, veraendert
// weder Daten noch andere Berechnungen.
//
// Schwelle: mindestens +10 % UND mehr als +2,5 kg gegenueber dem schwersten
// Satz vom letzten Mal. 10 % ist die Obergrenze der ACSM-Empfehlung (2–10 %
// pro Steigerung). Sehnen passen sich langsamer an als Muskeln; ein schneller
// Lastanstieg ist der typische Ausloeser einer Sehnenreizung. Die kg-Grenze
// verhindert Fehlalarme bei Kurzhanteln und Kabel, wo schon der kleinste
// Gewichtsschritt 10–25 % ausmacht (20 -> 22,5 kg warnt deshalb nicht).

export const STEIGERUNG_PROZENT = 10;
export const STEIGERUNG_KG = 2.5;
const TOLERANZ = 1e-9;

export function gewichtAus(wert) {
  const n = parseFloat(String(wert ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function schwerstesGewicht(saetze) {
  let max = null;
  (saetze || []).forEach((s) => {
    const w = gewichtAus(s?.w);
    if (w != null && (max == null || w > max)) max = w;
  });
  return max;
}

const auf25 = (n, richtung) => Math[richtung](n / 2.5 + (richtung === 'ceil' ? -TOLERANZ : TOLERANZ)) * 2.5;

export function steigerungsWarnung(vorher, jetzt) {
  const alt = typeof vorher === 'number' ? (vorher > 0 ? vorher : null) : gewichtAus(vorher);
  const neu = gewichtAus(jetzt);
  if (alt == null || neu == null) return null;
  const kg = neu - alt;
  // Toleranz: 175 -> 192,5 sind exakt 10 % und duerfen nicht an einer
  // Gleitkomma-Rundung knapp vorbeirutschen; 2,5 kg bleiben dagegen erlaubt.
  if (kg <= STEIGERUNG_KG + TOLERANZ) return null;
  if (kg * 100 < alt * STEIGERUNG_PROZENT - TOLERANZ) return null;
  const von = auf25(alt * 1.05, 'ceil');
  const bis = Math.max(von, auf25(alt * 1.10, 'floor'));
  return { vorher: alt, jetzt: neu, kg, prozent: Math.round((kg / alt) * 100), von, bis };
}

// Die deutlichste Warnung ueber alle heute eingetragenen Saetze.
export function staerksteSteigerung(vorherSaetze, heuteSaetze) {
  const alt = schwerstesGewicht(vorherSaetze);
  if (alt == null) return null;
  let staerkste = null;
  (heuteSaetze || []).forEach((s) => {
    const w = steigerungsWarnung(alt, s?.w);
    if (w && (!staerkste || w.kg > staerkste.kg)) staerkste = w;
  });
  return staerkste;
}

export const kgText = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

export function steigerungsErklaerung(w) {
  const bereich = w.von === w.bis ? `${kgText(w.von)} kg` : `${kgText(w.von)}–${kgText(w.bis)} kg`;
  return `+${kgText(w.kg)} kg (+${w.prozent} %) gegenüber dem letzten Mal. `
    + 'Muskeln passen sich schneller an als Sehnen – ein großer Sprung kann Sehnen und Bänder '
    + 'überfordern, auch wenn die Kraft reicht. Üblich sind höchstens 10 % pro Steigerung, '
    + `hier also etwa ${bereich}.`;
}
