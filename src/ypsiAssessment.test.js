import { describe, expect, it } from 'vitest';
import {
  assessSkinfoldPriorities,
  bravermanComplete,
  bravermanRecommendations,
  bravermanSeverity,
  scoreBravermanAssessment,
  supplementName,
  supplementSafety,
} from './ypsiAssessment.js';
import { BRAVERMAN_DEFIZIT_FRAGEN } from './data/braverman-test.js';

const folds = {
  kinn: 4, wange: 4, brust: 3, ruecken: 8, rippe: 5, huefte: 9,
  bauch: 22, trizeps: 4, bizeps: 2, wade: 5, quadrizeps: 8, beinbizeps: 8,
};

describe('YPSI-Hautfaltenprioritäten', () => {
  it('priorisiert die auffälligste Protokollgruppe', () => {
    const priorities = assessSkinfoldPriorities(folds, 'male');
    expect(priorities).toHaveLength(4);
    expect(priorities[0]).toMatchObject({ id: 'bauch-brust', priority: 1 });
    expect(priorities[0].protocols.some((protocol) => protocol.phase === 1)).toBe(true);
  });

  it('wertet nur vollständige Messungen aus', () => {
    expect(assessSkinfoldPriorities({ ...folds, bauch: undefined }, 'male')).toEqual([]);
  });
});

describe('Braverman-Defizitprofil', () => {
  it('verwendet die Schwellen der Vorlage', () => {
    expect(bravermanSeverity(5).id).toBe('minor');
    expect(bravermanSeverity(6).id).toBe('moderate');
    expect(bravermanSeverity(16).id).toBe('major');
  });

  it('erkennt ein vollständig beantwortetes Profil und den höchsten Fokus', () => {
    const answers = Object.fromEntries(Object.entries(BRAVERMAN_DEFIZIT_FRAGEN)
      .map(([key, questions]) => [key, questions.map((_, index) => key === 'gaba' && index < 18)]));
    expect(bravermanComplete(answers)).toBe(true);
    expect(scoreBravermanAssessment(answers).focus).toBe('gaba');
  });

  it('liefert lesbare Supplementnamen und Sicherheitshinweise', () => {
    expect(supplementName('ginkgo-biloba')).toBe('Ginkgo biloba');
    const result = bravermanRecommendations('serotonin', 'major');
    expect(result.supplements.find((item) => item.slug === 'johanniskraut')).toEqual(expect.objectContaining({
      dose: '600 mg',
      safety: expect.stringContaining('Wechselwirkungen'),
    }));
    expect(supplementSafety('licorice-komplex')).toContain('Blutdruck');
    expect(supplementSafety('biotics-adp')).toContain('Durchfall');
  });
});
