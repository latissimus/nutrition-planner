import { describe, expect, it } from 'vitest';
import {
  BEIBEHALTEN, aktionWaehlen, fensterWerte, nichtRepraesentativ, prioritaetNormalisieren, volumenEntscheidung, volumenStand, zulaessigeAktionen,
} from '../supabase/functions/capboy-coach/volumen.js';
import {
  prioritaetNormalisieren as prioritaetImAbgleich, prioritaetVerlaufFortschreiben,
} from '../supabase/functions/logman-abgleich/umrechnung.js';

// Erfundene LOGMAN-Stände mit vollständigen Zyklen (alle vier Einheiten).
// Bankdrücken (Hauptmuskel Brust) und Kniebeugen (Quads) je zwei Sätze.
const satz = (w, r) => ({ w: String(w), r: String(r), rir: '1' });
const EX = {
  'OK-H': { chest_comp: ['LH Flachbankdrücken'] }, 'OK-P': { chest_comp: ['LH Flachbankdrücken'] },
  'UK-H': { legs_comp: ['LH Kniebeugen'] }, 'UK-P': { legs_comp: ['LH Kniebeugen'] },
};
const BLOCK = { 'OK-H': 'chest_comp', 'OK-P': 'chest_comp', 'UK-H': 'legs_comp', 'UK-P': 'legs_comp' };
const REIHENFOLGE = ['OK-H', 'UK-H', 'OK-P', 'UK-P'];
// Jede Einheit zwei Tage nach der vorigen, Zyklus 1 beginnt am 03.08.2026.
const tagDatum = (cycle, tag) => new Date(Date.UTC(2026, 7, 3) + ((cycle - 1) * 4 + REIHENFOLGE.indexOf(tag)) * 2 * 86_400_000).toISOString().slice(0, 10);
// geloggtePrio: Prioritätssätze, die in den Einheiten erledigt wurden (sonst wie prioritaet).
// rudern: zusätzlich geplante Übung „KH Rudern“ in OK-H, erledigt nur in diesen Zyklen.
function logman({ zyklen = [1, 2, 3], wdh = () => 8, saetze = () => 2, prioritaet, geloggtePrio = prioritaet, tier = {}, ohne = [], rudern = null } = {}) {
  const data = {};
  const datum = {};
  zyklen.forEach((cycle) => Object.entries(BLOCK).forEach(([tag, block]) => {
    if (ohne.includes(`${tag}|${cycle}`)) return;
    (data[tag] ||= {})[cycle] = { [block]: { sets: [Array.from({ length: saetze(tag, cycle) }, () => satz(80, wdh(tag, cycle)))] } };
    datum[`${tag}|${cycle}`] = tagDatum(cycle, tag);
    // Eine Priorität „plus“ plant in jeder passenden Einheit Extra-Sätze ein;
    // hier werden sie auch erledigt (Kabel Fliegende, Hauptmuskel Brust).
    const brust = geloggtePrio?.Brust;
    if (brust?.modus === 'plus' && tag.startsWith('OK')) {
      data[tag][cycle]['prio:Brust'] = { names: ['Kabel Fliegende'], sets: [Array.from({ length: brust.saetze }, () => satz(20, 12))] };
    }
    if (rudern && tag === 'OK-H' && rudern.includes(cycle)) data[tag][cycle].back_thick = { sets: [[satz(30, 10), satz(30, 10)]] };
  }));
  const ex = rudern ? { ...EX, 'OK-H': { ...EX['OK-H'], back_thick: ['KH Rudern'] } } : EX;
  return { week: zyklen.at(-1), day: 'UK-P', data, datum, ex, tier, v: 4, ...(prioritaet ? { volumen: { prioritaet } } : {}) };
}
// Prioritäten-Verlauf: seit 01.07. unverändert die Priorität des Stands,
// zuletzt heute gesehen.
const seitJuli = (payload) => [{ ab: '2026-07-01', zuletzt: '2026-10-05', prioritaet: prioritaetNormalisieren(payload) }];

