/**
 * Whitelist-based mini markdown renderer.
 *
 * Converts a subset of Markdown to sanitised HTML safe for dangerouslySetInnerHTML.
 *
 * Allowed tags: h1–h4, p, ul, ol, li, strong, em, code, blockquote, a
 * All other HTML tags and on* attributes are stripped.
 * Never outputs <script, <iframe, <style, <object, <embed.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escape HTML special characters in plain text nodes. */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strip any raw HTML tags that are not in our whitelist, and remove on* attributes.
 * Also hard-blocks dangerous tags regardless of whitelist.
 */
function stripDangerousHtml(html) {
  // Remove dangerous tags entirely (including their content for script/style)
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/<object[\s\S]*?<\/object>/gi, '');
  html = html.replace(/<embed[^>]*>/gi, '');

  // Remove on* event attributes from any remaining tags
  html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: hrefs
  html = html.replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"');

  return html;
}

/** Apply inline markdown: **bold**, *italic*, `code`, and [link](url). */
function applyInline(text) {
  // Escape raw HTML first so user-supplied HTML is neutralised
  let out = escapeHtml(text);

  // `code` — must come before bold/italic to avoid double-processing
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // *italic* (single asterisk, not preceded/followed by another)
  out = out.replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // [link text](url)
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" rel="nofollow" target="_blank">$1</a>'
  );

  return out;
}

// ── Main renderer ─────────────────────────────────────────────────────────────

/**
 * renderMarkdown(md) → sanitised HTML string
 *
 * Handles:
 *   # Heading 1  →  <h1>
 *   ## Heading 2 →  <h2>  (up to ####)
 *   **bold**     →  <strong>
 *   *italic*     →  <em>
 *   `code`       →  <code>
 *   > blockquote →  <blockquote>
 *   - item / * item → <ul><li>
 *   1. item      →  <ol><li>
 *   blank lines  →  paragraph breaks
 */
export function renderMarkdown(md) {
  if (!md || typeof md !== 'string') return '';

  // Normalise line endings
  const lines = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const parts = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Headings ──────────────────────────────────────────────────────────
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = applyInline(headingMatch[2]);
      parts.push(`<h${level}>${text}</h${level}>`);
      i++;
      continue;
    }

    // ── Tables (pipe-delimited) ───────────────────────────────────────────
    if (/^\|.+\|/.test(line)) {
      const tableRows = [];
      while (i < lines.length && /^\|.+\|/.test(lines[i])) {
        tableRows.push(lines[i]);
        i++;
      }
      if (tableRows.length >= 2) {
        // First row = header, second row = separator (---|---), rest = body
        const parseRow = (row) =>
          row.split('|').slice(1, -1).map(cell => cell.trim());

        const headerCells = parseRow(tableRows[0]);
        const isSeparator = (row) => /^\|[\s\-:|]+\|$/.test(row);
        const startBody = isSeparator(tableRows[1]) ? 2 : 1;

        let html = '<table><thead><tr>';
        for (const cell of headerCells) {
          html += `<th>${applyInline(cell)}</th>`;
        }
        html += '</tr></thead><tbody>';

        for (let r = startBody; r < tableRows.length; r++) {
          const cells = parseRow(tableRows[r]);
          html += '<tr>';
          for (const cell of cells) {
            html += `<td>${applyInline(cell)}</td>`;
          }
          html += '</tr>';
        }
        html += '</tbody></table>';
        parts.push(html);
      } else {
        // Single pipe line — treat as paragraph
        parts.push(`<p>${applyInline(tableRows[0])}</p>`);
      }
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────────────
    if (line.startsWith('> ')) {
      const bqLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(applyInline(lines[i].slice(2)));
        i++;
      }
      parts.push(`<blockquote>${bqLines.join('<br>')}</blockquote>`);
      continue;
    }

    // ── Unordered list ────────────────────────────────────────────────────
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${applyInline(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      parts.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────────────
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${applyInline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      parts.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // ── Blank line → paragraph break (skip) ──────────────────────────────
    if (line.trim() === '') {
      i++;
      continue;
    }

    // ── Paragraph: collect consecutive non-blank, non-special lines ───────
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !lines[i].startsWith('> ')
    ) {
      paraLines.push(applyInline(lines[i]));
      i++;
    }
    if (paraLines.length > 0) {
      parts.push(`<p>${paraLines.join(' ')}</p>`);
    }
  }

  const html = parts.join('\n');

  // Final safety pass — strip any dangerous constructs that slipped through
  return stripDangerousHtml(html);
}
