import { Router } from 'express';
import { z } from 'zod';
import authMiddleware from '../middleware/auth.js';
import Dataset from '../models/Dataset.js';
import { readAllRows, stratifiedSample } from '../services/fileParser.js';
import { computeAllStats } from '../services/statsEngine.js';
import { tTest, oneSampleTTest, chiSquareTest, anova, normalityTest, confidenceInterval, correlationSignificance } from '../services/statisticalTests.js';
import { inferSemanticTypes, findFuzzyDuplicates, generateValidationRules, detectColumnDependencies } from '../services/dataQuality.js';
import { isPythonAvailable, imputeMissing, clusterData, pcaReduce, featureImportance } from '../services/pythonBridge.js';
import { cacheGet, cacheSet } from '../config/redis.js';

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

// ─── POST /:id/recompute — Recompute stats ───────────────────────────────────
router.post('/:id/recompute', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });
    if (dataset.status !== 'ready') return res.status(400).json({ message: 'Dataset is not ready.' });

    const rows = await getDatasetRows(dataset);
    const stats = computeAllStats(dataset.headers, rows);
    await Dataset.findByIdAndUpdate(dataset._id, { stats });
    await cacheSet(`stats:${dataset._id}`, stats, 3600);

    res.json({ stats });
  } catch (err) {
    console.error('Recompute error:', err);
    res.status(500).json({ message: 'Could not recompute stats.' });
  }
});

