import { describe, expect, it } from 'vitest';
import {
  UMSTAENDE, checkinText, faelligeWoche, vergleichMarkup, wochenFrageMarkup, wochenLeisteMarkup, wochenTitel,
} from './coachWeekly.js';
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

describe('Wochen-Check-in im Chat', () => {
  const massnahmen = [{ id: 'm1', action: '<b>Früher essen</b>', adherence: 'teilweise' }];

  it('lädt mit einer schmalen Leiste zum Check-in ein', () => {
    const leiste = wochenLeisteMarkup(woche);
    expect(leiste).toContain('Wochenbilanz KW 38 ist bereit');
    expect(leiste).toContain('data-woche-starten');
    expect(leiste).not.toContain('data-woche-form');
  });

  it('stellt die Fragen als Nachricht: Umsetzung je Maßnahme, Umstände, Notiz', () => {
    const frage = wochenFrageMarkup({ woche, massnahmen });
    expect(frage).toContain('Die KW 38 ist vorbei');
    expect(frage).toContain('data-woche-form');
    expect(frage).toContain('&lt;b&gt;Früher essen&lt;/b&gt;');
    expect(frage).toContain('<option value="teilweise" selected>');
    for (const [id] of UMSTAENDE) expect(frage).toContain(`value="${id}"`);
    expect(frage).toContain('maxlength="300"');
    expect(frage).toContain('data-woche-spaeter');
    expect(wochenFrageMarkup({ woche })).not.toContain('Wie gut hast du');
  });

  it('fasst die Angaben als Nachricht des Nutzers zusammen', () => {
    expect(checkinText({
      woche, massnahmen,
      bericht: { interventions: [{ id: 'm1', adherence: 'ueberwiegend' }, { id: 'fremd', adherence: 'voll' }], circumstances: ['krank', 'stress'], note: 'ab Mittwoch erkältet' },
    })).toBe('Wochen-Check-in KW 38 · 14.09.–20.09.2026\nUmgesetzt – <b>Früher essen</b>: Überwiegend\nBesonders: Krank, Viel Stress\nNotiz: ab Mittwoch erkältet');
    expect(checkinText({ woche, bericht: {} })).toBe('Wochen-Check-in KW 38 · 14.09.–20.09.2026\nBesonders: nichts');
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
