import { describe, expect, it } from 'vitest';
import { calorieBasis, enforceCalorieBasis, quantifiedCalorieAction } from '../supabase/functions/capboy-coach/calorieGuard.ts';

const days = (count) => Array.from({ length: count }, (_, index) => {
  const date = new Date(Date.UTC(2026, 9, 7));
  date.setUTCDate(date.getUTCDate() - index - 1);
  return { log_date: date.toISOString().slice(0, 10), energy_kcal: 2400 };
});

describe('Kalorien-Entscheidungssperre', () => {
  it('zählt automatisch Tage mit Einträgen, nicht einen manuell gesetzten Haken', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    expect(calorieBasis([], now).calorieChangeAllowed).toBe(false);
    expect(calorieBasis(days(11), now).calorieChangeAllowed).toBe(false);
    expect(calorieBasis(days(12), now).calorieChangeAllowed).toBe(true);
    expect(calorieBasis(days(12).map((day) => ({ ...day, complete: false })), now).calorieChangeAllowed).toBe(true);
    expect(calorieBasis(days(14).slice(2), now).calorieChangeAllowed).toBe(false);
    expect(calorieBasis([...days(12), ...days(12)], now).loggedDays).toBe(12);
    expect(calorieBasis(days(14), now, '2026-10-04').calorieChangeAllowed).toBe(false);
  });

  it('fängt konkrete Änderungen auch bei „Daraus Schritte machen“ ab', () => {
    const basis = calorieBasis([], new Date('2026-10-07T12:00:00Z'));
    const result = { modus: 'bewertung', summary: 'Senke um 200 kcal.', recommendations: [
      { kind: 'experiment', action: 'Reduziere um 200 kcal pro Tag', rationale: 'Test', hypothesis: 'Mehr Defizit', targetMetric: 'gewicht', expectedDirection: 'sinkt', reviewDate: '2026-10-21' },
    ] };
    const safe = enforceCalorieBasis(result, basis);
    expect(safe.summary).not.toContain('200 kcal');
    expect(safe.recommendations[0].kind).toBe('beobachtung');
    expect(safe.recommendations[0].action).not.toContain('200 kcal');
  });

  it('lässt Messwerte und reines Besprechen des Kalorienziels stehen', () => {
    expect(quantifiedCalorieAction('Zuletzt waren 2400 kcal eingetragen.')).toBe(false);
    expect(quantifiedCalorieAction('Du isst 200 kcal weniger als geplant.')).toBe(false);
    expect(quantifiedCalorieAction('Besprich dein Kalorienziel mit dem Coach.')).toBe(false);
    expect(quantifiedCalorieAction('Setze dein Ziel auf 2400 kcal.')).toBe(true);
    expect(quantifiedCalorieAction('Iss 200 kcal weniger.')).toBe(true);
    expect(quantifiedCalorieAction('Geh auf 2200 kcal.')).toBe(true);
    expect(quantifiedCalorieAction('Ab morgen täglich 200 kcal weniger.')).toBe(true);
    expect(quantifiedCalorieAction('Nicht sofort auf 1500 kcal senken, sondern morgen.')).toBe(true);
  });
});
