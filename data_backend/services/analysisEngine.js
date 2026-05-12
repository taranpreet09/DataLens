/**
 * Phase 3 — Analysis Engine
 * Production-grade analytical algorithms for medium-sized tabular datasets.
 * Pure computation module. Zero side effects.
 *
 * Features:
 * - K-Means Clustering + Auto-K (Elbow Method)
 * - Linear + Polynomial Regression
 * - Decision Tree Feature Importance
 * - Isolation Forest Anomaly Detection
 * - Holt-Winters Forecasting
 * - FFT Seasonality Detection
 */

// ─── Utility ───────────────────────────────────────────────────────────────────

function round(n, d = 4) { const f = 10 ** d; return Math.round(n * f) / f; }
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function variance(arr) { const m = mean(arr); return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1); }
function stdDev(arr) { return arr.length < 2 ? 0 : Math.sqrt(variance(arr)); }

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function standardize(matrix) {
  const cols = matrix[0].length;
  const means = Array(cols).fill(0);
  const stds = Array(cols).fill(0);

  for (let j = 0; j < cols; j++) {
    const col = matrix.map(r => r[j]);
    means[j] = mean(col);
    stds[j] = stdDev(col) || 1;
  }

  const scaled = matrix.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
  return { scaled, means, stds };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. K-MEANS CLUSTERING + AUTO-K
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * K-Means++ initialization: select initial centroids with probability
 * proportional to squared distance from nearest existing centroid.
 */
function kMeansPlusPlusInit(data, k) {
  const n = data.length;
  const centroids = [];

  // First centroid: random
  centroids.push([...data[Math.floor(Math.random() * n)]]);

  for (let c = 1; c < k; c++) {
    const distances = data.map(point => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const d = euclideanDistance(point, centroid);
        if (d < minDist) minDist = d;
      }
      return minDist * minDist;
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) {
      centroids.push([...data[Math.floor(Math.random() * n)]]);
      continue;
    }

    // Weighted random selection
    let r = Math.random() * totalDist;
    for (let i = 0; i < n; i++) {
      r -= distances[i];
      if (r <= 0) { centroids.push([...data[i]]); break; }
    }
    if (centroids.length <= c) centroids.push([...data[Math.floor(Math.random() * n)]]);
  }

  return centroids;
}

/**
 * Run K-Means clustering.
 * @param {number[][]} data - 2D array of numeric values
 * @param {number} k - Number of clusters
 * @param {object} options - { maxIterations, tolerance, seed }
 * @returns {{ labels, centroids, wcss, iterations }}
 */
export function kMeans(data, k, options = {}) {
  const { maxIterations = 300, tolerance = 1e-6 } = options;
  const n = data.length;
  const dims = data[0].length;

  if (n === 0 || k <= 0 || k > n) {
    throw new Error(`Invalid k-means params: n=${n}, k=${k}`);
  }

  let centroids = kMeansPlusPlusInit(data, k);
  let labels = new Array(n).fill(0);
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations++;

    // Assignment step
    const newLabels = data.map(point => {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < k; c++) {
        const d = euclideanDistance(point, centroids[c]);
        if (d < minDist) { minDist = d; bestCluster = c; }
      }
      return bestCluster;
    });

    // Update step
    const newCentroids = Array.from({ length: k }, () => Array(dims).fill(0));
    const counts = Array(k).fill(0);

    for (let i = 0; i < n; i++) {
      const c = newLabels[i];
      counts[c]++;
      for (let j = 0; j < dims; j++) newCentroids[c][j] += data[i][j];
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < dims; j++) newCentroids[c][j] /= counts[c];
      } else {
        // Empty cluster: reinitialize to random point
        newCentroids[c] = [...data[Math.floor(Math.random() * n)]];
      }
    }

    // Check convergence
    let maxShift = 0;
    for (let c = 0; c < k; c++) {
      const shift = euclideanDistance(centroids[c], newCentroids[c]);
      if (shift > maxShift) maxShift = shift;
    }

    centroids = newCentroids;
    labels = newLabels;

    if (maxShift < tolerance) break;
  }

  // Compute WCSS (Within-Cluster Sum of Squares)
  let wcss = 0;
  for (let i = 0; i < n; i++) {
    wcss += euclideanDistance(data[i], centroids[labels[i]]) ** 2;
  }

  return { labels, centroids: centroids.map(c => c.map(v => round(v))), wcss: round(wcss), iterations };
}

/**
 * Auto-K selection using the Elbow Method.
 * Computes WCSS for k=1..maxK and finds the "elbow" point.
 * @param {number[][]} data
 * @param {object} options - { maxK, runs }
 * @returns {{ optimalK, wcssValues, elbowScore }}
 */
