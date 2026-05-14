import { useState } from 'react';
import { intelligenceApi } from '../../lib/api';
import IntelligenceErrorBanner from './IntelligenceErrorBanner';

/**
 * TextNlpPanel — per-column NLP analysis (sentiment, topics, keywords).
 *
 * Props:
 *   datasetId   (string)   — the active dataset's ID
 *   textColumns (string[]) — array of text column names
 */
export default function TextNlpPanel({ datasetId, textColumns }) {
  // Map of column → { loading, result, error }
  const [columnState, setColumnState] = useState({});

  const setCol = (col, patch) =>
    setColumnState((prev) => ({
      ...prev,
      [col]: { ...prev[col], ...patch },
    }));

  const handleAnalyze = async (col) => {
    setCol(col, { loading: true, result: null, error: null });
    try {
      const data = await intelligenceApi.nlpText(datasetId, { column: col });
      setCol(col, { loading: false, result: data });
    } catch (err) {
      setCol(col, { loading: false, error: err });
    }
  };

  if (!textColumns || textColumns.length === 0) return null;

  return (
    <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-secondary/15 flex items-center justify-center shrink-0">
          <span
            className="material-symbols-outlined text-secondary text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            text_fields
          </span>
        </div>
        <div>
          <h3 className="font-headline font-bold text-sm">Text Column NLP</h3>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">
            Sentiment · Topics · Keywords
          </p>
        </div>
      </div>

      {/* Per-column panels */}
      <div className="space-y-4">
        {textColumns.map((col) => {
          const cs = columnState[col] ?? {};
          return (
            <ColumnPanel
              key={col}
              column={col}
              loading={cs.loading ?? false}
              result={cs.result ?? null}
              error={cs.error ?? null}
              onAnalyze={() => handleAnalyze(col)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Per-column panel ──────────────────────────────────────────────────────────

function ColumnPanel({ column, loading, result, error, onAnalyze }) {
  const isInsufficient =
    error?.code === 'INSUFFICIENT_TEXT_DATA' ||
    (error?.message ?? '').includes('INSUFFICIENT_TEXT_DATA');

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden">
      {/* Column header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant text-sm">text_snippet</span>
          <span className="text-sm font-semibold text-on-surface">{column}</span>
        </div>
        {!result && (
          <button
            onClick={onAnalyze}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Spinner />
                Analyzing…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xs">psychology</span>
                Analyze text
              </>
            )}
          </button>
        )}
        {result && (
          <button
            onClick={onAnalyze}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:text-on-surface transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xs">refresh</span>
            Re-analyze
          </button>
        )}
      </div>

      {/* Error states */}
      {error && (
        <div className="p-4">
          {isInsufficient ? (
            <p className="text-sm text-on-surface-variant">
              This column does not have enough text to analyze (needs at least 10 non-empty rows).
            </p>
          ) : (
            <IntelligenceErrorBanner error={error} />
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="p-4 space-y-5">
          {/* Sentiment summary */}
          {result.sentiment?.summary && (
            <SentimentSummary summary={result.sentiment.summary} />
          )}

          {/* Topics */}
          {result.topics?.length > 0 && (
            <TopicsList topics={result.topics} />
          )}

          {/* Keywords */}
          {result.keywords?.length > 0 && (
            <KeywordsTable keywords={result.keywords} />
          )}

          {/* Row count */}
          {result.rowCount !== undefined && (
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
              Analyzed {result.rowCount.toLocaleString()} rows · {result.model}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sentiment summary ─────────────────────────────────────────────────────────

function SentimentSummary({ summary }) {
  const { positive = 0, neutral = 0, negative = 0 } = summary;
  const total = positive + neutral + negative || 1;

  const bars = [
    { label: 'Positive', count: positive, color: 'bg-secondary', textColor: 'text-secondary', pct: Math.round((positive / total) * 100) },
    { label: 'Neutral', count: neutral, color: 'bg-on-surface-variant', textColor: 'text-on-surface-variant', pct: Math.round((neutral / total) * 100) },
    { label: 'Negative', count: negative, color: 'bg-error', textColor: 'text-error', pct: Math.round((negative / total) * 100) },
  ];

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
        Sentiment
      </p>
      <div className="space-y-2">
        {bars.map(({ label, count, color, textColor, pct }) => (
          <div key={label} className="flex items-center gap-3">
            <span className={`text-xs font-semibold w-16 shrink-0 ${textColor}`}>{label}</span>
            <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-on-surface-variant w-12 text-right tabular-nums">
              {count.toLocaleString()} ({pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Topics list ───────────────────────────────────────────────────────────────

function TopicsList({ topics }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
        Topics
      </p>
      <div className="space-y-2">
        {topics.map((topic) => (
          <div key={topic.id} className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-on-surface-variant/60 font-mono w-6 shrink-0">
              T{topic.id + 1}
            </span>
            {(topic.terms ?? []).map((term) => (
              <span
                key={term}
                className="px-2 py-0.5 text-xs rounded-full bg-primary/10 border border-primary/20 text-primary font-medium"
              >
                {term}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Keywords table ────────────────────────────────────────────────────────────

function KeywordsTable({ keywords }) {
  const top10 = keywords.slice(0, 10);
  const maxScore = top10[0]?.score ?? 1;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
        Keywords (top 10)
      </p>
      <div className="space-y-1.5">
        {top10.map(({ term, score }) => (
          <div key={term} className="flex items-center gap-3">
            <span className="text-xs text-on-surface font-medium w-32 truncate shrink-0">{term}</span>
            <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-tertiary rounded-full"
                style={{ width: `${Math.round((score / maxScore) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-on-surface-variant tabular-nums w-12 text-right">
              {score.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span className="w-3.5 h-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  );
}
