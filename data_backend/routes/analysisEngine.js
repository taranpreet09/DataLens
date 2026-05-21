/**
 * Analysis Engine Routes
 * K-Means, Regression, Decision Trees, Isolation Forest, Holt-Winters, FFT
 */

import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import Dataset from '../models/Dataset.js';
import { readAllRows, stratifiedSample } from '../services/fileParser.js';
import {
  kMeansAnalysis,
  regressionAnalysis,
  decisionTreeImportance,
  isolationForestAnalysis,
  holtWintersAnalysis,
  fftAnalysis,
} from '../services/analysisEngine.js';

const router = Router();
router.use(authMiddleware);

// ─── Helper: Get rows for a dataset ──────────────────────────────────────────
async function getDatasetRows(dataset, maxRows = 50000) {
  if (dataset.parsedFilePath) {
    return dataset.rowCount > maxRows
      ? await stratifiedSample(dataset.parsedFilePath, maxRows, dataset.rowCount)
      : await readAllRows(dataset.parsedFilePath);
  }
  if (dataset.rows && Array.isArray(dataset.rows)) {
    return dataset.rows.slice(0, maxRows);
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// K-MEANS CLUSTERING
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/kmeans', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 50000);
    const { columns, k, autoSelect, maxK } = req.body;

    const t0 = performance.now();
    const result = kMeansAnalysis(dataset.headers, rows, { columns, k, autoSelect, maxK });
    const executionTime = Math.round(performance.now() - t0);

    // Generate 2D projected points for scatter plot visualization
    // Use first two columns used in clustering as X/Y axes
    const projectedPoints = [];
    const assignments = [];
    const numCols = result.columnsUsed;
    if (numCols.length >= 2) {
      for (let i = 0; i < rows.length; i++) {
        if (result.labels[i] >= 0) {
          const x = Number(rows[i][numCols[0]]);
          const y = Number(rows[i][numCols[1]]);
          if (!isNaN(x) && !isNaN(y)) {
            projectedPoints.push([x, y]);
            assignments.push(result.labels[i]);
          }
        }
      }
    }

    // Build centroid coordinates for the 2D projection
    const clusterStatsWithCoords = {};
    for (const [cid, stat] of Object.entries(result.clusterStats)) {
      clusterStatsWithCoords[cid] = {
        ...stat,
        centroid: numCols.length >= 2
          ? [stat.centroid[numCols[0]], stat.centroid[numCols[1]]]
          : null,
      };
    }

    // Limit projected points for large datasets (max 2000 for performance)
    const maxPoints = 2000;
    let sampledProjected = projectedPoints;
    let sampledAssignments = assignments;
    if (projectedPoints.length > maxPoints) {
      const step = Math.ceil(projectedPoints.length / maxPoints);
      sampledProjected = projectedPoints.filter((_, i) => i % step === 0);
      sampledAssignments = assignments.filter((_, i) => i % step === 0);
    }

    res.json({
      ...result,
      projectedPoints: sampledProjected,
      assignments: sampledAssignments,
      clusterStats: clusterStatsWithCoords,
      executionTime,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSION
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/regression', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 50000);
    const { xColumn, yColumn, xColumns, degree, type } = req.body;

    const t0 = performance.now();
    const result = regressionAnalysis(dataset.headers, rows, { xColumn, yColumn, xColumns, degree, type });
    const executionTime = Math.round(performance.now() - t0);

    res.json({ ...result, executionTime });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DECISION TREE FEATURE IMPORTANCE
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/feature-importance', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 50000);
    const { targetColumn, criterion, maxDepth, minSamples } = req.body;

    const t0 = performance.now();
    const result = decisionTreeImportance(dataset.headers, rows, { targetColumn, criterion, maxDepth, minSamples });
    const executionTime = Math.round(performance.now() - t0);

    // Don't send the full tree in response (too large) — send summary
    const { tree, ...summary } = result;
    res.json({ ...summary, treeDepth: getTreeDepth(tree), executionTime });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

function getTreeDepth(node) {
  if (!node || node.leaf) return 0;
  return 1 + Math.max(getTreeDepth(node.left), getTreeDepth(node.right));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ISOLATION FOREST ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/anomaly-detection', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 50000);
    const { columns, nTrees, contamination } = req.body;

    const t0 = performance.now();
    const result = isolationForestAnalysis(dataset.headers, rows, { columns, nTrees, contamination });
    const executionTime = Math.round(performance.now() - t0);

    // Don't send all scores for large datasets
    const scoreSummary = {
      mean: round(mean(result.scores.filter(s => s > 0))),
      max: round(result.scores.reduce((a, b) => Math.max(a, b), -Infinity)),
      min: round(result.scores.filter(s => s > 0).reduce((a, b) => Math.min(a, b), Infinity)),
    };

    res.json({
      ...result,
      scores: result.scores.length > 5000 ? undefined : result.scores,
      scoreSummary,
      executionTime,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function round(n, d = 4) { const f = 10 ** d; return Math.round(n * f) / f; }

// ═══════════════════════════════════════════════════════════════════════════════
// HOLT-WINTERS FORECASTING
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/forecast', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 100000);
    const { valueColumn, dateColumn, seasonLength, forecastPeriods, multiplicative } = req.body;

    const t0 = performance.now();
    const result = holtWintersAnalysis(dataset.headers, rows, {
      valueColumn, dateColumn, seasonLength, forecastPeriods, multiplicative,
    });
    const executionTime = Math.round(performance.now() - t0);

    // Extract original values and dates for the forecast chart
    let originalValues = [];
    let dates = [];
    if (dateColumn) {
      const sorted = [...rows]
        .map(r => ({ date: r[dateColumn], value: Number(r[valueColumn]) }))
        .filter(r => !isNaN(Number(r.value)))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      originalValues = sorted.map(r => r.value);
      dates = sorted.map(r => r.date);
    } else {
      originalValues = rows.map(r => Number(r[valueColumn])).filter(v => !isNaN(v));
    }

    // Limit to last 200 points for chart performance
    const maxChartPoints = 200;
    if (originalValues.length > maxChartPoints) {
      const start = originalValues.length - maxChartPoints;
      originalValues = originalValues.slice(start);
      dates = dates.length > 0 ? dates.slice(start) : [];
      result.fitted = result.fitted?.slice(start);
    }

    res.json({
      ...result,
      originalValues,
      dates,
      fittedValues: result.fitted,
      executionTime,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FFT SEASONALITY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/fft', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 100000);
    const { valueColumn, dateColumn } = req.body;

    const t0 = performance.now();
    const result = fftAnalysis(dataset.headers, rows, { valueColumn, dateColumn });
    const executionTime = Math.round(performance.now() - t0);

    res.json({ ...result, executionTime });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
