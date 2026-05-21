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

function sampleVariance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}

function stdDev(arr) {
  return Math.sqrt(sampleVariance(arr));
}

/**
 * Fisher's g1 skewness (unbiased estimator).
 * Returns null when undefined (n < 3 or zero std-dev).
 */
function fisherSkewness(arr) {
  const n = arr.length;
  if (n < 3) return null;
  const m = mean(arr);
  const s = stdDev(arr);
  if (s === 0) return null;
  const sum3 = arr.reduce((sum, x) => sum + ((x - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * sum3;
}

/**
 * Excess kurtosis (Fisher's definition, normal = 0).
 * Returns null when undefined (n < 4 or zero std-dev).
 */
function excessKurtosis(arr) {
  const n = arr.length;
  if (n < 4) return null;
  const m = mean(arr);
  const s = stdDev(arr);
  if (s === 0) return null;
  const sum4 = arr.reduce((sum, x) => sum + ((x - m) / s) ** 4, 0);
  const raw = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sum4;
  const correction = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return raw - correction;
}

/**
 * Rank an array (average ranks for ties).
 */
function rankArray(arr) {
  const indexed = arr.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j + 1) / 2; // 1-based average rank
    for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
    i = j;
  }
  return ranks;
}

function numericVals(rows, col) {
  return rows.map(r => r[col]).filter(v => v !== null && v !== '' && !isNaN(Number(v))).map(Number);
}

// ─── Column Type Detection ────────────────────────────────────────────────────

function detectColumnTypes(headers, rows) {
  const types = {};
  // Excel date heuristic: serial numbers in 1900-01-01 (1) to 2099-12-31 (~73050) range.
  const looksLikeExcelSerial = (n) => Number.isFinite(n) && n >= 1 && n <= 73050 && n === Math.round(n * 1e6) / 1e6;
  const NAME_HINTS_DATE = /^(date|day|month|year|timestamp|time|datetime|created|updated|dt|on)$|_(date|day|time|timestamp|dt)$|(date|timestamp|datetime)_/i;

  for (const h of headers) {
    const allVals = rows.map(r => r[h]);
    const nonNull = allVals.filter(v => v !== null && v !== '');
    if (nonNull.length === 0) { types[h] = 'text'; continue; }

    const nums = nonNull.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== ''));
    const numRatio = nums.length / nonNull.length;

    // Date detection requires both a high parse-success rate AND at least one
    // parsed date with a plausible (1900-2100) year. This rejects numeric
    // codes like "01", "07" that happen to parse via new Date().
    const nameHintsDate = NAME_HINTS_DATE.test(h);
    let hasReasonableYear = false;
    const dateCount = nonNull.filter(v => {
      let d = null;
      if (typeof v === 'number') {
        if (!nameHintsDate || !looksLikeExcelSerial(v)) return false;
        d = new Date(Math.round((v - 25569) * 86400 * 1000));
      } else {
        const s = String(v).trim();
        if (s === '') return false;
        if (!isNaN(Number(s)) && /^-?\d+(\.\d+)?$/.test(s)) {
          if (!nameHintsDate || !looksLikeExcelSerial(Number(s))) return false;
          d = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
        } else {
          d = new Date(s);
        }
      }
      if (!d || isNaN(d.getTime())) return false;
      const y = d.getFullYear();
      if (y >= 1900 && y <= 2100) hasReasonableYear = true;
      return true;
    }).length;
    const dateRatio = dateCount / nonNull.length;

    if (dateRatio > 0.7 && hasReasonableYear) { types[h] = 'date'; continue; }

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

    const n = vals.length;
    const m = mean(vals);
    const med = median(vals);
    const sd = stdDev(vals);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const q1 = quantile(vals, 0.25);
    const q3 = quantile(vals, 0.75);
    const iqr = q3 - q1;
    // Skewness: null for n < 3 or zero std-dev. Kurtosis: null for n < 4 or zero std-dev.
    const skewnessRaw = fisherSkewness(vals);
    const kurtosisRaw = excessKurtosis(vals);
    const skewness = skewnessRaw == null ? null : round(skewnessRaw, 4);
    const kurtosis = kurtosisRaw == null ? null : round(kurtosisRaw, 4);
    const coefficientOfVariation = m !== 0 ? sd / Math.abs(m) : 0;
    const standardError = sd / Math.sqrt(n);

    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    const iqrOutliers = vals.filter(x => x < lowerFence || x > upperFence);
    const zscoreOutliers = sd > 0 ? vals.filter(x => Math.abs(x - m) / sd > 3) : [];

    stats[col] = {
      mean: round(m), median: round(med), min: round(mn), max: round(mx),
      stdDev: round(sd), variance: round(sd * sd),
      range: round(mx - mn), q1: round(q1), q3: round(q3), iqr: round(iqr),
      skewness, kurtosis,
      coefficientOfVariation: round(coefficientOfVariation),
      standardError: round(standardError),
      sum: round(vals.reduce((a, b) => a + b, 0)),
      nonNullCount: n, nullCount: rows.length - n,
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

    // top10 (+ Other) drives the Frequency Distribution panel on the dashboard.
    const top10 = sorted.slice(0, 10).map(([value, count]) => ({
      value, count, pct: round((count / vals.length) * 100, 2),
    }));
    const otherCount = sorted.slice(10).reduce((s, [, c]) => s + c, 0);
    if (otherCount > 0) {
      top10.push({ value: 'Other', count: otherCount, pct: round((otherCount / vals.length) * 100, 2) });
    }

    const mode = sorted[0] ? sorted[0][0] : null;
    const modeCount = sorted[0] ? sorted[0][1] : 0;
    const cardinality = sorted.length;

    stats[col] = {
      top5,
      top10,
      mode,
      modeCount,
      cardinality,
      concentrationRatio: round((modeCount / rows.length) * 100, 2),
    };
  }

  return { categoricalStats: stats, categoricalColumns: catCols };
}

