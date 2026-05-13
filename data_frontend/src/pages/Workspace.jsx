import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDataset } from '../context/DatasetContext';

import DataExplorer from './DataExplorer';
import DataQuality from './DataQuality';
import Visualizer from './Visualizer';
import StatisticalTests from './StatisticalTests';
import AnalysisPlayground from './AnalysisPlayground';
import QualityBadge from '../components/ui/QualityBadge';

/**
 * Workspace — a single dataset-scoped page with tabs.
 * Replaces the scattered per-feature pages with one focused surface.
 * Each tab simply renders the existing page component, so this shell is
 * non-invasive: the old pages keep working as-is.
 */

const TABS = [
  { id: 'overview',  label: 'Overview',    icon: 'dashboard' },
  { id: 'explore',   label: 'Explore',     icon: 'table_chart',  component: DataExplorer },
  { id: 'quality',   label: 'Quality',     icon: 'verified',     component: DataQuality },
  { id: 'visualize', label: 'Visualize',   icon: 'insights',     component: Visualizer },
  { id: 'tests',     label: 'Tests',       icon: 'science',      component: StatisticalTests },
  { id: 'lab',       label: 'Lab',         icon: 'psychology',   component: AnalysisPlayground },
];

export default function Workspace() {
  const { datasets, activeDataset, setActive } = useDataset();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabId = searchParams.get('tab') || 'overview';
  const tab = useMemo(() => TABS.find(t => t.id === tabId) || TABS[0], [tabId]);
  const Content = tab.component;

  const hasDatasets = datasets.length > 0;

  const goToTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: false });
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky workspace header */}
      <div className="sticky top-0 z-30 bg-[#0e0e0e]/95 backdrop-blur border-b border-[#262626]/50">
        <div className="px-4 sm:px-6 lg:px-10 pt-5 pb-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">Workspace</p>
            {activeDataset ? (
              <h1 className="font-headline text-xl lg:text-2xl font-bold tracking-tight truncate">
                {activeDataset.name}
              </h1>
            ) : (
              <h1 className="font-headline text-xl lg:text-2xl font-bold tracking-tight text-on-surface-variant">
                {hasDatasets ? 'Select a dataset' : 'No dataset loaded'}
              </h1>
            )}
          </div>

          {hasDatasets && (
            <label className="relative shrink-0">
              <span className="sr-only">Active dataset</span>
              <select
                value={activeDataset?.id || ''}
                onChange={e => setActive(e.target.value)}
                className="bg-surface-container-high text-on-surface text-sm rounded-lg pl-3 pr-8 py-2 border border-outline-variant/20 max-w-[220px] appearance-none cursor-pointer hover:border-primary/40 transition-colors"
              >
                {!activeDataset && <option value="">Pick a dataset…</option>}
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-base pointer-events-none">
                unfold_more
              </span>
            </label>
          )}
        </div>

        {/* Tab strip */}
        <nav className="px-2 sm:px-4 lg:px-8 flex items-center gap-0 overflow-x-auto scrollbar-thin">
          {TABS.map(t => {
            const isActive = t.id === tab.id;
            return (
              <button
                key={t.id}
                onClick={() => goToTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant/40'
                }`}
              >
                <span className="material-symbols-outlined text-base">{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab body */}
      <div className="flex-1 min-h-0">
        {!hasDatasets ? (
          <EmptyWorkspace />
        ) : tab.id === 'overview' ? (
          <OverviewTab dataset={activeDataset} onOpenTab={goToTab} />
        ) : Content ? (
          <Content />
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function EmptyWorkspace() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-16 flex items-center justify-center">
      <div className="max-w-md text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mx-auto border border-outline-variant/20">
          <span className="material-symbols-outlined text-3xl text-primary">folder_open</span>
        </div>
        <div className="space-y-2">
          <h2 className="font-headline text-2xl font-bold tracking-tight">No dataset loaded</h2>
          <p className="text-on-surface-variant text-sm">
            Upload a CSV or Excel file from the Datasets page to start exploring, cleaning, and analyzing it here.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-fixed-dim text-on-primary px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-base">upload_file</span>
          Go to Datasets
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({ dataset, onOpenTab }) {
  const navigate = useNavigate();

  if (!dataset) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 py-12">
        <p className="text-on-surface-variant text-sm">Select a dataset from the dropdown above.</p>
      </div>
    );
  }

  if (dataset.status !== 'ready' || !dataset.stats) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 py-12 text-center space-y-3">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant">hourglass_empty</span>
        <p className="text-on-surface-variant text-sm">
          {dataset.status === 'error'
            ? `Failed to parse: ${dataset.error || 'unknown error'}`
            : 'Parsing dataset…'}
        </p>
      </div>
    );
  }

  const { stats } = dataset;
  const primary = stats.primaryCol && stats.numericStats?.[stats.primaryCol];

  const quickCards = [
    { label: 'Rows',     value: dataset.rowCount?.toLocaleString(),        icon: 'table_rows' },
    { label: 'Columns',  value: dataset.headers?.length,                    icon: 'view_column' },
    { label: 'Size',     value: formatBytes(dataset.size),                  icon: 'hard_drive' },
    { label: 'Parse',    value: `${dataset.parseTime ?? '—'} ms`,           icon: 'timer' },
    { label: 'Nulls',    value: `${stats.qualityFlags.nullPct}%`,           icon: 'block',         hint: stats.qualityFlags.totalNullCount.toLocaleString() },
    { label: 'Duplicates', value: `${stats.qualityFlags.duplicatePct}%`,    icon: 'content_copy',  hint: stats.qualityFlags.duplicateRowCount },
  ];

  const shortcuts = [
    { tab: 'explore',   title: 'Explore rows',       desc: 'Scan values, filter, and inspect columns.',    icon: 'table_chart' },
    { tab: 'quality',   title: 'Check quality',      desc: 'Review nulls, duplicates, and flag columns.',  icon: 'verified' },
    { tab: 'visualize', title: 'Visualize',          desc: 'Auto-charted views across your columns.',      icon: 'insights' },
    { tab: 'tests',     title: 'Statistical tests',  desc: 'Run t-tests, ANOVA, correlations, and more.',  icon: 'science' },
    { tab: 'lab',       title: 'Analysis lab',       desc: 'Regression, clustering, forecasting, FFT.',    icon: 'psychology' },
    { to: '/ai-insights', title: 'AI insights',      desc: 'Chat with your data and get plain-English answers.', icon: 'auto_awesome' },
    { to: '/reports',     title: 'Generate report',  desc: 'Export findings as PDF or CSV.',               icon: 'description' },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 space-y-10 max-w-6xl mx-auto w-full">
      {/* Quality + quick stats */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl bg-surface-container-high p-5 border border-outline-variant/10 lg:col-span-1">
          <QualityBadge score={stats.qualityScore} />
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickCards.map(c => (
            <div key={c.label} className="rounded-lg bg-surface-container-high p-3 border border-outline-variant/10 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-lg">{c.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{c.label}</p>
                <p className="text-sm font-bold font-headline truncate">{c.value ?? '—'}</p>
                {c.hint !== undefined && (
                  <p className="text-[10px] text-on-surface-variant truncate">{c.hint}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Primary column callout */}
      {primary && (
        <section className="rounded-xl bg-surface-container-high p-5 border border-outline-variant/10 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Primary column</p>
              <h3 className="font-headline text-lg font-bold">{stats.primaryCol}</h3>
            </div>
            <button
              onClick={() => onOpenTab('visualize')}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Visualize <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-xs">
            <Stat label="Mean"   value={primary.mean?.toLocaleString()} accent />
            <Stat label="Median" value={primary.median?.toLocaleString()} />
            <Stat label="σ"      value={primary.stdDev?.toLocaleString()} />
            <Stat label="Min"    value={primary.min?.toLocaleString()} />
            <Stat label="Max"    value={primary.max?.toLocaleString()} />
          </div>
        </section>
      )}

      {/* Shortcut grid — replaces the old sidebar destinations */}
      <section className="space-y-4">
        <h2 className="font-headline text-lg font-bold tracking-tight">What do you want to do?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shortcuts.map(s => (
            <button
              key={s.tab || s.to}
              onClick={() => (s.tab ? onOpenTab(s.tab) : navigate(s.to))}
              className="text-left rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/10 hover:border-primary/40 p-4 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{s.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{s.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <span className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold">{label}</span>
      <p className={`font-bold ${accent ? 'text-primary' : 'text-on-surface'}`}>{value ?? '—'}</p>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
