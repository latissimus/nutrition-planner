// Baustein aller Coach-Seiten: exakt das kompakte Retro-Chatfenster der
// Referenz. Die drei Fenstersymbole sind rein dekorativ.

import { coachIconMarkup } from './menuIcons.js';

export const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// von: 'coach' (links), 'user' (rechts) oder 'bereich' (volle Breite).
export function fensterMarkup({ von = 'coach', titel = '', bild = null, inhalt = '', avatar = '', runde = null, klasse = '' } = {}) {
  const nutzer = von === 'user';
  const symbol = bild ?? (nutzer ? `<span class="coach-chat-avatar">${avatar}</span>` : coachIconMarkup('coach-chat-cap'));
  const art = nutzer ? 'is-user' : von === 'bereich' ? 'is-coach is-bereich' : 'is-coach';
  return `<article class="coach-chat-window ${art}${klasse ? ` ${klasse}` : ''}"${runde == null ? '' : ` data-runde="${runde}"`}>
    <header>${symbol}<b>${escapeHtml(titel || (nutzer ? 'Du' : 'Coach'))}</b><span class="coach-fenster-knoepfe" aria-hidden="true"><i>−</i><i>□</i><i>×</i></span></header>
    <div class="coach-chat-message">${inhalt}</div>
  </article>`;
}
