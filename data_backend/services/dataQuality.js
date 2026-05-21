/**
 * Data Quality Module
 * Smart type inference, fuzzy dedup, validation rules, column dependencies.
 */

import { distance as levenshtein } from 'fastest-levenshtein';

// ─── Smart Column Type Inference ──────────────────────────────────────────────
//
// Each pattern is paired with a guard predicate so we don't false-positive on
// bare integers or date components. Order matters — the first pattern that
// matches "decisively" wins (score >= 0.9). Otherwise the highest-scoring
// pattern above the per-type minimum is chosen.

const SEMANTIC_TYPES = [
  {
    name: 'email',
    test: (v) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v),
    minScore: 0.6,
  },
  {
    name: 'url',
    test: (v) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v),
    minScore: 0.6,
  },
  {
    name: 'uuid',
    test: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
    minScore: 0.8,
  },
  {
    name: 'ip_address',
    test: (v) => /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(v),
    minScore: 0.8,
  },
  {
    name: 'date_iso',
    // ISO-style: 2024-01-15, 2024-01-15T10:30:00, 2024/01/15
    // Verify it actually parses as a date AND has at least one separator
    test: (v) => {
      if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}([T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(v)) return false;
      const d = new Date(v);
      return !isNaN(d.getTime());
    },
    minScore: 0.7,
  },
  {
    name: 'coordinates',
    test: (v) => /^-?\d{1,3}\.\d{3,8},\s?-?\d{1,3}\.\d{3,8}$/.test(v),
    minScore: 0.8,
  },
  {
    name: 'currency',
    // MUST contain a currency symbol — bare numbers are NOT currency.
    // Examples that match: $1,234.56, €99.99, ₹1,00,000, -$50.00, $50, 99.99 USD
    test: (v) => {
      const trimmed = String(v).trim();
      // Symbol-prefix form: $123.45, €1,234, ₹500
      if (/^[$€£¥₹₽元]\s?-?\d{1,3}(,\d{2,3})*(\.\d{1,4})?$/.test(trimmed)) return true;
      // Symbol-suffix form: 1234.56€, 99.99 USD
      if (/^-?\d{1,3}(,\d{2,3})*(\.\d{1,4})?\s?[$€£¥₹₽元]$/.test(trimmed)) return true;
      // ISO currency code suffix: 99.99 USD, 1,234.56 EUR
      if (/^-?\d{1,3}(,\d{2,3})*(\.\d{1,4})?\s?(USD|EUR|GBP|JPY|INR|CAD|AUD|CNY)$/i.test(trimmed)) return true;
      // Negative parens with symbol: ($1,234.56)
      if (/^\([$€£¥₹]\s?\d{1,3}(,\d{2,3})*(\.\d{1,4})?\)$/.test(trimmed)) return true;
      return false;
    },
    minScore: 0.7,
  },
  {
    name: 'percentage',
    // Must end with literal % sign — bare numbers are NOT percentages
    test: (v) => /^-?\d+(\.\d+)?\s?%$/.test(String(v).trim()),
    minScore: 0.7,
  },
  {
    name: 'phone',
    // Must look phone-shaped: at least 7 digits, allow common separators,
    // optional country code. Reject pure-numeric values that look like dates,
    // small ints, or measurements. Reject if it parses as a valid date.
    test: (v) => {
      const s = String(v).trim();
      // Reject if it parses as date
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return false;
      // Must have phone-shape
      if (!/^[+(]?[\d][\d\s\-().+]{6,20}\d$/.test(s)) return false;
      // Count digits — phone numbers have 7-15 digits
      const digits = s.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) return false;
      // Reject if no non-digit separators AND length > 11 (likely a long ID)
      const hasSeparator = /[\s\-().+]/.test(s);
      if (!hasSeparator && digits.length > 11) return false;
      return true;
    },
    minScore: 0.8,
  },
  {
    name: 'creditcard',
    // 13-19 digits, optionally separated by spaces or dashes in groups of 4
    test: (v) => {
      const s = String(v).trim();
      if (!/^(\d[\d\s-]{11,21}\d)$/.test(s)) return false;
      const digits = s.replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) return false;
      // Luhn check for confidence
      let sum = 0, alt = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits[i], 10);
        if (alt) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
        alt = !alt;
      }
      return sum % 10 === 0;
    },
    minScore: 0.8,
  },
  {
    name: 'zip_code',
    // US 5-digit or 5+4, or Canadian postal code
    // Require column-name hint OR perfect score to avoid matching arbitrary 5-digit ints
    test: (v) => /^\d{5}(-\d{4})?$|^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(String(v).trim()),
    minScore: 0.9,
    requiresNameHint: /zip|postal|pincode|pin_code/i,
  },
  {
    name: 'boolean',
    test: (v) => /^(true|false|yes|no|y|n|t|f)$/i.test(String(v).trim()),
    minScore: 0.9,
  },
];

