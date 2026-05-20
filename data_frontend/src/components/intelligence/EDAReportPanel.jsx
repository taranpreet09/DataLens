import { useState, useEffect } from 'react';
import { intelligenceApi } from '../../lib/api';
import { renderMarkdown } from '../../lib/intelligenceMarkdown';
import IntelligenceErrorBanner from './IntelligenceErrorBanner';

/**
 * EDAReportPanel — Professional stakeholder-ready EDA report.
 */
export default function EDAReportPanel({ datasetId, cachedReport, datasetRowCount }) {
  const [report, setReport] = useState(cachedReport ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
          <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
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

      {/* Loading */}
      {loading && (
        <div className="bg-surface-container rounded-xl border border-primary/15 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Spinner />
            <p className="text-sm font-semibold text-on-surface">Building EDA report…</p>
          </div>
          <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-[indeterminate_2s_ease-in-out_infinite]" />
          </div>
          <p className="text-xs text-on-surface-variant">Profiling data, generating visualizations, and writing AI narrative…</p>
        </div>
      )}

      {error && <IntelligenceErrorBanner error={error} />}

      {/* Report content */}
      {report && (
        <div className="space-y-8">
          {/* KPI Dashboard */}
          <KPIDashboard profile={report.profile} sampling={report.samplingApplied} datasetRowCount={datasetRowCount} />

          {/* AI Narrative */}
          {report.fullMarkdown && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary text-lg">auto_awesome</span>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">AI Analysis</p>
              </div>
              <div
                className="prose prose-invert prose-sm max-w-none text-on-surface-variant leading-relaxed
                  [&_h2]:text-on-surface [&_h2]:font-headline [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-outline-variant/10 [&_h2]:pb-2
                  [&_h3]:text-on-surface [&_h3]:font-semibold [&_h3]:text-sm [&_h3]:mt-4 [&_h3]:mb-1
                  [&_p]:mb-2 [&_p]:text-sm [&_p]:leading-relaxed
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-0.5
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-0.5
                  [&_li]:text-sm [&_li]:leading-relaxed
                  [&_strong]:text-on-surface [&_strong]:font-semibold
                  [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_table]:my-3
                  [&_th]:bg-surface-container-high/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-bold [&_th]:text-on-surface-variant [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-[10px] [&_th]:border-b [&_th]:border-outline-variant/20
                  [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-outline-variant/10 [&_td]:text-on-surface-variant
                  [&_code]:bg-surface-container [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-primary
                  [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(report.fullMarkdown) }}
              />
            </div>
          )}

          {/* Missing narrative notice */}
          {!report.fullMarkdown && report.profile && (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-amber-400 text-lg">auto_awesome</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">AI Analysis unavailable</p>
                <p className="text-xs text-on-surface-variant mt-0.5">The narrative could not be generated (likely due to rate limits). Click "Regenerate EDA Report" to retry once your quota resets.</p>
              </div>
            </div>
          )}

          {/* Visualizations */}
          {report.plots && Object.keys(report.plots).length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">insights</span>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Visualizations</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(report.plots).map(([key, dataUri]) => (
                  <div key={key} className="bg-surface-container rounded-xl border border-outline-variant/10 p-3 space-y-2">
                    <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-widest">
                      {key.replace(/_/g, ' ').replace(/^(dist|bar|scatter|boxplot)\s/i, '')}
                    </p>
                    <img src={dataUri} alt={key} className="rounded-lg w-full" loading="lazy" />
                    {report.plotDescriptions?.[key] && (
                      <p className="text-xs text-on-surface-variant/70 italic">{report.plotDescriptions[key]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sampling notice */}
          {report.samplingApplied?.applied && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-sm">info</span>
              Profiled on a stratified sample of {report.samplingApplied.sampledRowCount?.toLocaleString()} rows
              from {report.samplingApplied.originalRowCount?.toLocaleString()} total.
            </div>
          )}

          {/* Timestamp */}
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
          <p className="text-sm">Click "Generate EDA Report" to run a full exploratory data analysis.</p>
        </div>
      )}
    </div>
  );
}

// ── KPI Dashboard ─────────────────────────────────────────────────────────────

function KPIDashboard({ profile, sampling, datasetRowCount }) {
  const table = profile?.table ?? profile?.overview?.table ?? null;
  if (!table) return null;

  const missingPct = table.p_missing != null ? (table.p_missing * 100) : 0;
  const totalRows = sampling?.applied
    ? sampling.originalRowCount
    : (datasetRowCount || table.n);

  const kpis = [
    { label: 'Total Records', value: totalRows?.toLocaleString() ?? '—', icon: 'database', status: 'neutral' },
    { label: 'Features', value: table.n_var?.toString() ?? '—', icon: 'view_column', status: 'neutral' },
    { label: 'Missing Data', value: `${missingPct.toFixed(1)}%`, icon: 'error_outline', status: missingPct > 10 ? 'bad' : missingPct > 5 ? 'warn' : 'good' },
    { label: 'Duplicates', value: table.n_duplicates?.toLocaleString() ?? '0', icon: 'content_copy', status: (table.n_duplicates ?? 0) > 0 ? 'warn' : 'good' },
    { label: 'Memory', value: table.memory_size ? `${(table.memory_size / (1024 * 1024)).toFixed(1)} MB` : '—', icon: 'memory', status: 'neutral' },
  ].filter(k => k.value !== '—');

  const statusColors = {
    good: 'text-emerald-400',
    warn: 'text-amber-400',
    bad: 'text-red-400',
    neutral: 'text-on-surface',
  };

  const statusDots = {
    good: 'bg-emerald-400',
    warn: 'bg-amber-400',
    bad: 'bg-red-400',
    neutral: 'bg-on-surface-variant/30',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-lg">dashboard</span>
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Dataset Overview</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(({ label, value, icon, status }) => (
          <div key={label} className="bg-surface-container rounded-xl border border-outline-variant/10 p-3 relative overflow-hidden">
            <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${statusDots[status]}`} />
            <span className="material-symbols-outlined text-on-surface-variant/40 text-lg mb-1">{icon}</span>
            <p className={`text-lg font-bold font-headline ${statusColors[status]}`}>{value}</p>
            <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return <span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />;
}
