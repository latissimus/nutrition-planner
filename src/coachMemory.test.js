import { describe, expect, it } from 'vitest';
import {
  auswertungAlsAenderung, gedaechtnisMarkup, gruppiereGespraeche, istNichtEingerichtet, massnahmeAusEmpfehlung, mitExperimentRueckfall,
  pruefeFakt, pruefeMassnahme, vergissLokalesGespraech,
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

describe('Coach-Gedächtnis: Experimente', () => {
  const experiment = (werte = {}) => ({
    kind: 'experiment', action: 'Letzte Mahlzeit drei Stunden vor dem Schlafen', rationale: 'Spätes Essen fällt mit schlechtem Schlaf zusammen.',
    timeframe: '3 Wochen', hypothesis: 'Wenn ich früher esse, steigt die Schlafqualität.', baseline: 'Schlafqualität 2,8 von 5 (2026-W38)',
    targetMetric: 'schlafqualitaet', expectedDirection: 'steigt', reviewDate: '2026-10-17', ...werte,
  });

  it('übernimmt Hypothese, Zielgröße, Richtung, Ausgangswert und Prüfdatum', () => {
    const eintrag = massnahmeAusEmpfehlung(experiment(), '2026-09-26');
    expect(eintrag).toMatchObject({
      hypothesis: 'Wenn ich früher esse, steigt die Schlafqualität.', target_metric_id: 'schlafqualitaet', target_metric: 'Schlafqualität',
      expected_direction: 'steigt', baseline_note: 'Schlafqualität 2,8 von 5 (2026-W38)', review_date: '2026-10-17', start_date: '2026-09-26',
    });
    expect(pruefeMassnahme(eintrag)).toBeNull();
  });

  it('verwirft unbekannte Zielgrößen, „keine“ und Prüfdaten vor heute', () => {
    const eintrag = massnahmeAusEmpfehlung(experiment({ targetMetric: 'keine', expectedDirection: 'steigt', reviewDate: '2026-09-01' }), '2026-09-26');
    expect(eintrag).toMatchObject({ target_metric_id: null, target_metric: null, expected_direction: null, review_date: null });
    expect(massnahmeAusEmpfehlung(experiment({ targetMetric: 'laune' }), '2026-09-26').target_metric_id).toBeNull();
    expect(massnahmeAusEmpfehlung(experiment({ reviewDate: 'bald' }), '2026-09-26').review_date).toBeNull();
    expect(pruefeMassnahme({ ...eintrag, target_metric_id: 'laune' })).toMatch(/Zielgröße/);
    expect(pruefeMassnahme({ ...eintrag, expected_direction: 'hoch' })).toMatch(/Richtung/);
  });

  it('hält eine Auswertung fest: beenden und anpassen schließen den alten Versuch ab', () => {
    const basis = 'Schlafqualität: 2 von 5 (2026-W35) → 4 von 5 (2026-W38), Veränderung +2';
    expect(auswertungAlsAenderung({ verdict: 'wirksam', decision: 'beenden', basis }, '2026-09-26')).toEqual({
      outcome: `Auswertung vom 26.09.2026: wirksam, beenden. ${basis}`, status: 'abgeschlossen',
    });
    expect(auswertungAlsAenderung({ verdict: 'unklar', decision: 'beibehalten', basis }, '2026-09-26')).toEqual({
      outcome: `Auswertung vom 26.09.2026: unklar, beibehalten. ${basis}`, status: 'aktiv', review_date: null,
    });
    const angepasst = auswertungAlsAenderung({ verdict: 'nicht_wirksam', decision: 'anpassen', basis: 'x'.repeat(2000) }, '2026-09-26');
    expect(angepasst.status).toBe('abgeschlossen');
    expect(angepasst.outcome.length).toBe(1000);
  });

  it('speichert ohne Experimentfelder, solange deren Migration fehlt', async () => {
    const aufrufe = [];
    const fehlendeSpalte = { error: { code: 'PGRST204', message: "Could not find the 'target_metric_id' column" } };
    const schreiben = async (zeile) => { aufrufe.push(zeile); return 'target_metric_id' in zeile ? fehlendeSpalte : { data: { id: 'neu' }, error: null }; };
    const eintrag = massnahmeAusEmpfehlung(experiment(), '2026-09-26');
    expect(await mitExperimentRueckfall(schreiben, eintrag)).toEqual({ data: { id: 'neu' }, error: null });
    expect(aufrufe).toHaveLength(2);
    expect(aufrufe[1]).not.toHaveProperty('target_metric_id');
    expect(aufrufe[1]).toMatchObject({ action: eintrag.action, review_date: '2026-10-17' });
  });

  it('versucht es bei anderen Fehlern nicht ohne Experimentfelder erneut', async () => {
    const aufrufe = [];
    const verboten = { error: { code: '42501', message: 'permission denied' } };
    const schreiben = async (zeile) => { aufrufe.push(zeile); return verboten; };
    expect(await mitExperimentRueckfall(schreiben, massnahmeAusEmpfehlung(experiment(), '2026-09-26'))).toBe(verboten);
    expect(aufrufe).toHaveLength(1);
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

  it('zeigt Experimente mit Hypothese, Ausgangswert, Zielgröße und Prüfdatum', () => {
    const html = resultMarkup({
      ...ergebnis,
      recommendations: [
        { kind: 'experiment', action: 'Früher essen', rationale: 'weil', timeframe: '3 Wochen', hypothesis: 'Wenn früher, dann besser', baseline: '2,8 von 5 <b>', targetMetric: 'schlafqualitaet', expectedDirection: 'steigt', reviewDate: '2026-10-17' },
        { kind: 'sicherheit', action: 'Ärztlich abklären', rationale: 'weil', timeframe: 'diese Woche', hypothesis: '', baseline: '', targetMetric: 'keine', expectedDirection: 'keine', reviewDate: '' },
        { kind: 'beobachtung', action: 'Weiter protokollieren', rationale: 'weil', timeframe: '2 Wochen', hypothesis: '', baseline: '', targetMetric: 'keine', expectedDirection: 'keine', reviewDate: '' },
      ],
    }, { merken: true });
    expect(html).toContain('Experiment · prüfen am 17.10.2026');
    expect(html).toContain('Hypothese:</em> Wenn früher, dann besser');
    expect(html).toContain('Ausgangswert:</em> 2,8 von 5 &lt;b&gt;');
    expect(html).toContain('Zielgröße:</em> Schlafqualität – steigt');
    expect(html).toContain('data-empfehlung-merken="0">Als Experiment merken');
    // Ein Sicherheitsschritt ist keine Maßnahme zum Ausprobieren.
    expect(html).not.toContain('data-empfehlung-merken="1"');
    expect(html).toContain('data-empfehlung-merken="2">Als Maßnahme merken');
    expect(html).not.toContain('Zielgröße:</em> keine');
  });

  it('zeigt Auswertungen fälliger Experimente mit „Ergebnis übernehmen“', () => {
    const auswertung = { ...ergebnis, experimentReviews: [{ experimentId: 'e1', verdict: 'nicht_wirksam', decision: 'anpassen', basis: 'Schlafqualität: 3 von 5 → 3 von 5' }] };
    const html = resultMarkup(auswertung, { merken: true });
    expect(html).toContain('Auswertung deiner Experimente');
    expect(html).toContain('nicht wirksam · anpassen');
    expect(html).toContain('data-auswertung-uebernehmen="0"');
    expect(resultMarkup(auswertung)).not.toContain('data-auswertung-uebernehmen');
    expect(resultMarkup({ ...ergebnis, experimentReviews: [] })).not.toContain('Auswertung deiner Experimente');
  });

  it('zeigt frühere Runden escaped als Chatfenster', () => {
    const html = verlaufMarkup([{ frage: '<script>x</script>', result: { summary: 'Antwort' } }]);
    expect(html).toContain('coach-chat-window is-user');
    expect(html).toContain('coach-chat-window is-coach');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('CAPBOY');
    expect(verlaufMarkup([])).toBe('');
  });
});
