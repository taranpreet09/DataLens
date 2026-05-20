/**
 * Tool Registry — Intelligence Layer
 *
 * Maps tool IDs to Zod schemas, descriptions, column-reference helpers,
 * and invoke adapters that call into the existing analysis handlers.
 *
 * Public API:
 *   dispatch(intent, dataset, userId) → { result }
 *   catalogue()                       → [{ tool, description, parameterSchemaJson }]
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { computeAllStats } from './statsEngine.js';
import {
  regressionAnalysis,
  kMeansAnalysis,
  decisionTreeImportance,
  isolationForestAnalysis,
  holtWintersAnalysis,
  fftAnalysis,
} from './analysisEngine.js';
import {
  tTest,
  oneSampleTTest,
  anova,
  chiSquareTest,
  normalityTest,
  confidenceInterval,
  mannWhitneyU,
  pairedTTest,
} from './statisticalTests.js';
import { stratifiedSample } from './fileParser.js';

// ─── Column reference primitive ───────────────────────────────────────────────

const ColumnRef = z.string().min(1);

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Load rows from a dataset, preferring the on-disk JSONL file when available.
 * Falls back to in-memory rows, then returns [] if neither is present.
 */
async function getDatasetRows(dataset, maxRows = 50000) {
  if (dataset.parsedFilePath) {
    return stratifiedSample(dataset.parsedFilePath, maxRows, dataset.rowCount || 0);
  }
  if (Array.isArray(dataset.rows)) {
    return dataset.rows.slice(0, maxRows);
  }
  return [];
}

/**
 * Extract numeric values for a column from rows, filtering out NaN.
 */
function getNumericValues(rows, col) {
  return rows.map(r => Number(r[col])).filter(v => !isNaN(v));
}

/**
 * Extract non-null string/mixed values for a column from rows.
 */
