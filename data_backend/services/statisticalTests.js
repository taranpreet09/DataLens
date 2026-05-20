/**
 * Statistical Tests Module
 * Provides t-tests, chi-square, ANOVA, normality testing, and confidence intervals.
 * Uses jstat for distribution functions.
 */

import jStat from 'jstat';

function round(n, d = 4) { const f = 10 ** d; return Math.round(n * f) / f; }
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function variance(arr) { const m = mean(arr); return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1); }
function stdDev(arr) { return Math.sqrt(variance(arr)); }

// ─── T-Test (Two-sample, independent) ────────────────────────────────────────

/**
 * Two-sample independent t-test.
 * Tests whether two groups have significantly different means.
 *
 * @param {number[]} group1 - First sample
 * @param {number[]} group2 - Second sample
 * @returns {{ tStatistic, pValue, degreesOfFreedom, significant, meanDiff, confidenceInterval, cohensD, effectSizeLabel }}
 */
export function tTest(group1, group2) {
  const n1 = group1.length, n2 = group2.length;
  if (n1 < 2 || n2 < 2) return null;

  const m1 = mean(group1), m2 = mean(group2);
  const v1 = variance(group1), v2 = variance(group2);

  // Welch's t-test (doesn't assume equal variances)
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  if (se === 0) return null;

  const t = (m1 - m2) / se;

  // Welch-Satterthwaite degrees of freedom
  const num = (v1 / n1 + v2 / n2) ** 2;
  const denom = (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
  const df = num / denom;

  // Two-tailed p-value
  const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));

  // 95% confidence interval for the difference
  const tCrit = jStat.studentt.inv(0.975, df);
  const marginOfError = tCrit * se;

  // Cohen's d (pooled standard deviation)
  const pooledStd = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  const cohensD = pooledStd > 0 ? (m1 - m2) / pooledStd : 0;
  const absd = Math.abs(cohensD);
  const effectSizeLabel = absd >= 0.8 ? 'large' : absd >= 0.5 ? 'medium' : absd >= 0.2 ? 'small' : 'negligible';

  return {
    tStatistic: round(t),
    pValue: round(pValue, 6),
    degreesOfFreedom: round(df, 2),
    significant: pValue < 0.05,
    meanDiff: round(m1 - m2),
    confidenceInterval: {
      lower: round(m1 - m2 - marginOfError),
      upper: round(m1 - m2 + marginOfError),
      level: 0.95,
    },
    cohensD: round(cohensD),
    effectSizeLabel,
  };
}

// ─── One-sample T-Test ────────────────────────────────────────────────────────

/**
 * One-sample t-test against a hypothesized mean.
 */
export function oneSampleTTest(sample, hypothesizedMean = 0) {
  const n = sample.length;
  if (n < 2) return null;

  const m = mean(sample);
  const se = stdDev(sample) / Math.sqrt(n);
  if (se === 0) return null;

  const t = (m - hypothesizedMean) / se;
  const df = n - 1;
  const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));

  const tCrit = jStat.studentt.inv(0.975, df);
  const marginOfError = tCrit * se;

  return {
    tStatistic: round(t),
    pValue: round(pValue, 6),
    degreesOfFreedom: df,
    significant: pValue < 0.05,
    sampleMean: round(m),
    confidenceInterval: {
      lower: round(m - marginOfError),
      upper: round(m + marginOfError),
      level: 0.95,
    },
  };
}

// ─── Chi-Square Test of Independence ──────────────────────────────────────────

/**
 * Chi-square test of independence between two categorical columns.
 *
 * @param {Array} col1Values - Values from first categorical column
 * @param {Array} col2Values - Values from second categorical column
 * @returns {{ chiSquare, pValue, degreesOfFreedom, significant, cramersV }}
 */
