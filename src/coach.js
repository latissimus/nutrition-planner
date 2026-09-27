import { supabase } from './supabase.js';
import { materialIconMarkup } from './categoryIcons.js';
import { coachIconMarkup } from './menuIcons.js';
import hourglassUrl from './assets/hourglass-time.gif';
import { toast } from './toast.js';
import {
  ENTSCHEIDUNGEN, RICHTUNGEN, URTEILE, ZIELGROESSEN, istNichtEingerichtet, merkeEmpfehlung, uebernimmAuswertung,
} from './coachMemory.js';
import { mountWochenbilanz, vergleichMarkup, wochenTitel } from './coachWeekly.js';

const CONTEXT_KEY = 'muscledex:coach-context';
// Laufendes Gespräch dieses Tabs: ID vom Server und die bisherigen Runden.
const GESPRAECH_KEY = 'muscledex:coach-gespraech';
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

function ladeMarkup(text, detail) {
  return `<div class="coach-loading" role="status"><img class="coach-hourglass" src="${hourglassUrl}" alt=""><b>${escapeHtml(text)}</b>${detail ? `<p>${escapeHtml(detail)}</p>` : ''}</div>`;
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
    ? `<button class="btn coach-merken" type="button" data-empfehlung-merken="${index}">${experiment ? 'Als Experiment merken' : 'Als Maßnahme merken'}</button>` : '';
  return `<article${art ? ` class="ist-${art}"` : ''}>${art ? `<span class="coach-art">${ART[art]}${pruefen}</span>` : ''}<b>${escapeHtml(readableModelText(item.action))}</b><p>${escapeHtml(readableModelText(item.rationale))}</p>${details}<small>${escapeHtml(readableModelText(item.timeframe))}</small>${knopf}</article>`;
}

// Auswertungen fälliger Experimente (Schritt 6).
function auswertungenMarkup(auswertungen = [], merken = false) {
  if (!auswertungen.length) return '';
  return `<section class="coach-result-section is-action"><h3><span>Auswertung deiner Experimente</span><em>KI-Einordnung der App-Messung</em></h3><div class="coach-recommendations">${auswertungen.map((item, index) => `<article><span class="coach-art">${escapeHtml(bezeichnung(URTEILE, item.verdict))} · ${escapeHtml(bezeichnung(ENTSCHEIDUNGEN, item.decision))}</span><p>${escapeHtml(readableModelText(item.basis))}</p>${merken ? `<button class="btn coach-merken" type="button" data-auswertung-uebernehmen="${index}">Ergebnis übernehmen</button>` : ''}</article>`).join('')}</div></section>`;
}

