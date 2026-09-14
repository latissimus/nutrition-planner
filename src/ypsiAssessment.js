import { FALTEN } from './measurements.js';
import { faltenRang } from './ypsiFormel.js';
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

export function assessmentSex(calculationBasis) {
  return calculationBasis === 'female' ? 'frau' : 'mann';
}

/* Priorisierung nach Formel.xlsx: Score = |Wert/4 − Referenz-MITTEL| je
   Geschlecht, absteigend. Die Vorlage unterscheidet nicht, ob die Abweichung
   nach oben oder unten geht; `richtung` haelt das fest, ohne den Rang zu
   aendern, weil die Handlung daraus eine andere ist. */
function foldAssessment(folds = {}, calculationBasis = 'male') {
  const allValues = FALTEN.map(([slug]) => Number(folds?.[slug])).filter((value) => Number.isFinite(value) && value >= 0);
  if (allValues.length !== FALTEN.length) return null;
  const ranked = faltenRang(folds, calculationBasis).map((eintrag) => ({
    slug: eintrag.slug,
    label: hautfaltenData.falten[eintrag.slug]?.label || eintrag.slug,
    value: eintrag.wert,
    reference: eintrag.referenz,
    score: eintrag.score,
    richtung: eintrag.richtung,
    // Verhaeltniszahl bleibt fuer die Wechselbeziehungen unten erhalten.
    relative: eintrag.wert / 4 / eintrag.referenz,
    foldPriority: eintrag.rang,
  }));
  return {
    details: ranked,
    ranked,
    bySlug: Object.fromEntries(ranked.map((item) => [item.slug, item])),
  };
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
    const score = Math.max(...details.map((item) => item.score));
    const primaryFold = [...details].sort((a, b) => b.score - a.score)[0];
    const protocols = Object.values(ypsiProtokolle.protokolle)
      .filter((protocol) => protocol.gruppe === group.id)
      .sort((a, b) => Number(a.phase) - Number(b.phase));
    return {
      ...group,
      score,
      details,
      primaryFold,
      protocols,
      grundlagen: hautfaltenData.gruppenempfehlungen?.[group.id] || null,
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score).map((item, index) => ({ ...item, priority: index + 1 }));
}

const isElevated = (fold) => fold?.richtung === 'ueber';
const isTopThree = (fold) => Number(fold?.foldPriority) <= 3;
const yes = (value) => value === true;
const answered = (value) => typeof value === 'boolean';

export const YPSI_EVIDENCE_SOURCES = Object.freeze({
  insomnia: {
    label: 'AASM-Leitlinie zu Insomnie',
    url: 'https://doi.org/10.5664/jcsm.8986',
  },
  movement: {
    label: 'WHO-Leitlinie zu Bewegung',
    url: 'https://www.who.int/publications/i/item/9789240015128',
  },
  mindfulness: {
    label: 'Metaanalyse zu Achtsamkeit und Stress',
    url: 'https://pubmed.ncbi.nlm.nih.gov/41634335/',
  },
  postMealMovement: {
    label: 'Metaanalyse zu Bewegung nach Mahlzeiten',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36715875/',
  },
  sleepHabits: {
    label: 'NHLBI: gesunde Schlafgewohnheiten',
    url: 'https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits',
  },
  sleepApnea: {
    label: 'NHLBI: Symptome einer Schlafapnoe',
    url: 'https://www.nhlbi.nih.gov/health/sleep-apnea/symptoms',
  },
  digestiveDiary: {
    label: 'NIDDK: Ernährung und Symptomtagebuch',
    url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/diarrhea/eating-diet-nutrition',
  },
});