// Zeitreihe: drei abgeschlossene Wochen bis Sonntag, 05.10. ist Montag.
const woche = (week, from, to, { krank = 0, reise = 0, gewicht = 90, falten = null } = {}) => ({
  week, from, to, partial: false,
  bodyComposition: { averageWeightKg: gewicht, latestSkinfoldSumMm: falten },
  recovery: { illnessDays: krank, travelDays: reise },
});
const zeitreihe = (aenderung = {}) => ({
  window: { to: '2026-10-05' },
  weeks: [
    woche('2026-W38', '2026-09-14', '2026-09-20', aenderung.w38),
    woche('2026-W39', '2026-09-21', '2026-09-27', aenderung.w39),
    woche('2026-W40', '2026-09-28', '2026-10-04', aenderung.w40),
    { week: '2026-W41', from: '2026-10-05', to: '2026-10-05', partial: true },
  ],
});
const GUT = {
  erholung: { werte: 7, mittel: 3.6 },
  schlaf: { naechte: 10, minuten: 450, qualitaet: 3.5 },
  ernaehrung: { tage: 10, kcal: 2800, protein: 170 },
  kalorienZiel: 2800, gewichtKg: 90,
};
const entscheiden = ({ payload = logman(), timeseries = zeitreihe(), fenster = GUT, staende, kaertchen = null, aus = [], verlauf } = {}) => {
  const stand = volumenStand(payload, payload.week);
  return volumenEntscheidung({
    payload, heute: '2026-10-05', timeseries, fenster, aus, kaertchen,
    fruehereStaende: staende || [stand, stand],
    prioritaetVerlauf: verlauf || seitJuli(payload),
  });
};
const ids = (ergebnis) => ergebnis.aktionen.map((aktion) => aktion.id);
const muskel = (ergebnis, name) => ergebnis.muskeln.find((eintrag) => eintrag.muskel === name);

describe('Volumen: Erhöhen nur, wenn alles passt', () => {
  it('schlägt bei Stillstand mit guter Erholung, Ernährung und stabilem Gewicht „plus 1“ vor', () => {
    const ergebnis = entscheiden();
    expect(ergebnis.sperren).toEqual([]);
    expect(muskel(ergebnis, 'Brust')).toMatchObject({ bewertung: 'erhoehen', leistung: 'stagniert', erfuellung: [1, 1] });
    expect(ids(ergebnis)).toEqual(['beibehalten', 'plus1:Brust', 'plus1:Quads']);
    expect(ergebnis.aktionen[1].text).toContain('+2 Sätze je Zyklus');
  });

  it('erhöht nicht bei fehlenden Erholungsdaten: unbekannt ist nicht gut', () => {
    const ergebnis = entscheiden({ fenster: { ...GUT, erholung: { werte: 2, mittel: 4 } } });
    expect(ergebnis.grundlage.erholung).toBe('unbekannt');
    expect(muskel(ergebnis, 'Brust').bewertung).toBe('beibehalten');
    expect(muskel(ergebnis, 'Brust').gruende.join(' ')).toContain('Erholung unbekannt');
    expect(ids(ergebnis)).toEqual(['beibehalten']);
  });

  it('erhöht nicht, wenn Schlaf fehlt – außer der Schlaf-Bereich ist ausgeschaltet', () => {
    const ohneSchlaf = { ...GUT, schlaf: { naechte: 0, minuten: null, qualitaet: null } };
    expect(entscheiden({ fenster: ohneSchlaf }).grundlage.erholung).toBe('unbekannt');
    expect(entscheiden({ fenster: ohneSchlaf, aus: ['sleep'] }).grundlage.erholung).toBe('gut');
  });

  it('erhöht nicht bei zu wenig Kalorien, fallendem Gewicht oder steigenden Hautfalten', () => {
    expect(muskel(entscheiden({ fenster: { ...GUT, ernaehrung: { tage: 10, kcal: 2400, protein: 170 } } }), 'Brust').gruende.join(' ')).toContain('Ernährung passt-nicht');
    const fallend = zeitreihe({ w38: { gewicht: 91 }, w39: { gewicht: 90.5 }, w40: { gewicht: 90 } });
    expect(muskel(entscheiden({ timeseries: fallend }), 'Brust').gruende.join(' ')).toContain('Gewicht fallend');
    const falten = { ...zeitreihe(), weeks: [woche('2026-W36', '2026-08-31', '2026-09-06', { falten: 70 }), woche('2026-W37', '2026-09-07', '2026-09-13'), ...zeitreihe({ w40: { falten: 75 } }).weeks] };
    expect(muskel(entscheiden({ timeseries: falten }), 'Brust').gruende.join(' ')).toContain('Hautfalten steigen');
  });

  it('erhöht nicht, solange die Leistung noch steigt', () => {
    const steigt = logman({ wdh: (_tag, cycle) => 6 + cycle });
    expect(muskel(entscheiden({ payload: steigt }), 'Brust')).toMatchObject({ bewertung: 'beibehalten', leistung: 'steigt' });
  });
});

