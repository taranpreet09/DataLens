// ─── DataLens Eval 1 — Stats Engine ────────────────────────────────────────────
// Pure computation module. Zero React dependencies. Zero side effects.
// Exports a single function: computeAllStats(headers, rows) => DatasetStats

// ─── Utility ───────────────────────────────────────────────────────────────────

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

function variance(arr) { const sd = stdDev(arr); return sd * sd; }

function numericVals(rows, col) {
  return rows.map(r => r[col]).filter(v => v !== null && v !== '' && !isNaN(Number(v))).map(Number);
}

// ─── Step 1: Column Type Detection ─────────────────────────────────────────────

function detectColumnTypes(headers, rows) {
  const types = {};
  for (const h of headers) {
    const allVals = rows.map(r => r[h]);
    const nonNull = allVals.filter(v => v !== null && v !== '');
    if (nonNull.length === 0) { types[h] = 'text'; continue; }

    const nums = nonNull.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== ''));
    const numRatio = nums.length / nonNull.length;

    // Date check
    const dateCount = nonNull.filter(v => {
      if (typeof v === 'number') return false;
      const d = new Date(v);
      return !isNaN(d.getTime()) && isNaN(Number(v));
    }).length;
    const dateRatio = dateCount / nonNull.length;

    if (dateRatio > 0.7) { types[h] = 'date'; continue; }

    if (numRatio > 0.7) {
      // Check if ID column: high uniqueness + likely identifiers
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

// ─── Step 2: Per-Column Basic Stats ────────────────────────────────────────────

function computeColumnBasics(headers, rows, columnTypes) {
  const basics = {};
  for (const h of headers) {
    const allVals = rows.map(r => r[h]);
    const nonNull = allVals.filter(v => v !== null && v !== '');
    const nullCount = rows.length - nonNull.length;
    const nullPct = round((nullCount / rows.length) * 100, 2);
    const uniqueSet = new Set(nonNull.map(String));
    const uniqueCount = uniqueSet.size;
    const uniquenessRatio = round((uniqueCount / rows.length) * 100, 2);

    let qualityStatus = 'Clean';
    if (nullCount === rows.length) qualityStatus = 'All nulls';
    else if (nullPct > 20) qualityStatus = `${nullCount} nulls`;
    else if (nullCount > 0) qualityStatus = `${nullCount} nulls`;

    basics[h] = {
      name: h,
      type: columnTypes[h],
      nonNullCount: nonNull.length,
      nullCount,
      nullPct,
      uniqueCount,
      uniquenessRatio,
      qualityStatus,
    };
  }
  return basics;
}

// ─── Step 3: Numeric Column Stats ──────────────────────────────────────────────

function computeNumericStats(rows, headers, columnTypes) {
  const numCols = headers.filter(h => columnTypes[h] === 'numeric');
  const stats = {};

  for (const col of numCols) {
    const vals = numericVals(rows, col);
    if (vals.length < 2) continue;

    const m = mean(vals);
    const med = median(vals);
    const sd = stdDev(vals);
    const v = variance(vals);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const range = mx - mn;
    const q1 = quantile(vals, 0.25);
    const q3 = quantile(vals, 0.75);
    const iqr = q3 - q1;

    // Skewness: Pearson's second skewness coefficient
    const skewness = sd > 0 ? round((3 * (m - med)) / sd, 4) : 0;

    // Z-score outliers: |value - mean| / stdDev > 3
    const zscoreOutliers = sd > 0 ? vals.filter(x => Math.abs(x - m) / sd > 3) : [];

    // IQR outliers: outside Q1 - 1.5*IQR ... Q3 + 1.5*IQR
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    const iqrOutliers = vals.filter(x => x < lowerFence || x > upperFence);

    // Coefficient of variation
    const cv = m !== 0 ? round(Math.abs(sd / m) * 100, 2) : null;

    stats[col] = {
      mean: round(m),
      median: round(med),
      min: round(mn),
      max: round(mx),
      stdDev: round(sd),
      variance: round(v),
      range: round(range),
      q1: round(q1),
      q3: round(q3),
      iqr: round(iqr),
      skewness,
      sum: round(vals.reduce((a, b) => a + b, 0)),
      nonNullCount: vals.length,
      nullCount: rows.length - vals.length,
      zscoreOutlierCount: zscoreOutliers.length,
      zscoreOutlierMin: zscoreOutliers.length ? round(Math.min(...zscoreOutliers)) : null,
      zscoreOutlierMax: zscoreOutliers.length ? round(Math.max(...zscoreOutliers)) : null,
      iqrOutlierCount: iqrOutliers.length,
      iqrLowerFence: round(lowerFence),
      iqrUpperFence: round(upperFence),
      iqrOutlierMin: iqrOutliers.length ? round(Math.min(...iqrOutliers)) : null,
      iqrOutlierMax: iqrOutliers.length ? round(Math.max(...iqrOutliers)) : null,
      cv,
    };
  }

  return { numericStats: stats, numericColumns: numCols };
}

// ─── Step 4: Categorical Column Stats ──────────────────────────────────────────

function computeCategoricalStats(rows, headers, columnTypes) {
  const catCols = headers.filter(h => columnTypes[h] === 'categorical');
  const stats = {};

  for (const col of catCols) {
    const vals = rows.map(r => r[col]).filter(v => v !== null && v !== '');
    const freq = {};
    vals.forEach(v => { const k = String(v); freq[k] = (freq[k] || 0) + 1; });

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5).map(([value, count]) => ({
      value,
      count,
      pct: round((count / vals.length) * 100, 2),
    }));

    const mode = sorted[0] ? sorted[0][0] : null;
    const modeCount = sorted[0] ? sorted[0][1] : 0;
    const cardinality = sorted.length;
    const concentrationRatio = round((modeCount / rows.length) * 100, 2);

    // Build top 10 + Other for frequency distribution
    const top10 = sorted.slice(0, 10).map(([value, count]) => ({
      value,
      count,
      pct: round((count / vals.length) * 100, 2),
    }));
    const otherCount = sorted.slice(10).reduce((s, [, c]) => s + c, 0);
    if (otherCount > 0) {
      top10.push({ value: 'Other', count: otherCount, pct: round((otherCount / vals.length) * 100, 2) });
    }

    stats[col] = { top5, top10, mode, modeCount, cardinality, concentrationRatio };
  }

  return { categoricalStats: stats, categoricalColumns: catCols };
}

