import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataset } from '../context/DatasetContext';
import ArtifactTable from '../components/ui/ArtifactTable';
import QualityBadge from '../components/ui/QualityBadge';
import QualityFlagChips from '../components/ui/QualityFlagChips';
import InsightCard from '../components/ui/InsightCard';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LandingPage() {
  const { datasets, uploadDataset, deleteDataset, setActive } = useDataset();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleFiles = useCallback(async (files) => {
    setUploadError(null);
    let lastUploadedId = null;
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(ext)) { setUploadError(`"${file.name}" is not supported. Use CSV or Excel.`); continue; }
      if (file.size > 10 * 1024 * 1024) { setUploadError(`"${file.name}" exceeds the 10 MB limit.`); continue; }
      const newId = await uploadDataset(file);
      if (newId) lastUploadedId = newId;
    }
    if (lastUploadedId) { setActive(lastUploadedId); navigate('/visualizer'); }
  }, [uploadDataset, navigate, setActive]);

  const onDrop = useCallback((e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }, [handleFiles]);
  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const handleExplore = (id) => { setActive(id); navigate('/visualizer'); };

  // Get first ready dataset stats for dashboard overview
  const activeDs = datasets.find(d => d.status === 'ready');
  const stats = activeDs?.stats;

  return (
    <div className="p-4 sm:p-6 lg:p-12 h-full">
      <div className="max-w-6xl mx-auto space-y-8 lg:space-y-12">

        {/* Hero */}
        <header className="space-y-3 lg:space-y-4">
          <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-on-surface">
            Scale your <span className="text-primary">Intelligence</span>.
          </h1>
          <p className="text-on-surface-variant text-base lg:text-lg max-w-2xl leading-relaxed">
            Drag your structured datasets into the obsidian core. Our engine will architect the relationships, outliers, and projections automatically.
          </p>
        </header>

        {/* Upload Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          <div
            onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            className={`lg:col-span-8 group relative overflow-hidden rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-8 sm:p-12 lg:p-16 text-center cursor-pointer
              ${dragOver ? 'border-primary/80 bg-primary/5' : 'border-outline-variant/20 bg-surface-container-low hover:bg-surface-container hover:border-primary/50'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={`absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent transition-opacity ${dragOver ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
            <div className="relative space-y-6">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-surface-container-high flex items-center justify-center mx-auto shadow-2xl transition-transform ${dragOver ? 'scale-110' : 'group-hover:scale-110'}`}>
                <span className="material-symbols-outlined text-4xl text-primary">upload_file</span>
              </div>
              <div className="space-y-2">
                <h3 className="font-headline text-xl sm:text-2xl font-bold">{dragOver ? 'Drop to inject' : 'Inject New Dataset'}</h3>
                <p className="text-on-surface-variant text-sm max-w-xs mx-auto">Drop CSV, XLSX, or XLS files here. Maximum payload 10 MB per file.</p>
              </div>
              <button type="button" className="bg-surface-container-highest hover:bg-surface-bright text-on-surface px-8 py-3 rounded-md font-medium transition-colors pointer-events-none">Browse Files</button>
              {uploadError && <p className="text-error text-xs mt-2 bg-error/10 px-3 py-2 rounded">{uploadError}</p>}
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>

          {/* Side Panel — Dataset Overview Stats */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {stats ? (
              <>
                {/* Quality Score */}
                <div className="rounded-xl bg-surface-container-high p-5 border border-outline-variant/10">
                  <QualityBadge score={stats.qualityScore} />
                </div>
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <StatMini label="Rows" value={activeDs.rowCount?.toLocaleString()} icon="table_rows" />
                  <StatMini label="Columns" value={activeDs.headers?.length} icon="view_column" />
                  <StatMini label="File Size" value={formatBytes(activeDs.size)} icon="hard_drive" />
                  <StatMini label="Parse Time" value={`${activeDs.parseTime ?? '—'}ms`} icon="timer" />
                </div>
                {/* Primary Column Summary */}
                {stats.primaryCol && stats.numericStats[stats.primaryCol] && (
                  <div className="rounded-xl bg-surface-container-high p-4 border border-outline-variant/10 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Primary: {stats.primaryCol}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-on-surface-variant">Mean</span><p className="font-bold text-primary">{stats.numericStats[stats.primaryCol].mean.toLocaleString()}</p></div>
                      <div><span className="text-on-surface-variant">Median</span><p className="font-bold">{stats.numericStats[stats.primaryCol].median.toLocaleString()}</p></div>
                      <div><span className="text-on-surface-variant">σ</span><p className="font-bold">{stats.numericStats[stats.primaryCol].stdDev.toLocaleString()}</p></div>
                    </div>
                  </div>
                )}
                {/* Missing & Duplicate Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-surface-container-high p-3 border border-outline-variant/10 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Nulls</p>
                    <p className="text-lg font-bold font-headline">{stats.qualityFlags.totalNullCount.toLocaleString()}</p>
                    <p className="text-[10px] text-on-surface-variant">{stats.qualityFlags.nullPct}%</p>
                  </div>
                  <div className="rounded-lg bg-surface-container-high p-3 border border-outline-variant/10 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Dupes</p>
                    <p className="text-lg font-bold font-headline">{stats.qualityFlags.duplicateRowCount}</p>
                    <p className="text-[10px] text-on-surface-variant">{stats.qualityFlags.duplicatePct}%</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 rounded-xl bg-surface-container-high p-6 border border-outline-variant/10 flex flex-col items-center justify-center text-center gap-3 opacity-50">
                <span className="material-symbols-outlined text-3xl">monitoring</span>
                <p className="text-xs text-on-surface-variant">Upload a file to see dataset analytics here</p>
              </div>
            )}
          </div>
        </section>

        {/* Quality Flags */}
        {stats && (
          <section className="space-y-4">
            <h2 className="font-headline text-lg font-bold tracking-tight">Data Quality Flags</h2>
            <QualityFlagChips flags={stats.qualityFlags.flags} />
          </section>
        )}

        {/* Insight Cards */}
        {stats?.insights?.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <h2 className="font-headline text-lg font-bold tracking-tight">Auto-Generated Insights</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stats.insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
            </div>
          </section>
        )}

        {/* Recent Artifacts Table */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-headline text-xl sm:text-2xl font-bold tracking-tight">Recent Artifacts</h2>
              <span className="px-2 py-0.5 rounded bg-surface-container-highest text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Active Store</span>
              {datasets.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">{datasets.length} loaded</span>
              )}
            </div>
            <button onClick={() => navigate('/data-explorer')} className="text-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 cursor-pointer">
              View All <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
          <ArtifactTable datasets={datasets} onExplore={handleExplore} onDelete={deleteDataset} />
        </section>
      </div>
    </div>
  );
}

function StatMini({ label, value, icon }) {
  return (
    <div className="rounded-lg bg-surface-container-high p-3 border border-outline-variant/10 flex items-center gap-3">
      <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{label}</p>
        <p className="text-sm font-bold font-headline">{value}</p>
      </div>
    </div>
  );
}