function foldState(fold) {
  if (!fold) return 'nicht verfügbar';
  if (fold.richtung === 'ueber') return `über Referenz, Rang ${fold.foldPriority}`;
  if (fold.richtung === 'unter') return `unter Referenz, Rang ${fold.foldPriority}`;
  return `auf Referenz, Rang ${fold.foldPriority}`;
}

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
  const topFold = assessment.ranked[0];
  const abdominalTop = topFold.slug === 'bauch'
    && isElevated(f.bauch);
  const recentEnergy = Number(context.recentEnergy);
  const recentSleep = Number(context.recentSleep);
  // Schlaf-Logs liefern Zusatzkontext, ersetzen bei einer bedingten
  // Supplement-Variante aber keine ausdrückliche Ja/Nein-Antwort.
  const wakesFit = yes(context.wakesFit);
  const morningDriveLow = yes(context.morningDriveLow);
  const sleepConcern = yes(context.sleepOnset) || yes(context.sleepMaintenance) || (recentSleep > 0 && recentSleep < 3);
  const gabaContext = yes(context.gabaContext);
  const serotoninContext = yes(context.serotoninContext);
  const groupOccurrences = context.groupOccurrences || {};
  const push = (relation) => relations.push({
    tone: 'info',
    protocolIds: [],
    actions: [],
    groupIds: [],
    requiresConfirmation: false,
    source: '',
    ...relation,
  });

  if (abdominalTop) {
    push({
      id: 'bauch-mehrfalten-pruefung',
      title: 'Bauch im Zusammenspiel prüfen',
      summary: 'Die Seminarunterlagen verlangen vor der Deutung als Cortisol-, Energie- oder Darmthema Gegenprüfungen über Trizeps, Brust, Hüfte sowie Waden- und Beinfalten.',
      basis: `Trizeps ${foldState(f.trizeps)} · Brust ${foldState(f.brust)} · Hüfte ${foldState(f.huefte)} · Wade ${foldState(f.wade)} · Quadrizeps ${foldState(f.quadrizeps)} · Beinbizeps ${foldState(f.beinbizeps)}`,
      actions: [
        'Trizeps und Brust ordnen Energie, DHEA/Testosteron und Aromatase-/Zinkkontext ein.',
        'Hüfte prüft Blutzucker und regelmäßige Mahlzeiten gegen.',
        'Wade und Beinfalten prüfen Schlaf, Darm sowie Leber-/Entgiftungskontext.',
      ],
      groupIds: ['bauch-brust-trizeps'],
      tone: 'branch',
      source: 'Hautfalten Notizen S. 7 und S. 13',
    });

    if (!isElevated(f.trizeps)) {
      const gutQuestionsAnswered = answered(context.wakesFit) && answered(context.digestiveSymptoms);
      const confirmedGutBranch = wakesFit && yes(context.digestiveSymptoms);
      push({
        id: 'bauch-trizeps-darmzweig',
        title: confirmedGutBranch ? 'Darmzweig durch Kontext bestätigt' : gutQuestionsAnswered ? 'Darmzweig passt aktuell nicht' : 'Darmzweig gezielt gegenprüfen',
        summary: confirmedGutBranch
          ? 'Bauch ist priorisiert, der Trizeps ist nicht erhöht, du wachst fit auf und hast Verdauungskontext bestätigt. Das entspricht dem Darm-/Chlorella-Zweig der Unterlagen.'
          : gutQuestionsAnswered
            ? 'Ein nicht erhöhter Trizeps allein reicht nicht: Nach deinen Antworten fehlen gutes Aufwachen/Aktivitätslevel oder passende Verdauungszeichen. Deshalb wird der Darm-/Chlorella-Zweig nicht gewählt.'
            : 'Ein nicht erhöhter Trizeps schwächt die Energie-/Testosterondeutung. Der Darmzweig darf laut Unterlagen aber erst gewählt werden, wenn gutes Aufwachen/Aktivitätslevel und passende Verdauungszeichen bestätigt sind.',
        basis: `Bauch ${f.bauch.value} mm · Trizeps ${f.trizeps.value} mm (${foldState(f.trizeps)})`,
        actions: [
          'Bestätigen, ob du gut aufwachst und tagsüber ein gutes Aktivitäts-/Energielevel hast.',
          'Verdauung sowie Verträglichkeit von Getreide, Milch und Fruchtzucker prüfen.',
          'Chlorella-/Darm-Zweig nur wählen, wenn beides passt.',
        ],
        protocolIds: confirmedGutBranch ? ['bauch-brust-trizeps-phase-4-chlorella', 'darm-sanierung-phase-1'] : [],
        groupIds: ['bauch-brust-trizeps'],
        tone: confirmedGutBranch ? 'attention' : 'branch',
        requiresConfirmation: !gutQuestionsAnswered,
        source: 'Hautfalten Notizen S. 7 und S. 13; Körperfett-Assessment S. 13',
      });
    } else {
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
        source: 'Hautfalten Notizen S. 3 und S. 7',
      });
    }

    if (yes(context.troubleWindingDown) || (yes(context.sleepOnset) && gabaContext)) {
      push({
        id: 'bauch-gaba-einschlafen',
        title: 'Bauch plus schlechtes Zur-Ruhe-Kommen',
        summary: 'Die bestätigte Einschlaf-/GABA-Konstellation entspricht dem Neuromag-Zweig der Phase 4+.',
        basis: `Bauch ${f.bauch.value} mm · Einschlafkontext bestätigt${gabaContext ? ' · GABA-Profil auffällig' : ''}`,
        actions: ['Neuromag-Zweig nur nach den Basisphasen und unter Beachtung der Supplement-Sicherheit prüfen.'],
        protocolIds: ['bauch-brust-trizeps-phase-4-neuromag'],
        groupIds: ['bauch-brust-trizeps'],
        tone: 'branch',
        source: 'Hautfalten Notizen S. 13; Körperfett-Assessment S. 13',
      });
    }

    if (morningDriveLow) {
      push({
        id: 'bauch-morgenenergie',
        title: 'Bauch plus niedrige Morgenenergie',
        summary: 'Die Unterlagen führen bei schlechtem Aktivitätslevel und Antriebslosigkeit zum Licorice-Zweig; bei sehr großem Drive-Problem wird Bacopa im Wechsel genannt.',
        basis: `Bauch ${f.bauch.value} mm · Morgenenergie niedrig bestätigt`,
        actions: ['Blutdruck, Kaliumhaushalt, Medikamente und persönliche Kontraindikationen vor Süßholz fachlich prüfen.'],
        protocolIds: ['bauch-brust-trizeps-phase-4-licorice'],
        groupIds: ['bauch-brust-trizeps'],
        tone: 'branch',
        source: 'Hautfalten Notizen S. 13; Körperfett-Assessment S. 13',
      });
    }
  }

  if (['bauch', 'brust', 'trizeps'].includes(topFold.slug) && isElevated(f.huefte)) {
    push({
      id: 'bauch-huefte-blutzucker',
      title: 'Bauch mit auffälliger Hüfte',
      summary: 'Die Kombination passt in den Unterlagen zum Glukose-/Insulinzweig – auch durch unregelmäßiges oder zu knappes Essen, nicht nur durch zu viele Kohlenhydrate.',
      basis: `Bauch ${f.bauch.value} mm · Hüfte ${f.huefte.value} mm`,
      actions: ['Regelmäßige Mahlzeiten mit ausreichend Protein und Fett prüfen.', 'Kohlenhydratmenge, Heißhunger und Energieverlauf gemeinsam beurteilen.'],
      groupIds: ['bauch-brust-trizeps', 'huefte'],
      source: 'Hautfalten Notizen S. 6–7',
    });
  }

  if (['bauch', 'brust', 'trizeps'].includes(topFold.slug) && (isElevated(f.wade) || isElevated(f.quadrizeps) || isElevated(f.beinbizeps) || sleepConcern)) {
    push({
      id: 'bauch-wade-schlaf',
      title: 'Schlaf als Mitfaktor prüfen',
      summary: 'Bauch/Brust/Trizeps werden in den Unterlagen mit der Waden- und Beinfaltenlage gegengeprüft, bevor nur Stress oder Darm angenommen wird.',
      basis: `Wade ${f.wade.value} mm${Number.isFinite(recentSleep) ? ` · letzte Schlafqualität ${recentSleep}/5` : ''}`,
      actions: ['Tiefschlaf, Einschlafen, nächtliches Aufwachen und Morgenenergie getrennt betrachten.'],
      groupIds: ['bauch-brust-trizeps', 'wade'],
      source: 'Hautfalten Notizen S. 7',
    });
  }

  if (topFold.slug === 'brust' && isElevated(f.brust)) {
    const links = [
      isElevated(f.trizeps) && 'Trizeps: Energie/DHEA/Testosteron',
      isElevated(f.bauch) && 'Bauch: Stress/Cortisol',
      isElevated(f.huefte) && 'Hüfte: Glukose/Insulin',
      isElevated(f.ruecken) && 'Rücken: Entzündung',
    ].filter(Boolean);
    push({
      id: 'brust-korrelationen',
      title: 'Brust nicht isoliert bewerten',
      summary: links.length ? `Auffällige Gegenprüfungen: ${links.join(' · ')}.` : 'Die zugeordneten Gegenfalten sind derzeit nicht deutlich auffälliger; Zink-/Aromatase-Kontext bleibt eine mögliche, nicht diagnostische Seminarhypothese.',
      basis: `Brust ${f.brust.value} mm`,
      actions: ['Zuerst Trizeps, Bauch, Hüfte und Rücken als Gegenfalten prüfen.', 'Zinkbedarf nicht allein aus der Falte ableiten; Ernährung und gegebenenfalls Laborwerte einbeziehen.'],
      groupIds: ['bauch-brust-trizeps'],
      source: 'Hautfalten Notizen S. 2',
    });
  }

  if (topFold.slug === 'trizeps' && isElevated(f.trizeps)) {
    push({
      id: 'trizeps-leitfalte',
      title: 'Trizeps als Leitfalte',
      summary: 'Die Unterlagen bezeichnen den Trizeps als wichtigste Falte. Bauch ordnet Stress/Energie ein, Wade den Schlaf und rote Punkte würden auf den Entgiftungszweig verweisen.',
      basis: `Trizeps ${f.trizeps.value} mm · Bauch ${foldState(f.bauch)} · Wade ${foldState(f.wade)}`,
      actions: [
        'Magnesium, Vitamin B6, Zink sowie ausreichendes Cholesterin/Fett in der Ernährung prüfen.',
        'Bauch und Wade als Gegenfalten für Energie/Cortisol und Schlaf verwenden.',
        'Alkoholkonsum als eigenen Einflussfaktor prüfen.',
      ],
      groupIds: ['bauch-brust-trizeps', 'wade'],
      tone: 'attention',
      source: 'Hautfalten Notizen S. 3',
    });
    if (yes(context.redDotsTriceps)) {
      push({
        id: 'trizeps-rote-punkte',
        title: 'Rote Punkte am Trizeps bestätigt',
        summary: 'Dieser sichtbare Befund wird in den Unterlagen dem Leber-/Milz- und Entgiftungskontext zugeordnet und wie die Oberschenkelfalten behandelt.',
        basis: 'Rote Punkte wurden in der Kontextabfrage bestätigt.',
        actions: ['Quadrizeps, Beinbizeps und Knie gegenprüfen.', 'Entgiftungsprotokolle nicht allein aus dem Hautbild starten.'],
        groupIds: ['bauch-brust-trizeps', 'quad-beinbizeps', 'knie'],
        tone: 'branch',
        source: 'Hautfalten Notizen S. 3',
      });
    }
  }

  if (topFold.slug === 'ruecken' && isElevated(f.ruecken)) {
    const links = [
      isElevated(f.bauch) && 'Bauch: Stress/Cortisol',
      isElevated(f.wade) && 'Wade: Schlaf',
      isElevated(f.huefte) && 'Hüfte: Zucker/Blutzucker',
    ].filter(Boolean);
    push({
      id: 'ruecken-gegenpruefung',
      title: 'Rücken mit Bauch, Wade und Hüfte einordnen',
      summary: links.length
        ? `Neben der genetischen Kohlenhydrattoleranz sind folgende Seminar-Gegenprüfungen auffällig: ${links.join(' · ')}.`
        : 'Die Gegenfalten sind nicht erhöht. Damit bleibt die in den Unterlagen beschriebene genetische Kohlenhydrattoleranz die führende, nicht diagnostische Deutung.',
      basis: `Rücken ${f.ruecken.value} mm · Bauch ${foldState(f.bauch)} · Wade ${foldState(f.wade)} · Hüfte ${foldState(f.huefte)}`,
      actions: ['Toxine/Entzündung, Stress, Schlaf, Zuckerzufuhr und Mikronährstoffversorgung getrennt prüfen.', 'Kohlenhydratmenge am Tracker-Verlauf statt an einer einzelnen Falte festlegen.'],
      source: 'Hautfalten Notizen S. 4',
    });
  }

  const legGroup = priorities.find((item) => item.id === 'quad-beinbizeps');
  const legDifference = f.beinbizeps.value - f.quadrizeps.value;
  const legRelationRelevant = legGroup?.priority <= 3 || isElevated(f.quadrizeps) || isElevated(f.beinbizeps);
  if (legRelationRelevant && legDifference > 0) {
    const hamRepeated = topFold.slug === 'beinbizeps'
      && isElevated(topFold)
      && Number(groupOccurrences['quad-beinbizeps']) >= 4;
    push({
      id: 'ham-ueber-quad',
      title: 'Beinbizeps höher als Quadrizeps',
      summary: `Dieses Verhältnis ordnen die Unterlagen stärker dem B‑Vitamin-/Methylierungszweig zu${hamRepeated ? '; weil der Beinbizeps nach den Basisphasen erneut führt, passt zusätzlich der liposomale-Glutathion-Zweig' : ''}.`,
      basis: `Beinbizeps ${f.beinbizeps.value} mm · Quadrizeps ${f.quadrizeps.value} mm`,
      actions: ['MethylKomplex als Phase-4-Variante prüfen.', 'Bei erneut priorisiertem Beinbizeps wird in den Unterlagen liposomales Glutathion genannt.', 'Eine gleichzeitig auffällige Wade stärkt den Schlafbezug.'],
      protocolIds: ['quad-beinbizeps-phase-4-methylkomplex', ...(hamRepeated ? ['quad-beinbizeps-phase-4-lipo-gsh'] : [])],
      groupIds: ['quad-beinbizeps', 'wade'],
      tone: legGroup?.priority === 1 ? 'attention' : 'info',
      source: 'Hautfalten Notizen S. 10–12',
    });
  } else if (legRelationRelevant && legDifference < 0) {
    const bellyTopThree = isTopThree(f.bauch);
    const gutConfirmed = yes(context.digestiveSymptoms) || yes(context.leakyGut);
    const pectasolConfirmed = bellyTopThree && gutConfirmed && yes(context.mercuryContext);
    const quadRepeated = topFold.slug === 'quadrizeps'
      && isElevated(topFold)
      && Number(groupOccurrences['quad-beinbizeps']) >= 4;
    push({
      id: 'quad-ueber-ham',
      title: 'Quadrizeps höher als Beinbizeps',
      summary: `Die Unterlagen verzweigen hier abhängig vom bestätigten Kontext zu Darm/Leaky Gut oder bei erneutem Quadrizeps zu Leber Phase 2${bellyTopThree ? '; Bauch liegt unter den ersten drei und eröffnet bei zusätzlichem Verdauungs-/Quecksilberkontext den Pectasol-Zweig' : ''}.`,
      basis: `Quadrizeps ${f.quadrizeps.value} mm · Beinbizeps ${f.beinbizeps.value} mm · Bauch Rang ${f.bauch.foldPriority}`,
      actions: ['Bei Verdauungs-/Leaky-Gut-Zeichen Glutamin-Zweig prüfen.', 'Wenn Quadrizeps nach früherer Arbeit erneut Priorität wird, Liv.52-Zweig prüfen.', ...(bellyTopThree ? ['Pectasol-Zweig nur nach den vorherigen Basisphasen und passender Darm-/Belastungsanamnese prüfen.'] : [])],
      protocolIds: [
        ...(gutConfirmed ? ['quad-beinbizeps-phase-4-glutamin'] : []),
        ...(quadRepeated ? ['quad-beinbizeps-phase-4-liv52'] : []),
        ...(pectasolConfirmed ? ['quad-beinbizeps-phase-4-pectasol'] : []),
      ],
      groupIds: ['quad-beinbizeps', 'bauch-brust-trizeps'],
      tone: legGroup?.priority === 1 ? 'attention' : 'info',
      requiresConfirmation: !quadRepeated && !answered(context.digestiveSymptoms) && !answered(context.leakyGut),
      source: 'Hautfalten Notizen S. 10–12',
    });
  } else if (legRelationRelevant) {
    push({
      id: 'quad-ham-ausgeglichen',
      title: 'Vorder- und hintere Oberschenkelfalte ähnlich',
      summary: 'Aus dem Verhältnis ergibt sich aktuell kein klarer B‑Vitamin- oder Darm-/Leber-Zweig. Verlauf und Symptome entscheiden.',
      basis: `Quadrizeps ${f.quadrizeps.value} mm · Beinbizeps ${f.beinbizeps.value} mm`,
      groupIds: ['quad-beinbizeps'],
      source: 'Hautfalten Notizen S. 11–12',
    });
  }

  if (topFold.slug === 'wade' && isElevated(f.wade)) {
    const hamProminent = isElevated(f.beinbizeps);
    const bothLegsProminent = hamProminent && isElevated(f.quadrizeps);
    const glycinConfirmed = bothLegsProminent && yes(context.sleepOnset);
    const neuromagConfirmed = yes(context.sleepOnset) && yes(context.sleepMaintenance) && gabaContext;
    const taurinConfirmed = yes(context.sleepOnset) && gabaContext;
    const melatoninConfirmed = yes(context.sleepOnset) && serotoninContext;
    const greensConfirmed = yes(context.wakes3to7) || yes(context.sleepMaintenance);
    push({
      id: bothLegsProminent ? 'wade-quad-ham' : hamProminent ? 'wade-ham' : 'wade-schlafzweige',
      title: bothLegsProminent ? 'Wade mit beiden Oberschenkelfalten' : hamProminent ? 'Wade mit Beinbizeps' : 'Wade priorisiert',
      summary: bothLegsProminent
        ? `Diese Kombination führt bei bestätigtem Einschlafproblem zum Glycin-Zweig${glycinConfirmed ? ' – der Kontext ist bestätigt' : ''}.`
        : hamProminent ? 'Diese Kombination führt in den Unterlagen zum MethylKomplex-Zweig.' : 'Für Phase 4 muss zwischen Einschlafen, Durchschlafen, GABA- und Serotonin-Kontext unterschieden werden.',
      basis: `Wade ${f.wade.value} mm · Quadrizeps ${f.quadrizeps.value} mm · Beinbizeps ${f.beinbizeps.value} mm`,
      actions: bothLegsProminent
        ? ['Einschlafproblem bestätigen.', 'Glycin-Variante nur dann prüfen; Dosis einschleichen und Verträglichkeit beachten.']
        : hamProminent ? ['MethylKomplex-Variante prüfen.'] : ['Schlecht zur Ruhe/GABA: Neuromag oder Taurin prüfen.', 'Serotoninbezogenes Einschlafen: liposomales Melatonin prüfen.', 'Aufwachen zwischen 3–7 Uhr: Greens, gegebenenfalls mit Chlorella, prüfen.'],
      protocolIds: bothLegsProminent
        ? (glycinConfirmed ? ['wade-phase-4-glycin'] : [])
        : hamProminent ? ['wade-phase-4-methylkomplex'] : [
          ...(neuromagConfirmed ? ['wade-phase-4-neuromag'] : []),
          ...(taurinConfirmed ? ['wade-phase-4-taurin'] : []),
          ...(melatoninConfirmed ? ['wade-phase-4-lipo-melatonin'] : []),
          ...(greensConfirmed ? ['wade-phase-4-greens'] : []),
        ],
      groupIds: ['wade', 'quad-beinbizeps'],
      tone: 'branch',
      requiresConfirmation: bothLegsProminent
        ? !answered(context.sleepOnset)
        : !hamProminent && ![context.sleepOnset, context.sleepMaintenance, context.wakes3to7].some(answered),
      source: 'Hautfalten Notizen S. 8–9; Körperfett-Assessment S. 14',
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
      source: 'Körperfett-Assessment, handschriftliche Seminarregel S. 15',
    });
  }

  if (topFold.slug === 'rippe' && isElevated(f.rippe)) {
    const repeatedFoodsConfirmed = yes(context.repeatedFoods);
    push({
      id: 'rippe-gegenpruefung',
      title: 'Rippe ist die priorisierte Falte',
      summary: `Die Unterlagen verknüpfen sie mit Schilddrüse/Stoffwechsel, verlangen aber Gegenprüfungen für Stress, Toxine, Schlaf, Zucker und wiederholte Lebensmittel${repeatedFoodsConfirmed ? '; häufig wiederholte Lebensmittel beziehungsweise Unverträglichkeitskontext wurden bestätigt' : ''}.`,
      basis: `Rippe ${f.rippe.value} mm · Abweichung ${f.rippe.score} ${f.rippe.richtung === 'unter' ? 'unter' : 'über'} Referenz${repeatedFoodsConfirmed ? ' · Lebensmittelkontext bestätigt' : ''}`,
      actions: ['Bauch/Trizeps für Stress und Energie prüfen.', 'Bein-/Wadenfalten für Toxine und Schlaf prüfen.', 'Hüfte für Zucker-/Blutzuckerkontext prüfen.', repeatedFoodsConfirmed ? 'Eine zeitlich begrenzte, fachlich geplante Rotationsstrategie und konkrete Verträglichkeit beobachten.' : 'Erfassen, ob sehr häufig dieselben Lebensmittel gegessen werden oder reproduzierbare Unverträglichkeiten auftreten.'],
      tone: repeatedFoodsConfirmed ? 'attention' : 'branch',
      requiresConfirmation: !answered(context.repeatedFoods),
      source: 'Hautfalten Notizen S. 5',
    });
  }

  if (topFold.slug === 'knie' && isElevated(f.knie)) {
    push({
      id: 'knie-oberschenkel',
      title: 'Knie mit den Oberschenkelfalten einordnen',
      summary: 'Knie wird der hepatischen Phase 1 zugeordnet und korreliert laut Unterlagen mit den Oberschenkelfalten, die Darm und Leber-Phase-2 ergänzen.',
      basis: `Knie ${f.knie.value} mm · Quadrizeps ${foldState(f.quadrizeps)} · Beinbizeps ${foldState(f.beinbizeps)}`,
      actions: ['Mikronährstoff- und Antioxidanzienbasis prüfen.', 'Bei gleichzeitig erhöhten Beinfalten Umweltgifte, Darm, Proteinfrühstück und Leber-Phase 2 mitbewerten.'],
      groupIds: ['knie', 'quad-beinbizeps'],
      tone: 'attention',
      source: 'Hautfalten Notizen S. 8 und S. 10',
    });
  }

  if (topFold.slug === 'bizeps' && isElevated(f.bizeps)) {
    const sleepLinked = isElevated(f.wade) || isElevated(f.quadrizeps) || isElevated(f.beinbizeps);
    push({
      id: 'bizeps-trizeps-schlaf',
      title: 'Bizeps mit Trizeps und Schlaffalten einordnen',
      summary: `Bizeps wird dem freien Testosteron zugeordnet. Trizeps ergänzt DHEA/Gesamttestosteron${sleepLinked ? '; erhöhte Waden-/Beinfalten stützen zusätzlich den Schlafkontext' : ''}.`,
      basis: `Bizeps ${f.bizeps.value} mm · Trizeps ${foldState(f.trizeps)} · Wade ${foldState(f.wade)} · Quadrizeps ${foldState(f.quadrizeps)} · Beinbizeps ${foldState(f.beinbizeps)}`,
      actions: ['Energie-/DHEA-Kontext über Trizeps prüfen.', 'Schlafdefizit nur bei passender Waden- und Beinfaltenlage beziehungsweise Schlafsymptomatik annehmen.'],
      groupIds: ['bauch-brust-trizeps', 'wade', 'quad-beinbizeps'],
      source: 'Hautfalten Notizen S. 11',
    });
  }

  if (['kinn', 'wange'].includes(topFold.slug) && context.previousFolds) {
    const chinDelta = f.kinn.value - Number(context.previousFolds.kinn);
    const cheekDelta = f.wange.value - Number(context.previousFolds.wange);
    if (Number.isFinite(chinDelta) && Number.isFinite(cheekDelta)) {
      const sameDirection = Math.sign(chinDelta) === Math.sign(cheekDelta);
      push({
        id: 'kinn-wange-verlauf',
        title: 'Kinn und Wange als globales Verlaufspaar',
        summary: sameDirection
          ? 'Beide Falten bewegen sich in dieselbe Richtung. Das entspricht der Seminarbeschreibung als frühe Marker einer globalen Fettzu- oder -abnahme.'
          : 'Kinn und Wange bewegen sich nicht gemeinsam. Eine globale Zu-/Abnahme ist daraus noch nicht eindeutig; Messschwankung und Kurzzeitstress mitprüfen.',
        basis: `Kinn ${chinDelta >= 0 ? '+' : ''}${chinDelta.toFixed(1)} mm · Wange ${cheekDelta >= 0 ? '+' : ''}${cheekDelta.toFixed(1)} mm gegenüber der vorherigen vollständigen Messung`,
        actions: ['Kalorien nur zusammen mit Gewichtstrend und 10-Falten-Summe anpassen.', 'Bei uneinheitlichem Verlauf Messbedingungen und Kurzzeitstress prüfen.'],
        tone: sameDirection ? 'info' : 'branch',
        source: 'Hautfalten Notizen S. 1; „Was deine Hautfalten über dich aussagen“ S. 1',
      });
    }
  }

  return relations;
}

