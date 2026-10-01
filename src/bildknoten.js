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
    // Der neue Rahmen einer Vorschau wartete auf das Laden seines eigenen,
    // jetzt ersetzten Bildes; ohne diese Zeile bliebe der Lade-Schimmer stehen.
    if (passend.classList?.contains('ist-geladen')) {
      passend.closest('.dex-inhaltskarte-vorschau')?.classList.add('hat-vorschaubild', 'vorschau-geladen');
    }
  }
}

// Markup in einen Container setzen und dabei vorhandene Bilder übernehmen.
export function markupMitBildernSetzen(ziel, markup) {
  const vorlage = document.createElement('template');
  vorlage.innerHTML = markup;
  bildknotenUebernehmen(ziel, vorlage.content);
  ziel.replaceChildren(vorlage.content);
}

/* Einen Container an neues Markup angleichen, statt ihn neu zu füllen: Nur
   abweichende Attribute, Texte und Knoten werden geändert, gleiche Knoten
   bleiben unberührt im Dokument. Für Header und Menüband – dort wurden sonst
   bei jedem Seitenwechsel alle Symbole aus- und wieder eingehängt, und iOS
   rechnete ihre eingebetteten Bilder neu (die Symbole ruckten). Nur für
   Bereiche ohne Listener an einzelnen Kindern verwenden. */
const gleicheArt = (a, b) => a.nodeType === b.nodeType
  && a.nodeName === b.nodeName && a.namespaceURI === b.namespaceURI;

function attributeAngleichen(alt, neu) {
  for (const attribut of [...alt.attributes]) {
    if (!neu.hasAttributeNS(attribut.namespaceURI, attribut.localName)) {
      alt.removeAttributeNS(attribut.namespaceURI, attribut.localName);
    }
  }
  for (const attribut of neu.attributes) {
    if (alt.getAttributeNS(attribut.namespaceURI, attribut.localName) !== attribut.value) {
      alt.setAttributeNS(attribut.namespaceURI, attribut.name, attribut.value);
    }
  }
}

// Für jedes neue Kind wird das nächste passende alte Kind gesucht (gleicher
// Knotentyp und Tag), nicht nur das an derselben Stelle: Kommen etwa die drei
// Punkte am offenen Reiter hinzu, verschob sich sonst alles dahinter, und das
// Symbol wurde ersetzt statt behalten.
function kinderAngleichen(alt, neu) {
  const alteKinder = [...alt.childNodes];
  const benutzt = new Set();
  let zeiger = 0;
  for (const kind of [...neu.childNodes]) {
    let treffer = -1;
    if (kind.nodeType === Node.ELEMENT_NODE) {
      for (let index = zeiger; index < alteKinder.length; index += 1) {
        if (gleicheArt(alteKinder[index], kind)) { treffer = index; break; }
      }
    } else if (alteKinder[zeiger] && gleicheArt(alteKinder[zeiger], kind)) {
      // Text nur an Ort und Stelle übernehmen. Eine Suche nach vorn sprang
      // sonst über das nächste Element hinweg (das Leerzeichen hinter den
      // neuen Punkten traf das Leerzeichen HINTER dem Symbol), und das
      // Symbol des getippten Reiters wurde neu angelegt.
      treffer = zeiger;
    }
    if (treffer < 0) {
      alt.insertBefore(kind, alteKinder[zeiger] || null);
      continue;
    }
    const vorhanden = alteKinder[treffer];
    benutzt.add(vorhanden);
    zeiger = treffer + 1;
    if (kind.nodeType === Node.ELEMENT_NODE) {
      attributeAngleichen(vorhanden, kind);
      kinderAngleichen(vorhanden, kind);
    } else if (vorhanden.nodeValue !== kind.nodeValue) {
      vorhanden.nodeValue = kind.nodeValue;
    }
  }
  alteKinder.forEach((kind) => { if (!benutzt.has(kind)) kind.remove(); });
}

export function markupAngleichen(ziel, markup) {
  const vorlage = document.createElement('template');
  vorlage.innerHTML = markup;
  kinderAngleichen(ziel, vorlage.content);
}
