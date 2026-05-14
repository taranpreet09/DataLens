/**
 * Advanced ML Routes (Python-backed)
 * SHAP, Auto-ML (FLAML), Prophet, DBSCAN, PCA, XGBoost/LightGBM, Cross-Correlation
 */

import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import Dataset from '../models/Dataset.js';
import { readAllRows, stratifiedSample } from '../services/fileParser.js';
import {
  isPythonAvailable,
  shapExplanations,
  autoML,
  prophetForecast,
  dbscanClustering,
  pcaFull,
  xgbImportance,
  crossCorrelation,
} from '../services/pythonBridge.js';

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

// ─── Middleware: Check Python service availability ────────────────────────────
async function requirePython(req, res, next) {
  const available = await isPythonAvailable();
  if (!available) {
    return res.status(503).json({
      message: 'Python analytics service is not running.',
      hint: 'Start it with: cd python_service && uvicorn main:app --port 8000',
    });
  }
  next();
}

router.use(requirePython);

// ═══════════════════════════════════════════════════════════════════════════════
// 24. SHAP EXPLANATIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/shap', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const { targetColumn, taskType, maxSamples } = req.body;
    if (!targetColumn) return res.status(400).json({ message: 'targetColumn is required.' });

    const rows = await getDatasetRows(dataset, maxSamples || 500);

    const t0 = performance.now();
    const result = await shapExplanations(dataset.headers, rows, {
      targetColumn,
      taskType,
      maxSamples: maxSamples || 500,
    });
    const executionTime = Math.round(performance.now() - t0);

    res.json({ ...result, executionTime });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 25. AUTO-ML PIPELINE (FLAML)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/automl', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const { targetColumn, taskType, timeBudget, metric } = req.body;
    if (!targetColumn) return res.status(400).json({ message: 'targetColumn is required.' });

    const rows = await getDatasetRows(dataset, 50000);

    const t0 = performance.now();
    const result = await autoML(dataset.headers, rows, {
      targetColumn,
      taskType,
      timeBudget: timeBudget || 60,
      metric,
    });
    const executionTime = Math.round(performance.now() - t0);

    res.json({ ...result, executionTime });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 26. PROPHET FORECASTING
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/prophet', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const {
      dateColumn, valueColumn, forecastPeriods,
      includeHolidays, country, changepointPriorScale, seasonalityMode,
    } = req.body;

    if (!dateColumn || !valueColumn) {
      return res.status(400).json({ message: 'dateColumn and valueColumn are required.' });
    }

    const rows = await getDatasetRows(dataset, 100000);

    const t0 = performance.now();
    const result = await prophetForecast(dataset.headers, rows, {
      dateColumn,
      valueColumn,
      forecastPeriods: forecastPeriods || 30,
      includeHolidays: includeHolidays !== false,
      country: country || 'US',
      changepointPriorScale: changepointPriorScale || 0.05,
      seasonalityMode: seasonalityMode || 'additive',
    });
    const executionTime = Math.round(performance.now() - t0);

    res.json({ ...result, executionTime });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 27. DBSCAN DENSITY-BASED CLUSTERING
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/dbscan', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const { columns, eps, minSamples, metric } = req.body;

    const rows = await getDatasetRows(dataset, 50000);

    const t0 = performance.now();
    const result = await dbscanClustering(dataset.headers, rows, {
      columns,
      eps: eps || null,
      minSamples: minSamples || 5,
      metric: metric || 'euclidean',
    });
    const executionTime = Math.round(performance.now() - t0);

    res.json({ ...result, executionTime });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 28. PCA / DIMENSIONALITY REDUCTION
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/pca', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const { columns, nComponents, includeBiplot } = req.body;

    const rows = await getDatasetRows(dataset, 50000);

    const t0 = performance.now();
    const result = await pcaFull(dataset.headers, rows, {
      columns,
      nComponents: nComponents || null,
      includeBiplot: includeBiplot !== false,
    });
    const executionTime = Math.round(performance.now() - t0);

    res.json({ ...result, executionTime });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 29. XGBOOST / LIGHTGBM FEATURE IMPORTANCE
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/xgb-importance', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const { targetColumn, model, taskType, nEstimators, maxDepth } = req.body;
    if (!targetColumn) return res.status(400).json({ message: 'targetColumn is required.' });

    const rows = await getDatasetRows(dataset, 50000);

    const t0 = performance.now();
    const result = await xgbImportance(dataset.headers, rows, {
      targetColumn,
      model: model || 'xgboost',
      taskType,
      nEstimators: nEstimators || 100,
      maxDepth: maxDepth || 6,
    });
    const executionTime = Math.round(performance.now() - t0);

    res.json({ ...result, executionTime });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 30. CROSS-CORRELATION WITH LAG DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/cross-correlation', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const { columnA, columnB, maxLag, normalize } = req.body;
    if (!columnA || !columnB) {
      return res.status(400).json({ message: 'columnA and columnB are required.' });
    }

    const rows = await getDatasetRows(dataset, 100000);

    const t0 = performance.now();
    const result = await crossCorrelation(dataset.headers, rows, {
      columnA,
      columnB,
      maxLag: maxLag || 50,
      normalize: normalize !== false,
    });
    const executionTime = Math.round(performance.now() - t0);

    res.json({ ...result, executionTime });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
