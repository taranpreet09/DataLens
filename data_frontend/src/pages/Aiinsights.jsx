import { useState, useEffect } from 'react';
import { useDataset } from '../context/DatasetContext';

// ── Fixed question templates ──────────────────────────────────────────────────
// Each question has an id, label, icon, keywords, and a resolver function
// that produces an answer from the pre-computed stats object.

const QUESTION_TEMPLATES = [
  {
    id: 'overview',
    label: 'Dataset Overview',
    keywords: ['overview', 'summary', 'describe'],
    icon: 'dataset',
    color: 'text-primary',
    resolve: (ds, stats) => {
      const lines = [
        `**${ds.name}** contains **${stats.rowCount.toLocaleString()} rows** and **${stats.headers.length} columns**.`,
        `Column types: ${stats.numericColumns.length} numeric, ${stats.categoricalColumns?.length ?? 0} categorical, ${stats.dateColumns?.length ?? 0} date, ${stats.textColumns?.length ?? 0} text.`,
        `Data quality score: **${stats.qualityScore}/100**${stats.qualityScore >= 80 ? ' (Excellent)' : stats.qualityScore >= 50 ? ' (Moderate)' : ' (Poor)'}.`,
      ];
      if (stats.qualityFlags.totalNullCount > 0)
        lines.push(`Total null/missing cells: ${stats.qualityFlags.totalNullCount.toLocaleString()} (${stats.qualityFlags.nullPct}%).`);
      if (stats.qualityFlags.duplicateRowCount > 0)
        lines.push(`Duplicate rows detected: ${stats.qualityFlags.duplicateRowCount} (${stats.qualityFlags.duplicatePct}%).`);
      return lines;
    },
  },
  {
    id: 'key-metrics',
    label: 'Key Metrics',
    keywords: ['metrics', 'mean', 'average', 'statistics'],
    icon: 'monitoring',
    color: 'text-secondary',
    resolve: (ds, stats) => {
      if (stats.numericColumns.length === 0) return ['No numeric columns found in this dataset.'];
      const lines = [`Found **${stats.numericColumns.length} numeric columns**:`];
      for (const col of stats.numericColumns.slice(0, 6)) {
        const s = stats.numericStats[col];
        if (!s) continue;
        lines.push(`• **${col}**: mean ${s.mean.toLocaleString()}, median ${s.median.toLocaleString()}, range ${s.min.toLocaleString()} – ${s.max.toLocaleString()}, σ = ${s.stdDev.toLocaleString()}`);
      }
      if (stats.numericColumns.length > 6) lines.push(`...and ${stats.numericColumns.length - 6} more columns.`);
      return lines;
    },
  },
  {
    id: 'trends',
    label: 'Trends & Time Series',
    keywords: ['trend', 'time', 'series', 'growth', 'seasonal'],
    icon: 'trending_up',
    color: 'text-primary',
    resolve: (ds, stats) => {
      if (!stats.timeSeries) return ['No date column detected — time series analysis requires at least one date column and one numeric column.'];
      const ts = stats.timeSeries;
      const lines = [
        `Time series detected using **${ts.dateCol}** × **${ts.primaryCol}**.`,
        `Trend: **${ts.trendDirection}** (slope: ${ts.slope}) across **${ts.series.length} periods**.`,
        `Peak: **${ts.peak?.value?.toLocaleString()}** on ${ts.peak?.date}.`,
        `Trough: **${ts.trough?.value?.toLocaleString()}** on ${ts.trough?.date}.`,
      ];
      if (ts.peakToTroughRatio) lines.push(`Peak-to-trough ratio: **${ts.peakToTroughRatio}×**.`);
      if (ts.seasonalityHint) lines.push(`Seasonality hint: ${ts.seasonalityHint}`);
      return lines;
    },
  },
  {
    id: 'correlations',
    label: 'Correlations',
    keywords: ['correlation', 'relationship', 'related', 'associated'],
    icon: 'hub',
    color: 'text-tertiary',
    resolve: (ds, stats) => {
      if (!stats.correlationInsights || stats.correlationInsights.length === 0)
        return ['Need at least 2 numeric columns to compute correlations.'];
      const lines = [`**Top ${Math.min(stats.correlationInsights.length, 5)} correlations** found:`];
      for (const ins of stats.correlationInsights.slice(0, 5)) {
        lines.push(`• ${ins.text}`);
      }
      return lines;
    },
  },
  {
    id: 'outliers',
    label: 'Outliers & Anomalies',
    keywords: ['outlier', 'anomaly', 'unusual', 'extreme'],
    icon: 'error_outline',
    color: 'text-error',
    resolve: (ds, stats) => {
      const lines = [];
      let found = false;
      for (const col of stats.numericColumns) {
        const s = stats.numericStats[col];
        if (!s) continue;
        if (s.zscoreOutlierCount > 0 || s.iqrOutlierCount > 0) {
          found = true;
          lines.push(`• **${col}**: ${s.zscoreOutlierCount} Z-score outliers, ${s.iqrOutlierCount} IQR outliers (range: ${s.min.toLocaleString()} – ${s.max.toLocaleString()}).`);
        }
      }
      if (stats.anomalies?.benfordAnomalies?.length > 0) {
        found = true;
        for (const a of stats.anomalies.benfordAnomalies) {
          lines.push(`• **${a.column}**: Benford's Law deviation detected — ${a.description}`);
        }
      }
      if (stats.anomalies?.fuzzyDuplicates?.length > 0) {
        found = true;
        for (const a of stats.anomalies.fuzzyDuplicates.slice(0, 3)) {
          lines.push(`• Near-duplicate categories in **${a.column}**: "${a.group.join('", "')}"`);
        }
      }
      if (!found) lines.push('No significant outliers or anomalies were detected in this dataset.');
      else lines.unshift('**Outliers & anomalies detected:**');
      return lines;
    },
  },
  {
    id: 'quality',
    label: 'Data Quality Issues',
    keywords: ['quality', 'missing', 'null', 'duplicate', 'issues'],
    icon: 'flag',
    color: 'text-amber-400',
    resolve: (ds, stats) => {
      const lines = [`Overall quality score: **${stats.qualityScore}/100**.`];
      if (stats.qualityFlags.flags?.length > 0) {
        lines.push(`**${stats.qualityFlags.flags.length} quality flags** raised:`);
        for (const f of stats.qualityFlags.flags.slice(0, 8)) {
          const sev = f.severity === 'danger' ? '🔴' : f.severity === 'warning' ? '🟡' : '🔵';
          lines.push(`${sev} ${f.type}: ${f.detail}`);
        }
        if (stats.qualityFlags.flags.length > 8) lines.push(`...and ${stats.qualityFlags.flags.length - 8} more flags.`);
      } else {
        lines.push('No quality issues detected — this dataset is clean!');
      }
      return lines;
    },
  },
  {
    id: 'categories',
    label: 'Category Breakdown',
    keywords: ['category', 'categorical', 'distribution', 'segments'],
    icon: 'category',
    color: 'text-amber-400',
    resolve: (ds, stats) => {
      if (!stats.categoricalColumns || stats.categoricalColumns.length === 0)
        return ['No categorical columns detected in this dataset.'];
      const lines = [`Found **${stats.categoricalColumns.length} categorical columns**:`];
      for (const col of stats.categoricalColumns.slice(0, 5)) {
        const cs = stats.categoricalStats?.[col];
        if (!cs) continue;
        lines.push(`• **${col}**: ${cs.cardinality} unique values. Mode: "${cs.mode}" (${cs.concentrationRatio}% of rows).`);
        if (cs.top5?.length > 0) {
          const topItems = cs.top5.slice(0, 3).map(t => `${t.value} (${t.pct}%)`).join(', ');
          lines.push(`  Top values: ${topItems}`);
        }
      }
      // Category aggregations
      const catAggKeys = Object.keys(stats.categoryAggregations || {});
      if (catAggKeys.length > 0 && stats.primaryCol) {
        const firstCat = stats.categoryAggregations[catAggKeys[0]];
        if (firstCat?.comparativeInsight) {
          lines.push(`Insight: ${firstCat.comparativeInsight}`);
        }
      }
      return lines;
    },
  },
  {
    id: 'columns',
    label: 'Column Profiling',
    keywords: ['column', 'field', 'profile', 'types'],
    icon: 'view_column',
    color: 'text-primary',
    resolve: (ds, stats) => {
      const lines = [`**${stats.headers.length} columns** profiled:`];
      for (const h of stats.headers.slice(0, 12)) {
        const b = stats.columnBasics[h];
        if (!b) continue;
        const nullStr = b.nullCount > 0 ? `, ${b.nullCount} nulls (${b.nullPct}%)` : '';
        lines.push(`• **${h}** — ${b.type}, ${b.uniqueCount} unique values${nullStr}`);
      }
      if (stats.headers.length > 12) lines.push(`...and ${stats.headers.length - 12} more columns.`);
      return lines;
    },
  },
];

