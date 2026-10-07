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
import { sanduhrMarkup } from './sanduhr.js';
import { ladeOffenePunkte, startMarkup } from './coachStatus.js';
import { alsGelesenMarkieren, alsUebernommenMerken, coachingKarteMarkup, istFrisch, neuestesCoaching } from './coaching.js';

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

function safeExternalUrl(value = '') {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

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

// Eine Empfehlung; seit Schritt 6 mit Art und bei Experimenten mit
// Hypothese, Ausgangswert, Zielgröße und Prüfdatum. Ältere Antworten ohne
// diese Felder erscheinen wie bisher.
function empfehlungMarkup(item, index, merken) {
  const art = ART[item.kind] ? item.kind : null;
  const experiment = art === 'experiment';
  const ziel = item.targetMetric && item.targetMetric !== 'keine' ? bezeichnung(ZIELGROESSEN, item.targetMetric) : '';
  const richtung = item.expectedDirection && item.expectedDirection !== 'keine' ? bezeichnung(RICHTUNGEN, item.expectedDirection) : '';
  const details = experiment ? [
    item.hypothesis ? `<p><em>Hypothese:</em> ${escapeHtml(readableModelText(item.hypothesis))}</p>` : '',
    item.baseline ? `<p><em>Ausgangswert:</em> ${escapeHtml(readableModelText(item.baseline))}</p>` : '',
    ziel ? `<p><em>Zielgröße:</em> ${escapeHtml(ziel)}${richtung ? ` – ${escapeHtml(richtung)}` : ''}</p>` : '',
  ].join('') : '';
  const pruefen = experiment && tagDatum(item.reviewDate) ? ` · prüfen am ${tagDatum(item.reviewDate)}` : '';
  const knopf = merken && art !== 'sicherheit'
    ? `<button class="coach-merken" type="button" data-empfehlung-merken="${index}">${experiment ? 'Als Experiment merken' : 'Als Maßnahme merken'}</button>` : '';
  return `<article class="coach-schritt${art ? ` ist-${art}` : ''}">${art ? `<span class="coach-art">${ART[art]}${pruefen}</span>` : ''}<b>${escapeHtml(readableModelText(item.action))}</b><p>${escapeHtml(readableModelText(item.rationale))}</p>${details}<small>${escapeHtml(readableModelText(item.timeframe))}</small>${knopf}</article>`;
}

// Auswertungen fälliger Experimente (Schritt 6).
function auswertungenMarkup(auswertungen = [], merken = false) {
  if (!auswertungen.length) return '';
  return `<section class="coach-schritte"><h4>Auswertung deiner Experimente</h4>${auswertungen.map((item, index) => `<article class="coach-schritt"><span class="coach-art">${escapeHtml(bezeichnung(URTEILE, item.verdict))} · ${escapeHtml(bezeichnung(ENTSCHEIDUNGEN, item.decision))}</span><p>${escapeHtml(readableModelText(item.basis))}</p>${merken ? `<button class="coach-merken" type="button" data-auswertung-uebernehmen="${index}">Ergebnis übernehmen</button>` : ''}</article>`).join('')}</section>`;
}

const liste = (eintraege) => `<ul>${eintraege.map((item) => `<li>${escapeHtml(readableModelText(item))}</li>`).join('')}</ul>`;

// Etikett jeder Antwort: Der Modus steht als Wort da, die Farbe unterstützt.
export const modusMarke = (modus) => `<span class="coach-modus-marke ist-${modus}">${escapeHtml(MODI[modus])}</span>`;

function webQuellen(result) {
  return (result.webSources || []).flatMap((source) => {
    const url = safeExternalUrl(source?.url);
    return url ? [{ title: source?.title || new URL(url).hostname, url, zitiert: source?.zitiert === true }] : [];
  }).slice(0, 8);
}
const webLink = (source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>`;

const DATEN_BEREICHE = {
  koerper: 'Körper', training: 'Training', ernaehrung: 'Ernährung', schlaf: 'Schlaf', erholung: 'Erholung', routinen: 'Routinen',
};
// Worauf eine Antwort beruht – statt der früheren „Datenlage“: deine Daten,
// Seminar, Web, Fachwissen. Quelle ist nur, was nachweislich einging: Seminar-
// dokumente prüft der Server gegen das, was file_search geliefert hat; Web
// nur, wenn die Antwort die Seite zitiert. Bloße Suchtreffer stehen getrennt
// und zugeklappt als „Recherchetreffer“. Bei einer Bewertung leitet der Server
// die Quellen aus dem Text ab (ownData ohne Bereiche); ältere Antworten
// haben keine.
function quellenMarkup(result) {
  const quellen = result.sources || {};
  const daten = (quellen.userData || []).flatMap((bereich) => (DATEN_BEREICHE[bereich] ? [DATEN_BEREICHE[bereich]] : []));
  const seminar = (quellen.seminar || []).map((titel) => escapeHtml(titel));
  const web = webQuellen(result);
  const zitiert = web.filter((source) => source.zitiert);
  const treffer = web.filter((source) => !source.zitiert);
  const zeilen = [
    daten.length ? `Deine Daten: ${escapeHtml(daten.join(', '))}` : (quellen.ownData ? 'Deine Daten' : ''),
    seminar.length ? `Seminar: ${seminar.join(', ')}` : '',
    zitiert.length ? `Web: ${zitiert.map(webLink).join(', ')}` : '',
    quellen.generalKnowledge ? 'Allgemeines Fachwissen' : '',
  ].filter(Boolean);
  return `${zeilen.length ? `<div class="coach-quellen"><b>Quellen</b><ul>${zeilen.map((zeile) => `<li>${zeile}</li>`).join('')}</ul></div>` : ''}
    ${treffer.length ? `<details class="coach-mehr coach-web-sources"><summary>Recherchetreffer</summary><p>Bei der Websuche gefunden. Nicht jeder Treffer floss in die Antwort ein.</p><ul>${treffer.map((source) => `<li>${webLink(source)}</li>`).join('')}</ul></details>` : ''}
    ${result.webResearchRequested && !web.length ? '<small class="coach-web-status">Keine Webquelle verwendet</small>' : ''}`;
}

// Frage-Antwort (Schritt 4b): nur der Text, keine Karten. „Daraus Schritte
// machen“ steht nur da, wo die Antwort zu etwas führt, das man tun kann
// (stepsUseful), und fragt erst beim Antippen eine Bewertung an.
function frageMarkup(result, { merken = false, schritteGemacht = false } = {}) {
  return `<div class="coach-result ist-frage">
    ${modusMarke('frage')}
    <p class="coach-antwort">${escapeHtml(readableModelText(result.answer || ''))}</p>
    ${result.safetyNote ? `<p class="coach-safety">${escapeHtml(readableModelText(result.safetyNote))}</p>` : ''}
    ${result.followUpQuestion ? `<p class="coach-rueckfrage">${escapeHtml(readableModelText(result.followUpQuestion))}</p>` : ''}
    ${quellenMarkup(result)}
    ${merken && result.stepsUseful === true && !schritteGemacht ? '<button class="coach-knopf ist-schritte" type="button" data-schritte-aus>Daraus Schritte machen</button>' : ''}
  </div>`;
}

// Eine Antwort als Chatnachricht: zuerst die Antwort selbst, dann was zu tun
// ist; Daten, Einordnung und Unsicherheiten stehen zugeklappt darunter.
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
    ${modusMarke('bewertung')}
    <p class="coach-antwort">${escapeHtml(readableModelText(result.summary || ''))}</p>
    ${result.safetyNote ? `<p class="coach-safety">${escapeHtml(readableModelText(result.safetyNote))}</p>` : ''}
    ${auswertungenMarkup((result.experimentReviews || []).slice(0, 5), merken)}
    ${recommendations.length ? `<section class="coach-schritte"><h4>Nächste Schritte</h4>${recommendations.map((item, index) => empfehlungMarkup(item, index, merken)).join('')}</section>` : ''}
    ${mehr ? `<details class="coach-mehr"><summary>Daten &amp; Einordnung</summary>${mehr}</details>` : ''}
    ${quellenMarkup(result)}
  </div>`;
}

const kurz = (text, grenze) => (text.length > grenze ? `${text.slice(0, grenze - 1)}…` : text);
// bezug: bei „Daraus Schritte machen“ die Frage, zu der die Schritte gehören.
const nutzerText = (text, hatAnhang = false, bezug = '') => `<p>${escapeHtml(text)}</p>${bezug ? `<small>zu „${escapeHtml(kurz(bezug, 80))}“</small>` : ''}${hatAnhang ? '<small>Bild angehängt</small>' : ''}`;

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
  return runden.map((runde, index) => fensterMarkup({ von: 'user', avatar, inhalt: nutzerText(runde.frage, runde.hatAnhang, runde.bezug) })
    + fensterMarkup({ runde: index, inhalt: `${runde.weekly ? vergleichMarkup(runde.weekly) : ''}${resultMarkup(runde.result, { merken: true, schritteGemacht: runde.schritteGemacht })}` })).join('');
}