// ─── Correlation Matrix ───────────────────────────────────────────────────────

/**
 * Compute Pearson correlation between two arrays.
 */
function pearsonCorrelation(arrA, arrB) {
  const mA = mean(arrA), mB = mean(arrB);
  const num = arrA.reduce((s, v, i) => s + (v - mA) * (arrB[i] - mB), 0);
  const dA = Math.sqrt(arrA.reduce((s, v) => s + (v - mA) ** 2, 0));
  const dB = Math.sqrt(arrB.reduce((s, v) => s + (v - mB) ** 2, 0));
  return dA && dB ? num / (dA * dB) : null;
}

/**
 * Compute Spearman rank correlation between two arrays.
 */
function spearmanCorrelation(arrA, arrB) {
  const ranksA = rankArray(arrA);
  const ranksB = rankArray(arrB);
  return pearsonCorrelation(ranksA, ranksB);
}

function computeCorrelationMatrix(rows, numCols) {
  if (numCols.length < 2) return { matrix: {}, spearmanMatrix: {}, pairs: [] };

  // Backend: use ALL rows (frontend samples 5,000). That's the whole point of
  // running stats server-side for big datasets.

  const matrix = {};
  const spearmanMatrix = {};
  const pairs = [];

  for (const a of numCols) {
    matrix[a] = {};
    spearmanMatrix[a] = {};
    for (const b of numCols) {
      if (a === b) { matrix[a][b] = 1; spearmanMatrix[a][b] = 1; continue; }
      const pairsA = [], pairsB = [];
      rows.forEach(r => {
        const va = r[a], vb = r[b];
        if (va !== null && vb !== null && !isNaN(Number(va)) && !isNaN(Number(vb))) {
          pairsA.push(Number(va));
          pairsB.push(Number(vb));
        }
      });
      if (pairsA.length < 5) { matrix[a][b] = null; spearmanMatrix[a][b] = null; continue; }

      const r = round(pearsonCorrelation(pairsA, pairsB));
      const rho = round(spearmanCorrelation(pairsA, pairsB));
      matrix[a][b] = r;
      spearmanMatrix[a][b] = rho;

      if (r !== null && a < b) {
        pairs.push({ colA: a, colB: b, r, spearman: rho, absR: Math.abs(r), absSpearman: Math.abs(rho) });
      }
    }
  }

  pairs.sort((a, b) => b.absR - a.absR);
  return { matrix, spearmanMatrix, pairs };
}

