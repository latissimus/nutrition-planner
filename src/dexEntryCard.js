/*
 * Reservierte Inhaltskarte fuer Bilder, Notizen und Videolinks.
 *
 * Sie bewahrt die fruehere Unter-DEX-Formsprache (weisse Karte, schmaler
 * Farbstreifen, farbiges Iconfeld und harter Retroschatten) und kombiniert
 * sie mit einer kompakten Link-/Medienvorschau. Die Komponente wird erst von
 * den kuenftigen Inhaltstabellen eingebunden; bis dahin zeichnet sie nichts.
 */
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const typeLabels = { image: 'Bild', note: 'Notiz', routine: 'Routine', link: 'Link', video: 'Video', audio: 'Tonaufnahme' };

export function dexEntryCardMarkup(entry = {}, { iconMarkup = '', favoriteMarkup = '', darkColor = false } = {}) {
  const type = ['image', 'note', 'routine', 'link', 'video', 'audio'].includes(entry.type) ? entry.type : 'note';
  const title = escapeHtml(entry.title || typeLabels[type]);
  const excerpt = escapeHtml(entry.excerpt || entry.note || '');
  const color = escapeHtml(entry.color || '#A9DCE8');
  const image = entry.previewUrl
    ? `<span class="dex-inhaltskarte-vorschau hat-vorschaubild${type === 'video' ? ' dex-video-vorschau' : ''}"><img src="${escapeHtml(entry.previewUrl)}" alt="" loading="lazy">${type === 'video' && entry.playable ? `<i>${iconMarkup}</i>` : ''}</span>`
    : (entry.previewMarkup || '');
  const detailHref = escapeHtml(entry.detailHref || '#home');

  return `<article class="dex-inhaltskarte dex-inhaltskarte-${type}${darkColor ? ' eintrag-farbe-dunkel' : ''}" data-dex-entry-id="${escapeHtml(entry.id || '')}" style="--eintrag-farbe:${color}">
    <a class="dex-inhaltskarte-oeffnen" href="${detailHref}" aria-label="${title} öffnen"></a>
    ${entry.favorite ? `<span class="dex-favorit-marker" aria-label="Favorit">${favoriteMarkup}</span>` : ''}
    <span class="dex-inhaltskarte-streifen" aria-hidden="true"></span>
    ${image}
    <span class="dex-inhaltskarte-body">
      <strong>${title}</strong>
      ${excerpt ? `<span class="dex-inhaltskarte-text">${excerpt}</span>` : ''}
    </span>
  </article>`;
}