/**
 * Infer semantic types for each column beyond basic numeric/categorical.
 *
 * @param {string[]} headers
 * @param {Array} rows
 * @returns {Object} Map of column → { baseType, semanticType, confidence, sample }
 */
export function inferSemanticTypes(headers, rows) {
  const result = {};
  const sampleSize = Math.min(rows.length, 500);
  const sampleRows = rows.slice(0, sampleSize);

  for (const h of headers) {
    const values = sampleRows.map(r => r[h]).filter(v => v != null && v !== '');
    if (values.length === 0) {
      result[h] = { baseType: 'empty', semanticType: null, confidence: 0, sample: [] };
      continue;
    }

    const stringVals = values.map(v => String(v).trim()).filter(s => s.length > 0);
    if (stringVals.length === 0) {
      result[h] = { baseType: 'empty', semanticType: null, confidence: 0, sample: [] };
      continue;
    }

    // Determine baseType first (independent of semantic type)
    const numericCount = stringVals.filter(v => v !== '' && !isNaN(Number(v))).length;
    const numericRatio = numericCount / stringVals.length;

    // Date detection: try parsing as date AND verify it isn't just a bare number
    const dateCount = stringVals.filter(v => {
      if (!isNaN(Number(v))) return false; // bare numbers aren't dates
      const d = new Date(v);
      return !isNaN(d.getTime());
    }).length;
    const dateRatio = dateCount / stringVals.length;

    let baseType = 'text';
    if (dateRatio > 0.7) baseType = 'date';
    else if (numericRatio > 0.8) baseType = 'numeric';
    else {
      const lowerSet = new Set(stringVals.map(s => s.toLowerCase()));
      const cardinalityRatio = lowerSet.size / stringVals.length;
      if (cardinalityRatio < 0.3 || (lowerSet.size <= 20 && stringVals.length >= 10)) {
        baseType = 'categorical';
      }
    }

    // Score every semantic type pattern
    let bestType = null;
    let bestScore = 0;

    for (const sem of SEMANTIC_TYPES) {
      // Skip patterns that need a column-name hint when the hint is missing
      if (sem.requiresNameHint && !sem.requiresNameHint.test(h)) continue;

      // Skip mismatched base types
      if (sem.name === 'date_iso' && baseType !== 'date' && baseType !== 'text') continue;
      if (sem.name === 'boolean' && baseType !== 'categorical' && baseType !== 'text') continue;

      const matches = stringVals.filter(v => {
        try { return sem.test(v); } catch { return false; }
      }).length;
      const score = matches / stringVals.length;
      if (score >= sem.minScore && score > bestScore) {
        bestType = sem.name;
        bestScore = score;
      }
    }

    // Sanity: if baseType is numeric but bestType is currency/percentage, that's expected.
    // If baseType is numeric and bestType is phone/email/url/zip, it's almost certainly wrong
    // unless the column name hints at it.
    if (baseType === 'numeric' && bestType && !['currency', 'percentage', 'creditcard', 'zip_code', 'phone'].includes(bestType)) {
      bestType = null;
      bestScore = 0;
    }
    // Phone on a pure-numeric column needs a name hint to avoid false positives on counts/IDs
    if (bestType === 'phone' && baseType === 'numeric' && !/phone|mobile|cell|tel|fax|contact/i.test(h)) {
      bestType = null;
      bestScore = 0;
    }
    // Currency without currency symbol: never tag plain numbers as currency unless name hints
    // (the test() now requires symbols, but as a belt-and-suspenders check)
    if (bestType === 'currency' && !/price|cost|amount|revenue|salary|fee|charge|payment|total|usd|eur|gbp|cad|inr/i.test(h)) {
      // Only keep currency tag if the data actually contains a symbol
      const hasSymbol = stringVals.some(v => /[$€£¥₹₽元]|USD|EUR|GBP/i.test(v));
      if (!hasSymbol) { bestType = null; bestScore = 0; }
    }

    // Name-hint fallbacks for numeric columns: if no semantic type was detected
    // but the column name strongly suggests one, tag it with low confidence.
    if (!bestType && baseType === 'numeric') {
      if (/(^|_)pct($|_)|(^|_)percent($|_)|percentage|_rate$/i.test(h)) {
        // Verify values look like percentages (0-100 range typical, or 0-1 fractions)
        const numericVals = stringVals.map(Number).filter(v => !isNaN(v));
        if (numericVals.length > 0) {
          const max = Math.max(...numericVals.map(Math.abs));
          if (max <= 100) { bestType = 'percentage'; bestScore = 0.7; }
        }
      } else if (/price|cost|amount|revenue|salary|fee|charge|payment/i.test(h)) {
        bestType = 'currency'; bestScore = 0.7;
      }
    }

    result[h] = {
      baseType,
      semanticType: bestType,
      confidence: bestType ? round(bestScore) : 0,
      sample: stringVals.slice(0, 3),
    };
  }

  return result;
}