// ─── Date Stats (subset) ──────────────────────────────────────────────────────

function computeDateStats(rows, headers, columnTypes) {
  const dateCols = headers.filter(h => columnTypes[h] === 'date');
  const stats = {};

  for (const col of dateCols) {
    const dates = rows
      .map(r => { const d = new Date(r[col]); return isNaN(d.getTime()) ? null : d; })
      .filter(Boolean)
      .sort((a, b) => a - b);
    if (dates.length < 2) continue;

    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const medianGap = median(gaps);
    const largestGap = Math.max(...gaps);
    const hasGapAnomaly = largestGap > 2 * medianGap && medianGap > 0;

    stats[col] = {
      earliest: dates[0].toISOString().split('T')[0],
      latest: dates[dates.length - 1].toISOString().split('T')[0],
      largestGapDays: round(largestGap, 1),
      medianGapDays: round(medianGap, 1),
      hasGapAnomaly,
    };
  }

  return { dateStats: stats, dateColumns: dateCols };
}

// ─── View-only derivations: histograms, category aggregations, time series ───
// These mirror the frontend equivalents so dashboard charts have data when the
// backend is the source of truth (e.g. server-uploaded datasets where the
// frontend never sees raw rows).

function findPrimaryNumericCol(numCols, numericStats) {
  if (!numCols.length) return null;
  let primary = numCols[0];
  let maxVar = 0;
  for (const col of numCols) {
    const v = numericStats[col]?.variance ?? 0;
    if (v > maxVar) { maxVar = v; primary = col; }
  }
  return primary;
}

function computeHistograms(rows, numCols, numericStats) {
  const buckets = {};
  const moneyWords = /revenue|price|cost|amount|sales|profit|income|spend/i;

  for (const col of numCols) {
    const vals = numericVals(rows, col);
    if (vals.length < 2) continue;
    const mn = Math.min(...vals), mx = Math.max(...vals);
    if (mn === mx) continue;

    const step = (mx - mn) / 7;
    const fmt = moneyWords.test(col)
      ? (v) => `$${Math.round(v).toLocaleString()}`
      : (v) => Math.round(v).toLocaleString();
    const bins = Array.from({ length: 7 }, (_, i) => ({
      range: `${fmt(mn + i * step)} – ${fmt(mn + (i + 1) * step)}`,
      count: 0,
    }));
    vals.forEach(v => {
      const idx = Math.min(6, Math.floor((v - mn) / step));
      bins[idx].count++;
    });

    const maxCount = Math.max(...bins.map(b => b.count));
    const modeBucketIdx = bins.findIndex(b => b.count === maxCount);
    const skew = numericStats[col]?.skewness;
    const skewKnown = skew != null && Number.isFinite(skew);

    buckets[col] = {
      bins: bins.map(({ range, count }, i) => ({ range, count, isMode: i === modeBucketIdx })),
      skewDirection: !skewKnown
        ? 'unknown'
        : (Math.abs(skew) > 0.5 ? (skew > 0 ? 'right-skewed' : 'left-skewed') : 'symmetric'),
      skewValue: skewKnown ? skew : null,
    };
  }
  return buckets;
}

