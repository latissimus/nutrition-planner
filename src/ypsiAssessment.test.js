import { describe, expect, it } from 'vitest';
import {
  assessSkinfoldPriorities,
  assessSkinfoldFactors,
  buildSkinfoldPlan,
  buildSkinfoldActionPlan,
  buildSkinfoldRelationships,
  buildNeurotransmitterCoachPlan,
  bravermanComplete,
  bravermanRecommendations,
  bravermanSeverity,
  scoreBravermanAssessment,
  supplementName,
  supplementSafety,
} from './ypsiAssessment.js';
import { BRAVERMAN_DEFIZIT_FRAGEN } from './data/braverman-test.js';
import hautfaltenData from './data/hautfalten.json';
import supplementKatalog from './data/supplements-katalog.json';
import ypsiProtokolle from './data/ypsi-protokolle.json';
import hautfaltenFaktoren from './data/hautfalten-faktoren.json';

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

  it('ordnet Bauch plus guten Trizeps erst nach bestätigtem Kontext dem Darmzweig zu', () => {
    const unchecked = buildSkinfoldRelationships(folds, 'male');
    expect(unchecked.find((item) => item.id === 'bauch-trizeps-darmzweig')).toEqual(expect.objectContaining({
      protocolIds: [],
      requiresConfirmation: true,
    }));
    const confirmed = buildSkinfoldRelationships(folds, 'male', undefined, { wakesFit: true, digestiveSymptoms: true });
    expect(confirmed.find((item) => item.id === 'bauch-trizeps-darmzweig')).toEqual(expect.objectContaining({
      protocolIds: expect.arrayContaining(['bauch-brust-trizeps-phase-4-chlorella']),
      requiresConfirmation: false,
    }));
  });

  it('priorisiert bei gemeinsam auffälligem Bauch und Trizeps zuerst Energie und Stress', () => {
    const relationships = buildSkinfoldRelationships({ ...folds, trizeps: 12 }, 'male');
    expect(relationships.some((item) => item.id === 'bauch-trizeps-energie')).toBe(true);
    expect(relationships.some((item) => item.id === 'bauch-trizeps-darmzweig')).toBe(false);
  });

  it('bildet beide Richtungen des Quad-Ham-Verhältnisses ab', () => {
    const quad = buildSkinfoldRelationships({ ...folds, quadrizeps: 30, beinbizeps: 12 }, 'male', undefined, { digestiveSymptoms: true });
    const ham = buildSkinfoldRelationships({ ...folds, quadrizeps: 12, beinbizeps: 30 }, 'male');
    expect(quad.find((item) => item.id === 'quad-ueber-ham')?.protocolIds).toContain('quad-beinbizeps-phase-4-glutamin');
    expect(ham.find((item) => item.id === 'ham-ueber-quad')?.protocolIds).toContain('quad-beinbizeps-phase-4-methylkomplex');
  });

  it('wertet beim Quad-Ham-Verhältnis auch kleine echte Unterschiede aus', () => {
    const result = buildSkinfoldRelationships({ ...folds, quadrizeps: 20, beinbizeps: 20.1 }, 'male');
    expect(result.some((item) => item.id === 'ham-ueber-quad')).toBe(true);
  });

  it('zeigt bei priorisiertem Beinbizeps Knie und Wade als zusätzliche Gegenprüfungen', () => {
    const legFolds = { ...folds, bauch: 4, quadrizeps: 18.4, beinbizeps: 40, knie: 12, wade: 14 };
    const relationships = buildSkinfoldRelationships(legFolds, 'male');
    const context = relationships.find((item) => item.id === 'beinbizeps-knie-wade-kontext');
    expect(context).toMatchObject({
      groupIds: ['quad-beinbizeps'],
      protocolIds: [],
    });
    expect(context.summary).toContain('Leber-Phase 2');
    expect(context.summary).toContain('Tiefschlaf');
    expect(context.summary).toContain('Leber-Phase 1');
  });

  it('steigert eine wiederkehrende Priorität chronologisch und verzweigt erst in Phase 4', () => {
    const history = [1, 2, 3, 4].map((day) => ({ gemessen_am: `2026-0${day}-01`, falten: folds }));
    const plan = buildSkinfoldPlan(history, 'male', { wakesFit: true, digestiveSymptoms: true });
    expect(plan.topFold.slug).toBe('bauch');
    expect(plan.priorities[0]).toMatchObject({ id: 'bauch-brust-trizeps', suggestedPhase: 4, occurrences: 4 });
    expect(plan.priorities[0].recommendedProtocols.map((item) => item.id)).toContain('bauch-brust-trizeps-phase-4-chlorella');
  });

  it('wählt in Phase 4 ohne bestätigenden Kontext keine beliebige Variante', () => {
    const history = [1, 2, 3, 4].map((month) => ({ gemessen_am: `2026-0${month}-01`, falten: folds }));
    const plan = buildSkinfoldPlan(history, 'male');
    expect(plan.activeProtocolGroup).toMatchObject({ suggestedPhase: 4, occurrences: 4 });
    expect(plan.activeProtocolGroup.recommendedProtocols).toEqual([]);
  });

  it('bleibt bei Gruppen ohne weitere dokumentierte Phase beim letzten belegten Schritt', () => {
    const hipPriority = { ...folds, bauch: 4, huefte: 100 };
    const kneePriority = { ...folds, bauch: 4, knie: 100 };
    const history = (values, count) => Array.from({ length: count }, (_, index) => ({
      gemessen_am: `2026-0${index + 1}-01`,
      falten: values,
    }));
    const hip = buildSkinfoldPlan(history(hipPriority, 4), 'male').activeProtocolGroup;
    const knee = buildSkinfoldPlan(history(kneePriority, 2), 'male').activeProtocolGroup;
    expect(hip).toMatchObject({ id: 'huefte', suggestedPhase: 3, holdsAtLastDocumentedPhase: true });
    expect(knee).toMatchObject({ id: 'knie', suggestedPhase: 1, holdsAtLastDocumentedPhase: true });
  });

  it('bildet die Gegenprüfungen für Rücken, Rippe, Knie und Bizeps ausführbar ab', () => {
    const scenarios = [
      ['ruecken', 'ruecken-gegenpruefung'],
      ['rippe', 'rippe-gegenpruefung'],
      ['knie', 'knie-oberschenkel'],
      ['bizeps', 'bizeps-trizeps-schlaf'],
    ];
    scenarios.forEach(([slug, relationId]) => {
      const relationships = buildSkinfoldRelationships({ ...folds, [slug]: 100 }, 'male');
      expect(relationships.some((item) => item.id === relationId), `${slug} → ${relationId}`).toBe(true);
    });
  });

  it('bildet auch Brust, Trizeps, Wade und die Rücken-Hüfte-Regel ausführbar ab', () => {
    expect(buildSkinfoldRelationships({ ...folds, brust: 100 }, 'male').some((item) => item.id === 'brust-korrelationen')).toBe(true);
    expect(buildSkinfoldRelationships({ ...folds, trizeps: 100 }, 'male').some((item) => item.id === 'trizeps-leitfalte')).toBe(true);
    expect(buildSkinfoldRelationships({ ...folds, wade: 100 }, 'male').some((item) => item.id.startsWith('wade-'))).toBe(true);
    expect(buildSkinfoldRelationships(folds, 'male').some((item) => item.id === 'ruecken-huefte-kohlenhydrate')).toBe(true);
  });

  it('liefert für jede der 13 möglichen Rang-1-Falten zuerst die passende Hauptbegründung', () => {
    const scenarios = [
      ['kinn', 'kinn-wange-verlauf'],
      ['wange', 'kinn-wange-verlauf'],
      ['brust', 'brust-korrelationen'],
      ['trizeps', 'trizeps-leitfalte'],
      ['ruecken', 'ruecken-gegenpruefung'],
      ['rippe', 'rippe-gegenpruefung'],
      ['huefte', 'huefte-blutzucker'],
      ['bauch', 'bauch-mehrfalten-pruefung'],
      ['knie', 'knie-oberschenkel'],
      ['wade', 'wade-'],
      ['quadrizeps', 'quad-'],
      ['beinbizeps', 'ham-'],
      ['bizeps', 'bizeps-trizeps-schlaf'],
    ];
    scenarios.forEach(([slug, relationId]) => {
      const plan = buildSkinfoldPlan([{ gemessen_am: '2026-09-14', falten: { ...folds, [slug]: 100 } }], 'male');
      expect(plan.topFold.slug, slug).toBe(slug);
      expect(plan.topRelationships.length, `${slug}: keine Hauptbeziehung`).toBeGreaterThan(0);
      expect(
        relationId.endsWith('-') ? plan.topRelationships[0].id.startsWith(relationId) : plan.topRelationships[0].id === relationId,
        `${slug}: ${plan.topRelationships[0].id} statt ${relationId}`,
      ).toBe(true);
      expect(plan.topRelationships.every((relation) => relation.focusSlugs.includes(slug)), `${slug}: irrelevante Nebenbeziehung`).toBe(true);
    });
  });

  it('nutzt den bestätigten Lebensmittelkontext für die Rippen-Verzweigung', () => {
    const unchecked = buildSkinfoldRelationships({ ...folds, rippe: 100 }, 'male')
      .find((item) => item.id === 'rippe-gegenpruefung');
    const confirmed = buildSkinfoldRelationships({ ...folds, rippe: 100 }, 'male', undefined, { repeatedFoods: true })
      .find((item) => item.id === 'rippe-gegenpruefung');
    expect(unchecked).toMatchObject({ requiresConfirmation: true });
    expect(confirmed).toMatchObject({ requiresConfirmation: false, tone: 'attention' });
  });

  it('verknüpft Kinn und Wange erst über den Verlauf', () => {
    const history = [
      { gemessen_am: '2026-01-01', falten: { ...folds, kinn: 4, wange: 4 } },
      { gemessen_am: '2026-02-01', falten: { ...folds, kinn: 20, wange: 10 } },
    ];
    const plan = buildSkinfoldPlan(history, 'male');
    expect(plan.relationships.some((item) => item.id === 'kinn-wange-verlauf')).toBe(true);
  });

  it('zeigt als Hauptfalte immer Rang 1 aller dreizehn Excel-Falten', () => {
    const kinnPriorisiert = { ...folds, kinn: 40 };
    const plan = buildSkinfoldPlan([{ gemessen_am: '2026-09-14', falten: kinnPriorisiert }], 'male');
    expect(plan.topFold).toMatchObject({ slug: 'kinn', foldPriority: 1 });
    expect(plan.overallTopFold.slug).toBe('kinn');
    expect(plan.topProtocolFold).toBeNull();
    expect(plan.activeProtocolGroup).toBeNull();
    expect(plan.priorities.every((priority) => priority.recommendedProtocols.length === 0)).toBe(true);
  });

  it('zählt eine Protokollphase nur, wenn Rang 1 wirklich zu dieser Gruppe gehört und erhöht ist', () => {
    const externalTop = { ...folds, kinn: 40 };
    const history = [
      { gemessen_am: '2026-01-01', falten: externalTop },
      { gemessen_am: '2026-02-01', falten: folds },
    ];
    const plan = buildSkinfoldPlan(history, 'male');
    expect(plan.activeProtocolGroup.id).toBe('bauch-brust-trizeps');
    expect(plan.activeProtocolGroup).toMatchObject({ occurrences: 1, suggestedPhase: 1 });
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

  it('macht nur die aktuelle Priorität zum umsetzbaren Handlungsplan', () => {
    const plan = buildSkinfoldPlan([{ gemessen_am: '2026-09-14', falten: folds }], 'male', {});
    const actions = buildSkinfoldActionPlan(plan, {});
    expect(actions.focusTitle).toContain('Phase 1');
    expect(actions.summary).toContain('aktuelle Priorität');
    expect(actions.categories.supplements[0].text).toContain('Phase 1 ist dein aktueller Supplement-Schritt');
    expect(actions.unansweredQuestionIds).toEqual(expect.arrayContaining(['stressHigh', 'sleepOnset', 'digestiveSymptoms']));
  });

  it('stellt beim Beinbizeps auch Schlaf- und Leberkontextfragen', () => {
    const legFolds = { ...folds, bauch: 4, quadrizeps: 18.4, beinbizeps: 40 };
    const plan = buildSkinfoldPlan([{ gemessen_am: '2026-09-14', falten: legFolds }], 'male', {});
    const actions = buildSkinfoldActionPlan(plan, {});
    expect(plan.topFold.slug).toBe('beinbizeps');
    expect(actions.unansweredQuestionIds).toEqual(expect.arrayContaining([
      'micronutrientIntakeLow',
      'environmentalExposure',
      'mercuryContext',
      'proteinFatIntakeLow',
      'sleepOnset',
      'sleepMaintenance',
    ]));
  });

  it('stellt auch bei Wange, Rippe, Rücken und Bizeps die quellenabhängigen Gegenfragen', () => {
    const requiredByFold = {
      wange: ['stressHigh', 'moldConcern'],
      rippe: ['stressHigh', 'morningDriveLow', 'sleepOnset', 'sleepMaintenance', 'digestiveSymptoms', 'repeatedFoods', 'mercuryContext'],
      ruecken: ['environmentalExposure', 'stressHigh', 'sleepOnset', 'sleepMaintenance', 'carbIntakeHigh', 'postMealCrash', 'micronutrientIntakeLow'],
      bizeps: ['stressHigh', 'morningDriveLow', 'sleepOnset', 'sleepMaintenance'],
    };
    Object.entries(requiredByFold).forEach(([slug, expectedQuestions]) => {
      const plan = buildSkinfoldPlan([{ gemessen_am: '2026-09-14', falten: { ...folds, [slug]: 100 } }], 'male');
      const actions = buildSkinfoldActionPlan(plan, {});
      expect(actions.unansweredQuestionIds, slug).toEqual(expect.arrayContaining(expectedQuestions));
    });
  });

  it('liefert je nach Schlafantwort andere konkrete Schritte', () => {
    const history = [{ gemessen_am: '2026-09-14', falten: { ...folds, bauch: 4, wade: 100 } }];
    const onsetContext = { sleepOnset: true, sleepMaintenance: false, wakes3to7: false, caffeineLate: true, alcoholNearBed: false, snoringBreathing: false };
    const maintenanceContext = { sleepOnset: false, sleepMaintenance: true, wakes3to7: true, caffeineLate: false, alcoholNearBed: true, snoringBreathing: false };
    const onset = buildSkinfoldActionPlan(buildSkinfoldPlan(history, 'male', onsetContext), onsetContext);
    const maintenance = buildSkinfoldActionPlan(buildSkinfoldPlan(history, 'male', maintenanceContext), maintenanceContext);
    expect(onset.categories.sleep.some((item) => item.text.includes('Stimulus-Kontrolle'))).toBe(true);
    expect(onset.categories.sleep.some((item) => item.text.includes('Koffein'))).toBe(true);
    expect(maintenance.categories.sleep.some((item) => item.text.includes('Wachphasen'))).toBe(true);
    expect(maintenance.categories.sleep.some((item) => item.text.includes('3–7 Uhr'))).toBe(true);
  });

  it('aktiviert wiederholungsabhängige Beinvarianten nur bei tatsächlich priorisierter Beinfalte', () => {
    const externalTop = { ...folds, kinn: 100, quadrizeps: 12, beinbizeps: 30 };
    const relation = buildSkinfoldRelationships(externalTop, 'male', undefined, {
      groupOccurrences: { 'quad-beinbizeps': 4 },
    }).find((item) => item.id === 'ham-ueber-quad');
    expect(relation.protocolIds).toContain('quad-beinbizeps-phase-4-methylkomplex');
    expect(relation.protocolIds).not.toContain('quad-beinbizeps-phase-4-lipo-gsh');
  });
});

