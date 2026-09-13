import { describe, expect, it } from 'vitest';
import {
  assessSkinfoldPriorities,
  buildSkinfoldPlan,
  buildSkinfoldRelationships,
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
  bauch: 22, trizeps: 4, bizeps: 2, knie: 5, wade: 5, quadrizeps: 8, beinbizeps: 8,
};

describe('YPSI-Hautfaltenprioritäten', () => {
  it('priorisiert die auffälligste Protokollgruppe', () => {
    const priorities = assessSkinfoldPriorities(folds, 'male');
    expect(priorities).toHaveLength(5);
    expect(priorities[0]).toMatchObject({ id: 'bauch-brust-trizeps', priority: 1 });
    expect(priorities[0].primaryFold).toMatchObject({ slug: 'bauch', foldPriority: 1 });
    expect(priorities[0].falten).toContain('trizeps');
    expect(priorities[0].protocols.some((protocol) => protocol.phase === 1)).toBe(true);
  });

  it('wertet nur vollständige Messungen aus', () => {
    expect(assessSkinfoldPriorities({ ...folds, bauch: undefined }, 'male')).toEqual([]);
  });

  it('ordnet Bauch plus guten Trizeps dem zu bestätigenden Darmzweig zu', () => {
    const relationships = buildSkinfoldRelationships(folds, 'male');
    expect(relationships.find((item) => item.id === 'bauch-trizeps-darmzweig')).toEqual(expect.objectContaining({
      protocolIds: expect.arrayContaining(['bauch-brust-trizeps-phase-4-chlorella']),
    }));
  });

  it('priorisiert bei gemeinsam auffälligem Bauch und Trizeps zuerst Energie und Stress', () => {
    const relationships = buildSkinfoldRelationships({ ...folds, trizeps: 12 }, 'male');
    expect(relationships.some((item) => item.id === 'bauch-trizeps-energie')).toBe(true);
    expect(relationships.some((item) => item.id === 'bauch-trizeps-darmzweig')).toBe(false);
  });

  it('bildet beide Richtungen des Quad-Ham-Verhältnisses ab', () => {
    const quad = buildSkinfoldRelationships({ ...folds, quadrizeps: 30, beinbizeps: 12 }, 'male');
    const ham = buildSkinfoldRelationships({ ...folds, quadrizeps: 12, beinbizeps: 30 }, 'male');
    expect(quad.find((item) => item.id === 'quad-ueber-ham')?.protocolIds).toContain('quad-beinbizeps-phase-4-glutamin');
    expect(ham.find((item) => item.id === 'ham-ueber-quad')?.protocolIds).toContain('quad-beinbizeps-phase-4-methylkomplex');
  });

  it('steigert eine wiederkehrende Priorität chronologisch und verzweigt erst in Phase 4', () => {
    const history = [1, 2, 3, 4].map((day) => ({ gemessen_am: `2026-0${day}-01`, falten: folds }));
    const plan = buildSkinfoldPlan(history, 'male', { recentEnergy: 4 });
    expect(plan.topFold.slug).toBe('bauch');
    expect(plan.priorities[0]).toMatchObject({ id: 'bauch-brust-trizeps', suggestedPhase: 4, occurrences: 4 });
    expect(plan.priorities[0].recommendedProtocols.map((item) => item.id)).toContain('bauch-brust-trizeps-phase-4-chlorella');
  });

  it('setzt eine zwischenzeitlich andere Priorität nicht als Phase derselben Gruppe fort', () => {
    const legPriority = { ...folds, bauch: 5, brust: 3, trizeps: 4, quadrizeps: 40, beinbizeps: 35 };
    const history = [
      { gemessen_am: '2026-01-01', falten: legPriority },
      { gemessen_am: '2026-02-01', falten: folds },
      { gemessen_am: '2026-03-01', falten: legPriority },
    ];
    const plan = buildSkinfoldPlan(history, 'male');
    expect(plan.priorities[0]).toMatchObject({ id: 'quad-beinbizeps', suggestedPhase: 2, occurrences: 2 });
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
