import { supabase } from './supabase.js';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// LOGMAN-Kopplung: Einmal per Code aus LOGMAN verbinden, danach liest CAPBOY
// die Einheiten selbst (Edge Function logman-abgleich). Ersetzt den
// JSON-Export; der Import bleibt nur als Rückfall in COMP.

const ABGLEICH_KEY = 'capboy:logman-abgleich';
// Ohne Kopplung ruft der Hintergrund gar nicht erst an. Gesetzt aus jeder
// Antwort der Funktion; „unbekannt“ (leer) fragt einmal nach.
const VERBUNDEN_KEY = 'capboy:logman-verbunden';
const merken = (antwort) => {
  try { localStorage.setItem(VERBUNDEN_KEY, antwort?.verbunden ? 'ja' : 'nein'); } catch {}
  return antwort;
};
// Beim Öffnen höchstens alle 30 Minuten: Jeder Aufruf erzeugt Supabase-Logs,
// und neue Einheiten entstehen nicht im Minutentakt.
const ABSTAND_MS = 30 * 60 * 1000;

async function aufrufen(body) {
  const { data, error } = await supabase.functions.invoke('logman-abgleich', { body });
  if (error) {
    let message = error.message;
    try {
      const payload = await error.context?.clone?.().json();
      if (payload?.error) message = payload.error;
      else if (payload?.code === 'NOT_FOUND') message = 'Der LOGMAN-Abgleich ist noch nicht eingerichtet.';
    } catch {}
    if (error.name === 'FunctionsFetchError' || /failed to send/i.test(String(message))) message = 'Der LOGMAN-Abgleich ist gerade nicht erreichbar.';
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/* Beim Start im Hintergrund: still, ohne Meldung. Neue Werte landen in
   logman_performance; COMP hört auf Änderungen dort und zeichnet sich neu. */
export async function logmanImHintergrundAbgleichen() {
  let zuletzt = 0;
  let verbunden = '';
  try {
    zuletzt = Number(localStorage.getItem(ABGLEICH_KEY)) || 0;
    verbunden = localStorage.getItem(VERBUNDEN_KEY) || '';
  } catch {}
  if (verbunden === 'nein' || Date.now() - zuletzt < ABSTAND_MS) return;
  try { localStorage.setItem(ABGLEICH_KEY, String(Date.now())); } catch {}
  try {
    merken(await aufrufen({ aktion: 'abgleichen' }));
  } catch (error) {
    console.warn('LOGMAN-Abgleich:', error?.message);
  }
}

/* Nach dem Löschen manueller Importe in COMP (GPT-Review Schritt 6): Ein
   manueller Import kann eine abgeglichene Zeile mit gleichem Schlüssel ersetzt
   haben. Ein unveränderter LOGMAN-Stand schreibt sie beim normalen Abgleich
   nicht neu; deshalb hier neu aufbauen, wie „Jetzt abgleichen“ im Profil.
   Ohne Kopplung passiert nichts. aufruf: nur für Tests austauschbar. */
export async function logmanNeuAufbauen({ aufruf = aufrufen } = {}) {
  let verbunden = '';
  try { verbunden = localStorage.getItem(VERBUNDEN_KEY) || ''; } catch {}
  if (verbunden === 'nein') return { verbunden: false };
  return merken(await aufruf({ aktion: 'abgleichen', erzwingen: true, neu: true }));
}

const zeit = (iso) => new Date(iso).toLocaleString('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// Profilbereich „LOGMAN“: Code eingeben, Status, jetzt abgleichen, trennen.
export function mountLogmanKopplung(bereich) {
  bereich.innerHTML = `
    <p class="profile-hinweis">Verbinde CAPBOY mit deinem LOGMAN. CAPBOY liest deine Einheiten dann selbst und wertet sie mit Schlaf, Ernährung und Körperwerten aus. CAPBOY kann dein LOGMAN nur lesen, nie verändern.</p>
    <p class="profile-hinweis logman-status" aria-live="polite">Status wird geladen …</p>
    <form class="logman-koppeln" hidden>
      <label class="fld-l" for="logman-code">Code aus LOGMAN</label>
      <p class="profile-hinweis">In LOGMAN unter Profil → CAPBOY auf „Mit CAPBOY verbinden“ tippen und den Code hier eingeben.</p>
      <input id="logman-code" class="input" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="14" placeholder="ABCDE-FGHJK" required>
      <button class="btn btn-primary btn-block" type="submit">Verbinden</button>
    </form>
    <div class="logman-verbunden" hidden>
      <button class="btn btn-block" type="button" data-logman-jetzt>Jetzt abgleichen</button>
      <button class="btn btn-block" type="button" data-logman-trennen>Verbindung trennen</button>
    </div>`;
  const status = bereich.querySelector('.logman-status');
  const formular = bereich.querySelector('.logman-koppeln');
  const verbunden = bereich.querySelector('.logman-verbunden');
  const zeigen = (antwort, meldung = '') => {
    formular.hidden = Boolean(antwort?.verbunden);
    verbunden.hidden = !antwort?.verbunden;
    const text = antwort?.verbunden
      ? `<b>Verbunden</b> seit ${escapeHtml(zeit(antwort.verbunden_am))}${antwort.zuletzt_abgeglichen_am ? ` · zuletzt abgeglichen ${escapeHtml(zeit(antwort.zuletzt_abgeglichen_am))}` : ''}`
      : 'Nicht verbunden.';
    status.innerHTML = meldung ? `${text}<br>${escapeHtml(meldung)}` : text;
  };
  const ergebnisText = (antwort) => ({
    neu: `${antwort.leistungswerte || 0} Leistungswerte übernommen.`,
    unveraendert: 'Keine neuen Einheiten.',
    leer: 'In LOGMAN ist noch nichts eingetragen.',
    getrennt: 'Die Verbindung wurde in LOGMAN getrennt.',
  })[antwort?.ergebnis] || '';
  let geladen = false;
  const laden = async () => {
    if (geladen) return;
    geladen = true;
    try {
      zeigen(merken(await aufrufen({ aktion: 'status' })));
    } catch (error) {
      geladen = false;
      status.textContent = error.message;
    }
  };
  bereich.parentElement?.addEventListener('toggle', (event) => { if (event.currentTarget.open) laden(); });
  if (bereich.parentElement?.open) laden();

  formular.onsubmit = async (event) => {
    event.preventDefault();
    const knopf = formular.querySelector('button[type="submit"]');
    knopf.disabled = true;
    status.textContent = 'Verbinde mit LOGMAN …';
    try {
      const antwort = merken(await aufrufen({ aktion: 'koppeln', code: formular.querySelector('input').value }));
      formular.reset();
      try { localStorage.setItem(ABGLEICH_KEY, String(Date.now())); } catch {}
      zeigen(antwort, ergebnisText(antwort));
    } catch (error) {
      status.textContent = error.message;
    } finally {
      knopf.disabled = false;
    }
  };
  bereich.querySelector('[data-logman-jetzt]').onclick = async (event) => {
    const knopf = event.currentTarget;
    knopf.disabled = true;
    status.textContent = 'Gleiche mit LOGMAN ab …';
    try {
      const antwort = merken(await aufrufen({ aktion: 'abgleichen', erzwingen: true, neu: true }));
      try { localStorage.setItem(ABGLEICH_KEY, String(Date.now())); } catch {}
      zeigen(antwort, ergebnisText(antwort));
    } catch (error) {
      status.textContent = error.message;
    } finally {
      knopf.disabled = false;
    }
  };
  bereich.querySelector('[data-logman-trennen]').onclick = async (event) => {
    if (!confirm('Verbindung zu LOGMAN trennen?\n\nCAPBOY liest dann keine neuen Einheiten mehr. Bisher übernommene Werte bleiben erhalten.')) return;
    const knopf = event.currentTarget;
    knopf.disabled = true;
    try {
      zeigen(merken(await aufrufen({ aktion: 'trennen' })));
    } catch (error) {
      status.textContent = error.message;
    } finally {
      knopf.disabled = false;
    }
  };
}
