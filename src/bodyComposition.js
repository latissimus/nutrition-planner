const DAY_MS = 86_400_000;

const numeric = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const dayNumber = (iso) => Math.floor(new Date(`${iso}T12:00:00`).getTime() / DAY_MS);
const rounded = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const BODYCOMP_THRESHOLDS = Object.freeze({
  stableLoss: -0.15,
  slowLoss: -0.5,
  stableGain: 0.15,
  slowGain: 0.3,
});

export const BODY_EXPLANATIONS = Object.freeze({
  dailyWeight: 'Das Tagesgewicht schwankt unter anderem durch Wasser, Salz, Kohlenhydrate, Verdauungsinhalt und Training. MUSCLEDEX bewertet deshalb nicht einzelne Messungen, sondern den geglätteten Verlauf.',
  average7: 'Der 7-Tage-Schnitt reduziert tägliche Schwankungen und zeigt die kurzfristige Gewichtsentwicklung.',
  trend28: 'Der 28-Tage-Trend hilft zu beurteilen, ob dein Gewicht langfristig stabil bleibt, langsam fällt oder steigt.',
  weighingFrequency: 'Drei Wiegungen pro Woche reichen für eine grundlegende Verlaufskontrolle. Fünf bis sieben Wiegungen verbessern die Kalorienkalibrierung. Wiege dich möglichst morgens nach dem Toilettengang und vor dem Essen.',
  skinfolds: 'Die 12-Falten-Summe ist ein Verlaufswert für das Unterhautfett. Sie ist keine direkte Messung des Körperfettanteils. Vergleiche sind nur sinnvoll, wenn die Messungen unter ähnlichen Bedingungen durchgeführt werden.',
  waist: 'Der Taillenumfang ergänzt die Hautfaltenmessung. Er kann Veränderungen im Bauchbereich zeigen, wird aber ebenfalls durch Messposition, Verdauung und Atmung beeinflusst.',
  performance: 'Steigende Kraft kann durch Muskelaufbau, bessere Technik oder neuronale Anpassungen entstehen. MUSCLEDEX verwendet die LOGMAN-Leistung deshalb nur gemeinsam mit Körper- und Erholungswerten.',
  recovery: 'Schlaf und Erholung beweisen keinen Muskelaufbau. Sie zeigen, ob die Voraussetzungen für Training, Regeneration und eine kontrollierte Diät wahrscheinlich ausreichend sind.',
  initialCalories: 'Dieser Wert ist zunächst eine Schätzung aus Alter, Größe, Gewicht und Aktivität. Er ist kein gemessener Stoffwechselwert. Mit ausreichend protokollierten Ernährungs- und Gewichtsdaten kann MUSCLEDEX die Schätzung später vorsichtig an deinen tatsächlichen Verlauf anpassen.',
});

export function ageOnDate(birthDate, reference = new Date()) {
  if (!birthDate) return 0;
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;
  let age = reference.getFullYear() - birth.getFullYear();
  if (reference.getMonth() < birth.getMonth()
    || (reference.getMonth() === birth.getMonth() && reference.getDate() < birth.getDate())) age -= 1;
  return age >= 14 && age <= 100 ? age : 0;
}

export function mifflinStJeor({ calculationBasis, birthDate, heightCm, weightKg, referenceDate }) {
  const age = ageOnDate(birthDate, referenceDate || new Date());
  const height = numeric(heightCm);
  const weight = numeric(weightKg);
  if (!age || !height || !weight || height <= 0 || weight <= 0) return null;
  const sexOffset = calculationBasis === 'female' ? -161 : 5;
  return { age, resting: 10 * weight + 6.25 * height - 5 * age + sexOffset };
}