export function autoK(data, options = {}) {
  const { maxK = 10, runs = 3 } = options;
  const actualMaxK = Math.min(maxK, data.length);
  const wcssValues = [];

  for (let k = 1; k <= actualMaxK; k++) {
    // Run multiple times and take best WCSS
    let bestWcss = Infinity;
    for (let r = 0; r < runs; r++) {
      const result = kMeans(data, k);
      if (result.wcss < bestWcss) bestWcss = result.wcss;
    }
    wcssValues.push({ k, wcss: bestWcss });
  }

  // Find elbow using the "kneedle" algorithm (max distance from line)
  if (wcssValues.length < 3) {
    return { optimalK: 1, wcssValues, elbowScore: 0 };
  }

  const first = wcssValues[0];
  const last = wcssValues[wcssValues.length - 1];
  const lineSlope = (last.wcss - first.wcss) / (last.k - first.k);

  let maxDist = 0;
  let optimalK = 2;

  for (let i = 1; i < wcssValues.length - 1; i++) {
    const expected = first.wcss + lineSlope * (wcssValues[i].k - first.k);
    const dist = Math.abs(expected - wcssValues[i].wcss);
    if (dist > maxDist) {
      maxDist = dist;
      optimalK = wcssValues[i].k;
    }
  }

  return { optimalK, wcssValues, elbowScore: round(maxDist) };
}

/**
 * Full K-Means analysis on dataset rows.
 * @param {string[]} headers
 * @param {Array} rows
 * @param {object} options - { columns, k, autoSelect, maxK }
 */
export function kMeansAnalysis(headers, rows, options = {}) {
  const { columns, k, autoSelect = true, maxK = 10 } = options;

  // Extract numeric columns
  const numCols = columns || headers.filter(h => {
    const vals = rows.slice(0, 100).map(r => r[h]);
    return vals.filter(v => v !== null && !isNaN(Number(v))).length / vals.length > 0.7;
  });

  if (numCols.length < 2) throw new Error('Need at least 2 numeric columns for clustering');

  // Build data matrix (drop rows with NaN)
  const data = [];
  const validIndices = [];
  for (let i = 0; i < rows.length; i++) {
    const point = numCols.map(c => Number(rows[i][c]));
    if (point.every(v => !isNaN(v))) {
      data.push(point);
      validIndices.push(i);
    }
  }

  if (data.length < 3) throw new Error('Not enough valid rows for clustering');

  // Standardize
  const { scaled, means, stds } = standardize(data);

  // Auto-K or use provided k
  let selectedK = k;
  let elbowResult = null;
  if (autoSelect || !k) {
    elbowResult = autoK(scaled, { maxK: Math.min(maxK, Math.floor(data.length / 2)) });
    selectedK = k || elbowResult.optimalK;
  }

  // Run K-Means
  const result = kMeans(scaled, selectedK);

  // Map labels back to original rows
  const allLabels = new Array(rows.length).fill(-1);
  validIndices.forEach((origIdx, i) => { allLabels[origIdx] = result.labels[i]; });

  // Compute cluster stats in original scale
  const clusterStats = {};
  for (let c = 0; c < selectedK; c++) {
    const clusterPoints = data.filter((_, i) => result.labels[i] === c);
    clusterStats[c] = {
      size: clusterPoints.length,
      centroid: numCols.reduce((obj, col, j) => {
        obj[col] = round(mean(clusterPoints.map(p => p[j])));
        return obj;
      }, {}),
    };
  }

  return {
    labels: allLabels,
    k: selectedK,
    centroids: result.centroids,
    wcss: result.wcss,
    iterations: result.iterations,
    clusterStats,
    columnsUsed: numCols,
    validRows: data.length,
    elbow: elbowResult,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// 2. LINEAR + POLYNOMIAL REGRESSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Solve linear system using Gaussian elimination (for polynomial regression).
 * Solves Ax = b where A is n×n.
 */
function gaussianElimination(A, b) {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-12) continue;

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) sum -= aug[i][j] * x[j];
    x[i] = Math.abs(aug[i][i]) > 1e-12 ? sum / aug[i][i] : 0;
  }
  return x;
}

/**
 * Simple linear regression: y = a + bx
 * @param {number[]} x
 * @param {number[]} y
 * @returns {{ slope, intercept, rSquared, rmse, residuals, predictions }}
 */
