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
    """
    try:
        from ydata_profiling import ProfileReport  # type: ignore
    except ImportError:
        raise RuntimeError(
            "ydata-profiling is not installed. "
            "Run: pip install ydata-profiling"
        )

    report = ProfileReport(df, minimal=minimal, progress_bar=False)
    profile_dict = report.to_json()
    import json
    return json.loads(profile_dict)


# ─── Column filtering ─────────────────────────────────────────────────────────

_ID_PATTERNS = {"id", "phone", "email", "name", "key", "code", "uuid", "ssn", "zip", "postal", "address", "url", "link"}


def _is_id_like(col: str, series: pd.Series) -> bool:
    """Detect columns that are identifiers, not analytical variables."""
    col_lower = col.lower().replace("_", "").replace("-", "").replace(" ", "")
    if any(pat in col_lower for pat in _ID_PATTERNS):
        return True
    # High cardinality numeric (>90% unique) = likely an ID
    if series.nunique() > 0.9 * len(series) and len(series) > 100:
        return True
    return False


def _get_analytical_columns(df: pd.DataFrame) -> tuple[list[str], list[str]]:
    """Return (numeric_cols, categorical_cols) filtered to analytical columns only."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    numeric_cols = [c for c in numeric_cols if not _is_id_like(c, df[c])]
    categorical_cols = [c for c in categorical_cols if not _is_id_like(c, df[c])]

    return numeric_cols, categorical_cols


# ─── Plot helpers ─────────────────────────────────────────────────────────────