export function initialEnergyEstimate(input) {
  const base = mifflinStJeor(input);
  if (!base) return null;
  const weight = numeric(input.weightKg);
  const pal = numeric(input.pal) || 1.6;
  const maintenance = base.resting * pal;
  const adjustments = { lose: -300, maintain: 0, gain: 200, gain_fast: 350, bodycomp: 0 };
  const target = Math.max(1200, maintenance + (adjustments[input.goal] || 0));
  // Eine alltagstaugliche Spanne macht sichtbar, dass PAL und Formel keine Messung sind.
  const uncertainty = Math.max(150, maintenance * 0.1);
  return {
    method: 'Mifflin–St. Jeor',
    age: base.age,
    resting: Math.round(base.resting),
    maintenance: Math.round(maintenance),
    maintenanceRange: [Math.round(maintenance - uncertainty), Math.round(maintenance + uncertainty)],
    target: Math.round(target),
    protein: Math.round(weight * 1.8),
    fat: Math.round(weight * 0.8),
    carbs: Math.round(Math.max(0, (target - weight * 1.8 * 4 - weight * 0.8 * 9) / 4)),
  };
}

export function goalWeightInterpretation(trend, goal = 'maintain') {
  const category = trend?.category || 'unklar';
  if (category === 'unklar' || trend?.confidence === 'niedrig') {
    return { tone: 'neutral', label: 'Noch nicht eindeutig', text: 'Für eine belastbare Einordnung fehlen noch regelmäßige Messungen.' };
  }
  if (goal === 'bodycomp') return {
    tone: 'neutral', label: 'Gewicht als Kontextwert',
    text: 'Im BodyComp-Modus wird dieser Trend nicht allein als Erfolg oder Misserfolg bewertet.',
  };
  const favorable = {
    lose: ['langsamer_verlust'], maintain: ['stabil'], gain: ['langsame_zunahme'], gain_fast: ['langsame_zunahme', 'schnelle_zunahme'],
  }[goal] || ['stabil'];
  const labels = {
    stabil: 'Gewicht weitgehend stabil', langsamer_verlust: 'Langsamer Gewichtsverlust',
    zu_schneller_verlust: 'Schneller Gewichtsverlust', langsame_zunahme: 'Langsame Gewichtszunahme',
    schnelle_zunahme: 'Schnelle Gewichtszunahme',
  };
  return {
    tone: favorable.includes(category) ? 'favorable' : 'attention',
    label: labels[category] || 'Noch nicht eindeutig',
    text: favorable.includes(category)
      ? 'Der geglättete Verlauf liegt im gewählten Zielbereich.'
      : 'Der Verlauf weicht vom gewählten Zielbereich ab. Einzelne Tage lösen keine Anpassung aus.',
  };
}

