import { describe, expect, it } from 'vitest';
import {
  COACHING_SCHEMA, coachingBereinigen, coachingSystemPrompt, coachingUserPrompt, geaenderteBereiche, hatNeueDaten,
} from '../supabase/functions/capboy-coach/coaching.ts';
import { coachSystemPrompt } from '../supabase/functions/capboy-coach/coachPrompt.ts';

describe('Tägliches Coaching: Änderung seit dem letzten Lauf', () => {
  it('wertet auch eine nachgetragene Messung als neu, wenn ihr Änderungszähler steigt', () => {
    expect(hatNeueDaten(18, 17)).toBe(true);
    expect(hatNeueDaten(18, 18)).toBe(false);
  });

  it('startet weder ohne Daten noch erneut für denselben verarbeiteten Stand', () => {
    expect(hatNeueDaten(0, 0)).toBe(false);
    expect(hatNeueDaten(undefined, 0)).toBe(false);
    expect(hatNeueDaten(6, 7)).toBe(false);
  });

  it('erkennt nachgetragenes Training und ausgeschaltete Bereiche getrennt', () => {
    const revisionen = { logman_spiegel: 21, sleep_logs: 22, nutrition_log_entries: 19 };
    expect(geaenderteBereiche(revisionen, 20, ['sleep'])).toEqual(['training']);
    expect(geaenderteBereiche(revisionen, 22, [])).toEqual([]);
  });
});

describe('Antwort des Coachings', () => {
  it('bringt die Antwort in feste Form und sammelt die angesprochenen Bereiche', () => {
    const ergebnis = coachingBereinigen({
      ueberschrift: 'Bankdrücken +2,7 kg e1RM – Schlaf hält mit',
      punkte: [
        { bereich: 'training', text: 'Bankdrücken: 80 kg × 9 statt × 8.' },
        { bereich: 'schlaf', text: '7:40 h geschlafen.' },
        { bereich: 'unbekannt', text: 'fällt weg' },
        { bereich: 'training', text: '' },
      ],
      fokus: { bereich: 'training', text: 'Nächste Einheit: 80 kg × 10.' },
      datenlage: 'mittel',
    });
    expect(ergebnis.punkte).toHaveLength(2);
    expect(ergebnis.bereiche).toEqual(['training', 'schlaf']);
    expect(ergebnis).toMatchObject({ datenlage: 'mittel', fokus: { bereich: 'training' } });
  });

  it('speichert keine leere Karte ohne Überschrift oder Punkt', () => {
    expect(() => coachingBereinigen({ punkte: 'x', datenlage: 'sehr hoch' })).toThrow('Coaching-Antwort');
    expect(() => coachingBereinigen({ ueberschrift: 'Heute', punkte: [], fokus: { bereich: 'training', text: 'Morgen.' } })).toThrow('Coaching-Antwort');
  });

  // Rückmeldung des Nutzers 07.10.: Im ersten Zyklus kam als Fokus nur der
  // geplante Bereich einer beliebigen Übung („Beinpresse 6–10 Wdh.“).
  it('lässt den Fokus ohne echten Hebel weg, statt einen beliebigen zu erzwingen', () => {
    const ohne = coachingBereinigen({ ueberschrift: 'Heute', punkte: [{ bereich: 'training', text: 'Gut.' }], fokus: { bereich: 'training', text: ' ' } });
    expect(ohne.fokus).toBeNull();
    expect(ohne.bereiche).toEqual(['training']);
    expect(coachingBereinigen({ ueberschrift: 'Heute', punkte: [{ bereich: 'schlaf', text: 'Kurz.' }] }).fokus).toBeNull();
    const prompt = coachingSystemPrompt();
    expect(prompt).toContain('Never build a focus from an "erstmals" target');
    expect(prompt).toContain('no focus is better than a random one');
  });

  it('bleibt ein Coach für Muskelaufbau: kein Sicherheitshinweis, nur eine knappe Ausnahme für eindeutig Ernstes', () => {
    const prompt = coachingSystemPrompt();
    expect(COACHING_SCHEMA.properties).not.toHaveProperty('sicherheitshinweis');
    expect(prompt).toContain('not a doctor');
    // Ausnahme nach GPT-Review 05.10.: nur aus eigenen Notizen, ein ruhiger Satz im Fokus, kein Alarm.
    expect(prompt).toContain("Only exception: if the user's own note clearly reports something beyond a training complaint");
    // Ruhig, aber mit passender Dringlichkeit (GPT-Review 05.10., zweite Runde).
    expect(prompt).toContain('have it checked by a doctor promptly, before training again');
    expect(prompt).toContain('say to get urgent medical help now');
    expect(prompt).toContain('No drama, no diagnosis.');
    expect(prompt).not.toMatch(/palpitations|red flag|sicherheitshinweis|112|emergency number/i);
  });

  it('berücksichtigt trainingstypische Beschwerden allgemein, Impingement und GTPS nur als Beispiele', () => {
    const prompt = coachingSystemPrompt();
    expect(prompt).toContain('9. Training complaints');
    expect(prompt).toMatch(/joints, tendons or muscles/);
    expect(prompt).toContain('these are only examples');
    expect(prompt).toContain('keep the load instead of increasing it while it hurts');
  });

  it('bewertet den Körper nach Hautfalten und Taille, nie nach Gewicht allein', () => {
    const prompt = coachingSystemPrompt();
    expect(prompt).toContain('10. Body composition');
    expect(prompt).toContain('"skinfoldChangeMm"');
    expect(prompt).toContain('Never judge body composition from weight alone.');
    expect(prompt).not.toContain('and the weight trend for the most plausible');
  });


  it('begrenzt die Push-Überschrift auf 70 Zeichen', () => {
    const ergebnis = coachingBereinigen({
      ueberschrift: 'A'.repeat(80), punkte: [{ bereich: 'training', text: 'Heute trainiert.' }],
      fokus: { bereich: 'training', text: 'Nächste Einheit.' }, datenlage: 'mittel',
    });
    expect(ergebnis.ueberschrift).toHaveLength(70);
  });

  it('erlaubt höchstens drei Punkte und nur bekannte Bereiche (Schema)', () => {
    expect(COACHING_SCHEMA.properties.punkte.maxItems).toBe(3);
    expect(COACHING_SCHEMA.properties.fokus.properties.bereich.enum).toEqual(['training', 'schlaf', 'ernaehrung', 'koerper', 'erholung', 'routinen']);
  });
});

