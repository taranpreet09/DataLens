/**
 * Data Quality Module
 * Smart type inference, fuzzy dedup, validation rules, column dependencies.
 */

import { distance as levenshtein } from 'fastest-levenshtein';

// ─── Smart Column Type Inference ──────────────────────────────────────────────

const TYPE_PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,15}$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  ip_address: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
  currency: /^[$€£¥₹]?\s?-?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^-?\d{1,3}(,\d{3})*(\.\d{1,2})?\s?[$€£¥₹]$/,
  percentage: /^-?\d+(\.\d+)?%$/,
  zip_code: /^\d{5}(-\d{4})?$|^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
  coordinates: /^-?\d{1,3}\.\d{3,8},\s?-?\d{1,3}\.\d{3,8}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  date_iso: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/,
  boolean: /^(true|false|yes|no|1|0|y|n)$/i,
};

/**
 * Infer semantic types for each column beyond basic numeric/categorical.
 *
 * @param {string[]} headers
 * @param {Array} rows
 * @returns {Object} Map of column → { baseType, semanticType, confidence, sample }
 */
export function inferSemanticTypes(headers, rows) {
  const result = {};
  const sampleSize = Math.min(rows.length, 200);
  const sampleRows = rows.slice(0, sampleSize);

  for (const h of headers) {
    const values = sampleRows.map(r => r[h]).filter(v => v != null && v !== '');
    if (values.length === 0) {
      result[h] = { baseType: 'empty', semanticType: null, confidence: 0 };
      continue;
    }

    const stringVals = values.map(String);
    let bestType = null;
    let bestScore = 0;

    for (const [typeName, pattern] of Object.entries(TYPE_PATTERNS)) {
      const matches = stringVals.filter(v => pattern.test(v.trim())).length;
      const score = matches / stringVals.length;
      if (score > bestScore && score > 0.6) {
        bestType = typeName;
        bestScore = score;
      }
    }

    // Check for numeric
    const numericCount = values.filter(v => !isNaN(Number(v))).length;
    const numericRatio = numericCount / values.length;

    let baseType = 'text';
    if (numericRatio > 0.8) baseType = 'numeric';
    else if (new Set(stringVals.map(s => s.toLowerCase())).size / values.length < 0.3) baseType = 'categorical';

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
 * Find near-duplicate rows using Levenshtein distance.
 * Compares string representations of rows.
 *
 * @param {Array} rows
 * @param {string[]} headers
 * @param {number} threshold - Max edit distance ratio (0-1). Default 0.15 (85% similar)
 * @param {number} maxComparisons - Limit comparisons for performance
 * @returns {{ duplicateGroups, totalDuplicates, comparisonsMade }}
 */
export function findFuzzyDuplicates(rows, headers, threshold = 0.15, maxComparisons = 50000) {
  const n = rows.length;
  if (n < 2) return { duplicateGroups: [], totalDuplicates: 0, comparisonsMade: 0 };

  // Convert rows to comparable strings (using key columns)
  const textCols = headers.filter(h => {
    const sample = rows.slice(0, 50).map(r => r[h]).filter(v => v != null);
    return sample.some(v => typeof v === 'string' && v.length > 2);
  }).slice(0, 5); // Limit to 5 text columns for performance

  if (textCols.length === 0) return { duplicateGroups: [], totalDuplicates: 0, comparisonsMade: 0 };

  const rowStrings = rows.map(r =>
    textCols.map(h => String(r[h] ?? '')).join('|').toLowerCase()
  );

  const duplicateGroups = [];
  const visited = new Set();
  let comparisonsMade = 0;

  // Compare rows (limit for performance)
  const step = Math.max(1, Math.floor(n * n / (2 * maxComparisons)));

  for (let i = 0; i < n && comparisonsMade < maxComparisons; i++) {
    if (visited.has(i)) continue;

    const group = [i];
    const strI = rowStrings[i];
    if (!strI) continue;

    for (let j = i + 1; j < n && comparisonsMade < maxComparisons; j += step) {
      if (visited.has(j)) continue;
      comparisonsMade++;

      const strJ = rowStrings[j];
      if (!strJ) continue;

      const maxLen = Math.max(strI.length, strJ.length);
      if (maxLen === 0) continue;

      const dist = levenshtein(strI, strJ);
      const ratio = dist / maxLen;

      if (ratio <= threshold) {
        group.push(j);
        visited.add(j);
      }
    }

    if (group.length > 1) {
      visited.add(i);
      duplicateGroups.push({
        indices: group,
        sampleRows: group.slice(0, 3).map(idx => rows[idx]),
        similarity: round(1 - (levenshtein(rowStrings[group[0]], rowStrings[group[1]]) / Math.max(rowStrings[group[0]].length, rowStrings[group[1]].length))),
      });
    }
  }

  return {
    duplicateGroups,
    totalDuplicates: duplicateGroups.reduce((s, g) => s + g.indices.length - 1, 0),
    comparisonsMade,
    columnsUsed: textCols,
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
