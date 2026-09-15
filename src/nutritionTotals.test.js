/* Rechenkette des TRACKERs: Quelle -> Portion -> Eintrag -> Tagessumme.
   Die Formeln werden hier so nachgebaut, wie sie in nutrition.js stehen, und
   gegen bekannte Werte geprueft. Zweck ist, Rundungs-, Skalierungs- und
   Summierungsfehler sichtbar zu machen. */
import { describe, expect, it } from 'vitest';

// --- Nachbau der Helfer aus nutrition.js ------------------------------------
const number = (value) => {
  const parsed = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const rounded = (value) => Math.max(0, Math.round(Number(value) || 0));
const total = (entries, field) => entries.reduce((sum, item) => sum + number(item[field]), 0);

// Skalierung eines Produkts auf eine Menge (nutrition.js: values())
const skaliere = (produkt, gramm) => {
  const factor = number(gramm) / 100;
  return {
    energy_kcal: number(produkt.kcal_100g) * factor,
    protein_g: number(produkt.protein_100g) * factor,
    carbs_g: number(produkt.carbs_100g) * factor,
    fat_g: number(produkt.fat_100g) * factor,
  };
};

// Portion x Anzahl (nutrition.js: ausEinheit())
const ausEinheit = (einheitGramm, anzahl, maxGramm = 100000) =>
  Math.max(1, Math.min(maxGramm, Math.round(einheitGramm * number(anzahl))));

// Rezept -> Produkt mit 100-g-Werten (nutrition.js: recipeTotals/recipeAsProduct)
const rezeptAlsProdukt = (zutaten) => {
  const t = zutaten.reduce((acc, item) => {
    const factor = number(item.grams) / 100;
    acc.grams += number(item.grams);
    acc.kcal += number(item.kcal_100g) * factor;
    acc.protein += number(item.protein_100g) * factor;
    acc.carbs += number(item.carbs_100g) * factor;
    acc.fat += number(item.fat_100g) * factor;
    return acc;
  }, { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const per100 = (v) => (t.grams ? v / t.grams * 100 : 0);
  return {
    grams: t.grams,
    kcal_100g: per100(t.kcal), protein_100g: per100(t.protein),
    carbs_100g: per100(t.carbs), fat_100g: per100(t.fat),
  };
};

// Postgres numeric(9,2) / numeric(8,2): auf zwei Nachkommastellen gespeichert
const alsGespeichert = (werte) => Object.fromEntries(
  Object.entries(werte).map(([k, v]) => [k, Math.round(v * 100) / 100]),
);

// Haferflocken aus dem BLS (C133000), unveraendert aus der Quelle
const HAFERFLOCKEN = { kcal_100g: 348, protein_100g: 13.22, carbs_100g: 53.3, fat_100g: 6.65 };

describe('TRACKER · Skalierung', () => {
  it('rechnet Nährwerte linear auf die Menge um', () => {
    expect(skaliere(HAFERFLOCKEN, 100)).toEqual({
      energy_kcal: 348, protein_g: 13.22, carbs_g: 53.3, fat_g: 6.65,
    });
    const halb = skaliere(HAFERFLOCKEN, 50);
    expect(halb.energy_kcal).toBeCloseTo(174, 10);
    expect(halb.protein_g).toBeCloseTo(6.61, 10);
  });

  it('skaliert auch krumme Mengen ohne Zwischenrundung', () => {
    const v = skaliere(HAFERFLOCKEN, 37);
    expect(v.energy_kcal).toBeCloseTo(348 * 0.37, 10);
    expect(v.protein_g).toBeCloseTo(13.22 * 0.37, 10);
  });

  it('liefert bei Menge 0 keine Nährwerte', () => {
    expect(skaliere(HAFERFLOCKEN, 0).energy_kcal).toBe(0);
  });
});

describe('TRACKER · Portion mal Anzahl', () => {
  it('rechnet ganze Portionen exakt', () => {
    expect(ausEinheit(55, 2)).toBe(110); // 2 Eier Groesse M
    expect(ausEinheit(45, 3)).toBe(135); // 3 Scheiben Brot
  });

  it('rundet krumme Portionsmengen auf ganze Gramm', () => {
    expect(ausEinheit(12.5, 3)).toBe(38); // 37.5 -> 38
  });

  it('erzwingt mindestens ein Gramm', () => {
    expect(ausEinheit(55, 0)).toBe(1);
  });

  it('deckelt bei der Maximalmenge', () => {
    expect(ausEinheit(1000, 500, 10000)).toBe(10000);
  });
});

describe('TRACKER · Tagessumme', () => {
  it('summiert erst und rundet dann', () => {
    const eintraege = [
      { energy_kcal: 33.4 }, { energy_kcal: 33.4 }, { energy_kcal: 33.4 },
    ];
    // Einzeln gerundet waeren es 33+33+33 = 99, korrekt ist 100.
    expect(rounded(total(eintraege, 'energy_kcal'))).toBe(100);
  });

  it('summiert alle vier Makros unabhängig voneinander', () => {
    const eintraege = [skaliere(HAFERFLOCKEN, 80), skaliere(HAFERFLOCKEN, 40)];
    expect(total(eintraege, 'energy_kcal')).toBeCloseTo(348 * 1.2, 8);
    expect(total(eintraege, 'protein_g')).toBeCloseTo(13.22 * 1.2, 8);
    expect(total(eintraege, 'carbs_g')).toBeCloseTo(53.3 * 1.2, 8);
    expect(total(eintraege, 'fat_g')).toBeCloseTo(6.65 * 1.2, 8);
  });

  it('behandelt fehlende Felder als 0 statt NaN', () => {
    expect(total([{ energy_kcal: 100 }, {}, { energy_kcal: null }], 'energy_kcal')).toBe(100);
  });

  it('bleibt nach der Speicherrundung auf zwei Nachkommastellen stabil', () => {
    const eintraege = [37, 63, 125].map((g) => alsGespeichert(skaliere(HAFERFLOCKEN, g)));
    const exakt = [37, 63, 125].reduce((s, g) => s + 348 * g / 100, 0);
    // Abweichung durch numeric(9,2) darf unter einer halben kcal bleiben.
    expect(Math.abs(total(eintraege, 'energy_kcal') - exakt)).toBeLessThan(0.5);
    expect(rounded(total(eintraege, 'energy_kcal'))).toBe(Math.round(exakt));
  });
});

describe('TRACKER · Rezepte', () => {
  it('normalisiert Zutaten korrekt auf 100 g', () => {
    const rezept = rezeptAlsProdukt([
      { grams: 100, kcal_100g: 348, protein_100g: 13.22, carbs_100g: 53.3, fat_100g: 6.65 },
      { grams: 100, kcal_100g: 0, protein_100g: 0, carbs_100g: 0, fat_100g: 0 },
    ]);
    expect(rezept.grams).toBe(200);
    // Haelfte der Masse ist naehrwertfrei -> pro 100 g die Haelfte
    expect(rezept.kcal_100g).toBeCloseTo(174, 8);
    expect(rezept.protein_100g).toBeCloseTo(6.61, 8);
  });

  it('erhält die Gesamtnährwerte über den Umweg der 100-g-Normalisierung', () => {
    const zutaten = [
      { grams: 250, kcal_100g: 348, protein_100g: 13.22, carbs_100g: 53.3, fat_100g: 6.65 },
      { grams: 150, kcal_100g: 52, protein_100g: 0.3, carbs_100g: 11.4, fat_100g: 0.2 },
      { grams: 30, kcal_100g: 884, protein_100g: 0, carbs_100g: 0, fat_100g: 100 },
    ];
    const rezept = rezeptAlsProdukt(zutaten);
    const direkt = zutaten.reduce((s, z) => s + z.kcal_100g * z.grams / 100, 0);
    // Ganzes Rezept als Portion zurueckskaliert muss dasselbe ergeben.
    expect(skaliere(rezept, rezept.grams).energy_kcal).toBeCloseTo(direkt, 8);
  });

  it('liefert für ein Rezept ohne Gramm keine Division durch null', () => {
    const leer = rezeptAlsProdukt([]);
    expect(leer.kcal_100g).toBe(0);
    expect(Number.isFinite(leer.kcal_100g)).toBe(true);
  });
});

describe('TRACKER · Eingabe-Robustheit', () => {
  it('akzeptiert deutsche Dezimalkommas', () => {
    expect(number('12,5')).toBe(12.5);
    expect(skaliere(HAFERFLOCKEN, '37,5').energy_kcal).toBeCloseTo(348 * 0.375, 10);
  });

  it('macht aus unlesbaren Eingaben 0 statt NaN', () => {
    expect(number('abc')).toBe(0);
    expect(number(undefined)).toBe(0);
    expect(skaliere(HAFERFLOCKEN, 'abc').energy_kcal).toBe(0);
  });
});
