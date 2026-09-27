import { supabase } from './supabase.js';
import { materialIconMarkup } from './categoryIcons.js';
import hourglassUrl from './assets/hourglass-time.gif';
import { toast } from './toast.js';
import {
  ENTSCHEIDUNGEN, RICHTUNGEN, URTEILE, ZIELGROESSEN, istNichtEingerichtet, merkeEmpfehlung, uebernimmAuswertung,
} from './coachMemory.js';
import { mountWochenbilanz, vergleichMarkup } from './coachWeekly.js';
import { fensterEinklappen, fensterMarkup, kopfMarkup } from './coachFenster.js';

export { fensterMarkup };

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

// Eine Antwort als Chatnachricht: zuerst die Antwort selbst, dann was zu tun
// ist; Daten, Einordnung und Unsicherheiten stehen zugeklappt darunter.
export function resultMarkup(result, { merken = false } = {}) {
  if (!result) return '';
  const facts = (result.facts || []).slice(0, 6);
  const interpretations = (result.interpretations || []).slice(0, 5);
  const uncertainties = (result.uncertainties || []).slice(0, 5);
  const recommendations = (result.recommendations || []).slice(0, 3);
  const webSources = (result.webSources || []).flatMap((source) => {
    const url = safeExternalUrl(source?.url);
    return url ? [{ title: source?.title || new URL(url).hostname, url }] : [];
  }).slice(0, 8);
  const mehr = [
    facts.length ? `<h4>Daten</h4>${liste(facts)}` : '',
    interpretations.length ? `<h4>Einordnung</h4>${liste(interpretations)}` : '',
    uncertainties.length ? `<h4>Noch unsicher</h4>${liste(uncertainties)}` : '',
  ].join('');
  return `<div class="coach-result">
    <p class="coach-antwort">${escapeHtml(readableModelText(result.summary || ''))}</p>
    ${result.safetyNote ? `<p class="coach-safety">${escapeHtml(readableModelText(result.safetyNote))}</p>` : ''}
    ${auswertungenMarkup((result.experimentReviews || []).slice(0, 5), merken)}
    ${recommendations.length ? `<section class="coach-schritte"><h4>Nächste Schritte</h4>${recommendations.map((item, index) => empfehlungMarkup(item, index, merken)).join('')}</section>` : ''}
    ${mehr ? `<details class="coach-mehr"><summary>Daten &amp; Einordnung</summary>${mehr}</details>` : ''}
    ${webSources.length ? `<details class="coach-mehr coach-web-sources"><summary>Verwendete Webquellen</summary><ul>${webSources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul></details>` : ''}
    ${result.webResearchRequested && !webSources.length ? '<small class="coach-web-status">Keine Webquelle verwendet</small>' : ''}
    ${result.confidence ? `<small class="coach-datenlage">Datenlage: ${escapeHtml(result.confidence)}</small>` : ''}
  </div>`;
}

const nutzerText = (text, hatAnhang = false) => `<p>${escapeHtml(text)}</p>${hatAnhang ? '<small>Bild angehängt</small>' : ''}`;

// Das Gespräch: jede Runde als Frage und Antwort. Die Wochenbilanz trägt
// zusätzlich ihren Wochenvergleich.
export function verlaufMarkup(runden = [], avatar = '') {
  if (!runden.length) return '';
  return runden.map((runde, index) => fensterMarkup({ von: 'user', avatar, inhalt: nutzerText(runde.frage, runde.hatAnhang) })
    + fensterMarkup({ runde: index, inhalt: `${runde.weekly ? vergleichMarkup(runde.weekly) : ''}${resultMarkup(runde.result, { merken: true })}` })).join('');
}

const VORSCHLAEGE = ['Wie lief meine letzte Woche?', 'Warum bewegt sich mein Gewicht kaum?', 'Wie kann ich besser schlafen?'];

export function willkommenMarkup({ neu = false } = {}) {
  return fensterMarkup({
    klasse: 'coach-welcome',
    inhalt: `<p>${neu ? 'Neues Gespräch. Womit soll ich dir helfen?' : 'Hi, ich bin CAPBOY. Ich kenne deine Messwerte der letzten zwölf Wochen. Frag mich zu Training, Ernährung, Schlaf oder Körper.'}</p>
      <div class="coach-vorschlaege">${VORSCHLAEGE.map((vorschlag) => `<button type="button" data-vorschlag="${escapeHtml(vorschlag)}">${escapeHtml(vorschlag)}</button>`).join('')}</div>`,
  });
}

const tipptMarkup = (text) => fensterMarkup({ klasse: 'is-loading', inhalt: `<p class="coach-tippt" role="status"><img src="${hourglassUrl}" alt="">${escapeHtml(text)}</p>` });
const fehlerMarkup = (text) => fensterMarkup({ klasse: 'is-fehler', inhalt: `<p>${escapeHtml(text)}</p>` });

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
  // Die gerade sichtbaren Runden; "Merken" und "Ergebnis übernehmen" gehören
  // zur Antwort, unter der sie stehen.
  let runden = gespraech?.runden || [];
  let anhang = null;
  const { data: coachProfile } = await supabase.from('profiles').select('full_name,avatar_url').eq('id', userId).maybeSingle();
  const avatar = nutzerAvatarMarkup(coachProfile, (await supabase.auth.getUser()).data?.user?.email || '');
  container.classList.add('coach-page');
  container.innerHTML = `<main class="coach-shell coach-chat">
    ${kopfMarkup({
      zurueck: backRoute,
      rechts: `<button class="coach-kopf-knopf" type="button" data-neues-gespraech aria-label="Neues Gespräch" title="Neues Gespräch"${gespraech ? '' : ' hidden'}>${materialIconMarkup('edit')}</button>
      <a class="coach-kopf-knopf" href="#coach-wissen" aria-label="Was CAPBOY über mich weiß" title="Was CAPBOY über mich weiß">${materialIconMarkup('menu_book')}</a>`,
    })}
    <section class="coach-woche" data-coach-woche hidden></section>
    <section class="coach-answer" data-coach-answer aria-live="polite"></section>
    <form class="coach-form" data-coach-form>
      <div class="coach-form-innen">
        <div class="coach-compose-tools" data-coach-tools hidden>
          <label class="coach-werkzeug">${materialIconMarkup('add_photo_alternate')}<span>Bild anhängen</span><input type="file" accept="image/*" data-coach-file></label>
          <label class="coach-werkzeug"><input type="checkbox" data-coach-web><span>Webwissen einbeziehen</span></label>
        </div>
        <div class="coach-attachment" data-coach-attachment hidden></div>
        <div class="coach-inputbar">
          <button class="coach-plus" type="button" data-coach-plus aria-expanded="false" aria-label="Bild oder Webwissen hinzufügen">+</button>
          <label class="sr-only" for="coach-question">Nachricht an CAPBOY</label>
          <textarea id="coach-question" rows="1" maxlength="2000" enterkeyhint="send" placeholder="Nachricht an CAPBOY">${escapeHtml(pending.question || '')}</textarea>
          <button class="coach-send" type="submit" aria-label="Senden">${materialIconMarkup('play_arrow')}</button>
        </div>
      </div>
    </form>
  </main>`;
  const answer = container.querySelector('[data-coach-answer]');
  const form = container.querySelector('[data-coach-form]');
  const field = form.querySelector('textarea');
  const neuesGespraech = container.querySelector('[data-neues-gespraech]');
  const tools = form.querySelector('[data-coach-tools]');
  const plus = form.querySelector('[data-coach-plus]');
  const fileInput = form.querySelector('[data-coach-file]');
  const webOption = form.querySelector('[data-coach-web]');
  const attachmentBox = form.querySelector('[data-coach-attachment]');

  // Die Eingabe sitzt fest am unteren Rand; der Verlauf bekommt unten so viel
  // Platz, wie sie hoch ist. Öffnet sich die Tastatur, sitzt die Eingabe direkt
  // darauf. iOS schiebt dabei die ganze Seite hoch; das wird zurückgenommen,
  // damit die Kopfleiste stehen bleibt. Wo das nicht greift, folgt sie der
  // verschobenen Ansicht (--coach-oben).
  new ResizeObserver(() => container.style.setProperty('--coach-eingabe-h', `${form.offsetHeight}px`)).observe(form);
  const tastatur = () => {
    const sicht = window.visualViewport;
    if (!sicht || !container.isConnected) return;
    const offen = document.activeElement === field && sicht.height < window.innerHeight - 80;
    if (offen && window.scrollY) window.scrollTo(0, 0);
    container.style.setProperty('--coach-tastatur', `${Math.max(0, window.innerHeight - sicht.height - sicht.offsetTop)}px`);
    container.style.setProperty('--coach-oben', `${Math.max(0, sicht.offsetTop)}px`);
    container.classList.toggle('tastatur-offen', offen);
  };
  window.visualViewport?.addEventListener('resize', tastatur);
  window.visualViewport?.addEventListener('scroll', tastatur);
  field.addEventListener('focus', () => { setTimeout(tastatur, 60); setTimeout(() => nachUnten(false), 320); });
  field.addEventListener('blur', () => setTimeout(tastatur, 60));
  const nachUnten = (sanft = true) => requestAnimationFrame(() => container.scrollTo({ top: container.scrollHeight, behavior: sanft ? 'smooth' : 'auto' }));

  const zeichnen = (zusatz = '') => {
    answer.innerHTML = (runden.length ? verlaufMarkup(runden, avatar) : willkommenMarkup()) + zusatz;
  };
  const resizeField = () => {
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 120)}px`;
  };
  field.addEventListener('input', resizeField);
  field.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });
  const renderAttachment = () => {
    attachmentBox.hidden = !anhang;
    attachmentBox.innerHTML = anhang ? `<img src="${anhang.dataUrl}" alt=""><span>${escapeHtml(anhang.name)}</span><button type="button" data-remove-attachment aria-label="Anhang entfernen">×</button>` : '';
  };
  const werkzeugeZeigen = (offen) => {
    tools.hidden = !offen;
    plus.setAttribute('aria-expanded', String(offen));
  };
  plus.onclick = () => werkzeugeZeigen(tools.hidden);
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
    gespraech = null;
    runden = [];
    gespraechSchreiben(null);
    neuesGespraech.hidden = true;
    answer.innerHTML = willkommenMarkup({ neu: true });
    field.focus();
  };

  answer.addEventListener('click', async (event) => {
    if (fensterEinklappen(event)) return;
    const vorschlag = event.target.closest('[data-vorschlag]');
    if (vorschlag) {
      field.value = vorschlag.dataset.vorschlag;
      resizeField();
      form.requestSubmit();
      return;
    }
    const ergebnis = runden[Number(event.target.closest('[data-runde]')?.dataset.runde)]?.result;
    const auswertungsKnopf = event.target.closest('[data-auswertung-uebernehmen]');
    const auswertung = auswertungsKnopf && ergebnis?.experimentReviews?.[Number(auswertungsKnopf.dataset.auswertungUebernehmen)];
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
    const empfehlung = knopf && ergebnis?.recommendations?.[Number(knopf.dataset.empfehlungMerken)];
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

  // Wochen-Check-in (Schritt 7): CAPBOY stellt die Fragen im Chat. Die Bilanz
  // beginnt ein neues Gespräch, damit Rückfragen an sie anschließen.
  mountWochenbilanz(container.querySelector('[data-coach-woche]'), {
    userId,
    anfragen: rufeCoach,
    zeigen: ({ frage, laden, fehler, text, result, weekly, conversationId }) => {
      if (frage) {
        answer.insertAdjacentHTML('beforeend', fensterMarkup({ klasse: 'coach-checkin', inhalt: frage }));
        nachUnten();
        return answer.lastElementChild;
      }
      if (laden) {
        answer.innerHTML = fensterMarkup({ von: 'user', avatar, inhalt: nutzerText(text) }) + tipptMarkup('CAPBOY bilanziert deine Woche');
      } else if (fehler) {
        zeichnen(fehlerMarkup('Keine Wochenbilanz erstellt. Deine Messwerte bleiben unverändert. Versuche es später erneut.'));
      } else {
        runden = [{ frage: text, result, weekly }];
        gespraech = conversationId ? { id: conversationId, runden } : null;
        gespraechSchreiben(gespraech);
        neuesGespraech.hidden = !gespraech;
        zeichnen();
      }
      nachUnten();
      return null;
    },
  });

  form.onsubmit = async (event) => {
    event.preventDefault();
    const question = field.value.trim();
    if (question.length < 2) return;
    const webResearch = webOption.checked;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const mitAnhang = Boolean(anhang);
    field.value = '';
    resizeField();
    werkzeugeZeigen(false);
    answer.innerHTML = verlaufMarkup(runden, avatar)
      + fensterMarkup({ von: 'user', avatar, inhalt: nutzerText(question, mitAnhang) })
      + tipptMarkup(webResearch ? 'CAPBOY recherchiert' : 'CAPBOY denkt nach');
    nachUnten();
    try {
      const response = await invokeCoach('coach', question, webResearch, gespraech?.id, anhang ? [{ type: 'image', dataUrl: anhang.dataUrl }] : []);
      // Nur wenn der Server die Runde gespeichert hat, gibt es ein
      // Gespräch, an das die nächste Frage anschließen kann.
      const frueher = gespraech?.id === response.conversationId ? runden : [];
      const runde = { frage: question, result: response.result, hatAnhang: mitAnhang };
      if (response.conversationId && response.memorySaved) {
        runden = [...frueher, runde].slice(-8);
        gespraech = { id: response.conversationId, runden };
        gespraechSchreiben(gespraech);
        neuesGespraech.hidden = false;
      } else {
        runden = [runde];
      }
      zeichnen();
      anhang = null;
      renderAttachment();
    } catch (error) {
      field.value = question;
      resizeField();
      zeichnen(fehlerMarkup('Keine Antwort erstellt. Deine Frage steht wieder im Eingabefeld; versuche es gleich noch einmal.'));
      toast(error?.message || 'Coach konnte nicht antworten.');
    } finally {
      button.disabled = false;
      nachUnten();
    }
  };
}
