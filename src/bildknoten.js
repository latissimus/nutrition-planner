/* Bilder und Bild-Symbole beim Neuzeichnen übernehmen statt neu anlegen.
   Die Seitensymbole sind SVGs mit eingebetteten Pixelbildern, Vorschaubilder
   und Coin sind <img>. Ein neu angelegtes Bild dekodiert iOS mitunter erst
   verzögert: Es fehlte dann einen Moment, blendete neu ein oder ruckte. Ein
   unverändertes Element wird deshalb samt fertig dekodiertem Bild an die neue
   Stelle verschoben. */
const AUSWAHL = 'img, .icon-originalfarben, [data-category-icon]';

// Bilder nach Quelle, Symbole nach ihrem vollständigen Markup. Zustandsklassen
// wie ist-geladen zählen nicht, die neue Fassung kennt sie noch nicht.
const schluessel = (knoten) => (knoten.tagName === 'IMG'
  ? `img|${knoten.getAttribute('src') || ''}`
  : knoten.outerHTML);

// Nur die äußersten Treffer: ein <img> in einem Symbol wandert mit diesem.
function aeussere(wurzel) {
  return [...wurzel.querySelectorAll(AUSWAHL)].filter((knoten) => {
    const huelle = knoten.parentElement?.closest(AUSWAHL);
    return !huelle || !wurzel.contains(huelle);
  });
}

// Ein Bild, das noch lädt (etwa per loading="lazy" außerhalb des Bildes),
// bleibt in der neuen Fassung: Sie hat seinen Ladevorgang schon angestoßen.
const fertig = (knoten) => knoten.tagName !== 'IMG' || (knoten.complete && knoten.naturalWidth > 0);

export function bildknotenUebernehmen(alt, neu) {
  if (!alt || !neu) return;
  const vorrat = new Map();
  for (const knoten of aeussere(alt)) {
    if (!fertig(knoten)) continue;
    const eintrag = schluessel(knoten);
    if (!vorrat.has(eintrag)) vorrat.set(eintrag, []);
    vorrat.get(eintrag).push(knoten);
  }
  if (!vorrat.size) return;
  for (const knoten of aeussere(neu)) {
    const passend = vorrat.get(schluessel(knoten))?.shift();
    if (!passend) continue;
    if (knoten.tagName === 'IMG') {
      // Klassen und Attribute der neuen Fassung, Ladezustand der alten.
      const geladen = passend.classList.contains('ist-geladen');
      for (const { name, value } of knoten.attributes) {
        if (name !== 'src') passend.setAttribute(name, value);
      }
      if (geladen) passend.classList.add('ist-geladen');
    }
    knoten.replaceWith(passend);
  }
}

// Markup in einen Container setzen und dabei vorhandene Bilder übernehmen.
export function markupMitBildernSetzen(ziel, markup) {
  const vorlage = document.createElement('template');
  vorlage.innerHTML = markup;
  bildknotenUebernehmen(ziel, vorlage.content);
  ziel.replaceChildren(vorlage.content);
}