export function chiSquareTest(col1Values, col2Values) {
  if (col1Values.length !== col2Values.length || col1Values.length < 10) return null;

  // Build contingency table
  const categories1 = [...new Set(col1Values.filter(v => v != null))];
  const categories2 = [...new Set(col2Values.filter(v => v != null))];

  if (categories1.length < 2 || categories2.length < 2) return null;
  if (categories1.length > 50 || categories2.length > 50) return null; // Too many categories

  const observed = {};
  const rowTotals = {};
  const colTotals = {};
  let total = 0;

  for (const c1 of categories1) { rowTotals[c1] = 0; observed[c1] = {}; }
  for (const c2 of categories2) { colTotals[c2] = 0; }

  for (let i = 0; i < col1Values.length; i++) {
    const v1 = col1Values[i], v2 = col2Values[i];
    if (v1 == null || v2 == null) continue;
    if (!observed[v1]) continue;
    observed[v1][v2] = (observed[v1][v2] || 0) + 1;
    rowTotals[v1]++;
    colTotals[v2] = (colTotals[v2] || 0) + 1;
    total++;
  }

  if (total < 10) return null;

  // Compute chi-square statistic
  let chiSq = 0;
  for (const c1 of categories1) {
    for (const c2 of categories2) {
      const obs = observed[c1][c2] || 0;
      const expected = (rowTotals[c1] * (colTotals[c2] || 0)) / total;
      if (expected > 0) {
        chiSq += (obs - expected) ** 2 / expected;
      }
    }
  }

  const df = (categories1.length - 1) * (categories2.length - 1);
  const pValue = 1 - jStat.chisquare.cdf(chiSq, df);

  // Cramér's V (effect size)
  const k = Math.min(categories1.length, categories2.length);
  const cramersV = Math.sqrt(chiSq / (total * (k - 1)));

  return {
    chiSquare: round(chiSq),
    pValue: round(pValue, 6),
    degreesOfFreedom: df,
    significant: pValue < 0.05,
    cramersV: round(cramersV),
    effectSize: cramersV > 0.5 ? 'large' : cramersV > 0.3 ? 'medium' : cramersV > 0.1 ? 'small' : 'negligible',
  };
}

// ─── One-Way ANOVA ────────────────────────────────────────────────────────────

/**
 * One-way ANOVA: tests if means differ across groups.
 *
 * @param {Array<number[]>} groups - Array of numeric arrays (one per group)
 * @returns {{ fStatistic, pValue, degreesOfFreedom, significant, groupMeans }}
 */
export function anova(groups) {
  const validGroups = groups.filter(g => g.length >= 2);
  if (validGroups.length < 2) return null;

  const k = validGroups.length;
  const N = validGroups.reduce((s, g) => s + g.length, 0);
  const grandMean = mean(validGroups.flat());

  // Between-group sum of squares
  let ssBetween = 0;
  for (const g of validGroups) {
    ssBetween += g.length * (mean(g) - grandMean) ** 2;
  }

  // Within-group sum of squares
  let ssWithin = 0;
  for (const g of validGroups) {
    const gMean = mean(g);
    ssWithin += g.reduce((s, v) => s + (v - gMean) ** 2, 0);
  }

  const dfBetween = k - 1;
  const dfWithin = N - k;

  if (dfWithin <= 0 || ssWithin === 0) return null;

  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const F = msBetween / msWithin;

  const pValue = 1 - jStat.centralF.cdf(F, dfBetween, dfWithin);

  return {
    fStatistic: round(F),
    pValue: round(pValue, 6),
    degreesOfFreedom: { between: dfBetween, within: dfWithin },
    significant: pValue < 0.05,
    groupMeans: validGroups.map(g => round(mean(g))),
    groupSizes: validGroups.map(g => g.length),
  };
}

// ─── Normality Test (Shapiro-Wilk Approximation) ──────────────────────────────

/**
 * Approximate normality test using D'Agostino-Pearson omnibus test.
 * (True Shapiro-Wilk requires lookup tables; this is a practical approximation)
 *
 * @param {number[]} data - Numeric sample
 * @returns {{ statistic, pValue, isNormal, skewness, kurtosis }}
 */