function computeCategoryAggregations(rows, catCols, primaryCol) {
  if (!catCols.length || !primaryCol) return {};
  const result = {};

  for (const col of catCols.slice(0, 5)) {
    const groups = {};
    let totalSum = 0;
    rows.forEach(r => {
      const label = String(r[col] ?? 'null');
      if (!groups[label]) groups[label] = { label, count: 0, sum: 0 };
      groups[label].count++;
      const v = Number(r[primaryCol]);
      if (!isNaN(v)) { groups[label].sum += v; totalSum += v; }
    });

    const sorted = Object.values(groups).sort((a, b) => b.sum - a.sum);
    const top5 = sorted.slice(0, 5).map(g => ({
      label: g.label,
      count: g.count,
      sum: round(g.sum),
      mean: g.count > 0 ? round(g.sum / g.count) : 0,
      pctOfTotal: totalSum > 0 ? round((g.sum / totalSum) * 100, 2) : 0,
    }));

    const otherSum = sorted.slice(5).reduce((s, g) => s + g.sum, 0);
    const otherCount = sorted.slice(5).reduce((s, g) => s + g.count, 0);
    const donut = [...top5];
    if (otherSum > 0) {
      donut.push({
        label: 'Other',
        count: otherCount,
        sum: round(otherSum),
        mean: otherCount > 0 ? round(otherSum / otherCount) : 0,
        pctOfTotal: totalSum > 0 ? round((otherSum / totalSum) * 100, 2) : 0,
      });
    }

    const highestTotal = top5[0];
    const highestMean = [...top5].sort((a, b) => b.mean - a.mean)[0];
    let comparativeInsight = null;
    if (highestTotal && highestMean && highestTotal.label !== highestMean.label) {
      comparativeInsight = `${highestTotal.label} has the highest total ${primaryCol} (${highestTotal.sum.toLocaleString()}) but ${highestMean.label} has the highest average (${highestMean.mean.toLocaleString()}).`;
    }

    result[col] = { top5, donut, comparativeInsight, primaryCol };
  }
  return result;
}

function computeTimeSeries(rows, dateCols, numCols, numericStats) {
  if (!dateCols.length || !numCols.length) return null;
  const dateCol = dateCols[0];
  const primaryCol = findPrimaryNumericCol(numCols, numericStats);
  if (!primaryCol) return null;

  // Monthly aggregation
  const monthly = {};
  rows.forEach(r => {
    const d = new Date(r[dateCol]);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    if (!monthly[key]) monthly[key] = { date: label, value: 0, key, count: 0 };
    const v = Number(r[primaryCol]);
    if (!isNaN(v)) { monthly[key].value += v; monthly[key].count++; }
  });

  const series = Object.values(monthly)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ date, value, count }) => ({ date, value: round(value), count }));

  if (series.length < 2) return null;

  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].value;
    series[i].momChange = prev !== 0 ? round(((series[i].value - prev) / Math.abs(prev)) * 100, 2) : null;
  }
  series[0].momChange = null;

  // Linear regression trend line
  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map(s => s.value);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const denom = (n * sumX2 - sumX * sumX);
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const trendLine = series.map((s, i) => ({ date: s.date, value: round(intercept + slope * i) }));

  let trendDirection = 'Flat';
  const avgVal = mean(ys);
  if (avgVal !== 0 && Math.abs(slope / avgVal) > 0.02) {
    trendDirection = slope > 0 ? 'Upward trend' : 'Downward trend';
  }

  const peakIdx = ys.indexOf(Math.max(...ys));
  const troughIdx = ys.indexOf(Math.min(...ys));
  const peakToTroughRatio = ys[troughIdx] !== 0 ? round(ys[peakIdx] / ys[troughIdx], 2) : null;

  let seasonalityHint = null;
  if (series.length > 12) {
    const byMonth = {};
    series.forEach(s => {
      const month = s.date.split(' ')[0];
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(s.value);
    });
    const monthAvgs = Object.entries(byMonth).map(([month, vals]) => ({ month, avg: mean(vals) }));
    monthAvgs.sort((a, b) => b.avg - a.avg);
    if (monthAvgs.length > 1) {
      const topMonth = monthAvgs[0];
      const botMonth = monthAvgs[monthAvgs.length - 1];
      if (botMonth.avg > 0 && topMonth.avg > botMonth.avg * 1.5) {
        seasonalityHint = `${topMonth.month} consistently outperforms ${botMonth.month} by ${round(((topMonth.avg - botMonth.avg) / botMonth.avg) * 100, 1)}%.`;
      }
    }
  }

  return {
    series,
    trendLine,
    trendDirection,
    slope: round(slope),
    intercept: round(intercept),
    peak: { date: series[peakIdx]?.date, value: series[peakIdx]?.value, index: peakIdx },
    trough: { date: series[troughIdx]?.date, value: series[troughIdx]?.value, index: troughIdx },
    peakToTroughRatio,
    seasonalityHint,
    primaryCol,
    dateCol,
  };
}

