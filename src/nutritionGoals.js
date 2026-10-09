// The goal direction is chosen on COMP. The optional Tracker reads the same
// stored value to calculate a starting calorie estimate when no manual target exists.
export const NUTRITION_GOALS = {
  lose: ['Langsam reduzieren', -300],
  maintain: ['Gewicht halten', 0],
  gain: ['Muskelaufbau', 200],
  gain_fast: ['Deutlich zunehmen', 350],
  bodycomp: ['BodyComp – Muskulatur aufbauen und Fett reduzieren', 0],
};

export const goalLabel = (goal) => NUTRITION_GOALS[goal]?.[0] || 'Noch kein Ziel gewählt';

export function goalSettingsUpdate(previous, goal) {
  if (!Object.hasOwn(NUTRITION_GOALS, goal)) throw new Error('Unbekanntes Ziel');
  // An adaptive target was calibrated for the previous goal; keeping it after
  // a phase change would silently contradict the selected strategy. Explicit
  // custom targets remain the user's decision.
  return previous?.goal && previous.goal !== goal
    ? { goal, adaptive_target: null, adaptive_updated_at: null, adaptive_rejected_target: null, adaptive_rejected_at: null }
    : { goal };
}