export function linearRegression(x, y) {
  if (x.length !== y.length || x.length < 2) {
    throw new Error('Need at least 2 paired values for regression');
  }

  const n = x.length;
  const mx = mean(x);
  const my = mean(y);

  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (x[i] - mx) * (y[i] - my);
    ssXX += (x[i] - mx) ** 2;
    ssYY += (y[i] - my) ** 2;
  }

  if (ssXX === 0) throw new Error('All x values are identical');

  const slope = ssXY / ssXX;
  const intercept = my - slope * mx;

  // Predictions and residuals
  const predictions = x.map(xi => intercept + slope * xi);
  const residuals = y.map((yi, i) => yi - predictions[i]);

  // R² and RMSE
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const rSquared = ssYY > 0 ? 1 - ssRes / ssYY : 0;
  const rmse = Math.sqrt(ssRes / n);

  return {
    slope: round(slope),
    intercept: round(intercept),
    rSquared: round(rSquared),
    rmse: round(rmse),
    residuals: residuals.map(r => round(r)),
    predictions: predictions.map(p => round(p)),
    equation: `y = ${round(slope)}x + ${round(intercept)}`,
    n,
  };
}

/**
 * Multiple linear regression: y = b0 + b1*x1 + b2*x2 + ...
 * Uses normal equations: (X'X)^-1 * X'y
 * @param {number[][]} X - Matrix of features (each row is a sample)
 * @param {number[]} y - Target values
 * @returns {{ coefficients, intercept, rSquared, rmse, residuals, predictions }}
 */
export function multipleLinearRegression(X, y) {
  const n = X.length;
  const p = X[0].length;

  if (n < p + 1) throw new Error('Need more samples than features');

  // Add intercept column
  const Xa = X.map(row => [1, ...row]);
  const cols = p + 1;

  // Normal equations: (Xa'Xa) * beta = Xa'y
  const XtX = Array.from({ length: cols }, () => Array(cols).fill(0));
  const Xty = Array(cols).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < cols; j++) {
      Xty[j] += Xa[i][j] * y[i];
      for (let k = 0; k < cols; k++) {
        XtX[j][k] += Xa[i][j] * Xa[i][k];
      }
    }
  }

  const beta = gaussianElimination(XtX, Xty);
  const intercept = beta[0];
  const coefficients = beta.slice(1);

  // Predictions
  const predictions = X.map(row => {
    let pred = intercept;
    for (let j = 0; j < p; j++) pred += coefficients[j] * row[j];
    return pred;
  });

  const residuals = y.map((yi, i) => yi - predictions[i]);
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const my = mean(y);
  const ssTot = y.reduce((s, yi) => s + (yi - my) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const rmse = Math.sqrt(ssRes / n);

  return {
    coefficients: coefficients.map(c => round(c)),
    intercept: round(intercept),
    rSquared: round(rSquared),
    rmse: round(rmse),
    residuals: residuals.map(r => round(r)),
    predictions: predictions.map(p => round(p)),
    n,
    features: p,
  };
}

/**
 * Polynomial regression: y = a0 + a1*x + a2*x² + ... + an*x^n
 * @param {number[]} x
 * @param {number[]} y
 * @param {number} degree - Polynomial degree (2-5)
 * @returns {{ coefficients, rSquared, rmse, residuals, predictions, degree }}
 */
export function polynomialRegression(x, y, degree = 2) {
  if (degree < 1 || degree > 5) throw new Error('Degree must be between 1 and 5');
  if (x.length < degree + 1) throw new Error(`Need at least ${degree + 1} points for degree ${degree}`);

  const n = x.length;

  // Build Vandermonde matrix
  const X = x.map(xi => {
    const row = [];
    for (let d = 1; d <= degree; d++) row.push(xi ** d);
    return row;
  });

  // Use multiple linear regression on polynomial features
  const result = multipleLinearRegression(X, y);

  // Build equation string
  let equation = `y = ${round(result.intercept)}`;
  result.coefficients.forEach((c, i) => {
    const sign = c >= 0 ? ' + ' : ' - ';
    const power = i + 1;
    equation += `${sign}${round(Math.abs(c))}x${power > 1 ? `^${power}` : ''}`;
  });

  return {
    coefficients: [result.intercept, ...result.coefficients],
    rSquared: result.rSquared,
    rmse: result.rmse,
    residuals: result.residuals,
    predictions: result.predictions,
    degree,
    equation,
    n,
  };
}

/**
 * Full regression analysis on dataset.
 * @param {string[]} headers
 * @param {Array} rows
 * @param {object} options - { xColumn, yColumn, xColumns, degree, type }
 */
