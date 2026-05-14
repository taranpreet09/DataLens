import { useState, useEffect } from 'react';
import { intelligenceApi } from '../../lib/api';
import { renderMarkdown } from '../../lib/intelligenceMarkdown';
import IntelligenceErrorBanner from './IntelligenceErrorBanner';

/**
 * EDAReportPanel — generates and displays an automated EDA report.
 *
 * Props:
 *   datasetId    (string)  — the active dataset's ID
 *   cachedReport (object?) — persisted EDA report if available
 */
export default function EDAReportPanel({ datasetId, cachedReport }) {
  const [report, setReport] = useState(cachedReport ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If a cached report was passed in, use it immediately
  useEffect(() => {
    if (cachedReport) setReport(cachedReport);
  }, [cachedReport]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await intelligenceApi.edaGenerate(datasetId);
      setReport(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined text-primary text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            bar_chart
          </span>
          <div>
            <h2 className="text-xl font-bold font-headline tracking-tight">EDA Report</h2>
            <p className="text-xs text-on-surface-variant">Automated Exploratory Data Analysis</p>
          </div>
        </div>

        {!loading && (
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
          >
            <span className="material-symbols-outlined text-sm">
              {report ? 'refresh' : 'play_arrow'}
            </span>
            {report ? 'Regenerate EDA Report' : 'Generate EDA Report'}
          </button>
        )}
      </div>

      {/* Progress card */}
      {loading && (
        <div className="bg-surface-container rounded-xl border border-primary/15 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Spinner />
            <p className="text-sm font-semibold text-on-surface">
              Building EDA report — this can take up to 90 seconds
            </p>
          </div>
          {/* Indeterminate progress bar */}
          <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-[indeterminate_2s_ease-in-out_infinite]" />
          </div>
          <p className="text-xs text-on-surface-variant">
            Running ydata-profiling and generating AI narrative…
          </p>
        </div>
      )}

      {/* Error — keep any existing report visible */}
      {error && <IntelligenceErrorBanner error={error} />}

      {/* Report content */}
      {report && (
        <div className="space-y-6">
          {/* Narrative markdown */}
          {report.fullMarkdown && (
            <div
              className="prose prose-invert prose-sm max-w-none text-on-surface-variant leading-relaxed
                [&_h1]:text-on-surface [&_h1]:font-headline [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2
                [&_h2]:text-on-surface [&_h2]:font-headline [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2
                [&_h3]:text-on-surface [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1
                [&_h4]:text-on-surface [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1
                [&_p]:mb-3 [&_p]:text-sm
                [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1
                [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1
                [&_li]:text-sm
                [&_strong]:text-on-surface [&_strong]:font-semibold
                [&_code]:bg-surface-container [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-primary
                [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-on-surface-variant
                [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(report.fullMarkdown) }}
            />
          )}

          {/* Profile stats table */}
          <ProfileStatsTable profile={report.profile} />

          {/* Sampling notice */}
          {report.samplingApplied?.applied && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-sm">info</span>
              Dataset was sampled: {report.samplingApplied.sampledRowCount?.toLocaleString()} of{' '}
              {report.samplingApplied.originalRowCount?.toLocaleString()} rows used for profiling.
            </div>
          )}

          {/* Plot images */}
          {report.plots && Object.keys(report.plots).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">
                Plots
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(report.plots).map(([key, dataUri]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <img
                      src={dataUri}
                      alt={key}
                      className="rounded-lg max-w-full border border-outline-variant/10"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generation timestamp */}
          {report.generatedAt && (
            <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">
              Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!report && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl opacity-30">bar_chart</span>
          <p className="text-sm">
            Click "Generate EDA Report" to run a full exploratory data analysis.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Profile stats table ───────────────────────────────────────────────────────

function ProfileStatsTable({ profile }) {
  // Be defensive — profile shape varies
  const table = profile?.table ?? profile?.overview?.table ?? null;
  if (!table) return null;

  const rows = [
    { label: 'Rows', value: table.n },
    { label: 'Columns', value: table.n_var },
    { label: 'Missing cells', value: table.n_missing },
    { label: 'Missing (%)', value: table.p_missing != null ? `${(table.p_missing * 100).toFixed(1)}%` : undefined },
    { label: 'Duplicate rows', value: table.n_duplicates },
    { label: 'Memory size', value: table.memory_size != null ? `${(table.memory_size / 1024).toFixed(1)} KB` : undefined },
  ].filter((r) => r.value != null);

  if (rows.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">
        Profile Summary
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="bg-surface-container rounded-xl border border-outline-variant/10 p-3"
          >
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
              {label}
            </p>
            <p className="text-lg font-bold font-headline text-on-surface">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
  );
}
