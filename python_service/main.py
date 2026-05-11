"""
Obsidian Analytics — Python Analytics Service
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
    title="Obsidian Analytics - Python Service",
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
        df[col] = pd.to_numeric(df[col], errors="ignore")
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