// ─── Step 4.5: Text Column Stats ─────────────────────────────────────────────

function computeTextStats(rows, headers, columnTypes) {
  const textCols = headers.filter(h => columnTypes[h] === 'text');
  const stats = {};

  for (const col of textCols) {
    const vals = rows.map(r => String(r[col] ?? '')).filter(v => v !== 'null' && v !== '');
    if (vals.length === 0) continue;

    let totalLength = 0;
    let totalWords = 0;
    let specialCharAnomalies = 0;
    let whitespaceAnomalies = 0;
    
    vals.forEach(v => {
      totalLength += v.length;
      totalWords += v.split(/\s+/).filter(Boolean).length;
      if (/[<>{}\[\]\\]/.test(v)) specialCharAnomalies++;
      if (/^\s+|\s+$/.test(v) || /\s{2,}/.test(v)) whitespaceAnomalies++;
    });

    const avgLength = round(totalLength / vals.length, 1);
    const avgWords = round(totalWords / vals.length, 1);

    stats[col] = {
      avgLength,
      avgWords,
      specialCharAnomalies,
      whitespaceAnomalies,
      totalNonEmpty: vals.length
    };
  }
  return { textStats: stats, textColumns: textCols };
}

// ─── Step 5: Date Column Stats ─────────────────────────────────────────────────

