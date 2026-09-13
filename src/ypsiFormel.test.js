import { describe, expect, it } from 'vitest';
import {
  SUMMEN_FALTEN,
  auswertung,
  erwarteteFaltensumme,
  faltenRang,
  kfaSumme,
  koerperfettAnteil,
  magermasse,
} from './ypsiFormel.js';

const messung = {
  kinn: 4, wange: 4, brust: 6, ruecken: 9, rippe: 6, huefte: 8, bauch: 14,
  trizeps: 9, bizeps: 3, knie: 5, wade: 7, quadrizeps: 12, beinbizeps: 11,
};

describe('YPSI-Summenbildung', () => {
  it('summiert genau die zehn Falten der Vorlage', () => {
    expect(SUMMEN_FALTEN).toHaveLength(10);
    expect(SUMMEN_FALTEN).not.toContain('quadrizeps');
    expect(SUMMEN_FALTEN).not.toContain('beinbizeps');
    expect(SUMMEN_FALTEN).not.toContain('bizeps');
    // 4+4+6+9+6+8+14+9+5+7
    expect(kfaSumme(messung)).toBe(72);
  });

  it('ignoriert Oberschenkel und Bizeps in der Summe', () => {
    expect(kfaSumme({ ...messung, quadrizeps: 40, beinbizeps: 40, bizeps: 40 })).toBe(72);
  });

  it('liefert ohne vollständige Summenfalten kein Ergebnis', () => {
    const { knie, ...ohneKnie } = messung;
    expect(kfaSumme(ohneKnie)).toBeNull();
  });
});

describe('YPSI-Körperfettformel', () => {
  it('bildet die erwartete Faltensumme aus Größe und Gewicht', () => {
    expect(erwarteteFaltensumme(180, 85)).toBeCloseTo(43.37, 1);
    expect(erwarteteFaltensumme(165, 60)).toBeCloseTo(42.9, 1);
  });

  it('berechnet den Körperfettanteil wie die Vorlage', () => {
    expect(koerperfettAnteil({ groesseCm: 180, gewichtKg: 85, summe: 98 })).toBeCloseTo(15.43, 1);
    expect(koerperfettAnteil({ groesseCm: 180, gewichtKg: 85, summe: 60 })).toBeCloseTo(8.51, 1);
    expect(koerperfettAnteil({ groesseCm: 190, gewichtKg: 100, summe: 140 })).toBeCloseTo(19.96, 1);
  });

  it('ist wegen ABS symmetrisch um die erwartete Summe', () => {
    const erwartet = erwarteteFaltensumme(180, 85);
    const darueber = koerperfettAnteil({ groesseCm: 180, gewichtKg: 85, summe: erwartet + 20 });
    const darunter = koerperfettAnteil({ groesseCm: 180, gewichtKg: 85, summe: erwartet - 20 });
    expect(darueber).toBeCloseTo(darunter, 5);
  });

  it('berechnet die Magermasse aus Gewicht und Körperfett', () => {
    expect(magermasse(85, 15.43)).toBeCloseTo(71.9, 1);
  });

  it('schätzt nichts, wenn Größe oder Gewicht fehlen', () => {
    expect(koerperfettAnteil({ groesseCm: null, gewichtKg: 85, summe: 98 })).toBeNull();
    expect(koerperfettAnteil({ groesseCm: 180, gewichtKg: null, summe: 98 })).toBeNull();
  });
});

describe('YPSI-Rangformel', () => {
  it('rankt nach absoluter Abweichung vom Mittelwert, nicht nach Überschreitung', () => {
    const raenge = faltenRang(messung, 'male');
    expect(raenge).toHaveLength(13);
    expect(raenge[0].rang).toBe(1);
    // Quadrizeps 12/4 = 3.0 gegen Referenz 1.325 -> Abweichung 1.675, groesster Wert.
    // Bauch liegt mit 14/4 = 3.5 gegen 2.01 bei 1.49 und damit dahinter.
    expect(raenge[0].slug).toBe('quadrizeps');
    expect(raenge[0].score).toBeCloseTo(1.675, 3);
    expect(raenge[0].richtung).toBe('ueber');
    expect(raenge.find((item) => item.slug === 'bauch').score).toBeCloseTo(1.49, 2);
  });

  it('bewertet eine Falte unter der Referenz genauso hoch wie darüber', () => {
    const referenz = 2.01; // Bauch, Mann
    const darueber = faltenRang({ ...messung, bauch: (referenz + 1) * 4 }, 'male');
    const darunter = faltenRang({ ...messung, bauch: (referenz - 1) * 4 }, 'male');
    const a = darueber.find((item) => item.slug === 'bauch');
    const b = darunter.find((item) => item.slug === 'bauch');
    expect(a.score).toBeCloseTo(b.score, 6);
    expect(a.richtung).toBe('ueber');
    expect(b.richtung).toBe('unter');
  });

  it('verwendet die geschlechtsspezifische Referenztabelle', () => {
    const mann = faltenRang(messung, 'male').find((item) => item.slug === 'huefte');
    const frau = faltenRang(messung, 'female').find((item) => item.slug === 'huefte');
    expect(mann.referenz).toBe(2.15);
    expect(frau.referenz).toBe(0.775);
  });

  it('übergeht Falten ohne Messwert', () => {
    const { bizeps, ...ohneBizeps } = messung;
    expect(faltenRang(ohneBizeps, 'male').some((item) => item.slug === 'bizeps')).toBe(false);
  });
});

describe('YPSI-Gesamtauswertung', () => {
  it('liefert Summe, Erwartung, Abweichung, Körperfett und Ränge', () => {
    const result = auswertung({ falten: messung, groesseCm: 180, gewichtKg: 85, calculationBasis: 'male' });
    expect(result.summe).toBe(72);
    expect(result.erwarteteSumme).toBeCloseTo(43.4, 1);
    expect(result.abweichung).toBeCloseTo(28.6, 1);
    expect(result.koerperfett).toBeGreaterThan(0);
    expect(result.magermasse).toBeLessThan(85);
    expect(result.raenge[0].rang).toBe(1);
  });

  it('gibt ohne Gewicht keine Körperfettschätzung aus, rankt aber weiter', () => {
    const result = auswertung({ falten: messung, groesseCm: 180, gewichtKg: null });
    expect(result.koerperfett).toBeNull();
    expect(result.magermasse).toBeNull();
    expect(result.raenge).toHaveLength(13);
  });
});
