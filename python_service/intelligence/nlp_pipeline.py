"""
NLP Pipeline — Intelligence Layer (5c)

Provides three analysis helpers for free-text columns:
  - vader_scores(texts)          → per-text compound sentiment scores
  - lda_topics(texts, n_topics)  → LDA topic model over TF-IDF features
  - tfidf_keywords(texts, n_kw)  → top TF-IDF keywords for the corpus
"""

from __future__ import annotations

from typing import Any


# ─── Sentiment (VADER) ────────────────────────────────────────────────────────

def vader_scores(texts: list[str]) -> list[float]:
    """
    Compute VADER compound sentiment scores for a list of texts.

    Returns a list of floats in [-1.0, 1.0]:
      > 0.05  → positive
      < -0.05 → negative
      else    → neutral
    """
    from nltk.sentiment.vader import SentimentIntensityAnalyzer  # type: ignore

    sia = SentimentIntensityAnalyzer()
    return [sia.polarity_scores(str(t))["compound"] for t in texts]


def aggregate_sentiment(scores: list[float]) -> dict[str, int]:
    """
    Aggregate per-row compound scores into positive / neutral / negative counts.
    """
    positive = sum(1 for s in scores if s > 0.05)
    negative = sum(1 for s in scores if s < -0.05)
    neutral = len(scores) - positive - negative
    return {"positive": positive, "neutral": neutral, "negative": negative}


# ─── Topic Modelling (LDA over TF-IDF) ───────────────────────────────────────

def lda_topics(
    texts: list[str],
    n_topics: int = 5,
    top_terms: int = 8,
) -> list[dict[str, Any]]:
    """
    Fit a Latent Dirichlet Allocation model over a TF-IDF vectorisation of
    the texts and return the top terms per topic.

    Returns a list of dicts:
      [{ "id": int, "weight": float, "terms": [str, ...] }, ...]
    """
    from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore
    from sklearn.decomposition import LatentDirichletAllocation  # type: ignore

    # Vectorise
    vectorizer = TfidfVectorizer(
        max_features=1000,
        stop_words="english",
        min_df=2,
        max_df=0.95,
    )
    X = vectorizer.fit_transform(texts)
    feature_names = vectorizer.get_feature_names_out()

    # Fit LDA
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=20,
    )
    lda.fit(X)

    # Extract top terms per topic
    topics = []
    for idx, component in enumerate(lda.components_):
        top_indices = component.argsort()[: -(top_terms + 1) : -1]
        terms = [str(feature_names[i]) for i in top_indices]
        weight = float(component.sum())
        topics.append({"id": idx, "weight": round(weight, 4), "terms": terms})

    return topics


# ─── Keyword Extraction (TF-IDF) ─────────────────────────────────────────────

def tfidf_keywords(
    texts: list[str],
    n_keywords: int = 20,
) -> list[dict[str, Any]]:
    """
    Extract the top TF-IDF keywords for the whole corpus.

    Returns a list of dicts sorted descending by score:
      [{ "term": str, "score": float }, ...]
    """
    import numpy as np  # type: ignore
    from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore

    vectorizer = TfidfVectorizer(
        max_features=500,
        stop_words="english",
        min_df=1,
        max_df=0.95,
    )
    X = vectorizer.fit_transform(texts)
    feature_names = vectorizer.get_feature_names_out()

    # Mean TF-IDF score across all documents
    mean_scores = np.asarray(X.mean(axis=0)).flatten()
    top_indices = mean_scores.argsort()[::-1][:n_keywords]

    return [
        {"term": str(feature_names[i]), "score": round(float(mean_scores[i]), 6)}
        for i in top_indices
    ]
