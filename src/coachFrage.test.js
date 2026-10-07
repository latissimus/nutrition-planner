import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FRAGE_GEMEINSAME_ABSCHNITTE, bewertungQuellen, coachRequestBody, coachSystemPrompt, frageBereinigen, frageSchema, frageSystemPrompt,
  promptAbschnitt, schritteAuftrag, seminarAnzeigeTitel,
} from '../supabase/functions/capboy-coach/coachPrompt.ts';
import { assistantMemoryText } from '../supabase/functions/capboy-coach/memory.ts';
import { bewertungsQuellenAus, seminarTitelAus, webSources } from '../supabase/functions/capboy-coach/quellen.ts';
import { antwortModus, modusLesen, resultMarkup, schritteAnfrage, verlaufMarkup } from './coach.js';

// Chat-Schalter „Frage / Bewertung & Schritte“ (COACHING-PLAN.md, Schritt 4b).

const fingerabdruck = (wert) => createHash('sha256').update(typeof wert === 'string' ? wert : JSON.stringify(wert)).digest('hex').slice(0, 16);
const anfrage = (modus) => coachRequestBody({
  scope: 'coach', question: 'Test', snapshot: { a: 1 }, timeseries: { b: 2 }, memory: {}, webResearch: false, vectorStoreId: 'vs_x',
  ...(modus ? { modus } : {}),
});

describe('Bewertung & Schritte bleibt der bisherige Chat', () => {
  // Fingerabdrücke vom 07.10.2026 vor dem Umbau. Ändert sich einer, gelten die
  // Chat-Evals und ihre Baselines nicht mehr.
  it('hat Prompt und Anfrage Zeichen für Zeichen wie vor dem Schalter', () => {
    expect(fingerabdruck(coachSystemPrompt('coach', false))).toBe('dd0c53bacd02839e');
    expect(fingerabdruck(coachSystemPrompt('coach', true))).toBe('8ae51691956db36a');
    expect(fingerabdruck(anfrage())).toBe('a5d9053dee229ee0');
  });

  it('nimmt ohne Modus und mit „bewertung“ dieselbe Anfrage', () => {
    expect(anfrage('bewertung')).toEqual(anfrage());
  });

  it('füllt bei vorhandener Tagesprüfung den festen Limits-Block ohne die übrigen Blöcke umzubenennen', () => {
    const request = coachRequestBody({
      scope: 'coach', question: 'Soll ich Kalorien ändern?', snapshot: {}, timeseries: {}, memory: {},
      limits: { calorieChangeAllowed: false, completeDays: 0 }, webResearch: false, vectorStoreId: null,
    });
    const input = request.input[0].content;
    expect(input).toContain('<limits>');
    expect(input).toContain('"calorieChangeAllowed":false');
    expect(input).toContain('<comp_facts>');
    expect(input).toContain('<timeseries>');
  });
});

describe('Frage-Prompt', () => {
  it('enthält Eingabe, Datenregeln, Datenlage, Wissen, Sicherheit und Ton wortgleich', () => {
    [false, true].forEach((web) => {
      const bewertung = coachSystemPrompt('coach', web);
      const frage = frageSystemPrompt(web);
      FRAGE_GEMEINSAME_ABSCHNITTE.forEach((tag) => {
        expect(frage).toContain(promptAbschnitt(bewertung, tag));
      });
    });
  });

  it('verlangt keine Schritte, Experimente oder offenen Punkte', () => {
    const frage = frageSystemPrompt(false);
    ['next_steps', 'experiment_reviews', 'weekly_review', 'follow_through'].forEach((tag) => {
      expect(frage).not.toContain(`<${tag}>`);
    });
    expect(frage).toContain('Answer exactly the question');
    expect(frage).toContain('Always respond to the user in German.');
  });

  it('meldet einen fehlenden Abschnitt, statt still weniger Regeln zu schicken', () => {
    expect(() => promptAbschnitt('<role>x</role>', 'safety_constraints')).toThrow('safety_constraints');
  });

  it('nutzt im Frage-Modus eigenen Prompt und eigenes Schema bei gleicher Eingabe', () => {
    const frage = anfrage('frage');
    const bewertung = anfrage();
    expect(frage.instructions).toBe(frageSystemPrompt(false));
    expect(frage.text.format.name).toBe('capboy_coach_frage');
    expect(frage.text.format.schema).toBe(frageSchema);
    expect(frage.input).toEqual(bewertung.input);
    expect(frage.tools).toEqual(bewertung.tools);
    expect(frage.model).toBe(bewertung.model);
  });

  it('hat ein strenges Schema ohne Felder für Fakten, Einordnungen oder Empfehlungen', () => {
    expect(frageSchema.additionalProperties).toBe(false);
    expect(Object.keys(frageSchema.properties).sort()).toEqual(['answer', 'confidence', 'followUpQuestion', 'safetyNote', 'sources', 'stepsUseful']);
    expect([...frageSchema.required].sort()).toEqual(Object.keys(frageSchema.properties).sort());
    const quellen = frageSchema.properties.sources;
    expect(quellen.additionalProperties).toBe(false);
    expect([...quellen.required].sort()).toEqual(Object.keys(quellen.properties).sort());
  });
});

