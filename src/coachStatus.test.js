import { describe, expect, it } from 'vitest';
import { startMarkup } from './coachStatus.js';

const punkte = { window: { from: '2026-09-13', to: '2026-09-26', days: 14 }, checks: [
  { id: 'ernaehrung-weit-unter-ziel', kind: 'daten', area: 'ernaehrung', nutrition: { daysWithEntries: 12, averageKcal: 1641, targetKcal: 2700, percentOfTarget: 61 }, action: 'a' },
  { id: 'schlaf-eintraege', kind: 'daten', area: 'schlaf', sleep: { checkins: 5, windowDays: 14 }, action: 'b' },
  { id: 'training-daten', kind: 'daten', area: 'training', training: { trainingDays: 0, lastTrainingDate: null }, action: 'c' },
  { id: 'routinen', kind: 'umsetzung', area: 'routinen', routines: [{ name: '<b>Meditation</b>', plannedDays: 10, completedDays: 1 }, { name: 'Spaziergang', plannedDays: 14, completedDays: 3 }], action: 'd' },
  { id: 'schlaf-dauer', kind: 'verbesserung', area: 'schlaf', sleep: { checkins: 12, averageDurationMinutes: 390 }, action: 'e' },
  { id: 'unbekannt', kind: 'daten', area: 'x', action: 'f' },
] };

describe('Startnachricht des Coachs', () => {
  it('nennt die offenen Punkte der letzten 14 Tage mit ihren Werten', () => {
    const html = startMarkup({ punkte });
    expect(html).toContain('coach-chat-window is-coach coach-welcome');
    expect(html).toContain('Hi! Das ist in den letzten 14 Tagen offen:');
    expect(html).toContain('<li>Ernährung: im Schnitt 1.641 kcal eingetragen, 61 % deines Ziels</li>');
    expect(html).toContain('<li>Schlaf: an 5 von 14 Tagen eingetragen</li>');
    expect(html).toContain('<li>Training: noch keine LOGMAN-Daten</li>');
    expect(html).toContain('<li>Routinen: &lt;b&gt;Meditation&lt;/b&gt; an 1 von 10 geplanten Tagen, dazu eine weitere Routine</li>');
    expect(html).toContain('<li>Schlaf: im Schnitt 6 h 30 min</li>');
    expect(html.match(/<li>/g)).toHaveLength(5);   // unbekannte Punkte fallen weg
  });

  it('bietet "Was zuerst?" und die zwei wichtigsten Punkte als Fragen an', () => {
    const knoepfe = [...startMarkup({ punkte }).matchAll(/data-vorschlag="([^"]+)">([^<]+)</g)].map(([, frage, text]) => [text, frage]);
    expect(knoepfe).toEqual([
      ['Was zuerst?', 'Was fehlt bei mir gerade, was läuft nicht rund, und was soll ich zuerst angehen?'],
      ['Kalorien besprechen', 'Meine eingetragenen Kalorien liegen weit unter meinem Ziel. Was bedeutet das, und wie gehe ich es an?'],
      ['Schlaf eintragen', 'Ich trage meinen Schlaf zu selten ein. Wie ändere ich das?'],
    ]);
  });

  it('sagt ehrlich, wenn nichts offen ist, und behauptet das nie ohne Daten', () => {
    expect(startMarkup({ punkte: { checks: [] } })).toContain('In den letzten 14 Tagen ist nichts offen');
    expect(startMarkup({})).toContain('Ich schaue kurz, was bei dir gerade offen ist');
    const fehler = startMarkup({ fehler: true });
    expect(fehler).not.toContain('nichts offen');
    expect(fehler).toContain('data-vorschlag=');
    expect(startMarkup({ punkte, neu: true })).toContain('Neues Gespräch. Das ist in den letzten 14 Tagen offen:');
  });
});
