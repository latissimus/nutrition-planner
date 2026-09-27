import { describe, expect, it } from 'vitest';
import { UMSTAENDE, faelligeWoche, vergleichMarkup, wochenKarteMarkup, wochenTitel } from './coachWeekly.js';
import { gedaechtnisMarkup } from './coachMemory.js';
import { WEEKLY_CIRCUMSTANCES } from '../supabase/functions/capboy-coach/weekly.ts';

const woche = { week: '2026-W38', from: '2026-09-14', to: '2026-09-20' };

describe('Wochen-Check-in: Woche', () => {
  it('bilanziert immer die zuletzt abgeschlossene Woche', () => {
    expect(faelligeWoche('2026-09-26')).toEqual(woche);   // Samstag: KW 39 läuft noch
    expect(faelligeWoche('2026-09-27').week).toBe('2026-W38');   // Sonntag
    expect(faelligeWoche('2026-09-28').week).toBe('2026-W39');   // Montag: KW 39 ist abgeschlossen
    expect(faelligeWoche('2026-01-01')).toEqual({ week: '2025-W52', from: '2025-12-22', to: '2025-12-28' });
  });

  it('nennt die Woche mit Zeitraum', () => {
    expect(wochenTitel(woche)).toBe('KW 38 · 14.09.–20.09.2026');
    expect(wochenTitel({ week: 'kaputt' })).toBe('Wochenbilanz');
  });

  it('bietet genau die Umstände an, die die Edge Function kennt', () => {
    expect(UMSTAENDE.map(([id]) => id)).toEqual(Object.keys(WEEKLY_CIRCUMSTANCES));
  });
});

describe('Wochen-Check-in: Karte', () => {
  const massnahmen = [{ id: 'm1', action: '<b>Früher essen</b>', adherence: 'teilweise' }];

  it('lädt zum Check-in ein und öffnet das Formular erst auf Wunsch', () => {
    const karte = wochenKarteMarkup({ woche, massnahmen });
    expect(karte).toContain('KW 38');
    expect(karte).toContain('data-woche-starten');
    expect(karte).not.toContain('data-woche-form');
  });

  it('fragt Umsetzung je laufender Maßnahme und besondere Umstände ab', () => {
    const formular = wochenKarteMarkup({ woche, massnahmen, offen: true });
    expect(formular).toContain('data-woche-form');
    expect(formular).toContain('&lt;b&gt;Früher essen&lt;/b&gt;');
    expect(formular).toContain('<option value="teilweise" selected>');
    for (const [id] of UMSTAENDE) expect(formular).toContain(`value="${id}"`);
    expect(formular).toContain('maxlength="300"');
    expect(wochenKarteMarkup({ woche, offen: true })).not.toContain('Wie gut hast du');
  });

  it('zeigt eine erstellte Bilanz statt des Check-ins', () => {
    const karte = wochenKarteMarkup({ woche, bilanz: { week: '2026-W38' } });
    expect(karte).toContain('data-woche-ansehen');
    expect(karte).not.toContain('data-woche-starten');
  });
});

describe('Wochen-Check-in: Vergleich', () => {
  it('zeigt die Werte der App deutsch formatiert, mit Vorzeichen und Lücken', () => {
    const html = vergleichMarkup({
      week: '2026-W38', previousWeek: '2026-W37',
      comparison: [
        { metric: 'gewicht', label: 'Gewicht (Wochenmittel)', unit: 'kg', previous: 86, current: 84.8, change: -1.2 },
        { metric: 'schlafqualitaet', label: 'Schlafqualität', unit: '1–5', previous: 2.3, current: 3, change: 0.7 },
        { metric: 'taille', label: 'Taillenumfang <x>', unit: 'cm', previous: null, current: 89, change: null },
        { metric: 'kalorien', label: 'Kalorien', unit: 'kcal', previous: 2550, current: 2550, change: 0 },
      ],
    });
    expect(html).toContain('<th scope="col">KW 37</th><th scope="col">KW 38</th>');
    expect(html).toContain('<td>86 kg</td><td>84,8 kg</td><td>−1,2 kg</td>');
    expect(html).toContain('<td>2,3 von 5</td><td>3 von 5</td><td>+0,7</td>');
    expect(html).toContain('Taillenumfang &lt;x&gt;</th><td>–</td><td>89 cm</td><td>–</td>');
    expect(html).toContain('<td>2.550 kcal</td><td>2.550 kcal</td><td>±0 kcal</td>');
    expect(vergleichMarkup({ comparison: [] })).toBe('');
  });
});

describe('Wochen-Check-in: Gedächtnis-Seite', () => {
  it('listet Wochenbilanzen mit Löschen, nur wenn die Tabelle da ist', () => {
    const html = gedaechtnisMarkup({ wochenbilanzen: [{ id: 'w1', week: '2026-W38', created_at: '2026-09-21T07:00:00Z', result: { summary: '<i>Ruhige Woche</i>', recommendations: [{ action: 'Weiter so' }] } }] });
    expect(html).toContain('KW 38 · 2026');
    expect(html).toContain('Erstellt am 21.09.2026');
    expect(html).toContain('&lt;i&gt;Ruhige Woche&lt;/i&gt;');
    expect(html).toContain('data-wochenbilanz-loeschen="w1"');
    expect(gedaechtnisMarkup({ wochenbilanzen: [] })).toContain('Noch keine Wochenbilanz');
    expect(gedaechtnisMarkup({})).not.toContain('Wochenbilanzen');
  });
});
