import { supabase } from './supabase.js';
import { materialIconMarkup } from './categoryIcons.js';
import { coachIconMarkup } from './menuIcons.js';
import { toast } from './toast.js';
import {
  ENTSCHEIDUNGEN, RICHTUNGEN, URTEILE, ZIELGROESSEN, istNichtEingerichtet, merkeEmpfehlung, uebernimmAuswertung,
} from './coachMemory.js';

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
    ${result.safetyNote ? `<p class="coach-safety">${escapeHtml(readableModelText(result.safetyNote))}</p>` : ''}
    <p class="coach-origin-note">Die Messwerte und regelbasierten Auswertungen auf den Fachseiten bleiben die Datenquelle. ${result.webResearchRequested ? (webSources.length ? 'Aktuelles Webwissen wurde ergänzend recherchiert und ist oben verlinkt.' : 'Die gewünschte Webrecherche lieferte keine verwendbare externe Quelle.') : 'Es wurde keine Internetrecherche durchgeführt.'}</p>
  </div>`;
}

async function invokeCoach(scope, question = '', webResearch = false, conversationId = null) {
  const body = { scope, question, webResearch, ...(conversationId ? { conversationId } : {}) };
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
export function verlaufMarkup(runden = []) {
  if (!runden.length) return '';
  return `<details class="coach-verlauf"><summary>Bisher in diesem Gespräch (${runden.length} ${runden.length === 1 ? 'Frage' : 'Fragen'})</summary><ol>${runden.map((runde) => `<li><small>Du</small><p>${escapeHtml(runde.frage)}</p><small>CAPBOY</small><p>${escapeHtml(readableModelText(runde.result?.summary || ''))}</p></li>`).join('')}</ol></details>`;
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
  container.classList.add('coach-page');
  container.innerHTML = `<main class="coach-shell">
    <header class="coach-hero">
      <span class="coach-spark" aria-hidden="true">${coachIconMarkup('coach-hero-cap')}</span>
      <div><small>PERSÖNLICHER COACH</small><h1>Frag CAPBOY</h1><p>Antworten aus deinem Gesamtbild – nicht aus einem einzelnen Messwert.</p></div>
      <a class="som-info-knopf dex-sammlungskopf-zurueck coach-back" href="#${escapeHtml(backRoute)}" aria-label="Zurück">${materialIconMarkup('chevron_right', 'dex-sammlungskopf-pfeil')}</a>
    </header>
    <form class="coach-form" data-coach-form>
      <label for="coach-question">Deine Frage</label>
      <textarea id="coach-question" rows="3" maxlength="2000" placeholder="Zum Beispiel: Warum stagniert mein Fortschritt, obwohl ich regelmäßig trainiere?">${escapeHtml(pending.question || '')}</textarea>
      <label class="coach-web-option"><input type="checkbox" data-coach-web><span><b>Aktuelles Webwissen recherchieren</b><small>Für aktuelle Studien, Leitlinien oder externes Wissen. Die verwendeten Quellen werden verlinkt.</small></span></label>
      <button class="btn btn-primary" type="submit">Coach fragen</button>
      <small class="coach-scope-note">Betrachtet immer COMP, Training, Ernährung, Schlaf, Erholung und Routinen gemeinsam. Webrecherche ist optional.</small>
      <div class="coach-gespraech-leiste">
        <button class="btn" type="button" data-neues-gespraech${gespraech ? '' : ' hidden'}>Neues Gespräch</button>
        <a class="coach-gedaechtnis-link" href="#coach-wissen">Was CAPBOY über mich weiß</a>
      </div>
    </form>
    <section class="coach-answer" data-coach-answer aria-live="polite">
      <div class="coach-welcome"><b>Eine Antwort, ein Gesamtbild.</b><p>Stelle deine Frage. CAPBOY trennt die verwendeten Daten, die KI-Einordnung und vorgeschlagene nächste Schritte sichtbar voneinander.</p></div>
    </section>
    <p class="coach-disclaimer">CAPBOY erkennt Muster und gibt Empfehlungen, ersetzt aber keine medizinische Untersuchung.</p>
  </main>`;
  const answer = container.querySelector('[data-coach-answer]');
  const form = container.querySelector('[data-coach-form]');
  const field = form.querySelector('textarea');
  const neuesGespraech = form.querySelector('[data-neues-gespraech]');
  if (gespraech?.runden.length) {
    const letzte = gespraech.runden.at(-1);
    letzteAntwort = letzte.result;
    answer.innerHTML = verlaufMarkup(gespraech.runden.slice(0, -1)) + resultMarkup(letzte.result, { merken: true });
  }
  neuesGespraech.onclick = () => {
    gespraech = null;
    letzteAntwort = null;
    gespraechSchreiben(null);
    neuesGespraech.hidden = true;
    answer.innerHTML = '<div class="coach-welcome"><b>Neues Gespräch.</b><p>CAPBOY beginnt ohne die bisherigen Fragen. Deine Messwerte und was unter „Was CAPBOY über mich weiß“ steht, kennt er weiterhin.</p></div>';
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
  form.onsubmit = async (event) => {
    event.preventDefault();
    const question = field.value.trim();
    if (question.length < 2) return;
    const webResearch = Boolean(form.querySelector('[data-coach-web]')?.checked);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = webResearch ? 'Coach recherchiert …' : 'Coach denkt …';
    answer.innerHTML = `<div class="coach-loading"><p class="coach-thinking-label" role="status">Denke nach<span class="coach-thinking-dots" aria-hidden="true">...</span></p><p>${webResearch ? 'CAPBOY COACH recherchiert aktuelles Wissen und verbindet es mit deinem Gesamtbild.' : 'CAPBOY COACH verbindet die relevanten Bereiche und trennt Daten von Einordnung.'}</p></div>`;
    answer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    try {
      const response = await invokeCoach('coach', question, webResearch, gespraech?.id);
      letzteAntwort = response.result;
      // Nur wenn der Server die Runde gespeichert hat, gibt es ein
      // Gespräch, an das die nächste Frage anschließen kann.
      const frueher = gespraech?.id === response.conversationId ? gespraech.runden : [];
      if (response.conversationId && response.memorySaved) {
        gespraech = { id: response.conversationId, runden: [...frueher, { frage: question, result: response.result }].slice(-8) };
        gespraechSchreiben(gespraech);
        neuesGespraech.hidden = false;
      }
      answer.innerHTML = verlaufMarkup(response.memorySaved ? frueher : []) + resultMarkup(response.result, { merken: true });
      field.value = '';
    } catch (error) {
      answer.innerHTML = '<div class="coach-welcome"><b>Keine Antwort erstellt.</b><p>Deine bisherigen Messwerte bleiben unverändert. Versuche es später erneut.</p></div>';
      toast(error?.message || 'Coach konnte nicht antworten.');
    } finally {
      button.disabled = false;
      button.textContent = 'Coach fragen';
    }
  };
}