function computeDateStats(rows, headers, columnTypes) {
  const dateCols = headers.filter(h => columnTypes[h] === 'date');
  const stats = {};

  for (const col of dateCols) {
    const dates = rows
      .map(r => { const d = new Date(r[col]); return isNaN(d.getTime()) ? null : d; })
      .filter(Boolean)
      .sort((a, b) => a - b);

    if (dates.length < 2) continue;

    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    const rangeInDays = Math.round((latest - earliest) / (1000 * 60 * 60 * 24));

    // Most common day of week
    const dayFreq = [0, 0, 0, 0, 0, 0, 0];
    const monthFreq = Array(12).fill(0);
    dates.forEach(d => { dayFreq[d.getDay()]++; monthFreq[d.getMonth()]++; });
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const mostCommonDay = dayNames[dayFreq.indexOf(Math.max(...dayFreq))];
    const mostCommonMonth = monthNames[monthFreq.indexOf(Math.max(...monthFreq))];

    // Gap detection
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const medianGap = median(gaps);
    const largestGap = Math.max(...gaps);
    const hasGapAnomaly = largestGap > 2 * medianGap && medianGap > 0;

    stats[col] = {
      earliest: earliest.toISOString().split('T')[0],
      latest: latest.toISOString().split('T')[0],
      rangeInDays,
      mostCommonDay,
      mostCommonMonth,
      largestGapDays: round(largestGap, 1),
      medianGapDays: round(medianGap, 1),
      hasGapAnomaly,
      monthlyDistribution: monthNames.map((name, i) => ({ month: name.slice(0, 3), count: monthFreq[i] })),
      dayOfWeekDistribution: dayNames.map((name, i) => ({ day: name.slice(0, 3), count: dayFreq[i] })),
    };
  }

  return { dateStats: stats, dateColumns: dateCols };
}

// ─── Step 6: Correlation Matrix ────────────────────────────────────────────────

function getCorrelationStrength(r) {
  const a = Math.abs(r);
  if (a >= 0.9) return r > 0 ? 'Very strong positive' : 'Very strong negative';
  if (a >= 0.7) return r > 0 ? 'Strong positive' : 'Strong negative';
  if (a >= 0.5) return r > 0 ? 'Moderate positive' : 'Moderate negative';
  if (a >= 0.3) return r > 0 ? 'Weak positive' : 'Weak negative';
  return 'Negligible';
}

function computeCorrelationMatrix(rows, numCols) {
  if (numCols.length < 2) return { matrix: {}, insights: [] };

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

      // Collect unique pairs for insight generation
      if (r !== null && a < b) {
        pairs.push({ colA: a, colB: b, r, absR: Math.abs(r), strength: getCorrelationStrength(r) });
      }
    }
  }

  // Step 7: Auto-generated correlation insights
  pairs.sort((a, b) => b.absR - a.absR);
  const insights = [];

  // Top 3 strongest
  const top3 = pairs.slice(0, 3);
  for (const p of top3) {
    const dir = p.r > 0 ? 'higher' : 'lower';
    const assoc = p.r > 0 ? 'tend to increase together' : 'tend to move in opposite directions';
    insights.push({
      type: p.r > 0 ? 'positive' : 'negative',
      text: `${p.colA} and ${p.colB} are ${p.strength.toLowerCase()} (r = ${p.r.toFixed(2)}) — ${assoc}.`,
      r: p.r,
    });
  }

  // Most surprising negative
  const negatives = pairs.filter(p => p.r < -0.2).sort((a, b) => a.r - b.r);
  if (negatives.length > 0 && !top3.includes(negatives[0])) {
    const p = negatives[0];
    insights.push({
      type: 'negative',
      text: `${p.colA} and ${p.colB} are ${p.strength.toLowerCase()} (r = ${p.r.toFixed(2)}) — increases in one associate with decreases in the other.`,
      r: p.r,
    });
  }

  return { matrix, insights, pairs };
}

// ─── Step 8: Category Aggregations ─────────────────────────────────────────────

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

function computeCategoryAggregations(rows, catCols, primaryCol, numericStats) {
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
      ...g,
      sum: round(g.sum),
      mean: round(g.sum / g.count),
      pctOfTotal: totalSum > 0 ? round((g.sum / totalSum) * 100, 2) : 0,
    }));

    // Donut data: top 5 + Other
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

    // Comparative insight
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

// ─── Step 9: Histogram Buckets ─────────────────────────────────────────────────

