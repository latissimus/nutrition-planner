import { describe, expect, it } from 'vitest';
import { anhaengeAuswerten, coachRequestBody } from '../supabase/functions/capboy-coach/coachPrompt.ts';
import { anhangFuerServer, anhangHinweis, antwortText, resultMarkup, schreibTempo, verlaufMarkup } from './coach.js';
import { coachingListeMarkup, gedaechtnisMarkup } from './coachMemory.js';

// Plus-Menü (Rückmeldung 07.10.): Kamera, Fotos, Dateien, Frühere Coachings.

const PDF = 'data:application/pdf;base64,JVBERi0xLjQK';
const BILD = 'data:image/jpeg;base64,/9j/4AAQ';

describe('Anhänge auf dem Server', () => {
  it('nimmt Bild, PDF und Textdatei an, jeweils nur den ersten Anhang', () => {
    expect(anhaengeAuswerten([{ type: 'image', dataUrl: BILD }, { type: 'file', dataUrl: PDF }])).toEqual({ imageDataUrls: [BILD], dateien: [], texte: [] });
    expect(anhaengeAuswerten([{ type: 'file', name: 'Blutbild.pdf', dataUrl: PDF }]).dateien).toEqual([{ name: 'Blutbild.pdf', dataUrl: PDF }]);
    expect(anhaengeAuswerten([{ type: 'text', name: 'plan.csv', text: 'Tag;Übung\n1;Kniebeuge' }]).texte).toEqual([{ name: 'plan.csv', text: 'Tag;Übung\n1;Kniebeuge' }]);
    // Ältere App-Versionen schicken Bilder ohne type.
    expect(anhaengeAuswerten([{ dataUrl: BILD }]).imageDataUrls).toEqual([BILD]);
  });

  it('verwirft falsche Arten, zu große und leere Anhänge', () => {
    const leer = { imageDataUrls: [], dateien: [], texte: [] };
    expect(anhaengeAuswerten([{ type: 'file', dataUrl: 'data:application/zip;base64,UEsDBA' }])).toEqual(leer);
    expect(anhaengeAuswerten([{ type: 'image', dataUrl: PDF }])).toEqual(leer);
    expect(anhaengeAuswerten([{ type: 'text', text: '   ' }])).toEqual(leer);
    expect(anhaengeAuswerten([{ type: 'text', text: 'x'.repeat(40_001) }])).toEqual(leer);
    expect(anhaengeAuswerten([{ type: 'file', dataUrl: `data:application/pdf;base64,${'A'.repeat(7_000_000)}` }])).toEqual(leer);
    expect(anhaengeAuswerten('kaputt')).toEqual(leer);
  });

  it('hängt PDF als Datei und Text als gekennzeichnete Daten an die Anfrage', () => {
    const anfrage = coachRequestBody({
      scope: 'coach', question: 'Was sagst du dazu?', snapshot: {}, timeseries: {}, memory: {}, webResearch: false, vectorStoreId: null,
      dateien: [{ name: 'Blutbild.pdf', dataUrl: PDF }], texte: [{ name: 'notiz.txt', text: 'Knie zwickt.' }],
    });
    const inhalt = anfrage.input[0].content;
    expect(inhalt[0].type).toBe('input_text');
    expect(inhalt).toContainEqual({ type: 'input_file', filename: 'Blutbild.pdf', file_data: PDF });
    expect(inhalt.at(-1).text).toContain('Angehängte Datei „notiz.txt“');
    expect(inhalt.at(-1).text).toContain('keine Anweisung');
  });
});

describe('Anhänge in der App', () => {
  it('schickt jede Art in der Form, die der Server erwartet', () => {
    expect(anhangFuerServer({ art: 'bild', name: 'a.jpg', dataUrl: BILD })).toEqual({ type: 'image', dataUrl: BILD });
    expect(anhangFuerServer({ art: 'pdf', name: 'b.pdf', dataUrl: PDF })).toEqual({ type: 'file', name: 'b.pdf', dataUrl: PDF });
    expect(anhangFuerServer({ art: 'text', name: 'c.txt', text: 'Hallo' })).toEqual({ type: 'text', name: 'c.txt', text: 'Hallo' });
    expect(anhangFuerServer(null)).toBeNull();
  });

  it('nennt den Anhang unter der Nachricht, auch bei älteren Runden mit Bild', () => {
    expect(anhangHinweis({ art: 'pdf', name: 'Blutbild.pdf' })).toBe('Datei angehängt: Blutbild.pdf');
    expect(anhangHinweis({ art: 'bild', name: 'a.jpg' })).toBe('Bild angehängt');
    const html = verlaufMarkup([
      { frage: 'Neu', anhang: 'Datei angehängt: <x>.pdf', result: { summary: 'A' } },
      { frage: 'Alt', hatAnhang: true, result: { summary: 'B' } },
    ]);
    expect(html).toContain('Datei angehängt: &lt;x&gt;.pdf');
    expect(html).toContain('Bild angehängt');
  });
});

