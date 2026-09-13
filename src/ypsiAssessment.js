import { FALTEN } from './measurements.js';
import hautfaltenData from './data/hautfalten.json';
import ypsiProtokolle from './data/ypsi-protokolle.json';
import supplementKatalog from './data/supplements-katalog.json';
import { BRAVERMAN_BEREICHE, BRAVERMAN_DEFIZIT_FRAGEN, BRAVERMAN_REIHENFOLGE } from './data/braverman-test.js';

const PROTOKOLL_GRUPPEN = Object.freeze([
  { id: 'bauch-brust-trizeps', label: 'Bauch, Brust & Trizeps', falten: ['bauch', 'brust', 'trizeps'] },
  { id: 'huefte', label: 'Hüfte', falten: ['huefte'] },
  { id: 'wade', label: 'Wade', falten: ['wade'] },
  { id: 'quad-beinbizeps', label: 'Vorderer & hinterer Oberschenkel', falten: ['quadrizeps', 'beinbizeps'] },
  { id: 'knie', label: 'Knie', falten: ['knie'] },
]);

const SUPPLEMENT_NAMEN = Object.freeze({
  methionin: 'Methionin', rhodiola: 'Rhodiola', pyridoxin: 'Vitamin B6 (Pyridoxin)',
  'b-komplex': 'Vitamin-B-Komplex', phosphatidylserin: 'Phosphatidylserin',
  'ginkgo-biloba': 'Ginkgo biloba', 'gpc-choline': 'GPC-Cholin',
  phosphatidylcholin: 'Phosphatidylcholin', dha: 'DHA', thiamin: 'Thiamin (B1)',
  pantothensaeure: 'Pantothensäure (B5)', 'koreanischer-ginseng': 'Koreanischer Ginseng',
  inositol: 'Inositol', 'gaba-oral': 'GABA', glutaminsaeure: 'Glutaminsäure',
  melatonin: 'Melatonin', niacinamid: 'Niacinamid', baldrian: 'Baldrian',
  passionsblume: 'Passionsblume', kalzium: 'Kalzium', fischoel: 'Fischöl',
  magnesium: 'Magnesium', johanniskraut: 'Johanniskraut', tryptophan: 'Tryptophan', zink: 'Zink',
});

const SICHERHEITS_HINWEISE = Object.freeze({
  '5-htp': 'Nicht mit serotonergen Medikamenten oder anderen Serotonin-Vorstufen kombinieren.',
  same: 'Kann mit serotonergen Mitteln interagieren; bei bipolarer Erkrankung vorher fachlich abklären.',
  johanniskraut: 'Hat zahlreiche relevante Medikamenten-Wechselwirkungen, unter anderem mit Antidepressiva und hormoneller Verhütung.',
  tryptophan: 'Nicht mit serotonergen Medikamenten oder anderen Serotonin-Vorstufen kombinieren.',
  'ginkgo-biloba': 'Bei Blutverdünnern oder vor Operationen vorher ärztlich abklären.',
  pyridoxin: 'Die höheren Vorlagen-Dosierungen liegen über dem aktuellen europäischen Höchstwert für die tägliche Gesamtzufuhr.',
  'huperzine-a': 'Die Einheit der historischen Vorlage ist auffällig und muss vor jeder Anwendung anhand des Produkts fachlich geprüft werden.',
  b12: 'Die Einheit der historischen Vorlage ist auffällig und muss vor jeder Anwendung anhand des Produkts fachlich geprüft werden.',
  'licorice-komplex': 'Süßholz kann Blutdruck und Kaliumhaushalt relevant beeinflussen; bei Bluthochdruck, Herz-/Nierenerkrankungen oder Medikamenten vorher fachlich abklären.',
  'licorice-creme': 'Süßholz kann Blutdruck und Kaliumhaushalt relevant beeinflussen; bei Bluthochdruck, Herz-/Nierenerkrankungen oder Medikamenten vorher fachlich abklären.',
  melatonin: 'Vor allem bei Blutverdünnern, Epilepsie, Schwangerschaft oder längerer Anwendung fachlich abklären.',
  'lipo-melatonin': 'Vor allem bei Blutverdünnern, Epilepsie, Schwangerschaft oder längerer Anwendung fachlich abklären.',
  'vitamin-d-k': 'Die Vorlagen-Dosis nicht automatisch übernehmen; Gesamtzufuhr und Verlauf anhand eines geeigneten Labortests fachlich prüfen.',
  glutamin: 'Die sehr hohe Protokoll-Dosis nur nach individueller Prüfung und mit langsamem Verträglichkeitstest verwenden.',
  glycin: 'Die sehr hohe Protokoll-Dosis nur nach individueller Prüfung und mit langsamem Verträglichkeitstest verwenden.',
});

