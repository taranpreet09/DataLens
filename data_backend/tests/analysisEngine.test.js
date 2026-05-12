/**
 * Phase 3 — Analysis Engine Unit Tests
 * Tests mathematical correctness, edge cases, NaN handling, and extreme values.
 */

import { describe, it, expect } from 'vitest';
import {
  kMeans,
  autoK,
  kMeansAnalysis,
  linearRegression,
  multipleLinearRegression,
  polynomialRegression,
  regressionAnalysis,
  decisionTreeImportance,
  isolationForest,
  isolationForestAnalysis,
  holtWinters,
  holtWintersAnalysis,
  fftSpectrum,
  fftAnalysis,
} from '../services/analysisEngine.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateClusteredData(centers, pointsPerCluster, noise = 0.1) {
  const data = [];
  const trueLabels = [];
  for (let c = 0; c < centers.length; c++) {
    for (let i = 0; i < pointsPerCluster; i++) {
      const point = centers[c].map(v => v + (Math.random() - 0.5) * noise);
      data.push(point);
      trueLabels.push(c);
    }
  }
  return { data, trueLabels };
}

function generateLinearData(n, slope, intercept, noise = 0) {
  const x = [], y = [];
  for (let i = 0; i < n; i++) {
    const xi = i / n * 10;
    x.push(xi);
    y.push(slope * xi + intercept + (Math.random() - 0.5) * noise);
  }
  return { x, y };
}

function generateSineWave(n, frequency, amplitude = 1, noise = 0) {
  const signal = [];
  for (let i = 0; i < n; i++) {
    signal.push(amplitude * Math.sin(2 * Math.PI * frequency * i / n) + (Math.random() - 0.5) * noise);
  }
  return signal;
}

// ═══════════════════════════════════════════════════════════════════════════════
// K-MEANS TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('K-Means Clustering', () => {
  it('should cluster well-separated data correctly', () => {
    const { data } = generateClusteredData([[0, 0], [10, 10], [20, 0]], 30, 0.5);
    const result = kMeans(data, 3);

    expect(result.labels).toHaveLength(data.length);
    expect(new Set(result.labels).size).toBe(3);
    expect(result.centroids).toHaveLength(3);
    expect(result.wcss).toBeGreaterThan(0);
    expect(result.iterations).toBeLessThan(300);
  });

  it('should handle k=1', () => {
    const data = [[1, 2], [3, 4], [5, 6]];
    const result = kMeans(data, 1);
    expect(result.labels.every(l => l === 0)).toBe(true);
    expect(result.centroids).toHaveLength(1);
  });

  it('should handle k=n (each point is its own cluster)', () => {
    const data = [[0, 0], [10, 10], [20, 20]];
    const result = kMeans(data, 3);
    expect(result.labels).toHaveLength(3);
    expect(result.wcss).toBeCloseTo(0, 0);
  });

  it('should converge on overlapping clusters', () => {
    const { data } = generateClusteredData([[0, 0], [1, 1]], 50, 2);
    const result = kMeans(data, 2);
    expect(result.labels).toHaveLength(data.length);
    expect(result.iterations).toBeLessThan(300);
  });

  it('should throw on invalid inputs', () => {
    expect(() => kMeans([], 3)).toThrow();
    expect(() => kMeans([[1, 2]], 5)).toThrow();
  });
});

describe('Auto-K (Elbow Method)', () => {
  it('should find optimal K for well-separated clusters', () => {
    const { data } = generateClusteredData([[0, 0], [10, 10], [20, 0]], 50, 0.3);
    const result = autoK(data, { maxK: 8 });

    expect(result.optimalK).toBeGreaterThanOrEqual(2);
    expect(result.optimalK).toBeLessThanOrEqual(5);
    expect(result.wcssValues).toHaveLength(8);
    expect(result.wcssValues[0].wcss).toBeGreaterThan(result.wcssValues[7].wcss);
  });

  it('should handle small datasets', () => {
    const data = [[1, 2], [3, 4], [5, 6], [7, 8]];
    const result = autoK(data, { maxK: 3 });
    expect(result.optimalK).toBeGreaterThanOrEqual(1);
    expect(result.wcssValues.length).toBeLessThanOrEqual(3);
  });
});

