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
      const errBody = await res.json().catch(() => ({ detail: 'Unknown error' }));
      // FastAPI can return detail as a string, object, or array
      let message;
      if (typeof errBody.detail === 'string') {
        message = errBody.detail;
      } else if (Array.isArray(errBody.detail)) {
        // Pydantic validation errors
        message = errBody.detail.map(e => e.msg || e.message || JSON.stringify(e)).join('; ');
      } else if (errBody.detail && typeof errBody.detail === 'object') {
        // Structured error from Python: { code, message, retryable }
        message = errBody.detail.message || JSON.stringify(errBody.detail);
      } else {
        message = `Python service error: ${res.status}`;
      }
      const error = new Error(message);
      // Propagate structured code if available
      if (errBody.detail?.code) {
        error.code = errBody.detail.code;
      }
      if (errBody.detail?.retryable != null) {
        error.retryable = errBody.detail.retryable;
      }
      throw error;
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

// ═══════════════════════════════════════════════════════════════════════════════
// Advanced ML
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SHAP explanations for predictions and outlier detection.
 */
export async function shapExplanations(headers, rows, options = {}) {
  return callPython('/phase4/shap', {
    headers,
    rows,
    target_column: options.targetColumn,
    task_type: options.taskType || null,
    max_samples: options.maxSamples || 500,
  });
}

/**
 * Auto-ML pipeline using FLAML.
 */
export async function autoML(headers, rows, options = {}) {
  return callPython('/phase4/automl', {
    headers,
    rows,
    target_column: options.targetColumn,
    task_type: options.taskType || null,
    time_budget: options.timeBudget || 60,
    metric: options.metric || null,
  });
}

/**
 * Prophet forecasting with holidays and changepoints.
 */
export async function prophetForecast(headers, rows, options = {}) {
  return callPython('/phase4/prophet', {
    headers,
    rows,
    date_column: options.dateColumn,
    value_column: options.valueColumn,
    forecast_periods: options.forecastPeriods || 30,
    include_holidays: options.includeHolidays !== false,
    country: options.country || 'US',
    changepoint_prior_scale: options.changepointPriorScale || 0.05,
    seasonality_mode: options.seasonalityMode || 'additive',
  });
}

/**
 * DBSCAN density-based clustering.
 */
export async function dbscanClustering(headers, rows, options = {}) {
  return callPython('/phase4/dbscan', {
    headers,
    rows,
    columns: options.columns || null,
    eps: options.eps || null,
    min_samples: options.minSamples || 5,
    metric: options.metric || 'euclidean',
  });
}

/**
 * Full PCA with scree plot, biplot, and loadings.
 */
export async function pcaFull(headers, rows, options = {}) {
  return callPython('/phase4/pca', {
    headers,
    rows,
    columns: options.columns || null,
    n_components: options.nComponents || null,
    include_biplot: options.includeBiplot !== false,
  });
}

/**
 * XGBoost / LightGBM feature importance.
 */
export async function xgbImportance(headers, rows, options = {}) {
  return callPython('/phase4/xgb-importance', {
    headers,
    rows,
    target_column: options.targetColumn,
    model: options.model || 'xgboost',
    task_type: options.taskType || null,
    n_estimators: options.nEstimators || 100,
    max_depth: options.maxDepth || 6,
  });
}

/**
 * Cross-correlation with lag detection.
 */
export async function crossCorrelation(headers, rows, options = {}) {
  return callPython('/phase4/cross-correlation', {
    headers,
    rows,
    column_a: options.columnA,
    column_b: options.columnB,
    max_lag: options.maxLag || 50,
    normalize: options.normalize !== false,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Intelligence Layer proxies
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Text column NLP — sentiment, topics, keywords.
 * Proxies to POST /intelligence/nlp/analyze on the Python service.
 *
 * Maps ECONNREFUSED to a structured PYTHON_UNAVAILABLE error so the
 * intelligence route can return the correct error envelope.
 */
export async function nlpText(headers, rows, column, options = {}) {
  try {
    return await callPython('/intelligence/nlp/analyze', {
      headers,
      rows,
      column,
      options,
    });
  } catch (err) {
    if (
      err.cause?.code === 'ECONNREFUSED' ||
      err.message?.includes('not running')
    ) {
      const e = new Error('Python analytics service is unavailable');
      e.code = 'PYTHON_UNAVAILABLE';
      e.retryable = true;
      throw e;
    }
    throw err;
  }
}

/**
 * Automated EDA report — ydata-profiling + optional plots.
 * Proxies to POST /intelligence/eda/profile on the Python service.
 */
export async function edaProfile(headers, rows, options = {}) {
  try {
    return await callPython('/intelligence/eda/profile', {
      headers,
      rows,
      options,
    });
  } catch (err) {
    if (
      err.cause?.code === 'ECONNREFUSED' ||
      err.message?.includes('not running')
    ) {
      const e = new Error('Python analytics service is unavailable');
      e.code = 'PYTHON_UNAVAILABLE';
      e.retryable = true;
      throw e;
    }
    throw err;
  }
}