function computeHistograms(rows, numCols, numericStats) {
  const buckets = {};
  const moneyWords = /revenue|price|cost|amount|sales|profit|income|spend/i;

  for (const col of numCols) {
    const vals = numericVals(rows, col);
    if (vals.length < 2) continue;
    const mn = Math.min(...vals), mx = Math.max(...vals);
    if (mn === mx) continue;

    const step = (mx - mn) / 7;
    const fmt = moneyWords.test(col) ? v => `$${Math.round(v).toLocaleString()}` : v => Math.round(v).toLocaleString();
    const bins = Array.from({ length: 7 }, (_, i) => ({
      range: `${fmt(mn + i * step)} – ${fmt(mn + (i + 1) * step)}`,
      count: 0,
      lo: mn + i * step,
      hi: mn + (i + 1) * step,
    }));
    vals.forEach(v => {
      const idx = Math.min(6, Math.floor((v - mn) / step));
      bins[idx].count++;
    });

    const maxCount = Math.max(...bins.map(b => b.count));
    const modeBucketIdx = bins.findIndex(b => b.count === maxCount);
    const skew = numericStats[col]?.skewness ?? 0;

    buckets[col] = {
      bins: bins.map(({ range, count }, i) => ({ range, count, isMode: i === modeBucketIdx })),
      skewDirection: Math.abs(skew) > 0.5 ? (skew > 0 ? 'right-skewed' : 'left-skewed') : 'symmetric',
      skewValue: skew,
    };
  }
  return buckets;
}

// ─── Step 10: Time Series Analysis ─────────────────────────────────────────────

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
    const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    if (!monthly[key]) monthly[key] = { date: label, value: 0, key, count: 0 };
    const v = Number(r[primaryCol]);
    if (!isNaN(v)) { monthly[key].value += v; monthly[key].count++; }
  });

  const series = Object.values(monthly)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ date, value, count }) => ({ date, value: round(value), count }));

  if (series.length < 2) return null;

  // Month-over-month change
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].value;
    series[i].momChange = prev !== 0 ? round(((series[i].value - prev) / Math.abs(prev)) * 100, 2) : null;
  }
  series[0].momChange = null;

  // Linear regression trend line: y = slope * x + intercept
  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map(s => s.value);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const trendLine = series.map((s, i) => ({ date: s.date, value: round(intercept + slope * i) }));

  let trendDirection = 'Flat';
  const avgVal = mean(ys);
  if (avgVal !== 0 && Math.abs(slope / avgVal) > 0.02) {
    trendDirection = slope > 0 ? 'Upward trend' : 'Downward trend';
  }

  // Peak and trough
  const peakIdx = ys.indexOf(Math.max(...ys));
  const troughIdx = ys.indexOf(Math.min(...ys));
  const peakToTroughRatio = ys[troughIdx] !== 0 ? round(ys[peakIdx] / ys[troughIdx], 2) : null;

  // Seasonality hint (if > 12 months)
  let seasonalityHint = null;
  if (series.length > 12) {
    // Compare same-month values across years
    const byMonth = {};
    series.forEach(s => {
      const month = s.date.split(' ')[0]; // "Jan", "Feb", etc.
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(s.value);
    });
    const monthAvgs = Object.entries(byMonth).map(([month, vals]) => ({ month, avg: mean(vals) }));
    monthAvgs.sort((a, b) => b.avg - a.avg);
    if (monthAvgs.length > 1) {
      const topMonth = monthAvgs[0];
      const botMonth = monthAvgs[monthAvgs.length - 1];
      if (topMonth.avg > botMonth.avg * 1.5) {
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

// ─── Step 11: Outlier & Anomaly Detection ──────────────────────────────────────

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

    // Suspicious rounding: >80% are round numbers (multiples of 10, 100, etc.)
    const roundCount = vals.filter(v => v !== 0 && v % 10 === 0).length;
    if (roundCount / vals.length > 0.8) {
      anomalies.suspiciousPatterns.push({ column: col, type: 'suspicious_rounding', description: `>80% of ${col} values are round numbers` });
    }

    // Monotonic check
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

    // Z-score vs IQR comparison
    anomalies.outlierComparison[col] = {
      zscoreCount: s.zscoreOutlierCount,
      iqrCount: s.iqrOutlierCount,
      disagree: Math.abs(s.zscoreOutlierCount - s.iqrOutlierCount) > Math.max(s.zscoreOutlierCount, s.iqrOutlierCount) * 0.5 && (s.zscoreOutlierCount > 0 || s.iqrOutlierCount > 0),
    };

    // Benford's Law Check
    if (vals.length > 50 && s.stdDev > 0) {
      const firstDigits = vals.map(v => parseInt(String(Math.abs(v)).replace(/[^1-9]/g, '')[0])).filter(n => !isNaN(n) && n > 0);
      if (firstDigits.length > 50) {
        const counts = Array(10).fill(0);
        firstDigits.forEach(d => counts[d]++);
        const actualPct = counts.map(c => c / firstDigits.length);
        const expectedPct = [0, 0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];
        let mad = 0;
        for (let d = 1; d <= 9; d++) {
          mad += Math.abs(actualPct[d] - expectedPct[d]);
        }
        mad = mad / 9;
        
        if (mad > 0.04) {
           anomalies.benfordAnomalies.push({
             column: col,
             mad: round(mad, 3),
             description: `${col} deviates from Benford's Law (MAD: ${(mad*100).toFixed(1)}%). Potential synthetic or anomalous distribution.`
           });
        }
      }
    }
  }

  // Fuzzy Categorical Near-Duplicates
  for (const col of categoricalColumns || []) {
    const rawVals = rows.map(r => r[col]).filter(v => v !== null && v !== '');
    const uniqueVals = Array.from(new Set(rawVals.map(String)));
    if (uniqueVals.length > 1 && uniqueVals.length < 200) {
      const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const map = {};
      uniqueVals.forEach(v => {
        const norm = normalize(v);
        // Only consider tokens with meaningful length
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
             description: `Near-duplicate categories in ${col}: "${Array.from(new Set(group)).join('", "')}"`
           });
        });
      }
    }
  }

  return anomalies;
}