export function resultMarkup(result, { merken = false } = {}) {
  if (!result) return '';
  const facts = (result.facts || []).slice(0, 6);
  const interpretations = (result.interpretations || []).slice(0, 5);
  const recommendations = (result.recommendations || []).slice(0, 3);
  const webSources = (result.webSources || []).flatMap((source) => {
    const url = safeExternalUrl(source?.url);
    return url ? [{ title: source?.title || new URL(url).hostname, url }] : [];
  }).slice(0, 8);
  return `<div class="coach-result">
    <header><span><small>${escapeHtml(readableModelText(result.title || 'CAPBOY COACH'))}</small><b>${escapeHtml(readableModelText(result.summary || ''))}</b></span><span class="coach-result-meta">${coachIconMarkup('coach-cap-badge')}<em class="coach-confidence">${escapeHtml(result.confidence || 'niedrig')} sicher</em></span></header>
    ${facts.length ? `<section class="coach-result-section is-data"><h3><span>Berücksichtigte Daten</span><em>KI-Zusammenfassung deiner CAPBOY-Daten</em></h3><ul>${facts.map((item) => `<li>${escapeHtml(readableModelText(item))}</li>`).join('')}</ul></section>` : ''}
    ${interpretations.length ? `<section class="coach-result-section is-ai"><h3><span>Einordnung</span><em>KI-Interpretation</em></h3><ul>${interpretations.map((item) => `<li>${escapeHtml(readableModelText(item))}</li>`).join('')}</ul></section>` : ''}
    ${auswertungenMarkup((result.experimentReviews || []).slice(0, 5), merken)}
    ${recommendations.length ? `<section class="coach-result-section is-action"><h3><span>Nächste Schritte</span><em>KI-Vorschlag</em></h3><div class="coach-recommendations">${recommendations.map((item, index) => empfehlungMarkup(item, index, merken)).join('')}</div></section>` : ''}
    ${result.uncertainties?.length ? `<details><summary>Unsicherheiten und fehlende Daten</summary><ul>${result.uncertainties.map((item) => `<li>${escapeHtml(readableModelText(item))}</li>`).join('')}</ul></details>` : ''}
    ${webSources.length ? `<details class="coach-web-sources" open><summary>Verwendete Webquellen</summary><ul>${webSources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul></details>` : ''}
    ${result.webResearchRequested && !webSources.length ? '<small class="coach-web-status">Keine Webquelle verwendet</small>' : ''}
  </div>`;
}

async function invokeCoach(scope, question = '', webResearch = false, conversationId = null, attachments = []) {
  return rufeCoach({ scope, question, webResearch, ...(conversationId ? { conversationId } : {}), ...(attachments.length ? { attachments } : {}) });
}

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

export function openCoachQuestion({ scope = 'overall', question = '' } = {}) {
  sessionStorage.setItem(CONTEXT_KEY, JSON.stringify({ scope, question }));
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

// Frühere Runden des laufenden Gesprächs, zusammengeklappt über der neuesten Antwort.
export function verlaufMarkup(runden = [], avatar = '') {
  if (!runden.length) return '';
  return runden.map((runde) => `<div class="coach-round">
    <article class="coach-chat-window is-user"><header><span class="coach-chat-avatar">${avatar}</span><b>Du</b></header><div class="coach-chat-message"><p>${escapeHtml(runde.frage)}</p>${runde.hatAnhang ? '<small>Bild angehängt</small>' : ''}</div></article>
    <article class="coach-chat-window is-coach"><header>${coachIconMarkup('coach-chat-cap')}<b>CAPBOY</b></header><div class="coach-chat-message">${resultMarkup(runde.result, { merken: true })}</div></article>
  </div>`).join('');
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
  let letzteAntwort = null;
  let anhang = null;
  const { data: coachProfile } = await supabase.from('profiles').select('full_name,avatar_url').eq('id', userId).maybeSingle();
  const avatar = nutzerAvatarMarkup(coachProfile, (await supabase.auth.getUser()).data?.user?.email || '');
  container.classList.add('coach-page');
  container.innerHTML = `<main class="coach-shell">
    <header class="coach-hero">
      <span class="coach-spark" aria-hidden="true">${coachIconMarkup('coach-hero-cap')}</span>
      <div><small>PERSÖNLICHER COACH</small><h1>Frag CAPBOY</h1><p>Antworten aus deinem Gesamtbild – nicht aus einem einzelnen Messwert.</p></div>
      <a class="som-info-knopf dex-sammlungskopf-zurueck coach-back" href="#${escapeHtml(backRoute)}" aria-label="Zurück">${materialIconMarkup('chevron_right', 'dex-sammlungskopf-pfeil')}</a>
    </header>
    <section class="coach-woche" data-coach-woche hidden></section>
    <section class="coach-answer" data-coach-answer aria-live="polite">
      <article class="coach-chat-window is-coach coach-welcome"><header>${coachIconMarkup('coach-chat-cap')}<b>CAPBOY</b></header><div class="coach-chat-message"><b>Eine Antwort, ein Gesamtbild.</b><p>Was möchtest du über deinen Fortschritt wissen?</p></div></article>
    </section>
    <form class="coach-form" data-coach-form>
      <div class="coach-inputbar">
        <button class="coach-plus" type="button" data-coach-plus aria-expanded="false" aria-label="Anhänge und Optionen">+</button>
        <label class="sr-only" for="coach-question">Deine Frage</label>
        <textarea id="coach-question" rows="1" maxlength="2000" placeholder="Nachricht an CAPBOY">${escapeHtml(pending.question || '')}</textarea>
        <button class="coach-send" type="submit" aria-label="Nachricht senden">${materialIconMarkup('arrow_forward_ios')}</button>
      </div>
      <div class="coach-compose-tools" data-coach-tools hidden>
        <label class="coach-attachment-option">${materialIconMarkup('add_photo_alternate')}<b>Bild anhängen</b><input type="file" accept="image/*" data-coach-file></label>
        <label class="coach-web-option"><input type="checkbox" data-coach-web><span><b>Webwissen</b><small>Aktuelle Quellen einbeziehen</small></span></label>
      </div>
      <div class="coach-attachment" data-coach-attachment hidden></div>
      <div class="coach-gespraech-leiste">
        <button class="btn" type="button" data-neues-gespraech${gespraech ? '' : ' hidden'}>Neues Gespräch</button>
        <a class="coach-gedaechtnis-link" href="#coach-wissen">Was CAPBOY über mich weiß</a>
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
  const attachmentBox = form.querySelector('[data-coach-attachment]');
  const resizeField = () => {
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 116)}px`;
  };
  field.addEventListener('input', resizeField);
  field.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });
  resizeField();
  const renderAttachment = () => {
    attachmentBox.hidden = !anhang;
    attachmentBox.innerHTML = anhang ? `<img src="${anhang.dataUrl}" alt=""><span>${escapeHtml(anhang.name)}</span><button type="button" data-remove-attachment aria-label="Anhang entfernen">×</button>` : '';
  };
  plus.onclick = () => {
    tools.hidden = !tools.hidden;
    plus.setAttribute('aria-expanded', String(!tools.hidden));
  };
  fileInput.onchange = async () => {
    try {
      anhang = await bildAnhang(fileInput.files?.[0]);
      renderAttachment();
      tools.hidden = true;
      plus.setAttribute('aria-expanded', 'false');
    } catch (error) { toast(error?.message || 'Anhang konnte nicht geladen werden.'); }
    fileInput.value = '';
  };
  attachmentBox.onclick = (event) => {
    if (!event.target.closest('[data-remove-attachment]')) return;
    anhang = null;
    renderAttachment();
  };
  if (gespraech?.runden.length) {
    const letzte = gespraech.runden.at(-1);
    letzteAntwort = letzte.result;
    answer.innerHTML = verlaufMarkup(gespraech.runden, avatar);
  }
  neuesGespraech.onclick = () => {
    gespraech = null;
    letzteAntwort = null;
    gespraechSchreiben(null);
    neuesGespraech.hidden = true;
    answer.innerHTML = `<article class="coach-chat-window is-coach coach-welcome"><header>${coachIconMarkup('coach-chat-cap')}<b>CAPBOY</b></header><div class="coach-chat-message"><b>Neues Gespräch.</b><p>Womit soll ich dir helfen?</p></div></article>`;
    field.focus();
  };
  answer.addEventListener('click', async (event) => {
    const auswertungsKnopf = event.target.closest('[data-auswertung-uebernehmen]');
    const auswertung = auswertungsKnopf && letzteAntwort?.experimentReviews?.[Number(auswertungsKnopf.dataset.auswertungUebernehmen)];
    if (auswertung) {
      auswertungsKnopf.disabled = true;
      try {
        await uebernimmAuswertung(userId, auswertung);
        auswertungsKnopf.textContent = 'Ergebnis übernommen';
        toast(auswertung.decision === 'beibehalten'
          ? 'Übernommen. Ein neues Prüfdatum setzt du unter „Was CAPBOY über mich weiß“.'
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
    const empfehlung = knopf && letzteAntwort?.recommendations?.[Number(knopf.dataset.empfehlungMerken)];
    if (!empfehlung) return;
    knopf.disabled = true;
    try {
      await merkeEmpfehlung(userId, empfehlung);
      knopf.textContent = empfehlung.kind === 'experiment' ? 'Als Experiment gemerkt' : 'Als Maßnahme gemerkt';
      toast(empfehlung.kind === 'experiment' && empfehlung.reviewDate
        ? 'Gemerkt. Am Prüfdatum wertet CAPBOY das Experiment aus.'
        : 'Gemerkt. Prüfdatum und Ergebnis trägst du unter „Was CAPBOY über mich weiß“ ein.');
    } catch (error) {
      knopf.disabled = false;
      toast(istNichtEingerichtet(error) ? 'Das Gedächtnis ist noch nicht eingerichtet.' : (error?.message || 'Konnte nicht gemerkt werden.'));
    }
  });
  // Wochen-Check-in (Schritt 7): Die Bilanz beginnt ein neues Gespräch, damit
  // Rückfragen an sie anschließen.
  mountWochenbilanz(container.querySelector('[data-coach-woche]'), {
    userId,
    anfragen: rufeCoach,
    zeigen: ({ laden, fehler, result, weekly, conversationId }) => {
      if (laden) {
        answer.innerHTML = ladeMarkup('Wochenbilanz läuft', 'CAPBOY vergleicht die Woche mit der Vorwoche und wertet fällige Experimente aus.');
      } else if (fehler) {
        answer.innerHTML = '<div class="coach-welcome"><b>Keine Wochenbilanz erstellt.</b><p>Deine Messwerte bleiben unverändert. Versuche es später erneut.</p></div>';
      } else {
        letzteAntwort = result;
        gespraech = conversationId ? { id: conversationId, runden: [{ frage: `Wochenbilanz ${wochenTitel(weekly)}`, result }] } : null;
        gespraechSchreiben(gespraech);
        neuesGespraech.hidden = !gespraech;
        answer.innerHTML = vergleichMarkup(weekly) + resultMarkup(result, { merken: true });
      }
      answer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    const question = field.value.trim();
    if (question.length < 2) return;
    const webResearch = Boolean(form.querySelector('[data-coach-web]')?.checked);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const aktuelleRunden = gespraech?.runden || [];
    answer.innerHTML = verlaufMarkup(aktuelleRunden, avatar)
      + `<article class="coach-chat-window is-user"><header><span class="coach-chat-avatar">${avatar}</span><b>Du</b></header><div class="coach-chat-message"><p>${escapeHtml(question)}</p>${anhang ? '<small>Bild angehängt</small>' : ''}</div></article>`
      + `<article class="coach-chat-window is-coach is-loading"><header>${coachIconMarkup('coach-chat-cap')}<b>CAPBOY</b></header><div class="coach-chat-message">${ladeMarkup(webResearch ? 'Recherchiere' : 'Denke nach', webResearch ? 'Webwissen und dein Gesamtbild werden verbunden.' : 'Dein Gesamtbild wird ausgewertet.')}</div></article>`;
    answer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    try {
      const response = await invokeCoach('coach', question, webResearch, gespraech?.id, anhang ? [{ type: 'image', dataUrl: anhang.dataUrl }] : []);
      letzteAntwort = response.result;
      // Nur wenn der Server die Runde gespeichert hat, gibt es ein
      // Gespräch, an das die nächste Frage anschließen kann.
      const frueher = gespraech?.id === response.conversationId ? gespraech.runden : [];
      if (response.conversationId && response.memorySaved) {
        gespraech = { id: response.conversationId, runden: [...frueher, { frage: question, result: response.result, hatAnhang: Boolean(anhang) }].slice(-8) };
        gespraechSchreiben(gespraech);
        neuesGespraech.hidden = false;
      }
      const sichtbareRunden = response.memorySaved ? gespraech.runden : [{ frage: question, result: response.result, hatAnhang: Boolean(anhang) }];
      answer.innerHTML = verlaufMarkup(sichtbareRunden, avatar);
      field.value = '';
      resizeField();
      anhang = null;
      renderAttachment();
    } catch (error) {
      answer.innerHTML = '<div class="coach-welcome"><b>Keine Antwort erstellt.</b><p>Deine bisherigen Messwerte bleiben unverändert. Versuche es später erneut.</p></div>';
      toast(error?.message || 'Coach konnte nicht antworten.');
    } finally {
      button.disabled = false;
    }
  };
}
