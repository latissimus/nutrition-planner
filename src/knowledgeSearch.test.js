import { describe, expect, it } from 'vitest';
import { filterKnowledgeItems, KNOWLEDGE_ROOTS, normalizeKnowledgeSearch } from './knowledgeSearch.js';

describe('Wissenssuche', () => {
  it('ist auf die fünf Wissensbereiche begrenzt', () => {
    expect(KNOWLEDGE_ROOTS).toEqual(['food-log', 'essen', 'training', 'supps', 'stress']);
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