export function regressionAnalysis(headers, rows, options = {}) {
  const { xColumn, yColumn, xColumns, degree = 2, type = 'linear' } = options;

  if (!yColumn) throw new Error('yColumn (target) is required');

  // Extract valid paired data
  if (type === 'multiple' && xColumns && xColumns.length > 0) {
    const X = [];
    const y = [];
    for (const row of rows) {
      const yVal = Number(row[yColumn]);
      if (isNaN(yVal)) continue;
      const xVals = xColumns.map(c => Number(row[c]));
      if (xVals.some(isNaN)) continue;
      X.push(xVals);
      y.push(yVal);
    }
    if (X.length < xColumns.length + 1) throw new Error('Not enough valid rows');
    return { type: 'multiple', ...multipleLinearRegression(X, y), featureNames: xColumns, targetName: yColumn };
  }

  if (!xColumn) throw new Error('xColumn is required for simple/polynomial regression');

  const x = [], y = [];
  for (const row of rows) {
    const xVal = Number(row[xColumn]);
    const yVal = Number(row[yColumn]);
    if (!isNaN(xVal) && !isNaN(yVal)) { x.push(xVal); y.push(yVal); }
  }

  if (x.length < 3) throw new Error('Not enough valid paired values');

  if (type === 'polynomial') {
    return { type: 'polynomial', ...polynomialRegression(x, y, degree), xColumn, yColumn };
  }

  return { type: 'linear', ...linearRegression(x, y), xColumn, yColumn, xValues: x, yValues: y };
}


// ═══════════════════════════════════════════════════════════════════════════════
// 3. DECISION TREE FEATURE IMPORTANCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute Gini impurity for a set of labels.
 */
function giniImpurity(labels) {
  if (labels.length === 0) return 0;
  const freq = {};
  labels.forEach(l => { freq[l] = (freq[l] || 0) + 1; });
  let gini = 1;
  for (const count of Object.values(freq)) {
    const p = count / labels.length;
    gini -= p * p;
  }
  return gini;
}

/**
 * Compute entropy for a set of labels.
 */
function entropy(labels) {
  if (labels.length === 0) return 0;
  const freq = {};
  labels.forEach(l => { freq[l] = (freq[l] || 0) + 1; });
  let ent = 0;
  for (const count of Object.values(freq)) {
    const p = count / labels.length;
    if (p > 0) ent -= p * Math.log2(p);
  }
  return ent;
}

/**
 * Compute variance reduction for regression trees.
 */
function varianceReduction(values, leftValues, rightValues) {
  if (leftValues.length === 0 || rightValues.length === 0) return 0;
  const parentVar = variance(values) || 0;
  const leftVar = variance(leftValues) || 0;
  const rightVar = variance(rightValues) || 0;
  const n = values.length;
  return parentVar - (leftValues.length / n) * leftVar - (rightValues.length / n) * rightVar;
}

/**
 * Build a decision tree node (recursive).
 */
function buildTree(X, y, depth, maxDepth, minSamples, criterion, isClassification) {
  const n = X.length;
  const features = X[0].length;

  // Stopping conditions
  if (depth >= maxDepth || n < minSamples) {
    return { leaf: true, value: isClassification ? mode(y) : mean(y), samples: n };
  }

  const uniqueY = new Set(y);
  if (uniqueY.size === 1) {
    return { leaf: true, value: y[0], samples: n };
  }

  let bestGain = -Infinity;
  let bestFeature = 0;
  let bestThreshold = 0;
  let bestLeftIdx = [];
  let bestRightIdx = [];

  // Find best split
  for (let f = 0; f < features; f++) {
    const values = X.map(row => row[f]);
    const uniqueVals = [...new Set(values)].sort((a, b) => a - b);

    // Try midpoints between unique values (sample if too many)
    const thresholds = [];
    const step = Math.max(1, Math.floor(uniqueVals.length / 20));
    for (let i = 0; i < uniqueVals.length - 1; i += step) {
      thresholds.push((uniqueVals[i] + uniqueVals[i + 1]) / 2);
    }

    for (const threshold of thresholds) {
      const leftIdx = [], rightIdx = [];
      for (let i = 0; i < n; i++) {
        if (X[i][f] <= threshold) leftIdx.push(i);
        else rightIdx.push(i);
      }

      if (leftIdx.length < 1 || rightIdx.length < 1) continue;

      const leftY = leftIdx.map(i => y[i]);
      const rightY = rightIdx.map(i => y[i]);

      let gain;
      if (isClassification) {
        const parentImpurity = criterion === 'entropy' ? entropy(y) : giniImpurity(y);
        const leftImpurity = criterion === 'entropy' ? entropy(leftY) : giniImpurity(leftY);
        const rightImpurity = criterion === 'entropy' ? entropy(rightY) : giniImpurity(rightY);
        gain = parentImpurity - (leftIdx.length / n) * leftImpurity - (rightIdx.length / n) * rightImpurity;
      } else {
        gain = varianceReduction(y, leftY, rightY);
      }

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = f;
        bestThreshold = threshold;
        bestLeftIdx = leftIdx;
        bestRightIdx = rightIdx;
      }
    }
  }

  if (bestGain <= 0) {
    return { leaf: true, value: isClassification ? mode(y) : mean(y), samples: n };
  }

  const leftX = bestLeftIdx.map(i => X[i]);
  const leftY = bestLeftIdx.map(i => y[i]);
  const rightX = bestRightIdx.map(i => X[i]);
  const rightY = bestRightIdx.map(i => y[i]);

  return {
    leaf: false,
    feature: bestFeature,
    threshold: round(bestThreshold),
    gain: round(bestGain),
    samples: n,
    left: buildTree(leftX, leftY, depth + 1, maxDepth, minSamples, criterion, isClassification),
    right: buildTree(rightX, rightY, depth + 1, maxDepth, minSamples, criterion, isClassification),
  };
}

