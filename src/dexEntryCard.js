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

const typeLabels = { image: 'Bild', note: 'Notiz', link: 'Link', video: 'Video' };

export function dexEntryCardMarkup(entry = {}, { iconMarkup = '', darkColor = false } = {}) {
  const type = ['image', 'note', 'link', 'video'].includes(entry.type) ? entry.type : 'note';
  const title = escapeHtml(entry.title || typeLabels[type]);
  const excerpt = escapeHtml(entry.excerpt || entry.note || '');
  const color = escapeHtml(entry.color || '#A9DCE8');
  const image = entry.previewUrl
    ? `<span class="dex-inhaltskarte-vorschau${type === 'video' ? ' dex-video-vorschau' : ''}"><img src="${escapeHtml(entry.previewUrl)}" alt="" loading="lazy">${type === 'video' && entry.playable ? `<i>${iconMarkup}</i>` : ''}</span>`
    : (entry.previewMarkup || '');
  const detailHref = escapeHtml(entry.detailHref || '#home');

  return `<article class="dex-inhaltskarte dex-inhaltskarte-${type}${darkColor ? ' eintrag-farbe-dunkel' : ''}" data-dex-entry-id="${escapeHtml(entry.id || '')}" style="--eintrag-farbe:${color}">
    <a class="dex-inhaltskarte-oeffnen" href="${detailHref}" aria-label="${title} öffnen"></a>
    <button class="dex-favorit${entry.favorite ? ' aktiv' : ''}" type="button" data-dex-favorite aria-pressed="${entry.favorite ? 'true' : 'false'}" aria-label="${entry.favorite ? 'Aus Favoriten entfernen' : 'Als Favorit markieren'}">${entry.favorite ? '★' : '☆'}</button>
    <span class="dex-inhaltskarte-streifen" aria-hidden="true"></span>
    ${image}
    <span class="dex-inhaltskarte-body">
      <strong>${title}</strong>
      ${excerpt ? `<span class="dex-inhaltskarte-text">${excerpt}</span>` : ''}
    </span>
  </article>`;
}
