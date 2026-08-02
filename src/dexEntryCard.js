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

export function dexEntryCardMarkup(entry = {}, { iconMarkup = '' } = {}) {
  const type = ['image', 'note', 'link', 'video'].includes(entry.type) ? entry.type : 'note';
  const title = escapeHtml(entry.title || typeLabels[type]);
  const excerpt = escapeHtml(entry.excerpt || entry.note || '');
  const source = escapeHtml(entry.source || 'MUSCLE-DEX');
  const color = escapeHtml(entry.color || '#A9DCE8');
  const image = entry.previewUrl
    ? `<span class="dex-inhaltskarte-vorschau"><img src="${escapeHtml(entry.previewUrl)}" alt="" loading="lazy"></span>`
    : '';
  const href = entry.href ? escapeHtml(entry.href) : '';

  return `<article class="dex-inhaltskarte dex-inhaltskarte-${type}" data-dex-entry-id="${escapeHtml(entry.id || '')}" style="--eintrag-farbe:${color}">
    <span class="dex-inhaltskarte-streifen" aria-hidden="true"></span>
    ${image}
    <span class="dex-inhaltskarte-body">
      <span class="dex-inhaltskarte-kopf">
        <span class="dex-inhaltskarte-icon" aria-hidden="true">${iconMarkup}</span>
        <small>${typeLabels[type]}</small>
      </span>
      ${href ? `<a class="dex-inhaltskarte-link" href="${href}" target="_blank" rel="noopener noreferrer"><strong>${title}</strong></a>` : `<strong>${title}</strong>`}
      ${excerpt ? `<span class="dex-inhaltskarte-text">${excerpt}</span>` : ''}
      <span class="dex-inhaltskarte-fuss"><span class="dex-inhaltskarte-meta">${source}</span><button type="button" data-dex-entry-delete>Löschen</button></span>
    </span>
  </article>`;
}
