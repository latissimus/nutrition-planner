import { supabase } from './supabase.js';
import { materialIconMarkup } from './categoryIcons.js';
// Das Plus direkt aus der Datei: Unter der Kennung "add" liefert die
// Symbolsammlung zuerst Add.svg (Plus im Kästchen).
import plusSvg from '../MUSCLEDEX-ICONS/add_24dp_E3E3E3_FILL1_wght700_GRAD200_opsz24.svg?raw';
import { toast } from './toast.js';
import { spracheVerschriftlichen } from './kiWerkzeuge.js';
import { AUFNAHME_MAX_MS, aufnahmeStarten, aufnahmeZeit, spracheMoeglich } from './sprachaufnahme.js';
import {
  ENTSCHEIDUNGEN, RICHTUNGEN, URTEILE, ZIELGROESSEN, istNichtEingerichtet, merkeEmpfehlung, uebernimmAuswertung,
} from './coachMemory.js';
import { vergleichMarkup } from './coachWeekly.js';
import { mountWochenKaertchen } from './wochenKaertchen.js';
import { fensterMarkup } from './coachFenster.js';
import {
  aktionenMarkup, hatQuellen, inlineMarkup, menueMarkup, quellenAus, quellenSheetMarkup, symbol, textMarkup, zeitText,
} from './chatLeiste.js';
import { inhaltMitfedern } from './federn.js';
import { sanduhrMarkup } from './sanduhr.js';
import { ladeOffenePunkte, startMarkup } from './coachStatus.js';
import {
  alsGelesenMarkieren, alsUebernommenMerken, coachingKarteMarkup, coachingKopf, coachingNachId, coachingQuellen, coachingText, istFrisch, neuestesCoaching,
} from './coaching.js';

export { fensterMarkup };

const CONTEXT_KEY = 'muscledex:coach-context';
// Laufendes Gespräch dieses Tabs: ID vom Server und die bisherigen Runden.
const GESPRAECH_KEY = 'muscledex:coach-gespraech';
// Chat-Modus (COACHING-PLAN.md, Schritt 4b): „Frage“ beantwortet nur die
// Frage, „Bewertung & Schritte“ wertet aus und schlägt Schritte vor. Er gilt
// für die Sitzung; eine neue Sitzung beginnt mit „Frage“.
const MODUS_KEY = 'muscledex:coach-modus';
export const MODI = { frage: 'Frage', bewertung: 'Bewertung & Schritte' };
export function modusLesen() {
  try { return sessionStorage.getItem(MODUS_KEY) === 'bewertung' ? 'bewertung' : 'frage'; } catch { return 'frage'; }
}
function modusSchreiben(modus) {
  try { sessionStorage.setItem(MODUS_KEY, modus); } catch {}
}
// Antworten ohne Modus stammen aus der Zeit vor dem Schalter: Bewertungen.
export const antwortModus = (result) => (result?.modus === 'frage' ? 'frage' : 'bewertung');
const SCHRITTE_FRAGE_MAX = 1000;
const SCHRITTE_ANTWORT_MAX = 3000;
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const readableModelText = (value = '') => String(value)
  .replace(/\[([^\]]+)\]\(https?:\/\/[^\s)]+(?:\([^)]*\)[^\s)]*)?\)/g, '$1');

const bezeichnung = (liste, wert) => liste.find(([id]) => id === wert)?.[1] || wert || '';
const tagDatum = (wert) => (/^\d{4}-\d{2}-\d{2}$/.test(String(wert || '')) ? wert.split('-').reverse().join('.') : '');
const ART = { experiment: 'Experiment', sicherheit: 'Sicherheit', beobachtung: 'Beobachten' };

function nutzerAvatarMarkup(profile, email = '') {
  if (profile?.avatar_url?.startsWith('data:image/')) {
    return `<img src="${escapeHtml(profile.avatar_url)}" alt="">`;
  }
  const quelle = String(profile?.full_name || email || '?').trim();
  const teile = quelle.split(/\s+/).filter(Boolean);
  const initialen = (teile.length > 1 ? `${teile[0][0]}${teile[1][0]}` : quelle.slice(0, 2)).toUpperCase();
  return `<span>${escapeHtml(initialen)}</span>`;
}

async function bildAnhang(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Bitte wähle ein Bild aus.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Das Bild darf höchstens 8 MB groß sein.');
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Das Bild konnte nicht geöffnet werden.'));
    element.src = source;
  });
  const max = 1600;
  const faktor = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * faktor));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * faktor));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return { name: file.name, dataUrl: canvas.toDataURL('image/jpeg', 0.82) };
}

/* Anhang aus „Dateien“: Bilder wie bisher verkleinert, PDF unverändert als
   Datei, Textdateien (.txt, .csv, .md) als Text. Ein Anhang je Nachricht. */
export const ANHANG_GRENZEN = { pdfBytes: 5 * 1024 * 1024, textBytes: 400 * 1024, textZeichen: 40000 };
const istPdf = (file) => file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
const istText = (file) => /^text\//.test(file?.type || '') || /\.(txt|csv|md)$/i.test(file?.name || '');
const leseDatei = (file, als) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'));
  if (als === 'text') reader.readAsText(file); else reader.readAsDataURL(file);
});
async function dateiAnhang(file) {
  if (!file) throw new Error('Keine Datei ausgewählt.');
  if (file.type?.startsWith('image/')) return { art: 'bild', ...(await bildAnhang(file)) };
  if (istPdf(file)) {
    if (file.size > ANHANG_GRENZEN.pdfBytes) throw new Error('Das PDF darf höchstens 5 MB groß sein.');
    const dataUrl = String(await leseDatei(file, 'url')).replace(/^data:[^;,]*;base64,/, 'data:application/pdf;base64,');
    return { art: 'pdf', name: file.name, dataUrl };
  }
  if (istText(file)) {
    if (file.size > ANHANG_GRENZEN.textBytes) throw new Error('Die Textdatei ist zu groß.');
    const text = String(await leseDatei(file, 'text'));
    if (text.length > ANHANG_GRENZEN.textZeichen) throw new Error('Die Textdatei ist zu lang (höchstens 40.000 Zeichen).');
    if (!text.trim()) throw new Error('Die Datei ist leer.');
    return { art: 'text', name: file.name, text };
  }
  throw new Error('Diese Dateiart geht nicht. Möglich sind Bilder, PDF und Textdateien (.txt, .csv, .md).');
}
// So geht ein Anhang an den Server; der Hinweis steht unter deiner Nachricht.
export function anhangFuerServer(anhang) {
  if (!anhang) return null;
  if (anhang.art === 'pdf') return { type: 'file', name: anhang.name, dataUrl: anhang.dataUrl };
  if (anhang.art === 'text') return { type: 'text', name: anhang.name, text: anhang.text };
  return { type: 'image', dataUrl: anhang.dataUrl };
}
export const anhangHinweis = (anhang) => (!anhang ? '' : anhang.art === 'bild' || !anhang.art ? 'Bild angehängt' : `Datei angehängt: ${anhang.name}`);