describe('Volumen: Sperren gehen vor', () => {
  it('Krankheit plus Leistungsabfall: nichts ändern', () => {
    const faellt = logman({ wdh: (_tag, cycle) => 10 - cycle });
    // Ohne Krankheit wäre das eine Reduktion …
    expect(muskel(entscheiden({ payload: faellt }), 'Brust').bewertung).toBe('reduzieren');
    // … mit Krankheitstagen in der bewerteten Woche bleibt alles, wie es ist.
    const krank = entscheiden({ payload: faellt, timeseries: zeitreihe({ w40: { krank: 2 } }) });
    expect(krank.sperren.map((sperre) => sperre.id)).toEqual(['nicht-repraesentativ']);
    expect(krank.aktionen).toEqual([BEIBEHALTEN]);
    expect(krank.muskeln).toEqual([]);
  });

  it('sperrt bei Reise in der Vorwoche und bei jedem Umstand im Kärtchen – auch Feier oder Urlaub', () => {
    expect(entscheiden({ timeseries: zeitreihe({ w39: { reise: 1 } }) }).sperren[0].id).toBe('nicht-repraesentativ');
    for (const umstand of ['krank', 'unterwegs', 'stress', 'wenig_schlaf', 'ausnahme']) {
      expect(entscheiden({ kaertchen: { circumstances: [umstand] } }).sperren.map((sperre) => sperre.id)).toEqual(['nicht-repraesentativ']);
    }
    expect(entscheiden({ kaertchen: { circumstances: ['ausnahme'] } }).sperren[0].text).toBe('Die Woche ist nicht repräsentativ (Feier oder Urlaub).');
    expect(entscheiden({ kaertchen: { circumstances: [] } }).sperren).toEqual([]);
  });

  it('eine Regel für „nicht repräsentativ“: dieselbe nutzt der Server für die Experimentsperre', () => {
    expect(nichtRepraesentativ({ wochen: [], kaertchen: { circumstances: ['ausnahme'] } })).toEqual(['Feier oder Urlaub']);
    expect(nichtRepraesentativ({ wochen: [{ recovery: { illnessDays: 1 } }], kaertchen: null })).toEqual(['Krank- oder Reisetage']);
    expect(nichtRepraesentativ({ wochen: [{ recovery: {} }, null], kaertchen: { circumstances: ['unbekannt'] } })).toEqual([]);
  });

  it('unvollständiger Zyklus: zu wenig vergleichbare Daten', () => {
    const payload = logman({ zyklen: [1, 2, 3], ohne: ['UK-P|1'] });
    const ergebnis = entscheiden({ payload });
    expect(ergebnis.sperren.map((sperre) => sperre.id)).toEqual(['zu-wenig-zyklen']);
    expect(ergebnis.sperren[0].text).toContain('Nur 2 von 3');
    expect(ergebnis.ausgeschlossen).toEqual([{ cycle: 1, grund: 'nicht alle vier Einheiten' }]);
  });

  it('Deload läuft oder steht im nächsten Zyklus an', () => {
    expect(entscheiden({ payload: logman({ zyklen: [5, 6, 7] }) }).sperren.map((sperre) => sperre.id)).toContain('deload');
  });

  it('erkennt einen gespeicherten Stand auch in anderer Schlüsselreihenfolge (jsonb) als gleich', () => {
    const payload = logman({ prioritaet: { Brust: { modus: 'plus', saetze: 1 } } });
    const stand = volumenStand(payload, 3);
    const ausDerDatenbank = JSON.parse(JSON.stringify({ stufen: stand.stufen, cycle: 3, prioritaet: { Brust: { saetze: 1, modus: 'plus' } } }));
    expect(entscheiden({ payload, staende: [ausDerDatenbank, ausDerDatenbank] }).sperren).toEqual([]);
  });

  it('eine Prioritätsänderung in den letzten 14 Tagen sperrt, auch zwischen zwei Wochen-Läufen', () => {
    const payload = logman();
    const verlauf = [
      { ab: '2026-07-01', zuletzt: '2026-09-27', prioritaet: {} },
      { ab: '2026-09-28', zuletzt: '2026-09-30', prioritaet: { Brust: { modus: 'plus', saetze: 1 } } },
      { ab: '2026-10-01', zuletzt: '2026-10-05', prioritaet: {} },
    ];
    expect(entscheiden({ payload, verlauf }).sperren.map((sperre) => sperre.id)).toEqual(['kuerzlich-geaendert']);
  });

  it('Volumenänderung vor einer Woche oder noch kein Verlauf: erst beobachten', () => {
    const payload = logman();
    const vorher = volumenStand(logman({ prioritaet: { Brust: { modus: 'plus', saetze: 1 } } }), 3);
    const jetzt = volumenStand(payload, 3);
    expect(entscheiden({ payload, staende: [vorher, vorher] }).sperren.map((sperre) => sperre.id)).toEqual(['kuerzlich-geaendert']);
    expect(entscheiden({ payload, staende: [jetzt, vorher] }).sperren.map((sperre) => sperre.id)).toEqual(['kuerzlich-geaendert']);
    expect(entscheiden({ payload, staende: [jetzt] }).sperren.map((sperre) => sperre.id)).toEqual(['beobachten-start']);
  });
});

