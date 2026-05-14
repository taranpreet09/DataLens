import { useState, useRef } from 'react';
import { intelligenceApi } from '../../lib/api';
import IntelligenceErrorBanner from './IntelligenceErrorBanner';

/**
 * NLQueryBox — free-form natural language query input for a dataset.
 *
 * Props:
 *   datasetId (string) — the active dataset's ID
 */
export default function NLQueryBox({ datasetId }) {
  const [question, setQuestion] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | success | refused | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const q = question.trim();
    if (!q || state === 'loading') return;

    setState('loading');
    setResult(null);
    setError(null);

    try {
      const data = await intelligenceApi.nlQuery(datasetId, q);
      if (data.intent === null) {
        setState('refused');
        setResult(data);
      } else {
        setState('success');
        setResult(data);
      }
    } catch (err) {
      setState('error');
      // Attempt to parse structured error envelope from the thrown Error
      setError(err);
    }
  };

  const handleChipClick = (toolName) => {
    setQuestion(toolName);
    inputRef.current?.focus();
  };

  const handleReset = () => {
    setState('idle');
    setResult(null);
    setError(null);
    setQuestion('');
  };

  return (
    <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-tertiary/15 flex items-center justify-center shrink-0">
          <span
            className="material-symbols-outlined text-tertiary text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            chat
          </span>
        </div>
        <div>
          <h3 className="font-headline font-bold text-sm">Ask a question about this dataset</h3>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">
            AI-powered natural language query
          </p>
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={state === 'loading'}
          placeholder="e.g. What are the top correlations in this dataset?"
          className="flex-1 bg-surface-container border border-outline-variant/20 rounded-xl py-2.5 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={state === 'loading' || !question.trim()}
          className="bg-primary hover:bg-primary-fixed-dim text-on-primary-container font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {state === 'loading' ? (
            <>
              <Spinner />
              Analyzing…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">send</span>
              Ask
            </>
          )}
        </button>
      </form>

      {/* Results */}
      {state === 'error' && error && (
        <IntelligenceErrorBanner error={error} />
      )}

      {state === 'refused' && result && (
        <RefusedPanel result={result} onChipClick={handleChipClick} />
      )}

      {state === 'success' && result && (
        <SuccessPanel result={result} />
      )}

      {(state === 'success' || state === 'refused' || state === 'error') && (
        <button
          onClick={handleReset}
          className="text-[10px] text-on-surface-variant hover:text-on-surface transition-colors uppercase tracking-widest font-bold flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-xs">refresh</span>
          Ask another question
        </button>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span className="w-4 h-4 rounded-full border-2 border-on-primary-container/30 border-t-on-primary-container animate-spin" />
  );
}

function RefusedPanel({ result, onChipClick }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 bg-surface-container rounded-xl border border-outline-variant/10 p-4">
        <span className="material-symbols-outlined text-on-surface-variant text-lg shrink-0 mt-0.5">
          info
        </span>
        <div>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {result.suggestion || "I couldn't map that question to a supported analysis. Try one of the suggestions below."}
          </p>
        </div>
      </div>

      {result.supportedTools?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
            Supported analyses
          </p>
          <div className="flex flex-wrap gap-2">
            {result.supportedTools.map((tool) => (
              <button
                key={tool}
                onClick={() => onChipClick(tool)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:border-primary/30 transition-all"
              >
                {tool.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessPanel({ result }) {
  const { intent, narrative, result: analysisResult, executionTimeMs } = result;

  return (
    <div className="space-y-4">
      {/* Narrative card */}
      {narrative && (
        <div className="bg-surface-container rounded-xl border border-primary/15 p-4">
          <p className="text-sm text-on-surface leading-relaxed">{narrative}</p>
        </div>
      )}

      {/* Tool badge + rationale */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold border border-primary/20">
          <span className="material-symbols-outlined text-xs">build</span>
          {intent.tool.replace(/_/g, ' ')}
        </span>
        {executionTimeMs && (
          <span className="text-[10px] text-on-surface-variant">
            {(executionTimeMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {intent.rationale && (
        <p className="text-xs text-on-surface-variant italic">{intent.rationale}</p>
      )}

      {/* Parameters used */}
      {intent.parameters && Object.keys(intent.parameters).length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
            Parameters
          </p>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
            {Object.entries(intent.parameters).map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-on-surface-variant font-semibold">{k}</dt>
                <dd className="text-on-surface font-mono truncate">
                  {Array.isArray(v) ? v.join(', ') : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Result preview */}
      {analysisResult !== undefined && analysisResult !== null && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
            Result
          </p>
          <pre className="text-xs overflow-auto bg-surface-container rounded-xl border border-outline-variant/10 p-3 max-h-64 text-on-surface-variant">
            {JSON.stringify(analysisResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