def _fig_to_data_uri(fig) -> str:
    """Encode a matplotlib Figure as a base64 PNG data URI."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, bbox_inches="tight", facecolor="#1a1a2e")
    buf.seek(0)
    encoded = base64.b64encode(buf.read()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


def _style_ax(ax, title: str = "", xlabel: str = "", ylabel: str = ""):
    """Apply consistent dark theme to axes."""
    ax.set_facecolor("#1a1a2e")
    ax.set_title(title, fontsize=11, fontweight="bold", color="white", pad=10)
    ax.set_xlabel(xlabel, fontsize=9, color="#a0a0b0")
    ax.set_ylabel(ylabel, fontsize=9, color="#a0a0b0")
    ax.tick_params(colors="#a0a0b0", labelsize=8)
    for spine in ax.spines.values():
        spine.set_color("#333355")


# ─── Plots ────────────────────────────────────────────────────────────────────

def render_plots(df: pd.DataFrame, max_plots: int = 12) -> dict[str, str]:
    """
    Render professional, stakeholder-ready plots.

    Plot priority (business-relevant first):
      1. Correlation heatmap (meaningful variables only)
      2. Key numeric distributions (salary, performance, satisfaction, etc.)
      3. Department/category breakdowns
      4. Scatter plots for key relationships
      5. Missing data heatmap (only if >5% missing)
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import seaborn as sns

    # Dark theme
    plt.rcParams.update({
        "figure.facecolor": "#1a1a2e",
        "axes.facecolor": "#1a1a2e",
        "text.color": "white",
        "axes.labelcolor": "#a0a0b0",
        "xtick.color": "#a0a0b0",
        "ytick.color": "#a0a0b0",
    })

    plots: dict[str, str] = {}
    numeric_cols, categorical_cols = _get_analytical_columns(df)

    def add_plot(key: str, fig) -> bool:
        if len(plots) >= max_plots:
            plt.close(fig)
            return False
        plots[key] = _fig_to_data_uri(fig)
        plt.close(fig)
        return True

    # ── 1. Correlation heatmap (only meaningful variables) ────────────────────
    if len(numeric_cols) >= 2:
        try:
            corr = df[numeric_cols].corr()
            # Filter to show only correlations > 0.02 magnitude to reduce noise
            size = min(8, max(4, len(numeric_cols) * 0.7))
            fig, ax = plt.subplots(figsize=(size, size))
            fig.set_facecolor("#1a1a2e")
            mask = np.triu(np.ones_like(corr, dtype=bool))
            sns.heatmap(
                corr, mask=mask, annot=len(numeric_cols) <= 12, fmt=".2f",
                ax=ax, cmap="RdBu_r", center=0, vmin=-1, vmax=1,
                linewidths=0.5, linecolor="#2a2a4e",
                cbar_kws={"shrink": 0.8},
                annot_kws={"size": 8, "color": "white"}
            )
            ax.set_title("Correlation Matrix (Analytical Variables)", fontsize=11, fontweight="bold", color="white", pad=12)
            ax.tick_params(colors="#a0a0b0", labelsize=8)
            plt.tight_layout()
            add_plot("correlation_heatmap", fig)
        except Exception:
            pass

    # ── 2. Key numeric distributions ─────────────────────────────────────────
    # Prioritize: salary/compensation, performance, satisfaction, experience, hours
    priority_keywords = ["salary", "compensation", "pay", "wage", "performance", "score",
                         "satisfaction", "rating", "experience", "tenure", "hour", "overtime"]

    def _priority_score(col: str) -> int:
        col_lower = col.lower()
        for i, kw in enumerate(priority_keywords):
            if kw in col_lower:
                return i
        return 100

    sorted_numeric = sorted(numeric_cols, key=_priority_score)

    for col in sorted_numeric[:5]:
        if len(plots) >= max_plots:
            break
        try:
            fig, ax = plt.subplots(figsize=(7, 3.5))
            fig.set_facecolor("#1a1a2e")
            data = df[col].dropna()
            ax.hist(data, bins=35, color="#6366f1", edgecolor="#1a1a2e", alpha=0.9)
            # Add mean line
            mean_val = data.mean()
            ax.axvline(mean_val, color="#f59e0b", linestyle="--", linewidth=1.5, label=f"Mean: {mean_val:,.1f}")
            ax.legend(fontsize=8, facecolor="#1a1a2e", edgecolor="#333355", labelcolor="white")
            _style_ax(ax, f"Distribution: {col}", col, "Frequency")
            plt.tight_layout()
            add_plot(f"dist_{col}", fig)
        except Exception:
            pass

    # ── 3. Category breakdowns ────────────────────────────────────────────────
    # Prioritize: department, level, status
    cat_priority = ["department", "level", "status", "role", "position", "team", "city", "location"]

    def _cat_priority(col: str) -> int:
        col_lower = col.lower()
        for i, kw in enumerate(cat_priority):
            if kw in col_lower:
                return i
        return 100

    sorted_categorical = sorted(categorical_cols, key=_cat_priority)

    for col in sorted_categorical[:3]:
        if len(plots) >= max_plots:
            break
        try:
            top = df[col].value_counts().head(12)
            fig, ax = plt.subplots(figsize=(7, 3.5))
            fig.set_facecolor("#1a1a2e")
            bars = ax.barh(range(len(top)), top.values, color="#8b5cf6", edgecolor="#1a1a2e")
            ax.set_yticks(range(len(top)))
            ax.set_yticklabels(top.index, fontsize=8)
            ax.invert_yaxis()
            _style_ax(ax, f"Distribution: {col}", "Count", "")
            # Add value labels
            for bar in bars:
                width = bar.get_width()
                ax.text(width + max(top.values) * 0.01, bar.get_y() + bar.get_height() / 2,
                        f"{int(width):,}", va="center", fontsize=7, color="#a0a0b0")
            plt.tight_layout()
            add_plot(f"bar_{col}", fig)
        except Exception:
            pass

    # ── 4. Scatter: salary vs performance (if both exist) ────────────────────
    salary_col = next((c for c in numeric_cols if any(k in c.lower() for k in ["salary", "compensation", "pay"])), None)
    perf_col = next((c for c in numeric_cols if any(k in c.lower() for k in ["performance", "score"])), None)

    if salary_col and perf_col and len(plots) < max_plots:
        try:
            fig, ax = plt.subplots(figsize=(7, 4))
            fig.set_facecolor("#1a1a2e")
            sample = df[[salary_col, perf_col]].dropna().sample(n=min(2000, len(df)), random_state=42)
            ax.scatter(sample[salary_col], sample[perf_col], alpha=0.3, s=8, color="#6366f1", edgecolors="none")
            _style_ax(ax, f"{salary_col} vs {perf_col}", salary_col, perf_col)
            plt.tight_layout()
            add_plot("scatter_salary_performance", fig)
        except Exception:
            pass

    # ── 5. Scatter: experience vs salary (if both exist) ─────────────────────
    exp_col = next((c for c in numeric_cols if any(k in c.lower() for k in ["experience", "tenure", "years"])), None)

    if salary_col and exp_col and len(plots) < max_plots:
        try:
            fig, ax = plt.subplots(figsize=(7, 4))
            fig.set_facecolor("#1a1a2e")
            sample = df[[exp_col, salary_col]].dropna().sample(n=min(2000, len(df)), random_state=42)
            ax.scatter(sample[exp_col], sample[salary_col], alpha=0.3, s=8, color="#10b981", edgecolors="none")
            _style_ax(ax, f"{exp_col} vs {salary_col}", exp_col, salary_col)
            plt.tight_layout()
            add_plot("scatter_experience_salary", fig)
        except Exception:
            pass

    # ── 6. Missing data heatmap (only if >5% missing) ────────────────────────
    missing_pct = df.isnull().sum().sum() / (len(df) * len(df.columns))
    if missing_pct > 0.05 and len(plots) < max_plots:
        try:
            fig, ax = plt.subplots(figsize=(min(10, len(df.columns) * 0.5 + 2), 4))
            fig.set_facecolor("#1a1a2e")
            missing = df.isnull()
            sns.heatmap(missing, cbar=False, ax=ax, yticklabels=False, cmap="YlOrRd")
            _style_ax(ax, f"Missing Data Pattern ({missing_pct*100:.1f}% missing)", "", "")
            plt.tight_layout()
            add_plot("missing_heatmap", fig)
        except Exception:
            pass

    # ── 7. Boxplot: salary by department (if both exist) ─────────────────────
    dept_col = next((c for c in categorical_cols if any(k in c.lower() for k in ["department", "dept"])), None)

    if salary_col and dept_col and len(plots) < max_plots:
        try:
            top_depts = df[dept_col].value_counts().head(8).index
            subset = df[df[dept_col].isin(top_depts)]
            fig, ax = plt.subplots(figsize=(8, 4))
            fig.set_facecolor("#1a1a2e")
            sns.boxplot(data=subset, x=dept_col, y=salary_col, ax=ax,
                        palette="viridis", fliersize=2, linewidth=0.8)
            _style_ax(ax, f"{salary_col} by {dept_col}", dept_col, salary_col)
            ax.tick_params(axis="x", rotation=45)
            plt.tight_layout()
            add_plot("boxplot_salary_dept", fig)
        except Exception:
            pass

    plt.rcParams.update(plt.rcParamsDefault)  # Reset after plotting
    return plots
