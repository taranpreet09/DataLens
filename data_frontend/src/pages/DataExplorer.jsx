import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataset } from '../context/DatasetContext';
import { useAuth } from '../context/AuthContext';
import QualityFlagChips from '../components/ui/QualityFlagChips';
import { detectDirtyColumns } from '../lib/dataCleaner';
import { generateDataStories } from '../lib/dataStoryteller';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PAGE_SIZE = 10;

const typeColors = {
  numeric: 'bg-primary/10 text-primary',
  categorical: 'bg-tertiary/10 text-tertiary',
  date: 'bg-secondary/10 text-secondary',
  text: 'bg-surface-container-highest text-on-surface-variant',
  id: 'bg-amber-400/10 text-amber-400',
};

// ── Simple markdown-ish bold renderer ──
function renderStoryText(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-on-surface">$1</strong>');
}

export default function DataExplorer() {
  const { datasets, activeDataset, deleteDataset, setActive, uploadDataset, cleanDataset, exportDatasetCSV } = useDataset();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('columns'); // 'columns' | 'table' | 'outliers' | 'stories'
  const [cleanReport, setCleanReport] = useState(null);
  const [cleaning, setCleaning] = useState(false);

  const ds = activeDataset;
  const stats = ds?.stats;
  const totalPages = ds ? Math.ceil(ds.rows.length / PAGE_SIZE) : 0;
  const pageRows = ds ? ds.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];

  // Detect dirty columns for the "Standardize" preview
  const dirtyColumns = useMemo(() => {
    if (!ds || !stats) return [];
    return detectDirtyColumns(ds.headers, ds.rows, stats.columnTypes);
  }, [ds?.id, ds?.cleaned]);

  // Generate data stories
  const stories = useMemo(() => {
    if (!stats) return [];
    return generateDataStories(stats);
  }, [stats]);

  // Health score color
  const healthScore = stats?.qualityScore ?? 0;
  const healthColor = healthScore >= 90 ? 'text-secondary' : healthScore >= 75 ? 'text-primary' : healthScore >= 50 ? 'text-amber-400' : 'text-error';
  const healthBg = healthScore >= 90 ? 'bg-secondary/10' : healthScore >= 75 ? 'bg-primary/10' : healthScore >= 50 ? 'bg-amber-400/10' : 'bg-error/10';
  const healthRingColor = healthScore >= 90 ? 'stroke-secondary' : healthScore >= 75 ? 'stroke-primary' : healthScore >= 50 ? 'stroke-amber-400' : 'stroke-error';

  const handleFileInput = async (e) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    for (const file of Array.from(e.target.files)) await uploadDataset(file);
  };

  const handleClean = () => {
    if (!ds) return;
    setCleaning(true);
    // Use setTimeout to let the UI update before heavy computation
    setTimeout(() => {
      const report = cleanDataset(ds.id);
      setCleanReport(report);
      setCleaning(false);
    }, 50);
  };

  const handleExportCSV = () => {
    if (!ds) return;
    exportDatasetCSV(ds.id);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto h-full relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-headline tracking-tight mb-2">Data Explorer</h1>
          <p className="text-on-surface-variant max-w-md">
            {ds ? `${ds.rowCount?.toLocaleString()} rows · ${ds.headers?.length} columns · Analysing ${stats?.numericColumns?.length ?? 0} numeric fields` : 'Upload a dataset to begin exploration.'}
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3 flex-wrap">
          {ds && (
            <div className="flex gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/10">
              {[
                { key: 'columns', label: 'Columns' },
                { key: 'outliers', label: 'Outliers' },
                { key: 'table', label: 'Data' },
                { key: 'stories', label: 'Stories' },
              ].map(tab => (
                <button key={tab.key} onClick={() => { setViewMode(tab.key); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${viewMode === tab.key ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant hover:text-white'}`}
                >{tab.label}</button>
              ))}
            </div>
          )}
          <label className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary-container text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer active:scale-95">
            <span className="material-symbols-outlined text-lg">upload</span> Upload
            <input type="file" accept=".csv,.xlsx,.xls" multiple className="hidden" onChange={handleFileInput} />
          </label>
        </div>
      </div>

      {/* Dataset selector */}
      {datasets.filter(d => d.status === 'ready').length > 1 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {datasets.filter(d => d.status === 'ready').map(d => (
            <button key={d.id} onClick={() => setActive(d.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${d.id === ds?.id ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:text-white'}`}
            >{d.name}</button>
          ))}
        </div>
      )}

      {!ds && (
        <div className="bg-surface-container-low rounded-xl border border-dashed border-outline-variant/20 p-20 text-center space-y-4">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">folder_open</span>
          <p className="text-on-surface-variant">No datasets in library. Upload a file to get started.</p>
          <label className="inline-flex items-center gap-2 bg-primary/10 text-primary px-6 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-primary/20 transition-colors">
            <span className="material-symbols-outlined text-sm">upload_file</span> Browse Files
            <input type="file" accept=".csv,.xlsx,.xls" multiple className="hidden" onChange={handleFileInput} />
          </label>
        </div>
      )}

      {/* ── Health Score + Action Bar ── */}
      {ds && stats && (
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Health Score Card */}
          <div className={`lg:col-span-3 ${healthBg} rounded-2xl border border-outline-variant/10 p-6 flex items-center gap-5`}>
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-surface-container-highest" />
                <circle cx="40" cy="40" r="34" fill="none" strokeWidth="6" strokeLinecap="round"
                  className={healthRingColor}
                  strokeDasharray={`${(healthScore / 100) * 213.6} 213.6`}
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`font-headline font-extrabold text-xl ${healthColor}`}>{healthScore}</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Data Health</p>
              <p className={`font-headline font-bold text-lg ${healthColor}`}>
                {healthScore >= 90 ? 'Excellent' : healthScore >= 75 ? 'Good' : healthScore >= 50 ? 'Fair' : 'Poor'}
              </p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                {stats.qualityFlags.totalNullCount} nulls · {stats.qualityFlags.duplicateRowCount} dupes
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="lg:col-span-9 flex flex-wrap gap-3 items-start">
            {/* Standardize Data button */}
            <button
              onClick={handleClean}
              disabled={cleaning || ds.cleaned}
              className={`group flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer
                ${ds.cleaned
                  ? 'bg-secondary/10 text-secondary border border-secondary/20'
                  : 'bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20'
                } disabled:cursor-not-allowed`}
            >
              <span className="material-symbols-outlined text-lg">
                {ds.cleaned ? 'check_circle' : cleaning ? 'hourglass_top' : 'auto_fix_high'}
              </span>
              {ds.cleaned ? 'Data Standardized' : cleaning ? 'Cleaning...' : `Standardize Data${dirtyColumns.length > 0 ? ` (${dirtyColumns.length} issues)` : ''}`}
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="group flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Export CSV
            </button>

            {/* View Reports */}
            <button
              onClick={() => { setActive(ds.id); navigate('/reports'); }}
              className="group flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold bg-tertiary/10 text-tertiary border border-tertiary/20 hover:bg-tertiary/20 transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">bar_chart</span>
              View Reports
            </button>

            {/* Delete */}
            <button
              onClick={() => deleteDataset(ds.id)}
              className="group flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold bg-error/5 text-error/80 border border-error/10 hover:bg-error/10 hover:text-error transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Clean report toast */}
      {cleanReport && (
        <div className="mb-6 bg-surface-container-high rounded-xl border border-outline-variant/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-secondary text-lg">auto_fix_high</span>
            <h3 className="font-headline font-bold text-sm">Cleaning Report</h3>
            <button onClick={() => setCleanReport(null)} className="ml-auto text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          {cleanReport.totalChanges === 0 ? (
            <p className="text-sm text-secondary flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Your data is already clean! No changes needed.
            </p>
          ) : (
            <div className="space-y-2 text-sm text-on-surface-variant">
              <p><strong className="text-on-surface">{cleanReport.totalChanges.toLocaleString()}</strong> total cells modified</p>
              <div className="flex flex-wrap gap-4">
                {cleanReport.nullsStandardized > 0 && (
                  <span className="flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full bg-amber-400"></span> {cleanReport.nullsStandardized} N/A → null</span>
                )}
                {cleanReport.numericsCleaned > 0 && (
                  <span className="flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full bg-primary"></span> {cleanReport.numericsCleaned} numbers cleaned</span>
                )}
                {cleanReport.datesCleaned > 0 && (
                  <span className="flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full bg-secondary"></span> {cleanReport.datesCleaned} dates standardized</span>
                )}
              </div>
              {Object.entries(cleanReport.columnReports).slice(0, 5).map(([col, r]) => (
                <div key={col} className="text-xs bg-surface-container rounded-lg px-3 py-2">
                  <span className="font-semibold text-on-surface">{col}</span>: {r.changed} changes
                  {r.samples.length > 0 && (
                    <span className="text-on-surface-variant/60 ml-2">
                      e.g. "{r.samples[0].from}" → "{r.samples[0].to}"
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Section: Per-Column Stats ── */}
      {ds && viewMode === 'columns' && (
        <div className="space-y-6">
          <div className="bg-surface-container-low rounded-xl overflow-auto border border-outline-variant/10">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-surface-container-high sticky top-0">
                <tr>
                  {['Column', 'Type', 'Non-Null', 'Null %', 'Unique', 'Uniq %', 'Quality', 'Details'].map(h => (
                    <th key={h} className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {ds.headers.map(col => {
                  const b = stats?.columnBasics?.[col];
                  const type = stats?.columnTypes?.[col] ?? 'text';
                  const ns = stats?.numericStats?.[col];
                  const cs = stats?.categoricalStats?.[col];
                  const dts = stats?.dateStats?.[col];
                  if (!b) return null;

                  let detail = '';
                  if (type === 'numeric' && ns) {
                    detail = `μ=${ns.mean.toLocaleString()} | σ=${ns.stdDev.toLocaleString()} | ${ns.min.toLocaleString()}…${ns.max.toLocaleString()} | IQR=${ns.iqr.toLocaleString()} | Skew=${ns.skewness}`;
                  } else if (type === 'categorical' && cs) {
                    detail = `Mode: ${cs.mode} (${cs.concentrationRatio}%) | ${cs.cardinality} unique`;
                  } else if (type === 'date' && dts) {
                    detail = `${dts.earliest} → ${dts.latest} (${dts.rangeInDays}d)`;
                  } else if (type === 'id') {
                    detail = 'Identifier column';
                  }

                  return (
                    <tr key={col} className="hover:bg-surface-bright transition-colors">
                      <td className="px-5 py-4 font-medium">{col}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${typeColors[type]}`}>{type}</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">{b.nonNullCount.toLocaleString()}</td>
                      <td className="px-5 py-4 font-mono text-xs">
                        <span className={b.nullPct > 20 ? 'text-error font-bold' : b.nullPct > 0 ? 'text-amber-400' : 'text-secondary'}>{b.nullPct}%</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">{b.uniqueCount.toLocaleString()}</td>
                      <td className="px-5 py-4 font-mono text-xs">{b.uniquenessRatio}%</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold ${b.qualityStatus === 'Clean' ? 'text-secondary' : b.qualityStatus === 'All nulls' ? 'text-error' : 'text-amber-400'}`}>{b.qualityStatus}</span>
                      </td>
                      <td className="px-5 py-4 text-xs text-on-surface-variant max-w-[350px] truncate" title={detail}>{detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {stats?.qualityFlags?.flags?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold">Quality Flags</h3>
              <QualityFlagChips flags={stats.qualityFlags.flags} />
            </div>
          )}
        </div>
      )}

      {/* ── Section: Outlier & Anomaly Detection ── */}
      {ds && viewMode === 'outliers' && (
        <div className="space-y-8">
          <div className="bg-surface-container-low rounded-xl overflow-auto border border-outline-variant/10">
            <div className="px-6 py-5 border-b border-outline-variant/10">
              <h3 className="text-lg font-bold font-headline">Outlier Detection — Z-Score vs IQR</h3>
              <p className="text-xs text-on-surface-variant mt-1">Two methods compared side-by-side for each numeric column</p>
            </div>
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-surface-container-high">
                <tr>
                  {['Column', 'Z-Score Outliers', 'IQR Outliers', 'Lower Fence', 'Upper Fence', 'Disagree?', 'Skewness', 'CV %'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {(stats?.numericColumns ?? []).map(col => {
                  const s = stats?.numericStats?.[col];
                  const a = stats?.anomalies?.outlierComparison?.[col];
                  if (!s) return null;
                  return (
                    <tr key={col} className="hover:bg-surface-bright transition-colors">
                      <td className="px-5 py-4 font-medium">{col}</td>
                      <td className="px-5 py-4 font-mono text-xs">
                        <span className={s.zscoreOutlierCount > 0 ? 'text-error font-bold' : 'text-secondary'}>{s.zscoreOutlierCount}</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">
                        <span className={s.iqrOutlierCount > 0 ? 'text-error font-bold' : 'text-secondary'}>{s.iqrOutlierCount}</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">{s.iqrLowerFence.toLocaleString()}</td>
                      <td className="px-5 py-4 font-mono text-xs">{s.iqrUpperFence.toLocaleString()}</td>
                      <td className="px-5 py-4">
                        {a?.disagree ? (
                          <span className="px-2 py-1 rounded bg-amber-400/10 text-amber-400 text-[10px] font-bold">DISAGREE</span>
                        ) : (
                          <span className="text-xs text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">
                        <span className={Math.abs(s.skewness) > 0.5 ? 'text-amber-400' : ''}>{s.skewness}</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">{s.cv ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {stats?.anomalies && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <AnomalyCard title="Constant Columns" icon="block" items={stats.anomalies.constantColumns} description="Zero variance — useless for analysis" color="error" />
              <AnomalyCard title="Near-Constant Columns" icon="unfold_less" items={stats.anomalies.nearConstantColumns} description="Top value >95% of rows" color="amber-400" />
              <AnomalyCard title="Suspicious Patterns" icon="psychology_alt" items={stats.anomalies.suspiciousPatterns.map(p => p.description)} description="Monotonic, all-zeros, round numbers" color="tertiary" />
            </div>
          )}
        </div>
      )}

      {/* ── Raw Data Table ── */}
      {ds && viewMode === 'table' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-headline">{ds.name}</h2>
              <p className="text-sm text-on-surface-variant">{ds.rowCount?.toLocaleString()} rows · {ds.headers?.length} columns · Page {page} of {totalPages}</p>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl overflow-auto border border-outline-variant/10">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-surface-container-high sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant w-12">#</th>
                  {ds.headers.map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">
                      {h}
                      {stats?.columnTypes?.[h] && (
                        <span className={`ml-1 text-[9px] ${typeColors[stats.columnTypes[h]]?.split(' ')[1] || ''}`}>{stats.columnTypes[h].slice(0, 3).toUpperCase()}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {pageRows.map((row, i) => (
                  <tr key={i} className="hover:bg-surface-bright transition-colors">
                    <td className="px-4 py-3 text-on-surface-variant text-[10px] font-mono">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    {ds.headers.map(h => (
                      <td key={h} className="px-4 py-3 font-mono text-xs whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                        {row[h] === null || row[h] === undefined || row[h] === ''
                          ? <span className="text-on-surface-variant/40 italic">null</span>
                          : typeof row[h] === 'number'
                            ? <span className="text-primary">{row[h].toLocaleString()}</span>
                            : String(row[h])
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-on-surface-variant">
            <span>Rows {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, ds.rowCount).toLocaleString()} of {ds.rowCount?.toLocaleString()}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs font-medium">← Prev</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${p === page ? 'bg-primary text-on-primary' : 'bg-surface-container-high hover:bg-surface-bright'}`}
                  >{p}</button>
                );
              })}
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs font-medium">Next →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Data Stories (Plain-English Storytelling) ── */}
      {ds && viewMode === 'stories' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold font-headline mb-1">Data Stories</h2>
            <p className="text-sm text-on-surface-variant">Your dataset's key findings translated into plain English — ready for your next presentation.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stories.map((story, i) => (
              <div key={i} className={`bg-surface-container-low rounded-xl border border-outline-variant/10 p-5 hover:border-${story.severity}/20 transition-all`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-lg bg-${story.severity}/10 text-${story.severity} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-lg">{story.icon}</span>
                  </div>
                  <h4 className="font-headline font-bold text-sm">{story.title}</h4>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderStoryText(story.text) }} />
              </div>
            ))}
            {stories.length === 0 && (
              <p className="text-sm text-on-surface-variant col-span-2 text-center py-8">No stories to generate — upload a more complex dataset.</p>
            )}
          </div>
        </div>
      )}

      {/* FAB */}
      <label className="fixed bottom-10 right-10 bg-primary-container text-on-primary-container h-14 w-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group overflow-hidden cursor-pointer z-50">
        <span className="material-symbols-outlined text-2xl group-hover:rotate-90 transition-transform duration-300">add</span>
        <input type="file" accept=".csv,.xlsx,.xls" multiple className="hidden" onChange={handleFileInput} />
      </label>
    </div>
  );
}

function AnomalyCard({ title, icon, items, description, color }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
      <div className="flex items-center gap-2 mb-3">
        <span className={`material-symbols-outlined text-${color}`}>{icon}</span>
        <h4 className="font-bold text-sm">{title}</h4>
      </div>
      <p className="text-[10px] text-on-surface-variant mb-3">{description}</p>
      {items.length === 0 ? (
        <p className="text-xs text-secondary flex items-center gap-1"><span className="material-symbols-outlined text-sm">check</span> None detected</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, i) => (
            <p key={i} className="text-xs text-on-surface bg-surface-container rounded px-2 py-1.5 truncate">{item}</p>
          ))}
        </div>
      )}
    </div>
  );
}