// ─── Anomaly Detection (ported from frontend computeAnomalies) ────────────────

function computeAnomalies(rows, headers, columnTypes, numericStats, categoricalColumns) {
  const numCols = headers.filter(h => columnTypes[h] === 'numeric');
  const anomalies = {
    constantColumns: [],
    nearConstantColumns: [],
    suspiciousPatterns: [],
    outlierComparison: {},
    benfordAnomalies: [],
    fuzzyDuplicates: [],
  };

  for (const col of numCols) {
    const vals = numericVals(rows, col);
    if (vals.length === 0) continue;
    const s = numericStats[col];
    if (!s) continue;

    // Constant columns (zero variance)
    if (s.stdDev === 0) {
      anomalies.constantColumns.push(col);
      continue;
    }

    // Near-constant: top value > 95% of rows
    const freq = {};
    vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
    const maxFreq = Math.max(...Object.values(freq));
    if (maxFreq / rows.length > 0.95) {
      anomalies.nearConstantColumns.push(col);
    }

    // All zeros
    if (vals.every(v => v === 0)) {
      anomalies.suspiciousPatterns.push({ column: col, type: 'all_zeros', description: `${col} is entirely zeros` });
    }

    // Suspicious rounding: >80% are multiples of 10
    const roundCount = vals.filter(v => v !== 0 && v % 10 === 0).length;
    if (roundCount / vals.length > 0.8) {
      anomalies.suspiciousPatterns.push({ column: col, type: 'suspicious_rounding', description: `>80% of ${col} values are round numbers` });
    }

    // Monotonic — skip ID columns (they're supposed to be sorted)
    if (columnTypes[col] !== 'id') {
      let increasing = true, decreasing = true;
      for (let i = 1; i < vals.length; i++) {
        if (vals[i] < vals[i - 1]) increasing = false;
        if (vals[i] > vals[i - 1]) decreasing = false;
      }
      if ((increasing || decreasing) && vals.length > 5) {
        anomalies.suspiciousPatterns.push({
          column: col,
          type: 'monotonic',
          description: `${col} is ${increasing ? 'monotonically increasing' : 'monotonically decreasing'}`,
        });
      }
    }

    // Z-score vs IQR comparison
    anomalies.outlierComparison[col] = {
      zscoreCount: s.zscoreOutlierCount,
      iqrCount: s.iqrOutlierCount,
      disagree: Math.abs(s.zscoreOutlierCount - s.iqrOutlierCount) > Math.max(s.zscoreOutlierCount, s.iqrOutlierCount) * 0.5 && (s.zscoreOutlierCount > 0 || s.iqrOutlierCount > 0),
    };

    // Benford's Law check
    if (vals.length > 50 && s.stdDev > 0) {
      const firstDigits = vals
        .map(v => parseInt(String(Math.abs(v)).replace(/[^1-9]/g, '')[0]))
        .filter(n => !isNaN(n) && n > 0);
      if (firstDigits.length > 50) {
        const counts = Array(10).fill(0);
        firstDigits.forEach(d => counts[d]++);
        const actualPct = counts.map(c => c / firstDigits.length);
        const benfordExpected = [0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];
        let mad = 0;
        for (let i = 0; i < 9; i++) mad += Math.abs(actualPct[i + 1] - benfordExpected[i]);
        mad = mad / 9;
        if (mad > 0.04) {
          anomalies.benfordAnomalies.push({
            column: col,
            mad: round(mad, 3),
            description: `${col} deviates from Benford's Law (MAD: ${(mad * 100).toFixed(1)}%).`,
          });
        }
      }
    }
  }

  // Fuzzy categorical near-duplicates
  for (const col of categoricalColumns || []) {
    const rawVals = rows.map(r => r[col]).filter(v => v !== null && v !== '');
    const uniqueVals = Array.from(new Set(rawVals.map(String)));
    if (uniqueVals.length > 1 && uniqueVals.length < 200) {
      const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const map = {};
      uniqueVals.forEach(v => {
        const norm = normalize(v);
        if (norm.length > 2) {
          if (!map[norm]) map[norm] = [];
          map[norm].push(v);
        }
      });
      const collisions = Object.values(map).filter(arr => Array.from(new Set(arr)).length > 1);
      if (collisions.length > 0) {
        collisions.slice(0, 3).forEach(group => {
          anomalies.fuzzyDuplicates.push({
            column: col,
            group: Array.from(new Set(group)),
            description: `Near-duplicate categories in ${col}: "${Array.from(new Set(group)).join('", "')}"`,
          });
        });
      }
    }
  }

  return anomalies;
}