const tipptMarkup = (text) => fensterMarkup({ klasse: 'is-loading', inhalt: `<p class="coach-tippt" role="status">${sanduhrMarkup()}<span data-coach-ladestatus>${escapeHtml(text)}</span></p>` });
const LADEPHASEN = {
  coach: ['Coach ordnet deine Daten', 'Coach prüft das Seminarwissen', 'Coach formuliert die Antwort'],
  web: ['Coach ordnet deine Daten', 'Coach prüft das Seminarwissen', 'Coach recherchiert im Web', 'Coach gleicht die Quellen ab', 'Coach formuliert die Antwort'],
  woche: ['Coach ordnet deine Woche', 'Coach vergleicht deine Entwicklungen', 'Coach prüft laufende Experimente', 'Coach formuliert die Bilanz'],
};
function ladephasenStarten(container, phasen) {
  const status = container.querySelector('[data-coach-ladestatus]');
  if (!status || phasen.length < 2) return () => {};
  let index = 0;
  const timer = window.setInterval(() => {
    index = Math.min(index + 1, phasen.length - 1);
    status.textContent = phasen[index];
    if (index === phasen.length - 1) window.clearInterval(timer);
  }, 3200);
  return () => window.clearInterval(timer);
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
  // Zurück und Gedächtnis sitzen im App-Kopf (main.js); ein neues Gespräch
  // beginnt über das Plus-Menü der Eingabe.
  container.innerHTML = `<main class="coach-shell coach-chat">
    <section class="coach-answer" data-coach-answer aria-live="polite"></section>
    <section class="coach-woche" data-coach-woche hidden></section>
    <form class="coach-form" data-coach-form>
      <div class="coach-form-innen">
        <div class="coach-compose-tools coach-menue" data-coach-tools hidden>
          <label class="coach-menue-zeile"><span class="coach-menue-symbol ist-foto">${materialIconMarkup('add_photo_alternate')}</span><span>Foto anhängen</span><input type="file" accept="image/*" data-coach-file></label>
          <label class="coach-menue-zeile"><span class="coach-menue-symbol ist-web">${materialIconMarkup('search')}</span><span>Webwissen</span><input type="checkbox" role="switch" data-coach-web checked><i class="coach-menue-schalter" aria-hidden="true"></i></label>
          <button class="coach-menue-zeile" type="button" data-neues-gespraech${gespraech ? '' : ' hidden'}><span class="coach-menue-symbol ist-neu">${materialIconMarkup('edit')}</span><span>Neues Gespräch</span></button>
          <div class="coach-menue-modi" role="radiogroup" aria-label="Modus">
            ${Object.entries(MODI).map(([wert, text]) => `<label class="coach-menue-zeile"><span class="coach-menue-symbol ist-${wert}">${wert === 'frage' ? '<b>?</b>' : materialIconMarkup('target')}</span><span>${escapeHtml(text)}</span><input type="radio" name="coach-modus" value="${wert}" data-coach-modus-wahl><i class="coach-menue-haken" aria-hidden="true">${materialIconMarkup('check_small')}</i></label>`).join('')}
          </div>
        </div>
        <div class="coach-attachment" data-coach-attachment hidden></div>
        <div class="coach-inputbar">
          <button class="coach-modus" type="button" data-coach-modus></button>
          <button class="coach-plus" type="button" data-coach-plus aria-expanded="false" aria-label="Foto, Webwissen, neues Gespräch oder Modus"><span class="material-svg coach-eingabe-icon" aria-hidden="true">${plusSvg}</span></button>
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
  </main>`;
  const answer = container.querySelector('[data-coach-answer]');
  const form = container.querySelector('[data-coach-form]');
  const field = form.querySelector('textarea');
  const neuesGespraech = form.querySelector('[data-neues-gespraech]');
  const tools = form.querySelector('[data-coach-tools]');
  const plus = form.querySelector('[data-coach-plus]');
  const fileInput = form.querySelector('[data-coach-file]');
  const webOption = form.querySelector('[data-coach-web]');
  const attachmentBox = form.querySelector('[data-coach-attachment]');
  plus.classList.add('hat-web');

  // Modus: Das Kennzeichen an der Eingabe zeigt ihn und schaltet per Tipp um;
  // im Plus-Menü steht dieselbe Wahl.
  let modus = modusLesen();
  const modusKnopf = form.querySelector('[data-coach-modus]');
  const modusZeigen = () => {
    const anderer = modus === 'frage' ? 'bewertung' : 'frage';
    modusKnopf.className = `coach-modus ist-${modus}`;
    modusKnopf.textContent = MODI[modus];
    modusKnopf.setAttribute('aria-label', `Modus: ${MODI[modus]}. Antippen wechselt zu ${MODI[anderer]}.`);
    form.querySelectorAll('[data-coach-modus-wahl]').forEach((wahl) => { wahl.checked = wahl.value === modus; });
  };
  const modusSetzen = (neu) => {
    modus = neu === 'bewertung' ? 'bewertung' : 'frage';
    modusSchreiben(modus);
    modusZeigen();
  };
  modusKnopf.onclick = () => modusSetzen(modus === 'frage' ? 'bewertung' : 'frage');
  form.querySelectorAll('[data-coach-modus-wahl]').forEach((wahl) => {
    wahl.onchange = () => { modusSetzen(wahl.value); werkzeugeZeigen(false); };
  });
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
  field.addEventListener('focus', () => { setTimeout(tastatur, 60); setTimeout(() => nachUnten(false), 320); });
  field.addEventListener('blur', () => setTimeout(tastatur, 60));
  const nachUnten = (sanft = true) => requestAnimationFrame(() => container.scrollTo({ top: container.scrollHeight, behavior: sanft ? 'smooth' : 'auto' }));

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
  const kopf = () => (karteSichtbar() || statusSichtbar() ? coachingKarteMarkup(coaching) : '');
  const zeichnen = (zusatz = '') => {
    answer.innerHTML = kopf() + (runden.length ? verlaufMarkup(runden, avatar) : (karteSichtbar() ? '' : startMarkup(start))) + zusatz;
    if (karteSichtbar()) alsGelesenMarkieren(coaching);
  };
  const resizeField = () => {
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
    attachmentBox.innerHTML = anhang ? `<img src="${anhang.dataUrl}" alt=""><span>${escapeHtml(anhang.name)}</span><button type="button" data-remove-attachment aria-label="Anhang entfernen">×</button>` : '';
  };
  // Plus-Menü wie in Apple Nachrichten: Der Chat dahinter wird unscharf.
  const werkzeugeZeigen = (offen) => {
    tools.hidden = !offen;
    plus.setAttribute('aria-expanded', String(offen));
    container.classList.toggle('menue-offen', offen);
  };
  plus.onclick = () => werkzeugeZeigen(tools.hidden);
  container.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !tools.hidden) werkzeugeZeigen(false);
  });
  // Ein Tipp irgendwo in den Chat schließt das Plus-Menü wieder.
  container.addEventListener('click', (event) => {
    if (!tools.hidden && !event.target.closest('[data-coach-form]')) werkzeugeZeigen(false);
  });
  webOption.onchange = () => plus.classList.toggle('hat-web', webOption.checked);
  fileInput.onchange = async () => {
    try {
      anhang = await bildAnhang(fileInput.files?.[0]);
      renderAttachment();
      werkzeugeZeigen(false);
    } catch (error) { toast(error?.message || 'Anhang konnte nicht geladen werden.'); }
    fileInput.value = '';
  };
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
    start.neu = true;
    answer.innerHTML = startMarkup(start);
    field.focus();
  };

  answer.addEventListener('click', async (event) => {
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
    const schritteKnopf = event.target.closest('[data-schritte-aus]');
    if (schritteKnopf) {
      const anfrage = schritteAnfrage(runden[rundenIndex]);
      if (anfrage && !laeuft) senden({ ...anfrage, quelle: rundenIndex });
      return;
    }
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
      + fensterMarkup({ von: 'user', avatar, inhalt: nutzerText(question, mitAnhang, bezug) })
      + tipptMarkup((webResearch ? LADEPHASEN.web : LADEPHASEN.coach)[0]);
    const ladephasenStoppen = ladephasenStarten(answer, webResearch ? LADEPHASEN.web : LADEPHASEN.coach);
    nachUnten();
    try {
      // Steht die Coaching-Karte über einem leeren Chat, gehört die Frage zu ihr.
      const gespraechsId = gespraech?.id || (karteSichtbar() && coaching.status === 'bereit' ? coaching.id : null);
      const response = await rufeCoach({
        scope: 'coach', question, webResearch, modus: anfrageModus,
        ...(gespraechsId ? { conversationId: gespraechsId } : {}),
        ...(mitAnhang ? { attachments: [{ type: 'image', dataUrl: anhang.dataUrl }] } : {}),
        ...(schritteAus ? { schritteAus } : {}),
      });
      // Nur wenn der Server die Runde gespeichert hat, gibt es ein
      // Gespräch, an das die nächste Frage anschließen kann. Eine Antwort,
      // aus der Schritte gemacht wurden, zeigt den Knopf nicht mehr.
      const frueher = gespraech?.id === response.conversationId
        ? runden.map((runde, index) => (index === quelle ? { ...runde, schritteGemacht: true } : runde)) : [];
      const runde = { frage: question, result: response.result, hatAnhang: mitAnhang, ...(bezug ? { bezug } : {}) };
      if (response.conversationId && response.memorySaved) {
        runden = [...frueher, runde].slice(-8);
        gespraech = { id: response.conversationId, runden };
        gespraechSchreiben(gespraech);
        neuesGespraech.hidden = false;
      } else {
        runden = [runde];
      }
      zeichnen();
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
      nachUnten();
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
