import { describe, expect, it } from 'vitest';
import { filterKnowledgeItems, KNOWLEDGE_ROOTS, normalizeKnowledgeSearch } from './knowledgeSearch.js';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./knowledgeSearch.js', import.meta.url), 'utf8');

describe('Wissenssuche', () => {
  it('ist auf die fünf Wissensbereiche begrenzt', () => {
    expect(KNOWLEDGE_ROOTS).toEqual(['food-log', 'essen', 'training', 'supps', 'stress']);
    expect(source).not.toContain('>Schließen</a>');
    expect(source).not.toContain('Durchsuche REZEPTE');
    expect(source).toContain("materialIconMarkup('search', 'wissenssuche-lupe')");
    expect(source).toContain('data-search-clear aria-label="Suche leeren" hidden><span aria-hidden="true"></span>');
  });

  it('findet Begriffe unabhängig von Umlauten und Großschreibung', () => {
    expect(normalizeKnowledgeSearch('  ÜBUNGEN & Maß  ')).toBe('ubungen & mass');
  });

  it('verknüpft mehrere Suchwörter und respektiert den Bereichsfilter', () => {
    const items = [
      { rootKey: 'training', searchText: 'Übungen für starke Schultern' },
      { rootKey: 'supps', searchText: 'Kreatin Dosierung Grundlagen' },
    ];
    expect(filterKnowledgeItems(items, 'starke übungen')).toEqual([items[0]]);
    expect(filterKnowledgeItems(items, 'Dosierung', 'training')).toEqual([]);
    expect(filterKnowledgeItems(items, 'Dosierung', 'supps')).toEqual([items[1]]);
  });
});