// ─── Step 12: Data Quality Flags ───────────────────────────────────────────────

function computeQualityFlags(rows, headers, columnTypes, numericStats, columnBasics, anomalies, dateStatsMap) {
  const flags = [];

  // Duplicate rows
  const seen = new Set();
  let duplicateRowCount = 0;
  rows.forEach(r => {
    const key = JSON.stringify(r);
    if (seen.has(key)) duplicateRowCount++;
    else seen.add(key);
  });
  const duplicatePct = round((duplicateRowCount / rows.length) * 100, 2);
  if (duplicateRowCount > 0) {
    flags.push({ type: 'Duplicate rows', detail: `${duplicateRowCount} duplicates (${duplicatePct}%)`, severity: 'warning', count: duplicateRowCount });
  }

  // Missing values total
  let totalNullCount = 0;
  const highNullCols = [];
  const allNullCols = [];
  const mixedTypeCols = [];

  for (const h of headers) {
    const b = columnBasics[h];
    totalNullCount += b.nullCount;

    if (b.nullPct === 100) allNullCols.push(h);
    else if (b.nullPct > 20) highNullCols.push(h);

    // Mixed type detection
    const vals = rows.map(r => r[h]).filter(v => v !== null && v !== '');
    const numericCount = vals.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')).length;
    const stringCount = vals.length - numericCount;
    const ratio = vals.length > 0 ? Math.min(numericCount, stringCount) / vals.length : 0;
    if (ratio > 0.05) mixedTypeCols.push(h);
  }

  const totalCells = rows.length * headers.length;
  const nullPct = round((totalNullCount / totalCells) * 100, 2);

  if (totalNullCount > 0) {
    flags.push({ type: 'Missing values', detail: `${totalNullCount.toLocaleString()} nulls (${nullPct}%)`, severity: 'warning', count: totalNullCount });
  }
  highNullCols.forEach(h => {
    flags.push({ type: 'High null column', detail: `${h}: ${columnBasics[h].nullPct}% null`, severity: 'danger', column: h });
  });
  allNullCols.forEach(h => {
    flags.push({ type: 'All-null column', detail: `${h} is entirely null`, severity: 'danger', column: h });
  });
  mixedTypeCols.forEach(h => {
    flags.push({ type: 'Mixed type column', detail: `${h} has mixed numeric/string values`, severity: 'warning', column: h });
  });

  // Zero/low variance
  anomalies.constantColumns.forEach(col => {
    flags.push({ type: 'Zero variance column', detail: `${col} has zero variance (constant)`, severity: 'info', column: col });
  });
  anomalies.nearConstantColumns.forEach(col => {
    flags.push({ type: 'Low variance column', detail: `${col} top value >95% of rows`, severity: 'info', column: col });
  });

  // Outliers
  const numCols = headers.filter(h => columnTypes[h] === 'numeric');
  numCols.forEach(col => {
    const s = numericStats[col];
    if (s && s.zscoreOutlierCount > 0) {
      flags.push({ type: 'Outliers detected', detail: `${col}: ${s.zscoreOutlierCount} Z-score outliers`, severity: 'info', column: col });
    }
  });

  // Monotonic
  anomalies.suspiciousPatterns.filter(p => p.type === 'monotonic').forEach(p => {
    flags.push({ type: 'Monotonic column', detail: p.description, severity: 'info', column: p.column });
  });

  // Date gaps
  Object.entries(dateStatsMap).forEach(([col, ds]) => {
    if (ds.hasGapAnomaly) {
      flags.push({ type: 'Date gaps detected', detail: `${col}: largest gap ${ds.largestGapDays} days (median ${ds.medianGapDays})`, severity: 'warning', column: col });
    }
  });

  // Suspicious rounding
  anomalies.suspiciousPatterns.filter(p => p.type === 'suspicious_rounding').forEach(p => {
    flags.push({ type: 'Suspicious rounding', detail: p.description, severity: 'info', column: p.column });
  });

  // Benfords Law
  if (anomalies.benfordAnomalies) {
    anomalies.benfordAnomalies.forEach(a => {
      flags.push({ type: 'Benford Law Anomaly', detail: a.description, severity: 'warning', column: a.column });
    });
  }

  // Fuzzy Duplicates
  if (anomalies.fuzzyDuplicates) {
    anomalies.fuzzyDuplicates.forEach(a => {
      flags.push({ type: 'Category Consistency', detail: a.description, severity: 'warning', column: a.column });
    });
  }

  // Empty rows
  const emptyRowCount = rows.filter(r => headers.every(h => r[h] === null || r[h] === '')).length;

  return {
    flags,
    duplicateRowCount,
    duplicatePct,
    totalNullCount,
    nullPct,
    totalCells,
    emptyRowCount,
    mixedTypeColumns: mixedTypeCols,
    highNullColumns: highNullCols,
    allNullColumns: allNullCols,
  };
}