function mode(arr) {
  const freq = {};
  arr.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Extract feature importance from a decision tree.
 */
function extractImportance(tree, numFeatures) {
  const importance = Array(numFeatures).fill(0);

  function traverse(node) {
    if (node.leaf) return;
    importance[node.feature] += node.gain * node.samples;
    traverse(node.left);
    traverse(node.right);
  }

  traverse(tree);

  // Normalize
  const total = importance.reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (let i = 0; i < numFeatures; i++) importance[i] /= total;
  }

  return importance;
}

/**
 * Extract split paths for explainability.
 */
function extractSplitPaths(tree, featureNames, maxPaths = 10) {
  const paths = [];

  function traverse(node, path) {
    if (paths.length >= maxPaths) return;
    if (node.leaf) {
      paths.push({ conditions: [...path], prediction: node.value, samples: node.samples });
      return;
    }
    const fname = featureNames[node.feature] || `feature_${node.feature}`;
    traverse(node.left, [...path, `${fname} <= ${node.threshold}`]);
    traverse(node.right, [...path, `${fname} > ${node.threshold}`]);
  }

  traverse(tree, []);
  return paths;
}

/**
 * Decision tree feature importance analysis.
 * @param {string[]} headers
 * @param {Array} rows
 * @param {object} options - { targetColumn, criterion, maxDepth, minSamples }
 */