export function normalityTest(data) {
  const n = data.length;
  if (n < 8) return null;

  const m = mean(data);
  const s = stdDev(data);
  if (s === 0) return { statistic: 0, pValue: 1, isNormal: false, skewness: 0, kurtosis: 0 };

  // Compute skewness
  const m3 = data.reduce((sum, x) => sum + ((x - m) / s) ** 3, 0) / n;
  // Compute excess kurtosis
  const m4 = data.reduce((sum, x) => sum + ((x - m) / s) ** 4, 0) / n - 3;

  // D'Agostino skewness test
  const Y = m3 * Math.sqrt((n + 1) * (n + 3) / (6 * (n - 2)));
  const beta2 = 3 * (n * n + 27 * n - 70) * (n + 1) * (n + 3) / ((n - 2) * (n + 5) * (n + 7) * (n + 9));
  const W2 = -1 + Math.sqrt(2 * (beta2 - 1));
  const delta = 1 / Math.sqrt(Math.log(Math.sqrt(W2)));
  const alpha = Math.sqrt(2 / (W2 - 1));
  const Zs = delta * Math.log(Y / alpha + Math.sqrt((Y / alpha) ** 2 + 1));

  // Kurtosis test
  const Ek = 3 * (n - 1) / (n + 1);
  const varK = 24 * n * (n - 2) * (n - 3) / ((n + 1) ** 2 * (n + 3) * (n + 5));
  const Zk = ((m4 + 3) - Ek) / Math.sqrt(varK);

  // Omnibus statistic
  const K2 = Zs ** 2 + Zk ** 2;
  const pValue = 1 - jStat.chisquare.cdf(K2, 2);

  return {
    statistic: round(K2),
    pValue: round(pValue, 6),
    isNormal: pValue > 0.05,
    skewness: round(m3),
    kurtosis: round(m4),
  };
}

// ─── Confidence Interval ──────────────────────────────────────────────────────

/**
 * Compute confidence interval for a mean.
 *
 * @param {number[]} data
 * @param {number} confidenceLevel - e.g., 0.95
 * @returns {{ mean, lower, upper, marginOfError, level }}
 */
export function confidenceInterval(data, confidenceLevel = 0.95) {
  const n = data.length;
  if (n < 2) return null;

  const m = mean(data);
  const se = stdDev(data) / Math.sqrt(n);
  const df = n - 1;
  const alpha = 1 - confidenceLevel;
  const tCrit = jStat.studentt.inv(1 - alpha / 2, df);
  const marginOfError = tCrit * se;

  return {
    mean: round(m),
    lower: round(m - marginOfError),
    upper: round(m + marginOfError),
    marginOfError: round(marginOfError),
    level: confidenceLevel,
  };
}

// ─── Correlation Significance ─────────────────────────────────────────────────

/**
 * Test if a Pearson correlation coefficient is statistically significant.
 *
 * @param {number} r - Correlation coefficient
 * @param {number} n - Sample size
 * @returns {{ r, tStatistic, pValue, significant }}
 */
export function correlationSignificance(r, n) {
  if (n < 4 || Math.abs(r) >= 1) return null;

  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const df = n - 2;
  const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));

  return {
    r: round(r),
    tStatistic: round(t),
    pValue: round(pValue, 6),
    significant: pValue < 0.05,
    degreesOfFreedom: df,
  };
}

// ─── Mann-Whitney U Test (Non-parametric) ─────────────────────────────────────

/**
 * Mann-Whitney U test — non-parametric alternative to the t-test.
 * Tests whether the distributions of two groups differ.
 * Use when normality assumption fails.
 *
 * @param {number[]} group1 - First sample
 * @param {number[]} group2 - Second sample
 * @returns {{ uStatistic, zScore, pValue, significant, effectSize, medianDiff }}
 */