function round(n, d = 4) { const f = 10 ** d; return Math.round(n * f) / f; }

// ─── Fuzzy Duplicate Detection ────────────────────────────────────────────────

/**
 * Find near-duplicate rows using a hybrid signature + Levenshtein approach.
 *
 * Strategy:
 *   1. Build a comparable signature for each row using ALL columns (categoricals
 *      and dates verbatim, numerics rounded to 2 sig figs to allow for rounding
 *      noise).
 *   2. Bucket rows by a coarse blocking key (first categorical value + first
 *      numeric bucket) to avoid O(n²) comparisons.
 *   3. Within each bucket, compute Levenshtein similarity between full
 *      signatures. Group rows whose similarity ratio meets the threshold.
 *
 * @param {Array} rows
 * @param {string[]} headers
 * @param {number} threshold - Max edit distance ratio (0-1). Default 0.10 (90% similar).
 * @param {number} maxComparisons - Limit comparisons for performance.
 * @returns {{ duplicateGroups, totalDuplicates, comparisonsMade, columnsUsed }}
 */
export function findFuzzyDuplicates(rows, headers, threshold = 0.10, maxComparisons = 100000) {
  const n = rows.length;
  if (n < 2) return { duplicateGroups: [], totalDuplicates: 0, comparisonsMade: 0, columnsUsed: [] };

  // Identify column types from a sample so we can normalise numerics/dates.
  const sample = rows.slice(0, Math.min(rows.length, 200));
  const colKinds = {};
  for (const h of headers) {
    const vals = sample.map(r => r[h]).filter(v => v != null && v !== '');
    if (vals.length === 0) { colKinds[h] = 'empty'; continue; }
    const numCount = vals.filter(v => !isNaN(Number(v))).length;
    const dateCount = vals.filter(v => {
      if (!isNaN(Number(v))) return false;
      const d = new Date(v);
      return !isNaN(d.getTime());
    }).length;
    if (dateCount / vals.length > 0.7) colKinds[h] = 'date';
    else if (numCount / vals.length > 0.8) colKinds[h] = 'numeric';
    else colKinds[h] = 'text';
  }

  // Use ALL non-empty columns. Including numerics is essential to avoid
  // grouping rows that differ on quantitative values.
  const compareCols = headers.filter(h => colKinds[h] !== 'empty');
  if (compareCols.length === 0) {
    return { duplicateGroups: [], totalDuplicates: 0, comparisonsMade: 0, columnsUsed: [] };
  }

  // Normalise a single cell value so similar-but-formatted-differently values
  // collapse together (e.g. "  Widget A " === "widget a", 4500.00 === 4500).
  const normalise = (kind, raw) => {
    if (raw == null) return '';
    const s = String(raw).trim();
    if (s === '') return '';
    if (kind === 'numeric') {
      const num = Number(s);
      if (isNaN(num)) return s.toLowerCase();
      // Round to 4 significant digits for fuzzy match tolerance.
      if (num === 0) return '0';
      const mag = Math.pow(10, 3 - Math.floor(Math.log10(Math.abs(num))));
      return String(Math.round(num * mag) / mag);
    }
    if (kind === 'date') {
      const d = new Date(s);
      if (isNaN(d.getTime())) return s.toLowerCase();
      return d.toISOString().slice(0, 10);
    }
    return s.toLowerCase();
  };

  const rowSignatures = rows.map(r =>
    compareCols.map(h => normalise(colKinds[h], r[h])).join('|')
  );

  // Blocking key: first 1-2 categorical/text values + first numeric bucket.
  // Rows with different blocking keys are NEVER compared.
  const textCols = compareCols.filter(h => colKinds[h] === 'text' || colKinds[h] === 'date').slice(0, 2);
  const blockKeyOf = (row) => {
    const parts = [];
    for (const h of textCols) parts.push(normalise(colKinds[h], row[h]));
    return parts.join('||') || 'all';
  };

  const buckets = new Map();
  rows.forEach((row, idx) => {
    const key = blockKeyOf(row);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(idx);
  });

  const duplicateGroups = [];
  const visited = new Set();
  let comparisonsMade = 0;

  for (const [, indices] of buckets) {
    if (indices.length < 2) continue;
    if (comparisonsMade >= maxComparisons) break;

    for (let a = 0; a < indices.length; a++) {
      const i = indices[a];
      if (visited.has(i)) continue;

      const group = [i];
      const groupSimilarities = [];
      const strI = rowSignatures[i];
      if (!strI) continue;

      for (let b = a + 1; b < indices.length; b++) {
        if (comparisonsMade >= maxComparisons) break;
        const j = indices[b];
        if (visited.has(j)) continue;
        comparisonsMade++;

        const strJ = rowSignatures[j];
        if (!strJ) continue;

        const maxLen = Math.max(strI.length, strJ.length);
        if (maxLen === 0) continue;

        const dist = levenshtein(strI, strJ);
        const ratio = dist / maxLen;

        if (ratio <= threshold) {
          group.push(j);
          groupSimilarities.push(1 - ratio);
          visited.add(j);
        }
      }

      if (group.length > 1) {
        visited.add(i);
        const avgSim = groupSimilarities.length
          ? groupSimilarities.reduce((s, v) => s + v, 0) / groupSimilarities.length
          : 1;
        duplicateGroups.push({
          indices: group,
          rowCount: group.length,
          // Return ALL rows in the group, not just the first 2 — UI will paginate.
          sampleRows: group.map(idx => rows[idx]),
          similarity: round(avgSim),
        });
      }
    }
  }

  // Sort groups by size desc, then by similarity desc.
  duplicateGroups.sort((a, b) => b.rowCount - a.rowCount || b.similarity - a.similarity);

  return {
    duplicateGroups,
    totalDuplicates: duplicateGroups.reduce((s, g) => s + g.rowCount - 1, 0),
    comparisonsMade,
    columnsUsed: compareCols,
    threshold,
  };
}

