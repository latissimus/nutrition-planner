import { supabase } from './supabase.js';
import { materialIconMarkup } from './categoryIcons.js';
import { toast } from './toast.js';

const CONTEXT_KEY = 'muscledex:coach-context';
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function resultMarkup(result) {
  if (!result) return '';
  const facts = (result.facts || []).slice(0, 6);
  const interpretations = (result.interpretations || []).slice(0, 5);
  const recommendations = (result.recommendations || []).slice(0, 3);
  return `<div class="coach-result">
    <header><span><small>${escapeHtml(result.title || 'CAPBOY COACH')}</small><b>${escapeHtml(result.summary || '')}</b></span><em class="coach-confidence">${escapeHtml(result.confidence || 'niedrig')} sicher</em></header>
    ${facts.length ? `<section class="coach-result-section is-data"><h3><span>Berücksichtigte Daten</span><em>KI-Zusammenfassung deiner CAPBOY-Daten</em></h3><ul>${facts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''}
    ${interpretations.length ? `<section class="coach-result-section is-ai"><h3><span>Einordnung</span><em>KI-Interpretation</em></h3><ul>${interpretations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''}
    ${recommendations.length ? `<section class="coach-result-section is-action"><h3><span>Nächste Schritte</span><em>KI-Vorschlag</em></h3><div class="coach-recommendations">${recommendations.map((item) => `<article><b>${escapeHtml(item.action)}</b><p>${escapeHtml(item.rationale)}</p><small>${escapeHtml(item.timeframe)}</small></article>`).join('')}</div></section>` : ''}
    ${result.uncertainties?.length ? `<details><summary>Unsicherheiten und fehlende Daten</summary><ul>${result.uncertainties.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></details>` : ''}
    ${result.safetyNote ? `<p class="coach-safety">${escapeHtml(result.safetyNote)}</p>` : ''}
    <p class="coach-origin-note">Die Messwerte und regelbasierten Auswertungen auf den Fachseiten bleiben die Datenquelle. Der Coach fasst sie zusammen und priorisiert mögliche nächste Schritte.</p>
  </div>`;
}

async function invokeCoach(scope, question = '') {
  const { data, error } = await supabase.functions.invoke('capboy-coach', { body: { scope, question } });
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

export async function mountCoachPage(container, { userId, signal, backRoute = 'body' }) {
  let pending = {};
  try { pending = JSON.parse(sessionStorage.getItem(CONTEXT_KEY) || '{}'); } catch {}
  sessionStorage.removeItem(CONTEXT_KEY);
  container.classList.add('coach-page');
  container.innerHTML = `<main class="coach-shell">
    <header class="coach-hero">
      <span class="coach-spark" aria-hidden="true">${materialIconMarkup('stars')}</span>
      <div><small>PERSÖNLICHER COACH</small><h1>Frag CAPBOY</h1><p>Antworten aus deinem Gesamtbild – nicht aus einem einzelnen Messwert.</p></div>
      <a class="som-info-knopf dex-sammlungskopf-zurueck coach-back" href="#${escapeHtml(backRoute)}" aria-label="Zurück">${materialIconMarkup('chevron_right', 'dex-sammlungskopf-pfeil')}</a>
    </header>
    <form class="coach-form" data-coach-form>
      <label for="coach-question">Deine Frage</label>
      <textarea id="coach-question" rows="3" maxlength="2000" placeholder="Zum Beispiel: Warum stagniert mein Fortschritt, obwohl ich regelmäßig trainiere?">${escapeHtml(pending.question || '')}</textarea>
      <button class="btn btn-primary" type="submit">Coach fragen</button>
      <small class="coach-scope-note">Betrachtet COMP, Training, Ernährung, Schlaf, Erholung und Routinen gemeinsam.</small>
    </form>
    <section class="coach-answer" data-coach-answer aria-live="polite">
      <div class="coach-welcome"><b>Eine Antwort, ein Gesamtbild.</b><p>Stelle deine Frage. CAPBOY trennt die verwendeten Daten, die KI-Einordnung und vorgeschlagene nächste Schritte sichtbar voneinander.</p></div>
    </section>
    <p class="coach-disclaimer">CAPBOY erkennt Muster und gibt Empfehlungen, ersetzt aber keine medizinische Untersuchung.</p>
  </main>`;
  const answer = container.querySelector('[data-coach-answer]');
  const form = container.querySelector('[data-coach-form]');
  const field = form.querySelector('textarea');
  form.onsubmit = async (event) => {
    event.preventDefault();
    const question = field.value.trim();
    if (question.length < 2) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Coach denkt …';
    answer.innerHTML = '<div class="coach-loading"><span></span><p>CAPBOY verbindet die relevanten Bereiche und trennt Daten von Einordnung.</p></div>';
    answer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    try {
      const response = await invokeCoach('coach', question);
      if (signal?.aborted) return;
      answer.innerHTML = resultMarkup(response.result);
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
