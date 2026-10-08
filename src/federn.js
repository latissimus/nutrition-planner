// Federn einer Kapsel (Menüband, Chat-Eingabe): gemeinsam für main.js und
// coach.js, damit beide genau denselben Effekt haben.

/* Federn einer Kapsel: Rahmen und Fläche (::before) werden per CSS kurz 3 %
   größer (leiste-federn). Der Inhalt wird nicht skaliert, er rückt nur so
   weit nach außen, wie es der Vergrößerung entspricht – jedes Element um den
   Mittelpunkt der Kapsel, mit demselben Zeitverlauf. Auf dem iPhone Bild für
   Bild gemessen: Wurde der Inhalt mitskaliert, rasterte iOS die Symbole in
   höherer Auflösung, und am Ende sprangen sie um 1–2 px an ihren Platz. Die
   Größe der Symbole ändert sich bei 3 % ohnehin um weniger als einen Pixel. */
export const FEDERN_MS = 520;
export const FEDERN_SKALA = 1.03;
export function inhaltMitfedern(kapsel, elemente) {
  if (!kapsel || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const k = kapsel.getBoundingClientRect();
  // Eingeklappt beginnt die sichtbare Kapsel tiefer (::before mit top).
  const oben = Math.max(0, parseFloat(getComputedStyle(kapsel, '::before').top) || 0);
  const mitteX = k.left + k.width / 2;
  const mitteY = k.top + oben + (k.height - oben) / 2;
  for (const element of elemente) {
    const r = element.getBoundingClientRect();
    if (!r.width || r.right < k.left || r.left > k.right) continue;
    const dx = (FEDERN_SKALA - 1) * (r.left + r.width / 2 - mitteX);
    const dy = (FEDERN_SKALA - 1) * (r.top + r.height / 2 - mitteY);
    // Die Auswahl-Pille trägt ihre Position in transform; sie rückt über translate.
    const pille = element.classList.contains('app-dex-auswahl');
    const ruhe = pille ? '0px 0px' : 'translate(0px, 0px)';
    const aussen = pille ? `${dx}px ${dy}px` : `translate(${dx}px, ${dy}px)`;
    const eigenschaft = pille ? 'translate' : 'transform';
    element.animate([
      { [eigenschaft]: ruhe, easing: 'cubic-bezier(.25,.1,.25,1)' },
      { [eigenschaft]: aussen, offset: 0.38, easing: 'cubic-bezier(.45,0,.2,1)' },
      { [eigenschaft]: ruhe },
    ], { duration: FEDERN_MS });
  }
}