export function movingWeightAverage(weights = [], windowDays = 7) {
  const sorted = weights
    .map((row) => ({ date: row.date || row.datum || row.gemessen_am, kg: numeric(row.kg) }))
    .filter((row) => row.date && row.kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((row, index) => {
    const end = dayNumber(row.date);
    const window = sorted.slice(0, index + 1).filter((candidate) => end - dayNumber(candidate.date) < windowDays);
    return { date: row.date, kg: window.reduce((sum, item) => sum + item.kg, 0) / window.length };
  });
}

function regression(points) {
  if (points.length < 2) return null;
  const x0 = dayNumber(points[0].date);
  const values = points.map((point) => ({ x: dayNumber(point.date) - x0, y: point.kg }));
  const meanX = values.reduce((sum, point) => sum + point.x, 0) / values.length;
  const meanY = values.reduce((sum, point) => sum + point.y, 0) / values.length;
  const denominator = values.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (!denominator) return null;
  const slope = values.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator;
  return { slopePerDay: slope, first: meanY + slope * (values[0].x - meanX), last: meanY + slope * (values.at(-1).x - meanX) };
}

export function weightTrendSummary(weights = [], thresholds = BODYCOMP_THRESHOLDS) {
  const trend = movingWeightAverage(weights, 7);
  if (!trend.length) return { confidence: 'niedrig', measurementsPerWeek: 0, category: 'unklar' };
  const lastDay = dayNumber(trend.at(-1).date);
  const recent = trend.filter((point) => lastDay - dayNumber(point.date) <= 27);
  const model = regression(recent);
  const rawDates = new Set(weights
    .map((row) => row.date || row.datum || row.gemessen_am)
    .filter((date) => date && lastDay - dayNumber(date) <= 27));
  const span = recent.length > 1 ? Math.max(1, lastDay - dayNumber(recent[0].date) + 1) : 1;
  const measurementsPerWeek = rawDates.size / span * 7;
  const confidence = measurementsPerWeek >= 5 ? 'hoch' : measurementsPerWeek >= 3 ? 'mittel' : 'niedrig';
  const weeklyKg = model ? model.slopePerDay * 7 : 0;
  const referenceKg = trend.at(-1).kg;
  const weeklyPercent = referenceKg ? weeklyKg / referenceKg * 100 : 0;
  let category = 'stabil';
  if (weeklyPercent < thresholds.slowLoss) category = 'zu_schneller_verlust';
  else if (weeklyPercent < thresholds.stableLoss) category = 'langsamer_verlust';
  else if (weeklyPercent > thresholds.slowGain) category = 'schnelle_zunahme';
  else if (weeklyPercent > thresholds.stableGain) category = 'langsame_zunahme';
  return {
    todayKg: numeric(weights.at(-1)?.kg),
    average7Kg: rounded(referenceKg, 1),
    weeklyKg: rounded(weeklyKg, 2),
    weeklyPercent: rounded(weeklyPercent, 2),
    trend28Kg: model ? rounded(model.last - model.first, 2) : 0,
    confidence,
    measurementsPerWeek: rounded(measurementsPerWeek, 1),
    category,
    points: trend,
  };
}

export function confirmedTrendChange(rows = [], valueOf = (row) => row.value, threshold = 0) {
  const standardized = rows
    .filter((row) => row.standardisiert !== false)
    .slice(-3);
  if (standardized.length < 3) return null;
  const values = standardized.map(valueOf).map(numeric);
  if (values.some((value) => value == null)) return null;
  const firstChange = values[1] - values[0];
  const secondChange = values[2] - values[1];
  if (Math.sign(firstChange) !== Math.sign(secondChange)
    || Math.abs(values[2] - values[0]) < threshold) return null;
  return rounded(values[2] - values[0], 1);
}

export function adaptiveEnergyEstimate({ nutritionDays = [], weights = [], currentTarget = 0, goal = 'maintain', combinedEvidence = false, lastAdjustmentDate = null }) {
  const candidates = nutritionDays
    .map((day) => ({ date: day.date || day.log_date, kcal: numeric(day.kcal), complete: day.complete === true, excluded: Boolean(day.excluded || day.exclude_reason) }))
    .filter((day) => day.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!candidates.length || !weights.length) return { eligible: false, confidence: 'niedrig', reason: 'Noch keine ausreichenden Ernährungs- und Gewichtsdaten.' };
  const end = candidates.at(-1).date;
  const endDay = dayNumber(end);
  const window = candidates.filter((day) => endDay - dayNumber(day.date) <= 27);
  const startDay = Math.min(...window.map((day) => dayNumber(day.date)));
  const spanDays = endDay - startDay + 1;
  const excludedDays = window.filter((day) => day.excluded).length;
  const eligibleDays = Math.max(1, spanDays - excludedDays);
  const complete = window.filter((day) => day.complete && !day.excluded && day.kcal > 0);
  const completeness = complete.length / eligibleDays;
  if (spanDays < 21) return { eligible: false, confidence: 'niedrig', spanDays, completeness, reason: 'Eine adaptive Schätzung beginnt frühestens nach 21 Tagen.' };
  if (completeness < 0.8) return { eligible: false, confidence: 'niedrig', spanDays, completeness, reason: 'Mindestens 80 % der Tage müssen als vollständig protokolliert bestätigt sein.' };
  const weightWindow = weights.filter((row) => {
    const date = row.date || row.datum || row.gemessen_am;
    return date && dayNumber(date) >= startDay && dayNumber(date) <= endDay;
  });
  const trend = weightTrendSummary(weightWindow);
  if (trend.measurementsPerWeek < 3) return { eligible: false, confidence: 'niedrig', spanDays, completeness, reason: 'Für eine Anpassung sind mindestens drei Wiegungen pro Woche erforderlich.', weightTrend: trend };
  const model = regression(movingWeightAverage(weightWindow, 7));
  if (!model) return { eligible: false, confidence: 'niedrig', reason: 'Der Gewichtstrend ist noch nicht belastbar.' };
  const averageCalories = complete.reduce((sum, day) => sum + day.kcal, 0) / complete.length;
  const observedMaintenance = averageCalories - 7700 * model.slopePerDay;
  const difference = observedMaintenance - Number(currentTarget || observedMaintenance);
  const limitedChange = Math.max(-100, Math.min(100, difference));
  const bodyCompBlocked = goal === 'bodycomp' && !combinedEvidence;
  const lastAdjustmentDay = lastAdjustmentDate ? dayNumber(String(lastAdjustmentDate).slice(0, 10)) : null;
  const reviewBlocked = lastAdjustmentDay != null && endDay - lastAdjustmentDay < 7;
  const nextReview = lastAdjustmentDay == null
    ? new Date((endDay + 7) * DAY_MS).toISOString().slice(0, 10)
    : new Date((lastAdjustmentDay + 7) * DAY_MS).toISOString().slice(0, 10);
  return {
    eligible: !bodyCompBlocked && !reviewBlocked,
    requiresConfirmation: true,
    automatic: false,
    confidence: trend.confidence,
    spanDays,
    completeness: rounded(completeness * 100),
    nutritionDaysCount: complete.length,
    excludedDays,
    weightMeasurements: weightWindow.length,
    measurementsPerWeek: trend.measurementsPerWeek,
    averageCalories: Math.round(averageCalories),
    observedMaintenance: Math.round(observedMaintenance),
    suggestedTarget: Math.round(Number(currentTarget || observedMaintenance) + limitedChange),
    suggestedChange: Math.round(limitedChange),
    nextReview,
    weightTrend: trend,
    reason: bodyCompBlocked
      ? 'Im BodyComp-Modus löst der Gewichtstrend allein keine Kalorienänderung aus. Körpermaße, Leistung und Erholung müssen den Vorschlag stützen.'
      : reviewBlocked
        ? `Die letzte Anpassung ist noch keine Woche her. Die nächste Bewertung ist am ${new Date(`${nextReview}T12:00:00`).toLocaleDateString('de-DE')}.`
      : 'Vorsichtige Kalibrierung aus vollständig protokollierter Energiezufuhr und geglättetem Gewichtstrend.',
  };
}

const falling = (value) => value != null && value < 0;
const rising = (value) => value != null && value > 0;

export function evaluateBodyComp({ weight, skinfoldDelta = null, waistDelta = null, performanceTrend = null, recoveryTrend = null, weeks = 0 }) {
  const category = weight?.category || 'unklar';
  const fatTrendDown = falling(skinfoldDelta) || falling(waistDelta);
  const fatTrendUp = rising(skinfoldDelta) && rising(waistDelta);
  const performanceAvailable = performanceTrend != null;
  const recoveryAvailable = recoveryTrend != null;
  const performanceStable = performanceAvailable && performanceTrend >= 0;
  const recoveryOkay = recoveryAvailable && recoveryTrend >= 0;
  const enoughTime = weeks >= 3;
  const supportingSources = [skinfoldDelta, waistDelta, performanceTrend, recoveryTrend].filter((value) => value != null).length;
  const confidence = enoughTime && weight?.confidence === 'hoch' && supportingSources >= 3
    ? 'hoch'
    : enoughTime && weight?.confidence !== 'niedrig' && supportingSources >= 1 ? 'mittel' : 'niedrig';
  const base = {
    confidence,
    limitations: [
      'Schlaf und Erholung sind Voraussetzungen, aber kein Beweis für Muskelaufbau.',
      'Steigende Kraft kann auch aus Technik oder neuronaler Anpassung entstehen.',
      'Die 12-Falten-Summe erfasst überwiegend Unterhautfett und nicht das gesamte Körperfett.',
      'Einzelne Messungen lösen keine Körperzusammensetzungsdiagnose aus.',
    ],
  };
  if (!enoughTime) return { ...base, status: 'unklar', message: 'Noch keine eindeutige Aussage möglich.', suggestion: 'Für eine kombinierte Bewertung werden vorzugsweise drei bis sechs Wochen vergleichbarer Daten benötigt.' };
  if (category === 'zu_schneller_verlust' && performanceTrend < 0 && recoveryTrend < 0) {
    return { ...base, status: 'defizit_zu_gross', message: 'Gewichtsverlust möglicherweise zu schnell. Energiezufuhr und Erholung prüfen.', suggestion: 'Eine vorsichtige Erhöhung um etwa 100–150 kcal kann sinnvoll sein; sie wird nur nach deiner Bestätigung übernommen.' };
  }
  if ((category === 'langsame_zunahme' || category === 'schnelle_zunahme') && fatTrendUp && performanceAvailable && performanceTrend <= 0) {
    return { ...base, status: 'ueberschuss_zu_gross', message: 'Zunahme spricht eher für einen zu großen Energieüberschuss.' };
  }
  if (category === 'langsame_zunahme' && fatTrendDown && performanceTrend > 0 && recoveryOkay) {
    return { ...base, status: 'muskelaufbau_fettverlust', message: 'Wahrscheinlicher Aufbau fettfreier Masse bei gleichzeitig sinkendem Unterhautfett.' };
  }
  if (category === 'langsamer_verlust' && fatTrendDown && performanceStable && recoveryOkay) {
    return { ...base, status: 'fettverlust_muskelerhalt', message: 'Erfolgreicher Fettverlust bei wahrscheinlich erhaltener Muskulatur.' };
  }
  if ((category === 'stabil' || category === 'langsamer_verlust') && fatTrendDown && performanceStable && recoveryOkay) {
    return { ...base, status: 'erfolgreiche_rekomposition', message: 'Sehr wahrscheinlich erfolgreiche Körperrekomposition – Fetttrend sinkt bei stabiler oder steigender Leistungsfähigkeit.', suggestion: 'Kalorien vorerst unverändert lassen und die standardisierten Messungen fortsetzen.' };
  }
  const missing = [];
  if (skinfoldDelta == null && waistDelta == null) missing.push('eine bestätigte Veränderung von Faltensumme oder Taille');
  if (!performanceAvailable) missing.push('vergleichbare LOGMAN-Leistungsdaten');
  if (!recoveryAvailable) missing.push('mehrere Schlaf- oder Erholungswerte');
  return {
    ...base,
    status: 'plateau',
    message: 'Noch keine eindeutige Veränderung erkennbar. Messqualität, Trainingsreiz und Energiezufuhr prüfen.',
    suggestion: missing.length
      ? `Für mehr Sicherheit fehlen noch ${missing.slice(0, 2).join(' und ')}.`
      : 'Kalorien zunächst unverändert lassen und in zwei Wochen erneut vergleichen.',
  };
}

export function aggregateSkinfoldReadings(readings = {}) {
  const values = {};
  let complete = 0;
  let thirdNeeded = 0;
  Object.entries(readings).forEach(([key, list]) => {
    const valid = (list || []).map(numeric).filter((value) => value != null && value >= 0);
    if (valid.length < 2) return;
    const firstTwoDifference = Math.abs(valid[0] - valid[1]);
    const needsThird = firstTwoDifference > Math.max(2, Math.min(valid[0], valid[1]) * 0.1);
    if (needsThird && valid.length < 3) { thirdNeeded += 1; return; }
    const used = needsThird ? valid.slice(0, 3).sort((a, b) => a - b)[1] : (valid[0] + valid[1]) / 2;
    values[key] = rounded(used, 1);
    complete += 1;
  });
  return {
    values,
    complete,
    thirdNeeded,
    quality: complete === 12 && thirdNeeded === 0 ? 'hoch' : complete >= 10 ? 'mittel' : 'niedrig',
  };
}
