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
  const werte = SUMMEN_FALTEN.map((slug) => zahl(falten?.[slug]));
  if (werte.some((wert) => wert == null || wert < 0)) return null;
  return Math.round(werte.reduce((total, wert) => total + wert, 0) * 10) / 10;
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
  return Number.isFinite(prozent) ? Math.round(prozent * 100) / 100 : null;
}

export function magermasse(gewichtKg, kfaProzent) {
  const gewicht = zahl(gewichtKg);
  const kfa = zahl(kfaProzent);
  if (!gewicht || kfa == null) return null;
  return Math.round(gewicht * (1 - kfa / 100) * 10) / 10;
}

/* Rangformel der Vorlage: |Wert / 4 − MITTEL| absteigend, Rang 1 = größte
   Abweichung. Die Vorlage unterscheidet nicht, ob die Abweichung nach oben oder
   unten geht; `richtung` hält das als Zusatzinformation fest, ohne den Rang zu
   verändern. */
export function faltenRang(falten = {}, calculationBasis = 'male') {
  const geschlecht = geschlechtSchluessel(calculationBasis);
  const tabelle = referenzen[geschlecht];
  const bewertet = Object.entries(tabelle)
    .map(([slug, referenz]) => {
      const wert = zahl(falten?.[slug]);
      if (wert == null || wert < 0) return null;
      const skaliert = wert / 4;
      const score = Math.abs(skaliert - referenz.mittel);
      return {
        slug,
        wert,
        referenz: referenz.mittel,
        referenzMin: referenz.min,
        referenzMax: referenz.max,
        score: Math.round(score * 10000) / 10000,
        richtung: skaliert > referenz.mittel ? 'ueber' : skaliert < referenz.mittel ? 'unter' : 'exakt',
      };
    })
    .filter(Boolean);
  return bewertet
    .sort((a, b) => b.score - a.score)
    .map((eintrag, index) => ({ ...eintrag, rang: index + 1 }));
}

/* Komplette Auswertung einer Messung. Gibt null zurück, solange Größe, Gewicht
   oder eine der zehn Summenfalten fehlen – geschätzt wird nichts. */
export function auswertung({ falten, groesseCm, gewichtKg, calculationBasis = 'male' }) {
  const summe = kfaSumme(falten);
  const erwartet = erwarteteFaltensumme(groesseCm, gewichtKg);
  const kfa = koerperfettAnteil({ groesseCm, gewichtKg, summe });
  return {
    summe,
    erwarteteSumme: erwartet == null ? null : Math.round(erwartet * 10) / 10,
    abweichung: summe != null && erwartet != null ? Math.round((summe - erwartet) * 10) / 10 : null,
    koerperfett: kfa,
    magermasse: magermasse(gewichtKg, kfa),
    raenge: faltenRang(falten, calculationBasis),
  };
}
