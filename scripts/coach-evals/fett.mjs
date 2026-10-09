// Gemeinsame Vorprüfung „Kernaussagen fett“ für Frage, Tages- und
// Wochen-Coaching (GPT-Nach-Review 09.10.2026). Nur weiche Hinweise, kein
// Fehlschlag: Sie erkennen nicht jede falsch gesetzte Stelle, die Antworten
// werden zusätzlich von Hand gelesen (Quellenetiketten, Sicherheitsfälle).

const FETT = /\*\*([^*\n]+)\*\*/g;
export const fettStellen = (text = '') => [...String(text ?? '').matchAll(FETT)].map((treffer) => treffer[1]);

// Fett gehört an die Aussage selbst, nicht an Etiketten, Quellen oder Dosen.
const DOSIS = /^\s*(?:ca\.\s*)?[\d.,]+(?:\s*[–-]\s*[\d.,]+)?\s*(?:mg|µg|mcg|g|ml|IE|IU)\b/i;
export function falschFett(stelle, laengeMax) {
  if (/\[|\]\(|https?:|\.pdf|\.md\b/i.test(stelle)) return `Etikett oder Quelle fett: „${stelle}“`;
  if (DOSIS.test(stelle)) return `Dosis fett: „${stelle}“`;
  if (stelle.length > laengeMax) return `fette Stelle zu lang (${stelle.length} Zeichen)`;
  return null;
}

/** Frage-Antwort (frageBereinigen): ein bis zwei Stellen in answer, sonst nirgends. */
export function fettBefundFrage(ergebnis) {
  const stellen = fettStellen(ergebnis.answer);
  return [
    ...(stellen.length ? [] : ['keine Kernaussage fett']),
    ...(stellen.length > 2 ? [`${stellen.length} fette Stellen (höchstens 2)`] : []),
    ...stellen.map((stelle) => falschFett(stelle, 160)).filter(Boolean),
    ...(`${ergebnis.safetyNote}${ergebnis.followUpQuestion}`.includes('**') ? ['Fett im Sicherheitshinweis oder in der Rückfrage'] : []),
  ];
}

/** Tages- und Wochen-Coaching (COACHING_FETT): roh = Modellantwort vor dem
    Bereinigen, ergebnis = bereinigt. Je Punkt und im Fokus höchstens eine
    kurze Stelle; Überschrift (Push) und alle übrigen Felder ohne Fett. */
export function fettBefundCoaching(roh, ergebnis) {
  const texte = [...(ergebnis.punkte || []).map((punkt) => punkt.text), ...(ergebnis.fokus ? [ergebnis.fokus.text] : [])];
  const { ueberschrift, punkte, fokus, ...uebrige } = roh || {};
  return [
    ...(String(ueberschrift || '').includes('**') ? ['Überschrift fett gesetzt (Push; wird entfernt)'] : []),
    ...(texte.some((text) => fettStellen(text).length) ? [] : ['keine Kernaussage fett']),
    ...(texte.some((text) => fettStellen(text).length > 1) ? ['mehr als eine fette Stelle in einem Text'] : []),
    ...texte.flatMap(fettStellen).map((stelle) => falschFett(stelle, 80)).filter(Boolean),
    ...(JSON.stringify(uebrige).includes('**') ? ['Fett außerhalb von Punkten und Fokus'] : []),
  ];
}