export function decisionTreeImportance(headers, rows, options = {}) {
  const { targetColumn, criterion = 'gini', maxDepth = 10, minSamples = 5 } = options;

  if (!targetColumn) throw new Error('targetColumn is required');

  const featureCols = headers.filter(h => h !== targetColumn);

  // Build data matrix
  const X = [];
  const y = [];
  const numericFeatures = [];

  // Determine which features are numeric
  for (const col of featureCols) {
    const vals = rows.slice(0, 100).map(r => r[col]);
    const numRatio = vals.filter(v => v !== null && !isNaN(Number(v))).length / vals.length;
    if (numRatio > 0.7) numericFeatures.push(col);
  }

  if (numericFeatures.length === 0) throw new Error('No numeric features found');

  // Determine if classification or regression
  const targetVals = rows.map(r => r[targetColumn]).filter(v => v !== null && v !== '');
  const numericTargetRatio = targetVals.filter(v => !isNaN(Number(v))).length / targetVals.length;
  const isClassification = numericTargetRatio < 0.7 || new Set(targetVals).size < 10;

  for (const row of rows) {
    const xVals = numericFeatures.map(c => Number(row[c]));
    if (xVals.some(isNaN)) continue;
    const yVal = isClassification ? String(row[targetColumn]) : Number(row[targetColumn]);
    if (!isClassification && isNaN(yVal)) continue;
    if (row[targetColumn] === null || row[targetColumn] === '') continue;
    X.push(xVals);
    y.push(yVal);
  }

  if (X.length < minSamples * 2) throw new Error('Not enough valid rows');

  // Build tree
  const tree = buildTree(X, y, 0, maxDepth, minSamples, criterion, isClassification);

  // Extract importance
  const rawImportance = extractImportance(tree, numericFeatures.length);
  const importances = {};
  numericFeatures.forEach((col, i) => { importances[col] = round(rawImportance[i]); });

  // Sort by importance
  const sorted = Object.entries(importances).sort((a, b) => b[1] - a[1]);

  // Extract split paths
  const splitPaths = extractSplitPaths(tree, numericFeatures);

  return {
    importances: Object.fromEntries(sorted),
    taskType: isClassification ? 'classification' : 'regression',
    criterion,
    tree,
    splitPaths,
    nFeatures: numericFeatures.length,
    nSamples: X.length,
    featureNames: numericFeatures,
    targetColumn,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// 4. ISOLATION FOREST ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a single isolation tree.
 */
function buildIsolationTree(data, indices, depth, maxDepth) {
  const n = indices.length;

  if (depth >= maxDepth || n <= 1) {
    return { leaf: true, size: n };
  }

  const dims = data[0].length;
  const feature = Math.floor(Math.random() * dims);

  // Get min/max for this feature in current subset
  let min = Infinity, max = -Infinity;
  for (const idx of indices) {
    const v = data[idx][feature];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  if (min === max) {
    return { leaf: true, size: n };
  }

  const threshold = min + Math.random() * (max - min);

  const leftIdx = [];
  const rightIdx = [];
  for (const idx of indices) {
    if (data[idx][feature] < threshold) leftIdx.push(idx);
    else rightIdx.push(idx);
  }

  return {
    leaf: false,
    feature,
    threshold,
    left: buildIsolationTree(data, leftIdx, depth + 1, maxDepth),
    right: buildIsolationTree(data, rightIdx, depth + 1, maxDepth),
  };
}

/**
 * Compute path length for a single point in an isolation tree.
 */
function pathLength(point, tree, depth = 0) {
  if (tree.leaf) {
    // Average path length of unsuccessful search in BST
    const n = tree.size;
    if (n <= 1) return depth;
    return depth + averagePathLength(n);
  }

  if (point[tree.feature] < tree.threshold) {
    return pathLength(point, tree.left, depth + 1);
  }
  return pathLength(point, tree.right, depth + 1);
}

/**
 * Average path length of unsuccessful search in BST (harmonic number approximation).
 */
function averagePathLength(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
}

/**
 * Isolation Forest anomaly detection.
 * @param {number[][]} data - 2D numeric array
 * @param {object} options - { nTrees, sampleSize, contamination }
 * @returns {{ scores, threshold, anomalyIndices }}
 */
export function isolationForest(data, options = {}) {
  const { nTrees = 100, sampleSize = 256, contamination = 0.1 } = options;
  const n = data.length;

  if (n < 10) throw new Error('Need at least 10 data points');

  const actualSampleSize = Math.min(sampleSize, n);
  const maxDepth = Math.ceil(Math.log2(actualSampleSize));

  // Build forest
  const trees = [];
  for (let t = 0; t < nTrees; t++) {
    // Random subsample
    const indices = [];
    for (let i = 0; i < actualSampleSize; i++) {
      indices.push(Math.floor(Math.random() * n));
    }
    trees.push(buildIsolationTree(data, indices, 0, maxDepth));
  }

  // Score each point
  const c = averagePathLength(actualSampleSize);
  const scores = data.map(point => {
    const avgPath = trees.reduce((sum, tree) => sum + pathLength(point, tree), 0) / nTrees;
    // Anomaly score: 2^(-avgPath/c)
    return round(Math.pow(2, -avgPath / c));
  });

  // Determine threshold based on contamination
  const sortedScores = [...scores].sort((a, b) => b - a);
  const thresholdIdx = Math.floor(n * contamination);
  const threshold = sortedScores[Math.max(0, thresholdIdx - 1)] || 0.5;

  const anomalyIndices = scores
    .map((s, i) => ({ score: s, index: i }))
    .filter(item => item.score >= threshold)
    .map(item => item.index);

  return {
    scores,
    threshold: round(threshold),
    anomalyIndices,
    nAnomalies: anomalyIndices.length,
    nTrees,
    sampleSize: actualSampleSize,
  };
}

/**
 * Full isolation forest analysis on dataset rows.
 * @param {string[]} headers
 * @param {Array} rows
 * @param {object} options - { columns, nTrees, contamination }
 */
export function isolationForestAnalysis(headers, rows, options = {}) {
  const { columns, nTrees = 100, contamination = 0.1 } = options;

  const numCols = columns || headers.filter(h => {
    const vals = rows.slice(0, 100).map(r => r[h]);
    return vals.filter(v => v !== null && !isNaN(Number(v))).length / vals.length > 0.7;
  });

  if (numCols.length < 1) throw new Error('Need at least 1 numeric column');

  // Build data matrix
  const data = [];
  const validIndices = [];
  for (let i = 0; i < rows.length; i++) {
    const point = numCols.map(c => Number(rows[i][c]));
    if (point.every(v => !isNaN(v))) {
      data.push(point);
      validIndices.push(i);
    }
  }

  if (data.length < 10) throw new Error('Not enough valid rows');

  // Standardize
  const { scaled } = standardize(data);

  const result = isolationForest(scaled, { nTrees, contamination });

  // Map back to original indices
  const allScores = new Array(rows.length).fill(0);
  validIndices.forEach((origIdx, i) => { allScores[origIdx] = result.scores[i]; });

  const anomalyRows = result.anomalyIndices.map(i => ({
    originalIndex: validIndices[i],
    score: result.scores[i],
    values: numCols.reduce((obj, col) => { obj[col] = rows[validIndices[i]][col]; return obj; }, {}),
  }));

  return {
    scores: allScores,
    threshold: result.threshold,
    anomalyRows: anomalyRows.slice(0, 100), // Limit for response size
    nAnomalies: result.nAnomalies,
    nTrees: result.nTrees,
    contamination,
    columnsUsed: numCols,
    validRows: data.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. HOLT-WINTERS FORECASTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Holt-Winters triple exponential smoothing.
 * @param {number[]} series - Time series values
 * @param {object} options
 * @returns {{ fitted, forecast, confidenceIntervals, params, residuals }}
 */
export function holtWinters(series, options = {}) {
  const {
    seasonLength = 12,
    alpha = 0.3,
    beta = 0.1,
    gamma = 0.3,
    forecastPeriods = 12,
    multiplicative = true,
  } = options;

  const n = series.length;
  if (n < seasonLength * 2) {
    throw new Error(`Need at least ${seasonLength * 2} data points for season length ${seasonLength}`);
  }

  // Initialize level and trend from first two seasons
  let level = mean(series.slice(0, seasonLength));
  let trend = 0;
  for (let i = 0; i < seasonLength; i++) {
    trend += (series[seasonLength + i] - series[i]) / seasonLength;
  }
  trend /= seasonLength;

  // Initialize seasonal components
  const seasonal = new Array(n + forecastPeriods + seasonLength).fill(multiplicative ? 1 : 0);
  for (let i = 0; i < seasonLength; i++) {
    if (multiplicative) {
      seasonal[i] = level > 0 ? series[i] / level : 1;
    } else {
      seasonal[i] = series[i] - level;
    }
  }

  // Fit the model
  const fitted = new Array(n).fill(0);

  for (let t = 0; t < n; t++) {
    const prevLevel = level;
    const prevTrend = trend;
    const seasonIdx = t % seasonLength;

    if (multiplicative) {
      level = alpha * (series[t] / (seasonal[seasonIdx] || 1)) + (1 - alpha) * (prevLevel + prevTrend);
      trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
      seasonal[t + seasonLength] = gamma * (series[t] / (level || 1)) + (1 - gamma) * seasonal[seasonIdx];
      fitted[t] = (prevLevel + prevTrend) * seasonal[seasonIdx];
    } else {
      level = alpha * (series[t] - seasonal[seasonIdx]) + (1 - alpha) * (prevLevel + prevTrend);
      trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
      seasonal[t + seasonLength] = gamma * (series[t] - level) + (1 - gamma) * seasonal[seasonIdx];
      fitted[t] = prevLevel + prevTrend + seasonal[seasonIdx];
    }
  }

  // Generate forecast
  const forecast = [];
  for (let h = 1; h <= forecastPeriods; h++) {
    const seasonIdx = (n + h - 1) % seasonLength;
    const sComp = seasonal[n + h - 1] || seasonal[seasonIdx] || (multiplicative ? 1 : 0);
    if (multiplicative) {
      forecast.push(round((level + h * trend) * sComp));
    } else {
      forecast.push(round(level + h * trend + sComp));
    }
  }

  // Residuals
  const residuals = series.map((v, i) => round(v - fitted[i]));
  const residualStd = stdDev(residuals.filter(r => !isNaN(r)));

  // Confidence intervals (approximate using residual std)
  const confidenceIntervals = forecast.map((f, h) => {
    const width = 1.96 * residualStd * Math.sqrt(1 + h * 0.1);
    return { forecast: f, lower: round(f - width), upper: round(f + width) };
  });

  return {
    fitted: fitted.map(v => round(v)),
    forecast,
    confidenceIntervals,
    residuals,
    params: { alpha, beta, gamma, seasonLength, multiplicative },
    rmse: round(Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n)),
    n,
  };
}

/**
 * Full Holt-Winters analysis on dataset.
 * @param {string[]} headers
 * @param {Array} rows
 * @param {object} options - { valueColumn, dateColumn, seasonLength, forecastPeriods, multiplicative }
 */
export function holtWintersAnalysis(headers, rows, options = {}) {
  const { valueColumn, dateColumn, seasonLength = 12, forecastPeriods = 12, multiplicative = true } = options;

  if (!valueColumn) throw new Error('valueColumn is required');

  // Extract time series
  let series = [];
  if (dateColumn) {
    // Sort by date
    const sorted = [...rows]
      .map(r => ({ date: new Date(r[dateColumn]), value: Number(r[valueColumn]) }))
      .filter(r => !isNaN(r.date.getTime()) && !isNaN(r.value))
      .sort((a, b) => a.date - b.date);
    series = sorted.map(r => r.value);
  } else {
    series = rows.map(r => Number(r[valueColumn])).filter(v => !isNaN(v));
  }

  if (series.length < seasonLength * 2) {
    throw new Error(`Need at least ${seasonLength * 2} values, got ${series.length}`);
  }

  return {
    ...holtWinters(series, { seasonLength, forecastPeriods, multiplicative }),
    valueColumn,
    dateColumn,
    seriesLength: series.length,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// 6. FFT SEASONALITY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cooley-Tukey FFT (radix-2 DIT).
 * Input length must be a power of 2 (zero-pad if needed).
 * @param {number[]} real - Real part
 * @param {number[]} imag - Imaginary part
 * @returns {{ real: number[], imag: number[] }}
 */
function fft(real, imag) {
  const n = real.length;
  if (n === 1) return { real: [...real], imag: [...imag] };

  // Bit-reversal permutation
  const outReal = new Array(n);
  const outImag = new Array(n);
  const bits = Math.log2(n);

  for (let i = 0; i < n; i++) {
    let rev = 0;
    for (let j = 0; j < bits; j++) {
      rev = (rev << 1) | ((i >> j) & 1);
    }
    outReal[rev] = real[i];
    outImag[rev] = imag[i];
  }

  // Butterfly operations
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angle = -2 * Math.PI / size;

    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const cos = Math.cos(angle * j);
        const sin = Math.sin(angle * j);
        const tReal = cos * outReal[i + j + halfSize] - sin * outImag[i + j + halfSize];
        const tImag = sin * outReal[i + j + halfSize] + cos * outImag[i + j + halfSize];

        outReal[i + j + halfSize] = outReal[i + j] - tReal;
        outImag[i + j + halfSize] = outImag[i + j] - tImag;
        outReal[i + j] += tReal;
        outImag[i + j] += tImag;
      }
    }
  }

  return { real: outReal, imag: outImag };
}

/**
 * Compute power spectrum using FFT.
 * @param {number[]} signal - Input time series
 * @returns {{ frequencies: number[], magnitudes: number[], dominantFrequencies: Array }}
 */
export function fftSpectrum(signal) {
  const n = signal.length;
  if (n < 4) throw new Error('Need at least 4 data points for FFT');

  // Zero-pad to next power of 2
  const paddedLength = Math.pow(2, Math.ceil(Math.log2(n)));
  const real = new Array(paddedLength).fill(0);
  const imag = new Array(paddedLength).fill(0);

  // Remove mean (detrend)
  const m = mean(signal);
  for (let i = 0; i < n; i++) real[i] = signal[i] - m;

  // Apply Hanning window
  for (let i = 0; i < n; i++) {
    real[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
  }

  const result = fft(real, imag);

  // Compute magnitudes (only first half - Nyquist)
  const halfN = Math.floor(paddedLength / 2);
  const frequencies = [];
  const magnitudes = [];

  for (let i = 1; i < halfN; i++) {
    const freq = i / paddedLength;
    const mag = Math.sqrt(result.real[i] ** 2 + result.imag[i] ** 2) / n;
    frequencies.push(round(freq, 6));
    magnitudes.push(round(mag));
  }

  // Find dominant frequencies (peaks)
  const dominantFrequencies = [];
  const avgMag = mean(magnitudes);

  for (let i = 1; i < magnitudes.length - 1; i++) {
    if (magnitudes[i] > magnitudes[i - 1] &&
        magnitudes[i] > magnitudes[i + 1] &&
        magnitudes[i] > avgMag * 2) {
      const period = 1 / frequencies[i];
      dominantFrequencies.push({
        frequency: frequencies[i],
        magnitude: magnitudes[i],
        period: round(period, 2),
        periodLabel: period > 1 ? `${round(period, 1)} time units` : `${round(1 / frequencies[i], 1)} time units`,
      });
    }
  }

  // Sort by magnitude
  dominantFrequencies.sort((a, b) => b.magnitude - a.magnitude);

  return {
    frequencies,
    magnitudes,
    dominantFrequencies: dominantFrequencies.slice(0, 10),
    signalLength: n,
    paddedLength,
  };
}

/**
 * Full FFT seasonality analysis on dataset.
 * @param {string[]} headers
 * @param {Array} rows
 * @param {object} options - { valueColumn, dateColumn }
 */
export function fftAnalysis(headers, rows, options = {}) {
  const { valueColumn, dateColumn } = options;

  if (!valueColumn) throw new Error('valueColumn is required');

  let signal = [];
  if (dateColumn) {
    const sorted = [...rows]
      .map(r => ({ date: new Date(r[dateColumn]), value: Number(r[valueColumn]) }))
      .filter(r => !isNaN(r.date.getTime()) && !isNaN(r.value))
      .sort((a, b) => a.date - b.date);
    signal = sorted.map(r => r.value);
  } else {
    signal = rows.map(r => Number(r[valueColumn])).filter(v => !isNaN(v));
  }

  if (signal.length < 4) throw new Error('Not enough valid values for FFT');

  const result = fftSpectrum(signal);

  // Estimate primary seasonality
  const primarySeason = result.dominantFrequencies[0];
  const estimatedSeasonLength = primarySeason ? Math.round(primarySeason.period) : null;

  return {
    ...result,
    valueColumn,
    dateColumn,
    estimatedSeasonLength,
    seasonalitySummary: primarySeason
      ? `Dominant period: ${primarySeason.period} time units (strength: ${primarySeason.magnitude})`
      : 'No clear seasonality detected',
  };
}
