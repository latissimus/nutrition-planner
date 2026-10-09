import { describe, expect, it } from 'vitest';
import { falschFett, fettBefundCoaching, fettBefundFrage, fettStellen } from '../scripts/coach-evals/fett.mjs';
import { resultMarkup } from './coach.js';

// Kernaussagen fett (COACHING-PLAN.md, 08./09.10.2026): gemeinsame
// Vorprüfung der Fallsätze und schlichter Sicherheitshinweis in der App.

describe('Vorprüfung „Kernaussagen fett“', () => {
  it('findet fette Stellen und meldet Etiketten, Quellen und Dosen', () => {
    expect(fettStellen('Ja, **eine Woche** reicht. **Sicher.**')).toEqual(['eine Woche', 'Sicher.']);
    expect(falschFett('[Evidenz] Protein hilft', 160)).toContain('Etikett oder Quelle');
    expect(falschFett('Supplements.pdf', 160)).toContain('Etikett oder Quelle');
    expect(falschFett('5 g Kreatin', 160)).toContain('Dosis');
    expect(falschFett('3–5 g täglich', 160)).toContain('Dosis');
    expect(falschFett('eine Woche Pause kostet keine Muskeln', 160)).toBeNull();
    expect(falschFett('6–10 Wiederholungen', 80)).toBeNull();
  });

  it('prüft die Frage-Antwort: ein bis zwei Stellen, nichts in Hinweis und Rückfrage', () => {
    expect(fettBefundFrage({ answer: 'Ja, **eine Woche** reicht.', safetyNote: '', followUpQuestion: '' })).toEqual([]);
    expect(fettBefundFrage({ answer: 'Ja.', safetyNote: '', followUpQuestion: '' })).toEqual(['keine Kernaussage fett']);
    expect(fettBefundFrage({ answer: '**a** **b** **c**', safetyNote: '', followUpQuestion: '' })).toContain('3 fette Stellen (höchstens 2)');
    expect(fettBefundFrage({ answer: '**Nein.**', safetyNote: '**Lass das.**', followUpQuestion: '' })).toContain('Fett im Sicherheitshinweis oder in der Rückfrage');
  });

  it('prüft Tages- und Wochen-Coaching mit derselben Regel', () => {
    const ergebnis = { punkte: [{ text: 'Plus **5 kg**.' }, { text: 'Schlaf **gut**, **lang**.' }], fokus: { text: 'Peile **6–10 Wdh.** an.' } };
    const roh = { ueberschrift: '**Stark**', punkte: [], fokus: {}, datenlage: 'mittel', volumen: { begruendung: '**weil**' } };
    expect(fettBefundCoaching(roh, ergebnis)).toEqual([
      'Überschrift fett gesetzt (Push; wird entfernt)',
      'mehr als eine fette Stelle in einem Text',
      'Fett außerhalb von Punkten und Fokus',
    ]);
    expect(fettBefundCoaching({ ueberschrift: 'Ruhig' }, { punkte: [{ text: 'Ohne Fett.' }], fokus: null })).toEqual(['keine Kernaussage fett']);
  });
});

describe('Sicherheitshinweis und Rückfrage bleiben in der App schlicht', () => {
  it('zeigt dort keine fetten Stellen, im Antworttext schon', () => {
    const html = resultMarkup({ modus: 'frage', answer: 'Nein, **kein SARM**.', safetyNote: '**Beginne keine Einnahme.**', followUpQuestion: 'Wie **oft**?' });
    expect(html).toContain('Nein, <b>kein SARM</b>.');
    expect(html).toContain('<p class="coach-safety">Beginne keine Einnahme.</p>');
    expect(html).toContain('<p class="coach-rueckfrage">Wie oft?</p>');
  });
});
