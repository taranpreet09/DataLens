"""
Data Lens — Python Analytics Service
Handles advanced ML tasks that Node/TS can't do well:
- SHAP explanations
- Auto-ML (FLAML)
- MICE imputation
- Prophet forecasting
- DBSCAN clustering
- PCA dimensionality reduction
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import numpy as np
import pandas as pd

app = FastAPI(
    title="Data Lens - Python Service",
    version="1.0.0",
    description="Advanced ML analytics service",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://127.0.0.1:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Intelligence Layer routers ────────────────────────────────────────────────
from intelligence.nlp_routes import router as nlp_router  # noqa: E402
from intelligence.eda_routes import router as eda_router  # noqa: E402

app.include_router(nlp_router, prefix="/intelligence/nlp", tags=["intelligence"])
app.include_router(eda_router, prefix="/intelligence/eda", tags=["intelligence"])


# ─── Health Check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "python-analytics"}


# ─── Request/Response Models ───────────────────────────────────────────────────

class AnalysisRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    target_column: Optional[str] = None
    options: Optional[dict] = {}


class ImputationRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    strategy: str = "knn"  # knn, mice, iterative
    columns: Optional[list[str]] = None


class ClusteringRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    algorithm: str = "dbscan"  # dbscan, kmeans
    columns: Optional[list[str]] = None
    n_clusters: Optional[int] = None
    eps: Optional[float] = None


class PCARequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    n_components: Optional[int] = None
    columns: Optional[list[str]] = None


# ─── Utility ───────────────────────────────────────────────────────────────────

def rows_to_dataframe(headers: list[str], rows: list[dict]) -> pd.DataFrame:
    """Convert row dicts to a pandas DataFrame."""
    df = pd.DataFrame(rows, columns=headers)
    # Convert numeric columns
    for col in df.columns:
        converted = pd.to_numeric(df[col], errors="coerce")
        # Only apply conversion if the column actually had numeric data
        if not converted.isna().all():
            df[col] = converted
    return df


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/impute")
def impute_missing(req: ImputationRequest):
    """Impute missing values using KNN or iterative imputation."""
    try:
        df = rows_to_dataframe(req.headers, req.rows)
        numeric_cols = req.columns or df.select_dtypes(include=[np.number]).columns.tolist()

        if not numeric_cols:
            raise HTTPException(400, "No numeric columns found for imputation")

        if req.strategy == "knn":
            from sklearn.impute import KNNImputer
            imputer = KNNImputer(n_neighbors=5)
        else:
            from sklearn.experimental import enable_iterative_imputer  # noqa
            from sklearn.impute import IterativeImputer
            imputer = IterativeImputer(max_iter=10, random_state=42)

        df[numeric_cols] = imputer.fit_transform(df[numeric_cols])

        return {
            "rows": df.to_dict(orient="records"),
            "imputed_columns": numeric_cols,
            "strategy": req.strategy,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/cluster")
def cluster_data(req: ClusteringRequest):
    """Cluster data using DBSCAN or KMeans."""
    try:
        df = rows_to_dataframe(req.headers, req.rows)
        numeric_cols = req.columns or df.select_dtypes(include=[np.number]).columns.tolist()

        if len(numeric_cols) < 2:
            raise HTTPException(400, "Need at least 2 numeric columns for clustering")

        from sklearn.preprocessing import StandardScaler
        X = df[numeric_cols].dropna()
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        if req.algorithm == "dbscan":
            from sklearn.cluster import DBSCAN
            eps = req.eps or 0.5
            model = DBSCAN(eps=eps, min_samples=5)
        else:
            from sklearn.cluster import KMeans
            n_clusters = req.n_clusters or 3
            model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)

        labels = model.fit_predict(X_scaled)

        # Compute cluster stats
        cluster_stats = {}
        for label in set(labels):
            if label == -1:
                continue  # Noise in DBSCAN
            mask = labels == label
            cluster_stats[int(label)] = {
                "size": int(mask.sum()),
                "centroid": {col: float(X[mask][col].mean()) for col in numeric_cols},
            }

        return {
            "labels": labels.tolist(),
            "n_clusters": len(set(labels) - {-1}),
            "noise_points": int((labels == -1).sum()) if req.algorithm == "dbscan" else 0,
            "cluster_stats": cluster_stats,
            "columns_used": numeric_cols,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/pca")
def pca_reduction(req: PCARequest):
    """Perform PCA dimensionality reduction."""
    try:
        df = rows_to_dataframe(req.headers, req.rows)
        numeric_cols = req.columns or df.select_dtypes(include=[np.number]).columns.tolist()

        if len(numeric_cols) < 2:
            raise HTTPException(400, "Need at least 2 numeric columns for PCA")

        from sklearn.preprocessing import StandardScaler
        from sklearn.decomposition import PCA

        X = df[numeric_cols].dropna()
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        n_components = req.n_components or min(len(numeric_cols), 5)
        pca = PCA(n_components=n_components)
        transformed = pca.fit_transform(X_scaled)

        return {
            "components": transformed.tolist(),
            "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
            "cumulative_variance": np.cumsum(pca.explained_variance_ratio_).tolist(),
            "feature_loadings": {
                f"PC{i+1}": {col: float(pca.components_[i][j]) for j, col in enumerate(numeric_cols)}
                for i in range(n_components)
            },
            "n_components": n_components,
            "columns_used": numeric_cols,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/feature-importance")
def feature_importance(req: AnalysisRequest):
    """Compute feature importance using gradient boosting."""
    try:
        if not req.target_column:
            raise HTTPException(400, "target_column is required")

        df = rows_to_dataframe(req.headers, req.rows)

        if req.target_column not in df.columns:
            raise HTTPException(400, f"Column '{req.target_column}' not found")

        from sklearn.ensemble import GradientBoostingRegressor, GradientBoostingClassifier
        from sklearn.preprocessing import LabelEncoder

        y = df[req.target_column].dropna()
        X = df.drop(columns=[req.target_column]).loc[y.index]

        # Encode categoricals
        encoders = {}
        for col in X.select_dtypes(include=["object"]).columns:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
            encoders[col] = le

        X = X.select_dtypes(include=[np.number]).fillna(0)

        if X.shape[1] == 0:
            raise HTTPException(400, "No usable features after preprocessing")

        # Determine if classification or regression
        is_numeric_target = pd.api.types.is_numeric_dtype(y)
        if is_numeric_target:
            model = GradientBoostingRegressor(n_estimators=100, random_state=42, max_depth=4)
        else:
            le = LabelEncoder()
            y = le.fit_transform(y.astype(str))
            model = GradientBoostingClassifier(n_estimators=100, random_state=42, max_depth=4)

        model.fit(X, y)

        importances = dict(zip(X.columns.tolist(), model.feature_importances_.tolist()))
        sorted_importances = dict(sorted(importances.items(), key=lambda x: x[1], reverse=True))

        return {
            "importances": sorted_importances,
            "target_column": req.target_column,
            "task_type": "regression" if is_numeric_target else "classification",
            "n_features": len(sorted_importances),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 3: Cross-Validation Baselines
# ═══════════════════════════════════════════════════════════════════════════════


class RegressionRequest(BaseModel):
    x: list[float]
    y: list[float]
    degree: int = 1


class KMeansRequest(BaseModel):
    data: list[list[float]]
    k: int = 3


class IsolationForestRequest(BaseModel):
    data: list[list[float]]
    contamination: float = 0.1


class ForecastRequest(BaseModel):
    series: list[float]
    season_length: int = 12
    forecast_periods: int = 12


@app.post("/validate/regression")
def validate_regression(req: RegressionRequest):
    """Cross-validate regression results against scikit-learn / numpy."""
    try:
        x = np.array(req.x).reshape(-1, 1)
        y = np.array(req.y)

        if req.degree == 1:
            from sklearn.linear_model import LinearRegression
            model = LinearRegression()
            model.fit(x, y)
            predictions = model.predict(x)
            r_squared = float(model.score(x, y))
            rmse = float(np.sqrt(np.mean((y - predictions) ** 2)))
            return {
                "slope": float(model.coef_[0]),
                "intercept": float(model.intercept_),
                "r_squared": r_squared,
                "rmse": rmse,
            }
        else:
            from sklearn.preprocessing import PolynomialFeatures
            from sklearn.linear_model import LinearRegression
            poly = PolynomialFeatures(degree=req.degree)
            x_poly = poly.fit_transform(x)
            model = LinearRegression()
            model.fit(x_poly, y)
            predictions = model.predict(x_poly)
            r_squared = float(model.score(x_poly, y))
            rmse = float(np.sqrt(np.mean((y - predictions) ** 2)))
            return {
                "coefficients": model.coef_.tolist(),
                "intercept": float(model.intercept_),
                "r_squared": r_squared,
                "rmse": rmse,
                "degree": req.degree,
            }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/validate/kmeans")
def validate_kmeans(req: KMeansRequest):
    """Cross-validate K-Means results against scikit-learn."""
    try:
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import StandardScaler

        data = np.array(req.data)
        scaler = StandardScaler()
        scaled = scaler.fit_transform(data)

        model = KMeans(n_clusters=req.k, random_state=42, n_init=10)
        labels = model.fit_predict(scaled)

        return {
            "labels": labels.tolist(),
            "centroids": model.cluster_centers_.tolist(),
            "inertia": float(model.inertia_),
            "n_iter": int(model.n_iter_),
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/validate/isolation-forest")
def validate_isolation_forest(req: IsolationForestRequest):
    """Cross-validate Isolation Forest against scikit-learn."""
    try:
        from sklearn.ensemble import IsolationForest
        from sklearn.preprocessing import StandardScaler

        data = np.array(req.data)
        scaler = StandardScaler()
        scaled = scaler.fit_transform(data)

        model = IsolationForest(
            contamination=req.contamination,
            random_state=42,
            n_estimators=100,
        )
        labels = model.fit_predict(scaled)
        scores = model.decision_function(scaled)

        anomaly_indices = np.where(labels == -1)[0].tolist()

        return {
            "labels": labels.tolist(),
            "scores": scores.tolist(),
            "n_anomalies": len(anomaly_indices),
            "anomaly_indices": anomaly_indices,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/validate/forecast")
def validate_forecast(req: ForecastRequest):
    """Cross-validate Holt-Winters against statsmodels."""
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing

        series = np.array(req.series)
        model = ExponentialSmoothing(
            series,
            seasonal_periods=req.season_length,
            trend="add",
            seasonal="mul",
        ).fit()

        forecast = model.forecast(req.forecast_periods)

        return {
            "fitted": model.fittedvalues.tolist(),
            "forecast": forecast.tolist(),
            "aic": float(model.aic),
            "bic": float(model.bic),
        }
    except Exception as e:
        raise HTTPException(500, str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 4: Advanced ML Endpoints
# ═══════════════════════════════════════════════════════════════════════════════


class SHAPRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    target_column: str
    task_type: Optional[str] = None  # "regression" or "classification", auto-detected if None
    max_samples: int = 500  # SHAP is expensive, limit samples


class AutoMLRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    target_column: str
    task_type: Optional[str] = None  # "regression" or "classification"
    time_budget: int = 60  # seconds
    metric: Optional[str] = None  # e.g. "r2", "accuracy", "f1"


class ProphetRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    date_column: str
    value_column: str
    forecast_periods: int = 30
    include_holidays: bool = True
    country: str = "US"
    changepoint_prior_scale: float = 0.05
    seasonality_mode: str = "additive"  # "additive" or "multiplicative"


class DBSCANRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    columns: Optional[list[str]] = None
    eps: Optional[float] = None  # auto-select if None
    min_samples: int = 5
    metric: str = "euclidean"


class PCAFullRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    columns: Optional[list[str]] = None
    n_components: Optional[int] = None
    include_biplot: bool = True


class XGBImportanceRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    target_column: str
    model: str = "xgboost"  # "xgboost" or "lightgbm"
    task_type: Optional[str] = None
    n_estimators: int = 100
    max_depth: int = 6


class CrossCorrelationRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    column_a: str
    column_b: str
    max_lag: int = 50
    normalize: bool = True


# ─── 24. SHAP Explanations ────────────────────────────────────────────────────

@app.post("/phase4/shap")
def shap_explanations(req: SHAPRequest):
    """SHAP explanations for predictions and outlier detection."""
    try:
        import shap
        from sklearn.ensemble import GradientBoostingRegressor, GradientBoostingClassifier
        from sklearn.preprocessing import LabelEncoder

        df = rows_to_dataframe(req.headers, req.rows)

        if req.target_column not in df.columns:
            raise HTTPException(400, f"Column '{req.target_column}' not found")

        y = df[req.target_column].dropna()
        X = df.drop(columns=[req.target_column]).loc[y.index]

        # Encode categoricals
        encoders = {}
        for col in X.select_dtypes(include=["object"]).columns:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
            encoders[col] = le

        X = X.select_dtypes(include=[np.number]).fillna(0)

        if X.shape[1] == 0:
            raise HTTPException(400, "No usable features after preprocessing")

        # Limit samples for SHAP computation
        sample_size = min(req.max_samples, len(X))
        X_sample = X.iloc[:sample_size]
        y_sample = y.iloc[:sample_size]

        # Detect task type
        is_numeric = pd.api.types.is_numeric_dtype(y)
        task_type = req.task_type or ("regression" if is_numeric else "classification")

        if task_type == "regression":
            model = GradientBoostingRegressor(n_estimators=100, random_state=42, max_depth=4)
            model.fit(X_sample, y_sample)
        else:
            le = LabelEncoder()
            y_encoded = le.fit_transform(y_sample.astype(str))
            model = GradientBoostingClassifier(n_estimators=100, random_state=42, max_depth=4)
            model.fit(X_sample, y_encoded)

        # Compute SHAP values
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_sample)

        # For classification, shap_values may be a list (one per class)
        if isinstance(shap_values, list):
            shap_values = shap_values[1] if len(shap_values) == 2 else shap_values[0]

        # Global feature importance (mean |SHAP|)
        mean_abs_shap = np.abs(shap_values).mean(axis=0)
        feature_importance = dict(
            sorted(
                zip(X_sample.columns.tolist(), mean_abs_shap.tolist()),
                key=lambda x: x[1],
                reverse=True,
            )
        )

        # Top interactions (top 5 features)
        top_features = list(feature_importance.keys())[:5]
        top_indices = [X_sample.columns.tolist().index(f) for f in top_features]

        # Per-sample SHAP for outlier explanation
        # Identify outliers as samples with highest total |SHAP|
        total_shap = np.abs(shap_values).sum(axis=1)
        outlier_threshold = np.percentile(total_shap, 95)
        outlier_mask = total_shap >= outlier_threshold
        outlier_indices = np.where(outlier_mask)[0].tolist()

        # Explanations for top outliers (up to 10)
        outlier_explanations = []
        for idx in outlier_indices[:10]:
            top_drivers = sorted(
                zip(X_sample.columns.tolist(), shap_values[idx].tolist()),
                key=lambda x: abs(x[1]),
                reverse=True,
            )[:5]
            outlier_explanations.append({
                "row_index": int(idx),
                "total_shap": float(total_shap[idx]),
                "top_drivers": [{"feature": f, "shap_value": round(v, 4)} for f, v in top_drivers],
            })

        return {
            "feature_importance": feature_importance,
            "base_value": float(explainer.expected_value if not isinstance(explainer.expected_value, np.ndarray) else explainer.expected_value[0]),
            "task_type": task_type,
            "n_samples": sample_size,
            "outlier_explanations": outlier_explanations,
            "shap_values_sample": shap_values[:50].tolist() if sample_size > 50 else shap_values.tolist(),
            "feature_names": X_sample.columns.tolist(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── 25. Auto-ML Pipeline (FLAML) ─────────────────────────────────────────────

@app.post("/phase4/automl")
def automl_pipeline(req: AutoMLRequest):
    """Auto-ML using FLAML — model selection + hyperparameter tuning."""
    try:
        from flaml import AutoML
        from sklearn.preprocessing import LabelEncoder
        from sklearn.model_selection import train_test_split

        df = rows_to_dataframe(req.headers, req.rows)

        if req.target_column not in df.columns:
            raise HTTPException(400, f"Column '{req.target_column}' not found")

        y = df[req.target_column].dropna()
        X = df.drop(columns=[req.target_column]).loc[y.index]

        # Encode categoricals
        for col in X.select_dtypes(include=["object"]).columns:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))

        X = X.select_dtypes(include=[np.number]).fillna(0)

        if X.shape[1] == 0:
            raise HTTPException(400, "No usable features after preprocessing")

        # Detect task type
        is_numeric = pd.api.types.is_numeric_dtype(y)
        task_type = req.task_type or ("regression" if is_numeric else "classification")

        if task_type == "classification":
            le = LabelEncoder()
            y = pd.Series(le.fit_transform(y.astype(str)), index=y.index)

        # Train/test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # Run FLAML
        automl = AutoML()
        metric = req.metric
        if not metric:
            metric = "r2" if task_type == "regression" else "accuracy"

        automl.fit(
            X_train, y_train,
            task=task_type,
            time_budget=req.time_budget,
            metric=metric,
            verbose=0,
        )

        # Evaluate on test set
        test_score = automl.score(X_test, y_test)
        predictions = automl.predict(X_test)

        # Get feature importance from best model
        best_model = automl.model.estimator
        importances = {}
        if hasattr(best_model, "feature_importances_"):
            importances = dict(
                sorted(
                    zip(X.columns.tolist(), best_model.feature_importances_.tolist()),
                    key=lambda x: x[1],
                    reverse=True,
                )
            )

        return {
            "best_model": automl.best_estimator,
            "best_config": automl.best_config,
            "train_score": float(automl.best_loss) * -1 if "loss" in metric else float(1 - automl.best_loss),
            "test_score": float(test_score),
            "metric": metric,
            "task_type": task_type,
            "feature_importance": importances,
            "n_features": X.shape[1],
            "n_samples_train": len(X_train),
            "n_samples_test": len(X_test),
            "training_duration": float(automl.best_config_train_time),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── 26. Prophet Forecasting ──────────────────────────────────────────────────

@app.post("/phase4/prophet")
def prophet_forecast(req: ProphetRequest):
    """Prophet forecasting with holidays and changepoint detection."""
    try:
        from prophet import Prophet
        import logging
        logging.getLogger("prophet").setLevel(logging.WARNING)
        logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

        df = rows_to_dataframe(req.headers, req.rows)

        if req.date_column not in df.columns:
            raise HTTPException(400, f"Date column '{req.date_column}' not found")
        if req.value_column not in df.columns:
            raise HTTPException(400, f"Value column '{req.value_column}' not found")

        # Prepare Prophet format (ds, y)
        prophet_df = pd.DataFrame({
            "ds": pd.to_datetime(df[req.date_column], errors="coerce"),
            "y": pd.to_numeric(df[req.value_column], errors="coerce"),
        }).dropna()

        if len(prophet_df) < 10:
            raise HTTPException(400, "Need at least 10 valid data points for forecasting")

        prophet_df = prophet_df.sort_values("ds").reset_index(drop=True)

        # Build model
        model = Prophet(
            changepoint_prior_scale=req.changepoint_prior_scale,
            seasonality_mode=req.seasonality_mode,
        )

        if req.include_holidays:
            model.add_country_holidays(country_name=req.country)

        model.fit(prophet_df)

        # Create future dataframe
        future = model.make_future_dataframe(periods=req.forecast_periods)
        forecast = model.predict(future)

        # Extract changepoints
        changepoints = model.changepoints.dt.strftime("%Y-%m-%d").tolist() if hasattr(model, "changepoints") else []

        # Seasonality components
        components = {}
        if "yearly" in forecast.columns:
            components["yearly"] = forecast["yearly"].tolist()
        if "weekly" in forecast.columns:
            components["weekly"] = forecast["weekly"].tolist()

        # Split into historical fit and future forecast
        n_historical = len(prophet_df)

        return {
            "historical": {
                "ds": forecast["ds"][:n_historical].dt.strftime("%Y-%m-%d").tolist(),
                "yhat": forecast["yhat"][:n_historical].tolist(),
                "yhat_lower": forecast["yhat_lower"][:n_historical].tolist(),
                "yhat_upper": forecast["yhat_upper"][:n_historical].tolist(),
                "actual": prophet_df["y"].tolist(),
            },
            "forecast": {
                "ds": forecast["ds"][n_historical:].dt.strftime("%Y-%m-%d").tolist(),
                "yhat": forecast["yhat"][n_historical:].tolist(),
                "yhat_lower": forecast["yhat_lower"][n_historical:].tolist(),
                "yhat_upper": forecast["yhat_upper"][n_historical:].tolist(),
            },
            "changepoints": changepoints,
            "seasonality_components": components,
            "seasonality_mode": req.seasonality_mode,
            "holidays_included": req.include_holidays,
            "n_data_points": n_historical,
            "forecast_periods": req.forecast_periods,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── 27. DBSCAN Density-Based Clustering ──────────────────────────────────────

@app.post("/phase4/dbscan")
def dbscan_clustering(req: DBSCANRequest):
    """DBSCAN clustering with automatic eps selection via k-distance graph."""
    try:
        from sklearn.cluster import DBSCAN
        from sklearn.preprocessing import StandardScaler
        from sklearn.neighbors import NearestNeighbors

        df = rows_to_dataframe(req.headers, req.rows)
        numeric_cols = req.columns or df.select_dtypes(include=[np.number]).columns.tolist()

        if len(numeric_cols) < 2:
            raise HTTPException(400, "Need at least 2 numeric columns for clustering")

        X = df[numeric_cols].dropna()
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Auto-select eps using k-distance graph (knee method)
        eps = req.eps
        k_distances = None
        if eps is None:
            nn = NearestNeighbors(n_neighbors=req.min_samples, metric=req.metric)
            nn.fit(X_scaled)
            distances, _ = nn.kneighbors(X_scaled)
            k_dist = np.sort(distances[:, -1])
            k_distances = k_dist.tolist()

            # Simple knee detection: find point of maximum curvature
            diffs = np.diff(k_dist)
            diffs2 = np.diff(diffs)
            knee_idx = np.argmax(diffs2) + 2 if len(diffs2) > 0 else len(k_dist) // 2
            eps = float(k_dist[min(knee_idx, len(k_dist) - 1)])

        # Run DBSCAN
        model = DBSCAN(eps=eps, min_samples=req.min_samples, metric=req.metric)
        labels = model.fit_predict(X_scaled)

        unique_labels = set(labels)
        n_clusters = len(unique_labels - {-1})
        n_noise = int((labels == -1).sum())

        # Cluster statistics
        cluster_stats = {}
        for label in sorted(unique_labels):
            if label == -1:
                continue
            mask = labels == label
            cluster_stats[int(label)] = {
                "size": int(mask.sum()),
                "centroid": {col: float(X[mask][col].mean()) for col in numeric_cols},
                "std": {col: float(X[mask][col].std()) for col in numeric_cols},
            }

        # Core samples
        core_sample_indices = model.core_sample_indices_.tolist() if hasattr(model, "core_sample_indices_") else []

        return {
            "labels": labels.tolist(),
            "n_clusters": n_clusters,
            "n_noise": n_noise,
            "noise_ratio": round(n_noise / len(labels), 4) if len(labels) > 0 else 0,
            "eps_used": round(eps, 4),
            "min_samples": req.min_samples,
            "cluster_stats": cluster_stats,
            "columns_used": numeric_cols,
            "n_core_samples": len(core_sample_indices),
            "k_distances": k_distances[:200] if k_distances and len(k_distances) > 200 else k_distances,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── 28. PCA / Dimensionality Reduction ───────────────────────────────────────

@app.post("/phase4/pca")
def pca_full(req: PCAFullRequest):
    """Full PCA with scree plot, biplot data, and loadings."""
    try:
        from sklearn.preprocessing import StandardScaler
        from sklearn.decomposition import PCA

        df = rows_to_dataframe(req.headers, req.rows)
        numeric_cols = req.columns or df.select_dtypes(include=[np.number]).columns.tolist()

        if len(numeric_cols) < 2:
            raise HTTPException(400, "Need at least 2 numeric columns for PCA")

        X = df[numeric_cols].dropna()
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # First do full PCA to get scree plot
        pca_full = PCA()
        pca_full.fit(X_scaled)

        # Determine n_components
        n_components = req.n_components
        if n_components is None:
            # Select components explaining >= 95% variance
            cumvar = np.cumsum(pca_full.explained_variance_ratio_)
            n_components = int(np.searchsorted(cumvar, 0.95) + 1)
            n_components = min(n_components, len(numeric_cols))

        # Final PCA with selected components
        pca = PCA(n_components=n_components)
        transformed = pca.fit_transform(X_scaled)

        # Biplot data (loadings scaled for visualization)
        biplot_data = None
        if req.include_biplot and n_components >= 2:
            loadings = pca.components_[:2].T  # First 2 PCs
            biplot_data = {
                "arrows": [
                    {
                        "feature": numeric_cols[i],
                        "pc1_loading": float(loadings[i, 0]),
                        "pc2_loading": float(loadings[i, 1]),
                    }
                    for i in range(len(numeric_cols))
                ],
                "scores_pc1": transformed[:, 0].tolist()[:500],
                "scores_pc2": transformed[:, 1].tolist()[:500],
            }

        # Kaiser criterion (eigenvalues > 1)
        eigenvalues = pca_full.explained_variance_.tolist()
        kaiser_components = int(sum(1 for ev in eigenvalues if ev > 1))

        return {
            "transformed": transformed[:500].tolist(),  # Limit for response size
            "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
            "cumulative_variance": np.cumsum(pca.explained_variance_ratio_).tolist(),
            "scree_plot": {
                "eigenvalues": eigenvalues,
                "explained_variance_ratio": pca_full.explained_variance_ratio_.tolist(),
                "cumulative": np.cumsum(pca_full.explained_variance_ratio_).tolist(),
            },
            "feature_loadings": {
                f"PC{i+1}": {col: float(pca.components_[i][j]) for j, col in enumerate(numeric_cols)}
                for i in range(n_components)
            },
            "biplot": biplot_data,
            "n_components": n_components,
            "kaiser_criterion": kaiser_components,
            "total_variance_explained": float(np.sum(pca.explained_variance_ratio_)),
            "columns_used": numeric_cols,
            "n_samples": len(X),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── 29. XGBoost / LightGBM Feature Importance ────────────────────────────────

@app.post("/phase4/xgb-importance")
def xgb_lightgbm_importance(req: XGBImportanceRequest):
    """Feature importance using XGBoost or LightGBM with multiple importance types."""
    try:
        from sklearn.preprocessing import LabelEncoder
        from sklearn.model_selection import cross_val_score

        df = rows_to_dataframe(req.headers, req.rows)

        if req.target_column not in df.columns:
            raise HTTPException(400, f"Column '{req.target_column}' not found")

        y = df[req.target_column].dropna()
        X = df.drop(columns=[req.target_column]).loc[y.index]

        # Encode categoricals
        for col in X.select_dtypes(include=["object"]).columns:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))

        X = X.select_dtypes(include=[np.number]).fillna(0)

        if X.shape[1] == 0:
            raise HTTPException(400, "No usable features after preprocessing")

        # Detect task type
        is_numeric = pd.api.types.is_numeric_dtype(y)
        task_type = req.task_type or ("regression" if is_numeric else "classification")

        if task_type == "classification":
            le = LabelEncoder()
            y = pd.Series(le.fit_transform(y.astype(str)), index=y.index)

        # Build model
        if req.model == "xgboost":
            import xgboost as xgb
            if task_type == "regression":
                model = xgb.XGBRegressor(
                    n_estimators=req.n_estimators, max_depth=req.max_depth,
                    random_state=42, verbosity=0,
                )
            else:
                model = xgb.XGBClassifier(
                    n_estimators=req.n_estimators, max_depth=req.max_depth,
                    random_state=42, verbosity=0, eval_metric="logloss",
                )
        else:  # lightgbm
            import lightgbm as lgb
            if task_type == "regression":
                model = lgb.LGBMRegressor(
                    n_estimators=req.n_estimators, max_depth=req.max_depth,
                    random_state=42, verbose=-1,
                )
            else:
                model = lgb.LGBMClassifier(
                    n_estimators=req.n_estimators, max_depth=req.max_depth,
                    random_state=42, verbose=-1,
                )

        model.fit(X, y)

        # Get multiple importance types
        feature_names = X.columns.tolist()
        importances = {}

        # Default (gain-based) importance
        gain_importance = dict(
            sorted(
                zip(feature_names, model.feature_importances_.tolist()),
                key=lambda x: x[1],
                reverse=True,
            )
        )
        importances["gain"] = gain_importance

        # Permutation importance (more reliable)
        from sklearn.inspection import permutation_importance
        scoring = "r2" if task_type == "regression" else "accuracy"
        perm_result = permutation_importance(model, X, y, n_repeats=10, random_state=42, scoring=scoring)
        perm_importance = dict(
            sorted(
                zip(feature_names, perm_result.importances_mean.tolist()),
                key=lambda x: x[1],
                reverse=True,
            )
        )
        importances["permutation"] = perm_importance

        # Cross-validation score
        cv_scores = cross_val_score(model, X, y, cv=5, scoring=scoring)

        return {
            "importances": importances,
            "model_type": req.model,
            "task_type": task_type,
            "target_column": req.target_column,
            "cv_score_mean": float(cv_scores.mean()),
            "cv_score_std": float(cv_scores.std()),
            "n_features": len(feature_names),
            "n_samples": len(X),
            "feature_names": feature_names,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── 30. Cross-Correlation with Lag Detection ─────────────────────────────────

@app.post("/phase4/cross-correlation")
def cross_correlation(req: CrossCorrelationRequest):
    """Compute cross-correlation between two columns with lag detection."""
    try:
        from scipy import signal

        df = rows_to_dataframe(req.headers, req.rows)

        if req.column_a not in df.columns:
            raise HTTPException(400, f"Column '{req.column_a}' not found")
        if req.column_b not in df.columns:
            raise HTTPException(400, f"Column '{req.column_b}' not found")

        a = pd.to_numeric(df[req.column_a], errors="coerce").dropna().values
        b = pd.to_numeric(df[req.column_b], errors="coerce").dropna().values

        # Align lengths
        min_len = min(len(a), len(b))
        a = a[:min_len]
        b = b[:min_len]

        if min_len < 10:
            raise HTTPException(400, "Need at least 10 data points for cross-correlation")

        # Normalize if requested
        if req.normalize:
            a = (a - a.mean()) / (a.std() + 1e-10)
            b = (b - b.mean()) / (b.std() + 1e-10)

        # Compute full cross-correlation
        max_lag = min(req.max_lag, min_len - 1)
        lags = np.arange(-max_lag, max_lag + 1)
        correlations = []

        for lag in lags:
            if lag < 0:
                corr = np.corrcoef(a[:lag], b[-lag:])[0, 1]
            elif lag > 0:
                corr = np.corrcoef(a[lag:], b[:-lag])[0, 1]
            else:
                corr = np.corrcoef(a, b)[0, 1]
            correlations.append(float(corr) if not np.isnan(corr) else 0.0)

        correlations = np.array(correlations)

        # Find optimal lag (maximum absolute correlation)
        best_idx = np.argmax(np.abs(correlations))
        optimal_lag = int(lags[best_idx])
        max_correlation = float(correlations[best_idx])

        # Find significant lags (above 2/sqrt(n) threshold)
        significance_threshold = 2.0 / np.sqrt(min_len)
        significant_lags = [
            {"lag": int(lags[i]), "correlation": round(float(correlations[i]), 4)}
            for i in range(len(lags))
            if abs(correlations[i]) > significance_threshold
        ]

        # Granger-like causality hint
        causality_hint = None
        if abs(optimal_lag) > 0:
            if optimal_lag > 0:
                causality_hint = f"'{req.column_a}' may lead '{req.column_b}' by {optimal_lag} periods"
            else:
                causality_hint = f"'{req.column_b}' may lead '{req.column_a}' by {abs(optimal_lag)} periods"

        return {
            "lags": lags.tolist(),
            "correlations": correlations.tolist(),
            "optimal_lag": optimal_lag,
            "max_correlation": round(max_correlation, 4),
            "significance_threshold": round(significance_threshold, 4),
            "significant_lags": significant_lags[:20],  # Limit response size
            "causality_hint": causality_hint,
            "column_a": req.column_a,
            "column_b": req.column_b,
            "n_samples": min_len,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