const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 1;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function assessmentSex(calculationBasis) {
  return calculationBasis === 'female' ? 'frau' : 'mann';
}

function foldAssessment(folds = {}, calculationBasis = 'male') {
  const sex = assessmentSex(calculationBasis);
  const allValues = FALTEN.map(([slug]) => Number(folds?.[slug])).filter((value) => Number.isFinite(value) && value >= 0);
  if (allValues.length !== FALTEN.length) return null;
  const typical = Math.max(1, median(allValues));
  const details = FALTEN.map(([slug]) => {
    const value = Number(folds[slug]);
    const info = hautfaltenData.falten[slug] || {};
    const norm = Number(info.norm?.[`${sex}_mm`]);
    const limit = Number(info.norm?.grenzwert_mm);
    const reference = Number.isFinite(norm) && norm > 0
      ? norm
      : Number.isFinite(limit) && limit > 0 ? limit : typical;
    return {
      slug,
      label: info.label || slug,
      value,
      relative: value / reference,
      reference,
      hasFixedReference: (Number.isFinite(norm) && norm > 0) || (Number.isFinite(limit) && limit > 0),
    };
  });
  const ranked = [...details]
    .sort((a, b) => b.relative - a.relative)
    .map((item, index) => ({ ...item, foldPriority: index + 1 }));
  return { details, ranked, bySlug: Object.fromEntries(ranked.map((item) => [item.slug, item])), typical };
}

export function rankSkinfolds(folds = {}, calculationBasis = 'male') {
  return foldAssessment(folds, calculationBasis)?.ranked || [];
}

export function assessSkinfoldPriorities(folds = {}, calculationBasis = 'male') {
  const assessment = foldAssessment(folds, calculationBasis);
  if (!assessment) return [];

  return PROTOKOLL_GRUPPEN.map((group) => {
    const details = group.falten.map((slug) => assessment.bySlug[slug]).filter(Boolean);
    if (!details.length) return null;
    const score = Math.max(...details.map((item) => item.relative));
    const primaryFold = [...details].sort((a, b) => b.relative - a.relative)[0];
    const protocols = Object.values(ypsiProtokolle.protokolle)
      .filter((protocol) => protocol.gruppe === group.id)
      .sort((a, b) => Number(a.phase) - Number(b.phase));
    return { ...group, score, details, primaryFold, protocols };
  }).filter(Boolean).sort((a, b) => b.score - a.score).map((item, index) => ({ ...item, priority: index + 1 }));
}

const relativeAtLeast = (fold, threshold = 1.05) => Number(fold?.relative) >= threshold;
/**
 * Bildet die in den Seminarunterlagen beschriebenen Wechselbeziehungen ab.
 * Das Ergebnis bleibt bewusst eine Entscheidungsunterstützung: Falten allein
 * können Symptome wie Verdauungsbeschwerden oder Einschlafprobleme nicht messen.
 */