describe('Frage-Antwort bereinigen', () => {
  it('trägt den Modus und setzt eine unbekannte Datenlage auf niedrig', () => {
    expect(frageBereinigen({ answer: '  Ja, weil …  ', confidence: 'sehr hoch', followUpQuestion: ' ', safetyNote: '' })).toEqual({
      modus: 'frage', answer: 'Ja, weil …', confidence: 'niedrig', followUpQuestion: '', safetyNote: '',
      stepsUseful: false, sources: { userData: [], seminar: [], generalKnowledge: false },
    });
  });

  it('zeigt nur Seminardateien, die file_search geliefert hat, und nur bekannte Datenbereiche', () => {
    const geliefert = { 'Hautfalten - Hautfalten Notizen.pdf.txt': 'Hautfalten Notizen' };
    const ergebnis = frageBereinigen({
      answer: 'Antwort', confidence: 'mittel', followUpQuestion: '', safetyNote: '', stepsUseful: true,
      sources: { userData: ['training', 'hormone', 'koerper'], seminarFiles: ['Hautfalten - Hautfalten Notizen.pdf.txt', 'Erfunden.pdf'], generalKnowledge: true },
    }, { seminarTitel: (datei) => geliefert[datei] || null });
    expect(ergebnis.sources).toEqual({ userData: ['koerper', 'training'], seminar: ['Hautfalten Notizen'], generalKnowledge: true });
    expect(ergebnis.stepsUseful).toBe(true);
  });

  it('bietet mit Sicherheitshinweis keine Schritte an', () => {
    expect(frageBereinigen({ answer: 'Lass das.', safetyNote: 'SARMs sind riskant.', stepsUseful: true }).stepsUseful).toBe(false);
  });

  it('lässt eine Antwort ohne Text scheitern', () => {
    expect(() => frageBereinigen({ answer: '  ', confidence: 'hoch' })).toThrow();
  });
});

describe('Quellen einer Bewertung', () => {
  const notizen = { title: 'Hautfalten Notizen', filename: 'Hautfalten - Hautfalten Notizen.pdf.txt', original: 'Hautfalten/Hautfalten Notizen.pdf' };
  const kontrolliert = { title: 'Kontrolliertes Seminarwissen: Hautfalten Notizen', filename: 'Kontrolliert - Hautfalten - Hautfalten Notizen.md.txt' };
  const supplements = { title: 'Supplements', filename: 'Supplements - Supplements.pdf.txt' };

  it('nennt nur abgerufene Dokumente, die der Text mit Dateinamen nennt, ohne Doppel', () => {
    const quellen = bewertungQuellen({
      summary: 'Kurz.',
      facts: ['Faltensumme 76 mm'],
      interpretations: ['[Seminarwissen · Hypothese] Laut Kontrolliert - Hautfalten - Hautfalten Notizen.md.txt …', '[Evidenz] Wasser schwankt.'],
      recommendations: [{ action: 'Supplements nur nach Rücksprache' }],
    }, [notizen, kontrolliert, supplements]);
    expect(quellen).toEqual({ userData: [], ownData: true, seminar: ['Hautfalten Notizen'], generalKnowledge: true });
  });

  it('erkennt den Originalpfad; ein Etikett „Seminarwissen“ ohne abgerufenes Dokument belegt nichts', () => {
    expect(bewertungQuellen({ interpretations: ['Siehe Hautfalten/Hautfalten Notizen.pdf, Seite 2.'] }, [notizen]).seminar).toEqual(['Hautfalten Notizen']);
    expect(bewertungQuellen({ interpretations: ['[Seminarwissen · Erfahrungswert] Hautfalten - Hautfalten Notizen.pdf.txt'] }, []).seminar).toEqual([]);
    expect(bewertungQuellen({ interpretations: ['[Seminarwissen · Erfahrungswert] …'] }, [notizen]).seminar).toEqual([]);
    expect(bewertungQuellen({ summary: 'Ohne Daten.' }, [notizen])).toEqual({ userData: [], ownData: false, seminar: [], generalKnowledge: false });
  });

  it('zeigt die kontrollierte Fassung unter dem Namen des Dokuments', () => {
    expect(seminarAnzeigeTitel('Kontrolliertes Seminarwissen: Supplements')).toBe('Supplements');
    expect(seminarAnzeigeTitel('Braverman-Test')).toBe('Braverman-Test');
  });

  it('zeigt bei einer Bewertung Quellen statt Datenlage', () => {
    const html = resultMarkup({ summary: 'Kurz', confidence: 'mittel', facts: ['Gewicht 82 kg'], sources: { userData: [], ownData: true, seminar: ['Hautfalten Notizen'], generalKnowledge: false } });
    expect(html).toContain('<li>Deine Daten</li>');
    expect(html).toContain('Seminar: Hautfalten Notizen');
    expect(html).not.toContain('Datenlage');
  });
});