describe('Volumen: damalige Vorgaben und vergleichbare Zyklen (GPT-Review Schritt 5)', () => {
  it('rechnet alte Zyklen mit der Priorität, die damals galt, nicht mit der heutigen', () => {
    // Bis 01.09. galt „plus 1“ für Brust (und wurde erledigt), heute gibt es keine Priorität mehr.
    const payload = logman({ geloggtePrio: { Brust: { modus: 'plus', saetze: 1 } } });
    const verlauf = [{ ab: '2026-07-01', zuletzt: '2026-08-31', prioritaet: { Brust: { modus: 'plus', saetze: 1 } } }, { ab: '2026-09-01', zuletzt: '2026-10-05', prioritaet: {} }];
    expect(muskel(entscheiden({ payload, verlauf }), 'Brust').erfuellung).toEqual([1, 1]);
    // Mit der heutigen Vorgabe nachgerechnet sähe es nach 150 % aus.
    expect(muskel(entscheiden({ payload, verlauf: seitJuli(payload) }), 'Brust').erfuellung).toEqual([1.5, 1.5]);
  });

  it('bewertet keinen Zyklus, in dem sich die Priorität geändert hat', () => {
    const payload = logman();
    const verlauf = [
      { ab: '2026-07-01', zuletzt: tagDatum(2, 'OK-H'), prioritaet: {} },
      { ab: tagDatum(2, 'UK-H'), zuletzt: tagDatum(2, 'UK-H'), prioritaet: { Brust: { modus: 'plus', saetze: 1 } } },
      { ab: tagDatum(3, 'OK-H'), zuletzt: '2026-10-05', prioritaet: {} },
    ];
    const ergebnis = entscheiden({ payload, verlauf });
    expect(ergebnis.ausgeschlossen).toEqual([{ cycle: 2, grund: 'damalige Vorgabe nicht sicher bekannt' }, { cycle: 3, grund: 'damalige Vorgabe nicht sicher bekannt' }]);
    expect(ergebnis.sperren.map((sperre) => sperre.id)).toEqual(['zu-wenig-zyklen']);
  });

  it('schließt jeden Zyklus in der Lücke zwischen zwei Abgleichen aus, auch wenn CAPBOY erst danach geöffnet wurde', () => {
    // „plus 1“ zuletzt am 03.08. gesehen, „keine Priorität“ erst am 02.09. – die Änderung kann irgendwann
    // dazwischen in LOGMAN geschehen sein. Alle drei Zyklen (03.08.–24.08.) liegen in der Lücke.
    const payload = logman({ geloggtePrio: { Brust: { modus: 'plus', saetze: 1 } } });
    const verlauf = [
      { ab: '2026-07-01', zuletzt: '2026-08-03', prioritaet: { Brust: { modus: 'plus', saetze: 1 } } },
      { ab: '2026-09-02', zuletzt: '2026-10-05', prioritaet: {} },
    ];
    const ergebnis = entscheiden({ payload, verlauf });
    expect(ergebnis.ausgeschlossen.map((eintrag) => eintrag.grund)).toEqual(Array(3).fill('damalige Vorgabe nicht sicher bekannt'));
    expect(ergebnis.aktionen).toEqual([BEIBEHALTEN]);
    // Wurde „plus 1“ noch nach dem Zyklus gesehen, ist er sicher.
    const sicher = [{ ...verlauf[0], zuletzt: '2026-08-31' }, verlauf[1]];
    expect(entscheiden({ payload, verlauf: sicher }).zyklen).toEqual([1, 2, 3]);
  });

  it('bewertet keine Zyklen von vor dem Beginn der Aufzeichnung', () => {
    const ergebnis = entscheiden({ verlauf: [{ ab: '2026-09-15', zuletzt: '2026-10-05', prioritaet: {} }] });
    expect(ergebnis.sperren[0].text).toContain('damalige Vorgabe nicht sicher bekannt');
    expect(ergebnis.aktionen).toEqual([BEIBEHALTEN]);
  });

  it('zählt einen Zyklus mit einer geplanten, aber nicht protokollierten Übung nicht als vergleichbar', () => {
    expect(entscheiden({ payload: logman({ rudern: [1, 2, 3] }) }).sperren).toEqual([]);
    const luecke = entscheiden({ payload: logman({ rudern: [1, 3] }) });
    expect(luecke.ausgeschlossen).toEqual([{ cycle: 2, grund: 'nicht vollständig protokolliert' }]);
    expect(luecke.sperren.map((sperre) => sperre.id)).toEqual(['zu-wenig-zyklen']);
  });

  it('geringe Satz-Erfüllung allein reduziert nicht – sie verhindert nur eine Erhöhung', () => {
    // Überall nur ein statt zwei Sätzen eingetragen: Jede Übung hat einen Satz, die Zyklen sind vergleichbar.
    const halb = entscheiden({ payload: logman({ saetze: () => 1 }) });
    expect(halb.sperren).toEqual([]);
    expect(muskel(halb, 'Brust')).toMatchObject({ bewertung: 'beibehalten', erfuellung: [0.5, 0.5] });
    expect(muskel(halb, 'Brust').gruende.join(' ')).toContain('erst vollständig protokollieren');
    expect(ids(halb)).toEqual(['beibehalten']);
    // Fällt die Leistung wiederholt, bleibt das ein eigener Grund zu reduzieren.
    const faellt = entscheiden({ payload: logman({ saetze: () => 1, wdh: (_tag, cycle) => 10 - cycle, prioritaet: { Brust: { modus: 'plus', saetze: 1 } } }) });
    expect(muskel(faellt, 'Brust').bewertung).toBe('reduzieren');
  });

  it('ein laufender, lückenhafter Zyklus fließt weder in Leistung noch in Satz-Erfüllung ein', () => {
    // Zyklus 4 hat erst OK-H, mit deutlich weniger Wiederholungen.
    const payload = logman({ zyklen: [1, 2, 3, 4], ohne: ['UK-H|4', 'OK-P|4', 'UK-P|4'], wdh: (_tag, cycle) => (cycle === 4 ? 5 : 8) });
    const ergebnis = entscheiden({ payload });
    expect(ergebnis.zyklen).toEqual([1, 2, 3]);
    expect(muskel(ergebnis, 'Brust')).toMatchObject({ bewertung: 'erhoehen', leistung: 'stagniert', erfuellung: [1, 1] });
  });

  it('logman-abgleich und volumen.js normalisieren Prioritäten gleich; der Verlauf wächst nur bei Änderung', () => {
    const payload = { volumen: { prioritaet: { Lat: { modus: 'tausch', saetze: 1, spender: 'Bizeps' }, Brust: { modus: 'plus', saetze: 2 }, Waden: { modus: 'aus' } } } };
    expect(prioritaetImAbgleich(payload)).toEqual(prioritaetNormalisieren(payload));
    const verlauf = prioritaetVerlaufFortschreiben([], payload, '2026-10-01');
    expect(verlauf).toEqual([{ ab: '2026-10-01', zuletzt: '2026-10-01', prioritaet: { Brust: { modus: 'plus', saetze: 2 }, Lat: { modus: 'tausch', saetze: 1, spender: 'Bizeps' } } }]);
    // Aus der Datenbank (jsonb) mit anderer Schlüsselreihenfolge: keine neue Zeile, nur „zuletzt gesehen“ rückt vor.
    const gelesen = [{ zuletzt: '2026-10-01', prioritaet: { Lat: { spender: 'Bizeps', saetze: 1, modus: 'tausch' }, Brust: { saetze: 2, modus: 'plus' } }, ab: '2026-10-01' }];
    expect(prioritaetVerlaufFortschreiben(gelesen, payload, '2026-10-02')).toEqual([{ ...gelesen[0], zuletzt: '2026-10-02' }]);
    expect(prioritaetVerlaufFortschreiben(gelesen, { volumen: { prioritaet: {} } }, '2026-10-02')).toEqual([...gelesen, { ab: '2026-10-02', zuletzt: '2026-10-02', prioritaet: {} }]);
  });
});

