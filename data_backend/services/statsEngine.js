// ─── Server-side Stats Engine ─────────────────────────────────────────────────
// Mirrors the frontend statsEngine but runs on Node for large datasets.
// Operates on arrays of row objects.

function round(n, d = 4) { const f = 10 ** d; return Math.round(n * f) / f; }
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function quantile(arr, q) {
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (pos - lo) * (s[hi] - s[lo]);
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function numericVals(rows, col) {
  return rows.map(r => r[col]).filter(v => v !== null && v !== '' && !isNaN(Number(v))).map(Number);
}

// ─── Column Type Detection ────────────────────────────────────────────────────

function detectColumnTypes(headers, rows) {
  const types = {};
  for (const h of headers) {
    const allVals = rows.map(r => r[h]);
    const nonNull = allVals.filter(v => v !== null && v !== '');
    if (nonNull.length === 0) { types[h] = 'text'; continue; }

    const nums = nonNull.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== ''));
    const numRatio = nums.length / nonNull.length;

    const dateCount = nonNull.filter(v => {
      if (typeof v === 'number') return false;
      const d = new Date(v);
      return !isNaN(d.getTime()) && isNaN(Number(v));
    }).length;
    const dateRatio = dateCount / nonNull.length;

    if (dateRatio > 0.7) { types[h] = 'date'; continue; }

    if (numRatio > 0.7) {
      const uniqueSet = new Set(nonNull.map(String));
      const uniquenessRatio = uniqueSet.size / rows.length;
      const nameHint = /id$|_id|^id|index|code|key|no$|number/i.test(h);
      if (uniquenessRatio > 0.9 && nameHint) { types[h] = 'id'; }
      else { types[h] = 'numeric'; }
      continue;
    }

    if (numRatio < 0.3 && nonNull.length > 0) {
      const uniqueSet = new Set(nonNull.map(v => String(v).toLowerCase()));
      const uniquenessRatio = uniqueSet.size / rows.length;
      if (uniquenessRatio > 0.9) { types[h] = 'text'; }
      else { types[h] = 'categorical'; }
      continue;
    }

    types[h] = 'text';
  }
  return types;
}

// ─── Column Basics ────────────────────────────────────────────────────────────

function computeColumnBasics(headers, rows, columnTypes) {
  const basics = {};
  for (const h of headers) {
    const allVals = rows.map(r => r[h]);
    const nonNull = allVals.filter(v => v !== null && v !== '');
    const nullCount = rows.length - nonNull.length;
    const nullPct = round((nullCount / rows.length) * 100, 2);
    const uniqueSet = new Set(nonNull.map(String));
    const uniqueCount = uniqueSet.size;

    basics[h] = {
      type: columnTypes[h],
      nullCount,
      nullPct,
      uniqueCount,
      nonNullCount: nonNull.length,
    };
  }
  return basics;
}

// ─── Numeric Stats ────────────────────────────────────────────────────────────

function computeNumericStats(rows, headers, columnTypes) {
  const numCols = headers.filter(h => columnTypes[h] === 'numeric');
  const stats = {};

  for (const col of numCols) {
    const vals = numericVals(rows, col);
    if (vals.length < 2) continue;

    const m = mean(vals);
    const med = median(vals);
    const sd = stdDev(vals);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const q1 = quantile(vals, 0.25);
    const q3 = quantile(vals, 0.75);
    const iqr = q3 - q1;
    const skewness = sd > 0 ? round((3 * (m - med)) / sd, 4) : 0;

    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    const iqrOutliers = vals.filter(x => x < lowerFence || x > upperFence);
    const zscoreOutliers = sd > 0 ? vals.filter(x => Math.abs(x - m) / sd > 3) : [];

    stats[col] = {
      mean: round(m), median: round(med), min: round(mn), max: round(mx),
      stdDev: round(sd), variance: round(sd * sd),
      range: round(mx - mn), q1: round(q1), q3: round(q3), iqr: round(iqr),
      skewness, sum: round(vals.reduce((a, b) => a + b, 0)),
      nonNullCount: vals.length, nullCount: rows.length - vals.length,
      zscoreOutlierCount: zscoreOutliers.length,
      iqrOutlierCount: iqrOutliers.length,
      iqrLowerFence: round(lowerFence), iqrUpperFence: round(upperFence),
    };
  }

  return { numericStats: stats, numericColumns: numCols };
}

// ─── Categorical Stats ────────────────────────────────────────────────────────

