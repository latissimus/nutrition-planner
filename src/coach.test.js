import { describe, expect, it } from 'vitest';
import { resultMarkup } from './coach.js';

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
    expect(html).toContain('keine verwendbare externe Quelle');
  });

  it('kennzeichnet Antworten ohne Internetrecherche transparent', () => {
    const html = resultMarkup(baseResult);
    expect(html).toContain('Es wurde keine Internetrecherche durchgeführt.');
  });
});
