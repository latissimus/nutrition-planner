type Row = Record<string, any>;

const date = (value: Date) => value.toISOString().slice(0, 10);

export function calorieBasis(entries: Row[], now: Date, targetPhaseFrom: string | null = null) {
  const berlinDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const today = new Date(`${berlinDay}T00:00:00Z`);
  const days = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - index - 1);
    return date(day);
  });
  const loggedDates = new Set(entries.map((row) => String(row.log_date).slice(0, 10)));
  const loggedDays = days.filter((day) => loggedDates.has(day) && (!targetPhaseFrom || day >= targetPhaseFrom)).length;
  const recent = days.slice(0, 2).some((day) => loggedDates.has(day) && (!targetPhaseFrom || day >= targetPhaseFrom));
  // The count is evidence of logging regularity, not proof of complete intake.
  const allowed = loggedDays >= 12 && recent;
  return { calorieChangeAllowed: allowed, loggedDays, windowDays: days.length,
    reason: allowed ? '' : 'Keine konkrete Änderung des Kalorienziels oder der Kalorienzufuhr in kcal empfehlen. Zuerst an mindestens 12 der letzten 14 abgeschlossenen Tage in der aktuellen Zielphase Ernährung erfassen, darunter einer der letzten zwei Tage. Einträge und Zielnähe beweisen keine Vollständigkeit.' };
}

// This is deliberately an output guard, not a semantic grader. If a numeric
// calorie action slips through the prompt while the basis is missing, the app
// replaces that advice with a safe, concrete next step.
export function quantifiedCalorieAction(value: unknown) {
  const text = String(value || '').toLowerCase();
  const amount = /\b\d[\d.,]*\s*-?\s*(?:kcal|kalorien)\b/i;
  const directive = /(?:senk|reduzier|verringer|erhöh|steiger|anheb|setz|stell|anpass|iss\b|solltest|empfehl|würde|geh(?:e|en|st)?\b|peil|fahr(?:e|en|st)?\b)/i;
  const plannedDirection = /(?:weniger|mehr|runter|rauf)/i.test(text) && /(?:ab morgen|ab jetzt|künftig|pro tag|täglich)/i.test(text);
  if (!amount.test(text) || (!directive.test(text) && !plannedDirection)) return false;
  if (/\b(?:nicht|kein|ohne)\b[^.!?]{0,45}\b(?:senk|reduzier|verringer|erhöh|steiger|anheb|setz|stell|weniger|mehr|anpass)/i.test(text)
    && !/\b(?:aber|sondern|stattdessen|doch|jedoch)\b/i.test(text)) return false;
  return true;
}

export function enforceCalorieBasis(result: Row, basis: ReturnType<typeof calorieBasis>) {
  if (basis.calorieChangeAllowed) return result;
  const safe = 'Für eine konkrete Kalorienänderung fehlen noch ausreichend aktuelle Ernährungseinträge. Erfasse zunächst regelmäßig deine Mahlzeiten; danach können wir das Ziel gemeinsam prüfen.';
  if (result.modus === 'frage') return quantifiedCalorieAction(result.answer)
    ? { ...result, answer: safe, followUpQuestion: '', confidence: 'niedrig', stepsUseful: false }
    : { ...result, followUpQuestion: quantifiedCalorieAction(result.followUpQuestion) ? '' : result.followUpQuestion };
  const recommendations = Array.isArray(result.recommendations) ? result.recommendations.map((item: Row) =>
    quantifiedCalorieAction([item.action, item.rationale, item.hypothesis].join(' '))
      ? { ...item, kind: 'beobachtung', action: 'Ernährung zunächst vollständig protokollieren', rationale: safe,
        hypothesis: '', baseline: '', targetMetric: 'keine', expectedDirection: 'keine', reviewDate: '' }
      : item) : result.recommendations;
  const scrub = (text: unknown) => quantifiedCalorieAction(text) ? safe : text;
  return { ...result, recommendations,
    title: scrub(result.title), summary: scrub(result.summary),
    facts: Array.isArray(result.facts) ? result.facts.map(scrub) : result.facts,
    interpretations: Array.isArray(result.interpretations) ? result.interpretations.map(scrub) : result.interpretations,
    followUpQuestions: Array.isArray(result.followUpQuestions) ? result.followUpQuestions.map(scrub) : result.followUpQuestions };
}