export function buildSkinfoldRelationships(folds = {}, calculationBasis = 'male', priorities = assessSkinfoldPriorities(folds, calculationBasis), context = {}) {
  const assessment = foldAssessment(folds, calculationBasis);
  if (!assessment || !priorities.length) return [];
  const f = assessment.bySlug;
  const relations = [];
  const topGroup = priorities[0];
  const topFold = assessment.ranked[0];
  const abdominalTop = topGroup.id === 'bauch-brust-trizeps' && topGroup.primaryFold.slug === 'bauch';
  const recentEnergy = Number(context.recentEnergy);
  const recentSleep = Number(context.recentSleep);
  const push = (relation) => relations.push({ tone: 'info', protocolIds: [], actions: [], groupIds: [], ...relation });

  if (abdominalTop && f.trizeps.relative <= 1.05) {
    push({
      id: 'bauch-trizeps-darmzweig',
      title: 'Bauch priorisiert · Trizeps im Zielbereich',
      summary: `Der Energie-/Testosteron-Kontext ist über den Trizeps weniger auffällig. Dadurch gewinnt nach der Seminarlogik der Darmzweig an Gewicht${recentEnergy >= 4 ? '; deine zuletzt protokollierte Energie stützt diese Abzweigung' : ''}.`,
      basis: `Bauch ${f.bauch.value} mm · Trizeps ${f.trizeps.value} mm (Referenz ${f.trizeps.reference} mm)`,
      actions: [
        'Zuerst bestätigen: Du wachst gut auf und dein Aktivitäts- bzw. Energielevel ist gut.',
        'Zusätzlich Verdauung, Verträglichkeit von Getreide/Milch/Fruktose und mögliche Darmbeschwerden prüfen.',
        'Nur wenn diese Bedingungen passen, den Chlorella-/Darm-Zweig statt einer pauschalen Cortisol-Erklärung wählen.',
      ],
      protocolIds: ['bauch-brust-trizeps-phase-4-chlorella', 'darm-sanierung-phase-1'],
      groupIds: ['bauch-brust-trizeps'],
      tone: 'branch',
    });
  } else if (abdominalTop && relativeAtLeast(f.trizeps)) {
    push({
      id: 'bauch-trizeps-energie',
      title: 'Bauch und Trizeps gemeinsam auffällig',
      summary: 'Die Unterlagen priorisieren hier Stress-, Energie-, DHEA-/Testosteron- und Schlafkontext vor einer isolierten Darmdeutung.',
      basis: `Bauch ${f.bauch.value} mm · Trizeps ${f.trizeps.value} mm`,
      actions: [
        'Morgenenergie, Gesamtstress und regelmäßige proteinreiche Mahlzeiten prüfen.',
        'Schlaf über die Wadenfalte und Blutzucker über die Hüftfalte gegenprüfen.',
        'Den Darmzweig erst nach Cortisol- und Energiekontext einordnen.',
      ],
      groupIds: ['bauch-brust-trizeps'],
      tone: 'attention',
    });
  }

  if (topGroup.id === 'bauch-brust-trizeps' && relativeAtLeast(f.huefte)) {
    push({
      id: 'bauch-huefte-blutzucker',
      title: 'Bauch mit auffälliger Hüfte',
      summary: 'Die Kombination passt in den Unterlagen zum Glukose-/Insulinzweig – auch durch unregelmäßiges oder zu knappes Essen, nicht nur durch zu viele Kohlenhydrate.',
      basis: `Bauch ${f.bauch.value} mm · Hüfte ${f.huefte.value} mm`,
      actions: ['Regelmäßige Mahlzeiten mit ausreichend Protein und Fett prüfen.', 'Kohlenhydratmenge, Heißhunger und Energieverlauf gemeinsam beurteilen.'],
      groupIds: ['bauch-brust-trizeps', 'huefte'],
    });
  }

  if (topGroup.id === 'bauch-brust-trizeps' && (relativeAtLeast(f.wade) || recentSleep > 0 && recentSleep < 3)) {
    push({
      id: 'bauch-wade-schlaf',
      title: 'Schlaf als Mitfaktor prüfen',
      summary: 'Bauch/Brust/Trizeps werden in den Unterlagen mit der Waden- und Beinfaltenlage gegengeprüft, bevor nur Stress oder Darm angenommen wird.',
      basis: `Wade ${f.wade.value} mm${Number.isFinite(recentSleep) ? ` · letzte Schlafqualität ${recentSleep}/5` : ''}`,
      actions: ['Tiefschlaf, Einschlafen, nächtliches Aufwachen und Morgenenergie getrennt betrachten.'],
      groupIds: ['bauch-brust-trizeps', 'wade'],
    });
  }

  if (topGroup.primaryFold.slug === 'brust') {
    const links = [
      relativeAtLeast(f.trizeps) && 'Trizeps: Energie/DHEA/Testosteron',
      relativeAtLeast(f.bauch) && 'Bauch: Stress/Cortisol',
      relativeAtLeast(f.huefte) && 'Hüfte: Glukose/Insulin',
      relativeAtLeast(f.ruecken) && 'Rücken: Entzündung',
    ].filter(Boolean);
    push({
      id: 'brust-korrelationen',
      title: 'Brust nicht isoliert bewerten',
      summary: links.length ? `Auffällige Gegenprüfungen: ${links.join(' · ')}.` : 'Die zugeordneten Gegenfalten sind derzeit nicht deutlich auffälliger; Zink-/Aromatase-Kontext bleibt eine mögliche, nicht diagnostische Seminarhypothese.',
      basis: `Brust ${f.brust.value} mm`,
      actions: ['Zuerst Trizeps, Bauch, Hüfte und Rücken als Gegenfalten prüfen.', 'Zinkbedarf nicht allein aus der Falte ableiten; Ernährung und gegebenenfalls Laborwerte einbeziehen.'],
      groupIds: ['bauch-brust-trizeps'],
    });
  }

  const legGroup = priorities.find((item) => item.id === 'quad-beinbizeps');
  const legDifference = (f.beinbizeps.value - f.quadrizeps.value) / Math.max(1, f.beinbizeps.value, f.quadrizeps.value);
  if (legDifference > 0.05) {
    push({
      id: 'ham-ueber-quad',
      title: 'Beinbizeps höher als Quadrizeps',
      summary: 'Dieses Verhältnis ordnen die Unterlagen stärker dem B‑Vitamin-/Methylierungs- und, bei wiederkehrender Priorität, dem Leber-Phase-2-Zweig zu.',
      basis: `Beinbizeps ${f.beinbizeps.value} mm · Quadrizeps ${f.quadrizeps.value} mm`,
      actions: ['MethylKomplex als Phase-4-Variante prüfen.', 'Bei erneut priorisiertem Beinbizeps wird in den Unterlagen liposomales Glutathion genannt.', 'Eine gleichzeitig auffällige Wade stärkt den Schlafbezug.'],
      protocolIds: ['quad-beinbizeps-phase-4-methylkomplex', 'quad-beinbizeps-phase-4-lipo-gsh'],
      groupIds: ['quad-beinbizeps', 'wade'],
      tone: legGroup?.priority === 1 ? 'attention' : 'info',
    });
  } else if (legDifference < -0.05) {
    const bellyTopThree = f.bauch.foldPriority <= 3;
    push({
      id: 'quad-ueber-ham',
      title: 'Quadrizeps höher als Beinbizeps',
      summary: `Die Unterlagen verzweigen hier zu Darm/Leaky Gut oder Leber Phase 2${bellyTopThree ? '; weil Bauch in deiner internen Faltenrangfolge unter den ersten drei liegt, wird zusätzlich der Pectasol-/Quecksilber-Zweig genannt' : ''}.`,
      basis: `Quadrizeps ${f.quadrizeps.value} mm · Beinbizeps ${f.beinbizeps.value} mm · Bauch Rang ${f.bauch.foldPriority}`,
      actions: ['Bei Verdauungs-/Leaky-Gut-Zeichen Glutamin-Zweig prüfen.', 'Wenn Quadrizeps nach früherer Arbeit erneut Priorität wird, Liv.52-Zweig prüfen.', ...(bellyTopThree ? ['Pectasol-Zweig nur nach den vorherigen Basisphasen und passender Darm-/Belastungsanamnese prüfen.'] : [])],
      protocolIds: ['quad-beinbizeps-phase-4-glutamin', 'quad-beinbizeps-phase-4-liv52', ...(bellyTopThree ? ['quad-beinbizeps-phase-4-pectasol'] : [])],
      groupIds: ['quad-beinbizeps', 'bauch-brust-trizeps'],
      tone: legGroup?.priority === 1 ? 'attention' : 'info',
    });
  } else {
    push({
      id: 'quad-ham-ausgeglichen',
      title: 'Vorder- und hintere Oberschenkelfalte ähnlich',
      summary: 'Aus dem Verhältnis ergibt sich aktuell kein klarer B‑Vitamin- oder Darm-/Leber-Zweig. Verlauf und Symptome entscheiden.',
      basis: `Quadrizeps ${f.quadrizeps.value} mm · Beinbizeps ${f.beinbizeps.value} mm`,
      groupIds: ['quad-beinbizeps'],
    });
  }

  if (priorities.find((item) => item.id === 'wade')?.priority <= 2) {
    const hamProminent = relativeAtLeast(f.beinbizeps);
    const bothLegsProminent = hamProminent && relativeAtLeast(f.quadrizeps);
    push({
      id: bothLegsProminent ? 'wade-quad-ham' : hamProminent ? 'wade-ham' : 'wade-schlafzweige',
      title: bothLegsProminent ? 'Wade mit beiden Oberschenkelfalten' : hamProminent ? 'Wade mit Beinbizeps' : 'Wade priorisiert',
      summary: bothLegsProminent
        ? 'Diese Kombination führt in den Unterlagen zum Glycin-Zweig.'
        : hamProminent ? 'Diese Kombination führt in den Unterlagen zum MethylKomplex-Zweig.' : 'Für Phase 4 muss zwischen Einschlafen, Durchschlafen, GABA- und Serotonin-Kontext unterschieden werden.',
      basis: `Wade ${f.wade.value} mm · Quadrizeps ${f.quadrizeps.value} mm · Beinbizeps ${f.beinbizeps.value} mm`,
      actions: bothLegsProminent
        ? ['Glycin-Variante prüfen; Dosis einschleichen und Verträglichkeit beachten.']
        : hamProminent ? ['MethylKomplex-Variante prüfen.'] : ['Schlecht zur Ruhe/GABA: Neuromag oder Taurin prüfen.', 'Serotoninbezogenes Einschlafen: liposomales Melatonin prüfen.', 'Aufwachen zwischen 3–7 Uhr: Greens, gegebenenfalls mit Chlorella, prüfen.'],
      protocolIds: bothLegsProminent
        ? ['wade-phase-4-glycin']
        : hamProminent ? ['wade-phase-4-methylkomplex'] : ['wade-phase-4-neuromag', 'wade-phase-4-taurin', 'wade-phase-4-lipo-melatonin', 'wade-phase-4-greens'],
      groupIds: ['wade', 'quad-beinbizeps'],
      tone: 'branch',
    });
  }

  if (f.ruecken.value + f.huefte.value < 18) {
    push({
      id: 'ruecken-huefte-kohlenhydrate',
      title: 'Rücken + Hüfte unter 18 mm',
      summary: 'Laut Seminarregel sind grundsätzlich Kohlenhydrate möglich; Menge und Auswahl bleiben vom Verlauf, Hunger, Training und Kalorienziel abhängig.',
      basis: `${f.ruecken.value} + ${f.huefte.value} = ${f.ruecken.value + f.huefte.value} mm`,
      actions: ['Nicht als Freigabe für unbegrenzte Kohlenhydrate verstehen; TRACKER und Gewichtsverlauf bleiben führend.'],
      groupIds: ['huefte'],
      tone: 'good',
    });
  }

  if (topFold.slug === 'rippe') {
    push({
      id: 'rippe-gegenpruefung',
      title: 'Rippe ist die priorisierte Falte',
      summary: 'Die Unterlagen verknüpfen sie mit Schilddrüse/Stoffwechsel, verlangen aber Gegenprüfungen für Stress, Toxine, Schlaf, Zucker und wiederholte Lebensmittel.',
      basis: `Rippe ${f.rippe.value} mm · Referenz ${f.rippe.reference} mm`,
      actions: ['Bauch/Trizeps für Stress und Energie prüfen.', 'Bein-/Wadenfalten für Toxine und Schlaf prüfen.', 'Hüfte für Zucker-/Blutzuckerkontext und Ernährung auf häufig wiederholte Lebensmittel prüfen.'],
    });
  }

  return relations;
}