// ─── Quality Flags (structured object — matches frontend shape) ───────────────

function computeQualityFlags(rows, headers, columnTypes, columnBasics, anomalies, dateStats) {
  // Duplicate rows
  const seen = new Set();
  let duplicateRowCount = 0;
  rows.forEach(r => {
    const key = JSON.stringify(r);
    if (seen.has(key)) duplicateRowCount++;
    else seen.add(key);
  });
  const duplicatePct = rows.length > 0
    ? round((duplicateRowCount / rows.length) * 100, 2)
    : 0;

  // Null / mixed-type accounting
  let totalNullCount = 0;
  const highNullCols = [];
  const allNullCols = [];
  const mixedTypeCols = [];

  for (const h of headers) {
    const b = columnBasics[h];
    totalNullCount += b.nullCount;
    if (b.nullPct === 100) allNullCols.push(h);
    else if (b.nullPct > 20) highNullCols.push(h);

    const vals = rows.map(r => r[h]).filter(v => v !== null && v !== '');
    const numericCount = vals.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')).length;
    const stringCount = vals.length - numericCount;
    const ratio = vals.length > 0 ? Math.min(numericCount, stringCount) / vals.length : 0;
    // Bumped from 0.05 to 0.15 — 5% was too sensitive and flagged clean cols
    // that contained a few stringified numbers.
    if (ratio > 0.15) mixedTypeCols.push(h);
  }

  const totalCells = rows.length * headers.length;
  const nullPct = totalCells > 0 ? round((totalNullCount / totalCells) * 100, 2) : 0;

  const dateGapCols = [];
  Object.entries(dateStats || {}).forEach(([col, ds]) => {
    if (ds.hasGapAnomaly) dateGapCols.push(col);
  });

  // Build a flat flags array for UI chips
  const flags = [];
  if (duplicateRowCount > 0) flags.push({ type: 'Duplicate rows', detail: `${duplicateRowCount} duplicates (${duplicatePct}%)`, severity: 'warning', count: duplicateRowCount });
  if (totalNullCount > 0)    flags.push({ type: 'Missing values', detail: `${totalNullCount} nulls (${nullPct}%)`, severity: 'warning', count: totalNullCount });
  highNullCols.forEach(h =>  flags.push({ type: 'High null column', detail: `${h}: ${columnBasics[h].nullPct}% null`, severity: 'danger', column: h }));
  allNullCols.forEach(h =>   flags.push({ type: 'All-null column', detail: `${h} is entirely null`, severity: 'danger', column: h }));
  mixedTypeCols.forEach(h => flags.push({ type: 'Mixed type column', detail: `${h} has mixed numeric/string values`, severity: 'warning', column: h }));
  (anomalies?.constantColumns || []).forEach(c => flags.push({ type: 'Zero variance column', detail: `${c} has zero variance (constant)`, severity: 'info', column: c }));
  (anomalies?.nearConstantColumns || []).forEach(c => flags.push({ type: 'Low variance column', detail: `${c} top value >95% of rows`, severity: 'info', column: c }));
  (anomalies?.suspiciousPatterns || []).filter(p => p.type === 'monotonic').forEach(p => flags.push({ type: 'Monotonic column', detail: p.description, severity: 'info', column: p.column }));
  (anomalies?.suspiciousPatterns || []).filter(p => p.type === 'suspicious_rounding').forEach(p => flags.push({ type: 'Suspicious rounding', detail: p.description, severity: 'info', column: p.column }));
  (anomalies?.benfordAnomalies || []).forEach(a => flags.push({ type: 'Benford Law Anomaly', detail: a.description, severity: 'warning', column: a.column }));
  (anomalies?.fuzzyDuplicates || []).forEach(a => flags.push({ type: 'Category Consistency', detail: a.description, severity: 'warning', column: a.column }));
  dateGapCols.forEach(c => flags.push({ type: 'Date gaps detected', detail: `${c}: largest gap ${dateStats[c].largestGapDays} days (median ${dateStats[c].medianGapDays})`, severity: 'warning', column: c }));

  return {
    flags,
    duplicateRowCount,
    duplicatePct,
    totalNullCount,
    nullPct,
    totalCells,
    emptyRowCount: 0,
    mixedTypeColumns: mixedTypeCols,
    highNullColumns: highNullCols,
    allNullColumns: allNullCols,
    dateGapColumns: dateGapCols,
  };
}