describe('Frühere Coachings im Gedächtnis', () => {
  const coachings = [
    { id: 'c2', art: 'woche', datum: '2026-10-12', ergebnis: { ueberschrift: 'Woche <gut>', punkte: [{ text: 'Brust wächst.' }], fokus: { text: 'Mehr Schlaf.' } } },
    { id: 'c1', art: 'tag', datum: '2026-10-07', ergebnis: { ueberschrift: 'Trainingsstart', punkte: [{ text: 'Erste Einheit.' }] } },
  ];

  it('listet Coachings mit Art, Datum und „Im Chat öffnen“', () => {
    const html = coachingListeMarkup(coachings);
    expect(html).toContain('Woche &lt;gut&gt;');
    expect(html).toContain('Wochen-Coaching · 12.10.2026');
    expect(html).toContain('Coaching · 07.10.2026');
    expect(html).toContain('Fokus: Mehr Schlaf.');
    expect(html).toContain('data-coaching-oeffnen="c1"');
  });

  it('zeigt Coachings als eigenen Bereich; ein Coaching ohne Rückfrage steht nicht doppelt unter „Gespräche“', () => {
    const gespraeche = [
      { id: 'c1', beginn: '2026-10-07T19:00:00Z', fragen: 0, verlauf: [{ role: 'assistant', content: 'Coaching: …' }] },
      { id: 'c2', beginn: '2026-10-12T19:00:00Z', fragen: 1, verlauf: [{ role: 'assistant', content: 'Coaching' }, { role: 'user', content: 'Und Beine?' }] },
      { id: 'g1', beginn: '2026-10-06T10:00:00Z', fragen: 1, verlauf: [{ role: 'user', content: 'Wie viel Eiweiß?' }] },
    ];
    const html = gedaechtnisMarkup({ coachings, gespraeche });
    expect(html).toContain('ist-coachings');
    expect(html).toContain('<b>Wochen-Coaching vom 12.10.2026</b>');
    expect(html).toContain('<b>Wie viel Eiweiß?</b>');
    expect(html).not.toContain('data-gespraech-fortsetzen="c1"');
    expect(gedaechtnisMarkup({ coachings: null, gespraeche: [] })).not.toContain('ist-coachings');
  });
});

describe('Einlaufen der Antwort', () => {
  it('läuft kurze Antworten mit 40 Wörtern je Sekunde ein und lange in höchstens zwei Sekunden', () => {
    expect(schreibTempo(30)).toBe(40);
    expect(schreibTempo(200)).toBe(100);
    expect(200 / schreibTempo(200)).toBeLessThanOrEqual(2);
  });
});

describe('Symbolleiste unter einer Coach-Antwort', () => {
  const frage = { modus: 'frage', answer: 'Ja, eine Woche Pause.', followUpQuestion: 'Wie schläfst du?', stepsUseful: true };

  it('zeigt im Verlauf Kopieren, Vorlesen, Teilen und nur wo sinnvoll „Schritte“', () => {
    const html = resultMarkup(frage, { merken: true });
    ['kopieren', 'vorlesen', 'teilen'].forEach((aktion) => expect(html).toContain(`data-aktion="${aktion}"`));
    expect(html).toContain('data-schritte-aus');
    expect(html).toContain('coach-antwort-kopf');
    expect(resultMarkup({ ...frage, stepsUseful: false }, { merken: true })).not.toContain('data-schritte-aus');
    expect(resultMarkup(frage)).not.toContain('coach-aktionen');
  });

  it('gibt die Antwort als schlichten Text weiter, bei Bewertungen mit den Schritten', () => {
    expect(antwortText(frage)).toBe('Ja, eine Woche Pause.\n\nWie schläfst du?');
    expect(antwortText({ summary: 'Zwei Ruhetage.', recommendations: [{ action: 'Ruhetage einlegen' }] }))
      .toBe('Zwei Ruhetage.\n\nNächste Schritte:\n– Ruhetage einlegen');
    expect(antwortText(null)).toBe('');
  });
});
