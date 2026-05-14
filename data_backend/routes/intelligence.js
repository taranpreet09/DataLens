/**
 * Intelligence Layer Routes
 *
 * All routes are mounted at /api/intelligence/* in server.js.
 * No "phase3", "phase4", or "phase5" tokens appear in this file.
 */

import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import Dataset from '../models/Dataset.js';
import { intelligenceConfig } from '../config/intelligence.js';
import { logEvent } from '../services/intelligenceLogger.js';

const router = Router();

// ─── Error code → HTTP status map ────────────────────────────────────────────

const CODE_TO_STATUS = {
  BEDROCK_NOT_CONFIGURED: 503,
  BEDROCK_TIMEOUT: 504,
  BEDROCK_ERROR: 502,
  TOKEN_BUDGET_EXCEEDED: 413,
  PAYLOAD_TOO_LARGE: 413,
  LLM_RATE_LIMITED: 429,
  INVALID_QUESTION_LENGTH: 400,
  INTENT_PARSE_ERROR: 502,
  UNKNOWN_TOOL: 422,
  INVALID_PARAMETERS: 422,
  UNKNOWN_COLUMN: 422,
  INCOMPLETE_NARRATIVE: 502,
  INSUFFICIENT_TEXT_DATA: 422,
  PYTHON_UNAVAILABLE: 503,
  INTELLIGENCE_DISABLED: 503,
  EDA_NOT_GENERATED: 404,
  INTERNAL_ERROR: 500,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Wrap an async route handler. Catches errors and responds with the
 * standard Intelligence Layer error envelope:
 *   { code, message, retryable, retryAfterSeconds? }
 */
export function wrap(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      const code = err.code || 'INTERNAL_ERROR';
      const status = CODE_TO_STATUS[code] || 500;
      const retryable = typeof err.retryable === 'boolean' ? err.retryable : false;

      const body = {
        code,
        message: err.message || 'An unexpected error occurred',
        retryable,
      };
      if (err.retryAfterSeconds != null) {
        body.retryAfterSeconds = err.retryAfterSeconds;
      }

      logEvent({
        event: 'intelligence.route.error',
        code,
        status,
        path: req.path,
        method: req.method,
      });

      res.status(status).json(body);
    }
  };
}

/**
 * Load a dataset by :datasetId scoped to the authenticated user.
 * Throws a 404-equivalent error if not found.
 */
