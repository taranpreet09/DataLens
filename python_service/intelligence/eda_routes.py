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
            df[col] = pd.to_numeric(df[col], errors="ignore")
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
            detail={
                "code": "PYTHON_UNAVAILABLE",
                "message": str(exc),
                "retryable": False,
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # ── Plots ─────────────────────────────────────────────────────────────────
    plots: dict[str, str] = {}
    if opts.includePlots:
        try:
            plots = render_plots(df, max_plots=12)
        except Exception:
            # Plots are best-effort — don't fail the whole request.
            plots = {}

    elapsed_ms = int((time.time() - t0) * 1000)

    return {
        "profile": profile,
        "plots": plots,
        "samplingApplied": sampling_applied,
        "elapsedMs": elapsed_ms,
    }