function getStringValues(rows, col) {
  return rows.map(r => r[col]).filter(v => v != null);
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOL_SCHEMAS = {
  descriptive_stats: {
    schema: z.object({
      columns: z.array(ColumnRef).optional(),
    }),
    description: 'Compute descriptive statistics (mean, median, std dev, quartiles, etc.) for numeric columns and frequency distributions for categorical columns.',
    requiredColumns(params) {
      return params.columns || [];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      return computeAllStats(dataset.headers, rows);
    },
  },

  correlation: {
    schema: z.object({
      columns: z.array(ColumnRef).min(2).optional(),
      threshold: z.number().min(0).max(1).optional(),
    }),
    description: 'Compute the Pearson correlation matrix and ranked correlation pairs between numeric columns. Optionally filter to a subset of columns or apply a minimum |r| threshold.',
    requiredColumns(params) {
      return params.columns || [];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      const stats = computeAllStats(dataset.headers, rows);
      return {
        correlationMatrix: stats.correlationMatrix,
        correlationPairs: stats.correlationPairs,
      };
    },
  },

  regression: {
    schema: z.object({
      type: z.enum(['linear', 'polynomial', 'multiple']).default('linear'),
      xColumn: ColumnRef.optional(),
      xColumns: z.array(ColumnRef).optional(),
      yColumn: ColumnRef,
      degree: z.number().int().min(1).max(5).optional(),
    }),
    description: 'Fit a regression model (linear, polynomial, or multiple linear) to predict a target column from one or more predictor columns.',
    requiredColumns(params) {
      if (params.type === 'multiple') {
        return [...(params.xColumns || []), params.yColumn].filter(Boolean);
      }
      return [params.xColumn, params.yColumn].filter(Boolean);
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      return regressionAnalysis(dataset.headers, rows, params);
    },
  },

  kmeans: {
    schema: z.object({
      columns: z.array(ColumnRef).optional(),
      k: z.number().int().min(2).max(20).optional(),
      autoSelect: z.boolean().optional(),
      maxK: z.number().int().min(2).max(20).optional(),
    }),
    description: 'Cluster rows using k-means. Supports automatic k selection via the elbow method.',
    requiredColumns(params) {
      return params.columns || [];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      return kMeansAnalysis(dataset.headers, rows, params);
    },
  },

  feature_importance: {
    schema: z.object({
      targetColumn: ColumnRef,
      criterion: z.enum(['gini', 'entropy', 'variance']).optional(),
      maxDepth: z.number().int().min(1).max(20).optional(),
    }),
    description: 'Rank feature importance using a decision tree model. Identifies which columns most strongly predict the target column.',
    requiredColumns(params) {
      return [params.targetColumn];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      return decisionTreeImportance(dataset.headers, rows, params);
    },
  },

  anomaly_detection: {
    schema: z.object({
      columns: z.array(ColumnRef).optional(),
      contamination: z.number().min(0.001).max(0.5).optional(),
      nTrees: z.number().int().min(10).max(500).optional(),
    }),
    description: 'Detect anomalous rows using an Isolation Forest algorithm. Returns anomaly scores and flags outlier rows.',
    requiredColumns(params) {
      return params.columns || [];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      return isolationForestAnalysis(dataset.headers, rows, params);
    },
  },

  forecast: {
    schema: z.object({
      dateColumn: ColumnRef,
      valueColumn: ColumnRef,
      seasonLength: z.number().int().min(2).max(365).optional(),
      forecastPeriods: z.number().int().min(1).max(365).optional(),
    }),
    description: 'Forecast future values of a time series using Holt-Winters exponential smoothing. Requires a date column and a numeric value column.',
    requiredColumns(params) {
      return [params.dateColumn, params.valueColumn];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      return holtWintersAnalysis(dataset.headers, rows, params);
    },
  },

  fft: {
    schema: z.object({
      column: ColumnRef,
      sampleRate: z.number().positive().optional(),
    }),
    description: 'Apply a Fast Fourier Transform to a numeric column to identify dominant frequencies and periodicity.',
    requiredColumns(params) {
      return [params.column];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      return fftAnalysis(dataset.headers, rows, params);
    },
  },

  t_test: {
    schema: z.object({
      column: ColumnRef,
      groupColumn: ColumnRef.optional(),
      hypothesizedMean: z.number().optional(),
    }),
    description: 'Perform a t-test. With a groupColumn, runs a two-sample Welch t-test comparing the two groups. With a hypothesizedMean (and no groupColumn), runs a one-sample t-test.',
    requiredColumns(params) {
      return [params.column, params.groupColumn].filter(Boolean);
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      const values = getNumericValues(rows, params.column);

      if (params.groupColumn) {
        // Two-sample t-test: split by group column
        const groupMap = {};
        for (const row of rows) {
          const groupKey = String(row[params.groupColumn]);
          const val = Number(row[params.column]);
          if (!isNaN(val)) {
            if (!groupMap[groupKey]) groupMap[groupKey] = [];
            groupMap[groupKey].push(val);
          }
        }
        const groups = Object.values(groupMap);
        if (groups.length < 2) return null;
        return tTest(groups[0], groups[1]);
      }

      // One-sample t-test
      return oneSampleTTest(values, params.hypothesizedMean ?? 0);
    },
  },

  anova: {
    schema: z.object({
      valueColumn: ColumnRef,
      groupColumn: ColumnRef,
    }),
    description: 'Perform a one-way ANOVA to test whether the means of a numeric column differ significantly across groups defined by a categorical column.',
    requiredColumns(params) {
      return [params.valueColumn, params.groupColumn];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      // Group rows by groupColumn, extract numeric values per group
      const groupMap = {};
      for (const row of rows) {
        const groupKey = String(row[params.groupColumn]);
        const val = Number(row[params.valueColumn]);
        if (!isNaN(val)) {
          if (!groupMap[groupKey]) groupMap[groupKey] = [];
          groupMap[groupKey].push(val);
        }
      }
      const groups = Object.values(groupMap);
      return anova(groups);
    },
  },

  chi_square: {
    schema: z.object({
      columnA: ColumnRef,
      columnB: ColumnRef,
    }),
    description: 'Perform a chi-square test of independence between two categorical columns.',
    requiredColumns(params) {
      return [params.columnA, params.columnB];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      const col1Values = getStringValues(rows, params.columnA);
      const col2Values = getStringValues(rows, params.columnB);
      return chiSquareTest(col1Values, col2Values);
    },
  },

  normality: {
    schema: z.object({
      column: ColumnRef,
    }),
    description: 'Test whether a numeric column follows a normal distribution using the D\'Agostino-Pearson omnibus test.',
    requiredColumns(params) {
      return [params.column];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      const values = getNumericValues(rows, params.column);
      return normalityTest(values);
    },
  },

  confidence_intervals: {
    schema: z.object({
      column: ColumnRef,
      level: z.number().min(0.5).max(0.999).optional(),
    }),
    description: 'Compute a confidence interval for the mean of a numeric column at a specified confidence level (default 95%).',
    requiredColumns(params) {
      return [params.column];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      const values = getNumericValues(rows, params.column);
      return confidenceInterval(values, params.level ?? 0.95);
    },
  },

  mann_whitney: {
    schema: z.object({
      column: ColumnRef,
      groupColumn: ColumnRef,
    }),
    description: 'Perform a Mann-Whitney U test (non-parametric alternative to the t-test). Use when normality assumption is violated. Tests if two groups have different distributions.',
    requiredColumns(params) {
      return [params.column, params.groupColumn];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      const groupMap = {};
      for (const row of rows) {
        const groupKey = String(row[params.groupColumn]);
        const val = Number(row[params.column]);
        if (!isNaN(val)) {
          if (!groupMap[groupKey]) groupMap[groupKey] = [];
          groupMap[groupKey].push(val);
        }
      }
      const groups = Object.values(groupMap);
      if (groups.length < 2) return null;
      return mannWhitneyU(groups[0], groups[1]);
    },
  },

  paired_t_test: {
    schema: z.object({
      column1: ColumnRef,
      column2: ColumnRef,
    }),
    description: 'Perform a paired t-test to compare two related measurements (before/after, pre/post). Tests if the mean difference between paired observations is significantly different from zero.',
    requiredColumns(params) {
      return [params.column1, params.column2];
    },
    async invoke(dataset, userId, params) {
      const rows = await getDatasetRows(dataset);
      const before = [], after = [];
      for (const row of rows) {
        const v1 = Number(row[params.column1]);
        const v2 = Number(row[params.column2]);
        if (!isNaN(v1) && !isNaN(v2)) { before.push(v1); after.push(v2); }
      }
      if (before.length < 2) return null;
      return pairedTTest(before, after);
    },
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Dispatch an AnalysisIntent to the appropriate handler.
 *
 * Validation order:
 *   1. Unknown tool → throws error with code UNKNOWN_TOOL
 *   2. Zod parse failure → throws error with code INVALID_PARAMETERS (.issues attached)
 *   3. Required columns not in dataset.headers → throws error with code UNKNOWN_COLUMN
 *   4. invoke() → returns { result }
 *
 * @param {{ tool: string, parameters: object }} intent
 * @param {{ headers: string[], parsedFilePath?: string, rows?: object[], rowCount?: number }} dataset
 * @param {string} userId
 * @returns {Promise<{ result: unknown }>}
 */
export async function dispatch(intent, dataset, userId) {
  const entry = TOOL_SCHEMAS[intent.tool];
  if (!entry) {
    const err = new Error(`Unknown tool: ${intent.tool}`);
    err.code = 'UNKNOWN_TOOL';
    throw err;
  }

  // Zod validation
  const parsed = entry.schema.safeParse(intent.parameters ?? {});
  if (!parsed.success) {
    const err = new Error('Invalid parameters');
    err.code = 'INVALID_PARAMETERS';
    err.issues = parsed.error.issues;
    throw err;
  }

  const params = parsed.data;

  // Column existence check
  const required = entry.requiredColumns(params);
  const headers = dataset.headers || [];
  for (const col of required) {
    if (!headers.includes(col)) {
      const err = new Error(`Column not found in dataset: ${col}`);
      err.code = 'UNKNOWN_COLUMN';
      throw err;
    }
  }

  const result = await entry.invoke(dataset, userId, params);
  return { result };
}

/**
 * Return a compact catalogue of all registered tools for use in LLM prompts.
 *
 * @returns {Array<{ tool: string, description: string, parameterSchemaJson: object }>}
 */
export function catalogue() {
  return Object.entries(TOOL_SCHEMAS).map(([tool, entry]) => ({
    tool,
    description: entry.description,
    parameterSchemaJson: zodToJsonSchema(entry.schema),
  }));
}

export { TOOL_SCHEMAS };
