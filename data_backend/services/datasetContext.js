/**
 * Dataset Context Builder — assembles a compact Dataset_Context payload
 * for the Intelligence Layer.
 *
 * The context is sent to Bedrock as part of every LLM prompt. It is
 * intentionally small: schema + quality flags + trimmed stats + ≤ 10
 * redacted, truncated sample rows.
 *
 * Hard ceiling: sample rows are capped at 10 regardless of caller options.
 */

import { stratifiedSample } from './fileParser.js';
import { redact, truncateString } from './redactor.js';
import { intelligenceConfig } from '../config/intelligence.js';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Load up to `n` sample rows from the dataset.
 *
 * Priority:
 *   1. `dataset.parsedFilePath` → stratified sample from JSONL file
 *   2. `dataset.rows` (array)   → slice
 *   3. fallback                 → []
 *
 * @param {object} dataset
 * @param {number} n
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function getSampleRows(dataset, n) {
  if (dataset.parsedFilePath) {
    return stratifiedSample(dataset.parsedFilePath, n, dataset.rowCount || 0);
  }
  if (Array.isArray(dataset.rows)) {
    return dataset.rows.slice(0, n);
  }
  return [];
}

/**
 * Truncate every string cell in a row array to at most 200 characters.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @returns {Array<Record<string, unknown>>}
 */
function truncateRows(rows) {
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const out = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = typeof value === 'string' ? truncateString(value, 200) : value;
    }
    return out;
  });
}

/**
 * Extract and trim numeric stats.
 *
 * Sorts columns by `nullPct` ascending (lowest null percentage first — most
 * complete columns are most useful), then keeps the top 12. For each column
 * only the six summary fields are retained.
 *
 * @param {Record<string, object>} raw
 * @returns {Record<string, object>}
 */
function buildNumericStats(raw) {
  const entries = Object.entries(raw || {});
  entries.sort((a, b) => {
    const aNullPct = a[1]?.nullPct ?? Infinity;
    const bNullPct = b[1]?.nullPct ?? Infinity;
    return aNullPct - bNullPct;
  });
  const top12 = entries.slice(0, 12);
  const result = {};
  for (const [col, stats] of top12) {
    result[col] = {
      mean: stats.mean,
      median: stats.median,
      stdDev: stats.stdDev,
      min: stats.min,
      max: stats.max,
      nullPct: stats.nullPct,
    };
  }
  return result;
}

/**
 * Extract and trim categorical stats.
 *
 * Sorts columns by `cardinality` descending (highest cardinality first —
 * most diverse columns are most interesting), then keeps the top 8.
 *
 * @param {Record<string, object>} raw
 * @returns {Record<string, object>}
 */
function buildCategoricalStats(raw) {
  const entries = Object.entries(raw || {});
  entries.sort((a, b) => {
    const aCard = a[1]?.cardinality ?? 0;
    const bCard = b[1]?.cardinality ?? 0;
    return bCard - aCard;
  });
  const top8 = entries.slice(0, 8);
  const result = {};
  for (const [col, stats] of top8) {
    result[col] = {
      cardinality: stats.cardinality,
      topValues: stats.topValues,
      nullPct: stats.nullPct,
    };
  }
  return result;
}

/**
 * Derive a human-readable correlation label from a Pearson r value.
 *
 * @param {number} r
 * @returns {string}
 */
function correlationLabel(r) {
  const absR = Math.abs(r);
  const direction = r >= 0 ? 'positive' : 'negative';
  if (absR >= 0.7) return `strong ${direction}`;
  if (absR >= 0.4) return `moderate ${direction}`;
  return `weak ${direction}`;
}

/**
 * Extract the top 8 off-diagonal correlation pairs sorted by |r| descending.
 *
 * @param {Record<string, Record<string, number>> | null | undefined} matrix
 * @returns {Array<{ pair: [string, string], r: number, label: string }>}
 */
function buildCorrelationInsights(matrix) {
  if (!matrix || typeof matrix !== 'object') return [];

  const pairs = [];
  const cols = Object.keys(matrix);
  for (const colA of cols) {
    for (const colB of cols) {
      // Only include each pair once (colA < colB lexicographically)
      if (colA >= colB) continue;
      const r = matrix[colA]?.[colB];
      if (typeof r !== 'number' || !isFinite(r)) continue;
      pairs.push({ pair: [colA, colB], r, absR: Math.abs(r) });
    }
  }

  pairs.sort((a, b) => b.absR - a.absR);
  const top8 = pairs.slice(0, 8);

  return top8.map(({ pair, r }) => ({
    pair,
    r,
    label: correlationLabel(r),
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a compact Dataset_Context object for use in Bedrock prompts.
 *
 * @param {object} dataset  - Mongoose Dataset document (or plain object)
 * @param {object} [options]
 * @param {number} [options.sampleRows=5]    - Desired number of sample rows
 * @param {number} [options.maxSampleRows=10] - Caller-supplied upper bound
 * @returns {Promise<object>} Dataset_Context
 */
export async function buildDatasetContext(dataset, options = {}) {
  // Hard ceiling: never more than 10 rows regardless of caller options.
  const n = Math.min(
    options.sampleRows ?? 5,
    options.maxSampleRows ?? 10,
    10
  );

  // --- Sample rows ---
  let rawRows = await getSampleRows(dataset, n);
  rawRows = redact(rawRows, dataset.semanticTypes || {});
  rawRows = truncateRows(rawRows);

  // --- Schema ---
  const schema = {
    columnTypes: dataset.columnTypes || {},
    headers: dataset.headers || [],
    rowCount: dataset.rowCount || 0,
  };

  // --- Quality flags ---
  const qualityFlags = dataset.stats?.qualityFlags || {
    qualityScore: 0,
    flags: [],
  };

  // --- Numeric stats (top 12 by ascending nullPct) ---
  const numericStats = buildNumericStats(dataset.stats?.numericStats || {});

  // --- Categorical stats (top 8 by descending cardinality) ---
  const categoricalStats = buildCategoricalStats(
    dataset.stats?.categoricalStats || {}
  );

  // --- Time series ---
  const timeSeries = dataset.stats?.timeSeries || null;

  // --- Correlation insights (top 8 by |r|) ---
  const correlationInsights = buildCorrelationInsights(
    dataset.stats?.correlationMatrix
  );

  // --- Meta ---
  const meta = {
    tokenBudget: intelligenceConfig().tokenBudget,
    datasetId: String(dataset._id || ''),
  };

  return {
    schema,
    qualityFlags,
    numericStats,
    categoricalStats,
    timeSeries,
    correlationInsights,
    sampleRows: rawRows,
    meta,
  };
}