const completeHistory = (history = [], calculationBasis = 'male') => history
  .filter((row) => assessSkinfoldPriorities(row?.falten, calculationBasis).length)
  .sort((a, b) => String(a.gemessen_am || '').localeCompare(String(b.gemessen_am || '')));

export function buildSkinfoldPlan(history = [], calculationBasis = 'male', context = {}) {
  const rows = completeHistory(history, calculationBasis);
  if (!rows.length) return null;
  const occurrences = {};
  let priorities = [];
  rows.forEach((row) => {
    priorities = assessSkinfoldPriorities(row.falten, calculationBasis);
    const ranked = rankSkinfolds(row.falten, calculationBasis);
    const topFold = ranked[0];
    const activeGroup = topFold?.richtung === 'ueber'
      ? priorities.find((priority) => priority.falten.includes(topFold.slug))
      : null;
    if (activeGroup) occurrences[activeGroup.id] = (occurrences[activeGroup.id] || 0) + 1;
  });
  const current = rows.at(-1);
  const rankedFolds = rankSkinfolds(current.falten, calculationBasis);
  const topFold = rankedFolds[0];
  const activeProtocolGroup = topFold?.richtung === 'ueber'
    ? priorities.find((priority) => priority.falten.includes(topFold.slug)) || null
    : null;
  const previous = rows.at(-2);
  const relationships = buildSkinfoldRelationships(current.falten, calculationBasis, priorities, {
    ...context,
    groupOccurrences: occurrences,
    previousFolds: previous?.falten || null,
  });
  const enriched = priorities.map((priority) => {
    const previousOccurrences = occurrences[priority.id] || 0;
    const isActive = priority.id === activeProtocolGroup?.id;
    const requestedPhase = isActive ? Math.max(1, previousOccurrences) : Math.max(1, previousOccurrences + 1);
    const documentedMaxPhase = Math.max(1, ...priority.protocols.map((item) => Number(item.phase) || 0));
    const suggestedPhase = Math.min(documentedMaxPhase, requestedPhase);
    const holdsAtLastDocumentedPhase = requestedPhase > documentedMaxPhase;
    const phaseProtocols = priority.protocols.filter((item) => Number(item.phase) === suggestedPhase);
    const relationProtocolIds = new Set(relationships.flatMap((item) => item.protocolIds));
    const recommendedProtocols = !isActive
      ? []
      : suggestedPhase < 4
        ? phaseProtocols.slice(0, 1)
        : phaseProtocols.filter((item) => relationProtocolIds.has(item.id));
    return {
      ...priority,
      isActive,
      occurrences: previousOccurrences,
      suggestedPhase,
      documentedMaxPhase,
      holdsAtLastDocumentedPhase,
      phaseProtocols,
      recommendedProtocols,
      relationships: relationships.filter((item) => item.groupIds.includes(priority.id)),
    };
  });
  return {
    date: current.gemessen_am,
    priorities: enriched,
    // Die sichtbare Hauptpriorität ist Rang 1 der Excel-Formel über alle
    // dreizehn Falten. Die führende Protokollfalte bleibt separat erhalten.
    topFold,
    topProtocolFold: activeProtocolGroup?.primaryFold || null,
    activeProtocolGroup: activeProtocolGroup ? enriched.find((item) => item.id === activeProtocolGroup.id) : null,
    overallTopFold: topFold,
    rankedFolds,
    relationships,
    occurrences,
  };
}