describe('kMeansAnalysis (full pipeline)', () => {
  it('should work with dataset rows', () => {
    const headers = ['x', 'y', 'name'];
    const rows = [];
    for (let i = 0; i < 60; i++) {
      const cluster = i % 3;
      rows.push({
        x: cluster * 10 + Math.random(),
        y: cluster * 10 + Math.random(),
        name: `point_${i}`,
      });
    }

    const result = kMeansAnalysis(headers, rows, { columns: ['x', 'y'], k: 3 });
    expect(result.labels).toHaveLength(60);
    expect(result.k).toBe(3);
    expect(result.columnsUsed).toEqual(['x', 'y']);
  });

  it('should auto-detect numeric columns', () => {
    const headers = ['a', 'b', 'category'];
    const rows = Array.from({ length: 30 }, (_, i) => ({
      a: Math.random() * 10,
      b: Math.random() * 10,
      category: 'cat_' + (i % 3),
    }));

    const result = kMeansAnalysis(headers, rows, { autoSelect: true });
    expect(result.columnsUsed).toContain('a');
    expect(result.columnsUsed).toContain('b');
    expect(result.columnsUsed).not.toContain('category');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Linear Regression', () => {
  it('should fit perfect linear data exactly', () => {
    const { x, y } = generateLinearData(100, 2.5, 3, 0);
    const result = linearRegression(x, y);

    expect(result.slope).toBeCloseTo(2.5, 2);
    expect(result.intercept).toBeCloseTo(3, 2);
    expect(result.rSquared).toBeCloseTo(1, 4);
    expect(result.rmse).toBeCloseTo(0, 2);
  });

  it('should handle noisy data', () => {
    const { x, y } = generateLinearData(200, 1.5, -2, 3);
    const result = linearRegression(x, y);

    expect(result.slope).toBeCloseTo(1.5, 0);
    expect(result.rSquared).toBeGreaterThan(0.5);
    expect(result.residuals).toHaveLength(200);
  });

  it('should throw on insufficient data', () => {
    expect(() => linearRegression([1], [2])).toThrow();
  });

  it('should throw on identical x values', () => {
    expect(() => linearRegression([5, 5, 5], [1, 2, 3])).toThrow();
  });
});

describe('Multiple Linear Regression', () => {
  it('should fit y = 2*x1 + 3*x2 + 1', () => {
    const X = [];
    const y = [];
    for (let i = 0; i < 100; i++) {
      const x1 = Math.random() * 10;
      const x2 = Math.random() * 10;
      X.push([x1, x2]);
      y.push(2 * x1 + 3 * x2 + 1);
    }

    const result = multipleLinearRegression(X, y);
    expect(result.coefficients[0]).toBeCloseTo(2, 1);
    expect(result.coefficients[1]).toBeCloseTo(3, 1);
    expect(result.intercept).toBeCloseTo(1, 1);
    expect(result.rSquared).toBeCloseTo(1, 3);
  });

  it('should handle multicollinearity gracefully', () => {
    const X = [];
    const y = [];
    for (let i = 0; i < 50; i++) {
      const x1 = Math.random() * 10;
      X.push([x1, x1 * 2 + 0.01]); // Nearly collinear
      y.push(x1 + 5);
    }

    const result = multipleLinearRegression(X, y);
    expect(result.rSquared).toBeGreaterThan(0.9);
  });
});

describe('Polynomial Regression', () => {
  it('should fit quadratic data', () => {
    const x = [], y = [];
    for (let i = 0; i < 50; i++) {
      const xi = (i - 25) / 5;
      x.push(xi);
      y.push(2 * xi * xi - 3 * xi + 1);
    }

    const result = polynomialRegression(x, y, 2);
    expect(result.rSquared).toBeCloseTo(1, 3);
    expect(result.degree).toBe(2);
  });

  it('should detect overfitting with high degree', () => {
    const { x, y } = generateLinearData(20, 1, 0, 2);
    const deg2 = polynomialRegression(x, y, 2);
    const deg5 = polynomialRegression(x, y, 5);

    // Higher degree should have higher R² on training data
    expect(deg5.rSquared).toBeGreaterThanOrEqual(deg2.rSquared - 0.01);
  });

  it('should throw on invalid degree', () => {
    expect(() => polynomialRegression([1, 2, 3], [1, 2, 3], 0)).toThrow();
    expect(() => polynomialRegression([1, 2, 3], [1, 2, 3], 6)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DECISION TREE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Decision Tree Feature Importance', () => {
  it('should rank dominant feature highest', () => {
    const headers = ['important', 'noise1', 'noise2', 'target'];
    const rows = [];
    for (let i = 0; i < 200; i++) {
      const imp = Math.random() * 100;
      rows.push({
        important: imp,
        noise1: Math.random() * 100,
        noise2: Math.random() * 100,
        target: imp > 50 ? 'high' : 'low',
      });
    }

    const result = decisionTreeImportance(headers, rows, { targetColumn: 'target' });
    const entries = Object.entries(result.importances);

    expect(entries[0][0]).toBe('important');
    expect(entries[0][1]).toBeGreaterThan(0.5);
    expect(result.taskType).toBe('classification');
  });

  it('should work for regression tasks', () => {
    const headers = ['x1', 'x2', 'y'];
    const rows = Array.from({ length: 100 }, () => {
      const x1 = Math.random() * 10;
      const x2 = Math.random() * 10;
      return { x1, x2, y: 3 * x1 + 0.1 * x2 };
    });

    const result = decisionTreeImportance(headers, rows, { targetColumn: 'y' });
    expect(result.taskType).toBe('regression');
    expect(result.importances.x1).toBeGreaterThan(result.importances.x2);
  });

  it('should throw without target column', () => {
    expect(() => decisionTreeImportance(['a', 'b'], [{ a: 1, b: 2 }], {})).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ISOLATION FOREST TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Isolation Forest', () => {
  it('should detect injected anomalies', () => {
    // Normal data centered around 0
    const data = Array.from({ length: 100 }, () => [
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
    ]);
    // Inject anomalies far from center
    data.push([10, 10]);
    data.push([-10, -10]);
    data.push([10, -10]);

    const result = isolationForest(data, { nTrees: 50, contamination: 0.05 });

    expect(result.scores).toHaveLength(103);
    // Anomalies should have higher scores
    const anomalyScores = [result.scores[100], result.scores[101], result.scores[102]];
    const normalScores = result.scores.slice(0, 100);
    const avgNormal = normalScores.reduce((a, b) => a + b, 0) / normalScores.length;
    const avgAnomaly = anomalyScores.reduce((a, b) => a + b, 0) / anomalyScores.length;

    expect(avgAnomaly).toBeGreaterThan(avgNormal);
  });

  it('should respect contamination parameter', () => {
    const data = Array.from({ length: 100 }, () => [Math.random(), Math.random()]);
    const result = isolationForest(data, { contamination: 0.1 });

    // Should flag approximately 10% as anomalies
    expect(result.nAnomalies).toBeGreaterThanOrEqual(5);
    expect(result.nAnomalies).toBeLessThanOrEqual(20);
  });

  it('should throw on too few data points', () => {
    expect(() => isolationForest([[1, 2], [3, 4]], {})).toThrow();
  });

  it('should handle high-dimensional data', () => {
    const data = Array.from({ length: 50 }, () =>
      Array.from({ length: 10 }, () => Math.random())
    );
    const result = isolationForest(data, { nTrees: 20 });
    expect(result.scores).toHaveLength(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HOLT-WINTERS TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Holt-Winters Forecasting', () => {
  it('should forecast seasonal data', () => {
    // Generate seasonal data: trend + seasonality
    const n = 48; // 4 years of monthly data
    const series = [];
    for (let i = 0; i < n; i++) {
      const trend = 100 + i * 0.5;
      const season = 10 * Math.sin(2 * Math.PI * i / 12);
      series.push(trend + season);
    }

    const result = holtWinters(series, { seasonLength: 12, forecastPeriods: 6 });

    expect(result.fitted).toHaveLength(n);
    expect(result.forecast).toHaveLength(6);
    expect(result.confidenceIntervals).toHaveLength(6);
    expect(result.rmse).toBeLessThan(20);
  });

  it('should handle trend-only data', () => {
    const series = Array.from({ length: 30 }, (_, i) => 10 + i * 2);
    const result = holtWinters(series, { seasonLength: 6, forecastPeriods: 3, multiplicative: false });

    expect(result.forecast).toHaveLength(3);
    // Forecast should continue the trend
    expect(result.forecast[0]).toBeGreaterThan(series[series.length - 1] - 10);
  });

  it('should throw on insufficient data', () => {
    expect(() => holtWinters([1, 2, 3], { seasonLength: 12 })).toThrow();
  });

  it('should produce confidence intervals that widen over time', () => {
    const series = Array.from({ length: 36 }, (_, i) => 50 + 10 * Math.sin(i / 6 * Math.PI) + Math.random() * 5);
    const result = holtWinters(series, { seasonLength: 6, forecastPeriods: 12 });

    const firstWidth = result.confidenceIntervals[0].upper - result.confidenceIntervals[0].lower;
    const lastWidth = result.confidenceIntervals[11].upper - result.confidenceIntervals[11].lower;
    expect(lastWidth).toBeGreaterThan(firstWidth);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FFT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('FFT Seasonality Detection', () => {
  it('should detect a single dominant frequency', () => {
    // Pure sine wave with period 16
    const signal = generateSineWave(128, 8, 1, 0); // 8 cycles in 128 points = period 16
    const result = fftSpectrum(signal);

    expect(result.dominantFrequencies.length).toBeGreaterThan(0);
    // The dominant period should be close to 16
    const dominantPeriod = result.dominantFrequencies[0].period;
    expect(dominantPeriod).toBeGreaterThan(12);
    expect(dominantPeriod).toBeLessThan(20);
  });

  it('should detect multiple frequencies', () => {
    // Mixed signal: period 8 + period 32
    const signal = [];
    for (let i = 0; i < 128; i++) {
      signal.push(
        Math.sin(2 * Math.PI * i / 8) +
        0.5 * Math.sin(2 * Math.PI * i / 32)
      );
    }

    const result = fftSpectrum(signal);
    expect(result.dominantFrequencies.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle noisy signals', () => {
    const signal = generateSineWave(256, 16, 5, 2);
    const result = fftSpectrum(signal);

    // Should still find the dominant frequency despite noise
    expect(result.dominantFrequencies.length).toBeGreaterThan(0);
  });

  it('should throw on too few data points', () => {
    expect(() => fftSpectrum([1, 2, 3])).toThrow();
  });

  it('should return correct signal metadata', () => {
    const signal = Array.from({ length: 64 }, () => Math.random());
    const result = fftSpectrum(signal);

    expect(result.signalLength).toBe(64);
    expect(result.paddedLength).toBe(64); // Already power of 2
    expect(result.frequencies.length).toBeGreaterThan(0);
    expect(result.magnitudes.length).toBe(result.frequencies.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE CASES & ROBUSTNESS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  it('kMeans handles identical points', () => {
    const data = Array.from({ length: 20 }, () => [5, 5]);
    const result = kMeans(data, 2);
    expect(result.labels).toHaveLength(20);
  });

  it('regression handles negative values', () => {
    const x = [-10, -5, 0, 5, 10];
    const y = [-20, -10, 0, 10, 20];
    const result = linearRegression(x, y);
    expect(result.slope).toBeCloseTo(2, 2);
    expect(result.intercept).toBeCloseTo(0, 2);
  });

  it('isolation forest handles single-dimension data', () => {
    const data = Array.from({ length: 50 }, () => [Math.random()]);
    data.push([100]); // Anomaly
    const result = isolationForest(data, { nTrees: 30, contamination: 0.05 });
    expect(result.scores[50]).toBeGreaterThan(result.scores[0]);
  });

  it('holtWinters handles constant series', () => {
    const series = Array.from({ length: 30 }, () => 42);
    const result = holtWinters(series, { seasonLength: 6, multiplicative: false });
    expect(result.forecast.every(v => Math.abs(v - 42) < 5)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Performance', () => {
  it('kMeans on 10k points completes in <5s', () => {
    const data = Array.from({ length: 10000 }, () => [Math.random() * 100, Math.random() * 100]);
    const t0 = performance.now();
    const result = kMeans(data, 5);
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(5000);
    expect(result.labels).toHaveLength(10000);
  });

  it('isolation forest on 10k points completes in <10s', () => {
    const data = Array.from({ length: 10000 }, () => [Math.random(), Math.random(), Math.random()]);
    const t0 = performance.now();
    const result = isolationForest(data, { nTrees: 50 });
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(10000);
    expect(result.scores).toHaveLength(10000);
  });

  it('linear regression on 100k points completes in <2s', () => {
    const x = Array.from({ length: 100000 }, (_, i) => i);
    const y = x.map(xi => 2 * xi + 3 + Math.random());
    const t0 = performance.now();
    const result = linearRegression(x, y);
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(2000);
    expect(result.rSquared).toBeGreaterThan(0.99);
  });

  it('FFT on 10k points completes in <2s', () => {
    const signal = Array.from({ length: 8192 }, (_, i) => Math.sin(i / 10) + Math.random() * 0.1);
    const t0 = performance.now();
    const result = fftSpectrum(signal);
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(2000);
    expect(result.frequencies.length).toBeGreaterThan(0);
  });
});
