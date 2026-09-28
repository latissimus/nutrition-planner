// Baustein aller Coach-Seiten im Retro-Look: Fenster mit Titelleiste. Die
// Leiste nennt, wer spricht; Fensterknöpfe gibt es bewusst nicht, weil sie im
// Chat nichts zu tun hätten.

import { coachIconMarkup } from './menuIcons.js';

export const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// von: 'coach' (violett, links), 'user' (blau, rechts) oder 'bereich'
// (violett, volle Breite, etwa ein Abschnitt der Gedächtnis-Seite).
export function fensterMarkup({ von = 'coach', titel = '', bild = null, inhalt = '', avatar = '', runde = null, klasse = '' } = {}) {
  const nutzer = von === 'user';
  const symbol = bild ?? (nutzer ? `<span class="coach-chat-avatar">${avatar}</span>` : coachIconMarkup('coach-chat-cap'));
  const art = nutzer ? 'is-user' : von === 'bereich' ? 'is-coach is-bereich' : 'is-coach';
  return `<article class="coach-chat-window ${art}${klasse ? ` ${klasse}` : ''}"${runde == null ? '' : ` data-runde="${runde}"`}>
    <header>${symbol}<b>${escapeHtml(titel || (nutzer ? 'Du' : 'Coach'))}</b></header>
    <div class="coach-chat-message">${inhalt}</div>
  </article>`;
}
