import { getPreference, setPreference } from './userPreferences.js';

const prefix = 'muscledex:gesten-hinweis:';
let activeHint = null;

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function closeHint(node) {
  if (!node?.isConnected) return;
  node.gestureTarget?.classList.remove('gesten-hinweis-ziel');
  node.classList.remove('sichtbar');
  window.setTimeout(() => node.remove(), 180);
  if (activeHint === node) activeHint = null;
}

/**
 * Zeigt einen kompakten, kontogebundenen Bedienhinweis genau einmal.
 * Der Status wird sofort gespeichert: Ein Seitenwechsel erzeugt deshalb
 * weder denselben Hinweis erneut noch eine Serie störender Pop-ups.
 */
export function showGestureHintOnce({ key, title, text, gesture = 'hold', target = null, replace = false }) {
  const preferenceKey = `${prefix}${key}`;
  if (!key || getPreference(preferenceKey, false)) return false;
  // Pro Ansicht erscheint höchstens ein Coachmark. Ein weiterer Hinweis wird
  // noch nicht als gesehen markiert und kann beim nächsten passenden Besuch
  // gezeigt werden.
  if (activeHint?.isConnected && !replace) return false;
  if (activeHint?.isConnected) {
    activeHint.gestureTarget?.classList.remove('gesten-hinweis-ziel');
    activeHint.remove();
    activeHint = null;
  }
  setPreference(preferenceKey, true);

  const node = document.createElement('aside');
  node.className = 'gesten-hinweis';
  node.setAttribute('role', 'status');
  node.setAttribute('aria-label', 'Bedienhinweis');
  node.innerHTML = `<span class="gesten-hinweis-symbol ${gesture}" aria-hidden="true">
      ${gesture === 'swipe' ? '<i>←</i><b>●</b><i>→</i>' : gesture === 'add' ? '<b>＋</b>' : '<b>●</b><i></i>'}
    </span>
    <span class="gesten-hinweis-text"><b>${escapeHtml(title)}</b><small>${escapeHtml(text)}</small></span>
    <button type="button" aria-label="Hinweis schließen">×</button>`;
  node.querySelector('button').onclick = () => closeHint(node);
  if (target instanceof Element) {
    node.gestureTarget = target;
    target.classList.add('gesten-hinweis-ziel');
  }
  document.body.append(node);
  activeHint = node;
  requestAnimationFrame(() => node.classList.add('sichtbar'));
  window.setTimeout(() => closeHint(node), 9000);
  return true;
}
