/**
 * Datenspeicher der Sitzung.
 *
 * Jede Seite holte ihre Daten bisher bei jedem Aufbau neu vom Server. Der
 * gesamte Datenbestand eines Kontos ist aber klein – gemessen 516 Zeilen und
 * 245 KB, in 118-210 ms komplett geladen. Einmal holen und im Speicher halten
 * macht jeden Seitenwechsel zu reiner Darstellung.
 *
 * Bewusst KEIN IndexedDB und kein Offline-Betrieb: die App wird von einer
 * Person auf einem Gerät benutzt. Was fehlt, ist Tempo, nicht Offline-Zugang.
 *
 * Die Schlüssel beginnen mit demselben Bereichsnamen, den auch die
 * Änderungsereignisse tragen ("shopping", "body", "food-log" …). Eine
 * Speicherung verwirft damit genau die Daten ihrer eigenen Seite –
 * dieselbe Logik wie beim Ansichtscache.
 */

const gehalten = new Map(); // schluessel -> { wert, zeit }
const unterwegs = new Map(); // schluessel -> Promise
/* Zählwerk je Schlüssel. Wird ein Bereich verworfen, während eine Anfrage
   noch unterwegs ist, darf deren Ergebnis nicht mehr abgelegt werden – es
   stammt von vor der Änderung. Der Stand beim Start wird deshalb mit dem
   Stand bei der Rückkehr verglichen. */
const stand = new Map(); // schluessel -> Zahl
const standVon = (key) => stand.get(key) || 0;

/* Zwei Schwellen statt einer:
   - Bis FRISCHE_MS gilt ein Wert als frisch und wird unverändert geliefert.
   - Danach wird er WEITER SOFORT geliefert, im Hintergrund aber nachgezogen.
     So gibt es nie eine Wartezeit, nur gelegentlich einen Stand von vorhin.
   - Erst ab HOECHSTALTER_MS wird wirklich gewartet.
   Ein früheres Höchstalter von 5 Minuten hat sich als zu streng erwiesen: Wer
   die App länger offen hatte, wartete beim nächsten Seitenwechsel wieder auf
   das Netz, obwohl sich nichts geändert hatte. Eigene Änderungen verwerfen
   ohnehin gezielt – das Alter ist nur das Netz darunter. */
export const FRISCHE_MS = 60 * 1000;
export const HOECHSTALTER_MS = 60 * 60 * 1000;

export function schluessel(bereich, ...teile) {
  return [bereich, ...teile.map((teil) => (teil == null ? '' : String(teil)))].join(':');
}

/**
 * Liefert den gehaltenen Wert oder lädt ihn einmalig nach.
 *
 * `laden` wird bewusst OHNE AbortSignal aufgerufen: Ein Seitenwechsel
 * während des Ladens soll die Anfrage nicht abbrechen, sondern ihr Ergebnis
 * für den nächsten Aufruf behalten. Die Aufrufer prüfen `signal.aborted`
 * weiterhin selbst, bevor sie zeichnen.
 */
export function hole(key, laden, {
  hoechstalter = HOECHSTALTER_MS, frischeAb = FRISCHE_MS, frisch = false,
} = {}) {
  if (!frisch) {
    const da = gehalten.get(key);
    if (da && Date.now() - da.zeit < hoechstalter) {
      // Älter als frisch, aber noch brauchbar: ausliefern und still nachziehen.
      if (Date.now() - da.zeit > frischeAb && !unterwegs.has(key)) {
        hole(key, laden, { frisch: true }).catch(() => {});
      }
      return Promise.resolve(da.wert);
    }
    const laeuft = unterwegs.get(key);
    if (laeuft) return laeuft;
  }
  const startStand = standVon(key);
  const lauf = Promise.resolve()
    .then(() => laden())
    .then((wert) => {
      if (standVon(key) === startStand) gehalten.set(key, { wert, zeit: Date.now() });
      if (unterwegs.get(key) === lauf) unterwegs.delete(key);
      return wert;
    })
    .catch((fehler) => {
      // Ein Fehlschlag darf sich nicht festsetzen: der nächste Aufruf probiert neu.
      if (unterwegs.get(key) === lauf) unterwegs.delete(key);
      throw fehler;
    });
  unterwegs.set(key, lauf);
  return lauf;
}

/** Verwirft alle Schlüssel eines oder mehrerer Bereiche. Ohne Angabe: alles. */
export function verwerfen(bereich) {
  const liste = bereich == null ? null : [].concat(bereich).filter(Boolean);
  if (!liste || !liste.length) return leeren();
  liste.forEach((name) => {
    const praefix = `${name}:`;
    [gehalten, unterwegs].forEach((ablage) => {
      [...ablage.keys()].forEach((key) => {
        if (key !== name && !key.startsWith(praefix)) return;
        stand.set(key, standVon(key) + 1);   // laufende Anfrage entwerten
        ablage.delete(key);
      });
    });
  });
  return undefined;
}

export function leeren() {
  [...unterwegs.keys()].forEach((key) => stand.set(key, standVon(key) + 1));
  gehalten.clear();
  unterwegs.clear();
}

/** Nur für Prüfungen und Diagnose. */
export function istGehalten(key) {
  return gehalten.has(key);
}

export function groesse() {
  return gehalten.size;
}
