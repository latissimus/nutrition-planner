import { FALTEN } from './measurements.js';
import hautfaltenData from './data/hautfalten.json';
import ypsiProtokolle from './data/ypsi-protokolle.json';
import supplementKatalog from './data/supplements-katalog.json';
import { BRAVERMAN_BEREICHE, BRAVERMAN_DEFIZIT_FRAGEN, BRAVERMAN_REIHENFOLGE } from './data/braverman-test.js';

const PROTOKOLL_GRUPPEN = Object.freeze([
  { id: 'bauch-brust', label: 'Bauch & Brust', falten: ['bauch', 'brust'] },
  { id: 'huefte', label: 'Hüfte', falten: ['huefte'] },
  { id: 'wade', label: 'Wade', falten: ['wade'] },
  { id: 'quad-beinbizeps', label: 'Vorderer & hinterer Oberschenkel', falten: ['quadrizeps', 'beinbizeps'] },
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

export function assessSkinfoldPriorities(folds = {}, calculationBasis = 'male') {
  const sex = assessmentSex(calculationBasis);
  const allValues = FALTEN.map(([slug]) => Number(folds?.[slug])).filter((value) => Number.isFinite(value) && value >= 0);
  if (allValues.length !== FALTEN.length) return [];
  const typical = Math.max(1, median(allValues));

  return PROTOKOLL_GRUPPEN.map((group) => {
    const details = group.falten.map((slug) => {
      const value = Number(folds[slug]);
      const norm = hautfaltenData.falten[slug]?.norm?.[`${sex}_mm`];
      const relative = Number.isFinite(Number(norm)) && Number(norm) > 0 ? value / Number(norm) : value / typical;
      return { slug, label: hautfaltenData.falten[slug]?.label || slug, value, relative };
    });
    const score = Math.max(...details.map((item) => item.relative));
    const protocols = Object.values(ypsiProtokolle.protokolle)
      .filter((protocol) => protocol.gruppe === group.id)
      .sort((a, b) => Number(a.phase) - Number(b.phase));
    return { ...group, score, details, protocols };
  }).sort((a, b) => b.score - a.score).map((item, index) => ({ ...item, priority: index + 1 }));
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
