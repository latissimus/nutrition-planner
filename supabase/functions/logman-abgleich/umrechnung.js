// Umrechnung eines LOGMAN-Trainingsstands in Leistungszeilen (logman_performance):
// je Übung und Tag der beste Satz als geschätztes 1RM (Epley) plus Volumen.
// Eine einzige Fassung für beide Wege: Die Edge Function logman-abgleich
// rechnet damit beim automatischen Abgleich, die App (src/logmanImport.js)
// beim Import einer Exportdatei. Zwei Kopien würden auseinanderlaufen, und ein
// falscher Wert sähe aus wie ein richtiger.
// Reines JavaScript ohne Abhängigkeiten, damit Vite und Deno es laden.

const number = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const estimatedOneRepMax = (weight, repetitions) => {
  const kg = number(weight); const reps = number(repetitions);
  return kg > 0 && reps > 0 ? kg * (1 + reps / 30) : 0;
};

// Einheiten („Tag|Cycle“, z. B. „OK-H|3“) mit mindestens einem eingetragenen
// Satz. LOGMAN legt beim bloßen Ansehen eines Tages leere Blöcke an; die
// zählen nicht.
export function einheitenMitSaetzen(input) {
  const payload = input?.training?.payload || input?.payload || input?.training || input;
  const schluessel = [];
  Object.entries(payload?.data || {}).forEach(([day, cycles]) => {
    Object.entries(cycles || {}).forEach(([cycle, blocks]) => {
      const hatSatz = Object.values(blocks || {}).some((entry) => (entry?.sets || []).some((sets) => (sets || [])
        .some((set) => number(set?.w) >= 0 && String(set?.w ?? '').trim() !== '' && number(set?.r) > 0)));
      if (hatSatz) schluessel.push(`${day}|${cycle}`);
    });
  });
  return schluessel;
}

/* Datum je Einheit „Tag|Cycle“, an dem CAPBOY sie erstmals mit Sätzen sah.
   LOGMAN speichert ein Datum nur, wenn man es einstellt oder „vollständig“
   tippt. Beim ersten Abgleich nach dem Koppeln ist der Tag unbekannt (null).
   Verschwindet eine Einheit (Phasen-Reset, alle Sätze gelöscht), fällt sie
   heraus: Sonst erbte der neue Cycle 1 das Datum des alten. */
export function einheitenDatieren(payload, bisher, erstmals, heute) {
  const gesehen = {};
  for (const schluessel of einheitenMitSaetzen(payload)) {
    gesehen[schluessel] = bisher && schluessel in bisher ? bisher[schluessel] : (erstmals ? null : heute);
  }
  return gesehen;
}

/* Vor dem Schreiben vorzumerkende Einheiten: der bisherige Stand plus die neu
   gesehenen Einheiten mit ihrem Datum, oder null, wenn keine neu ist.
   Scheitert ein späterer Schritt und kommt der nächste Versuch erst am
   Folgetag, behalten neue Einheiten so ihr erstes Datum (keine Zeilen unter
   zwei Daten). Verschwundene Einheiten bleiben bis zum Abschluss vorgemerkt,
   damit der nächste Versuch ihre veralteten Zeilen noch bereinigt. */
export function einheitenVormerken(bisher = {}, gesehen = {}) {
  const neu = Object.keys(gesehen).filter((schluessel) => !(schluessel in (bisher || {})));
  return neu.length ? { ...(bisher || {}), ...Object.fromEntries(neu.map((schluessel) => [schluessel, gesehen[schluessel]])) } : null;
}

/* Tage, deren Leistungszeilen der Abgleich neu bestimmt: jeder Tag mit einer
   datierten Einheit im alten oder neuen Stand. Nach einem Phasen-Reset in
   LOGMAN (meta.phasenReset neuer als zuvor) gibt es keine: Die alte Phase ist
   vorbei, nicht falsch, ihr Verlauf bleibt in CAPBOY erhalten. */
