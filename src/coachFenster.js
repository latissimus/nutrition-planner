// Bausteine aller Coach-Seiten im Retro-Look: die Kopfleiste, die dort den
// App-Kopf ersetzt, und Fenster mit Titelleiste und Fensterknöpfen. "_"
// klappt ein Fenster ein; die beiden anderen Knöpfe sind nur Dekor.

import { materialIconMarkup } from './categoryIcons.js';
import { coachIconMarkup } from './menuIcons.js';

export const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// von: 'coach' (violett, links), 'user' (pink, rechts) oder 'bereich'
// (violett, volle Breite, etwa ein Abschnitt der Gedächtnis-Seite).
export function fensterMarkup({ von = 'coach', titel = '', bild = null, inhalt = '', avatar = '', runde = null, klasse = '' } = {}) {
  const nutzer = von === 'user';
  const symbol = bild ?? (nutzer ? `<span class="coach-chat-avatar">${avatar}</span>` : coachIconMarkup('coach-chat-cap'));
  const art = nutzer ? 'is-user' : von === 'bereich' ? 'is-coach is-bereich' : 'is-coach';
  return `<article class="coach-chat-window ${art}${klasse ? ` ${klasse}` : ''}"${runde == null ? '' : ` data-runde="${runde}"`}>
    <header>${symbol}<b>${escapeHtml(titel || (nutzer ? 'Du' : 'CAPBOY'))}</b><span class="coach-fenster-knoepfe"><button type="button" data-fenster-einklappen aria-expanded="true" aria-label="Fenster einklappen">_</button><span aria-hidden="true">□</span><span aria-hidden="true">×</span></span></header>
    <div class="coach-chat-message">${inhalt}</div>
  </article>`;
}

// Kopfleiste der Coach-Seiten: Zurück, Titel, rechts weitere Knöpfe.
export function kopfMarkup({ zurueck = 'body', zurueckLabel = 'Zurück', titel = 'CAPBOY', rechts = '' } = {}) {
  return `<div class="coach-kopf-band"><header class="coach-kopf">
    <a class="coach-kopf-knopf" href="#${escapeHtml(zurueck)}" aria-label="${escapeHtml(zurueckLabel)}">${materialIconMarkup('arrow_back_ios')}</a>
    <span class="coach-kopf-titel">${coachIconMarkup('coach-kopf-cap')}<b>${escapeHtml(titel)}</b></span>
    ${rechts}
  </header></div>`;
}

// Klick auf "_": Fenster ein- oder ausklappen. true, wenn der Klick das war.
export function fensterEinklappen(event) {
  const knopf = event.target.closest('[data-fenster-einklappen]');
  if (!knopf) return false;
  const zu = knopf.closest('.coach-chat-window').classList.toggle('ist-eingeklappt');
  knopf.setAttribute('aria-expanded', String(!zu));
  knopf.setAttribute('aria-label', zu ? 'Fenster aufklappen' : 'Fenster einklappen');
  return true;
}