describe('Volumen: nur passende LOGMAN-Hebel', () => {
  it('mit aktiver Priorität „plus 1“ ist „plus 2“ der nächste Schritt, mit „plus 2“ keiner mehr', () => {
    const plus1 = logman({ prioritaet: { Brust: { modus: 'plus', saetze: 1 } } });
    expect(ids(entscheiden({ payload: plus1 }))).toEqual(['beibehalten', 'plus2:Brust', 'plus1:Quads']);
    const plus2 = logman({ prioritaet: { Brust: { modus: 'plus', saetze: 2 } } });
    expect(ids(entscheiden({ payload: plus2 }))).toEqual(['beibehalten', 'plus1:Quads']);
  });

  it('reduziert eine aktive Priorität stufenweise, ohne Priorität gibt es keine Muskel-Aktion', () => {
    const faellt = (prioritaet) => logman({ wdh: (tag, cycle) => (tag.startsWith('OK') ? 10 - cycle : 8), prioritaet });
    expect(ids(entscheiden({ payload: faellt({ Brust: { modus: 'plus', saetze: 2 } }) }))).toContain('plus1:Brust');
    expect(ids(entscheiden({ payload: faellt({ Brust: { modus: 'plus', saetze: 1 } }) }))).toContain('prioritaet-aus:Brust');
    expect(ids(entscheiden({ payload: faellt() })).filter((id) => id.includes('Brust'))).toEqual([]);
  });

  it('bietet „Kompakt“ für eine Hälfte nur an, wenn dort mindestens zwei Muskeln reduzieren sollen', () => {
    const stand = { prioritaet: {}, stufen: { 'OK-H': 1, 'UK-H': 1, 'OK-P': 1, 'UK-P': 1 } };
    const reduziert = (name, haelfte) => ({ muskel: name, haelfte, bewertung: 'reduzieren' });
    expect(zulaessigeAktionen([reduziert('Quads', 'UK')], stand).map((a) => a.id)).toEqual(['beibehalten']);
    const zwei = zulaessigeAktionen([reduziert('Quads', 'UK'), reduziert('Hams', 'UK')], stand);
    expect(zwei.map((a) => a.id)).toEqual(['beibehalten', 'kompakt:UK']);
    expect(zwei[1].text).toContain('betrifft alle Muskeln dieser Hälfte');
    const schonKompakt = { ...stand, stufen: { ...stand.stufen, 'UK-H': 0, 'UK-P': 0 } };
    expect(zulaessigeAktionen([reduziert('Quads', 'UK'), reduziert('Hams', 'UK')], schonKompakt).map((a) => a.id)).toEqual(['beibehalten']);
  });

  it('verwirft eine KI-Aktion außerhalb der Liste', () => {
    const aktionen = entscheiden().aktionen;
    expect(aktionWaehlen('plus1:Brust', aktionen).id).toBe('plus1:Brust');
    expect(aktionWaehlen('plus2:Brust', aktionen)).toBe(BEIBEHALTEN);
    expect(aktionWaehlen('kompakt:OK', aktionen)).toBe(BEIBEHALTEN);
    expect(aktionWaehlen(undefined, aktionen)).toBe(BEIBEHALTEN);
  });
});

