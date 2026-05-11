/**
 * Bridge to the Python analytics service.
 * Calls FastAPI endpoints for advanced ML operations.
 */

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';

/**
 * Call a Python service endpoint.
 * @param {string} endpoint - e.g., '/impute', '/cluster', '/pca'
 * @param {object} body - Request body
 * @returns {object} Response data
 */
async function callPython(endpoint, body) {
  const url = `${PYTHON_SERVICE_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `Python service error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error('Python service timed out. Dataset may be too large.');
    }
    if (err.cause?.code === 'ECONNREFUSED') {
      throw new Error('Python analytics service is not running. Start it with: cd python_service && uvicorn main:app --port 8000');
    }
    throw err;
  }
}

/**
 * Check if the Python service is available.
 */
export async function isPythonAvailable() {
  try {
    const res = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Impute missing values using Python's scikit-learn.
 */
export async function imputeMissing(headers, rows, strategy = 'knn', columns = null) {
  return callPython('/impute', { headers, rows, strategy, columns });
}

/**
 * Cluster data using DBSCAN or KMeans.
 */
export async function clusterData(headers, rows, options = {}) {
  return callPython('/cluster', {
    headers,
    rows,
    algorithm: options.algorithm || 'dbscan',
    columns: options.columns || null,
    n_clusters: options.n_clusters || null,
    eps: options.eps || null,
  });
}

/**
 * PCA dimensionality reduction.
 */
export async function pcaReduce(headers, rows, options = {}) {
  return callPython('/pca', {
    headers,
    rows,
    n_components: options.n_components || null,
    columns: options.columns || null,
  });
}

/**
 * Feature importance via gradient boosting.
 */
export async function featureImportance(headers, rows, targetColumn) {
  return callPython('/feature-importance', {
    headers,
    rows,
    target_column: targetColumn,
  });
}