const completeHistory = (history = []) => history
  .filter((row) => assessSkinfoldPriorities(row?.falten, 'male').length)
  .sort((a, b) => String(a.gemessen_am || '').localeCompare(String(b.gemessen_am || '')));

export function buildSkinfoldPlan(history = [], calculationBasis = 'male', context = {}) {
  const rows = completeHistory(history);
  if (!rows.length) return null;
  const occurrences = {};
  let priorities = [];
  rows.forEach((row) => {
    priorities = assessSkinfoldPriorities(row.falten, calculationBasis);
    const top = priorities[0];
    occurrences[top.id] = (occurrences[top.id] || 0) + 1;
  });
  const current = rows.at(-1);
  const relationships = buildSkinfoldRelationships(current.falten, calculationBasis, priorities, context);
  const rankedFolds = rankSkinfolds(current.falten, calculationBasis);
  const enriched = priorities.map((priority) => {
    const previousOccurrences = occurrences[priority.id] || 0;
    const suggestedPhase = Math.min(4, priority.priority === 1 ? previousOccurrences : previousOccurrences + 1 || 1);
    const phaseProtocols = priority.protocols.filter((item) => Number(item.phase) === suggestedPhase);
    const relationProtocolIds = new Set(relationships.flatMap((item) => item.protocolIds));
    const recommendedProtocols = suggestedPhase < 4
      ? phaseProtocols.slice(0, 1)
      : phaseProtocols.filter((item) => relationProtocolIds.has(item.id));
    return {
      ...priority,
      occurrences: previousOccurrences,
      suggestedPhase,
      phaseProtocols,
      recommendedProtocols,
      relationships: relationships.filter((item) => item.groupIds.includes(priority.id)),
    };
  });
  return {
    date: current.gemessen_am,
    priorities: enriched,
    topFold: enriched[0].primaryFold,
    overallTopFold: rankedFolds[0],
    rankedFolds,
    relationships,
    occurrences,
  };
}