function computeCategoricalStats(rows, headers, columnTypes) {
  const catCols = headers.filter(h => columnTypes[h] === 'categorical');
  const stats = {};

  for (const col of catCols) {
    const vals = rows.map(r => r[col]).filter(v => v !== null && v !== '');
    const freq = {};
    vals.forEach(v => { const k = String(v); freq[k] = (freq[k] || 0) + 1; });

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5).map(([value, count]) => ({
      value, count, pct: round((count / vals.length) * 100, 2),
    }));

    const mode = sorted[0] ? sorted[0][0] : null;
    const modeCount = sorted[0] ? sorted[0][1] : 0;
    const cardinality = sorted.length;

    stats[col] = { top5, mode, modeCount, cardinality, concentrationRatio: round((modeCount / rows.length) * 100, 2) };
  }

  return { categoricalStats: stats, categoricalColumns: catCols };
}

// ─── Correlation Matrix ───────────────────────────────────────────────────────

function computeCorrelationMatrix(rows, numCols) {
  if (numCols.length < 2) return { matrix: {}, pairs: [] };

  const matrix = {};
  const pairs = [];

  for (const a of numCols) {
    matrix[a] = {};
    for (const b of numCols) {
      if (a === b) { matrix[a][b] = 1; continue; }
      const pairsA = [], pairsB = [];
      rows.forEach(r => {
        const va = r[a], vb = r[b];
        if (va !== null && vb !== null && !isNaN(Number(va)) && !isNaN(Number(vb))) {
          pairsA.push(Number(va));
          pairsB.push(Number(vb));
        }
      });
      if (pairsA.length < 5) { matrix[a][b] = null; continue; }
      const mA = mean(pairsA), mB = mean(pairsB);
      const num = pairsA.reduce((s, v, i) => s + (v - mA) * (pairsB[i] - mB), 0);
      const dA = Math.sqrt(pairsA.reduce((s, v) => s + (v - mA) ** 2, 0));
      const dB = Math.sqrt(pairsB.reduce((s, v) => s + (v - mB) ** 2, 0));
      const r = dA && dB ? round(num / (dA * dB)) : null;
      matrix[a][b] = r;

      if (r !== null && a < b) {
        pairs.push({ colA: a, colB: b, r, absR: Math.abs(r) });
      }
    }
  }

  pairs.sort((a, b) => b.absR - a.absR);
  return { matrix, pairs };
}

// ─── Quality Score ────────────────────────────────────────────────────────────

function computeQualityScore(rows, headers, columnTypes, columnBasics) {
  let score = 100;
  const flags = [];

  // Null penalty
  const totalCells = rows.length * headers.length;
  let totalNulls = 0;
  for (const h of headers) {
    totalNulls += columnBasics[h].nullCount;
  }
  const nullPct = (totalNulls / totalCells) * 100;
  if (nullPct > 30) { score -= 25; flags.push({ type: 'high_nulls', detail: `${nullPct.toFixed(1)}% missing values` }); }
  else if (nullPct > 10) { score -= 15; flags.push({ type: 'moderate_nulls', detail: `${nullPct.toFixed(1)}% missing values` }); }
  else if (nullPct > 0) { score -= 5; }

  // Duplicate check
  const rowStrings = new Set(rows.map(r => JSON.stringify(r)));
  const dupeCount = rows.length - rowStrings.size;
  if (dupeCount > 0) {
    const dupePct = (dupeCount / rows.length) * 100;
    score -= Math.min(20, Math.round(dupePct));
    flags.push({ type: 'duplicates', detail: `${dupeCount} duplicate rows (${dupePct.toFixed(1)}%)` });
  }

  // Low cardinality numeric columns (might be categorical)
  for (const h of headers) {
    if (columnTypes[h] === 'numeric') {
      const uniqueRatio = columnBasics[h].uniqueCount / rows.length;
      if (uniqueRatio < 0.01 && rows.length > 100) {
        score -= 3;
        flags.push({ type: 'low_cardinality_numeric', detail: `${h} has very few unique values` });
      }
    }
  }

  return { qualityScore: Math.max(0, Math.min(100, score)), qualityFlags: flags, totalNulls, nullPct: round(nullPct, 2), dupeCount };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function computeAllStats(headers, rows) {
  const rowCount = rows.length;
  const columnTypes = detectColumnTypes(headers, rows);
  const columnBasics = computeColumnBasics(headers, rows, columnTypes);
  const { numericStats, numericColumns } = computeNumericStats(rows, headers, columnTypes);
  const { categoricalStats, categoricalColumns } = computeCategoricalStats(rows, headers, columnTypes);
  const { matrix: correlationMatrix, pairs: correlationPairs } = computeCorrelationMatrix(rows, numericColumns);
  const { qualityScore, qualityFlags, totalNulls, nullPct, dupeCount } = computeQualityScore(rows, headers, columnTypes, columnBasics);

  return {
    rowCount,
    headers,
    columnTypes,
    columnBasics,
    numericStats,
    numericColumns,
    categoricalStats,
    categoricalColumns,
    correlationMatrix,
    correlationPairs,
    qualityScore,
    qualityFlags,
    totalNulls,
    nullPct,
    duplicateRowCount: dupeCount,
  };
}
