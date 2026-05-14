"""
NLP Routes — Intelligence Layer (5c)

POST /intelligence/nlp/analyze
  Accepts { headers, rows, column, options? }
  Returns sentiment scores, LDA topics, and TF-IDF keywords for a text column.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


# ─── Request / Response models ────────────────────────────────────────────────

class NlpOptions(BaseModel):
    topicCount: Optional[int] = 5
    keywordCount: Optional[int] = 20
    sampleSize: Optional[int] = None  # reserved for future use


class NlpRequest(BaseModel):
    headers: list[str]
    rows: list[dict]
    column: str
    options: Optional[NlpOptions] = None


class NlpErrorResponse(BaseModel):
    code: str
    message: str
    retryable: bool = False


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/analyze")
def analyze_text_column(req: NlpRequest) -> dict[str, Any]:
    """
    Compute sentiment, topics, and keywords for a text column.

    Error codes:
      UNKNOWN_COLUMN          — column not in headers
      INSUFFICIENT_TEXT_DATA  — fewer than 10 non-empty values
    """
    from fastapi import HTTPException

    # ── Validate column ───────────────────────────────────────────────────────
    if req.column not in req.headers:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "UNKNOWN_COLUMN",
                "message": f"Column '{req.column}' is not present in the provided headers.",
                "retryable": False,
            },
        )

    # ── Extract non-empty text values ─────────────────────────────────────────
    col = req.column
    texts: list[str] = [
        str(row[col])
        for row in req.rows
        if row.get(col) is not None and str(row.get(col, "")).strip() != ""
    ]

    if len(texts) < 10:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INSUFFICIENT_TEXT_DATA",
                "message": (
                    f"Column '{col}' has only {len(texts)} non-empty values. "
                    "At least 10 are required for NLP analysis."
                ),
                "retryable": False,
            },
        )

    opts = req.options or NlpOptions()
    n_topics = max(1, opts.topicCount or 5)
    n_keywords = max(1, opts.keywordCount or 20)

    # ── Sentiment ─────────────────────────────────────────────────────────────
    from intelligence.nlp_pipeline import (  # type: ignore
        aggregate_sentiment,
        lda_topics,
        tfidf_keywords,
        vader_scores,
    )

    per_row_scores = vader_scores(texts)
    sentiment_summary = aggregate_sentiment(per_row_scores)
    avg_compound = round(sum(per_row_scores) / len(per_row_scores), 4) if per_row_scores else 0.0

    # ── Topics ────────────────────────────────────────────────────────────────
    # LDA requires at least 2 documents and at least 2 unique terms.
    try:
        topics = lda_topics(texts, n_topics=n_topics)
    except Exception:
        topics = []

    # ── Keywords ──────────────────────────────────────────────────────────────
    try:
        keywords = tfidf_keywords(texts, n_keywords=n_keywords)
    except Exception:
        keywords = []

    return {
        "sentiment": {
            "perRow": per_row_scores,
            "summary": sentiment_summary,
            "averageCompound": avg_compound,
        },
        "topics": topics,
        "keywords": keywords,
        "rowCount": len(texts),
        "model": "vader+lda+tfidf",
    }
