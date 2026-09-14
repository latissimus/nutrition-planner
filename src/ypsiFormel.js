/* Die Körperfett- und Rangformeln aus Formel.xlsx (YPSI), unverändert übernommen.
   Die Konstanten und Referenzwerte liegen in ypsi-formel.json; hier steht nur die
   Rechenlogik. Alle Funktionen sind rein und ohne DOM-Bezug. */
import formelDaten from './data/ypsi-formel.json';

const { konstanten: K, referenzen, summenfalten } = formelDaten;

export const SUMMEN_FALTEN = Object.freeze([...summenfalten.slugs]);

const zahl = (value) => {
  if (value == null) return null;
  const text = String(value).replace(',', '.').trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

export function geschlechtSchluessel(calculationBasis) {
  return calculationBasis === 'female' ? 'frau' : 'mann';
}

/* SUM(J:S) der Vorlage: Kinn bis Wade. Oberschenkel und Bizeps bleiben bewusst
   draußen, gehen aber weiterhin ins Ranking ein. */
export function kfaSumme(falten = {}) {
  const ersterWert = zahl(falten?.[SUMMEN_FALTEN[0]]);
  if (ersterWert == null) return null;
  return SUMMEN_FALTEN.reduce((total, slug, index) => {
    if (index === 0) return total + ersterWert;
    // Excel-SUM ignoriert leere bzw. nichtnumerische Zellen und behandelt sie
    // damit innerhalb des Bereichs wie null.
    return total + (zahl(falten?.[slug]) ?? 0);
  }, 0);
}

/* Schritt 1: aus Größe und Gewicht erwartete Faltensumme. */
export function erwarteteFaltensumme(groesseCm, gewichtKg) {
  const groesse = zahl(groesseCm);
  const gewicht = zahl(gewichtKg);
  if (!groesse || !gewicht || groesse <= 0 || gewicht <= 0) return null;
  return (K.J8 * groesse ** K.J9) * gewicht ** K.J10 + K.J7;
}

/* Schritt 2 und 3: Betrag der Abweichung, daraus der Körperfettanteil in Prozent.
   Die Formel ist wegen ABS V-förmig – eine Summe unter der Erwartung erhöht den
   Wert genauso wie eine darüber. Das Geschlecht geht nicht ein. */
export function koerperfettAnteil({ groesseCm, gewichtKg, falten, summe }) {
  const groesse = zahl(groesseCm);
  const gewicht = zahl(gewichtKg);
  const istSumme = summe != null ? zahl(summe) : kfaSumme(falten);
  const erwartet = erwarteteFaltensumme(groesse, gewicht);
  if (istSumme == null || erwartet == null) return null;
  const abweichung = Math.abs(istSumme - erwartet);
  const prozent = K.O10
    * ((K.K9 * gewicht ** K.K10) * (K.L9 * groesse ** K.L10) * abweichung ** K.M10)
    + K.P10;
  return Number.isFinite(prozent) ? prozent : null;
}

export function magermasse(gewichtKg, kfaProzent) {
  const gewicht = zahl(gewichtKg);
  const kfa = zahl(kfaProzent);
  if (!gewicht || kfa == null) return null;
  return gewicht * (1 - kfa / 100);
}

/* Tracking!C14: Alter in vollen Jahren am Messdatum. Entspricht
   DATEDIF(Person!C22, B14, "y"). */
export function alterAmMessdatum(geburtsdatum, messdatum) {
  if (!geburtsdatum || !messdatum) return null;
  const geburt = new Date(`${geburtsdatum}T12:00:00`);
  const messung = new Date(`${messdatum}T12:00:00`);
  if (Number.isNaN(geburt.getTime()) || Number.isNaN(messung.getTime()) || messung < geburt) return null;
  let alter = messung.getFullYear() - geburt.getFullYear();
  if (messung.getMonth() < geburt.getMonth()
    || (messung.getMonth() === geburt.getMonth() && messung.getDate() < geburt.getDate())) alter -= 1;
  return alter;
}

/* Rangformel der Vorlage: |Wert / 4 − MITTEL| absteigend, Rang 1 = größte
   Abweichung. Die Vorlage unterscheidet nicht, ob die Abweichung nach oben oder
   unten geht; `richtung` hält das als Zusatzinformation fest, ohne den Rang zu
   verändern.

   Die Rangvergabe bildet Grafik!D51 nach: dort wird der Score der Reihe nach
   gegen LARGE(1..13) geprüft und die erste Übereinstimmung gewinnt. Gleiche
   Scores bekommen dadurch denselben Rang, und die folgenden Ränge werden
   übersprungen (zwei Erste, dann Rang 3). Der Score bleibt dafür ungerundet –
   gerundet würden Beinahe-Gleichstände zu echten, die Excel nicht kennt. */
export function faltenRang(falten = {}, calculationBasis = 'male') {
  const geschlecht = geschlechtSchluessel(calculationBasis);
  const tabelle = referenzen[geschlecht];
  const bewertet = Object.entries(tabelle)
    .map(([slug, referenz]) => {
      const wert = zahl(falten?.[slug]);
      if (wert == null || wert < 0) return null;
      const skaliert = wert / 4;
      // Grafik!D45:P45 bzw. D48:P48 verwenden eine geteilte
      // AVERAGE(MIN,MAX)-Formel. Auch der Mittelwert wird daher berechnet und
      // nicht aus einem gerundeten Anzeigewert übernommen.
      const mittel = (referenz.min + referenz.max) / 2;
      return {
        slug,
        wert,
        referenz: mittel,
        referenzMin: referenz.min,
        referenzMax: referenz.max,
        score: Math.abs(skaliert - mittel),
        richtung: skaliert > mittel ? 'ueber' : skaliert < mittel ? 'unter' : 'exakt',
      };
    })
    .filter(Boolean);
  const absteigend = bewertet.map((eintrag) => eintrag.score).sort((a, b) => b - a);
  return bewertet
    .map((eintrag) => ({ ...eintrag, rang: absteigend.indexOf(eintrag.score) + 1 }))
    .sort((a, b) => a.rang - b.rang || b.score - a.score);
}

/* Komplette Auswertung einer Messung. Die IF-Wächter der Vorlage werden in den
   Einzelfunktionen abgebildet; gerundet wird ausschließlich bei der Anzeige. */
export function auswertung({ falten, groesseCm, gewichtKg, calculationBasis = 'male' }) {
  const summe = kfaSumme(falten);
  const erwartet = erwarteteFaltensumme(groesseCm, gewichtKg);
  const kfa = koerperfettAnteil({ groesseCm, gewichtKg, summe });
  return {
    summe,
    erwarteteSumme: erwartet,
    abweichung: summe != null && erwartet != null ? summe - erwartet : null,
    koerperfett: kfa,
    magermasse: magermasse(gewichtKg, kfa),
    raenge: faltenRang(falten, calculationBasis),
  };
}
