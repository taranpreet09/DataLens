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
    throw new Error(data.message || `Request failed (${res.status})`);
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
};