// ─── Auto-Generated Validation Rules ──────────────────────────────────────────

/**
 * Generate validation rules from data patterns.
 * Analyzes each column and produces rules that the data currently satisfies.
 *
 * @param {string[]} headers
 * @param {Array} rows
 * @param {Object} columnTypes
 * @returns {Array} Array of validation rules
 */
export function generateValidationRules(headers, rows, columnTypes) {
  const rules = [];

  for (const h of headers) {
    const values = rows.map(r => r[h]).filter(v => v != null && v !== '');
    if (values.length === 0) continue;

    const nullCount = rows.length - values.length;
    const nullPct = nullCount / rows.length;

    // Rule: Not null
    if (nullPct === 0) {
      rules.push({ column: h, rule: 'not_null', description: `${h} should never be null`, severity: 'error' });
    } else if (nullPct < 0.05) {
      rules.push({ column: h, rule: 'low_null', description: `${h} should have <5% nulls (currently ${round(nullPct * 100, 1)}%)`, severity: 'warning' });
    }

    if (columnTypes[h] === 'numeric') {
      const nums = values.filter(v => !isNaN(Number(v))).map(Number);
      if (nums.length < 2) continue;

      const min = Math.min(...nums);
      const max = Math.max(...nums);

      // Rule: Range
      rules.push({
        column: h, rule: 'range',
        description: `${h} should be between ${min} and ${max}`,
        params: { min, max },
        severity: 'warning',
      });

      // Rule: Non-negative
      if (min >= 0) {
        rules.push({ column: h, rule: 'non_negative', description: `${h} should be non-negative`, severity: 'error' });
      }

      // Rule: Integer only
      const allIntegers = nums.every(n => Number.isInteger(n));
      if (allIntegers) {
        rules.push({ column: h, rule: 'integer', description: `${h} should be an integer`, severity: 'warning' });
      }
    }

    if (columnTypes[h] === 'categorical') {
      const uniqueVals = [...new Set(values.map(String))];
      if (uniqueVals.length <= 20) {
        rules.push({
          column: h, rule: 'enum',
          description: `${h} should be one of: ${uniqueVals.slice(0, 10).join(', ')}${uniqueVals.length > 10 ? '...' : ''}`,
          params: { allowedValues: uniqueVals },
          severity: 'error',
        });
      }
    }

    // Rule: Unique (if all values are unique)
    const uniqueSet = new Set(values.map(String));
    if (uniqueSet.size === values.length && values.length > 10) {
      rules.push({ column: h, rule: 'unique', description: `${h} should have unique values`, severity: 'error' });
    }
  }

  return rules;
}