describe('YPSI-Datenkonsistenz', () => {
  it('enthält für alle 13 Falten eine geordnete Faktor-Struktur mit direkt zugeordneten Strategien', () => {
    expect(Object.keys(hautfaltenFaktoren.falten)).toEqual(expect.arrayContaining(Object.keys(hautfaltenData.falten)));
    expect(Object.keys(hautfaltenFaktoren.falten)).toHaveLength(13);
    Object.entries(hautfaltenFaktoren.falten).forEach(([slug, fold]) => {
      expect(fold.faktoren.length, slug).toBeGreaterThan(0);
      fold.faktoren.forEach((factor) => {
        expect(factor.id, slug).toBeTruthy();
        expect(factor.faktor, factor.id).toBeTruthy();
        expect(factor.quelle, factor.id).toContain('Hautfalten Notizen');
        expect(Object.keys(factor.strategie), factor.id).toEqual(['nutrition', 'dailyLife', 'sleep', 'supplements']);
        expect(factor.pruefung?.modus, factor.id).toMatch(/^(keine|beliebig|alle)$/);
      });
    });
    expect(hautfaltenFaktoren.falten.huefte.faktoren.map((factor) => factor.rang)).toEqual([1, 2, 4, 5]);
  });

  it('verknüpft Bauchfaktoren mit Antworten und Gegenfalten statt nur mit freiem Text', () => {
    const stress = assessSkinfoldFactors(folds, 'male', 'bauch', { stressHigh: true });
    expect(stress.activeFactor).toMatchObject({ id: 'bauch-cortisol', status: 'bestaetigt' });

    const gut = assessSkinfoldFactors(folds, 'male', 'bauch', {
      stressHigh: false,
      troubleWindingDown: false,
      mealsIrregular: false,
      postMealCrash: false,
      proteinFatIntakeLow: false,
      micronutrientIntakeLow: false,
      morningDriveLow: false,
      sleepOnset: false,
      sleepMaintenance: false,
      wakesFit: true,
      digestiveSymptoms: true,
    });
    expect(gut.factors.find((factor) => factor.id === 'bauch-darm')).toMatchObject({ status: 'bestaetigt' });
  });

  it('liefert für jede mögliche Rang-1-Falte eine Faktorprüfung', () => {
    Object.keys(hautfaltenFaktoren.falten).forEach((slug) => {
      const result = assessSkinfoldFactors({ ...folds, [slug]: 100 }, 'male', slug, {});
      expect(result?.activeFactor?.id, slug).toBeTruthy();
      expect(result.factors.every((factor) => Array.isArray(factor.unansweredQuestionIds)), slug).toBe(true);
    });
  });

  it('verweist jede Falte nur auf vorhandene Protokolle', () => {
    const protocolIds = new Set(Object.keys(ypsiProtokolle.protokolle));
    Object.values(hautfaltenData.falten).forEach((fold) => {
      (fold.protokoll_ids || []).forEach((id) => expect(protocolIds.has(id), `${fold.slug}: ${id}`).toBe(true));
    });
  });

  it('verweist jedes Protokoll nur auf Supplements aus dem Katalog', () => {
    const supplementIds = new Set(Object.keys(supplementKatalog.supplemente));
    const fields = ['supplemente', 'optionale_supplemente', 'supplemente_morgens', 'supplemente_abends'];
    Object.values(ypsiProtokolle.protokolle).forEach((protocol) => {
      fields.flatMap((field) => protocol[field] || []).forEach((item) => {
        expect(supplementIds.has(item.slug), `${protocol.id}: ${item.slug}`).toBe(true);
      });
    });
  });

  it('enthält keine doppelten Bedingungen oder Supplements innerhalb eines Protokolls', () => {
    Object.entries(ypsiProtokolle.protokolle).forEach(([id, protocol]) => {
      expect(protocol.id, id).toBe(id);
      expect(new Set(protocol.bedingungen || []).size, `${id}: Bedingungen`).toBe((protocol.bedingungen || []).length);
      ['supplemente', 'optionale_supplemente', 'supplemente_morgens', 'supplemente_abends'].forEach((field) => {
        const slugs = (protocol[field] || []).map((item) => item.slug);
        expect(new Set(slugs).size, `${id}: ${field}`).toBe(slugs.length);
      });
    });
  });

  it('enthält alle elf geprüften Mehrfalten-Regelfamilien genau einmal', () => {
    expect(hautfaltenData.wechselbeziehungen.map((item) => item.id)).toEqual([
      'bauch-trizeps',
      'brust-gegenfalten',
      'trizeps-leitfalte',
      'ruecken-gegenfalten',
      'rippe-gegenfalten',
      'quad-ham-verhaeltnis',
      'wade-beine',
      'knie-oberschenkel',
      'bizeps-trizeps-schlaf',
      'kinn-wange-verlauf',
      'ruecken-huefte',
    ]);
  });

  it('bildet die dokumentierten Quellenabweichungen transparent und ohne erfundene Knie-Phase ab', () => {
    const protocols = ypsiProtokolle.protokolle;
    expect(protocols['huefte-phase-3'].supplemente.map((item) => item.slug)).toContain('ypsi-magnesium');
    expect(protocols['huefte-phase-3'].supplemente.map((item) => item.slug)).not.toContain('ypsi-inositol');
    expect(protocols['wade-phase-3'].optionale_supplemente).toContainEqual(expect.objectContaining({ slug: 'taurin' }));
    expect(protocols['quad-beinbizeps-phase-2'].notiz).toContain('Workshop-Fassungen');
    expect(protocols['knie-phase-2']).toBeUndefined();
    expect(hautfaltenData.quellenkonflikte).toHaveLength(8);
    expect(hautfaltenData.quellenkonflikte[0].thema).toContain('Excel-Rangreferenzen');
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
    expect(supplementName('ypsi-magnesium')).toBe('Magnesium (Bisglycinat)');
    const result = bravermanRecommendations('serotonin', 'major');
    expect(result.supplements.find((item) => item.slug === 'johanniskraut')).toEqual(expect.objectContaining({
      dose: '600 mg',
      safety: expect.stringContaining('Wechselwirkungen'),
    }));
    expect(supplementSafety('licorice-komplex')).toContain('Blutdruck');
    expect(supplementSafety('biotics-adp')).toContain('Durchfall');
  });

  it('liefert die Ernährungs- und Supplementhinweise aus dem Neurotransmitter-Seminar getrennt von der Braverman-Tabelle', () => {
    const dopamine = bravermanRecommendations('dopamin', 'moderate');
    expect(dopamine.seminarFoods).toEqual(expect.arrayContaining(['Sardinen', 'Pinienkerne', 'Avocado']));
    expect(dopamine.seminarSupplements).toEqual(expect.arrayContaining(['Koffein', 'Bacopa Monnieri']));

    const gaba = bravermanRecommendations('gaba', 'major');
    expect(gaba.seminarSupplements).toEqual(expect.arrayContaining(['Taurin', 'Magnesium-L-Threonat', 'Phenyl-GABA']));
    expect(gaba.seminarNote).toContain('gewöhnliche GABA-Supplements');

    const serotonin = bravermanRecommendations('serotonin', 'moderate');
    expect(serotonin.seminarFoods).toContain('Kohlenhydrate');
    expect(serotonin.seminarSupplements).toContain('Liposomales Melatonin');
  });

  it('enthält die Trainingsvorgaben des Seminars für alle vier Bereiche', () => {
    expect(bravermanRecommendations('dopamin', 'moderate').seminarTraining).toMatchObject({ intensitaet: 'moderat bis hoch', sprint: '6 × 30 m oder 4 × 50 m' });
    expect(bravermanRecommendations('acetylcholin', 'moderate').seminarTraining.beispiele).toContain('10 × 10');
    expect(bravermanRecommendations('gaba', 'moderate').seminarTraining).toMatchObject({ volumen: 'niedrig bis moderat', sprint: '' });
    expect(bravermanRecommendations('serotonin', 'moderate').seminarTraining).toMatchObject({ volumen: 'hoch', sprint: '20 Minuten' });
  });

  it('zeigt mehrere auffällige Defizitskalen, priorisiert aber nur einen nächsten Schwerpunkt', () => {
    const answers = Object.fromEntries(Object.entries(BRAVERMAN_DEFIZIT_FRAGEN).map(([key, questions]) => [
      key,
      questions.map((_, index) => (
        (key === 'dopamin' && index < 10)
        || (key === 'gaba' && index < 18)
        || (key === 'serotonin' && index < 8)
      )),
    ]));
    const plan = buildNeurotransmitterCoachPlan(answers);
    expect(plan.complete).toBe(true);
    expect(plan.focus.key).toBe('gaba');
    expect(plan.hasMultipleRelevant).toBe(true);
    expect(plan.relevant.map((profile) => profile.key)).toEqual(expect.arrayContaining(['dopamin', 'gaba', 'serotonin']));
    expect(plan.focus.recommendations.seminarTraining).toBeTruthy();
  });
});
