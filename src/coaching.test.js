import { beforeEach, describe, expect, it } from 'vitest';
import { COACHING_ROUTEN, coachingHinweise, coachingKarteMarkup, coachingKopf, coachingQuellen, coachingText, routeBesucht } from './coaching.js';
import { quellenSheetMarkup } from './chatLeiste.js';

// Kleiner Speicher-Ersatz: Die besuchten Reiter liegen im localStorage.
beforeEach(() => {
  const speicher = new Map();
  globalThis.localStorage = {
    getItem: (key) => (speicher.has(key) ? speicher.get(key) : null),
    setItem: (key, value) => speicher.set(key, String(value)),
    removeItem: (key) => speicher.delete(key),
  };
});

const frisch = (aenderung = {}) => ({
  id: 'c1', datum: '2026-10-03', status: 'bereit', erstellt_am: new Date().toISOString(), gelesen_am: null,
  bereiche: ['training', 'schlaf', 'erholung', 'koerper'],
  ergebnis: { ueberschrift: 'Titel', punkte: [{ bereich: 'training', text: 'Punkt <b>' }], fokus: { bereich: 'training', text: 'Fokus' }, datenlage: 'mittel' },
  ...aenderung,
});

describe('Coaching: Hinweise in Kopf und Menüband', () => {
  it('zeigt bei einem frischen, ungelesenen Coaching den Briefumschlag und Punkte an den Reitern', () => {
    const hinweise = coachingHinweise(frisch());
    expect(hinweise.ungelesen).toBe(true);
    // Erholung und Körper landen beide auf COMP.
    expect([...hinweise.routen].sort()).toEqual(['body', 'sleep', 'training']);
  });

  it('nimmt den Punkt einer Seite nach dem Besuch weg, den Briefumschlag aber nicht', () => {
    const coaching = frisch();
    expect(routeBesucht(coaching, 'sleep')).toBe(true);
    expect(routeBesucht(coaching, 'sleep')).toBe(false);
    expect(routeBesucht(coaching, 'shopping')).toBe(false);
    const hinweise = coachingHinweise(coaching);
    expect([...hinweise.routen].sort()).toEqual(['body', 'training']);
    expect(hinweise.ungelesen).toBe(true);
  });

  it('zeigt nichts für gelesene Hinweise, alte, laufende oder fehlgeschlagene Coachings', () => {
    expect(coachingHinweise(frisch({ gelesen_am: '2026-10-03T19:10:00Z' })).ungelesen).toBe(false);
    expect(coachingHinweise(frisch({ erstellt_am: '2026-09-01T19:00:00Z' })).routen.size).toBe(0);
    expect(coachingHinweise(frisch({ status: 'laeuft' })).ungelesen).toBe(false);
    expect(coachingHinweise(frisch({ status: 'fehlgeschlagen' })).routen.size).toBe(0);
    expect(coachingHinweise(null)).toEqual({ ungelesen: false, routen: new Set() });
  });

  it('ordnet jeden Bereich einem Reiter zu', () => {
    expect(COACHING_ROUTEN).toEqual({ training: 'training', ernaehrung: 'reminders', schlaf: 'sleep', koerper: 'body', erholung: 'body', routinen: 'habits' });
  });
});

describe('Coaching: Karte', () => {
  it('zeigt Überschrift, Punkte mit Bereich und Fokus wie eine Antwort und maskiert Text', () => {
    const html = coachingKarteMarkup(frisch());
    expect(html).toContain('<h2>Titel</h2>');
    expect(html).toContain('Punkt &lt;b&gt;');
    expect(html).toContain('<h4 class="coaching-bereich">Training</h4>');
    expect(html).toContain('class="coaching-fokus"');
    // Dieselbe Leiste wie unter jeder Antwort; die Quellen sind deine Daten.
    expect(html).toContain('data-aktion="mehr"');
    expect(html).toContain('data-aktion="quellen"');
    expect(quellenSheetMarkup(coachingQuellen(frisch()))).toContain('Deine Daten: Training, Schlaf, Erholung, Körper');
    expect(html).not.toContain('Datenlage');
    const ohneFokus = coachingKarteMarkup(frisch({ ergebnis: { ...frisch().ergebnis, fokus: null } }));
    expect(ohneFokus).not.toContain('coaching-fokus');
    expect(ohneFokus).toContain('<h2>Titel</h2>');
  });


  it('gibt Text und Kopf für Kopieren, Teilen und das „…“-Menü', () => {
    expect(coachingText(frisch())).toBe('Titel\n\nPunkt <b>\n\nFokus: Fokus');
    expect(coachingKopf(frisch())).toMatch(/, 21 Uhr · Coaching$/);
    expect(coachingKopf(frisch({ art: 'woche' }))).toMatch(/ · Wochen-Coaching$/);
  });

  it('zeigt einen klaren Status, solange das Coaching läuft oder wenn es scheiterte', () => {
    expect(coachingKarteMarkup(frisch({ status: 'laeuft', ergebnis: null }))).toContain('wird gerade erstellt');
    expect(coachingKarteMarkup(frisch({ status: 'fehlgeschlagen', ergebnis: null }))).toContain('konnte diesmal nicht erstellt werden');
    // Fehlt OpenAI-Guthaben, steht der Grund da und kein „frag im Chat“.
    const ohneGuthaben = coachingKarteMarkup(frisch({ status: 'fehlgeschlagen', ergebnis: null, fehler: 'OpenAI /responses: 429 You have no credits remaining.' }));
    expect(ohneGuthaben).toContain('Guthaben bei OpenAI ist aufgebraucht');
    expect(ohneGuthaben).not.toContain('jederzeit hier im Chat');
    expect(coachingKarteMarkup(null)).toBe('');
  });

  it('meldet einen nach 15 Minuten noch laufenden Lauf als gescheitert', () => {
    const vorZwanzigMinuten = new Date(Date.now() - 20 * 60_000).toISOString();
    expect(coachingKarteMarkup(frisch({ status: 'laeuft', ergebnis: null, erstellt_am: vorZwanzigMinuten }))).toContain('konnte diesmal nicht erstellt werden');
  });
});