// Eine Empfehlung als Punkt der Liste „Nächste Schritte“; seit Schritt 6 mit
// Art und bei Experimenten mit Hypothese, Ausgangswert, Zielgröße und
// Prüfdatum. Ältere Antworten ohne diese Felder erscheinen wie bisher.
function empfehlungMarkup(item, index, merken) {
  const art = ART[item.kind] ? item.kind : null;
  const experiment = art === 'experiment';
  const ziel = item.targetMetric && item.targetMetric !== 'keine' ? bezeichnung(ZIELGROESSEN, item.targetMetric) : '';
  const richtung = item.expectedDirection && item.expectedDirection !== 'keine' ? bezeichnung(RICHTUNGEN, item.expectedDirection) : '';
  const details = experiment ? [
    item.hypothesis ? `<p><em>Hypothese:</em> ${inlineMarkup(item.hypothesis)}</p>` : '',
    item.baseline ? `<p><em>Ausgangswert:</em> ${inlineMarkup(item.baseline)}</p>` : '',
    ziel ? `<p><em>Zielgröße:</em> ${escapeHtml(ziel)}${richtung ? ` – ${escapeHtml(richtung)}` : ''}</p>` : '',
  ].join('') : '';
  const pruefen = experiment && tagDatum(item.reviewDate) ? ` · prüfen am ${tagDatum(item.reviewDate)}` : '';
  const knopf = merken && art !== 'sicherheit'
    ? `<button class="coach-merken" type="button" data-empfehlung-merken="${index}">${experiment ? 'Als Experiment merken' : 'Als Maßnahme merken'}</button>` : '';
  const zeit = item.timeframe ? `<small>${art ? `<span class="coach-art">${ART[art]}${pruefen}</span> · ` : ''}${inlineMarkup(item.timeframe)}</small>` : (art ? `<small><span class="coach-art">${ART[art]}${pruefen}</span></small>` : '');
  return `<li class="coach-schritt${art ? ` ist-${art}` : ''}"><b>${inlineMarkup(item.action)}</b><p>${inlineMarkup(item.rationale)}</p>${details}${zeit}${knopf}</li>`;
}

// Auswertungen fälliger Experimente (Schritt 6).
function auswertungenMarkup(auswertungen = [], merken = false) {
  if (!auswertungen.length) return '';
  return `<section class="coach-schritte"><h4>Auswertung deiner Experimente</h4><ul>${auswertungen.map((item, index) => `<li class="coach-schritt"><small><span class="coach-art">${escapeHtml(bezeichnung(URTEILE, item.verdict))} · ${escapeHtml(bezeichnung(ENTSCHEIDUNGEN, item.decision))}</span></small><p>${inlineMarkup(item.basis)}</p>${merken ? `<button class="coach-merken" type="button" data-auswertung-uebernehmen="${index}">Ergebnis übernehmen</button>` : ''}</li>`).join('')}</ul></section>`;
}

const liste = (eintraege) => `<ul>${eintraege.map((item) => `<li>${inlineMarkup(item)}</li>`).join('')}</ul>`;

// Kopf des „…“-Menüs einer Antwort: Uhrzeit (ältere Runden haben keine) und Modus.
export const antwortKopf = (runde) => [zeitText(runde?.zeit), MODI[antwortModus(runde?.result)]].filter(Boolean).join(' · ');

// Die Antwort als schlichter Text für Kopieren, Vorlesen und Teilen.
export function antwortText(result) {
  if (!result) return '';
  if (antwortModus(result) === 'frage') {
    return [result.answer, result.followUpQuestion, result.safetyNote].filter(Boolean).map(readableModelText).join('\n\n');
  }
  const schritte = (result.recommendations || []).slice(0, 3).map((item) => `– ${item.action}`);
  return [result.summary, result.safetyNote, schritte.length ? `Nächste Schritte:\n${schritte.join('\n')}` : ''].filter(Boolean).map(readableModelText).join('\n\n');
}

/* Antworten wie bei ChatGPT (Rückmeldung 08.10.): schlichter Text ohne Kopf
   und ohne Karten, darunter die Leiste (chatLeiste.js). Modus und Uhrzeit
   stehen oben im „…“-Menü. „Daraus Schritte machen“ steht dort nur, wo die
   Antwort zu etwas führt, das man tun kann (stepsUseful). */
function frageMarkup(result, { merken = false, schritteGemacht = false } = {}) {
  return `<div class="coach-result ist-frage">
    <div class="coach-antwort">${textMarkup(result.answer)}${result.safetyNote ? `<p class="coach-safety">${inlineMarkup(result.safetyNote)}</p>` : ''}${result.followUpQuestion ? `<p class="coach-rueckfrage">${inlineMarkup(result.followUpQuestion)}</p>` : ''}</div>
    ${merken ? aktionenMarkup({ quellen: quellenAus(result), schritte: result.stepsUseful === true && !schritteGemacht }) : ''}
  </div>`;
}

// Bewertung: zuerst die Antwort selbst, dann was zu tun ist; Daten,
// Einordnung und Unsicherheiten stehen zugeklappt darunter.
export function resultMarkup(result, { merken = false, schritteGemacht = false } = {}) {
  if (!result) return '';
  if (antwortModus(result) === 'frage') return frageMarkup(result, { merken, schritteGemacht });
  const facts = (result.facts || []).slice(0, 6);
  const interpretations = (result.interpretations || []).slice(0, 5);
  const uncertainties = (result.uncertainties || []).slice(0, 5);
  const recommendations = (result.recommendations || []).slice(0, 3);
  const mehr = [
    facts.length ? `<h4>Daten</h4>${liste(facts)}` : '',
    interpretations.length ? `<h4>Einordnung</h4>${liste(interpretations)}` : '',
    uncertainties.length ? `<h4>Noch unsicher</h4>${liste(uncertainties)}` : '',
  ].join('');
  return `<div class="coach-result ist-bewertung">
    <div class="coach-antwort">${textMarkup(result.summary)}${result.safetyNote ? `<p class="coach-safety">${inlineMarkup(result.safetyNote)}</p>` : ''}</div>
    ${auswertungenMarkup((result.experimentReviews || []).slice(0, 5), merken)}
    ${recommendations.length ? `<section class="coach-schritte"><h4>Nächste Schritte</h4><ol>${recommendations.map((item, index) => empfehlungMarkup(item, index, merken)).join('')}</ol></section>` : ''}
    ${mehr ? `<details class="coach-mehr"><summary>Daten &amp; Einordnung</summary>${mehr}</details>` : ''}
    ${merken ? aktionenMarkup({ quellen: quellenAus(result) }) : ''}
  </div>`;
}

const kurz = (text, grenze) => (text.length > grenze ? `${text.slice(0, grenze - 1)}…` : text);
// bezug: bei „Daraus Schritte machen“ die Frage, zu der die Schritte gehören.
// anhang: Hinweis unter der Nachricht; ältere Runden kennen nur hatAnhang (Bild).
const nutzerText = (text, anhang = '', bezug = '') => `<p>${escapeHtml(text)}</p>${bezug ? `<small>zu „${escapeHtml(kurz(bezug, 80))}“</small>` : ''}${anhang ? `<small>${escapeHtml(anhang === true ? 'Bild angehängt' : anhang)}</small>` : ''}`;

/* Auftrag für „Daraus Schritte machen“ (GPT-Review 4b): Frage und Antwort
   gehen mit, damit es auch bei Antworten außerhalb der letzten acht
   Nachrichten des Gesprächsgedächtnisses funktioniert. */
export function schritteAnfrage(runde) {
  if (antwortModus(runde?.result) !== 'frage' || !runde.result.answer || runde.result.stepsUseful !== true) return null;
  return {
    question: 'Daraus Schritte machen',
    modus: 'bewertung',
    schritteAus: {
      frage: String(runde.frage || '').slice(0, SCHRITTE_FRAGE_MAX),
      antwort: String(runde.result.answer).slice(0, SCHRITTE_ANTWORT_MAX),
    },
  };
}

// Das Gespräch: jede Runde als Frage und Antwort. Die Wochenbilanz trägt
// zusätzlich ihren Wochenvergleich.
export function verlaufMarkup(runden = [], avatar = '') {
  if (!runden.length) return '';
  return runden.map((runde, index) => fensterMarkup({ von: 'user', avatar, inhalt: nutzerText(runde.frage, runde.anhang || runde.hatAnhang, runde.bezug) })
    + fensterMarkup({ runde: index, inhalt: `${runde.weekly ? vergleichMarkup(runde.weekly) : ''}${resultMarkup(runde.result, { merken: true, schritteGemacht: runde.schritteGemacht })}` })).join('');
}