const planAction = (text, source = 'seminar', evidence = null) => ({ text, source, evidence });

/**
 * Übersetzt Rang, Mehrfaltenregeln und beantworteten Kontext in einen bewusst
 * kurzen Handlungsplan. Nur die insgesamt führende, erhöhte Protokollgruppe
 * darf einen Supplement-Schritt auslösen; die übrigen vier bleiben Beobachtung.
 */
export function buildSkinfoldActionPlan(plan, context = {}) {
  if (!plan) return null;
  const top = plan.topFold;
  const active = plan.activeProtocolGroup;
  const groupId = active?.id || null;
  const actionableTop = top.richtung === 'ueber';
  const requiredQuestionIds = new Set();
  const categories = {
    nutrition: [],
    dailyLife: [],
    sleep: [],
    supplements: [],
  };
  const add = (category, text, source = 'seminar', evidence = null) => {
    if (!categories[category].some((item) => item.text === text)) categories[category].push(planAction(text, source, evidence));
  };
  const requireAnswers = (...ids) => ids.forEach((id) => requiredQuestionIds.add(id));
  const fold = (slug) => plan.rankedFolds.find((item) => item.slug === slug);
  const elevated = (slug) => isElevated(fold(slug));

  add('nutrition', 'Lass dein Kalorienziel zunächst unverändert und beurteile es weiter über TRACKER, Gewichtstrend und 10-Falten-Summe – nicht über eine einzelne Falte.', 'app');
  add('dailyLife', 'Setze für die nächsten drei bis vier Wochen nur diesen Schwerpunkt um, dokumentiere kurz die Umsetzung und miss dann unter ähnlichen Bedingungen erneut.', 'app');

  if (['bauch-brust-trizeps', 'huefte'].includes(groupId) || (actionableTop && ['bauch', 'brust', 'trizeps', 'huefte', 'ruecken', 'rippe'].includes(top.slug))) {
    requireAnswers('mealsIrregular', 'postMealCrash');
  }
  if (groupId === 'bauch-brust-trizeps' || (actionableTop && ['bauch', 'brust', 'trizeps'].includes(top.slug))) {
    requireAnswers('stressHigh', 'wakesFit', 'morningDriveLow', 'troubleWindingDown', 'sleepOnset', 'sleepMaintenance', 'digestiveSymptoms');
    add('nutrition', 'Plane drei verlässliche Mahlzeiten mit einer klaren Proteinquelle; prüfe anhand von Hunger und Energie, ob sehr lange Essenspausen oder zu knappe Mahlzeiten dein Problem verstärken.', 'seminar');
    if (elevated('huefte') || yes(context.mealsIrregular) || yes(context.postMealCrash)) {
      add('nutrition', 'Verteile die Mahlzeiten für zwei Wochen regelmäßiger und gehe direkt nach der größten Mahlzeit etwa 10 bis 15 Minuten zügig spazieren.', 'evidence', 'postMealMovement');
    }
    if (yes(context.stressHigh) || yes(context.troubleWindingDown)) {
      add('dailyLife', 'Mache täglich zehn Minuten eine geführte Achtsamkeitsmeditation oder ruhige Atemübung und notiere davor und danach deine Anspannung von 0 bis 5.', 'evidence', 'mindfulness');
      add('dailyLife', 'Reduziere für zwei Wochen einen konkret benannten, vermeidbaren Stressor statt nur allgemein „weniger Stress“ anzustreben.', 'app');
    } else if (!answered(context.stressHigh)) {
      add('dailyLife', 'Beantworte zuerst die Stressfrage. Erst danach entscheidet die App, ob Meditation und Stressmanagement dein Haupthebel sind.', 'app');
    }
    if (yes(context.digestiveSymptoms)) {
      add('nutrition', 'Führe 14 Tage ein Symptomprotokoll mit Mahlzeit, Uhrzeit und Beschwerden. Streiche nicht mehrere Lebensmittelgruppen gleichzeitig; reproduzierbare oder anhaltende Beschwerden fachlich abklären.', 'evidence', 'digestiveDiary');
    }
  }

  if (groupId === 'huefte' || (actionableTop && top.slug === 'huefte')) {
    requireAnswers('mealsIrregular', 'postMealCrash');
    add('nutrition', 'Iss für zwei Wochen zu ähnlichen Zeiten und kombiniere jede Hauptmahlzeit mit Protein und ballaststoffreichen Lebensmitteln.', 'seminar');
    add('nutrition', 'Gehe direkt nach mindestens einer Hauptmahlzeit etwa 10 bis 15 Minuten zügig spazieren.', 'evidence', 'postMealMovement');
    add('dailyLife', 'Unterbrich längere Sitzphasen regelmäßig und sammle über die Woche mindestens 150 Minuten moderate Bewegung; Krafttraining zählt zusätzlich.', 'evidence', 'movement');
  }

  if (groupId === 'wade' || groupId === 'quad-beinbizeps' || (actionableTop && ['wade', 'quadrizeps', 'beinbizeps', 'knie', 'bizeps'].includes(top.slug))) {
    requireAnswers('sleepOnset', 'sleepMaintenance', 'wakes3to7', 'caffeineLate', 'alcoholNearBed', 'snoringBreathing');
  }
  if (groupId === 'quad-beinbizeps' || groupId === 'knie' || (actionableTop && ['quadrizeps', 'beinbizeps', 'knie'].includes(top.slug))) {
    requireAnswers('digestiveSymptoms', 'leakyGut', 'mercuryContext', 'alcoholNearBed');
    add('nutrition', 'Sichere täglich ausreichendes Protein und eine abwechslungsreiche Lebensmittelauswahl; starte keine pauschale „Entgiftungsdiät“ allein aufgrund der Faltenwerte.', 'seminar');
    add('dailyLife', 'Bewege dich täglich und reduziere vermeidbaren Alkoholkonsum sowie unnötige Expositionen schrittweise, ohne daraus eine medizinische „Entgiftung“ abzuleiten.', 'seminar');
    add('dailyLife', 'Sammle über die Woche mindestens 150 Minuten moderate Bewegung und ergänze an mindestens zwei Tagen Krafttraining.', 'evidence', 'movement');
  }
  if (actionableTop && top.slug === 'trizeps') requireAnswers('redDotsTriceps', 'alcoholNearBed');
  if (actionableTop && top.slug === 'rippe') requireAnswers('repeatedFoods', 'digestiveSymptoms');

  if (actionableTop && top.slug === 'ruecken') {
    requireAnswers('stressHigh', 'sleepOnset', 'sleepMaintenance');
    add('nutrition', 'Halte deine Kohlenhydratmenge zunächst zwei Wochen möglichst konstant und notiere zu den Hauptmahlzeiten grob Portion, Hunger, Energie und Trainingsleistung.', 'seminar');
    add('nutrition', 'Reduziere Kohlenhydrate nicht allein wegen der Rückenfalte. Ändere die Menge erst, wenn TRACKER, Gewichtsverlauf, Hunger und Leistung gemeinsam dafür sprechen.', 'app');
  }
  if (actionableTop && top.slug === 'rippe') {
    if (yes(context.repeatedFoods) || yes(context.digestiveSymptoms)) {
      add('nutrition', 'Führe 14 Tage ein Ernährungs- und Symptomtagebuch. Verändere immer nur einen Verdachtsfaktor und besprich größere Ausschlussdiäten fachlich.', 'evidence', 'digestiveDiary');
    } else if (!answered(context.repeatedFoods) || !answered(context.digestiveSymptoms)) {
      add('nutrition', 'Beantworte zuerst die Fragen zu häufig wiederholten Lebensmitteln und Verdauungsbeschwerden; ohne diese Antworten bleibt der Ernährungszweig offen.', 'app');
    }
  }
  if (actionableTop && top.slug === 'bizeps') {
    add('nutrition', 'Prüfe für zwei Wochen, ob Kalorienziel, Protein und Nahrungsfette tatsächlich erreicht werden; leite aus der Bizepsfalte allein keinen Hormonmangel ab.', 'seminar');
  }
  if (actionableTop && ['kinn', 'wange'].includes(top.slug)) {
    add('dailyLife', 'Bewerte Kinn und Wange nur als gemeinsames Verlaufspaar. Ändere erst etwas, wenn auch Gewichtstrend oder 10-Falten-Summe dieselbe Richtung bestätigen.', 'seminar');
  }

  const sleepRelevant = groupId === 'wade'
    || ['bauch-brust-trizeps', 'quad-beinbizeps'].includes(groupId)
    || (actionableTop && ['wade', 'quadrizeps', 'beinbizeps', 'bauch', 'brust', 'trizeps', 'bizeps', 'ruecken'].includes(top.slug));
  if (sleepRelevant) {
    if (yes(context.sleepOnset) || yes(context.sleepMaintenance)) requireAnswers('caffeineLate', 'alcoholNearBed', 'snoringBreathing');
    if (yes(context.sleepOnset)) {
      add('sleep', 'Halte zwei Wochen eine feste Aufstehzeit ein und beginne 30 bis 60 Minuten vor dem Schlafen eine ruhige, möglichst gleichbleibende Abendroutine.', 'evidence', 'insomnia');
      add('sleep', 'Wenn du länger wach im Bett liegst, stehe kurz auf und kehre erst bei Schläfrigkeit zurück. Das ist ein Element der Stimulus-Kontrolle.', 'evidence', 'insomnia');
    }
    if (yes(context.sleepMaintenance)) {
      add('sleep', 'Halte die Aufstehzeit auch nach einer schlechten Nacht stabil und dokumentiere zwei Wochen lang Wachphasen, Alkohol und Koffein statt die Bettzeit immer weiter auszudehnen.', 'evidence', 'insomnia');
    }
    if (yes(context.wakes3to7)) {
      add('sleep', 'Notiere Uhrzeit und Dauer des Aufwachens. Die Zuordnung zu „3–7 Uhr“ stammt aus dem Seminar; sie beweist kein Organ- oder Darmproblem.', 'seminar');
    }
    if (yes(context.caffeineLate)) add('sleep', 'Verlege Koffein für zwei Wochen vollständig aus den letzten acht Stunden vor deiner geplanten Schlafenszeit.', 'evidence', 'sleepHabits');
    if (yes(context.alcoholNearBed)) add('sleep', 'Lass Alkohol in den letzten vier Stunden vor dem Schlafen für zwei Wochen weg und vergleiche nächtliche Wachphasen und Morgenenergie.', 'evidence', 'sleepHabits');
    if (yes(context.snoringBreathing)) add('sleep', 'Lautes Schnarchen oder beobachtete Atempausen gehören medizinisch abgeklärt; ein Supplement-Protokoll ersetzt keine Schlafdiagnostik.', 'evidence', 'sleepApnea');
    if ([context.sleepOnset, context.sleepMaintenance].every((value) => value === false)) {
      add('sleep', 'Du hast weder Ein- noch Durchschlafprobleme angegeben. Deshalb wird aktuell kein verhaltensbezogener Schlafzweig empfohlen.', 'app');
    } else if (![context.sleepOnset, context.sleepMaintenance].some(answered)) {
      add('sleep', 'Beantworte zuerst getrennt, ob Einschlafen oder Durchschlafen dein Problem ist. Ohne diese Antwort bleibt der Schlafzweig offen.', 'app');
    }
    if (yes(context.sleepOnset) || yes(context.sleepMaintenance)) {
      add('sleep', 'Wenn Schlafprobleme an mindestens drei Nächten pro Woche über Monate bestehen oder dich tagsüber stark beeinträchtigen, lass sie abklären; bei chronischer Insomnie ist CBT‑I die empfohlene Erstbehandlung.', 'evidence', 'insomnia');
    }
  } else {
    add('sleep', 'Aktuell ergibt sich aus Priorität 1 kein eigener Schlafschwerpunkt. Behalte Schlafqualität und Morgenenergie als Verlaufskontrolle im Blick.', 'app');
  }

  const protocols = active?.recommendedProtocols || [];
  if (!active) {
    add('supplements', top.richtung === 'ueber'
      ? `${top.label} ist zwar Rang 1, gehört aber zu keiner chronologischen Supplement-Protokollgruppe. Starte deshalb keine der anderen vier Gruppen.`
      : 'Rang 1 liegt nicht über dem Referenzmittel. Daraus wird kein Supplement-Protokoll gestartet.', 'app');
  } else if (active.suggestedPhase < 4) {
    add('supplements', `Nur ${active.label}, Phase ${active.suggestedPhase}, ist jetzt aktiv. Die vier anderen Gruppen werden lediglich beobachtet.`, 'seminar');
  } else if (!protocols.length) {
    add('supplements', 'Phase 4+ ist erreicht, aber noch keine Variante ist durch deine Antworten eindeutig bestätigt. Starte noch keine neue Supplement-Kombination.', 'app');
    if (yes(context.sleepOnset) && !yes(context.bravermanCompleted)) {
      add('supplements', 'Du hast ein Einschlafproblem angegeben. Schließe zusätzlich das Braverman-Defizitprofil ab, bevor die App GABA- und Serotoninvarianten des Seminars unterscheidet.', 'app');
    }
  } else if (protocols.length === 1) {
    add('supplements', `Als einzige aktuelle Seminar-Option passt „${protocols[0].name}“. Prüfe Dosierung, Medikamente und Kontraindikationen vor der Einnahme fachlich.`, 'seminar');
  } else {
    add('supplements', 'Mehrere Phase-4+-Bedingungen treffen zu. Sie sind Alternativen, keine gemeinsame Einnahmeanweisung; wähle sie erst nach fachlicher Prüfung.', 'app');
  }

  const required = [...requiredQuestionIds];
  const unansweredQuestionIds = required.filter((id) => !answered(context[id]));
  const focusTitle = active
    ? `${active.label}: nur Phase ${active.suggestedPhase === 4 ? '4+' : active.suggestedPhase} bearbeiten`
    : top.richtung === 'ueber'
      ? `${top.label}: Gegenprüfungen bearbeiten, kein Supplement-Protokoll starten`
      : `${top.label}: Verlauf beobachten, kein Fettabbau-Protokoll starten`;
  return {
    focusTitle,
    summary: active
      ? `Priorität 1 ist ${top.label}. Nur die zugehörige Gruppe ${active.label} ist aktiv; die übrigen vier Gruppen sind derzeit reine Beobachtung.`
      : `Priorität 1 ist ${top.label}. Daraus wird aktuell keine andere Protokollgruppe ersatzweise aktiviert.`,
    requiredQuestionIds: required,
    unansweredQuestionIds,
    categories,
    protocols,
  };
}

export function protocolForPhase(priority, phase = 1) {
  const candidates = priority?.protocols?.filter((protocol) => Number(protocol.phase) === Number(phase)) || [];
  return candidates[0] || null;
}

export function supplementName(slug) {
  const name = supplementKatalog.supplemente?.[slug]?.name
    || SUPPLEMENT_NAMEN[slug]
    || String(slug).replaceAll('-', ' ').replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
  return name.replace(/^YPSI\s+/i, '');
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
