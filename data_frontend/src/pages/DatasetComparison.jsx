import { useState, useCallback } from 'react';
import { useDataset } from '../context/DatasetContext';
import { collaborationApi } from '../lib/api';

export default function DatasetComparison() {
  const { datasets, activeDataset } = useDataset();
  const [compareToId, setCompareToId] = useState('');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const readyDatasets = datasets.filter(d => d.status === 'ready' && d.dbId);
  const otherDatasets = readyDatasets.filter(d => d.id !== activeDataset?.id);

  const runComparison = useCallback(async () => {
    if (!activeDataset?.dbId || !compareToId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await collaborationApi.compare(activeDataset.dbId, compareToId);
      setComparison(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeDataset, compareToId]);

  if (!activeDataset || activeDataset.status !== 'ready') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">⚖️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Dataset Comparison</h2>
          <p className="text-gray-400">Upload and select a dataset to start comparing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-primary font-bold tracking-widest text-xs uppercase">
          <span className="material-symbols-outlined text-sm">compare_arrows</span>
          Dataset Comparison
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold font-headline tracking-tighter text-on-surface">
          Compare Datasets Side-by-Side
        </h1>
        <p className="text-on-surface-variant text-sm max-w-xl">
          Select a second dataset to compare structure, statistics, and quality metrics against <strong className="text-primary-dim">{activeDataset.name}</strong>.
        </p>
      </section>

      {/* Dataset selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <label className="text-xs text-gray-400 block mb-1">Compare with</label>
          <select
            value={compareToId}
            onChange={(e) => setCompareToId(e.target.value)}
            className="w-full px-3 py-2 bg-surface-container-high border border-outline-variant/20 rounded-lg text-on-surface text-sm"
          >
            <option value="">Select a dataset...</option>
            {otherDatasets.map(d => (
              <option key={d.dbId} value={d.dbId}>{d.name} ({d.rowCount?.toLocaleString()} rows)</option>
            ))}
          </select>
        </div>
        <button
          onClick={runComparison}
          disabled={loading || !compareToId}
          className="px-5 py-2 bg-primary hover:bg-primary-fixed-dim text-on-primary-container font-semibold rounded-lg text-sm disabled:opacity-50 transition-all"
        >
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Overview cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DatasetCard dataset={comparison.datasetA} label="Dataset A" color="primary" />
            <DatasetCard dataset={comparison.datasetB} label="Dataset B" color="secondary" />
          </div>

          {/* Column overlap */}
          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-6">
            <h3 className="text-lg font-bold font-headline mb-4">Column Overlap</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2">
                  Common ({comparison.commonColumns.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {comparison.commonColumns.map(col => (
                    <span key={col} className="px-2 py-0.5 bg-green-500/15 text-green-300 rounded text-xs border border-green-500/20">
                      {col}
                    </span>
                  ))}
                  {comparison.commonColumns.length === 0 && (
                    <span className="text-xs text-gray-500 italic">None</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2">
                  Only in A ({comparison.uniqueToA.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {comparison.uniqueToA.map(col => (
                    <span key={col} className="px-2 py-0.5 bg-blue-500/15 text-blue-300 rounded text-xs border border-blue-500/20">
                      {col}
                    </span>
                  ))}
                  {comparison.uniqueToA.length === 0 && (
                    <span className="text-xs text-gray-500 italic">None</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2">
                  Only in B ({comparison.uniqueToB.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {comparison.uniqueToB.map(col => (
                    <span key={col} className="px-2 py-0.5 bg-purple-500/15 text-purple-300 rounded text-xs border border-purple-500/20">
                      {col}
                    </span>
                  ))}
                  {comparison.uniqueToB.length === 0 && (
                    <span className="text-xs text-gray-500 italic">None</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Numeric comparison table */}
          {Object.keys(comparison.numericComparison || {}).length > 0 && (
            <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant/10">
                <h3 className="text-lg font-bold font-headline">Numeric Column Comparison</h3>
                <p className="text-xs text-on-surface-variant mt-1">Side-by-side statistics for shared numeric columns</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-container-high/50">
                    <tr>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Column</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-blue-300">Mean (A)</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-purple-300">Mean (B)</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Δ Mean</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-blue-300">σ (A)</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-purple-300">σ (B)</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-blue-300">Range (A)</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-purple-300">Range (B)</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {Object.entries(comparison.numericComparison).map(([col, data]) => (
                      <tr key={col} className="border-b border-outline-variant/5 hover:bg-surface-bright transition-colors">
                        <td className="px-4 py-3 font-medium">{col}</td>
                        <td className="px-4 py-3 font-mono text-blue-300">{fmt(data.a.mean)}</td>
                        <td className="px-4 py-3 font-mono text-purple-300">{fmt(data.b.mean)}</td>
                        <td className="px-4 py-3 font-mono">
                          <DiffBadge value={data.diff.meanPctChange} />
                        </td>
                        <td className="px-4 py-3 font-mono text-blue-300">{fmt(data.a.stdDev)}</td>
                        <td className="px-4 py-3 font-mono text-purple-300">{fmt(data.b.stdDev)}</td>
                        <td className="px-4 py-3 font-mono text-blue-300">{fmt(data.a.min)}–{fmt(data.a.max)}</td>
                        <td className="px-4 py-3 font-mono text-purple-300">{fmt(data.b.min)}–{fmt(data.b.max)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quality comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <QualityCard
              label="Dataset A"
              stats={comparison.datasetA.stats}
              color="blue"
            />
            <QualityCard
              label="Dataset B"
              stats={comparison.datasetB.stats}
              color="purple"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DatasetCard({ dataset, label, color }) {
  const colorClass = color === 'primary' ? 'border-blue-500/30' : 'border-purple-500/30';
  const textColor = color === 'primary' ? 'text-blue-300' : 'text-purple-300';

  return (
    <div className={`bg-surface-container-low rounded-2xl border ${colorClass} p-5`}>
      <p className={`text-[10px] uppercase tracking-widest font-bold ${textColor} mb-1`}>{label}</p>
      <h3 className="text-lg font-bold font-headline text-white truncate">{dataset.name}</h3>
      <div className="grid grid-cols-3 gap-3 mt-3">
        <div>
          <p className="text-[10px] text-gray-400">Rows</p>
          <p className="text-sm font-bold">{dataset.rowCount?.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">Columns</p>
          <p className="text-sm font-bold">{dataset.columnCount}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">Quality</p>
          <p className="text-sm font-bold">{dataset.stats?.qualityScore ?? '—'}/100</p>
        </div>
      </div>
    </div>
  );
}

function QualityCard({ label, stats, color }) {
  const qf = stats?.qualityFlags;
  if (!qf) return null;

  const borderColor = color === 'blue' ? 'border-blue-500/20' : 'border-purple-500/20';
  const textColor = color === 'blue' ? 'text-blue-300' : 'text-purple-300';

  return (
    <div className={`bg-surface-container-low rounded-2xl border ${borderColor} p-5`}>
      <p className={`text-[10px] uppercase tracking-widest font-bold ${textColor} mb-3`}>{label} — Quality</p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-surface-container rounded-lg p-2.5">
          <p className="text-[10px] text-gray-400">Nulls</p>
          <p className="font-bold">{qf.totalNullCount?.toLocaleString()} ({qf.nullPct}%)</p>
        </div>
        <div className="bg-surface-container rounded-lg p-2.5">
          <p className="text-[10px] text-gray-400">Duplicates</p>
          <p className="font-bold">{qf.duplicateRowCount} ({qf.duplicatePct}%)</p>
        </div>
        <div className="bg-surface-container rounded-lg p-2.5">
          <p className="text-[10px] text-gray-400">Empty Rows</p>
          <p className="font-bold">{qf.emptyRowCount}</p>
        </div>
        <div className="bg-surface-container rounded-lg p-2.5">
          <p className="text-[10px] text-gray-400">Score</p>
          <p className="font-bold">{stats.qualityScore}/100</p>
        </div>
      </div>
    </div>
  );
}

function DiffBadge({ value }) {
  if (value == null) return <span className="text-gray-500">—</span>;
  const isPositive = value > 0;
  const color = Math.abs(value) < 1 ? 'text-gray-400' : isPositive ? 'text-green-400' : 'text-red-400';
  return (
    <span className={`${color} font-bold`}>
      {isPositive ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

function fmt(n) {
  if (n == null) return '—';
  if (typeof n !== 'number') return String(n);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