// ── Simple markdown-ish renderer ──────────────────────────────────────────────
function renderLine(line) {
  let html = line
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-on-surface">$1</strong>')
    .replace(/^• /, '');
  const isBullet = line.startsWith('•');
  return { html, isBullet };
}

// ── Answer Card ───────────────────────────────────────────────────────────────
function AnswerCard({ question, lines, onClose }) {
  const q = QUESTION_TEMPLATES.find(t => t.id === question);
  return (
    <div className="bg-surface-container-high rounded-2xl border border-outline-variant/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-surface-container-highest flex items-center justify-center ${q?.color || 'text-primary'}`}>
            <span className="material-symbols-outlined text-lg">{q?.icon || 'lightbulb'}</span>
          </div>
          <div>
            <h3 className="font-headline font-bold text-sm">{q?.label || 'Analysis'}</h3>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">Computed from dataset</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
      {/* Body */}
      <div className="px-5 py-4 space-y-2 text-sm text-on-surface-variant leading-relaxed">
        {lines.map((line, i) => {
          const { html, isBullet } = renderLine(line);
          return isBullet ? (
            <div key={i} className="flex gap-2 items-start pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-outline-variant mt-2 shrink-0"></span>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          ) : (
            <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIInsights() {
  const { activeDataset, datasets, setActive } = useDataset();
  const ds = activeDataset;
  const stats = ds?.stats;

  const [activeQuestions, setActiveQuestions] = useState([]); // array of { id, lines }
  const [searchTerm, setSearchTerm] = useState('');

  // Reset when dataset changes
  useEffect(() => {
    setActiveQuestions([]);
    setSearchTerm('');
  }, [ds?.id]);

  const handleAsk = (templateId) => {
    if (!stats) return;
    // Don't add duplicates
    if (activeQuestions.some(q => q.id === templateId)) {
      // Scroll to it instead
      document.getElementById(`answer-${templateId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const template = QUESTION_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    const lines = template.resolve(ds, stats);
    setActiveQuestions(prev => [{ id: templateId, lines }, ...prev]);
  };

  const handleRemove = (id) => {
    setActiveQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Filter questions by search term
  const filteredQuestions = QUESTION_TEMPLATES.filter(t => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return t.label.toLowerCase().includes(term) ||
           t.keywords.some(k => k.includes(term));
  });

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-tertiary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
            </div>
            <h1 className="text-2xl font-bold font-headline tracking-tight">AI Insights</h1>
          </div>
          <p className="text-on-surface-variant text-sm">
            {ds
              ? <>Select a question to instantly analyze <strong className="text-on-surface">{ds.name}</strong> · {ds.rowCount?.toLocaleString()} rows</>
              : 'Upload a dataset to get started'}
          </p>
        </div>

        {/* Dataset selector */}
        {datasets.filter(d => d.status === 'ready').length > 1 && (
          <select
            value={ds?.id ?? ''}
            onChange={e => setActive(e.target.value)}
            className="bg-surface-container-high border border-outline-variant/20 text-xs rounded-lg px-3 py-2 text-on-surface font-medium focus:ring-2 focus:ring-primary cursor-pointer"
          >
            {datasets.filter(d => d.status === 'ready').map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* No dataset state */}
      {!ds && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/20 p-16">
          <div className="w-16 h-16 rounded-2xl bg-tertiary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold font-headline mb-2">No Dataset Selected</h2>
            <p className="text-on-surface-variant text-sm max-w-xs mx-auto">
              Upload a CSV or Excel file from the Dashboard, then come back to explore insights.
            </p>
          </div>
        </div>
      )}

      {/* Main content */}
      {ds && stats && (
        <>
          {/* Search / Filter bar */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search questions by keyword..."
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>

          {/* Question Grid */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">
              Choose a question
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {filteredQuestions.map((t) => {
                const isActive = activeQuestions.some(q => q.id === t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => handleAsk(t.id)}
                    className={`group relative text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer
                      ${isActive
                        ? 'bg-surface-container-high border-primary/30 shadow-[0_0_15px_rgba(148,170,255,0.1)]'
                        : 'bg-surface-container-low border-outline-variant/10 hover:border-primary/20 hover:bg-surface-container'
                      }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition-colors
                      ${isActive ? 'bg-primary/15' : 'bg-surface-container-highest group-hover:bg-primary/10'} ${t.color}`}>
                      <span className="material-symbols-outlined text-lg">{t.icon}</span>
                    </div>
                    <h4 className="font-headline font-bold text-sm mb-1">{t.label}</h4>
                    <p className="text-[10px] text-on-surface-variant leading-relaxed">
                      {t.keywords.join(' · ')}
                    </p>
                    {isActive && (
                      <div className="absolute top-3 right-3">
                        <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {filteredQuestions.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-8 opacity-60">No questions match "{searchTerm}"</p>
            )}
          </div>

          {/* Answers */}
          {activeQuestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
                  Results ({activeQuestions.length})
                </p>
                {activeQuestions.length > 1 && (
                  <button
                    onClick={() => setActiveQuestions([])}
                    className="text-[10px] text-on-surface-variant hover:text-on-surface transition-colors uppercase tracking-widest font-bold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                    Clear all
                  </button>
                )}
              </div>
              {activeQuestions.map(q => (
                <div key={q.id} id={`answer-${q.id}`}>
                  <AnswerCard question={q.id} lines={q.lines} onClose={() => handleRemove(q.id)} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}