describe('Nachweis der Quellen aus der Modellantwort', () => {
  const antwort = {
    output: [
      { type: 'file_search_call', results: [{ filename: '3b847f993427-Hautfalten - Hautfalten Notizen.pdf.txt' }] },
      { type: 'web_search_call', action: { sources: [{ url: 'https://a.example/x', title: 'A' }, { url: 'https://b.example/y' }] } },
      { type: 'message', content: [{ annotations: [{ type: 'url_citation', url: 'https://a.example/x', title: 'A' }] }] },
    ],
  };

  it('trennt zitierte Webseiten von bloßen Suchtreffern', () => {
    expect(webSources(antwort)).toEqual([
      { title: 'A', url: 'https://a.example/x', zitiert: true },
      { title: 'b.example', url: 'https://b.example/y', zitiert: false },
    ]);
    expect(webSources({})).toEqual([]);
  });

  it('erkennt abgerufene Seminardateien trotz Wissensstand-Kürzel', () => {
    const titel = seminarTitelAus(antwort);
    expect(titel('Hautfalten - Hautfalten Notizen.pdf.txt')).toBe('Hautfalten Notizen');
    expect(titel('3b847f993427-Hautfalten - Hautfalten Notizen.pdf.txt')).toBe('Hautfalten Notizen');
    expect(titel('Supplements - Supplements.pdf.txt')).toBeNull();
    expect(bewertungsQuellenAus({ interpretations: ['Laut Hautfalten - Hautfalten Notizen.pdf.txt …', 'Supplements - Supplements.pdf.txt'] }, antwort).seminar)
      .toEqual(['Hautfalten Notizen']);
  });

  it('zeigt Suchtreffer zugeklappt als Recherchetreffer, nicht als Quelle', () => {
    const html = resultMarkup({ modus: 'frage', answer: 'Antwort', webResearchRequested: true, webSources: webSources(antwort) });
    expect(html).toContain('Web: <a href="https://a.example/x"');
    expect(html).toContain('<summary>Recherchetreffer</summary>');
    expect(html.indexOf('https://b.example/y')).toBeGreaterThan(html.indexOf('Recherchetreffer'));
    expect(html).not.toContain('Keine Webquelle verwendet');
  });
});

describe('„Daraus Schritte machen“ auf dem Server', () => {
  it('formuliert einen eigenen Auftrag mit Frage und Antwort', () => {
    const text = schritteAuftrag({ frage: 'Soll ich pausieren?', antwort: 'Eine Woche Pause ist hier sinnvoll.' });
    expect(text).toContain('Leite aus deiner Antwort unten konkrete nächste Schritte');
    expect(text).toContain('Meine Frage war: Soll ich pausieren?');
    expect(text).toContain('Deine Antwort war: Eine Woche Pause ist hier sinnvoll.');
  });

  it('gibt es nicht ohne Antwort und kürzt lange Texte', () => {
    expect(schritteAuftrag(null)).toBeNull();
    expect(schritteAuftrag({ frage: 'x', antwort: ' ' })).toBeNull();
    const lang = schritteAuftrag({ frage: 'f'.repeat(5000), antwort: 'a'.repeat(9000) });
    expect(lang).not.toContain('f'.repeat(1001));
    expect(lang).not.toContain('a'.repeat(3001));
  });
});

describe('Gesprächsgedächtnis', () => {
  it('speichert bei einer Frage die Antwort, bei einer Bewertung die Zusammenfassung', () => {
    expect(assistantMemoryText({ modus: 'frage', answer: 'Ja, eine Woche Pause.' })).toBe('Ja, eine Woche Pause.');
    expect(assistantMemoryText({ summary: 'Kurz', answer: 'Lang', recommendations: [{ action: 'Pause', timeframe: '1 Woche' }] }))
      .toBe('Kurz Empfehlung 1: Pause (1 Woche)');
  });
});