export async function lookupDataset(req) {
  const dataset = await Dataset.findOne({
    _id: req.params.datasetId,
    userId: req.userId,
  });
  if (!dataset) {
    const err = new Error('Dataset not found');
    err.code = 'DATASET_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return dataset;
}

// ─── Disabled-mode short-circuit middleware ───────────────────────────────────

router.use((req, res, next) => {
  // The health endpoint always responds, even when the layer is disabled.
  if (req.path === '/health' || req.path === '/health/') return next();

  const cfg = intelligenceConfig();
  if (!cfg.enabled) {
    return res.status(503).json({
      code: 'INTELLIGENCE_DISABLED',
      message: 'Intelligence layer is disabled in this environment',
      retryable: false,
    });
  }
  next();
});

// ─── Health endpoint ──────────────────────────────────────────────────────────

router.get('/health', wrap(async (req, res) => {
  const cfg = intelligenceConfig();

  let bedrockStatus = 'disabled';
  let pythonStatus = 'error';
  let model = cfg.modelId;

  if (cfg.enabled) {
    if (!cfg.credentialsResolved) {
      bedrockStatus = 'error';
    } else {
      // Lazy import to avoid loading the Bedrock SDK when the layer is disabled.
      try {
        const { invokeModel } = await import('../services/bedrockClient.js');
        await invokeModel({
          feature: 'health',
          messages: [{ role: 'user', content: 'ping' }],
          datasetId: null,
          userId: null,
        });
        bedrockStatus = 'ok';
      } catch {
        bedrockStatus = 'error';
      }
    }

    try {
      const { isPythonAvailable } = await import('../services/pythonBridge.js');
      const available = await isPythonAvailable();
      pythonStatus = available ? 'ok' : 'error';
    } catch {
      pythonStatus = 'error';
    }
  }

  res.json({ bedrock: bedrockStatus, python: pythonStatus, model });
}));

// ─── Auth middleware applied to all remaining routes ─────────────────────────

router.use(authMiddleware);

// ─── 5a — Natural Language Query ─────────────────────────────────────────────

router.post('/:datasetId/nl-query', wrap(async (req, res) => {
  const dataset = await lookupDataset(req);
  const { question } = req.body;

  const { handleNlQuery } = await import('../services/nlQueryService.js');
  const result = await handleNlQuery({ dataset, userId: req.userId, question });

  res.json(result);
}));

// ─── 5b — Narrative Generation ───────────────────────────────────────────────

router.post('/:datasetId/narrative', wrap(async (req, res) => {
  const dataset = await lookupDataset(req);
  const { sections, tone } = req.body;

  const { generateNarrative } = await import('../services/narrativeService.js');
  const result = await generateNarrative({ dataset, userId: req.userId, sections, tone });

  res.json(result);
}));

// ─── 5c — Text NLP ───────────────────────────────────────────────────────────

router.post('/:datasetId/nlp/text', wrap(async (req, res) => {
  const dataset = await lookupDataset(req);
  const { column, options } = req.body;

  if (!column || !dataset.headers.includes(column)) {
    const err = new Error(`Column '${column}' not found in dataset`);
    err.code = 'UNKNOWN_COLUMN';
    throw err;
  }

  // Sample at most 5 000 rows for NLP.
  const { stratifiedSample, readAllRows } = await import('../services/fileParser.js');
  const MAX_NLP_ROWS = 5_000;
  let rows = [];
  if (dataset.parsedFilePath) {
    rows = dataset.rowCount > MAX_NLP_ROWS
      ? await stratifiedSample(dataset.parsedFilePath, MAX_NLP_ROWS, dataset.rowCount)
      : await readAllRows(dataset.parsedFilePath);
  } else if (Array.isArray(dataset.rows)) {
    rows = dataset.rows.slice(0, MAX_NLP_ROWS);
  }

  const { nlpText } = await import('../services/pythonBridge.js');
  const result = await nlpText(dataset.headers, rows, column, options || {});

  res.json(result);
}));

// ─── 5d — Automated EDA ──────────────────────────────────────────────────────

router.post('/:datasetId/eda', wrap(async (req, res) => {
  const dataset = await lookupDataset(req);
  const datasetId = String(dataset._id);

  // Compute etag from row count + headers.
  const crypto = await import('crypto');
  const etag = crypto.createHash('sha1')
    .update(String(dataset.rowCount) + '\u0000' + (dataset.headers || []).join('\u0000'))
    .digest('hex');

  // Return cached report if etag matches.
  if (dataset.edaReport?.etag === etag) {
    return res.json(dataset.edaReport);
  }

  // Load rows (stratified-sample to 50 000).
  const { stratifiedSample, readAllRows } = await import('../services/fileParser.js');
  const MAX_EDA_ROWS = 50_000;
  let rows = [];
  if (dataset.parsedFilePath) {
    rows = dataset.rowCount > MAX_EDA_ROWS
      ? await stratifiedSample(dataset.parsedFilePath, MAX_EDA_ROWS, dataset.rowCount)
      : await readAllRows(dataset.parsedFilePath);
  } else if (Array.isArray(dataset.rows)) {
    rows = dataset.rows.slice(0, MAX_EDA_ROWS);
  }

  // Call Python EDA service.
  const { edaProfile } = await import('../services/pythonBridge.js');
  const { profile, plots, samplingApplied } = await edaProfile(
    dataset.headers,
    rows,
    { minimal: true, includePlots: true }
  );

  // Generate LLM narrative from the profile summary.
  const { generateNarrative } = await import('../services/narrativeService.js');
  const narrativeResult = await generateNarrative({
    dataset,
    userId: req.userId,
    sections: ['overview', 'schema', 'quality', 'distributions', 'correlations', 'outliers', 'recommendations', 'next_steps'],
    tone: 'technical',
  });

  const generatedAt = new Date().toISOString();
  const edaReport = {
    etag,
    profile,
    plots,
    narrative: narrativeResult.sections,
    fullMarkdown: narrativeResult.fullMarkdown,
    samplingApplied,
    generatedAt,
  };

  // Persist to dataset.
  const Dataset = (await import('../models/Dataset.js')).default;
  await Dataset.findByIdAndUpdate(datasetId, { edaReport }).catch(() => {});

  res.json(edaReport);
}));

router.get('/:datasetId/eda', wrap(async (req, res) => {
  const dataset = await lookupDataset(req);

  const crypto = await import('crypto');
  const etag = crypto.createHash('sha1')
    .update(String(dataset.rowCount) + '\u0000' + (dataset.headers || []).join('\u0000'))
    .digest('hex');

  if (dataset.edaReport?.etag === etag) {
    return res.json(dataset.edaReport);
  }

  const err = new Error('EDA report has not been generated for this dataset yet');
  err.code = 'EDA_NOT_GENERATED';
  throw err;
}));

export default router;
