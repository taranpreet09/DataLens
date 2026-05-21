// ─── Data Lens Eval 1 — Stats Engine ────────────────────────────────────────────
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
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function variance(arr) { const sd = stdDev(arr); return sd * sd; }

function numericVals(rows, col) {
  return rows.map(r => r[col]).filter(v => v !== null && v !== '' && !isNaN(Number(v))).map(Number);
}

// ─── Step 1: Column Type Detection ─────────────────────────────────────────────

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

    // Date check — accepts:
    //   • ISO/parseable strings (2024-01-15, 2024-01-15T10:30:00, Jan 15 2024)
    //   • Excel serial numbers when column name suggests a date
    // Plus: at least one parsed date must land in a plausible year window
    // (1900-2100), which rejects numeric codes that happen to parse via
    // new Date('01') etc.
    const nameHintsDate = NAME_HINTS_DATE.test(h);
    let hasReasonableYear = false;
    const dateCount = nonNull.filter(v => {
      let d = null;
      if (typeof v === 'number') {
        // Numeric value: treat as date only if column name hints AND value looks like a serial
        if (!nameHintsDate || !looksLikeExcelSerial(v)) return false;
        d = new Date(Math.round((v - 25569) * 86400 * 1000));
      } else {
        const s = String(v).trim();
        if (s === '') return false;
        // Reject plain integer-like strings unless name hints + Excel serial
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

    // Date wins when ratio > 0.7 AND at least one parsed date has a plausible year.
    if (dateRatio > 0.7 && hasReasonableYear) { types[h] = 'date'; continue; }

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

    const n = vals.length;
    const sum3 = sd > 0 ? vals.reduce((acc, x) => ((x - m) / sd) ** 3 + acc, 0) : 0;
    // Skewness: undefined for n < 3 or zero std-dev (no spread → no shape).
    const skewness = (n >= 3 && sd > 0)
      ? round((n / ((n - 1) * (n - 2))) * sum3, 4)
      : null;

    // Z-score outliers: |value - mean| / stdDev > 3
    const zscoreOutliers = sd > 0 ? vals.filter(x => Math.abs(x - m) / sd > 3) : [];

    // IQR outliers: outside Q1 - 1.5*IQR ... Q3 + 1.5*IQR
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    const iqrOutliers = vals.filter(x => x < lowerFence || x > upperFence);

    // Coefficient of variation
    const cv = m !== 0 ? round(Math.abs(sd / m) * 100, 2) : null;

    // Excess kurtosis (Fisher's definition, normal = 0).
    // Undefined for n < 4 or zero std-dev.
    let kurtosis = null;
    if (n >= 4 && sd > 0) {
      const sum4 = vals.reduce((sum, x) => sum + ((x - m) / sd) ** 4, 0);
      const raw = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sum4;
      const correction = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
      kurtosis = round(raw - correction, 4);
    }

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
      kurtosis,
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
  if (numCols.length < 2) return { matrix: {}, insights: [], pairs: [] };

  const maxRows = 5000;
  let sampledRows = rows;
  if (rows.length > maxRows) {
    const indices = Array.from({ length: rows.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    sampledRows = indices.slice(0, maxRows).map(i => rows[i]);
  }

  const matrix = {};
  const pairs = [];

  for (const a of numCols) {
    matrix[a] = {};
    for (const b of numCols) {
      if (a === b) { matrix[a][b] = 1; continue; }
      const pairsA = [], pairsB = [];
      sampledRows.forEach(r => {
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

  pairs.sort((a, b) => b.absR - a.absR);
  const insights = buildCorrelationInsights(pairs);

  return { matrix, insights, pairs };
}

/**
 * Build human-readable correlation insights from a list of pairs.
 * Exposed separately so we can rebuild insights when reusing a backend matrix.
 */
function buildCorrelationInsights(rawPairs) {
  if (!Array.isArray(rawPairs) || rawPairs.length === 0) return [];
  // Ensure each pair has the bits we need (strength + absR).
  const pairs = rawPairs
    .filter(p => p && typeof p.r === 'number')
    .map(p => ({
      ...p,
      absR: p.absR ?? Math.abs(p.r),
      strength: p.strength ?? getCorrelationStrength(p.r),
    }))
    .sort((a, b) => b.absR - a.absR);

  const insights = [];
  const top3 = pairs.slice(0, 3);
  for (const p of top3) {
    const assoc = p.r > 0 ? 'tend to increase together' : 'tend to move in opposite directions';
    insights.push({
      type: p.r > 0 ? 'positive' : 'negative',
      text: `${p.colA} and ${p.colB} are ${p.strength.toLowerCase()} (r = ${p.r.toFixed(2)}) — ${assoc}.`,
      r: p.r,
    });
  }
  const negatives = pairs.filter(p => p.r < -0.2).sort((a, b) => a.r - b.r);
  if (negatives.length > 0 && !top3.includes(negatives[0])) {
    const p = negatives[0];
    insights.push({
      type: 'negative',
      text: `${p.colA} and ${p.colB} are ${p.strength.toLowerCase()} (r = ${p.r.toFixed(2)}) — increases in one associate with decreases in the other.`,
      r: p.r,
    });
  }
  return insights;
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

    // Monotonic check — skip ID columns (they're supposed to be sorted)
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

    // Benford's Law Check
    if (vals.length > 50 && s.stdDev > 0) {
      const firstDigits = vals.map(v => parseInt(String(Math.abs(v)).replace(/[^1-9]/g, '')[0])).filter(n => !isNaN(n) && n > 0);
      if (firstDigits.length > 50) {
        const counts = Array(10).fill(0);
        firstDigits.forEach(d => counts[d]++);
        const actualPct = counts.map(c => c / firstDigits.length);
        const benfordExpected = [0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];
        let mad = 0;
        for (let i = 0; i < 9; i++) {
          mad += Math.abs(actualPct[i + 1] - benfordExpected[i]);
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
    if (ratio > 0.15) mixedTypeCols.push(h);
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
  const dateGapCols = [];
  Object.entries(dateStatsMap).forEach(([col, ds]) => {
    if (ds.hasGapAnomaly) {
      flags.push({ type: 'Date gaps detected', detail: `${col}: largest gap ${ds.largestGapDays} days (median ${ds.medianGapDays})`, severity: 'warning', column: col });
      dateGapCols.push(col);
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
    dateGapColumns: dateGapCols,
  };
}

// ─── Step 13: Auto-generated Insight Cards ─────────────────────────────────────

function generateInsights(ds, stats) {
  const allPotential = [];
  const { rowCount, headers, qualityFlags, numericStats, primaryCol, timeSeries, categoryAggregations, correlationInsights, anomalies, qualityScore } = stats;

  // 1. Dataset overview (Score: 100 - Base info)
  allPotential.push({
    score: 100,
    item: {
      icon: 'dataset',
      text: `This dataset has ${rowCount.toLocaleString()} rows and ${headers.length} columns. Quality Score: ${qualityScore}/100.`,
      category: 'overview',
    }
  });

  // 2. Primary column stats (Score: 80)
  if (primaryCol && numericStats[primaryCol]) {
    const s = numericStats[primaryCol];
    allPotential.push({
      score: 80,
      item: {
        icon: 'monitoring',
        text: `${primaryCol} averages ${s.mean.toLocaleString()} with a range of ${s.min.toLocaleString()} to ${s.max.toLocaleString()}.`,
        category: 'numeric',
      }
    });
  }

  // 3. Top correlation (Score: 95 if r > 0.8, else 70)
  if (correlationInsights?.length > 0) {
    const topCorr = correlationInsights[0];
    allPotential.push({
      score: Math.abs(topCorr.r) > 0.8 ? 95 : 70,
      item: {
        icon: 'hub',
        text: topCorr.text,
        category: 'correlation',
      }
    });
  }

  // 4. Time series (Score: 90 if strong trend, else 60)
  if (timeSeries?.peak) {
    const isStrong = timeSeries.trendDirection !== 'Flat';
    allPotential.push({
      score: isStrong ? 90 : 60,
      item: {
        icon: 'trending_up',
        text: `${timeSeries.trendDirection}: Peak of ${timeSeries.peak.value.toLocaleString()} reached on ${timeSeries.peak.date}.`,
        category: 'timeseries',
      }
    });
  }

  // 5. Category insight (Score: 75)
  const catKeys = Object.keys(categoryAggregations);
  if (catKeys.length > 0) {
    const firstCat = categoryAggregations[catKeys[0]];
    if (firstCat?.top5?.[0]) {
      allPotential.push({
        score: 75,
        item: {
          icon: 'category',
          text: `${firstCat.top5[0].label} dominates ${catKeys[0]}, accounting for ${firstCat.top5[0].pctOfTotal}% of ${firstCat.primaryCol}.`,
          category: 'category',
        }
      });
    }
  }

  // 6. Outlier insight (Score: 85 if > 0)
  const numCols = Object.keys(numericStats);
  const outlierCol = numCols.find(c => numericStats[c].zscoreOutlierCount > 0);
  if (outlierCol) {
    const s = numericStats[outlierCol];
    allPotential.push({
      score: 85,
      item: {
        icon: 'error_outline',
        text: `Detected ${s.zscoreOutlierCount} outliers in ${outlierCol}, indicating significant deviation from normal patterns.`,
        category: 'outlier',
      }
    });
  }

  // 7. Duplicate insight (Score: 92 if high)
  if (qualityFlags.duplicateRowCount > 0) {
    allPotential.push({
      score: qualityFlags.duplicatePct > 5 ? 92 : 40,
      item: {
        icon: 'content_copy',
        text: `Duplicate check: ${qualityFlags.duplicateRowCount} rows were found to be identical to others (${qualityFlags.duplicatePct}%).`,
        category: 'quality',
      }
    });
  }

  // 8. Missing data insight (Score: 93 if high)
  const highNullCol = Object.entries(stats.columnBasics).find(([, b]) => b.nullPct > 10);
  if (highNullCol) {
    allPotential.push({
      score: highNullCol[1].nullPct > 25 ? 93 : 50,
      item: {
        icon: 'block',
        text: `${highNullCol[0]} has significant missing data (${highNullCol[1].nullPct}%) which may bias final results.`,
        category: 'quality',
      }
    });
  }

  // Sort and return top 6
  return allPotential
    .sort((a, b) => b.score - a.score)
    .map(p => p.item)
    .slice(0, 6);
}

// ─── Step 14: Data Quality Score ───────────────────────────────────────────────

/**
 * Computes a transparent, explainable quality score from cumulative penalties.
 *
 * Inputs:
 *   qualityFlags      — output of computeQualityFlags (totalNullCount, duplicateRowCount, mixedTypeColumns, …)
 *   rowCount, colCount
 *   numericStats      — output of computeNumericStats (used for outlier penalty)
 *   anomalies         — output of computeAnomalies (constant/near-constant/monotonic/benford/etc.)
 *
 * Returns:
 *   { qualityScore, scoreFlags, scoreBreakdown }
 *     scoreBreakdown lists the points subtracted by each penalty bucket
 *     scoreFlags is a small array of soft hints (e.g. 'limited_data')
 */
function computeQualityScore(qualityFlags, rowCount, colCount, numericStats, anomalies) {
  if (!rowCount || !colCount) {
    return { qualityScore: 0, scoreFlags: ['empty_dataset'], scoreBreakdown: {} };
  }

  const totalCells = rowCount * colCount;
  const flags = [];
  const breakdown = {};

  // ── Nulls: nullPct (0..100) → min(40, nullPct * 1.2) ────────────────────────
  const totalNulls = qualityFlags.totalNullCount ?? 0;
  const nullPct = totalCells > 0 ? (totalNulls / totalCells) * 100 : 0;
  const nullPenalty = Math.min(40, nullPct * 1.2);
  breakdown.nulls = round(nullPenalty, 2);

  // ── Duplicates: dupePct → min(25, dupePct * 1.5) ────────────────────────────
  const dupeCount = qualityFlags.duplicateRowCount ?? 0;
  const dupePct = rowCount > 0 ? (dupeCount / rowCount) * 100 : 0;
  const dupePenalty = Math.min(25, dupePct * 1.5);
  breakdown.duplicates = round(dupePenalty, 2);

  // ── Mixed types: ratio = mixedCols / colCount → min(15, ratio * 60) ─────────
  const mixedCount = (qualityFlags.mixedTypeColumns || []).length;
  const mixedRatio = colCount > 0 ? mixedCount / colCount : 0;
  const mixedPenalty = Math.min(15, mixedRatio * 60);
  breakdown.mixedTypes = round(mixedPenalty, 2);

  // ── High-null columns (>20% null, not 100%): 3 each, cap 12 ─────────────────
  const highNullCount = (qualityFlags.highNullColumns || []).length;
  const highNullPenalty = Math.min(12, highNullCount * 3);
  breakdown.highNullCols = round(highNullPenalty, 2);

  // ── All-null columns: 8 each, cap 16 ────────────────────────────────────────
  const allNullCount = (qualityFlags.allNullColumns || []).length;
  const allNullPenalty = Math.min(16, allNullCount * 8);
  breakdown.allNullCols = round(allNullPenalty, 2);

  // ── Constant columns: 4 each, cap 12 ────────────────────────────────────────
  const constCount = (anomalies?.constantColumns || []).length;
  const constPenalty = Math.min(12, constCount * 4);
  breakdown.constantCols = round(constPenalty, 2);

  // ── Near-constant columns (>95% top value): 2 each, cap 8 ───────────────────
  const nearConstCount = (anomalies?.nearConstantColumns || []).length;
  const nearConstPenalty = Math.min(8, nearConstCount * 2);
  breakdown.nearConstantCols = round(nearConstPenalty, 2);

  // ── Monotonic columns (sorted, not ID): 2 each, cap 6 ───────────────────────
  const monotonicCount = (anomalies?.suspiciousPatterns || [])
    .filter(p => p.type === 'monotonic').length;
  const monotonicPenalty = Math.min(6, monotonicCount * 2);
  breakdown.monotonicCols = round(monotonicPenalty, 2);

  // ── Fuzzy duplicate categories: 3 per group, cap 12 ─────────────────────────
  const fuzzyCount = (anomalies?.fuzzyDuplicates || []).length;
  const fuzzyPenalty = Math.min(12, fuzzyCount * 3);
  breakdown.fuzzyDuplicates = round(fuzzyPenalty, 2);

  // ── Benford anomalies: 4 each, cap 12 ───────────────────────────────────────
  const benfordCount = (anomalies?.benfordAnomalies || []).length;
  const benfordPenalty = Math.min(12, benfordCount * 4);
  breakdown.benfordAnomalies = round(benfordPenalty, 2);

  // ── Suspicious rounding: 2 each, cap 6 ──────────────────────────────────────
  const roundingCount = (anomalies?.suspiciousPatterns || [])
    .filter(p => p.type === 'suspicious_rounding').length;
  const roundingPenalty = Math.min(6, roundingCount * 2);
  breakdown.suspiciousRounding = round(roundingPenalty, 2);

  // ── Date gap anomalies: 3 each, cap 9 ───────────────────────────────────────
  const dateGapCount = (qualityFlags.dateGapColumns || []).length;
  const dateGapPenalty = Math.min(9, dateGapCount * 3);
  breakdown.dateGapAnomalies = round(dateGapPenalty, 2);

  // ── Outlier-heavy cols (z-score outliers > 5% of values): 2 each, cap 8 ─────
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

  // ── Aggregate (cumulative penalty, capped at 100) ───────────────────────────
  const totalPenalty = Math.min(100,
    nullPenalty + dupePenalty + mixedPenalty +
    highNullPenalty + allNullPenalty +
    constPenalty + nearConstPenalty + monotonicPenalty +
    fuzzyPenalty + benfordPenalty + roundingPenalty +
    dateGapPenalty + outlierPenalty
  );
  let score = 100 - totalPenalty;

  // ── Soft cap: small datasets cannot be confidently scored ───────────────────
  if (rowCount < 50 || colCount < 2) {
    if (score > 70) score = 70;
    flags.push('limited_data');
  }

  score = Math.round(Math.max(0, Math.min(100, score)));
  return { qualityScore: score, scoreFlags: flags, scoreBreakdown: breakdown };
}

// ─── Main Export ────────────────────────────────────────────────────────────────

/**
 * Compute the full stats bundle for a dataset.
 *
 * Optionally accepts `existingStats` (e.g. backend-provided stats from
 * /api/datasets/:id). When that bundle already contains a correlationMatrix,
 * we reuse it instead of recomputing locally — this keeps every page that
 * displays a correlation in agreement with the backend's full-data result
 * (the frontend samples 5,000 rows, the backend uses everything).
 */
export function computeAllStats(headers, rows, existingStats = null) {
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

  // Step 6 + 7: Correlation — reuse from backend when available & complete.
  let correlationMatrix, correlationInsights, correlationPairs;
  const hasUsableExistingMatrix = existingStats
    && existingStats.correlationMatrix
    && typeof existingStats.correlationMatrix === 'object'
    && Object.keys(existingStats.correlationMatrix).length >= 2;
  if (hasUsableExistingMatrix) {
    correlationMatrix = existingStats.correlationMatrix;
    correlationPairs = existingStats.correlationPairs || [];
    correlationInsights = existingStats.correlationInsights
      || buildCorrelationInsights(correlationPairs);
  } else {
    ({ matrix: correlationMatrix, insights: correlationInsights, pairs: correlationPairs }
      = computeCorrelationMatrix(rows, numericColumns));
  }

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

  // Step 14: Quality score (transparent penalty model)
  const { qualityScore, scoreFlags, scoreBreakdown } =
    computeQualityScore(qualityFlags, rowCount, headers.length, numericStats, anomalies);

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
    scoreFlags,
    scoreBreakdown,
  };

  // Step 13: Insights (needs the assembled stats object)
  statsObj.insights = generateInsights(null, statsObj);

  return statsObj;
}
