"""
EDA Pipeline — Intelligence Layer (5d)

Wraps ydata-profiling to produce a JSON profile and optional plot images.
Heavy imports are deferred inside functions so the service boots even if
ydata-profiling is not installed.
"""

from __future__ import annotations

import base64
import io
from typing import Any

import numpy as np
import pandas as pd


# ─── Sampling ─────────────────────────────────────────────────────────────────

def stratified_sample(df: pd.DataFrame, n: int) -> tuple[pd.DataFrame, dict[str, Any]]:
    """
    Stratified-sample a DataFrame down to at most `n` rows.
    Returns (sampled_df, sampling_info).
    """
    original_count = len(df)
    if original_count <= n:
        return df, {"applied": False, "originalRowCount": original_count, "sampledRowCount": original_count}

    sampled = df.sample(n=n, random_state=42).reset_index(drop=True)
    return sampled, {
        "applied": True,
        "originalRowCount": original_count,
        "sampledRowCount": len(sampled),
    }


# ─── Profile ──────────────────────────────────────────────────────────────────

def run_profile(df: pd.DataFrame, minimal: bool = True) -> dict[str, Any]:
    """
    Run ydata-profiling on a DataFrame and return a JSON-serialisable summary.

    Uses minimal=True by default to keep runtime under 90 s for datasets up
    to 20 000 rows.
    """
    try:
        from ydata_profiling import ProfileReport  # type: ignore
    except ImportError:
        raise RuntimeError(
            "ydata-profiling is not installed. "
            "Run: pip install ydata-profiling"
        )

    report = ProfileReport(df, minimal=minimal, progress_bar=False)
    # Export to dict — this is the canonical ydata-profiling JSON representation.
    profile_dict = report.to_json()
    import json
    return json.loads(profile_dict)


# ─── Plots ────────────────────────────────────────────────────────────────────

def _fig_to_data_uri(fig) -> str:
    """Encode a matplotlib Figure as a base64 PNG data URI."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=96, bbox_inches="tight")
    buf.seek(0)
    encoded = base64.b64encode(buf.read()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


def render_plots(df: pd.DataFrame, max_plots: int = 12) -> dict[str, str]:
    """
    Render up to `max_plots` diagnostic plots and return them as base64 PNG
    data URIs keyed by a descriptive name.

    Plot types attempted (in order, stopping at max_plots):
      1. missing_heatmap
      2. correlation_heatmap
      3–N. numeric column distributions (up to 5)
      N+1–M. categorical column bar charts (up to 5)
    """
    import matplotlib
    matplotlib.use("Agg")  # non-interactive backend
    import matplotlib.pyplot as plt
    import seaborn as sns  # type: ignore

    plots: dict[str, str] = {}

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    def add_plot(key: str, fig) -> bool:
        if len(plots) >= max_plots:
            plt.close(fig)
            return False
        plots[key] = _fig_to_data_uri(fig)
        plt.close(fig)
        return True

    # 1. Missing value heatmap
    try:
        fig, ax = plt.subplots(figsize=(min(10, len(df.columns) * 0.5 + 2), 4))
        missing = df.isnull()
        if missing.any().any():
            sns.heatmap(missing, cbar=False, ax=ax, yticklabels=False)
            ax.set_title("Missing Values")
            add_plot("missing_heatmap", fig)
        else:
            plt.close(fig)
    except Exception:
        pass

    # 2. Correlation heatmap
    if len(numeric_cols) >= 2:
        try:
            corr = df[numeric_cols].corr()
            size = min(10, len(numeric_cols))
            fig, ax = plt.subplots(figsize=(size, size))
            sns.heatmap(corr, annot=len(numeric_cols) <= 10, fmt=".2f", ax=ax, cmap="coolwarm")
            ax.set_title("Correlation Matrix")
            add_plot("correlation_heatmap", fig)
        except Exception:
            pass

    # 3–7. Numeric distributions
    for col in numeric_cols[:5]:
        if len(plots) >= max_plots:
            break
        try:
            fig, ax = plt.subplots(figsize=(6, 3))
            df[col].dropna().hist(bins=30, ax=ax, color="#6366f1", edgecolor="white")
            ax.set_title(f"Distribution: {col}")
            ax.set_xlabel(col)
            ax.set_ylabel("Count")
            add_plot(f"dist_{col}", fig)
        except Exception:
            pass

    # 8–12. Categorical bar charts
    for col in categorical_cols[:5]:
        if len(plots) >= max_plots:
            break
        try:
            top = df[col].value_counts().head(15)
            fig, ax = plt.subplots(figsize=(6, 3))
            top.plot(kind="bar", ax=ax, color="#8b5cf6", edgecolor="white")
            ax.set_title(f"Top Values: {col}")
            ax.set_xlabel(col)
            ax.set_ylabel("Count")
            plt.xticks(rotation=45, ha="right")
            plt.tight_layout()
            add_plot(f"bar_{col}", fig)
        except Exception:
            pass

    return plots
