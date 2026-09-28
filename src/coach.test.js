import { describe, expect, it } from 'vitest';
import { fensterMarkup, resultMarkup, verlaufMarkup } from './coach.js';

const baseResult = {
  title: 'CAPBOY COACH',
  summary: 'Einordnung',
  confidence: 'mittel',
  facts: [],
  interpretations: [],
  recommendations: [],
  uncertainties: [],
  safetyNote: '',
};

describe('Coach-Webquellen', () => {
  it('zeigt echte Webquellen als sichere externe Links', () => {
    const html = resultMarkup({
      ...baseResult,
      webResearchRequested: true,
      webSources: [{ title: 'Studie & Leitlinie', url: 'https://example.org/study?q=1&lang=de' }],
    });
    expect(html).toContain('Verwendete Webquellen');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('Studie &amp; Leitlinie');
    expect(html).toContain('https://example.org/study?q=1&amp;lang=de');
  });

  it('entfernt technische Markdown-Links aus dem Fließtext', () => {
    const html = resultMarkup({
      ...baseResult,
      summary: 'Aktueller Stand ([Fachquelle](https://example.org/study))',
      webResearchRequested: true,
      webSources: [{ title: 'Fachquelle', url: 'https://example.org/study' }],
    });
    expect(html).toContain('Aktueller Stand (Fachquelle)');
    expect(html).not.toContain('[Fachquelle]');
    expect(html).toContain('href="https://example.org/study"');
  });

  it('verwirft unsichere Protokolle und kennzeichnet ausbleibende Quellen', () => {
    const html = resultMarkup({
      ...baseResult,
      webResearchRequested: true,
      webSources: [{ title: 'Nicht sicher', url: 'javascript:alert(1)' }],
    });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('Verwendete Webquellen');
    expect(html).toContain('Keine Webquelle verwendet');
  });

  it('blendet ohne angeforderte Webrecherche unnötige Statuszeilen aus', () => {
    const html = resultMarkup(baseResult);
    expect(html).not.toContain('Webquelle');
  });
});

describe('Coach-Chat: Retro-Fenster', () => {
  it('zeigt den Coach und dich als Referenz-Fenster mit dekorativen Fensterknöpfen', () => {
    const coach = fensterMarkup({ inhalt: '<p>Hallo</p>', runde: 2 });
    expect(coach).toContain('coach-chat-window is-coach');
    expect(coach).toContain('<b>Coach</b>');
    expect(coach).toContain('data-runde="2"');
    expect(coach).toContain('coach-fenster-knoepfe');
    expect(coach).toMatch(/□|×/);
    const du = fensterMarkup({ von: 'user', avatar: '<span>FR</span>', inhalt: '<p>Frage</p>' });
    expect(du).toContain('coach-chat-window is-user');
    expect(du).toContain('<b>Du</b>');
    expect(du).not.toContain('data-runde');
  });

  it('ordnet Merken-Knöpfe der Antwort zu, unter der sie stehen', () => {
    const runde = (action) => ({ frage: 'F', result: { ...baseResult, recommendations: [{ kind: 'beobachtung', action, rationale: 'r', timeframe: 't' }] } });
    const html = verlaufMarkup([runde('A'), runde('B')]);
    expect(html.match(/data-runde="0"/g)).toHaveLength(1);
    expect(html.match(/data-runde="1"/g)).toHaveLength(1);
    expect(html.indexOf('data-runde="1"')).toBeLessThan(html.lastIndexOf('data-empfehlung-merken="0"'));
  });

  it('zeigt die Wochenbilanz mit ihrem Wochenvergleich im Verlauf', () => {
    const weekly = { week: '2026-W38', previousWeek: '2026-W37', comparison: [{ metric: 'gewicht', label: 'Gewicht (Wochenmittel)', unit: 'kg', previous: 86, current: 84.8, change: -1.2 }] };
    const html = verlaufMarkup([{ frage: 'Wochen-Check-in KW 38', result: baseResult, weekly }]);
    expect(html).toContain('Die Woche im Vergleich');
    expect(html).toContain('<td>84,8 kg</td>');
  });

  it('antwortet kurz und klappt Daten, Einordnung und Unsicherheiten ein', () => {
    const html = resultMarkup({ ...baseResult, summary: 'Kurz gesagt', facts: ['Gewicht 82 kg'], interpretations: ['[Evidenz] Wasser'], uncertainties: ['Taille fehlt'] });
    expect(html.indexOf('Kurz gesagt')).toBeLessThan(html.indexOf('<details class="coach-mehr">'));
    expect(html).toContain('<summary>Daten &amp; Einordnung</summary><h4>Daten</h4>');
    expect(html).toContain('<h4>Noch unsicher</h4>');
    expect(html).toContain('Datenlage: mittel');
    expect(resultMarkup(baseResult)).not.toContain('coach-mehr');
  });
});
