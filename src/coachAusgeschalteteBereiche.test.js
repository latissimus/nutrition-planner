import { describe, expect, it } from 'vitest';
import { buildFollowThrough, switchedOffAreas } from '../supabase/functions/capboy-coach/followThrough.ts';
import { buildCompFacts, buildTimeseries } from '../supabase/functions/capboy-coach/context.ts';
import { weeklyBlock } from '../supabase/functions/capboy-coach/weekly.ts';

const jetzt = new Date('2026-09-29T10:00:00Z');
const zeilen = (extra = {}) => ({
  settings: { custom_calorie_target: 2400 },
  weights: [], skinfolds: [], waists: [], performance: [], sleep: [], checkins: [],
  nutritionEntries: [], routines: [], completions: [], ruleContext: {},
  ...extra,
});

describe('Im Profil ausgeschaltete Bereiche', () => {
  it('leitet sie aus den sichtbaren Seiten ab', () => {
    expect(switchedOffAreas(null)).toEqual([]);
    expect(switchedOffAreas(['reminders', 'habits', 'sleep', 'body'])).toEqual([]);
    expect(switchedOffAreas(['reminders', 'sleep'])).toEqual(['routines']);
    expect(switchedOffAreas(['body'])).toEqual(['nutrition', 'routines', 'sleep']);
  });

  it('meldet dort keine offenen Punkte', () => {
    const an = buildFollowThrough(zeilen(), jetzt).checks.map((punkt) => punkt.area);
    expect(an).toContain('ernaehrung');
    expect(an).toContain('schlaf');
    const aus = buildFollowThrough(zeilen({ switchedOffAreas: ['nutrition', 'sleep'] }), jetzt).checks.map((punkt) => punkt.area);
    expect(aus).not.toContain('ernaehrung');
    expect(aus).not.toContain('schlaf');
  });

  it('markiert sie in Fakten und Verlauf statt leerer Werte', () => {
    const rows = zeilen({ switchedOffAreas: ['nutrition', 'sleep', 'routines'] });
    const fakten = buildCompFacts(rows, jetzt);
    expect(fakten.nutrition).toEqual({ switchedOff: true });
    expect(fakten.sleep).toEqual({ switchedOff: true });
    expect(fakten.routines).toEqual({ switchedOff: true });
    expect(fakten.profile.calorieTarget).toBeNull();
    expect(fakten.switchedOffAreas).toEqual(['nutrition', 'sleep', 'routines']);

    const verlauf = buildTimeseries(rows, jetzt);
    expect(verlauf.recentDays).toEqual({ switchedOff: true });
    expect(verlauf.routines).toEqual({ switchedOff: true });
    expect(verlauf.weeks[0].nutrition).toEqual({ switchedOff: true });
    expect(verlauf.weeks[0].sleep).toEqual({ switchedOff: true });
    expect(verlauf.summary.weeksWithNutritionEntries).toBeNull();
    expect(verlauf.followThrough.checks.map((punkt) => punkt.area)).not.toContain('ernaehrung');

    const bilanz = weeklyBlock(verlauf, null);
    expect(bilanz.notMeasuredThisWeek).not.toContain('Schlafdauer');
    expect(bilanz.notMeasuredThisWeek).not.toContain('Tage mit Einträgen');
  });

  it('lässt Fakten und Verlauf unverändert, wenn alles eingeschaltet ist', () => {
    expect(buildCompFacts(zeilen(), jetzt)).not.toHaveProperty('switchedOffAreas');
    const verlauf = buildTimeseries(zeilen(), jetzt);
    expect(verlauf).not.toHaveProperty('switchedOffAreas');
    expect(verlauf.weeks[0].nutrition).toHaveProperty('daysWithEntries', 0);
    expect(weeklyBlock(verlauf, null).notMeasuredThisWeek).toContain('Schlafdauer');
  });
});
