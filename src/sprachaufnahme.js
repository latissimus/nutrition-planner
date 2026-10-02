// Tonaufnahme für Sprachnachrichten (Chat, Rezept-KI). Startet das Mikrofon
// und liefert beim Stoppen eine Datei, die ki-werkzeuge verschriftlichen kann.
// Nach dem Stoppen oder Verwerfen ist das Mikrofon wieder aus.

export const AUFNAHME_MAX_MS = 120_000;
const MIN_MS = 700;

export function spracheMoeglich() {
  return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(window.MediaRecorder);
}

export function aufnahmeZeit(ms) {
  const sekunden = Math.floor(ms / 1000);
  return `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`;
}

// Wirft, wenn das Mikrofon nicht geöffnet werden kann (keine Erlaubnis).
export async function aufnahmeStarten() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const teile = [];
  recorder.ondataavailable = (event) => { if (event.data.size) teile.push(event.data); };
  const start = performance.now();
  recorder.start();
  let beendet = null;
  const beenden = () => {
    beendet ||= new Promise((fertig) => {
      recorder.onstop = () => {
        stream.getTracks().forEach((spur) => spur.stop());
        fertig();
      };
      if (recorder.state === 'recording') recorder.stop();
      else recorder.onstop();
    });
    return beendet;
  };
  return {
    dauer: () => performance.now() - start,
    // null, wenn die Aufnahme zu kurz oder leer war.
    async stoppen() {
      const dauer = performance.now() - start;
      await beenden();
      if (dauer < MIN_MS || !teile.length) return null;
      const mime = (recorder.mimeType || teile[0]?.type || 'audio/webm').split(';')[0];
      const endung = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
      return new File([new Blob(teile, { type: mime })], `sprachnachricht.${endung}`, { type: mime });
    },
    verwerfen() { beenden(); },
  };
}