// ─── Column Dependency Detection ──────────────────────────────────────────────

/**
 * Detect functional dependencies between columns.
 * A → B means: knowing A uniquely determines B.
 *
 * @param {string[]} headers
 * @param {Array} rows
 * @returns {Array} Array of { from, to, confidence, type }
 */
export function detectColumnDependencies(headers, rows) {
  const dependencies = [];
  const sampleRows = rows.slice(0, 5000); // Limit for performance

  for (let i = 0; i < headers.length; i++) {
    for (let j = 0; j < headers.length; j++) {
      if (i === j) continue;

      const colA = headers[i];
      const colB = headers[j];

      // Check if A → B (A determines B)
      const mapping = {};
      let violations = 0;
      let validPairs = 0;

      for (const row of sampleRows) {
        const a = row[colA];
        const b = row[colB];
        if (a == null || b == null) continue;

        const keyA = String(a);
        validPairs++;

        if (mapping[keyA] === undefined) {
          mapping[keyA] = String(b);
        } else if (mapping[keyA] !== String(b)) {
          violations++;
        }
      }

      if (validPairs < 10) continue;

      const confidence = 1 - (violations / validPairs);

      if (confidence >= 0.95) {
        // Check it's not trivial (A has same cardinality as rows)
        const cardA = Object.keys(mapping).length;
        if (cardA < validPairs * 0.9) { // A is not just a unique ID
          dependencies.push({
            from: colA,
            to: colB,
            confidence: round(confidence),
            type: confidence === 1 ? 'exact' : 'approximate',
            uniqueValuesInSource: cardA,
          });
        }
      }
    }
  }

  // Sort by confidence descending, deduplicate
  dependencies.sort((a, b) => b.confidence - a.confidence);
  return dependencies.slice(0, 20); // Top 20
}