const tipptMarkup = (text) => fensterMarkup({ klasse: 'is-loading', inhalt: `<p class="coach-tippt" role="status">${sanduhrMarkup()}<span data-coach-ladestatus>${escapeHtml(text)}</span></p>` });
const LADEPHASEN = {
  coach: ['Coach ordnet deine Daten', 'Coach prüft das Seminarwissen', 'Coach formuliert die Antwort'],
  web: ['Coach ordnet deine Daten', 'Coach prüft das Seminarwissen', 'Coach recherchiert im Web', 'Coach gleicht die Quellen ab', 'Coach formuliert die Antwort'],
  woche: ['Coach ordnet deine Woche', 'Coach vergleicht deine Entwicklungen', 'Coach prüft laufende Experimente', 'Coach formuliert die Bilanz'],
};
// Die Statuszeile wechselt weich (kurz ausblenden, Text tauschen, einblenden),
// damit sie beim Warten nicht unruhig wirkt.
function ladephasenStarten(container, phasen) {
  const status = container.querySelector('[data-coach-ladestatus]');
  if (!status || phasen.length < 2) return () => {};
  let index = 0;
  const timer = window.setInterval(() => {
    index = Math.min(index + 1, phasen.length - 1);
    status.classList.add('wechselt');
    window.setTimeout(() => {
      status.textContent = phasen[index];
      status.classList.remove('wechselt');
    }, 180);
    if (index === phasen.length - 1) window.clearInterval(timer);
  }, 3200);
  return () => window.clearInterval(timer);
}

/* Einblenden der neuen Antwort wie beim Streaming (Rückmeldung 08.10.):
   Der Antworttext läuft Wort für Wort ein, danach erscheinen Schritte und
   die Leiste. Die Antwort liegt schon ganz vor; damit das Einblenden nichts
   verzögert, dauert es höchstens etwa zwei Sekunden. Absätze, Fettes und
   Zitat-Pillen bleiben dabei erhalten: Jedes Wort und jede Pille ist ein
   Stück, das sichtbar wird (.ist-da). Ein Tipp auf die Antwort zeigt sofort
   alles. */
