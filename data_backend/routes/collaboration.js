/**
 * Collaboration Routes
 * Shareable report links, Excel export, Dataset comparison
 */

import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import Dataset from '../models/Dataset.js';
import { readAllRows, stratifiedSample } from '../services/fileParser.js';
import crypto from 'crypto';

const router = Router();

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
// #39 — SHAREABLE REPORT LINKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/phase6/:id/share — Generate a public share token for a dataset report
 * Requires auth (owner only)
 */
router.post('/:id/share', authMiddleware, async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    // Generate a unique share token if not already present
    if (!dataset.shareToken) {
      dataset.shareToken = crypto.randomBytes(16).toString('hex');
      dataset.shareEnabled = true;
      await dataset.save();
    } else {
      // Re-enable sharing if it was disabled
      dataset.shareEnabled = true;
      await dataset.save();
    }

    res.json({
      shareToken: dataset.shareToken,
      shareUrl: `/shared/${dataset.shareToken}`,
      enabled: true,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * DELETE /api/phase6/:id/share — Revoke sharing for a dataset
 * Requires auth (owner only)
 */
router.delete('/:id/share', authMiddleware, async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    dataset.shareEnabled = false;
    await dataset.save();

    res.json({ enabled: false });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * GET /api/phase6/shared/:token — Public endpoint to fetch a shared report
 * No auth required
 */
router.get('/shared/:token', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({
      shareToken: req.params.token,
      shareEnabled: true,
    });

    if (!dataset) {
      return res.status(404).json({ message: 'Shared report not found or link has been revoked.' });
    }

    // Return a read-only view of the dataset (no raw rows for security)
    const sampleRows = await getDatasetRows(dataset, 100);

    res.json({
      name: dataset.name,
      rowCount: dataset.rowCount,
      headers: dataset.headers,
      stats: dataset.stats,
      narrative: dataset.narrative,
      edaReport: dataset.edaReport,
      sampleRows,
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// #40 — EXPORT TO EXCEL WITH MULTIPLE SHEETS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/phase6/:id/export-excel — Generate Excel workbook with multiple sheets
 * Returns JSON with sheet data (client-side XLSX generation via SheetJS)
 * Requires auth
 */
router.post('/:id/export-excel', authMiddleware, async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const { includeRawData, includeStats, includeQuality, maxRows } = req.body;
    const rows = await getDatasetRows(dataset, maxRows || 50000);

    const sheets = [];

    // Sheet 1: Raw Data
    if (includeRawData !== false) {
      sheets.push({
        name: 'Data',
        headers: dataset.headers,
        rows: rows.map(r => dataset.headers.map(h => r[h] ?? '')),
      });
    }

    // Sheet 2: Summary Statistics
    if (includeStats !== false && dataset.stats) {
      const numericCols = dataset.stats.numericColumns || [];
      const statHeaders = ['Column', 'Count', 'Mean', 'Median', 'Min', 'Max', 'StdDev', 'Variance', 'Skewness', 'IQR', 'CV%'];
      const statRows = numericCols.map(col => {
        const s = dataset.stats.numericStats?.[col];
        if (!s) return [col, '', '', '', '', '', '', '', '', '', ''];
        return [col, s.count, s.mean, s.median, s.min, s.max, s.stdDev, s.variance, s.skewness, s.iqr, s.cv];
      });
      sheets.push({ name: 'Statistics', headers: statHeaders, rows: statRows });
    }

    // Sheet 3: Data Quality
    if (includeQuality !== false && dataset.stats?.qualityFlags) {
      const qf = dataset.stats.qualityFlags;
      const qualityHeaders = ['Metric', 'Value'];
      const qualityRows = [
        ['Total Rows', dataset.rowCount],
        ['Duplicate Rows', qf.duplicateRowCount],
        ['Duplicate %', qf.duplicatePct],
        ['Total Null Cells', qf.totalNullCount],
        ['Null %', qf.nullPct],
        ['Empty Rows', qf.emptyRowCount],
        ['Quality Score', dataset.stats.qualityScore],
      ];

      // Per-column null counts
      if (qf.nullCountByColumn) {
        qualityRows.push(['', '']);
        qualityRows.push(['Column', 'Null Count']);
        for (const [col, count] of Object.entries(qf.nullCountByColumn)) {
          if (count > 0) qualityRows.push([col, count]);
        }
      }

      sheets.push({ name: 'Quality', headers: qualityHeaders, rows: qualityRows });
    }

    // Sheet 4: Correlations
    if (dataset.stats?.correlationMatrix && dataset.stats.numericColumns?.length > 1) {
      const cols = dataset.stats.numericColumns;
      const corrHeaders = ['', ...cols];
      const corrRows = cols.map((col, i) => [
        col,
        ...cols.map((_, j) => dataset.stats.correlationMatrix[i]?.[j] ?? ''),
      ]);
      sheets.push({ name: 'Correlations', headers: corrHeaders, rows: corrRows });
    }

    // Sheet 5: Column Types
    if (dataset.stats?.columnTypes) {
      const typeHeaders = ['Column', 'Type'];
      const typeRows = dataset.headers.map(h => [h, dataset.stats.columnTypes[h] || 'unknown']);
      sheets.push({ name: 'Column Types', headers: typeHeaders, rows: typeRows });
    }

    res.json({
      filename: `${dataset.name.replace(/\.[^.]+$/, '')}-export.xlsx`,
      sheets,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/phase6/:id/compare — Compare two datasets side-by-side
 * Requires auth
 */
router.post('/:id/compare', authMiddleware, async (req, res) => {
  try {
    const { compareToId } = req.body;
    if (!compareToId) return res.status(400).json({ message: 'compareToId is required.' });

    const [datasetA, datasetB] = await Promise.all([
      Dataset.findOne({ _id: req.params.id, userId: req.userId }),
      Dataset.findOne({ _id: compareToId, userId: req.userId }),
    ]);

    if (!datasetA) return res.status(404).json({ message: 'Primary dataset not found.' });
    if (!datasetB) return res.status(404).json({ message: 'Comparison dataset not found.' });

    // Build comparison summary
    const comparison = {
      datasetA: {
        id: datasetA._id,
        name: datasetA.name,
        rowCount: datasetA.rowCount,
        columnCount: datasetA.headers?.length || 0,
        headers: datasetA.headers,
        stats: datasetA.stats,
      },
      datasetB: {
        id: datasetB._id,
        name: datasetB.name,
        rowCount: datasetB.rowCount,
        columnCount: datasetB.headers?.length || 0,
        headers: datasetB.headers,
        stats: datasetB.stats,
      },
      commonColumns: datasetA.headers?.filter(h => datasetB.headers?.includes(h)) || [],
      uniqueToA: datasetA.headers?.filter(h => !datasetB.headers?.includes(h)) || [],
      uniqueToB: datasetB.headers?.filter(h => !datasetA.headers?.includes(h)) || [],
    };

    // Compare numeric stats for common columns
    const numericComparison = {};
    for (const col of comparison.commonColumns) {
      const statsA = datasetA.stats?.numericStats?.[col];
      const statsB = datasetB.stats?.numericStats?.[col];
      if (statsA && statsB) {
        numericComparison[col] = {
          a: { mean: statsA.mean, median: statsA.median, stdDev: statsA.stdDev, min: statsA.min, max: statsA.max },
          b: { mean: statsB.mean, median: statsB.median, stdDev: statsB.stdDev, min: statsB.min, max: statsB.max },
          diff: {
            meanDiff: statsA.mean - statsB.mean,
            meanPctChange: statsB.mean !== 0 ? ((statsA.mean - statsB.mean) / Math.abs(statsB.mean) * 100) : null,
          },
        };
      }
    }
    comparison.numericComparison = numericComparison;

    res.json(comparison);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
