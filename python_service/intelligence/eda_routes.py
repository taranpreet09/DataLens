"""
EDA Routes — Intelligence Layer (5d)

POST /intelligence/eda/profile
  Accepts { headers, rows, options? }
  Returns a ydata-profiling JSON profile, optional plot images, and sampling info.
"""

from __future__ import annotations

import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

MAX_ROWS_BEFORE_SAMPLING = 50_000


# ─── Request model ────────────────────────────────────────────────────────────

class EdaOptions(BaseModel):
    minimal: Optional[bool] = True
    includePlots: Optional[bool] = True


class EdaRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    options: Optional[EdaOptions] = None


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/profile")
def eda_profile(req: EdaRequest) -> dict[str, Any]:
    """
    Run an EDA profile on the provided dataset.

    - Stratified-samples down to 50 000 rows when the input exceeds that limit.
    - Runs ydata-profiling in minimal mode by default.
    - Renders up to 12 plot images as base64 PNG data URIs when includePlots=True.
    """
    import pandas as pd
    from intelligence.eda_pipeline import render_plots, run_profile, stratified_sample  # type: ignore

    opts = req.options or EdaOptions()
    t0 = time.time()

    # ── Build DataFrame ───────────────────────────────────────────────────────
    try:
        df = pd.DataFrame(req.rows, columns=req.headers)
        for col in df.columns:
            converted = pd.to_numeric(df[col], errors="coerce")
            # Only apply numeric conversion if the column had numeric data
            if not converted.isna().all():
                df[col] = converted
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # ── Sampling ──────────────────────────────────────────────────────────────
    df, sampling_applied = stratified_sample(df, MAX_ROWS_BEFORE_SAMPLING)

    # ── Profile ───────────────────────────────────────────────────────────────
    try:
        profile = run_profile(df, minimal=opts.minimal if opts.minimal is not None else True)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # ── Plots ─────────────────────────────────────────────────────────────────
    plots: dict[str, str] = {}
    plot_descriptions: dict[str, str] = {}
    if opts.includePlots:
        try:
            plots = render_plots(df, max_plots=12)
            # Generate one-line descriptions for each chart
            plot_desc_map = {
                "correlation_heatmap": "Shows linear relationships between all analytical variables — darker red/blue = stronger correlation.",
                "missing_heatmap": "Visualizes pattern of missing data across columns — white = missing value.",
                "scatter_salary_performance": "Tests whether higher compensation correlates with better performance scores.",
                "scatter_experience_salary": "Shows how salary scales with years of experience.",
                "boxplot_salary_dept": "Compares salary distributions across departments — reveals pay equity gaps.",
            }
            for key in plots:
                if key in plot_desc_map:
                    plot_descriptions[key] = plot_desc_map[key]
                elif key.startswith("dist_"):
                    col_name = key[5:]
                    plot_descriptions[key] = f"Distribution shape of {col_name} — shows spread, skew, and concentration."
                elif key.startswith("bar_"):
                    col_name = key[4:]
                    plot_descriptions[key] = f"Top categories in {col_name} ranked by frequency."
        except Exception:
            plots = {}

    elapsed_ms = int((time.time() - t0) * 1000)

    return {
        "profile": profile,
        "plots": plots,
        "plotDescriptions": plot_descriptions,
        "samplingApplied": sampling_applied,
        "elapsedMs": elapsed_ms,
    }
