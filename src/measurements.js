// Rechenlogik fuer Hautfalten und Gewicht. Direkt aus dem LOGMAN-Template
// uebernommen und fuer die neue App isoliert.

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
  ['wade', 'Wade'],
  ['quadrizeps', 'Quadrizeps'],
  ['beinbizeps', 'Beinbizeps'],
];

export const zahl = (value) => {
  const number = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
};

export function summe(falten) {
  const werte = FALTEN.map(([key]) => zahl(falten?.[key]));
  if (werte.some((value) => value === null)) return null;
  return Math.round(werte.reduce((total, value) => total + value, 0) * 10) / 10;
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
