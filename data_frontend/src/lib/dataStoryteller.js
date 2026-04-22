// ─── DataLens — Plain-English Data Storytelling Engine ─────────────────────────
// Translates raw statistical findings into human-readable narratives.
// Zero React dependencies. Pure functions.

/**
 * Generate an array of plain-English narrative sentences from the dataset stats.
 * Each story has: { icon, title, text, category, severity }
 */
export function generateDataStories(stats) {
  if (!stats) return [];
  const stories = [];

  // ── 1. Overall health narrative ──────────────────────────────────────────
  const score = stats.qualityScore;
  const grade = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';
  const gradeColor = score >= 90 ? 'secondary' : score >= 75 ? 'primary' : score >= 50 ? 'amber-400' : 'error';
  stories.push({
    icon: 'health_and_safety',
    title: 'Data Health',
    text: `Your dataset scores **${score}/100** (${grade}). It has ${stats.rowCount.toLocaleString()} rows across ${stats.headers.length} columns, with ${stats.numericColumns.length} numeric, ${stats.categoricalColumns?.length ?? 0} categorical, and ${stats.dateColumns?.length ?? 0} date fields.`,
    category: 'health',
    severity: gradeColor,
  });

  // ── 2. Missing data story ───────────────────────────────────────────────
  const nullPct = stats.qualityFlags.nullPct;
  const totalNulls = stats.qualityFlags.totalNullCount;
  if (totalNulls > 0) {
    const severity = nullPct > 10 ? 'error' : nullPct > 3 ? 'amber-400' : 'primary';
    const impact = nullPct > 10
      ? 'This is significant and may bias your analysis. Consider imputation or removing heavily affected rows.'
      : nullPct > 3
        ? 'This is moderate — review affected columns before drawing conclusions.'
        : 'This is minor and unlikely to affect overall analysis quality.';
    stories.push({
      icon: 'block',
      title: 'Missing Data',
      text: `**${totalNulls.toLocaleString()} cells** are missing across your dataset (${nullPct}% of all data). ${impact}`,
      category: 'quality',
      severity,
    });

    // Call out the worst column
    const highNullCol = Object.entries(stats.columnBasics)
      .filter(([, b]) => b.nullPct > 5)
      .sort((a, b) => b[1].nullPct - a[1].nullPct)[0];
    if (highNullCol) {
      stories.push({
        icon: 'warning',
        title: `Column: ${highNullCol[0]}`,
        text: `The column **"${highNullCol[0]}"** has the most missing data at **${highNullCol[1].nullPct}%**. With ${highNullCol[1].nullCount} empty cells out of ${stats.rowCount}, you may want to either fill these values or exclude this column from analysis.`,
        category: 'quality',
        severity: 'amber-400',
      });
    }
  } else {
    stories.push({
      icon: 'check_circle',
      title: 'No Missing Data',
      text: 'Great news — your dataset has **zero missing values**. Every cell contains data, which means you can proceed with analysis without imputation.',
      category: 'quality',
      severity: 'secondary',
    });
  }

  // ── 3. Duplicates ───────────────────────────────────────────────────────
  const dupes = stats.qualityFlags.duplicateRowCount;
  if (dupes > 0) {
    stories.push({
      icon: 'content_copy',
      title: 'Duplicate Rows',
      text: `**${dupes} duplicate rows** found (${stats.qualityFlags.duplicatePct}% of the dataset). Duplicates can inflate averages and skew distributions. Consider removing them before analysis.`,
      category: 'quality',
      severity: dupes > stats.rowCount * 0.05 ? 'error' : 'amber-400',
    });
  }

  // ── 4. Correlation stories ──────────────────────────────────────────────
  if (stats.correlationInsights?.length > 0) {
    for (const ci of stats.correlationInsights.slice(0, 3)) {
      const absR = Math.abs(ci.r);
      const dir = ci.r > 0 ? 'positive' : 'negative';
      const strength = absR >= 0.8 ? 'very strong' : absR >= 0.6 ? 'strong' : absR >= 0.4 ? 'moderate' : 'weak';

      let actionable = '';
      if (ci.r > 0.7) {
        actionable = `As one increases, the other tends to increase as well. This could indicate a causal relationship worth investigating further.`;
      } else if (ci.r < -0.7) {
        actionable = `As one increases, the other tends to decrease. This inverse relationship could be strategically important.`;
      } else if (absR > 0.4) {
        actionable = `While not deterministic, this association is strong enough to consider in predictive modeling.`;
      }

      stories.push({
        icon: dir === 'positive' ? 'trending_up' : 'trending_down',
        title: `Correlation: r = ${ci.r.toFixed(2)}`,
        text: `There is a **${strength} ${dir} correlation** (r = ${ci.r.toFixed(2)}) between these variables. ${actionable}`,
        category: 'correlation',
        severity: absR >= 0.7 ? 'primary' : 'on-surface-variant',
      });
    }
  }

  // ── 5. Time series trend ────────────────────────────────────────────────
  if (stats.timeSeries) {
    const ts = stats.timeSeries;
    const dir = ts.trendDirection;
    const icon = dir === 'Upward' ? 'show_chart' : dir === 'Downward' ? 'ssid_chart' : 'horizontal_rule';

    let trendText = `The time series for **${ts.primaryCol}** over **${ts.dateCol}** shows a **${dir.toLowerCase()} trend** across ${ts.series.length} periods.`;
    if (ts.peak) {
      trendText += ` The peak value of **${ts.peak.value?.toLocaleString()}** was reached on ${ts.peak.date}.`;
    }
    if (ts.trough) {
      trendText += ` The lowest point was **${ts.trough.value?.toLocaleString()}** on ${ts.trough.date}.`;
    }

    stories.push({
      icon,
      title: `Trend: ${dir}`,
      text: trendText,
      category: 'timeseries',
      severity: 'tertiary',
    });
  }

  // ── 6. Outlier stories ──────────────────────────────────────────────────
  const outlierCols = stats.numericColumns.filter(c => {
    const s = stats.numericStats[c];
    return s && (s.zscoreOutlierCount > 0 || s.iqrOutlierCount > 0);
  });

  if (outlierCols.length > 0) {
    const totalOutliers = outlierCols.reduce((sum, c) => sum + (stats.numericStats[c]?.zscoreOutlierCount || 0), 0);
    stories.push({
      icon: 'error_outline',
      title: 'Outliers Detected',
      text: `**${totalOutliers} outlier values** found across **${outlierCols.length} columns** (${outlierCols.slice(0, 4).join(', ')}${outlierCols.length > 4 ? '...' : ''}). Outliers can heavily influence mean values and regression models. Review these data points before running statistical tests.`,
      category: 'outlier',
      severity: 'amber-400',
    });
  }

  // ── 7. Category dominance ───────────────────────────────────────────────
  const catAggKeys = Object.keys(stats.categoryAggregations || {});
  if (catAggKeys.length > 0 && stats.primaryCol) {
    const firstCat = stats.categoryAggregations[catAggKeys[0]];
    if (firstCat?.top5?.[0]) {
      const top = firstCat.top5[0];
      stories.push({
        icon: 'category',
        title: 'Dominant Category',
        text: `In the **${catAggKeys[0]}** breakdown, **"${top.label}"** dominates with **${top.pctOfTotal}%** of total ${firstCat.primaryCol}. ${firstCat.comparativeInsight || ''}`,
        category: 'category',
        severity: 'tertiary',
      });
    }
  }

  // ── 8. Skewness warnings ────────────────────────────────────────────────
  const skewedCols = stats.numericColumns.filter(c => {
    const s = stats.numericStats[c];
    return s && Math.abs(s.skewness) > 1;
  });
  if (skewedCols.length > 0) {
    const col = skewedCols[0];
    const sk = stats.numericStats[col].skewness;
    const dir = sk > 0 ? 'right (positive)' : 'left (negative)';
    stories.push({
      icon: 'align_horizontal_left',
      title: 'Skewed Distribution',
      text: `**${col}** is heavily **${dir}-skewed** (skewness = ${sk}). This means the distribution has a long tail. Consider using median instead of mean for central tendency, or apply a log transform for modeling.`,
      category: 'distribution',
      severity: 'amber-400',
    });
  }

  return stories;
}