// ─── Step 13: Auto-generated Insight Cards ─────────────────────────────────────

function generateInsights(ds, stats) {
  const insights = [];
  const { rowCount, headers, qualityFlags, numericStats, primaryCol, timeSeries, categoryAggregations, correlationInsights, anomalies, qualityScore } = stats;

  // 1. Dataset overview
  insights.push({
    icon: 'dataset',
    text: `This dataset has ${rowCount.toLocaleString()} rows and ${headers.length} columns. Data quality score is ${qualityScore}/100.`,
    category: 'overview',
  });

  // 2. Primary column stats
  if (primaryCol && numericStats[primaryCol]) {
    const s = numericStats[primaryCol];
    insights.push({
      icon: 'monitoring',
      text: `${primaryCol} averages ${s.mean.toLocaleString()} with a range of ${s.min.toLocaleString()} to ${s.max.toLocaleString()}.`,
      category: 'numeric',
    });
  }

  // 3. Top correlation
  if (correlationInsights?.length > 0) {
    insights.push({
      icon: 'trending_up',
      text: correlationInsights[0].text,
      category: 'correlation',
    });
  }

  // 4. Time series peak
  if (timeSeries?.peak) {
    insights.push({
      icon: 'event',
      text: `${timeSeries.peak.date} was the peak period with ${timeSeries.peak.value.toLocaleString()} in ${timeSeries.primaryCol}.`,
      category: 'timeseries',
    });
  }

  // 5. Category insight
  const catKeys = Object.keys(categoryAggregations);
  if (catKeys.length > 0) {
    const firstCat = categoryAggregations[catKeys[0]];
    if (firstCat?.top5?.[0]) {
      insights.push({
        icon: 'category',
        text: `${firstCat.top5[0].label} accounts for ${firstCat.top5[0].pctOfTotal}% of total ${firstCat.primaryCol}.`,
        category: 'category',
      });
    }
  }

  // 6. Outlier insight
  const numCols = Object.keys(numericStats);
  const outlierCol = numCols.find(c => numericStats[c].zscoreOutlierCount > 0);
  if (outlierCol) {
    const s = numericStats[outlierCol];
    insights.push({
      icon: 'error_outline',
      text: `${outlierCol} has ${s.zscoreOutlierCount} outliers — values beyond ±3 standard deviations from the mean.`,
      category: 'outlier',
    });
  }

  // 7. Duplicate insight
  if (qualityFlags.duplicateRowCount > 0) {
    insights.push({
      icon: 'content_copy',
      text: `${qualityFlags.duplicateRowCount} duplicate rows detected — ${qualityFlags.duplicatePct}% of the dataset.`,
      category: 'quality',
    });
  }

  // 8. Missing data insight
  const highNullCol = Object.entries(stats.columnBasics).find(([, b]) => b.nullPct > 20);
  if (highNullCol) {
    insights.push({
      icon: 'help_outline',
      text: `${highNullCol[0]} is missing ${highNullCol[1].nullPct}% of values — consider imputation before analysis.`,
      category: 'quality',
    });
  }

  return insights.slice(0, 8);
}