export function betroffeneTage({ altGesehen = {}, altDatum = {}, altReset = '', neuGesehen = {}, neuDatum = {}, neuReset = '' }) {
  if (String(neuReset || '') > String(altReset || '')) return [];
  const tage = new Set();
  const sammeln = (gesehen, datum) => Object.keys(gesehen || {}).forEach((schluessel) => {
    const tag = (datum || {})[schluessel] || (gesehen || {})[schluessel];
    if (/^\d{4}-\d{2}-\d{2}/.test(String(tag || ''))) tage.add(String(tag).slice(0, 10));
  });
  sammeln(altGesehen, altDatum);
  sammeln(neuGesehen, neuDatum);
  return [...tage].sort();
}

/* Vorhandene Leistungszeilen aus dem Abgleich, die es im neuen Stand nicht
   mehr gibt (Sätze oder Einheit in LOGMAN gelöscht). Nur betroffene Tage und
   nur Zeilen aus dem Abgleich; ein manueller Export-Import bleibt stehen. */
export function veralteteLeistung(vorhandene = [], neueZeilen = [], tage = []) {
  const tagSet = new Set(tage);
  const neu = new Set(neueZeilen.map((zeile) => `${zeile.performed_on}|${zeile.exercise}|${zeile.category}`));
  return vorhandene.filter((zeile) => zeile.source === 'LOGMAN-Abgleich'
    && tagSet.has(String(zeile.performed_on).slice(0, 10))
    && !neu.has(`${String(zeile.performed_on).slice(0, 10)}|${zeile.exercise}|${zeile.category}`));
}

/* Neue Abgleich-Zeilen ohne die Schlüssel (Tag, Übung, Kategorie), die schon
   eine Zeile aus anderer Quelle haben, etwa einen manuellen Export-Import.
   Der automatische Abgleich überschreibt sie nie; ein manueller Import
   überschreibt dagegen eine Abgleich-Zeile (bodyMetrics.js). */
export function ohneFremdeZeilen(neueZeilen = [], vorhandene = []) {
  const schluessel = (zeile) => `${String(zeile.performed_on).slice(0, 10)}|${zeile.exercise}|${zeile.category}`;
  const fremd = new Set(vorhandene.filter((zeile) => zeile.source !== 'LOGMAN-Abgleich').map(schluessel));
  return neueZeilen.filter((zeile) => !fremd.has(schluessel(zeile)));
}

/* JSON mit sortierten Schlüsseln: jsonb gibt Objekte in eigener
   Schlüsselreihenfolge zurück; ein gelesener Stand muss trotzdem gleich sein. */
export const stabilesJson = (wert) => JSON.stringify(wert, (_schluessel, inhalt) => (inhalt && typeof inhalt === 'object' && !Array.isArray(inhalt)
  ? Object.fromEntries(Object.keys(inhalt).sort().map((schluessel) => [schluessel, inhalt[schluessel]]))
  : inhalt));

/* LOGMAN-Prioritäten so, wie LOGMAN sie für die geplanten Sätze nutzt: nur
   gültige Einträge (reihenfolge, plus, tausch) mit Satzzahl und beim Tausch
   dem Spender. capboy-coach/volumen.js rechnet dieselbe Fassung (ein Test
   prüft, dass beide gleich sind). */
export function prioritaetNormalisieren(payload) {
  const roh = payload?.volumen?.prioritaet || {};
  const ergebnis = {};
  Object.keys(roh).sort().forEach((konto) => {
    const cfg = roh[konto];
    if (!cfg || !['reihenfolge', 'plus', 'tausch'].includes(cfg.modus)) return;
    const saetze = cfg.modus === 'reihenfolge' || Number(cfg.saetze) === 0 ? 0 : (Number(cfg.saetze) === 1 ? 1 : 2);
    ergebnis[konto] = { modus: cfg.modus, saetze, ...(cfg.modus === 'tausch' && cfg.spender ? { spender: String(cfg.spender) } : {}) };
  });
  return ergebnis;
}