describe('Volumen: 14-Tage-Fenster aus den Zeilen', () => {
  it('zählt nur die 14 Tage bis gestern und rechnet Mittelwerte', () => {
    const fenster = fensterWerte({
      checkins: [{ checkin_date: '2026-10-04', recovery: 4 }, { checkin_date: '2026-09-22', recovery: 2 }, { checkin_date: '2026-10-05', recovery: 1 }, { checkin_date: '2026-09-20', recovery: 1 }],
      sleep: [{ sleep_date: '2026-10-03', bedtime: '23:00', wake_time: '07:00', quality: 4 }],
      nutritionEntries: [{ log_date: '2026-10-01', energy_kcal: 1500, protein_g: 80 }, { log_date: '2026-10-01', energy_kcal: 1300, protein_g: 90 }],
      settings: { adaptive_target: 2800 },
      weights: [{ kg: 90.4 }],
    }, '2026-10-05');
    expect(fenster).toMatchObject({
      von: '2026-09-21', bis: '2026-10-04',
      erholung: { werte: 2, mittel: 3 },
      schlaf: { naechte: 1, minuten: 480, qualitaet: 4 },
      ernaehrung: { tage: 1, kcal: 2800, protein: 170 },
      kalorienZiel: 2800, gewichtKg: 90.4,
    });
  });
});