// ─── Step 14: Data Quality Score ───────────────────────────────────────────────

function computeQualityScore(qualityFlags, rowCount, colCount) {
  const totalCells = rowCount * colCount;
  const nullPct = totalCells > 0 ? (qualityFlags.totalNullCount / totalCells) * 100 : 0;
  const dupePct = rowCount > 0 ? (qualityFlags.duplicateRowCount / rowCount) * 100 : 0;
  const mixedTypePct = colCount > 0 ? (qualityFlags.mixedTypeColumns.length / colCount) * 100 : 0;

  const score = Math.round(Math.max(0, Math.min(100,
    100 - (nullPct * 0.4) - (dupePct * 0.4) - (mixedTypePct * 0.2)
  )));
  return score;
}

// ─── Main Export ────────────────────────────────────────────────────────────────

export function computeAllStats(headers, rows) {
  const rowCount = rows.length;

  // Step 1
  const columnTypes = detectColumnTypes(headers, rows);

  // Step 2
  const columnBasics = computeColumnBasics(headers, rows, columnTypes);

  // Step 3
  const { numericStats, numericColumns } = computeNumericStats(rows, headers, columnTypes);

  // Step 4
  const { categoricalStats, categoricalColumns } = computeCategoricalStats(rows, headers, columnTypes);

  // Step 4.5: Text Stats
  const { textStats, textColumns } = computeTextStats(rows, headers, columnTypes);

  // Step 5
  const { dateStats, dateColumns } = computeDateStats(rows, headers, columnTypes);

  // Step 6 + 7: Correlation
  const { matrix: correlationMatrix, insights: correlationInsights, pairs: correlationPairs } = computeCorrelationMatrix(rows, numericColumns);

  // Find primary numeric column
  const primaryCol = findPrimaryNumericCol(numericColumns, numericStats);

  // Step 8: Category aggregations
  const categoryAggregations = computeCategoryAggregations(rows, categoricalColumns, primaryCol, numericStats);

  // Step 9: Histograms
  const histogramBuckets = computeHistograms(rows, numericColumns, numericStats);

  // Step 10: Time series
  const timeSeries = computeTimeSeries(rows, dateColumns, numericColumns, numericStats);

  // Step 11: Anomalies
  const anomalies = computeAnomalies(rows, headers, columnTypes, numericStats, categoricalColumns);

  // Step 12: Quality flags
  const qualityFlags = computeQualityFlags(rows, headers, columnTypes, numericStats, columnBasics, anomalies, dateStats);

  // Step 14: Quality score
  const qualityScore = computeQualityScore(qualityFlags, rowCount, headers.length);

  // Build summarized stats object
  const statsObj = {
    rowCount,
    headers,
    columnTypes,
    columnBasics,
    numericStats,
    numericColumns,
    categoricalStats,
    categoricalColumns,
    textStats,
    textColumns,
    dateStats,
    dateColumns,
    correlationMatrix,
    correlationInsights,
    correlationPairs,
    primaryCol,
    categoryAggregations,
    histogramBuckets,
    timeSeries,
    anomalies,
    qualityFlags,
    qualityScore,
  };

  // Step 13: Insights (needs the assembled stats object)
  statsObj.insights = generateInsights(null, statsObj);

  return statsObj;
}