export const PRIORITAET_VERLAUF_MAX = 40;
/* Verlauf der Prioritäten (logman_spiegel.prioritaet_verlauf). Jeder Eintrag
   { ab, zuletzt, prioritaet }: ab = Tag, an dem CAPBOY diese Fassung erstmals
   sah, zuletzt = Tag, an dem CAPBOY sie zuletzt sah. CAPBOY kennt nur den
   Abgleich, nicht den Moment der Änderung in LOGMAN (GPT-Review Schritt 5,
   dritte Runde): Eine Änderung liegt irgendwo zwischen „zuletzt“ des alten
   und „ab“ des neuen Eintrags. volumen.js bewertet keinen Zyklus, der in
   diese Lücke fällt. */
export function prioritaetVerlaufFortschreiben(verlauf, payload, heute) {
  const liste = (Array.isArray(verlauf) ? verlauf : [])
    .filter((eintrag) => /^\d{4}-\d{2}-\d{2}$/.test(String(eintrag?.ab || '')) && eintrag?.prioritaet && typeof eintrag.prioritaet === 'object');
  const jetzt = prioritaetNormalisieren(payload);
  const letzter = liste.at(-1);
  if (letzter && stabilesJson(letzter.prioritaet) === stabilesJson(jetzt)) {
    return [...liste.slice(0, -1), { ...letzter, zuletzt: heute > String(letzter.zuletzt || letzter.ab) ? heute : String(letzter.zuletzt || letzter.ab) }];
  }
  return [...liste, { ab: heute, zuletzt: heute, prioritaet: jetzt }].slice(-PRIORITAET_VERLAUF_MAX);
}

export function parseLogmanExport(input, fallbackDate = new Date().toISOString().slice(0, 10)) {
  const payload = input?.training?.payload || input?.payload || input?.training || input;
  const data = payload?.data || {};
  const fixedNames = payload?.ex || {};
  const dates = payload?.datum || {};
  const result = [];
  Object.entries(data).forEach(([day, cycles]) => {
    const isHeavy = day.endsWith('-H');
    const isMiddleDay = day.endsWith('-P');
    if (!isHeavy && !isMiddleDay) return;
    Object.entries(cycles || {}).forEach(([cycle, blocks]) => {
      Object.entries(blocks || {}).forEach(([blockId, entry]) => {
        // Freie Namen auf MIDDLES/PUMPS-Tagen sind PUMPS und nicht als
        // vergleichbarer Leistungsmarker vorgesehen.
        if (isMiddleDay && Array.isArray(entry?.names) && entry.names.some(Boolean)) return;
        const names = fixedNames?.[day]?.[blockId] || entry?.names || [];
        (entry?.sets || []).forEach((sets, exerciseIndex) => {
          const exercise = String(names[exerciseIndex] || '').trim();
          if (!exercise) return;
          const valid = (sets || []).map((set) => ({
            weight: number(set?.w), repetitions: number(set?.r),
          })).filter((set) => set.weight > 0 && set.repetitions > 0);
          if (!valid.length) return;
          const best = valid.reduce((winner, set) => estimatedOneRepMax(set.weight, set.repetitions) > estimatedOneRepMax(winner.weight, winner.repetitions) ? set : winner, valid[0]);
          result.push({
            performed_on: dates[`${day}|${cycle}`] || fallbackDate,
            exercise,
            category: isHeavy ? 'HEAVYS' : 'MIDDLES',
            weight_kg: best.weight,
            repetitions: best.repetitions,
            estimated_1rm: Math.round(estimatedOneRepMax(best.weight, best.repetitions) * 100) / 100,
            volume: Math.round(valid.reduce((sum, set) => sum + set.weight * set.repetitions, 0) * 100) / 100,
            source: 'LOGMAN-Import',
          });
        });
      });
    });
  });
  return result;
}
