// Leichte Rich-Text-Notizen: eine kleine Format-Leiste (Fett, Unterstrichen,
// Überschrift, Liste) über einem contenteditable-Feld. Gespeichert wird streng
// bereinigtes HTML (nur eine Whitelist erlaubter Tags, keine Attribute), das
// beim Anzeigen ERNEUT bereinigt wird – so ist gespeicherter Inhalt selbst dann
// XSS-sicher, wenn er auf anderem Weg manipuliert wurde.

const ALLOWED = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'H3', 'UL', 'OL', 'LI']);
// Formatierungen auf die Whitelist normalisieren (b→strong, größere Headings→h3).
const TAG_MAP = { B: 'STRONG', I: 'EM', H1: 'H3', H2: 'H3', H4: 'H3', H5: 'H3', H6: 'H3', DIV: 'P' };

const escapeText = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeAttr = (value = '') => escapeText(value).replaceAll('"', '&quot;');

// Enthält der Wert bereits (unser) HTML-Markup? Sonst = Alt-Notiz als Klartext.
function looksLikeHtml(value) {
  return /<(p|br|strong|em|u|h3|ul|ol|li|b|i|div)\b/i.test(String(value || ''));
}

// Rekursiv nur erlaubte Elemente übernehmen, unbekannte Tags entfernen (Text
// bleibt erhalten), sämtliche Attribute verwerfen.
function appendClean(source, target) {
  source.childNodes.forEach((node) => {
    if (node.nodeType === 3) { // Text
      target.appendChild(document.createTextNode(node.nodeValue));
      return;
    }
    if (node.nodeType !== 1) return; // nur Elemente sonst
    const tag = TAG_MAP[node.tagName.toUpperCase()] || node.tagName.toUpperCase();
    if (ALLOWED.has(tag)) {
      const el = document.createElement(tag);
      appendClean(node, el);
      target.appendChild(el);
    } else {
      appendClean(node, target); // Tag verwerfen, Inhalt behalten
    }
  });
}

// Reiner Klartext ohne DOM (Test-/SSR-Umgebung): Tags grob entfernen.
const stripTags = (value = '') => String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function sanitizeNoteHtml(input) {
  // In Umgebungen ohne DOM (Node/Tests) nur Text zurückgeben, statt zu crashen.
  if (typeof document === 'undefined') return stripTags(input);
  const template = document.createElement('template');
  template.innerHTML = String(input || ''); // inert, führt kein Skript aus
  const output = document.createElement('div');
  appendClean(template.content, output);
  return output.innerHTML.trim();
}

// Für die Anzeige: HTML bereinigen, Alt-Klartext escapen + Zeilenumbrüche wandeln.
export function renderNoteHtml(value) {
  if (!value) return '';
  if (looksLikeHtml(value)) return sanitizeNoteHtml(value);
  return escapeText(value).replace(/\r?\n/g, '<br>');
}

// Startinhalt fürs Editorfeld (gleiche Logik wie Anzeige).
function initialHtml(value) {
  return renderNoteHtml(value);
}

// Markup für das Notizfeld inkl. Format-Leiste. `id` bleibt am contenteditable,
// damit bestehende Selektoren es weiter finden.
export function noteEditorMarkup(id, value = '', { placeholder = '', required = false } = {}) {
  return `<div class="rte" data-rte>
    <div class="rte-toolbar" data-rte-toolbar role="toolbar" aria-label="Textformatierung">
      <button type="button" data-rte-cmd="bold" aria-label="Fett" title="Fett"><b>B</b></button>
      <button type="button" data-rte-cmd="underline" aria-label="Unterstrichen" title="Unterstrichen"><span style="text-decoration:underline">U</span></button>
      <button type="button" data-rte-cmd="heading" aria-label="Überschrift" title="Überschrift">H</button>
      <button type="button" data-rte-cmd="list" aria-label="Liste" title="Liste">&#8226;&#8202;&#8801;</button>
    </div>
    <div class="rte-area input" id="${id}" data-rte-area contenteditable="true" role="textbox" aria-multiline="true"${placeholder ? ` data-placeholder="${escapeAttr(placeholder)}"` : ''}${required ? ' data-required="true"' : ''}>${initialHtml(value)}</div>
  </div>`;
}

function updateToolbar(toolbar) {
  const state = (cmd) => { try { return document.queryCommandState(cmd); } catch { return false; } };
  const istH3 = () => { try { return (document.queryCommandValue('formatBlock') || '').toLowerCase() === 'h3'; } catch { return false; } };
  toolbar.querySelectorAll('[data-rte-cmd]').forEach((btn) => {
    const cmd = btn.dataset.rteCmd;
    const aktiv = cmd === 'bold' ? state('bold')
      : cmd === 'underline' ? state('underline')
        : cmd === 'list' ? state('insertUnorderedList')
          : cmd === 'heading' ? istH3() : false;
    btn.classList.toggle('aktiv', aktiv);
  });
}

// Bindet die Format-Leisten in `root` an ihre contenteditable-Felder.
export function mountNoteEditors(root) {
  root.querySelectorAll('[data-rte]').forEach((rte) => {
    if (rte.dataset.rteReady) return;
    const area = rte.querySelector('[data-rte-area]');
    const toolbar = rte.querySelector('[data-rte-toolbar]');
    if (!area || !toolbar) return;
    rte.dataset.rteReady = '1';
    // mousedown abfangen, damit der Button nicht den Fokus/die Auswahl klaut.
    toolbar.addEventListener('mousedown', (event) => { if (event.target.closest('[data-rte-cmd]')) event.preventDefault(); });
    toolbar.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-rte-cmd]'); if (!btn) return;
      area.focus();
      const cmd = btn.dataset.rteCmd;
      if (cmd === 'bold') document.execCommand('bold');
      else if (cmd === 'underline') document.execCommand('underline');
      else if (cmd === 'list') document.execCommand('insertUnorderedList');
      else if (cmd === 'heading') {
        const istH3 = (() => { try { return (document.queryCommandValue('formatBlock') || '').toLowerCase() === 'h3'; } catch { return false; } })();
        document.execCommand('formatBlock', false, istH3 ? 'p' : 'h3');
      }
      updateToolbar(toolbar);
    });
    const sync = () => updateToolbar(toolbar);
    area.addEventListener('keyup', sync);
    area.addEventListener('mouseup', sync);
    area.addEventListener('focus', sync);
  });
}

// Liest den bereinigten Notizwert aus einem Feld (contenteditable oder – als
// Rückfall – textarea). Leerer Inhalt ergibt ''.
export function readNote(element) {
  if (!element) return '';
  if (element.tagName === 'TEXTAREA') return element.value.trim();
  const html = sanitizeNoteHtml(element.innerHTML);
  const probe = document.createElement('div');
  probe.innerHTML = html;
  return probe.textContent.trim() ? html : '';
}

// Klartext-Fassung (z. B. für Titel-Fallback aus der ersten Zeile).
export function readNoteText(element) {
  if (!element) return '';
  if (element.tagName === 'TEXTAREA') return element.value;
  return element.textContent || '';
}

// Reiner Klartext eines gespeicherten Notizwerts (für Karten-Vorschau, Teilen …).
export function noteToText(value) {
  if (!value) return '';
  if (typeof document === 'undefined') return stripTags(value);
  const div = document.createElement('div');
  div.innerHTML = renderNoteHtml(value);
  return (div.textContent || '').trim();
}
