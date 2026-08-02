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

const typeLabels = { image: 'Bild', note: 'Notiz', video: 'Video' };

export function dexEntryCardMarkup(entry = {}, { iconMarkup = '' } = {}) {
  const type = ['image', 'note', 'video'].includes(entry.type) ? entry.type : 'note';
  const title = escapeHtml(entry.title || typeLabels[type]);
  const excerpt = escapeHtml(entry.excerpt || entry.note || '');
  const source = escapeHtml(entry.source || 'MUSCLE-DEX');
  const color = escapeHtml(entry.color || '#A9DCE8');
  const image = entry.previewUrl
    ? `<span class="dex-inhaltskarte-vorschau"><img src="${escapeHtml(entry.previewUrl)}" alt="" loading="lazy"></span>`
    : '';
  const href = entry.href ? ` href="${escapeHtml(entry.href)}"` : '';
  const tag = href ? 'a' : 'article';

  return `<${tag} class="dex-inhaltskarte dex-inhaltskarte-${type}"${href} style="--eintrag-farbe:${color}">
    <span class="dex-inhaltskarte-streifen" aria-hidden="true"></span>
    ${image}
    <span class="dex-inhaltskarte-body">
      <span class="dex-inhaltskarte-kopf">
        <span class="dex-inhaltskarte-icon" aria-hidden="true">${iconMarkup}</span>
        <small>${typeLabels[type]}</small>
      </span>
      <strong>${title}</strong>
      ${excerpt ? `<span class="dex-inhaltskarte-text">${excerpt}</span>` : ''}
      <span class="dex-inhaltskarte-meta">${source}</span>
    </span>
  </${tag}>`;
}
