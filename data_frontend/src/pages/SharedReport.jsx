import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collaborationApi } from '../lib/api';
import CorrelationHeatmap from '../components/charts/CorrelationHeatmap';
import QualityBadge from '../components/ui/QualityBadge';

/**
 * Public read-only view of a shared report.
 * Accessible without authentication via /shared/:token
 */
export default function SharedReport() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    collaborationApi.getSharedReport(token)
      .then(data => { setReport(data); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-on-surface-variant text-sm">Loading shared report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <span className="material-symbols-outlined text-5xl text-error">link_off</span>
          <h1 className="text-2xl font-bold text-white">Report Not Found</h1>
          <p className="text-on-surface-variant text-sm">{error}</p>
          <a href="/" className="inline-block mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium">
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const stats = report.stats;
  const numCols = stats?.numericColumns || [];

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      {/* Header banner */}
      <header className="border-b border-outline-variant/10 bg-surface-container-low/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-xl">analytics</span>
            <span className="font-headline font-bold text-sm tracking-tight">Data Lens</span>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant bg-surface-container px-3 py-1 rounded-full border border-outline-variant/20">
            Shared Report
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-8">
        {/* Title */}
        <section className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold font-headline tracking-tighter">
            {report.name?.split('.')[0]}
          </h1>
          <p className="text-on-surface-variant text-sm">
            {report.rowCount?.toLocaleString()} rows · {report.headers?.length} columns
            {stats && ` · Quality: ${stats.qualityScore}/100`}
          </p>
          <p className="text-[10px] text-on-surface-variant">
            Generated {new Date(report.updatedAt || report.createdAt).toLocaleDateString()}
          </p>
        </section>

        {/* Quality badge */}
        {stats && (
          <section className="flex items-center gap-4">
            <QualityBadge score={stats.qualityScore} />
          </section>
        )}

        {/* Narrative */}
        {report.narrative?.fullMarkdown && (
          <section className="bg-surface-container-low rounded-2xl border border-primary/20 p-6">
            <h2 className="text-xl font-bold font-headline mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
              AI Narrative
            </h2>
            <div className="prose prose-invert prose-sm max-w-none text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {report.narrative.fullMarkdown}
            </div>
          </section>
        )}

        {/* Summary stats */}
        {stats && numCols.length > 0 && (
          <section className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10">
              <h2 className="text-xl font-bold font-headline">Statistical Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-high/50">
                  <tr>
                    {['Column', 'Mean', 'Median', 'Min', 'Max', 'σ', 'Skew'].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {numCols.map(col => {
                    const s = stats.numericStats?.[col];
                    if (!s) return null;
                    return (
                      <tr key={col} className="border-b border-outline-variant/5">
                        <td className="px-4 py-3 font-medium">{col}</td>
                        <td className="px-4 py-3 font-mono text-primary">{s.mean?.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono">{s.median?.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono">{s.min?.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono">{s.max?.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono">{s.stdDev?.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono">{s.skewness ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Correlation matrix */}
        {stats?.correlationMatrix && numCols.length > 1 && (
          <section className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-6">
            <h2 className="text-xl font-bold font-headline mb-4">Correlation Matrix</h2>
            <CorrelationHeatmap
              matrix={stats.correlationMatrix}
              spearmanMatrix={stats.spearmanMatrix}
              columns={numCols}
              insights={stats.correlationInsights}
            />
          </section>
        )}

        {/* Sample data */}
        {report.sampleRows?.length > 0 && (
          <section className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10">
              <h2 className="text-xl font-bold font-headline">Sample Data</h2>
              <p className="text-xs text-on-surface-variant mt-1">First {report.sampleRows.length} rows</p>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-high/50 sticky top-0">
                  <tr>
                    {report.headers?.slice(0, 10).map(h => (
                      <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant whitespace-nowrap">{h}</th>
                    ))}
                    {report.headers?.length > 10 && (
                      <th className="px-3 py-2 text-[10px] text-on-surface-variant">+{report.headers.length - 10} more</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.sampleRows.map((row, i) => (
                    <tr key={i} className="border-b border-outline-variant/5">
                      {report.headers?.slice(0, 10).map(h => (
                        <td key={h} className="px-3 py-2 font-mono whitespace-nowrap max-w-[150px] truncate">
                          {row[h] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/5 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
            Powered by Data Lens Engine
          </p>
        </div>
      </footer>
    </div>
  );
}
