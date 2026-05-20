/**
 * API client for the Obsidian Analytics backend.
 * Handles auth headers, error parsing, and provides typed methods for each endpoint.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

function getToken() {
  return localStorage.getItem('datalens_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMessage = typeof data.message === 'string'
      ? data.message
      : (data.message ? JSON.stringify(data.message) : `Request failed (${res.status})`);
    const err = new Error(errMessage);
    err.code = data.code;
    err.retryable = data.retryable;
    err.retryAfterSeconds = data.retryAfterSeconds;
    throw err;
  }

  return data;
}

// ─── Analysis API ─────────────────────────────────────────────────────────────

export const analysisApi = {
  // Stats
  getStats: (datasetId) => request(`/api/analysis/${datasetId}/stats`),
  recompute: (datasetId) => request(`/api/analysis/${datasetId}/recompute`, { method: 'POST' }),
  getSample: (datasetId, size = 100) => request(`/api/analysis/${datasetId}/sample?size=${size}`),

  // Statistical Tests
  tTest: (datasetId, body) => request(`/api/analysis/${datasetId}/test/ttest`, { method: 'POST', body }),
  anova: (datasetId, body) => request(`/api/analysis/${datasetId}/test/anova`, { method: 'POST', body }),
  chiSquare: (datasetId, body) => request(`/api/analysis/${datasetId}/test/chi-square`, { method: 'POST', body }),
  normality: (datasetId, body) => request(`/api/analysis/${datasetId}/test/normality`, { method: 'POST', body }),
  correlation: (datasetId, body) => request(`/api/analysis/${datasetId}/test/correlation`, { method: 'POST', body }),
  mannWhitney: (datasetId, body) => request(`/api/analysis/${datasetId}/test/mann-whitney`, { method: 'POST', body }),
  pairedTTest: (datasetId, body) => request(`/api/analysis/${datasetId}/test/paired-ttest`, { method: 'POST', body }),
  confidenceIntervals: (datasetId, level = 0.95) => request(`/api/analysis/${datasetId}/confidence-intervals`, { method: 'POST', body: { level } }),

  // Data Quality
  semanticTypes: (datasetId) => request(`/api/analysis/${datasetId}/quality/types`),
  fuzzyDuplicates: (datasetId, threshold = 0.15) => request(`/api/analysis/${datasetId}/quality/duplicates?threshold=${threshold}`),
  validationRules: (datasetId) => request(`/api/analysis/${datasetId}/quality/rules`),
  dependencies: (datasetId) => request(`/api/analysis/${datasetId}/quality/dependencies`),

  // ML (Python)
  pythonStatus: () => request(`/api/analysis/python/status`),
  impute: (datasetId, body) => request(`/api/analysis/${datasetId}/ml/impute`, { method: 'POST', body }),
  cluster: (datasetId, body) => request(`/api/analysis/${datasetId}/ml/cluster`, { method: 'POST', body }),
  pca: (datasetId, body) => request(`/api/analysis/${datasetId}/ml/pca`, { method: 'POST', body }),
  featureImportance: (datasetId, body) => request(`/api/analysis/${datasetId}/ml/feature-importance`, { method: 'POST', body }),
};

// ─── Analysis Engine API ──────────────────────────────────────────────────────

export const analysisEngineApi = {
  // K-Means Clustering
  kMeans: (datasetId, body) => request(`/api/analysis-engine/${datasetId}/kmeans`, { method: 'POST', body }),

  // Regression
  regression: (datasetId, body) => request(`/api/analysis-engine/${datasetId}/regression`, { method: 'POST', body }),

  // Decision Tree Feature Importance
  featureImportance: (datasetId, body) => request(`/api/analysis-engine/${datasetId}/feature-importance`, { method: 'POST', body }),

  // Isolation Forest Anomaly Detection
  anomalyDetection: (datasetId, body) => request(`/api/analysis-engine/${datasetId}/anomaly-detection`, { method: 'POST', body }),

  // Holt-Winters Forecasting
  forecast: (datasetId, body) => request(`/api/analysis-engine/${datasetId}/forecast`, { method: 'POST', body }),

  // FFT Seasonality Detection
  fft: (datasetId, body) => request(`/api/analysis-engine/${datasetId}/fft`, { method: 'POST', body }),
};

// ─── Advanced ML (Python) API ─────────────────────────────────────────────────

export const advancedMlApi = {
  // SHAP Explanations
  shap: (datasetId, body) => request(`/api/advanced-ml/${datasetId}/shap`, { method: 'POST', body }),

  // Auto-ML Pipeline (FLAML)
  automl: (datasetId, body) => request(`/api/advanced-ml/${datasetId}/automl`, { method: 'POST', body }),

  // Prophet Forecasting
  prophet: (datasetId, body) => request(`/api/advanced-ml/${datasetId}/prophet`, { method: 'POST', body }),

  // DBSCAN Clustering
  dbscan: (datasetId, body) => request(`/api/advanced-ml/${datasetId}/dbscan`, { method: 'POST', body }),

  // PCA / Dimensionality Reduction
  pca: (datasetId, body) => request(`/api/advanced-ml/${datasetId}/pca`, { method: 'POST', body }),

  // XGBoost / LightGBM Feature Importance
  xgbImportance: (datasetId, body) => request(`/api/advanced-ml/${datasetId}/xgb-importance`, { method: 'POST', body }),

  // Cross-Correlation with Lag Detection
  crossCorrelation: (datasetId, body) => request(`/api/advanced-ml/${datasetId}/cross-correlation`, { method: 'POST', body }),
};

// ─── Datasets API ─────────────────────────────────────────────────────────────

export const datasetsApi = {
  list: (page = 1, limit = 50) => request(`/api/datasets?page=${page}&limit=${limit}`),
  get: (id) => request(`/api/datasets/${id}`),
  getRows: (id, page = 1, limit = 50) => request(`/api/datasets/${id}/rows?page=${page}&limit=${limit}`),
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/datasets/upload', { method: 'POST', body: formData });
  },
  delete: (id) => request(`/api/datasets/${id}`, { method: 'DELETE' }),
  reprocess: (id) => request(`/api/datasets/${id}/reprocess`, { method: 'POST' }),
};

// ─── Collaboration API ────────────────────────────────────────────────────────

export const collaborationApi = {
  // Shareable report links
  createShareLink: (datasetId) => request(`/api/collaboration/${datasetId}/share`, { method: 'POST' }),
  revokeShareLink: (datasetId) => request(`/api/collaboration/${datasetId}/share`, { method: 'DELETE' }),
  getSharedReport: (token) => request(`/api/collaboration/shared/${token}`),

  // Export to Excel
  exportExcel: (datasetId, body = {}) => request(`/api/collaboration/${datasetId}/export-excel`, { method: 'POST', body }),

  // Dataset comparison
  compare: (datasetId, compareToId) => request(`/api/collaboration/${datasetId}/compare`, { method: 'POST', body: { compareToId } }),
};

// ─── Intelligence Layer API ───────────────────────────────────────────────────

export const intelligenceApi = {
  /** Health probe — returns { bedrock, python, model } */
  health: () => request('/api/intelligence/health'),

  /** Natural language query → AnalysisIntent + result + narrative */
  nlQuery: (datasetId, question) =>
    request(`/api/intelligence/${datasetId}/nl-query`, {
      method: 'POST',
      body: { question },
    }),

  /** Generate (or return cached) multi-section markdown narrative */
  narrative: (datasetId, body = {}) =>
    request(`/api/intelligence/${datasetId}/narrative`, {
      method: 'POST',
      body,
    }),

  /** Text column NLP — sentiment, topics, keywords */
  nlpText: (datasetId, body) =>
    request(`/api/intelligence/${datasetId}/nlp/text`, {
      method: 'POST',
      body,
    }),

  /** Generate an automated EDA report (may take up to 90 s) */
  edaGenerate: (datasetId) =>
    request(`/api/intelligence/${datasetId}/eda`, { method: 'POST' }),

  /** Fetch a previously generated EDA report */
  edaGet: (datasetId) => request(`/api/intelligence/${datasetId}/eda`),
};