describe('Eingabe und Prompt des Coachings', () => {
  it('legt Trainingsauswertung und Vortag in <timeseries>, die Blockschnittstelle bleibt gleich', () => {
    const text = coachingUserPrompt({
      snapshot: { generatedAt: '2026-10-03' },
      timeseries: { weeks: [] },
      training: { stand: { cycle: 2 } },
      aenderungen: ['training'],
      vortag: { datum: '2026-10-02', fokus: { bereich: 'schlaf', text: 'Vor 23 Uhr ins Bett.' } },
      memory: {},
      heute: '2026-10-03',
    });
    const zeitreihe = JSON.parse(text.match(/<timeseries>\n([\s\S]*?)\n<\/timeseries>/)[1]);
    expect(zeitreihe.training).toEqual({ stand: { cycle: 2 } });
    expect(zeitreihe.coachingVortag.datum).toBe('2026-10-02');
    expect(zeitreihe.aenderungen).toEqual(['training']);
    expect(text).toContain('<user_question>\nErstelle das Coaching für heute, 2026-10-03.\n</user_question>');
    expect(text).not.toContain('<profile_memory>');
  });

  it('übernimmt jedes gewählte Ziel, ohne bei fehlendem Ziel Muskelaufbau zu unterstellen', () => {
    expect(coachingSystemPrompt('lose')).toContain('Selected goal: gradual fat loss');
    expect(coachingSystemPrompt('maintain')).toContain('Selected goal: weight maintenance');
    expect(coachingSystemPrompt('gain')).toContain('Selected goal: muscle gain');
    expect(coachingSystemPrompt('gain_fast')).toContain('Selected goal: faster weight gain');
    expect(coachingSystemPrompt('bodycomp')).toContain('Selected goal: body recomposition');
    expect(coachingSystemPrompt()).toContain('No goal is selected');
    const prompt = coachingSystemPrompt('gain');
    expect(prompt).toContain('Targets for the next session come only from "naechsteEinheit"');
    expect(prompt).toContain('the weekly review decides that');
  });

  it('lässt den Prompt des Chat-Coaches unberührt', () => {
    expect(coachSystemPrompt('coach', false)).not.toContain('daily coaching');
  });
});
