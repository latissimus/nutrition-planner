import { supabase } from './supabase.js';

/* Signierte Bildadressen zwischenspeichern, solange sie gültig sind. Jede
   Signatur liefert eine neue Adresse: Nach jedem Neuladen (etwa beim Abhaken
   einer Routine) lud der Browser deshalb dasselbe Bild neu, und es flackerte.
   Gemessen wurden dieselben Bilder rund 90-mal am Tag neu signiert. Eine
   Adresse wird wiederverwendet, bis ihr nur noch eine Viertelstunde bleibt. */
const vorrat = new Map();
const RESERVE_MS = 15 * 60 * 1000;

// Gleiche Form wie storage.createSignedUrl: { data: { signedUrl }, error }.
export function signieren(bucket, pfad, sekunden, optionen) {
  const schluessel = `${bucket}|${pfad}|${sekunden}|${optionen?.transform ? JSON.stringify(optionen.transform) : ''}`;
  const gemerkt = vorrat.get(schluessel);
  if (gemerkt && gemerkt.bis - Date.now() > RESERVE_MS) return gemerkt.antwort;
  const bis = Date.now() + sekunden * 1000;
  const antwort = supabase.storage.from(bucket).createSignedUrl(pfad, sekunden, optionen)
    .then((ergebnis) => {
      // Fehlschläge nicht merken: Der nächste Aufruf versucht es erneut.
      if (!ergebnis?.data?.signedUrl) vorrat.delete(schluessel);
      return ergebnis;
    }, (fehler) => {
      vorrat.delete(schluessel);
      throw fehler;
    });
  vorrat.set(schluessel, { antwort, bis });
  return antwort;
}
