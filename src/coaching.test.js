import { beforeEach, describe, expect, it } from 'vitest';
import { COACHING_ROUTEN, coachingHinweise, coachingKarteMarkup, routeBesucht } from './coaching.js';

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
  it('zeigt Überschrift, Punkte mit Bereich und Fokus und maskiert Text', () => {
    const html = coachingKarteMarkup(frisch());
    expect(html).toContain('<h2>Titel</h2>');
    expect(html).toContain('Punkt &lt;b&gt;');
    expect(html).toContain('<span class="coaching-bereich">Training</span>');
    expect(html).toContain('class="coaching-fokus"');
    expect(html).toContain('Auf Basis deiner Daten');
    expect(html).not.toContain('Datenlage');
  });


  it('zeigt einen klaren Status, solange das Coaching läuft oder wenn es scheiterte', () => {
    expect(coachingKarteMarkup(frisch({ status: 'laeuft', ergebnis: null }))).toContain('wird gerade erstellt');
    expect(coachingKarteMarkup(frisch({ status: 'fehlgeschlagen', ergebnis: null }))).toContain('konnte diesmal nicht erstellt werden');
    expect(coachingKarteMarkup(null)).toBe('');
  });

  it('meldet einen nach 15 Minuten noch laufenden Lauf als gescheitert', () => {
    const vorZwanzigMinuten = new Date(Date.now() - 20 * 60_000).toISOString();
    expect(coachingKarteMarkup(frisch({ status: 'laeuft', ergebnis: null, erstellt_am: vorZwanzigMinuten }))).toContain('konnte diesmal nicht erstellt werden');
  });
});