// ─── GET /:id/stats — Get cached stats ───────────────────────────────────────
router.get('/:id/stats', async (req, res) => {
  try {
    const cacheKey = `stats:${req.params.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ stats: cached, cached: true });

    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId }).select('stats');
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    if (dataset.stats) await cacheSet(cacheKey, dataset.stats, 3600);
    res.json({ stats: dataset.stats, cached: false });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch stats.' });
  }
});

// ─── GET /:id/sample — Get sample rows ───────────────────────────────────────
router.get('/:id/sample', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const sampleSize = Math.min(1000, parseInt(req.query.size) || 100);
    let rows;
    if (dataset.parsedFilePath) {
      rows = await stratifiedSample(dataset.parsedFilePath, sampleSize, dataset.rowCount);
    } else if (dataset.rows) {
      rows = dataset.rows.slice(0, sampleSize);
    } else {
      rows = [];
    }

    res.json({ rows, sampleSize: rows.length, totalRows: dataset.rowCount });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch sample.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2: Statistical Tests & Data Quality
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /:id/test/ttest — Two-sample t-test ─────────────────────────────────
router.post('/:id/test/ttest', async (req, res) => {
  try {
    const { numericColumn, groupColumn, group1Value, group2Value } = req.body;
    if (!numericColumn || !groupColumn) {
      return res.status(400).json({ message: 'numericColumn and groupColumn are required.' });
    }

    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 100000);

    // Split into groups
    const groups = {};
    for (const row of rows) {
      const groupVal = String(row[groupColumn] ?? '');
      if (!groups[groupVal]) groups[groupVal] = [];
      const numVal = Number(row[numericColumn]);
      if (!isNaN(numVal)) groups[groupVal].push(numVal);
    }

    const groupKeys = Object.keys(groups).filter(k => groups[k].length >= 2);
    if (groupKeys.length < 2) {
      return res.status(400).json({ message: 'Need at least 2 groups with 2+ values each.' });
    }

    // Use specified groups or first two
    const g1Key = group1Value || groupKeys[0];
    const g2Key = group2Value || groupKeys[1];
    const g1 = groups[g1Key] || [];
    const g2 = groups[g2Key] || [];

    if (g1.length < 2 || g2.length < 2) {
      return res.status(400).json({ message: 'Each group needs at least 2 values.' });
    }

    const result = tTest(g1, g2);
    res.json({
      test: 'two_sample_ttest',
      column: numericColumn,
      groups: { [g1Key]: { n: g1.length, mean: g1.reduce((a, b) => a + b, 0) / g1.length }, [g2Key]: { n: g2.length, mean: g2.reduce((a, b) => a + b, 0) / g2.length } },
      result,
    });
  } catch (err) {
    res.status(500).json({ message: 'T-test failed: ' + err.message });
  }
});

// ─── POST /:id/test/anova — One-way ANOVA ────────────────────────────────────
router.post('/:id/test/anova', async (req, res) => {
  try {
    const { numericColumn, groupColumn } = req.body;
    if (!numericColumn || !groupColumn) {
      return res.status(400).json({ message: 'numericColumn and groupColumn are required.' });
    }

    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 100000);

    const groups = {};
    for (const row of rows) {
      const groupVal = String(row[groupColumn] ?? '');
      if (!groups[groupVal]) groups[groupVal] = [];
      const numVal = Number(row[numericColumn]);
      if (!isNaN(numVal)) groups[groupVal].push(numVal);
    }

    const validGroups = Object.entries(groups).filter(([, g]) => g.length >= 2);
    if (validGroups.length < 2) {
      return res.status(400).json({ message: 'Need at least 2 groups with 2+ values.' });
    }

    const result = anova(validGroups.map(([, g]) => g));
    res.json({
      test: 'one_way_anova',
      column: numericColumn,
      groupColumn,
      groupNames: validGroups.map(([k]) => k),
      result,
    });
  } catch (err) {
    res.status(500).json({ message: 'ANOVA failed: ' + err.message });
  }
});

// ─── POST /:id/test/chi-square — Chi-square test ─────────────────────────────
router.post('/:id/test/chi-square', async (req, res) => {
  try {
    const { column1, column2 } = req.body;
    if (!column1 || !column2) {
      return res.status(400).json({ message: 'column1 and column2 are required.' });
    }

    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 100000);
    const col1Values = rows.map(r => r[column1]);
    const col2Values = rows.map(r => r[column2]);

    const result = chiSquareTest(col1Values, col2Values);
    if (!result) {
      return res.status(400).json({ message: 'Could not perform chi-square test. Need 2+ categories in each column and 10+ rows.' });
    }

    res.json({ test: 'chi_square', column1, column2, result });
  } catch (err) {
    res.status(500).json({ message: 'Chi-square test failed: ' + err.message });
  }
});

// ─── POST /:id/test/normality — Normality test ───────────────────────────────
router.post('/:id/test/normality', async (req, res) => {
  try {
    const { column } = req.body;
    if (!column) return res.status(400).json({ message: 'column is required.' });

    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 100000);
    const values = rows.map(r => Number(r[column])).filter(v => !isNaN(v));

    if (values.length < 8) {
      return res.status(400).json({ message: 'Need at least 8 numeric values.' });
    }

    const result = normalityTest(values);
    const ci = confidenceInterval(values);

    res.json({ test: 'normality', column, n: values.length, result, confidenceInterval: ci });
  } catch (err) {
    res.status(500).json({ message: 'Normality test failed: ' + err.message });
  }
});

// ─── POST /:id/test/correlation — Correlation significance ───────────────────
router.post('/:id/test/correlation', async (req, res) => {
  try {
    const { column1, column2 } = req.body;
    if (!column1 || !column2) {
      return res.status(400).json({ message: 'column1 and column2 are required.' });
    }

    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 100000);

    // Compute correlation
    const pairs = rows
      .map(r => [Number(r[column1]), Number(r[column2])])
      .filter(([a, b]) => !isNaN(a) && !isNaN(b));

    if (pairs.length < 5) {
      return res.status(400).json({ message: 'Need at least 5 paired numeric values.' });
    }

    const xs = pairs.map(p => p[0]);
    const ys = pairs.map(p => p[1]);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const dx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0));
    const dy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
    const r = dx && dy ? num / (dx * dy) : 0;

    const result = correlationSignificance(r, pairs.length);

    res.json({ test: 'correlation_significance', column1, column2, n: pairs.length, result });
  } catch (err) {
    res.status(500).json({ message: 'Correlation test failed: ' + err.message });
  }
});

// ─── GET /:id/quality/types — Smart type inference ───────────────────────────
router.get('/:id/quality/types', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 500);
    const types = inferSemanticTypes(dataset.headers, rows);

    res.json({ types });
  } catch (err) {
    res.status(500).json({ message: 'Type inference failed: ' + err.message });
  }
});

// ─── GET /:id/quality/duplicates — Fuzzy duplicate detection ─────────────────
router.get('/:id/quality/duplicates', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const threshold = parseFloat(req.query.threshold) || 0.15;
    const rows = await getDatasetRows(dataset, 10000);
    const result = findFuzzyDuplicates(rows, dataset.headers, threshold);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Duplicate detection failed: ' + err.message });
  }
});

// ─── GET /:id/quality/rules — Auto-generated validation rules ────────────────
router.get('/:id/quality/rules', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 5000);
    const columnTypes = dataset.stats?.columnTypes || {};
    const rules = generateValidationRules(dataset.headers, rows, columnTypes);

    res.json({ rules, totalRules: rules.length });
  } catch (err) {
    res.status(500).json({ message: 'Rule generation failed: ' + err.message });
  }
});

// ─── GET /:id/quality/dependencies — Column dependency detection ─────────────
router.get('/:id/quality/dependencies', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 5000);
    const dependencies = detectColumnDependencies(dataset.headers, rows);

    res.json({ dependencies, total: dependencies.length });
  } catch (err) {
    res.status(500).json({ message: 'Dependency detection failed: ' + err.message });
  }
});

// ─── POST /:id/confidence-intervals — Confidence intervals for all numeric ───
router.post('/:id/confidence-intervals', async (req, res) => {
  try {
    const { level } = req.body;
    const confidenceLevel = level || 0.95;

    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 100000);
    const results = {};

    for (const h of dataset.headers) {
      const values = rows.map(r => Number(r[h])).filter(v => !isNaN(v));
      if (values.length >= 2) {
        results[h] = confidenceInterval(values, confidenceLevel);
      }
    }

    res.json({ intervals: results, level: confidenceLevel });
  } catch (err) {
    res.status(500).json({ message: 'Confidence interval computation failed: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Python Service Endpoints (proxied)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /:id/ml/impute — Missing value imputation (Python) ─────────────────
router.post('/:id/ml/impute', async (req, res) => {
  try {
    const available = await isPythonAvailable();
    if (!available) {
      return res.status(503).json({ message: 'Python analytics service is not running.' });
    }

    const { strategy, columns } = req.body;
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 20000);
    const result = await imputeMissing(dataset.headers, rows, strategy || 'knn', columns);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Imputation failed: ' + err.message });
  }
});

// ─── POST /:id/ml/cluster — Clustering (Python) ──────────────────────────────
router.post('/:id/ml/cluster', async (req, res) => {
  try {
    const available = await isPythonAvailable();
    if (!available) {
      return res.status(503).json({ message: 'Python analytics service is not running.' });
    }

    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 20000);
    const result = await clusterData(dataset.headers, rows, req.body);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Clustering failed: ' + err.message });
  }
});

// ─── POST /:id/ml/pca — PCA (Python) ─────────────────────────────────────────
router.post('/:id/ml/pca', async (req, res) => {
  try {
    const available = await isPythonAvailable();
    if (!available) {
      return res.status(503).json({ message: 'Python analytics service is not running.' });
    }

    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 20000);
    const result = await pcaReduce(dataset.headers, rows, req.body);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'PCA failed: ' + err.message });
  }
});

// ─── POST /:id/ml/feature-importance — Feature importance (Python) ───────────
router.post('/:id/ml/feature-importance', async (req, res) => {
  try {
    const available = await isPythonAvailable();
    if (!available) {
      return res.status(503).json({ message: 'Python analytics service is not running.' });
    }

    const { targetColumn } = req.body;
    if (!targetColumn) return res.status(400).json({ message: 'targetColumn is required.' });

    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const rows = await getDatasetRows(dataset, 20000);
    const result = await featureImportance(dataset.headers, rows, targetColumn);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Feature importance failed: ' + err.message });
  }
});

// ─── GET /python/status — Check Python service availability ──────────────────
router.get('/python/status', async (req, res) => {
  const available = await isPythonAvailable();
  res.json({ available, url: process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000' });
});

export default router;
