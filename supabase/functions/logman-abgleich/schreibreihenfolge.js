/* Schreibreihenfolge eines Abgleichs (GPT-Review vom 05.10.2026).
   Der Spiegel trägt die LOGMAN-Version, an der der nächste Abgleich erkennt,
   ob sich etwas geändert hat („unverändert“). Er wird deshalb zuletzt
   geschrieben: Scheitert vorher das Bereinigen oder Schreiben der
   Leistungswerte, bleibt die alte Version stehen, und der nächste Abgleich
   holt den Stand vollständig neu, statt die Änderungen zu überspringen.
   Ganz zuerst werden neue Einheiten mit ihrem Datum vorgemerkt (ohne neue
   Version): Ein späterer Versuch, auch am Folgetag, datiert sie gleich.
   Dann die veralteten Zeilen entfernen, dann die neuen schreiben: Scheitert
   das Schreiben, fehlen nur Zeilen, die es in LOGMAN ohnehin nicht mehr gibt.
   Reines JavaScript ohne Abhängigkeiten, damit Vite (Tests) und Deno es laden. */
export async function abgleichSchreiben({ datenVormerken = async () => {}, veralteteEntfernen, leistungSchreiben, spiegelSchreiben }) {
  await datenVormerken();
  const entfernt = await veralteteEntfernen();
  const geschrieben = await leistungSchreiben();
  await spiegelSchreiben();
  return { entfernt, geschrieben };
}
