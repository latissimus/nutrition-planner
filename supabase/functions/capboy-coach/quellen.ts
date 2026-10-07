// Quellen einer Chat-Antwort (COACHING-PLAN.md, Schritt 4b). Gezeigt wird nur,
// was nachweislich in die Antwort einging (GPT-Review 4b, zweite Runde):
// Seminardokumente, die file_search in dieser Anfrage geliefert hat, und
// Webseiten, die die Antwort zitiert. Bloße Suchtreffer sind keine Quelle.
// Reine Funktionen ohne Datenbank, damit Edge Function und Evals
// (scripts/coach-evals/frage-eval.mjs) denselben Code nutzen.

import { KNOWLEDGE_SOURCES } from './knowledge.ts';
import { bewertungQuellen, seminarAnzeigeTitel } from './coachPrompt.ts';

type Row = Record<string, any>;

/* Im Vector Store trägt jede Datei das Kürzel des Wissensstands vorn
   (ensureKnowledgeBase); verglichen wird ohne es. */
const SEMINAR_TITEL = new Map(KNOWLEDGE_SOURCES.map((quelle: Row) => [String(quelle.filename), seminarAnzeigeTitel(String(quelle.title))]));
const ohneKuerzel = (datei: string) => datei.trim().replace(/^[0-9a-f]{12}-/i, '');

export function abgerufeneSeminarDateien(response: Row) {
  const abgerufen = new Set<string>();
  for (const item of response?.output || []) {
    if (item.type !== 'file_search_call') continue;
    for (const treffer of item.results || []) if (treffer?.filename) abgerufen.add(ohneKuerzel(String(treffer.filename)));
  }
  return abgerufen;
}

// Frage: Titel einer vom Modell genannten Datei, wenn sie abgerufen wurde.
export function seminarTitelAus(response: Row) {
  const abgerufen = abgerufeneSeminarDateien(response);
  return (datei: string) => {
    const name = ohneKuerzel(datei);
    return abgerufen.has(name) ? SEMINAR_TITEL.get(name) || name.replace(/\.(pdf|md)\.txt$/, '') : null;
  };
}

// Bewertung: Kandidaten sind die in dieser Anfrage abgerufenen Dokumente.
export function bewertungsQuellenAus(result: Row, response: Row) {
  const abgerufen = abgerufeneSeminarDateien(response);
  return bewertungQuellen(result, KNOWLEDGE_SOURCES.filter((quelle: Row) => abgerufen.has(String(quelle.filename))));
}

/* Webseiten der Antwort. zitiert: Die Antwort verweist darauf (url_citation),
   sie ist eine Quelle. Sonst nur ein Treffer der Websuche: Die App zeigt ihn
   getrennt als „Recherchetreffer“, nicht als Quelle. */
export function webSources(response: Row) {
  const cited: Row[] = [];
  const retrieved: Row[] = [];
  for (const item of response?.output || []) {
    if (item.type === 'web_search_call') {
      for (const source of item.action?.sources || []) retrieved.push(source);
    }
    if (item.type === 'message') {
      for (const content of item.content || []) {
        for (const annotation of content.annotations || []) {
          if (annotation.type !== 'url_citation') continue;
          cited.push(annotation.url_citation || annotation);
        }
      }
    }
  }
  const pruefen = (source: Row, zitiert: boolean) => {
    try {
      const url = new URL(String(source?.url || ''));
      if (!['http:', 'https:'].includes(url.protocol)) return [];
      return [{ title: String(source.title || url.hostname).slice(0, 240), url: url.href, zitiert }];
    } catch {
      return [];
    }
  };
  return [...cited.flatMap((source) => pruefen(source, true)), ...retrieved.flatMap((source) => pruefen(source, false))]
    .filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index).slice(0, 8);
}