export function protocolForPhase(priority, phase = 1) {
  const candidates = priority?.protocols?.filter((protocol) => Number(protocol.phase) === Number(phase)) || [];
  return candidates[0] || null;
}

export function supplementName(slug) {
  return supplementKatalog.supplemente?.[slug]?.name
    || SUPPLEMENT_NAMEN[slug]
    || String(slug).replaceAll('-', ' ').replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function supplementSafety(slug) {
  const catalog = supplementKatalog.supplemente?.[slug] || {};
  return [...new Set([
    SICHERHEITS_HINWEISE[slug],
    catalog.kontraindikation,
    catalog.nebenwirkung,
  ].filter(Boolean))].join(' ');
}

export function scoreBravermanAssessment(answers = {}) {
  const scores = Object.fromEntries(BRAVERMAN_REIHENFOLGE.map((key) => {
    const values = Array.isArray(answers[key]) ? answers[key] : [];
    return [key, values.reduce((sum, value) => sum + (value === true ? 1 : 0), 0)];
  }));
  const focus = [...BRAVERMAN_REIHENFOLGE].sort((a, b) => scores[b] - scores[a])[0];
  return { scores, focus, severity: Object.fromEntries(BRAVERMAN_REIHENFOLGE.map((key) => [key, bravermanSeverity(scores[key])])) };
}

export function bravermanSeverity(score = 0) {
  if (score <= 5) return { id: 'minor', label: 'gering', tone: 'good' };
  if (score <= 15) return { id: 'moderate', label: 'moderat', tone: 'watch' };
  return { id: 'major', label: 'deutlich', tone: 'attention' };
}

export function bravermanComplete(answers = {}) {
  return BRAVERMAN_REIHENFOLGE.every((key) => (
    Array.isArray(answers[key])
    && answers[key].length === BRAVERMAN_DEFIZIT_FRAGEN[key].length
    && answers[key].every((value) => typeof value === 'boolean')
  ));
}

export function bravermanRecommendations(type, severityId) {
  const table = supplementKatalog.braverman_dosierungstafel?.[type] || [];
  const area = BRAVERMAN_BEREICHE[type];
  return {
    area,
    foods: area?.lebensmittel || [],
    supplements: table.map((item) => ({
      ...item,
      name: supplementName(item.slug),
      dose: item[severityId] || '',
      safety: supplementSafety(item.slug),
    })),
  };
}

export { BRAVERMAN_BEREICHE, BRAVERMAN_DEFIZIT_FRAGEN, BRAVERMAN_REIHENFOLGE };
