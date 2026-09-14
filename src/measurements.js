// Rechenlogik fuer Hautfalten und Gewicht. Direkt aus dem LOGMAN-Template
// uebernommen und fuer die neue App isoliert.
import { kfaSumme, SUMMEN_FALTEN } from './ypsiFormel.js';

// Alle dreizehn Messpunkte. Gemessen und im Ranking verwendet werden sie alle;
// in die Summe gehen nur die zehn aus SUMMEN_FALTEN ein (siehe summe()).
export const FALTEN = [
  ['kinn', 'Kinn'],
  ['wange', 'Wange'],
  ['brust', 'Brust'],
  ['ruecken', 'Rücken'],
  ['rippe', 'Rippe'],
  ['huefte', 'Hüfte'],
  ['bauch', 'Bauch'],
  ['trizeps', 'Trizeps'],
  ['bizeps', 'Bizeps'],
  ['knie', 'Knie'],
  ['wade', 'Wade'],
  ['quadrizeps', 'Quadrizeps'],
  ['beinbizeps', 'Beinbizeps'],
];

export const zahl = (value) => {
  const number = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
};

/* Faltensumme nach der YPSI-Vorlage: nur Kinn bis Wade (SUM(J:S) im Sheet).
   Quadrizeps, Beinbizeps und Bizeps bleiben bewusst draussen, damit die Summe
   und die daraus abgeleitete Koerperfettformel zusammenpassen. */
export function summe(falten) {
  return kfaSumme(falten);
}

export const heute = () => new Date().toISOString().slice(0, 10);

export const datumKurz = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

export function schnitt7(points) {
  const tag = (iso) => Math.floor(new Date(`${iso}T12:00:00`).getTime() / 86400000);
  return points.map((point, index) => {
    const bis = tag(point.datum);
    const fenster = points.slice(0, index + 1).filter((candidate) => bis - tag(candidate.datum) < 7);
    return {
      datum: point.datum,
      kg: fenster.reduce((total, candidate) => total + candidate.kg, 0) / fenster.length,
    };
  });
}
