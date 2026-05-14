/**
 * Redactor — pure utilities for sanitising Dataset_Context payloads
 * before they leave the Node backend.
 *
 * This module is intentionally tiny and side-effect free:
 *   - no I/O
 *   - no logging
 *   - no mutation of inputs
 *
 * Three exports:
 *   - redact(rows, semanticTypes)        → new rows with PII columns replaced
 *   - truncateString(s, max=200)         → bounded string with ellipsis suffix
 *   - estimatePayloadBytes(obj)          → utf-8 byte size of JSON.stringify(obj)
 */

// Semantic types treated as PII regardless of column name.
const PII_SEMANTIC_TYPES = new Set(['email', 'phone', 'creditcard']);

// Column-name heuristic: any header matching this regex is redacted regardless
// of detector confidence. Catches sparsely populated PII columns the type
// detector might miss.
const PII_HEADER_PATTERN = /email|phone|mobile|cell|ssn|tax|card|cvv|account/i;

const REDACTED_TOKEN = '[REDACTED]';
const TRUNCATION_SUFFIX = '…';

/**
 * Decide whether a given column should be redacted.
 *
 * @param {string} column
 * @param {Record<string, { semanticType?: string }>} [semanticTypes]
 * @returns {boolean}
 */
function isPiiColumn(column, semanticTypes) {
  const info = semanticTypes && semanticTypes[column];
  const semanticType = info && typeof info === 'object' ? info.semanticType : null;
  if (semanticType && PII_SEMANTIC_TYPES.has(semanticType)) return true;
  return PII_HEADER_PATTERN.test(column);
}

/**
 * Build the union of column names across every row. Rows may have inconsistent
 * shapes, so a single representative row is not enough.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @returns {string[]}
 */
function unionColumns(rows) {
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      seen.add(key);
    }
  }
  return Array.from(seen);
}

/**
 * Redact PII columns from a list of row objects.
 *
 * For each column whose `semanticTypes[col].semanticType` is `email`, `phone`,
 * or `creditcard`, OR whose name matches the PII header heuristic, every cell
 * is replaced with the literal token `"[REDACTED]"` — including null and
 * undefined values. Other columns are copied through as-is.
 *
 * Returns a new array of new row objects. Inputs are not mutated.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @param {Record<string, { semanticType?: string }>} [semanticTypes]
 * @returns {Array<Record<string, unknown>>}
 */
export function redact(rows, semanticTypes) {
  if (!Array.isArray(rows)) return [];

  const allColumns = unionColumns(rows);
  const piiColumns = new Set(
    allColumns.filter((col) => isPiiColumn(col, semanticTypes))
  );

  return rows.map((row) => {
    if (!row || typeof row !== 'object') {
      // Preserve non-object entries verbatim (defensive — schema expects objects).
      return row;
    }
    const out = {};
    for (const key of Object.keys(row)) {
      if (piiColumns.has(key)) {
        out[key] = REDACTED_TOKEN;
      } else {
        out[key] = row[key];
      }
    }
    return out;
  });
}

/**
 * Truncate a string to at most `max` characters, appending a single ellipsis
 * character when truncation occurs. Non-string inputs are returned unchanged.
 *
 * @template T
 * @param {T} s
 * @param {number} [max=200]
 * @returns {T | string}
 */
export function truncateString(s, max = 200) {
  if (typeof s !== 'string') return s;
  if (s.length <= max) return s;
  return s.slice(0, max) + TRUNCATION_SUFFIX;
}

/**
 * Estimate the utf-8 byte size of a JSON-serialisable value.
 *
 * @param {unknown} obj
 * @returns {number}
 */
export function estimatePayloadBytes(obj) {
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}