export const schreibTempo = (woerter) => Math.max(40, woerter / 2);
function antwortEinblenden(fenster, mitlaufen) {
  const text = fenster?.querySelector('.coach-antwort');
  const ergebnis = text?.closest('.coach-result');
  if (!ergebnis || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const fertigHtml = text.innerHTML;
  const stuecke = [];
  const zerlegen = (knoten) => [...knoten.childNodes].forEach((kind) => {
    if (kind.nodeType === Node.ELEMENT_NODE) {
      if (kind.matches('.coach-zitat')) { kind.classList.add('wort'); stuecke.push(kind); } else zerlegen(kind);
      return;
    }
    if (kind.nodeType !== Node.TEXT_NODE) return;
    const teile = document.createDocumentFragment();
    kind.textContent.split(/(\s+)/).forEach((teil) => {
      if (!teil) return;
      if (!teil.trim()) { teile.append(teil); return; }
      const wort = document.createElement('span');
      wort.className = 'wort';
      wort.textContent = teil;
      teile.append(wort);
      stuecke.push(wort);
    });
    kind.replaceWith(teile);
  });
  zerlegen(text);
  if (!stuecke.length) return;
  const tempo = schreibTempo(stuecke.length);
  ergebnis.classList.add('wird-geschrieben');
  text.classList.add('laeuft');
  const beginn = performance.now();
  let fertig = false;
  let gezeigt = 0;
  const abschliessen = () => {
    if (fertig) return;
    fertig = true;
    text.classList.remove('laeuft');
    text.innerHTML = fertigHtml;
    ergebnis.classList.replace('wird-geschrieben', 'ist-geschrieben');
    mitlaufen();
  };
  const schritt = (jetzt) => {
    if (fertig) return;
    const bis = Math.min(stuecke.length, Math.floor(((jetzt - beginn) / 1000) * tempo));
    for (; gezeigt < bis; gezeigt += 1) stuecke[gezeigt].classList.add('ist-da');
    mitlaufen();
    if (gezeigt >= stuecke.length) window.setTimeout(abschliessen, 450);
    else requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
  ergebnis.addEventListener('click', abschliessen, { once: true });
}
const fehlerMarkup = (text) => fensterMarkup({ klasse: 'is-fehler', inhalt: `<p>${escapeHtml(text)}</p>` });

async function rufeCoach(body) {
  const { data, error } = await supabase.functions.invoke('capboy-coach', { body });
  if (error) {
    let message = error.message;
    try {
      const payload = await error.context?.clone?.().json();
      if (payload?.error) message = payload.error;
    } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Öffnet den Coach mit einer Frage von einer Fachseite. Mit senden: true
// schickt er sie gleich ab ("Mit Coach besprechen"), sonst steht sie im Feld.
export function openCoachQuestion({ scope = 'overall', question = '', senden = false } = {}) {
  sessionStorage.setItem(CONTEXT_KEY, JSON.stringify({ scope, question, senden }));
  // Eine gemerkte Coach-Ansicht würde die Frage nie lesen (main.js).
  window.dispatchEvent(new CustomEvent('muscledex:ansicht-neu-aufbauen', { detail: { route: 'coach' } }));
  location.hash = 'coach';
}

function gespraechLesen() {
  try {
    const gespraech = JSON.parse(sessionStorage.getItem(GESPRAECH_KEY) || 'null');
    return gespraech?.id && Array.isArray(gespraech.runden) ? gespraech : null;
  } catch {
    return null;
  }
}
function gespraechSchreiben(gespraech) {
  try {
    if (gespraech) sessionStorage.setItem(GESPRAECH_KEY, JSON.stringify(gespraech));
    else sessionStorage.removeItem(GESPRAECH_KEY);
  } catch {}
}

/* Die App legt verlassene Seiten zwischen und bricht dabei ihr Signal ab.
   Kommt der Nutzer zurück, arbeitet dieselbe Ansicht weiter. Antworten
   werden deshalb unabhängig vom Signal geschrieben: Ist die Ansicht gerade
   abgelegt, erscheint die Antwort beim Zurückkehren. Mit dem Signal-Abbruch
   gingen Antworten nach einem Seitenwechsel stillschweigend verloren. */
export async function mountCoachPage(container, { userId, backRoute = 'body' }) {
  let pending = {};
  try { pending = JSON.parse(sessionStorage.getItem(CONTEXT_KEY) || '{}'); } catch {}
  sessionStorage.removeItem(CONTEXT_KEY);
  // Eine Frage von einer Fachseite beginnt immer ein neues Gespräch.
  if (pending.question) gespraechSchreiben(null);
  let gespraech = gespraechLesen();
  // Tägliches Coaching (coaching.js): Ein frisches, noch ungelesenes Coaching
  // beginnt das Gespräch zu ihm. Seine id ist die Gesprächs-id, unter der der
  // Server das Coaching abgelegt hat; Rückfragen kennen es dadurch.
  let coaching = null;
  try { coaching = await neuestesCoaching(userId); } catch (error) { console.warn('Coaching nicht geladen:', error?.message); }
  // Ein früheres Coaching, im Gedächtnis geöffnet: Seine Karte steht über
  // seinem Gespräch, und ein neueres verdrängt es nicht.
  if (gespraech?.id && coaching?.id !== gespraech.id) {
    const frueher = await coachingNachId(userId, gespraech.id).catch(() => null);
    if (frueher?.status === 'bereit') coaching = frueher;
  }
  if (coaching?.status === 'bereit' && !coaching.gelesen_am && istFrisch(coaching) && !pending.question && gespraech?.id !== coaching.id) {
    gespraech = { id: coaching.id, runden: [] };
    gespraechSchreiben(gespraech);
  }
  // Die gerade sichtbaren Runden; "Merken" und "Ergebnis übernehmen" gehören
  // zur Antwort, unter der sie stehen.
  let runden = gespraech?.runden || [];
  let anhang = null;
  const { data: coachProfile } = await supabase.from('profiles').select('full_name,avatar_url').eq('id', userId).maybeSingle();
  const avatar = nutzerAvatarMarkup(coachProfile, (await supabase.auth.getUser()).data?.user?.email || '');
  container.classList.add('coach-page');
  /* Zurück und Gedächtnis sitzen im App-Kopf (main.js). Wie bei ChatGPT
     (Rückmeldung 08.10.): Das Plus öffnet ein kleines Menü über der Kapsel
     (Kamera, Fotos, Dateien, Bewertung & Schritte, Webwissen, Neues
     Gespräch); „…“ unter einer Antwort öffnet ihr Menü; „Quellen“ öffnet die
     Liste von unten. Ein Pfeil über der Kapsel führt zurück ans Ende. */
  const menueZeile = (bild, text, zusatz = '') => `<span class="coach-menue-kreis">${symbol(bild)}</span><span class="coach-menue-text">${escapeHtml(text)}</span>${zusatz}`;
  const haken = `<i class="coach-menue-haken" aria-hidden="true">${symbol('haken')}</i>`;
  container.innerHTML = `<main class="coach-shell coach-chat">
    <section class="coach-answer" data-coach-answer aria-live="polite"></section>
    <section class="coach-woche" data-coach-woche hidden></section>
    <form class="coach-form" data-coach-form>
      <div class="coach-form-innen">
        <button class="coach-nach-unten" type="button" data-coach-nach-unten aria-label="Zum Ende des Gesprächs" hidden>${symbol('runter')}</button>
        <div class="coach-plus-menue coach-schwebe" data-coach-tools role="menu" aria-label="Anhängen, Modus und Webwissen" hidden>
          <label class="coach-menue-zeile">${menueZeile('kamera', 'Kamera')}<input type="file" accept="image/*" capture="environment" data-coach-file></label>
          <label class="coach-menue-zeile">${menueZeile('fotos', 'Fotos')}<input type="file" accept="image/*" data-coach-file></label>
          <label class="coach-menue-zeile">${menueZeile('dateien', 'Dateien')}<input type="file" accept="application/pdf,.pdf,text/plain,.txt,text/csv,.csv,text/markdown,.md,image/*" data-coach-file></label>
          <label class="coach-menue-zeile ist-bewertung">${menueZeile('bewertung', MODI.bewertung, haken)}<input type="checkbox" role="menuitemcheckbox" data-coach-bewertung></label>
          <label class="coach-menue-zeile ist-web">${menueZeile('web', 'Webwissen', haken)}<input type="checkbox" role="menuitemcheckbox" data-coach-web checked></label>
          <button class="coach-menue-zeile" type="button" role="menuitem" data-neues-gespraech${gespraech ? '' : ' hidden'}>${menueZeile('neu', 'Neues Gespräch')}</button>
        </div>
        <div class="coach-attachment" data-coach-attachment hidden></div>
        <div class="coach-inputbar">
          <button class="coach-plus" type="button" data-coach-plus aria-expanded="false" aria-haspopup="menu" aria-label="Anhängen, Modus und Webwissen"><span class="material-svg coach-eingabe-icon" aria-hidden="true">${plusSvg}</span></button>
          <button class="coach-modus-chip" type="button" data-coach-modus-chip aria-label="Bewertung & Schritte beenden, zurück zu Frage" hidden><span>Bewertung</span>${materialIconMarkup('close')}</button>
          <label class="sr-only" for="coach-question">Nachricht an den Coach</label>
          <textarea id="coach-question" rows="1" maxlength="2000" enterkeyhint="send" placeholder="Nachricht an den Coach">${escapeHtml(pending.question || '')}</textarea>
          <div class="coach-aufnahme" data-coach-aufnahme hidden>
            <button class="coach-aufnahme-weg" type="button" data-aufnahme-verwerfen aria-label="Aufnahme verwerfen">${materialIconMarkup('close', 'coach-eingabe-icon')}</button>
            <div class="coach-aufnahme-feld" aria-live="polite"><i class="coach-aufnahme-punkt" aria-hidden="true"></i><b data-aufnahme-zeit>0:00</b><span data-aufnahme-text>Aufnahme läuft</span></div>
          </div>
          <button class="coach-mikro" type="button" data-coach-mikro aria-label="Sprachnachricht aufnehmen">${materialIconMarkup('mic', 'coach-eingabe-icon')}</button>
          <button class="coach-send" type="submit" aria-label="Senden">${materialIconMarkup('arrow_forward_ios', 'coach-eingabe-icon')}</button>
        </div>
      </div>
    </form>
    <div class="coach-schwebe-grund" data-coach-schwebe-grund hidden></div>
    <div class="coach-mehr-menue coach-schwebe" data-coach-menue role="menu" aria-label="Mehr zur Antwort" hidden></div>
    <div class="coach-sheet-grund" data-coach-sheet-grund hidden></div>
    <section class="coach-sheet" data-coach-sheet role="dialog" aria-modal="true" aria-label="Quellen" tabindex="-1" hidden>
      <div class="coach-sheet-griff" data-coach-sheet-griff aria-hidden="true"><i></i></div>
      <div class="coach-sheet-inhalt" data-coach-sheet-inhalt></div>
    </section>
  </main>`;
  const answer = container.querySelector('[data-coach-answer]');
  const form = container.querySelector('[data-coach-form]');
  const field = form.querySelector('textarea');
  const neuesGespraech = container.querySelector('[data-neues-gespraech]');
  const tools = container.querySelector('[data-coach-tools]');
  const schwebeGrund = container.querySelector('[data-coach-schwebe-grund]');
  const mehrMenue = container.querySelector('[data-coach-menue]');
  const sheet = container.querySelector('[data-coach-sheet]');
  const sheetInhalt = container.querySelector('[data-coach-sheet-inhalt]');
  const sheetGriff = container.querySelector('[data-coach-sheet-griff]');
  const sheetGrund = container.querySelector('[data-coach-sheet-grund]');
  const plus = form.querySelector('[data-coach-plus]');
  const nachUntenKnopf = form.querySelector('[data-coach-nach-unten]');
  const dateiFelder = [...container.querySelectorAll('[data-coach-file]')];
  const webOption = container.querySelector('[data-coach-web]');
  const bewertungOption = container.querySelector('[data-coach-bewertung]');
  const attachmentBox = form.querySelector('[data-coach-attachment]');

  /* Modus: „Bewertung & Schritte“ schaltet man im Plus-Menü ein und aus wie
     „Intensiver nachdenken“ bei ChatGPT. Eingeschaltet zeigt eine kleine
     Pille auf der Ecke der Eingabe den Modus; ein Tipp darauf führt zurück zu
     „Frage“, dem Standard ohne Pille. */
  let modus = modusLesen();
  const PLATZHALTER = { frage: 'Frage an den Coach', bewertung: 'Bewertung anfordern' };
  const modusChip = form.querySelector('[data-coach-modus-chip]');
  const modusZeigen = () => {
    field.placeholder = PLATZHALTER[modus];
    modusChip.hidden = modus !== 'bewertung';
    bewertungOption.checked = modus === 'bewertung';
  };
  const modusSetzen = (neu) => {
    modus = neu === 'bewertung' ? 'bewertung' : 'frage';
    modusSchreiben(modus);
    modusZeigen();
  };
  bewertungOption.onchange = () => { modusSetzen(bewertungOption.checked ? 'bewertung' : 'frage'); werkzeugeZeigen(false); };
  webOption.onchange = () => werkzeugeZeigen(false);
  modusChip.onclick = () => modusSetzen('frage');
  modusZeigen();

  // Die Eingabe sitzt fest am unteren Rand; der Verlauf bekommt unten so viel
  // Platz, wie sie hoch ist. Öffnet sich die Tastatur, sitzt die Eingabe direkt
  // darauf. iOS schiebt dabei die ganze Seite hoch; das wird zurückgenommen,
  // damit der App-Kopf stehen bleibt. Wo das nicht greift, folgt er der
  // verschobenen Ansicht (--coach-oben).
  new ResizeObserver(() => container.style.setProperty('--coach-eingabe-h', `${form.offsetHeight}px`)).observe(form);
  const tastatur = () => {
    const sicht = window.visualViewport;
    if (!sicht || !container.isConnected) return;
    const offen = document.activeElement === field && sicht.height < window.innerHeight - 80;
    if (offen && window.scrollY) window.scrollTo(0, 0);
    container.style.setProperty('--coach-tastatur', `${Math.max(0, window.innerHeight - sicht.height - sicht.offsetTop)}px`);
    // Auf der Wurzel, damit auch der App-Kopf der verschobenen Ansicht folgt.
    document.documentElement.style.setProperty('--coach-oben', `${Math.max(0, sicht.offsetTop)}px`);
    container.classList.toggle('tastatur-offen', offen);
  };
  window.visualViewport?.addEventListener('resize', tastatur);
  window.visualViewport?.addEventListener('scroll', tastatur);
  // Wie bei Gemini wird die Kapsel schon beim Antippen breit, nicht erst,
  // wenn die Tastatur ganz steht; beim Verlassen des Feldes wieder schmal.
  field.addEventListener('focus', () => { menueSchliessen(); form.classList.add('ist-aktiv'); setTimeout(tastatur, 60); setTimeout(() => nachUnten(false), 320); });
  field.addEventListener('blur', () => { form.classList.remove('ist-aktiv'); setTimeout(tastatur, 60); });
  /* Bei aktivem Feld federt die Kapsel beim Antippen wie das Menüband beim
     Antippen eines Reiters: Rahmen und Fläche (::before) wachsen kurz, der
     Inhalt rückt mit (federn.js). Die Eck-Pille trägt ihre Lage in transform
     und bleibt deshalb stehen. */
  const kapsel = form.querySelector('.coach-inputbar');
  kapsel.addEventListener('pointerdown', () => {
    if (!form.classList.contains('ist-aktiv')) return;
    kapsel.classList.remove('ist-angetippt');
    void kapsel.offsetWidth;
    kapsel.classList.add('ist-angetippt');
    inhaltMitfedern(kapsel, [...kapsel.children].filter((element) => !element.matches('.coach-modus-chip')));
  });
  kapsel.addEventListener('animationend', () => kapsel.classList.remove('ist-angetippt'));
  const nachUnten = (sanft = true) => requestAnimationFrame(() => container.scrollTo({ top: container.scrollHeight, behavior: sanft ? 'smooth' : 'auto' }));
  /* Mitscrollen, solange eine Antwort einläuft – aber nur, solange man unten
     ist: Wer nach oben scrollt, um Älteres zu lesen, wird nicht gestört;
     wer wieder nach unten scrollt, ist wieder dabei. */
  /* Wie bei Gemini: Nach dem Senden rückt deine Frage nach oben, die Antwort
     läuft darunter ein. Erst wenn sie über den sichtbaren Bereich wächst,
     scrollt der Chat mit. Wischt oder scrollt man dabei selbst, hört das
     Mitlaufen für diese Antwort sofort auf. Damit die Frage oben stehen kann,
     bekommt der Verlauf darunter so viel Platz wie nötig (paddingBottom),
     und nur so viel. */
  let folgen = true;
  const selbstGescrollt = () => { folgen = false; };
  container.addEventListener('touchmove', selbstGescrollt, { passive: true });
  container.addEventListener('wheel', selbstGescrollt, { passive: true });
  const kopfAbstand = () => parseFloat(getComputedStyle(answer.closest('.coach-shell')).paddingTop) || 0;
  const sichtOben = () => container.getBoundingClientRect().top + kopfAbstand();
  const sichtUnten = () => form.getBoundingClientRect().top - 12;
  const letzteFrage = () => [...answer.querySelectorAll('.coach-chat-window.is-user')].at(-1);
  const platzAnpassen = () => {
    const frage = letzteFrage();
    if (!frage) return;
    const bisher = parseFloat(answer.style.paddingBottom) || 0;
    const darunter = answer.getBoundingClientRect().bottom - bisher - frage.getBoundingClientRect().top;
    answer.style.paddingBottom = `${Math.max(0, Math.round(sichtUnten() - sichtOben() - darunter))}px`;
  };
  const frageNachOben = () => {
    const frage = letzteFrage();
    if (!frage) return;
    platzAnpassen();
    container.scrollTo({ top: container.scrollTop + frage.getBoundingClientRect().top - sichtOben(), behavior: 'smooth' });
  };
  const mitlaufen = () => {
    platzAnpassen();
    if (!folgen) return;
    const ende = [...answer.children].filter((kind) => kind.offsetHeight).at(-1)?.getBoundingClientRect().bottom ?? 0;
    const ueber = ende - sichtUnten();
    if (ueber > 0) container.scrollTop += ueber;
  };
  // Neue Fenster (deine Nachricht, „Coach tippt“, die Antwort) gleiten ein.
  const neuMarkieren = (anzahl) => [...answer.querySelectorAll('.coach-chat-window')].slice(-anzahl)
    .forEach((fenster) => fenster.classList.add('ist-neu'));

  // Startnachricht eines leeren Chats: was gerade offen ist. Die Punkte laden
  // im Hintergrund und ersetzen dann nur die Startnachricht, wenn sie noch
  // zu sehen ist.
  const start = { punkte: null, fehler: false, neu: false };
  const startErneuern = () => {
    const fenster = answer.querySelector('.coach-welcome');
    if (fenster && !runden.length) fenster.outerHTML = startMarkup(start);
  };
  ladeOffenePunkte(userId)
    .then((punkte) => { start.punkte = punkte; })
    .catch((error) => { start.fehler = true; console.warn('Offene Punkte nicht geladen:', error?.message); })
    .finally(startErneuern);

  // Die Karte steht über dem Gespräch zum Coaching, im leeren Chat zeigt sie
  // das frische Coaching statt der Startnachricht. Ein laufendes oder
  // gescheitertes Coaching steht als Status über jedem Gespräch, sonst bliebe
  // ein Fehlschlag bei offenem älterem Gespräch unbemerkt.
  let karteAusgeblendet = false;
  const karteSichtbar = () => coaching?.status === 'bereit'
    && (gespraech?.id === coaching.id || (!runden.length && !karteAusgeblendet && istFrisch(coaching)));
  const statusSichtbar = () => Boolean(coaching) && coaching.status !== 'bereit' && !karteAusgeblendet && istFrisch(coaching);
  // Das Coaching sieht aus wie jede Coach-Nachricht (coaching.js).
  const kopf = () => (karteSichtbar() || statusSichtbar() ? coachingKarteMarkup(coaching) : '');
  const zeichnen = (zusatz = '') => {
    answer.innerHTML = kopf() + (runden.length ? verlaufMarkup(runden, avatar) : (karteSichtbar() ? '' : startMarkup(start))) + zusatz;
    if (karteSichtbar()) alsGelesenMarkieren(coaching);
  };
  /* Passt der Text nicht mehr in eine Zeile neben Plus und Mikro, wird die
     Kapsel zweizeilig wie bei Gemini. Gemessen wird an der Breite der
     einzeiligen Kapsel, damit sie nicht hin- und herspringt. */
  const messen = document.createElement('canvas').getContext('2d');
  const resizeField = () => {
    const stil = getComputedStyle(field);
    messen.font = `${stil.fontWeight} ${stil.fontSize} ${stil.fontFamily}`;
    // Ein leeres Feld bleibt einzeilig; ohne messbare Breite (Ansicht noch
    // nicht sichtbar) bleibt alles, wie es ist.
    if (!field.value) kapsel.classList.remove('ist-mehrzeilig');
    else if (kapsel.clientWidth) {
      const einzeilig = !field.value.includes('\n') && messen.measureText(field.value).width <= kapsel.clientWidth - 116;
      kapsel.classList.toggle('ist-mehrzeilig', !einzeilig);
    }
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 120)}px`;
    // Sobald Text im Feld steht, zeigt der gefüllte Senden-Knopf: abschickbar.
    form.classList.toggle('kann-senden', field.value.trim().length > 0);
  };
  field.addEventListener('input', resizeField);
  resizeField();
  field.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });
  const renderAttachment = () => {
    attachmentBox.hidden = !anhang;
    const vorschau = anhang?.art === 'bild' ? `<img src="${anhang.dataUrl}" alt="">` : materialIconMarkup('upload_file', 'coach-anhang-symbol');
    attachmentBox.innerHTML = anhang ? `${vorschau}<span>${escapeHtml(anhang.name)}</span><button type="button" data-remove-attachment aria-label="Anhang entfernen">×</button>` : '';
  };
  /* Kleine Menüs wie bei ChatGPT (Rückmeldung 08.10.): Plus und „…“ öffnen
     eine schwebende Fläche, ohne den Chat abzudunkeln. Ein Tipp daneben oder
     Escape schließt sie; der Tipp daneben löst sonst nichts aus. Das
     Plus-Menü sitzt über der Kapsel und wandert mit ihr. */
  let offenesMenue = null;
  let mehrKnopf = null;
  let mehrZiel = null;
  const menueSchliessen = () => {
    if (!offenesMenue) return;
    offenesMenue.classList.remove('ist-offen');
    offenesMenue.hidden = true;
    offenesMenue = null;
    schwebeGrund.hidden = true;
    form.classList.remove('menue-offen');
    plus.setAttribute('aria-expanded', 'false');
    mehrKnopf?.setAttribute('aria-expanded', 'false');
    mehrKnopf = null;
  };
  const menueOeffnen = (menue) => {
    menueSchliessen();
    offenesMenue = menue;
    menue.hidden = false;
    schwebeGrund.hidden = false;
    requestAnimationFrame(() => menue.classList.add('ist-offen'));
  };
  const werkzeugeZeigen = (offen) => {
    if (!offen) {
      if (offenesMenue === tools) menueSchliessen();
      return;
    }
    field.blur();
    menueOeffnen(tools);
    form.classList.add('menue-offen');
    plus.setAttribute('aria-expanded', 'true');
  };
  plus.onclick = () => werkzeugeZeigen(offenesMenue !== tools);
  schwebeGrund.onclick = menueSchliessen;
  // Nach dem Antippen von Kamera, Fotos oder Dateien geht das Menü zu; erst
  // im nächsten Takt, damit sich die Auswahl des Geräts noch öffnet.
  dateiFelder.forEach((feld) => feld.addEventListener('click', () => window.setTimeout(menueSchliessen, 0)));

  /* Quellen: Liste von unten wie bei ChatGPT, mit Seitensymbol, Seite und
     Titel. Schließen per Tipp daneben, Escape oder Herunterziehen am Griff. */
  let sheetTimer = 0;
  const sheetZeigen = (offen) => {
    if (offen === !sheet.hidden && offen === sheet.classList.contains('ist-offen')) return;
    window.clearTimeout(sheetTimer);
    sheet.style.transform = '';
    if (offen) {
      field.blur();
      sheet.hidden = false;
      sheetGrund.hidden = false;
      sheetInhalt.scrollTop = 0;
      // Erst sichtbar machen, dann im nächsten Bild hereingleiten lassen.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        sheet.classList.add('ist-offen');
        sheetGrund.classList.add('ist-offen');
        sheet.focus({ preventScroll: true });
      }));
      return;
    }
    sheet.classList.remove('ist-offen');
    sheetGrund.classList.remove('ist-offen');
    // Nach dem Hinausgleiten ganz ausblenden (Dauer wie im CSS).
    sheetTimer = window.setTimeout(() => {
      sheet.hidden = true;
      sheetGrund.hidden = true;
    }, 320);
  };
  const quellenZeigen = (quellen) => {
    if (!hatQuellen(quellen)) return;
    sheetInhalt.innerHTML = quellenSheetMarkup(quellen);
    sheetZeigen(true);
  };
  sheetGrund.onclick = () => sheetZeigen(false);
  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (offenesMenue) {
      const warPlus = offenesMenue === tools;
      menueSchliessen();
      if (warPlus) plus.focus({ preventScroll: true });
    } else if (!sheet.hidden) sheetZeigen(false);
  });
  // Lädt ein Seitensymbol nicht, steht dort der Anfangsbuchstabe der Seite.
  container.addEventListener('error', (event) => {
    const bild = event.target;
    if (!(bild instanceof HTMLImageElement) || !bild.classList.contains('coach-quelle-bild')) return;
    const ersatz = document.createElement('span');
    ersatz.className = 'coach-quelle-bild ist-zeichen';
    ersatz.textContent = bild.dataset.zeichen || '•';
    bild.replaceWith(ersatz);
  }, true);

  /* Herunterziehen am Griff schließt die Liste: Sie folgt dem Finger nach
     unten (nach oben nur gebremst); ab einem Viertel der Höhe oder bei
     schnellem Wischen schließt sie, sonst federt sie zurück. */
  let zug = null;
  sheetGriff.addEventListener('pointerdown', (event) => {
    if (event.button > 0) return;
    zug = { start: event.clientY, zeit: performance.now(), weg: 0, id: event.pointerId };
    sheetGriff.setPointerCapture(event.pointerId);
    sheet.classList.add('wird-gezogen');
  });
  sheetGriff.addEventListener('pointermove', (event) => {
    if (!zug || event.pointerId !== zug.id) return;
    const weg = event.clientY - zug.start;
    zug.weg = weg > 0 ? weg : weg / 4;
    sheet.style.transform = `translateY(${zug.weg}px)`;
  });
  const zugEnde = (event) => {
    if (!zug || event.pointerId !== zug.id) return;
    const tempo = zug.weg / Math.max(1, performance.now() - zug.zeit);
    const weit = zug.weg > sheet.offsetHeight / 4 || tempo > 0.6;
    zug = null;
    sheet.classList.remove('wird-gezogen');
    sheet.style.transform = '';
    if (weit) sheetZeigen(false);
  };
  sheetGriff.addEventListener('pointerup', zugEnde);
  sheetGriff.addEventListener('pointercancel', zugEnde);
  dateiFelder.forEach((feld) => {
    feld.onchange = async () => {
      try {
        anhang = await dateiAnhang(feld.files?.[0]);
        renderAttachment();
        werkzeugeZeigen(false);
      } catch (error) { toast(error?.message || 'Anhang konnte nicht geladen werden.'); }
      feld.value = '';
    };
  });
  attachmentBox.onclick = (event) => {
    if (!event.target.closest('[data-remove-attachment]')) return;
    anhang = null;
    renderAttachment();
  };

  zeichnen();
  resizeField();
  nachUnten(false);

  neuesGespraech.onclick = () => {
    werkzeugeZeigen(false);
    // Ein neues Gespräch beginnt leer, ohne die Coaching-Karte.
    karteAusgeblendet = true;
    gespraech = null;
    runden = [];
    gespraechSchreiben(null);
    neuesGespraech.hidden = true;
    answer.style.paddingBottom = '';
    start.neu = true;
    answer.innerHTML = startMarkup(start);
    field.focus();
  };

  /* Leiste unter einer Antwort (chatLeiste.js): Kopieren (kurz ein Haken),
     Teilen (Teilen-Menü des Geräts, sonst Kopieren), „…“ und „Quellen“. Das
     Coaching hat dieselbe Leiste. */
  const eintragZu = (element) => {
    if (element.closest('.coaching-karte')) {
      if (coaching?.status !== 'bereit') return null;
      return { schluessel: `coaching:${coaching.id}`, text: coachingText(coaching), kopf: coachingKopf(coaching), quellen: coachingQuellen(coaching), schritte: false };
    }
    const index = Number(element.closest('[data-runde]')?.dataset.runde);
    const runde = runden[index];
    if (!runde?.result) return null;
    return {
      schluessel: `runde:${index}:${runde.zeit || runde.frage}`,
      index,
      text: antwortText(runde.result),
      kopf: antwortKopf(runde),
      quellen: quellenAus(runde.result),
      schritte: !runde.schritteGemacht && Boolean(schritteAnfrage(runde)),
    };
  };
  // Vorlesen mit der Stimme des Geräts; erneut antippen beendet es.
  let vorlesenBei = null;
  const vorlesen = (eintrag) => {
    const sprache = window.speechSynthesis;
    if (!sprache || typeof SpeechSynthesisUtterance === 'undefined') { toast('Vorlesen geht auf diesem Gerät nicht.'); return; }
    const lief = vorlesenBei === eintrag.schluessel;
    sprache.cancel();
    vorlesenBei = null;
    if (lief || !eintrag.text) return;
    const satz = new SpeechSynthesisUtterance(eintrag.text);
    satz.lang = 'de-DE';
    satz.onend = () => { if (vorlesenBei === eintrag.schluessel) vorlesenBei = null; };
    vorlesenBei = eintrag.schluessel;
    sprache.speak(satz);
  };
  const kopieren = async (knopf, text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast('Kopieren geht hier gerade nicht.');
      return false;
    }
    if (knopf?.dataset.aktion === 'kopieren') {
      knopf.innerHTML = symbol('haken');
      window.setTimeout(() => { knopf.innerHTML = symbol('kopieren'); }, 1600);
    } else toast('Kopiert.');
    return true;
  };
  // „…“: Menü unter dem Knopf, ohne Platz darunter darüber; nie über den Rand.
  const mehrZeigen = (knopf, eintrag) => {
    if (offenesMenue === mehrMenue && mehrKnopf === knopf) { menueSchliessen(); return; }
    mehrMenue.innerHTML = menueMarkup({ kopf: eintrag.kopf, vorlesen: vorlesenBei === eintrag.schluessel, quellen: hatQuellen(eintrag.quellen), schritte: eintrag.schritte });
    menueOeffnen(mehrMenue);
    mehrKnopf = knopf;
    mehrZiel = eintrag;
    knopf.setAttribute('aria-expanded', 'true');
    const rand = 12;
    const ort = knopf.getBoundingClientRect();
    const breite = mehrMenue.offsetWidth;
    const hoehe = mehrMenue.offsetHeight;
    const links = Math.min(Math.max(rand, ort.left), window.innerWidth - breite - rand);
    const darunter = ort.bottom + 6 + hoehe <= form.getBoundingClientRect().top - 8;
    mehrMenue.style.left = `${links}px`;
    mehrMenue.style.top = `${darunter ? ort.bottom + 6 : Math.max(rand, ort.top - hoehe - 6)}px`;
    mehrMenue.style.transformOrigin = `${Math.round(ort.left + ort.width / 2 - links)}px ${darunter ? 0 : hoehe}px`;
  };
  mehrMenue.addEventListener('click', (event) => {
    const punkt = event.target.closest('[data-menue]');
    const eintrag = mehrZiel;
    if (!punkt || !eintrag) return;
    menueSchliessen();
    const art = punkt.dataset.menue;
    if (art === 'vorlesen') vorlesen(eintrag);
    else if (art === 'quellen') quellenZeigen(eintrag.quellen);
    else if (art === 'schritte') {
      const anfrage = schritteAnfrage(runden[eintrag.index]);
      if (anfrage && !laeuft) senden({ ...anfrage, quelle: eintrag.index });
    }
  });

  /* Pfeil über der Kapsel wie bei ChatGPT: erscheint, sobald man ein Stück
     nach oben gescrollt hat, und führt zurück ans Ende. Scrollen schließt
     ein offenes „…“-Menü. */
  const nachUntenPruefen = () => {
    nachUntenKnopf.hidden = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
  };
  container.addEventListener('scroll', () => {
    nachUntenPruefen();
    if (offenesMenue === mehrMenue) menueSchliessen();
  }, { passive: true });
  nachUntenKnopf.onclick = () => {
    folgen = true;
    nachUnten();
  };

  answer.addEventListener('click', async (event) => {
    const aktion = event.target.closest('[data-aktion]');
    if (aktion) {
      const eintrag = eintragZu(aktion);
      if (!eintrag) return;
      const art = aktion.dataset.aktion;
      if (art === 'mehr') mehrZeigen(aktion, eintrag);
      else if (art === 'quellen') quellenZeigen(eintrag.quellen);
      else if (art === 'teilen' && navigator.share) { try { await navigator.share({ text: eintrag.text }); } catch {} }
      else kopieren(aktion, eintrag.text);
      return;
    }
    const vorschlag = event.target.closest('[data-vorschlag]');
    if (vorschlag) {
      field.value = vorschlag.dataset.vorschlag;
      resizeField();
      form.requestSubmit();
      return;
    }
    // Wochen-Coaching: Urteil oder neues Experiment über dieselben Wege wie im
    // Chat übernehmen; nichts wird automatisch gestartet oder beendet.
    const urteilKnopf = event.target.closest('[data-coaching-urteil]');
    const experimentKnopf = event.target.closest('[data-coaching-experiment]');
    if ((urteilKnopf || experimentKnopf) && coaching?.ergebnis) {
      const knopf = urteilKnopf || experimentKnopf;
      const index = Number(urteilKnopf ? urteilKnopf.dataset.coachingUrteil : experimentKnopf.dataset.coachingExperiment);
      const eintrag = urteilKnopf ? coaching.ergebnis.experimente?.[index] : coaching.ergebnis.neuesExperiment?.[index];
      if (!eintrag) return;
      knopf.disabled = true;
      try {
        if (urteilKnopf) await uebernimmAuswertung(userId, eintrag);
        else await merkeEmpfehlung(userId, eintrag);
        alsUebernommenMerken(coaching.id, `${urteilKnopf ? 'urteil' : 'experiment'}:${index}`);
        knopf.textContent = urteilKnopf ? 'Ergebnis übernommen' : 'Gemerkt';
        toast(urteilKnopf ? 'Übernommen.' : 'Gemerkt. Am Prüfdatum wertet der Coach das Experiment aus.');
      } catch (error) {
        knopf.disabled = false;
        toast(istNichtEingerichtet(error) ? 'Das Gedächtnis ist noch nicht eingerichtet.' : (error?.message || 'Konnte nicht übernommen werden.'));
      }
      return;
    }
    const rundenIndex = Number(event.target.closest('[data-runde]')?.dataset.runde);
    const ergebnis = runden[rundenIndex]?.result;
    const auswertungsKnopf = event.target.closest('[data-auswertung-uebernehmen]');
    const auswertung = auswertungsKnopf && ergebnis?.experimentReviews?.[Number(auswertungsKnopf.dataset.auswertungUebernehmen)];
    if (auswertung) {
      auswertungsKnopf.disabled = true;
      try {
        await uebernimmAuswertung(userId, auswertung);
        auswertungsKnopf.textContent = 'Ergebnis übernommen';
        toast(auswertung.decision === 'beibehalten'
          ? 'Übernommen. Ein neues Prüfdatum setzt du unter „Was der Coach über mich weiß“.'
          : auswertung.decision === 'anpassen'
            ? 'Übernommen. Der bisherige Versuch ist abgeschlossen; die angepasste Variante startest du als neues Experiment.'
            : 'Übernommen, das Experiment ist abgeschlossen.');
      } catch (error) {
        auswertungsKnopf.disabled = false;
        toast(istNichtEingerichtet(error) ? 'Das Gedächtnis ist noch nicht eingerichtet.' : (error?.message || 'Konnte nicht übernommen werden.'));
      }
      return;
    }
    const knopf = event.target.closest('[data-empfehlung-merken]');
    const empfehlung = knopf && ergebnis?.recommendations?.[Number(knopf.dataset.empfehlungMerken)];
    if (!empfehlung) return;
    knopf.disabled = true;
    try {
      await merkeEmpfehlung(userId, empfehlung);
      knopf.textContent = empfehlung.kind === 'experiment' ? 'Als Experiment gemerkt' : 'Als Maßnahme gemerkt';
      toast(empfehlung.kind === 'experiment' && empfehlung.reviewDate
        ? 'Gemerkt. Am Prüfdatum wertet der Coach das Experiment aus.'
        : 'Gemerkt. Prüfdatum und Ergebnis trägst du unter „Was der Coach über mich weiß“ ein.');
    } catch (error) {
      knopf.disabled = false;
      toast(istNichtEingerichtet(error) ? 'Das Gedächtnis ist noch nicht eingerichtet.' : (error?.message || 'Konnte nicht gemerkt werden.'));
    }
  });

  // Wochenrückblick (Schritt 5 des Coaching-Plans): von Sonntag bis Montag
  // 21 Uhr ein freiwilliges Kärtchen ohne KI-Aufruf. Die Bilanz selbst kommt
  // automatisch als Wochen-Coaching am Montag um 21 Uhr.
  mountWochenKaertchen(container.querySelector('[data-coach-woche]'), { userId });

  /* Sprachnachricht: Mikrofon antippen, sprechen, mit dem Pfeil senden. Die
     Aufnahme wird verschriftlicht (Edge Function ki-werkzeuge) und geht dann
     wie getippter Text an den Coach; die Nachricht im Verlauf zeigt, was
     verstanden wurde. Das Mikrofon steht nur bei leerem Feld da. */
  const mikro = form.querySelector('[data-coach-mikro]');
  const aufnahmeBox = form.querySelector('[data-coach-aufnahme]');
  const aufnahmeUhr = form.querySelector('[data-aufnahme-zeit]');
  const aufnahmeText = form.querySelector('[data-aufnahme-text]');
  let aufnahme = null;
  const aufnahmeZeigen = (zustand) => {
    form.classList.toggle('nimmt-auf', zustand !== null);
    form.classList.toggle('verschriftlicht', zustand === 'verschriftlicht');
    aufnahmeBox.hidden = zustand === null;
    aufnahmeText.textContent = zustand === 'verschriftlicht' ? 'Wird verschriftlicht …' : 'Aufnahme läuft';
    form.querySelector('button[type="submit"]').disabled = zustand === 'verschriftlicht';
  };
  const aufnahmeVerwerfen = () => {
    const laufend = aufnahme;
    if (!laufend) return;
    aufnahme = null;
    window.clearInterval(laufend.uhr);
    laufend.steuerung.verwerfen();
    aufnahmeZeigen(null);
  };
  const aufnahmeSenden = async () => {
    const laufend = aufnahme;
    if (!laufend) return;
    aufnahme = null;
    window.clearInterval(laufend.uhr);
    aufnahmeZeigen('verschriftlicht');
    const datei = await laufend.steuerung.stoppen();
    if (!datei) {
      aufnahmeZeigen(null);
      toast('Die Aufnahme war zu kurz.');
      return;
    }
    try {
      const text = await spracheVerschriftlichen(datei);
      aufnahmeZeigen(null);
      if (!container.isConnected) return;
      if (text.length < 2) {
        toast('In der Aufnahme war nichts zu verstehen.');
        return;
      }
      field.value = text;
      resizeField();
      form.requestSubmit();
    } catch (error) {
      aufnahmeZeigen(null);
      toast(error?.message || 'Die Aufnahme konnte nicht verschriftlicht werden.');
    }
  };
  mikro.onclick = async () => {
    if (aufnahme || form.classList.contains('verschriftlicht')) return;
    if (!spracheMoeglich()) {
      toast('Sprachnachrichten werden auf diesem Gerät nicht unterstützt.');
      return;
    }
    let steuerung;
    try {
      steuerung = await aufnahmeStarten();
    } catch {
      toast('Mikrofon konnte nicht geöffnet werden.');
      return;
    }
    aufnahme = { steuerung, uhr: 0 };
    // Verlässt man den Chat, endet die Aufnahme, sonst bliebe das Mikrofon an.
    aufnahme.uhr = window.setInterval(() => {
      if (!container.isConnected) { aufnahmeVerwerfen(); return; }
      aufnahmeUhr.textContent = aufnahmeZeit(steuerung.dauer());
      if (steuerung.dauer() >= AUFNAHME_MAX_MS) aufnahmeSenden();
    }, 250);
    field.blur();
    werkzeugeZeigen(false);
    aufnahmeUhr.textContent = '0:00';
    aufnahmeZeigen('laeuft');
  };
  form.querySelector('[data-aufnahme-verwerfen]').onclick = aufnahmeVerwerfen;

  /* Eine Anfrage an den Coach: getippte Nachricht im gewählten Modus oder
     „Daraus Schritte machen“ zu einer Frage-Antwort (quelle = ihre Runde).
     Die Schritte-Anfrage lässt Eingabefeld und Bildanhang unberührt. */
  let laeuft = false;
  const senden = async ({ question, modus: anfrageModus, schritteAus = null, quelle = null }) => {
    if (laeuft) return;
    laeuft = true;
    window.speechSynthesis?.cancel();
    vorlesenBei = null;
    menueSchliessen();
    const webResearch = webOption.checked;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const mitAnhang = !schritteAus && Boolean(anhang);
    const bezug = schritteAus?.frage || '';
    if (!schritteAus) {
      field.value = '';
      resizeField();
    }
    werkzeugeZeigen(false);
    answer.innerHTML = kopf() + verlaufMarkup(runden, avatar)
      + fensterMarkup({ von: 'user', avatar, inhalt: nutzerText(question, mitAnhang ? anhangHinweis(anhang) : '', bezug) })
      + tipptMarkup((webResearch ? LADEPHASEN.web : LADEPHASEN.coach)[0]);
    neuMarkieren(2);
    const ladephasenStoppen = ladephasenStarten(answer, webResearch ? LADEPHASEN.web : LADEPHASEN.coach);
    folgen = true;
    requestAnimationFrame(frageNachOben);
    let eingeblendet = false;
    try {
      // Steht die Coaching-Karte über einem leeren Chat, gehört die Frage zu ihr.
      const gespraechsId = gespraech?.id || (karteSichtbar() && coaching.status === 'bereit' ? coaching.id : null);
      const response = await rufeCoach({
        scope: 'coach', question, webResearch, modus: anfrageModus,
        ...(gespraechsId ? { conversationId: gespraechsId } : {}),
        ...(mitAnhang ? { attachments: [anhangFuerServer(anhang)] } : {}),
        ...(schritteAus ? { schritteAus } : {}),
      });
      // Nur wenn der Server die Runde gespeichert hat, gibt es ein
      // Gespräch, an das die nächste Frage anschließen kann. Eine Antwort,
      // aus der Schritte gemacht wurden, zeigt den Knopf nicht mehr.
      const frueher = gespraech?.id === response.conversationId
        ? runden.map((runde, index) => (index === quelle ? { ...runde, schritteGemacht: true } : runde)) : [];
      const runde = { frage: question, zeit: new Date().toISOString(), result: response.result, ...(mitAnhang ? { anhang: anhangHinweis(anhang) } : {}), ...(bezug ? { bezug } : {}) };
      if (response.conversationId && response.memorySaved) {
        runden = [...frueher, runde].slice(-8);
        gespraech = { id: response.conversationId, runden };
        gespraechSchreiben(gespraech);
        neuesGespraech.hidden = false;
      } else {
        runden = [runde];
      }
      zeichnen();
      const neu = answer.querySelector(`.coach-chat-window[data-runde="${runden.length - 1}"]`);
      neu?.classList.add('ist-neu');
      antwortEinblenden(neu, mitlaufen);
      eingeblendet = true;
      mitlaufen();
      if (mitAnhang) {
        anhang = null;
        renderAttachment();
      }
    } catch (error) {
      if (!schritteAus) {
        field.value = question;
        resizeField();
      }
      zeichnen(fehlerMarkup(schritteAus
        ? 'Keine Schritte erstellt. Versuche es gleich noch einmal.'
        : 'Keine Antwort erstellt. Deine Frage steht wieder im Eingabefeld; versuche es gleich noch einmal.'));
      toast(error?.message || 'Coach konnte nicht antworten.');
    } finally {
      laeuft = false;
      ladephasenStoppen();
      button.disabled = false;
      if (!eingeblendet) {
        answer.style.paddingBottom = '';
        nachUnten();
      }
    }
  };

  form.onsubmit = (event) => {
    event.preventDefault();
    // Während der Aufnahme sendet der Pfeil die Sprachnachricht.
    if (aufnahme) { aufnahmeSenden(); return; }
    if (form.classList.contains('verschriftlicht')) return;
    const question = field.value.trim();
    if (question.length < 2) return;
    senden({ question, modus });
  };

  if (pending.question && pending.senden) form.requestSubmit();
}