describe('Chat: Modus und Etikett', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('beginnt mit „Frage“ und merkt sich „Bewertung & Schritte“ für die Sitzung', () => {
    expect(modusLesen()).toBe('frage');
    vi.stubGlobal('sessionStorage', { getItem: () => 'bewertung' });
    expect(modusLesen()).toBe('bewertung');
    vi.stubGlobal('sessionStorage', { getItem: () => 'unsinn' });
    expect(modusLesen()).toBe('frage');
  });

  it('zeigt eine Frage-Antwort als Text mit Etikett, ohne Schritte-Karten und ohne Datenlage', () => {
    const result = { modus: 'frage', answer: 'Ja <b>klar</b>.', confidence: 'mittel', followUpQuestion: 'Wie schläfst du?', safetyNote: '', stepsUseful: true };
    const html = resultMarkup(result, { merken: true });
    expect(html).toContain('coach-modus-marke ist-frage">Frage<');
    expect(html).toContain('Ja &lt;b&gt;klar&lt;/b&gt;.');
    expect(html).toContain('Wie schläfst du?');
    expect(html).not.toContain('Nächste Schritte');
    expect(html).not.toContain('Datenlage');
  });

  it('bietet „Daraus Schritte machen“ nur an, wo die Antwort zu etwas führt, das man tun kann', () => {
    const tun = { modus: 'frage', answer: 'Ja, mach eine Woche Pause.', stepsUseful: true };
    const wissen = { modus: 'frage', answer: 'Nein, eine Woche Pause kostet keine Muskeln.', stepsUseful: false };
    expect(resultMarkup(tun, { merken: true })).toContain('data-schritte-aus');
    expect(resultMarkup(wissen, { merken: true })).not.toContain('data-schritte-aus');
    expect(resultMarkup(tun)).not.toContain('data-schritte-aus');
    expect(resultMarkup(tun, { merken: true, schritteGemacht: true })).not.toContain('data-schritte-aus');
  });

  it('nennt die Quellen statt der Datenlage', () => {
    const html = resultMarkup({
      modus: 'frage', answer: 'Antwort',
      sources: { userData: ['training', 'erholung'], seminar: ['Hautfalten <Notizen>'], generalKnowledge: true },
      webSources: [{ title: 'Studie', url: 'https://example.org/studie', zitiert: true }, { title: 'böse', url: 'javascript:alert(1)', zitiert: true }],
    });
    expect(html).toContain('Deine Daten: Training, Erholung');
    expect(html).toContain('Seminar: Hautfalten &lt;Notizen&gt;');
    expect(html).toContain('Web: <a href="https://example.org/studie"');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Allgemeines Fachwissen');
    expect(resultMarkup({ modus: 'frage', answer: 'Antwort' })).not.toContain('coach-quellen');
  });

  it('kennzeichnet Bewertungen, auch ältere ohne Modus', () => {
    const alt = { summary: 'Einordnung', recommendations: [] };
    expect(antwortModus(alt)).toBe('bewertung');
    expect(resultMarkup(alt)).toContain('coach-modus-marke ist-bewertung">Bewertung &amp; Schritte<');
    expect(resultMarkup({ ...alt, modus: 'bewertung' })).not.toContain('data-schritte-aus');
  });
});

describe('„Daraus Schritte machen“ in der App', () => {
  const runde = { frage: 'Soll ich pausieren?', result: { modus: 'frage', answer: 'Ja, eine Woche.', stepsUseful: true } };

  it('fragt eine Bewertung mit Frage und Antwort an', () => {
    expect(schritteAnfrage(runde)).toEqual({
      question: 'Daraus Schritte machen',
      modus: 'bewertung',
      schritteAus: { frage: 'Soll ich pausieren?', antwort: 'Ja, eine Woche.' },
    });
    expect(schritteAnfrage({ frage: 'x', result: { summary: 'Bewertung' } })).toBeNull();
    expect(schritteAnfrage({ ...runde, result: { ...runde.result, stepsUseful: false } })).toBeNull();
    expect(schritteAnfrage(undefined)).toBeNull();
  });

  it('zeigt im Verlauf, zu welcher Frage die Schritte gehören, und blendet den Knopf danach aus', () => {
    const html = verlaufMarkup([
      { ...runde, schritteGemacht: true },
      { frage: 'Daraus Schritte machen', bezug: 'Soll ich pausieren?', result: { modus: 'bewertung', summary: 'Plan' } },
    ]);
    expect(html).toContain('zu „Soll ich pausieren?“');
    expect(html).not.toContain('data-schritte-aus');
    expect(html).toContain('ist-bewertung');
  });
});
