import { describe, expect, it } from 'vitest';
import {
  gedaechtnisMarkup, gruppiereGespraeche, istNichtEingerichtet, massnahmeAusEmpfehlung, pruefeFakt, pruefeMassnahme,
  vergissLokalesGespraech,
} from './coachMemory.js';
import { resultMarkup, verlaufMarkup } from './coach.js';

const massnahme = (werte = {}) => ({
  id: 'm1', action: 'Letzte Mahlzeit drei Stunden vor dem Schlafen', hypothesis: null, target_metric: 'Schlafqualität',
  start_date: '2026-09-01', review_date: '2026-09-22', status: 'aktiv', adherence: 'teilweise', outcome: null, source: 'nutzer', ...werte,
});

describe('Coach-Gedächtnis: Eingaben', () => {
  it('prüft Fakten auf Kategorie und Länge', () => {
    expect(pruefeFakt({ category: 'verletzung', fact: 'Knieschmerzen links' })).toBeNull();
    expect(pruefeFakt({ category: 'unbekannt', fact: 'Knieschmerzen links' })).toMatch(/Kategorie/);
    expect(pruefeFakt({ category: 'ziel', fact: ' x ' })).toMatch(/eintragen/);
    expect(pruefeFakt({ category: 'ziel', fact: 'x'.repeat(501) })).toMatch(/500/);
  });

  it('prüft Maßnahmen auf Pflichtfelder, Daten und erlaubte Werte', () => {
    expect(pruefeMassnahme(massnahme())).toBeNull();
    expect(pruefeMassnahme(massnahme({ action: '' }))).toMatch(/beschreiben/);
    expect(pruefeMassnahme(massnahme({ review_date: '2026-08-31' }))).toMatch(/vor dem Start/);
    expect(pruefeMassnahme(massnahme({ start_date: '' }))).toMatch(/Startdatum/);
    expect(pruefeMassnahme(massnahme({ status: 'pausiert' }))).toMatch(/Status/);
    expect(pruefeMassnahme(massnahme({ adherence: 'immer' }))).toMatch(/Umsetzung/);
    expect(pruefeMassnahme(massnahme({ review_date: null }))).toBeNull();
  });

  it('erkennt eine noch nicht eingespielte Migration', () => {
    expect(istNichtEingerichtet({ code: '42P01', message: 'relation does not exist' })).toBe(true);
    expect(istNichtEingerichtet({ code: 'PGRST205', message: 'Could not find the table' })).toBe(true);
    expect(istNichtEingerichtet({ code: '42703', message: 'column conversation_id does not exist' })).toBe(true);
    expect(istNichtEingerichtet({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(istNichtEingerichtet(null)).toBe(false);
  });
});

describe('Coach-Gedächtnis: Empfehlung als Maßnahme', () => {
  it('übernimmt Aktion und Begründung, ab heute, ohne Prüfdatum', () => {
    const eintrag = massnahmeAusEmpfehlung({ action: 'Protein auf 170 g', rationale: 'Wenn …, dann …', timeframe: '3 Wochen' }, '2026-09-26');
    expect(eintrag).toMatchObject({ action: 'Protein auf 170 g', hypothesis: 'Wenn …, dann …', start_date: '2026-09-26', review_date: null, status: 'aktiv', source: 'coach_empfehlung' });
    expect(pruefeMassnahme(eintrag)).toBeNull();
  });

  it('kürzt überlange Empfehlungen auf die erlaubte Länge', () => {
    const eintrag = massnahmeAusEmpfehlung({ action: 'a'.repeat(900), rationale: 'b'.repeat(2000) }, '2026-09-26');
    expect(eintrag.action.length).toBe(500);
    expect(eintrag.hypothesis.length).toBe(1000);
    expect(pruefeMassnahme(eintrag)).toBeNull();
  });
});

describe('Coach-Gedächtnis: Gespräche', () => {
  it('gruppiert Nachrichten je Gespräch und ordnet sie zeitlich', () => {
    const gespraeche = gruppiereGespraeche([
      { conversation_id: 'b', role: 'assistant', content: 'Antwort 2', created_at: '2026-09-26T10:00:01Z' },
      { conversation_id: 'b', role: 'user', content: 'Frage 2', created_at: '2026-09-26T10:00:00Z' },
      { conversation_id: 'a', role: 'assistant', content: 'Antwort 1', created_at: '2026-09-25T09:00:01Z' },
      { conversation_id: 'a', role: 'user', content: 'Frage 1', created_at: '2026-09-25T09:00:00Z' },
      { conversation_id: null, role: 'user', content: 'ohne Gespräch', created_at: '2026-09-24T09:00:00Z' },
    ]);
    expect(gespraeche.map((gespraech) => gespraech.id)).toEqual(['b', 'a']);
    expect(gespraeche[0].verlauf.map((nachricht) => nachricht.content)).toEqual(['Frage 2', 'Antwort 2']);
    expect(gespraeche[0].fragen).toBe(1);
  });

  it('entfernt beim Löschen auch die passende lokale Gesprächskopie', () => {
    const speicher = new Map([['muscledex:coach-gespraech', JSON.stringify({ id: 'g1', runden: [] })]]);
    const storage = { getItem: (key) => speicher.get(key) || null, removeItem: (key) => speicher.delete(key) };
    expect(vergissLokalesGespraech('anderes', storage)).toBe(false);
    expect(speicher.has('muscledex:coach-gespraech')).toBe(true);
    expect(vergissLokalesGespraech('g1', storage)).toBe(true);
    expect(speicher.has('muscledex:coach-gespraech')).toBe(false);
  });
});

describe('Coach-Gedächtnis: Seite', () => {
  it('sagt, wenn das Gedächtnis noch nicht eingerichtet ist', () => {
    expect(gedaechtnisMarkup({ eingerichtet: false })).toContain('noch nicht eingerichtet');
  });

  it('zeigt Einträge mit Bearbeiten und Löschen und escaped fremden Text', () => {
    const html = gedaechtnisMarkup({
      fakten: [{ id: 'f1', category: 'verletzung', fact: '<img src=x onerror=alert(1)> Knie', confirmed_on: '2026-09-20' }],
      massnahmen: [massnahme()],
      gespraeche: gruppiereGespraeche([{ conversation_id: 'g1', role: 'user', content: '<b>Frage</b>', created_at: '2026-09-26T10:00:00Z' }]),
      tag: '2026-09-26',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; Knie');
    expect(html).not.toContain('<b>Frage</b>');
    expect(html).toContain('data-fakt-loeschen="f1"');
    expect(html).toContain('data-fakt-bearbeiten="f1"');
    expect(html).toContain('data-massnahme-loeschen="m1"');
    expect(html).toContain('data-gespraech-loeschen="g1"');
    expect(html).toContain('Alle Gespräche löschen');
    expect(html).toContain('Bestätigt am 20.09.2026');
  });

  it('markiert eine Maßnahme mit erreichtem Prüfdatum als fällig', () => {
    expect(gedaechtnisMarkup({ massnahmen: [massnahme()], tag: '2026-09-26' })).toContain('Prüfung fällig');
    expect(gedaechtnisMarkup({ massnahmen: [massnahme()], tag: '2026-09-21' })).not.toContain('Prüfung fällig');
    expect(gedaechtnisMarkup({ massnahmen: [massnahme({ status: 'abgeschlossen' })], tag: '2026-09-26' })).not.toContain('Prüfung fällig');
  });

  it('zeigt leere Bereiche mit einem Hinweis statt einer leeren Liste', () => {
    const html = gedaechtnisMarkup({});
    expect(html).toContain('Noch nichts eingetragen.');
    expect(html).toContain('Noch keine Maßnahme.');
    expect(html).toContain('Noch keine gespeicherten Gespräche.');
  });
});

describe('Coach-Seite: Gespräch und Maßnahmen', () => {
  const ergebnis = {
    title: 'CAPBOY COACH', summary: 'Einordnung', confidence: 'mittel', facts: [], interpretations: [], uncertainties: [], safetyNote: '',
    recommendations: [{ action: 'Schritt A', rationale: 'weil', timeframe: '2 Wochen' }, { action: 'Schritt B', rationale: 'weil', timeframe: '3 Wochen' }],
  };

  it('bietet „Als Maßnahme merken“ nur auf der Coach-Seite an', () => {
    expect(resultMarkup(ergebnis, { merken: true })).toContain('data-empfehlung-merken="1"');
    expect(resultMarkup(ergebnis)).not.toContain('data-empfehlung-merken');
  });

  it('zeigt frühere Runden escaped und zusammengeklappt', () => {
    const html = verlaufMarkup([{ frage: '<script>x</script>', result: { summary: 'Antwort' } }]);
    expect(html).toContain('<details class="coach-verlauf">');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('1 Frage');
    expect(verlaufMarkup([])).toBe('');
  });
});
