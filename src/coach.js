import { supabase } from './supabase.js';
import { materialIconMarkup } from './categoryIcons.js';
import { toast } from './toast.js';

const CONTEXT_KEY = 'muscledex:coach-context';
const scopeLabels = {
  sleep: 'Schlafanalyse',
  comp: 'COMP-Gesamtanalyse',
  skinfold: 'Hautfalten-Priorisierung',
  overall: 'Gesamtanalyse',
};

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function resultMarkup(result, { compact = false } = {}) {
  if (!result) return '';
  const facts = (result.facts || []).slice(0, compact ? 3 : 6);
  const interpretations = (result.interpretations || []).slice(0, compact ? 2 : 5);
  const recommendations = (result.recommendations || []).slice(0, 3);
  return `<div class="coach-result">
    <header><span><small>${escapeHtml(result.title || 'CAPBOY COACH')}</small><b>${escapeHtml(result.summary || '')}</b></span><em class="coach-confidence">${escapeHtml(result.confidence || 'niedrig')} sicher</em></header>
    ${facts.length ? `<section><h3>Gemessene Fakten</h3><ul>${facts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''}
    ${interpretations.length ? `<section><h3>Einordnung</h3><ul>${interpretations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''}
    ${recommendations.length ? `<section><h3>Nächste Schritte</h3><div class="coach-recommendations">${recommendations.map((item) => `<article><b>${escapeHtml(item.action)}</b><p>${escapeHtml(item.rationale)}</p><small>${escapeHtml(item.timeframe)}</small></article>`).join('')}</div></section>` : ''}
    ${!compact && result.uncertainties?.length ? `<details><summary>Unsicherheiten und fehlende Daten</summary><ul>${result.uncertainties.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></details>` : ''}
    ${result.safetyNote ? `<p class="coach-safety">${escapeHtml(result.safetyNote)}</p>` : ''}
  </div>`;
}

export function coachAnalysisCardMarkup(scope, analysis = null) {
  const label = scopeLabels[scope] || 'Coach-Analyse';
  return `<section class="coach-insight-card" data-coach-card="${escapeHtml(scope)}">
    <header><div><span class="coach-spark" aria-hidden="true">${materialIconMarkup('stars')}</span><span><b>CAPBOY Coach</b><small>${escapeHtml(label)}</small></span></div>${analysis?.created_at ? `<time datetime="${escapeHtml(analysis.created_at)}">${new Date(analysis.created_at).toLocaleDateString('de-DE')}</time>` : ''}</header>
    <div data-coach-card-content>${analysis?.result ? resultMarkup(analysis.result, { compact: true }) : `<div class="coach-empty"><b>Noch keine KI-Einordnung</b><p>CAPBOY verbindet die berechneten Werte mit Training, Ernährung, Schlaf, Erholung und Routinen.</p></div>`}</div>
    <div class="coach-card-actions">
      <button class="btn coach-analyse-button" type="button" data-coach-analyse>${analysis ? 'Neu analysieren' : 'Jetzt analysieren'}</button>
      <button class="coach-ask-button" type="button" data-coach-ask>Mit Coach besprechen</button>
    </div>
    <p class="coach-disclaimer">KI-Einordnung auf Basis deiner CAPBOY-Daten · keine medizinische Diagnose</p>
  </section>`;
}

async function latestAnalysis(userId, scope) {
  const { data, error } = await supabase.from('ai_coach_analyses').select('result,created_at,data_from,data_to')
    .eq('user_id', userId).eq('scope', scope).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
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

export async function mountCoachInsight(container, { userId, scope }) {
  if (!container) return;
  let analysis = null;
  try { analysis = await latestAnalysis(userId, scope); } catch {}
  container.innerHTML = coachAnalysisCardMarkup(scope, analysis);
  const analyse = container.querySelector('[data-coach-analyse]');
  analyse.onclick = async () => {
    analyse.disabled = true;
    analyse.textContent = 'CAPBOY analysiert …';
    container.querySelector('[data-coach-card-content]').innerHTML = '<div class="coach-loading"><span></span><p>Werte und Zusammenhänge werden im Gesamtbild geprüft.</p></div>';
    try {
      const response = await invokeCoach(scope);
      container.querySelector('[data-coach-card-content]').innerHTML = resultMarkup(response.result, { compact: true });
      analyse.textContent = 'Neu analysieren';
    } catch (error) {
      container.querySelector('[data-coach-card-content]').innerHTML = `<div class="coach-empty"><b>Analyse nicht verfügbar</b><p>${escapeHtml(error?.message || 'Bitte versuche es später erneut.')}</p></div>`;
      analyse.textContent = 'Erneut versuchen';
    } finally {
      analyse.disabled = false;
    }
  };
  container.querySelector('[data-coach-ask]').onclick = () => openCoachQuestion({
    scope,
    question: scope === 'sleep'
      ? 'Ordne meine Schlafentwicklung im Zusammenhang mit Training, Ernährung, Erholung und Routinen ein.'
      : scope === 'skinfold'
        ? 'Welche Hautfalten-Strategie ist anhand meines Gesamtbilds derzeit am sinnvollsten und welche Annahmen sind unsicher?'
        : 'Erkläre mir meine aktuelle Körperkomposition im Gesamtbild und priorisiere die nächsten Schritte.',
  });
}

function chatMessageMarkup(message) {
  const result = message.context?.result;
  return `<article class="coach-message ${message.role === 'user' ? 'coach-message-user' : 'coach-message-assistant'}">
    <small>${message.role === 'user' ? 'DU' : 'CAPBOY COACH'}</small>
    ${result ? resultMarkup(result) : `<p>${escapeHtml(message.content)}</p>`}
  </article>`;
}

async function loadMessages(userId) {
  const { data, error } = await supabase.from('ai_coach_messages').select('role,content,context,created_at')
    .eq('user_id', userId).order('created_at', { ascending: true }).limit(60);
  if (error) throw error;
  return data || [];
}

export async function mountCoachPage(container, { userId, signal }) {
  let pending = {};
  try { pending = JSON.parse(sessionStorage.getItem(CONTEXT_KEY) || '{}'); } catch {}
  sessionStorage.removeItem(CONTEXT_KEY);
  container.classList.add('coach-page');
  container.innerHTML = `<main class="coach-shell">
    <header class="coach-hero">
      <span class="coach-spark" aria-hidden="true">${materialIconMarkup('stars')}</span>
      <div><small>PERSÖNLICHER COACH</small><h1>Frag CAPBOY</h1><p>Antworten aus deinem Gesamtbild – nicht aus einem einzelnen Messwert.</p></div>
    </header>
    <section class="coach-context" aria-label="Einbezogene Bereiche">
      <b>Wird gemeinsam betrachtet</b><div><span>COMP</span><span>TRAINING</span><span>ERNÄHRUNG</span><span>SCHLAF</span><span>ERHOLUNG</span><span>ROUTINEN</span></div>
    </section>
    <div class="coach-quick-questions">
      <button type="button">Was bremst aktuell meinen Fortschritt?</button>
      <button type="button">Was sollte ich in den nächsten 14 Tagen priorisieren?</button>
      <button type="button">Passen Training, Ernährung und Erholung zu meinem Ziel?</button>
    </div>
    <section class="coach-chat" data-coach-chat aria-live="polite"><div class="coach-loading"><span></span><p>Coach-Verlauf wird geladen.</p></div></section>
    <form class="coach-form" data-coach-form>
      <label for="coach-question">Deine Frage</label>
      <textarea id="coach-question" rows="3" maxlength="2000" placeholder="Zum Beispiel: Warum stagniert mein Fortschritt, obwohl ich regelmäßig trainiere?">${escapeHtml(pending.question || '')}</textarea>
      <button class="btn btn-primary" type="submit">Coach fragen</button>
    </form>
    <p class="coach-disclaimer">CAPBOY erkennt Muster und gibt Empfehlungen, ersetzt aber keine medizinische Untersuchung.</p>
  </main>`;
  const chat = container.querySelector('[data-coach-chat]');
  const form = container.querySelector('[data-coach-form]');
  const field = form.querySelector('textarea');
  let messages = [];
  try {
    messages = await loadMessages(userId);
    if (signal?.aborted) return;
    chat.innerHTML = messages.length ? messages.map(chatMessageMarkup).join('') : '<div class="coach-welcome"><b>Ich betrachte dein Gesamtbild.</b><p>Frage nach Training, Ernährung, Schlaf, Körperkomposition oder danach, was du als Nächstes priorisieren solltest.</p></div>';
  } catch {
    chat.innerHTML = '<div class="coach-welcome"><b>Der Verlauf konnte nicht geladen werden.</b><p>Du kannst trotzdem eine neue Frage stellen.</p></div>';
  }
  container.querySelectorAll('.coach-quick-questions button').forEach((button) => {
    button.onclick = () => { field.value = button.textContent; field.focus(); };
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    const question = field.value.trim();
    if (question.length < 2) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Coach denkt …';
    chat.insertAdjacentHTML('beforeend', chatMessageMarkup({ role: 'user', content: question }));
    const waiting = document.createElement('div');
    waiting.className = 'coach-loading coach-chat-waiting';
    waiting.innerHTML = '<span></span><p>CAPBOY verbindet alle relevanten Bereiche.</p>';
    chat.append(waiting);
    waiting.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    try {
      const response = await invokeCoach('coach', question);
      waiting.remove();
      chat.insertAdjacentHTML('beforeend', chatMessageMarkup({ role: 'assistant', content: response.result.summary, context: { result: response.result } }));
      field.value = '';
      chat.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (error) {
      waiting.remove();
      toast(error?.message || 'Coach konnte nicht antworten.');
    } finally {
      button.disabled = false;
      button.textContent = 'Coach fragen';
    }
  };
}
