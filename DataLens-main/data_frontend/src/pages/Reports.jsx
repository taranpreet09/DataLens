import { useState } from 'react';
import { useDataset } from '../context/DatasetContext';
import { exportReportToPDF } from '../lib/pdfExport';
import CorrelationHeatmap from '../components/charts/CorrelationHeatmap';
import InsightCard from '../components/ui/InsightCard';
import QualityBadge from '../components/ui/QualityBadge';
import QualityFlagChips from '../components/ui/QualityFlagChips';
import DynamicTimeSeries from '../components/charts/DynamicTimeSeries';

export default function Reports() {
  const { activeDataset, datasets, setActive } = useDataset();
  const [isExporting, setIsExporting] = useState(false);
  const ds = activeDataset;
  const stats = ds?.stats;

  const numCols = stats?.numericColumns ?? [];

  const handleExport = async () => {
    if (isExporting || !ds) return;
    setIsExporting(true);
    try {
      await exportReportToPDF(ds, `DataLens-Report-${ds.name.split('.')[0]}.pdf`);
    } catch (e) {
      console.error('PDF Export Error:', e);
      alert(`Failed to generate PDF: ${e.message || String(e)}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-8 lg:space-y-10 max-w-[1600px] mx-auto w-full relative">

      {/* Hero Header */}
      <section className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-end lg:gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest text-xs uppercase">
            <span className="material-symbols-outlined text-sm">analytics</span>
            Comprehensive Report
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-headline tracking-tighter text-on-surface">
            {ds ? (
              <>Report: <span className="text-primary-dim">{ds.name.split('.')[0]}</span></>
            ) : (
              <>Data Report: <span className="text-primary-dim">No Dataset</span></>
            )}
          </h1>
          <p className="text-on-surface-variant max-w-xl text-base lg:text-lg">
            {ds
              ? `${ds.rowCount?.toLocaleString()} rows · ${ds.headers?.length} columns · ${numCols.length} numeric · ${stats?.categoricalColumns?.length ?? 0} categorical · ${stats?.dateColumns?.length ?? 0} date`
              : 'Upload a dataset from the dashboard to generate reports.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {stats && <QualityBadge score={stats.qualityScore} />}
          {ds && (
            <button 
              onClick={handleExport} 
              disabled={isExporting}
              className="print:hidden bg-primary hover:bg-primary-fixed-dim text-on-primary-container font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-transform active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-wait">
              <span className="material-symbols-outlined text-sm">
                {isExporting ? 'hourglass_empty' : 'picture_as_pdf'}
              </span>
              {isExporting ? 'Generating PDF...' : 'Export PDF'}
            </button>
          )}
        </div>
      </section>

      {/* Dataset selector */}
      {datasets.filter(d => d.status === 'ready').length > 1 && (
        <div className="flex gap-2 flex-wrap print:hidden">
          {datasets.filter(d => d.status === 'ready').map(d => (
            <button key={d.id} onClick={() => setActive(d.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${d.id === ds?.id ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:text-white'}`}
            >{d.name}</button>
          ))}
        </div>
      )}

      {!ds && (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl opacity-30">description</span>
          <p>No dataset loaded. Upload a file from the Dashboard to generate reports.</p>
        </div>
      )}

      {ds && stats && (
        <div id="report-content" className="grid grid-cols-12 gap-4 lg:gap-6">

          {/* ── Time Series Overview ── */}
          <div className="col-span-12 lg:col-span-8 bg-surface-container-low rounded-2xl border border-outline-variant/5 p-5 sm:p-8 relative min-w-0 overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold font-headline mb-1">
                  {stats.timeSeries ? 'Time Series Overview' : 'Dataset Summary'}
                </h3>
                <p className="text-sm text-on-surface-variant">
                  {stats.timeSeries ? `${stats.timeSeries.series.length} periods · ${stats.timeSeries.trendDirection}` : 'No date column detected'}
                </p>
              </div>
            </div>
            <div className="h-72 w-full">
              {stats.timeSeries ? (
                <DynamicTimeSeries
                  data={stats.timeSeries.series}
                  trendLine={stats.timeSeries.trendLine}
                  peak={stats.timeSeries.peak}
                  trough={stats.timeSeries.trough}
                  trendDirection={stats.timeSeries.trendDirection}
                />
              ) : (
                <div className="grid grid-cols-2 gap-4 h-full">
                  {numCols.slice(0, 4).map(col => {
                    const s = stats.numericStats[col];
                    return s ? (
                      <div key={col} className="bg-surface-container rounded-xl p-4 flex flex-col justify-between">
                        <p className="text-xs text-on-surface-variant truncate">{col}</p>
                        <div>
                          <p className="text-2xl font-bold font-headline text-primary">{s.mean.toLocaleString()}</p>
                          <p className="text-[10px] text-on-surface-variant">Mean · σ {s.stdDev} · Skew {s.skewness}</p>
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Section 5: Correlation Matrix ── */}
          <div className="col-span-12 lg:col-span-4 bg-surface-container-low rounded-2xl border border-outline-variant/5 p-5 sm:p-8 min-w-0">
            <h3 className="text-xl font-bold font-headline mb-4">Correlation Matrix</h3>
            <CorrelationHeatmap
              matrix={stats.correlationMatrix}
              columns={numCols}
              insights={stats.correlationInsights}
            />
          </div>

          {/* ── Column Analysis Table ── */}
          <div className="col-span-12 bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden min-w-0">
            <div className="px-8 py-6 border-b border-outline-variant/5">
              <h3 className="text-xl font-bold font-headline">Numeric Column Analysis</h3>
              <p className="text-sm text-on-surface-variant mt-1">Full statistical profile of all numeric columns</p>
            </div>
            {numCols.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant opacity-40">
                <span className="material-symbols-outlined text-3xl">query_stats</span>
                <p className="text-xs mt-2">No numeric columns found</p>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-surface-container-high/50">
                    <tr>
                      {['Column', 'Sum', 'Mean', 'Median', 'Min', 'Max', 'σ', 'Var', 'IQR', 'Skew', 'CV%', 'Outliers (Z)', 'Outliers (IQR)'].map(h => (
                        <th key={h} className="px-5 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {numCols.map(col => {
                      const s = stats.numericStats[col];
                      if (!s) return null;
                      return (
                        <tr key={col} className="border-b border-outline-variant/5 hover:bg-surface-bright transition-colors">
                          <td className="px-5 py-4 font-medium text-sm">{col}</td>
                          <td className="px-5 py-4 font-mono">{s.sum.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono text-primary">{s.mean.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono">{s.median.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono">{s.min.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono">{s.max.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono">{s.stdDev.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono">{s.variance.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono">{s.iqr.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono">
                            <span className={Math.abs(s.skewness) > 0.5 ? 'text-amber-400 font-bold' : ''}>{s.skewness}</span>
                          </td>
                          <td className="px-5 py-4 font-mono">{s.cv ?? '—'}</td>
                          <td className="px-5 py-4 font-mono">
                            <span className={s.zscoreOutlierCount > 0 ? 'text-error font-bold' : 'text-secondary'}>{s.zscoreOutlierCount}</span>
                          </td>
                          <td className="px-5 py-4 font-mono">
                            <span className={s.iqrOutlierCount > 0 ? 'text-error font-bold' : 'text-secondary'}>{s.iqrOutlierCount}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Text Column Analysis Table ── */}
          {stats.textColumns && stats.textColumns.length > 0 && (
            <div className="col-span-12 bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden min-w-0">
              <div className="px-8 py-6 border-b border-outline-variant/5">
                <h3 className="text-xl font-bold font-headline flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">text_fields</span>
                  Text & Unstructured Data Analysis
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">Metrics on string lengths and symbol anomalies</p>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-surface-container-high/50">
                    <tr>
                      {['Column', 'Non-Empty', 'Avg Letters', 'Avg Words', 'Whitespace Anomalies', 'Special Chars (<>{}[])'].map(h => (
                        <th key={h} className="px-5 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {stats.textColumns.map(col => {
                      const s = stats.textStats[col];
                      if (!s) return null;
                      return (
                        <tr key={col} className="border-b border-outline-variant/5 hover:bg-surface-bright transition-colors">
                          <td className="px-5 py-4 font-medium text-sm">{col}</td>
                          <td className="px-5 py-4 font-mono">{s.totalNonEmpty.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono text-primary">{s.avgLength.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono">{s.avgWords.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono">
                            <span className={s.whitespaceAnomalies > 0 ? 'text-amber-400 font-bold' : 'text-secondary'}>{s.whitespaceAnomalies}</span>
                          </td>
                          <td className="px-5 py-4 font-mono">
                            <span className={s.specialCharAnomalies > 0 ? 'text-error font-bold' : 'text-secondary'}>{s.specialCharAnomalies}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Section 9: Auto-Generated Insights ── */}
          <div className="col-span-12 lg:col-span-6 bg-surface-container-high rounded-2xl border border-outline-variant/10 p-5 sm:p-8 min-w-0">
            <div className="flex items-center gap-2 text-tertiary mb-6">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <span className="text-sm font-bold uppercase tracking-widest">Auto-Generated Insights</span>
            </div>
            {stats.insights?.length > 0 ? (
              <div className="space-y-3">
                {stats.insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
              </div>
            ) : (
              <p className="text-on-surface-variant text-sm">Not enough data for insight generation.</p>
            )}
          </div>

          {/* ── Quality Summary Panel ── */}
          <div className="col-span-12 lg:col-span-6 space-y-6 min-w-0">
            <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-5 sm:p-8">
              <h3 className="text-xl font-bold font-headline mb-4">Data Quality Summary</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <QualityStat label="Total Rows" value={ds.rowCount?.toLocaleString()} icon="table_rows" />
                <QualityStat label="Duplicate Rows" value={stats.qualityFlags.duplicateRowCount} icon="content_copy" color={stats.qualityFlags.duplicateRowCount > 0 ? 'text-error' : 'text-secondary'} />
                <QualityStat label="Null Cells" value={`${stats.qualityFlags.totalNullCount.toLocaleString()} (${stats.qualityFlags.nullPct}%)`} icon="block" color={stats.qualityFlags.totalNullCount > 0 ? 'text-amber-400' : 'text-secondary'} />
                <QualityStat label="Empty Rows" value={stats.qualityFlags.emptyRowCount} icon="delete_sweep" />
              </div>
              <QualityFlagChips flags={stats.qualityFlags.flags} />
            </div>
          </div>
        </div>
      )}

      <footer className="print:hidden mt-16 py-8 border-t border-outline-variant/5 flex justify-between items-center text-[10px] text-on-surface-variant uppercase tracking-[0.2em]">
        <div>© 2024 DataLens Analytics Engine</div>
        <div className="flex gap-6">
          <a className="hover:text-primary transition-colors cursor-pointer">Documentation</a>
          <a className="hover:text-primary transition-colors cursor-pointer">System Status</a>
        </div>
      </footer>
    </div>
  );
}

function QualityStat({ label, value, icon, color = 'text-on-surface' }) {
  return (
    <div className="flex items-center gap-3 bg-surface-container rounded-lg p-3 border border-outline-variant/5">
      <span className="material-symbols-outlined text-on-surface-variant text-lg">{icon}</span>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{label}</p>
        <p className={`text-sm font-bold font-headline ${color}`}>{value}</p>
      </div>
    </div>
  );
}