export function mannWhitneyU(group1, group2) {
  const n1 = group1.length, n2 = group2.length;
  if (n1 < 3 || n2 < 3) return null;

  // Combine and rank
  const combined = [
    ...group1.map(v => ({ v, group: 1 })),
    ...group2.map(v => ({ v, group: 2 })),
  ];
  combined.sort((a, b) => a.v - b.v);

  // Assign ranks (average for ties)
  const N = combined.length;
  const ranks = new Array(N);
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N && combined[j].v === combined[i].v) j++;
    const avgRank = (i + j + 1) / 2; // 1-based
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }

  // Sum ranks for group 1
  let R1 = 0;
  for (let k = 0; k < N; k++) {
    if (combined[k].group === 1) R1 += ranks[k];
  }

  // U statistics
  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  // Normal approximation (for n > 20)
  const muU = (n1 * n2) / 2;
  const sigmaU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);

  // Tie correction
  const tieGroups = [];
  i = 0;
  while (i < N) {
    let j = i;
    while (j < N && combined[j].v === combined[i].v) j++;
    if (j - i > 1) tieGroups.push(j - i);
    i = j;
  }
  let tieCorrection = 0;
  for (const t of tieGroups) tieCorrection += (t ** 3 - t);
  const correctedSigma = Math.sqrt(
    (n1 * n2 / 12) * ((n1 + n2 + 1) - tieCorrection / ((n1 + n2) * (n1 + n2 - 1)))
  );
  const sigma = correctedSigma > 0 ? correctedSigma : sigmaU;

  const z = sigma > 0 ? (U1 - muU) / sigma : 0;
  // Two-tailed p-value using normal approximation
  const pValue = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));

  // Effect size: r = Z / sqrt(N)
  const effectSize = Math.abs(z) / Math.sqrt(N);
  const effectLabel = effectSize >= 0.5 ? 'large' : effectSize >= 0.3 ? 'medium' : effectSize >= 0.1 ? 'small' : 'negligible';

  // Median of each group
  const sorted1 = [...group1].sort((a, b) => a - b);
  const sorted2 = [...group2].sort((a, b) => a - b);
  const med1 = sorted1.length % 2 ? sorted1[Math.floor(sorted1.length / 2)] : (sorted1[sorted1.length / 2 - 1] + sorted1[sorted1.length / 2]) / 2;
  const med2 = sorted2.length % 2 ? sorted2[Math.floor(sorted2.length / 2)] : (sorted2[sorted2.length / 2 - 1] + sorted2[sorted2.length / 2]) / 2;

  return {
    uStatistic: round(U),
    zScore: round(z),
    pValue: round(pValue, 6),
    significant: pValue < 0.05,
    effectSize: round(effectSize),
    effectSizeLabel: effectLabel,
    medianDiff: round(med1 - med2),
    medians: { group1: round(med1), group2: round(med2) },
  };
}

// ─── Paired T-Test ────────────────────────────────────────────────────────────

/**
 * Paired t-test for before/after measurements.
 * Tests whether the mean difference between paired observations is zero.
 *
 * @param {number[]} before - First measurement set
 * @param {number[]} after - Second measurement set (same subjects)
 * @returns {{ tStatistic, pValue, degreesOfFreedom, significant, meanDiff, confidenceInterval, cohensD }}
 */
export function pairedTTest(before, after) {
  if (before.length !== after.length || before.length < 2) return null;

  const n = before.length;
  const diffs = before.map((b, i) => b - after[i]);

  const dMean = mean(diffs);
  const dStd = stdDev(diffs);
  const se = dStd / Math.sqrt(n);

  if (se === 0) return null;

  const t = dMean / se;
  const df = n - 1;
  const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));

  const tCrit = jStat.studentt.inv(0.975, df);
  const marginOfError = tCrit * se;

  // Cohen's d for paired samples
  const cohensD = dStd > 0 ? dMean / dStd : 0;
  const absd = Math.abs(cohensD);
  const effectSizeLabel = absd >= 0.8 ? 'large' : absd >= 0.5 ? 'medium' : absd >= 0.2 ? 'small' : 'negligible';

  return {
    tStatistic: round(t),
    pValue: round(pValue, 6),
    degreesOfFreedom: df,
    significant: pValue < 0.05,
    meanDiff: round(dMean),
    confidenceInterval: {
      lower: round(dMean - marginOfError),
      upper: round(dMean + marginOfError),
      level: 0.95,
    },
    cohensD: round(cohensD),
    effectSizeLabel,
    n,
  };
}