// ─── Quality Score ────────────────────────────────────────────────────────────

/**
 * Identical algorithm to the frontend's computeQualityScore.
 * Score starts at 100 and accumulates capped penalties from each dimension.
 *
 * Returns { qualityScore, scoreFlags, scoreBreakdown }
 * scoreBreakdown is the per-dimension penalty (handy for the demo to explain
 * "why is this a 62?").
 */
function computeQualityScore(qualityFlags, rowCount, colCount, numericStats, anomalies) {
  if (!rowCount || !colCount) {
    return { qualityScore: 0, scoreFlags: ['empty_dataset'], scoreBreakdown: {} };
  }

  const totalCells = rowCount * colCount;
  const flags = [];
  const breakdown = {};

  // Nulls
  const totalNulls = qualityFlags.totalNullCount ?? 0;
  const nullPct = totalCells > 0 ? (totalNulls / totalCells) * 100 : 0;
  const nullPenalty = Math.min(40, nullPct * 1.2);
  breakdown.nulls = round(nullPenalty, 2);

  // Duplicates
  const dupeCount = qualityFlags.duplicateRowCount ?? 0;
  const dupePct = rowCount > 0 ? (dupeCount / rowCount) * 100 : 0;
  const dupePenalty = Math.min(25, dupePct * 1.5);
  breakdown.duplicates = round(dupePenalty, 2);

  // Mixed types
  const mixedCount = (qualityFlags.mixedTypeColumns || []).length;
  const mixedRatio = colCount > 0 ? mixedCount / colCount : 0;
  const mixedPenalty = Math.min(15, mixedRatio * 60);
  breakdown.mixedTypes = round(mixedPenalty, 2);

  // High-null columns
  const highNullCount = (qualityFlags.highNullColumns || []).length;
  const highNullPenalty = Math.min(12, highNullCount * 3);
  breakdown.highNullCols = round(highNullPenalty, 2);

  // All-null columns
  const allNullCount = (qualityFlags.allNullColumns || []).length;
  const allNullPenalty = Math.min(16, allNullCount * 8);
  breakdown.allNullCols = round(allNullPenalty, 2);

  // Constant columns
  const constCount = (anomalies?.constantColumns || []).length;
  const constPenalty = Math.min(12, constCount * 4);
  breakdown.constantCols = round(constPenalty, 2);

  // Near-constant columns
  const nearConstCount = (anomalies?.nearConstantColumns || []).length;
  const nearConstPenalty = Math.min(8, nearConstCount * 2);
  breakdown.nearConstantCols = round(nearConstPenalty, 2);

  // Monotonic columns
  const monotonicCount = (anomalies?.suspiciousPatterns || []).filter(p => p.type === 'monotonic').length;
  const monotonicPenalty = Math.min(6, monotonicCount * 2);
  breakdown.monotonicCols = round(monotonicPenalty, 2);

  // Fuzzy duplicate categories
  const fuzzyCount = (anomalies?.fuzzyDuplicates || []).length;
  const fuzzyPenalty = Math.min(12, fuzzyCount * 3);
  breakdown.fuzzyDuplicates = round(fuzzyPenalty, 2);

  // Benford anomalies
  const benfordCount = (anomalies?.benfordAnomalies || []).length;
  const benfordPenalty = Math.min(12, benfordCount * 4);
  breakdown.benfordAnomalies = round(benfordPenalty, 2);

  // Suspicious rounding
  const roundingCount = (anomalies?.suspiciousPatterns || []).filter(p => p.type === 'suspicious_rounding').length;
  const roundingPenalty = Math.min(6, roundingCount * 2);
  breakdown.suspiciousRounding = round(roundingPenalty, 2);

  // Date gaps
  const dateGapCount = (qualityFlags.dateGapColumns || []).length;
  const dateGapPenalty = Math.min(9, dateGapCount * 3);
  breakdown.dateGapAnomalies = round(dateGapPenalty, 2);

  // Outlier-heavy columns (z-score outliers > 5% of values)
  let outlierHeavy = 0;
  if (numericStats) {
    for (const col of Object.keys(numericStats)) {
      const s = numericStats[col];
      if (!s || !s.nonNullCount) continue;
      if (s.zscoreOutlierCount > 0 && (s.zscoreOutlierCount / s.nonNullCount) > 0.05) {
        outlierHeavy++;
      }
    }
  }
  const outlierPenalty = Math.min(8, outlierHeavy * 2);
  breakdown.outlierHeavyCols = round(outlierPenalty, 2);

  const totalPenalty = Math.min(100,
    nullPenalty + dupePenalty + mixedPenalty +
    highNullPenalty + allNullPenalty +
    constPenalty + nearConstPenalty + monotonicPenalty +
    fuzzyPenalty + benfordPenalty + roundingPenalty +
    dateGapPenalty + outlierPenalty
  );
  let score = 100 - totalPenalty;

  // Soft cap for tiny datasets
  if (rowCount < 50 || colCount < 2) {
    if (score > 70) score = 70;
    flags.push('limited_data');
  }

  score = Math.round(Math.max(0, Math.min(100, score)));
  return { qualityScore: score, scoreFlags: flags, scoreBreakdown: breakdown };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function computeAllStats(headers, rows) {
  const rowCount = rows.length;
  const columnTypes = detectColumnTypes(headers, rows);
  const columnBasics = computeColumnBasics(headers, rows, columnTypes);
  const { numericStats, numericColumns } = computeNumericStats(rows, headers, columnTypes);
  const { categoricalStats, categoricalColumns } = computeCategoricalStats(rows, headers, columnTypes);
  const { dateStats, dateColumns } = computeDateStats(rows, headers, columnTypes);
  const {
    matrix: correlationMatrix,
    spearmanMatrix,
    pairs: correlationPairs,
  } = computeCorrelationMatrix(rows, numericColumns);

  const anomalies = computeAnomalies(rows, headers, columnTypes, numericStats, categoricalColumns);
  const qualityFlags = computeQualityFlags(rows, headers, columnTypes, columnBasics, anomalies, dateStats);

  const { qualityScore, scoreFlags, scoreBreakdown } = computeQualityScore(
    qualityFlags, rowCount, headers.length, numericStats, anomalies
  );

  // View-only derivations the dashboard charts read directly. Cheap to compute
  // since we already have rows in memory; saves the frontend from needing them
  // for backend-uploaded datasets (where it never sees raw rows).
  const primaryCol = findPrimaryNumericCol(numericColumns, numericStats);
  const histogramBuckets = computeHistograms(rows, numericColumns, numericStats);
  const categoryAggregations = computeCategoryAggregations(rows, categoricalColumns, primaryCol);
  const timeSeries = computeTimeSeries(rows, dateColumns, numericColumns, numericStats);

  return {
    rowCount,
    headers,
    columnTypes,
    columnBasics,
    numericStats,
    numericColumns,
    categoricalStats,
    categoricalColumns,
    dateStats,
    dateColumns,
    correlationMatrix,
    spearmanMatrix,
    correlationPairs,
    anomalies,
    qualityFlags,
    qualityScore,
    scoreFlags,
    scoreBreakdown,
    primaryCol,
    histogramBuckets,
    categoryAggregations,
    timeSeries,
    // Top-level legacy fields (kept for callers that read them directly)
    totalNulls: qualityFlags.totalNullCount,
    nullPct: qualityFlags.nullPct,
    duplicateRowCount: qualityFlags.duplicateRowCount,
  };
}
