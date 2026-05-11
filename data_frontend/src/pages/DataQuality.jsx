import { useState } from 'react';
import { useDataset } from '../context/DatasetContext';
import { analysisApi } from '../lib/api';

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ title, icon, color, children, loading, onRun, buttonLabel = 'Analyze' }) {
  return (
    <div className="bg-surface-container-high rounded-2xl border border-outline-variant/10 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-surface-container-highest flex items-center justify-center ${color}`}>
            <span className="material-symbols-outlined text-lg">{icon}</span>
          </div>
          <h3 className="font-headline font-bold text-sm">{title}</h3>
        </div>
        {onRun && (
          <button onClick={onRun} disabled={loading}
            className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center gap-1.5">
            {loading ? <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-xs">play_arrow</span>}
            {buttonLabel}
          </button>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const colors = {
    email: 'bg-blue-500/10 text-blue-400',
    phone: 'bg-green-500/10 text-green-400',
    url: 'bg-purple-500/10 text-purple-400',
    currency: 'bg-amber-500/10 text-amber-400',
    ip_address: 'bg-red-500/10 text-red-400',
    date_iso: 'bg-cyan-500/10 text-cyan-400',
    zip_code: 'bg-orange-500/10 text-orange-400',
    coordinates: 'bg-teal-500/10 text-teal-400',
    uuid: 'bg-indigo-500/10 text-indigo-400',
    percentage: 'bg-pink-500/10 text-pink-400',
    boolean: 'bg-lime-500/10 text-lime-400',
  };
  if (!type) return null;
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${colors[type] || 'bg-surface-container-highest text-on-surface-variant'}`}>
      {type.replace('_', ' ')}
    </span>
  );
}

// ─── Severity Badge ───────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const colors = { error: 'bg-error/10 text-error', warning: 'bg-amber-400/10 text-amber-400', info: 'bg-primary/10 text-primary' };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${colors[severity] || colors.info}`}>
      {severity}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DataQuality() {
  const { activeDataset, datasets, setActive } = useDataset();
  const ds = activeDataset;
  const stats = ds?.stats;

  const [typesResult, setTypesResult] = useState(null);
  const [dupesResult, setDupesResult] = useState(null);
  const [rulesResult, setRulesResult] = useState(null);
  const [depsResult, setDepsResult] = useState(null);
  const [pythonStatus, setPythonStatus] = useState(null);

  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingDupes, setLoadingDupes] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);

  const datasetId = ds?.dbId || ds?.id;

  const runTypes = async () => {
    setLoadingTypes(true);
    try {
      const data = await analysisApi.semanticTypes(datasetId);
      setTypesResult(data.types);
    } catch (err) {
      setTypesResult({ _error: err.message });
    } finally {
      setLoadingTypes(false);
    }
  };

  const runDupes = async () => {
    setLoadingDupes(true);
    try {
      const data = await analysisApi.fuzzyDuplicates(datasetId);
      setDupesResult(data);
    } catch (err) {
      setDupesResult({ _error: err.message });
    } finally {
      setLoadingDupes(false);
    }
  };

  const runRules = async () => {
    setLoadingRules(true);
    try {
      const data = await analysisApi.validationRules(datasetId);
      setRulesResult(data);
    } catch (err) {
      setRulesResult({ _error: err.message });
    } finally {
      setLoadingRules(false);
    }
  };

  const runDeps = async () => {
    setLoadingDeps(true);
    try {
      const data = await analysisApi.dependencies(datasetId);
      setDepsResult(data);
    } catch (err) {
      setDepsResult({ _error: err.message });
    } finally {
      setLoadingDeps(false);
    }
  };

  const checkPython = async () => {
    try {
      const data = await analysisApi.pythonStatus();
      setPythonStatus(data);
    } catch {
      setPythonStatus({ available: false });
    }
  };

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-secondary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <h1 className="text-2xl font-bold font-headline tracking-tight">Data Quality</h1>
          </div>
          <p className="text-on-surface-variant text-sm">
            {ds ? <>Inspect quality of <strong className="text-on-surface">{ds.name}</strong> · {ds.rowCount?.toLocaleString()} rows</> : 'Upload a dataset to get started'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {datasets.filter(d => d.status === 'ready').length > 1 && (
            <select value={ds?.id ?? ''} onChange={e => setActive(e.target.value)}
              className="bg-surface-container-high border border-outline-variant/20 text-xs rounded-lg px-3 py-2 text-on-surface font-medium focus:ring-2 focus:ring-primary cursor-pointer">
              {datasets.filter(d => d.status === 'ready').map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <button onClick={checkPython} className="px-3 py-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${pythonStatus?.available ? 'bg-secondary' : pythonStatus === null ? 'bg-on-surface-variant/30' : 'bg-error'}`}></span>
            Python {pythonStatus?.available ? 'Online' : pythonStatus === null ? 'Unknown' : 'Offline'}
          </button>
        </div>
      </div>

      {!ds && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/20 p-16">
          <span className="material-symbols-outlined text-3xl text-secondary">verified</span>
          <h2 className="text-xl font-bold font-headline">No Dataset Selected</h2>
          <p className="text-on-surface-variant text-sm max-w-xs">Upload a dataset from the Dashboard first.</p>
        </div>
      )}

      {ds && stats && (
        <div className="space-y-5">
          {/* Quick Quality Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-container-low rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Quality Score</p>
              <p className={`text-2xl font-bold ${stats.qualityScore >= 80 ? 'text-secondary' : stats.qualityScore >= 50 ? 'text-amber-400' : 'text-error'}`}>{stats.qualityScore}/100</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Null Cells</p>
              <p className="text-2xl font-bold text-on-surface">{stats.qualityFlags?.totalNullCount?.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Duplicates</p>
              <p className="text-2xl font-bold text-on-surface">{stats.qualityFlags?.duplicateRowCount?.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Columns</p>
              <p className="text-2xl font-bold text-on-surface">{ds.headers?.length || 0}</p>
            </div>
          </div>

          {/* Semantic Type Inference */}
          <SectionCard title="Smart Type Inference" icon="fingerprint" color="text-primary" loading={loadingTypes} onRun={runTypes} buttonLabel="Detect Types">
            {!typesResult && <p className="text-sm text-on-surface-variant">Click "Detect Types" to identify semantic types (email, phone, URL, currency, etc.)</p>}
            {typesResult?._error && <p className="text-sm text-error">{typesResult._error}</p>}
            {typesResult && !typesResult._error && (
              <div className="space-y-2">
                {Object.entries(typesResult).map(([col, info]) => (
                  <div key={col} className="flex items-center justify-between py-2 border-b border-outline-variant/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-on-surface">{col}</span>
                      <span className="text-[10px] text-on-surface-variant bg-surface-container-highest px-1.5 py-0.5 rounded">{info.baseType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TypeBadge type={info.semanticType} />
                      {info.confidence > 0 && (
                        <span className="text-[10px] text-on-surface-variant">{Math.round(info.confidence * 100)}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Fuzzy Duplicates */}
          <SectionCard title="Fuzzy Duplicate Detection" icon="content_copy" color="text-amber-400" loading={loadingDupes} onRun={runDupes} buttonLabel="Find Duplicates">
            {!dupesResult && <p className="text-sm text-on-surface-variant">Click "Find Duplicates" to detect near-duplicate rows using text similarity.</p>}
            {dupesResult?._error && <p className="text-sm text-error">{dupesResult._error}</p>}
            {dupesResult && !dupesResult._error && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-on-surface-variant">Found:</span>
                  <span className={`font-bold ${dupesResult.totalDuplicates > 0 ? 'text-amber-400' : 'text-secondary'}`}>
                    {dupesResult.totalDuplicates} potential duplicates
                  </span>
                  <span className="text-on-surface-variant text-xs">({dupesResult.duplicateGroups?.length || 0} groups)</span>
                </div>
                {dupesResult.columnsUsed?.length > 0 && (
                  <p className="text-xs text-on-surface-variant">Compared using: {dupesResult.columnsUsed.join(', ')}</p>
                )}
                {dupesResult.duplicateGroups?.slice(0, 5).map((group, i) => (
                  <div key={i} className="bg-surface-container-low rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-on-surface-variant">Group {i + 1}</span>
                      <span className="text-[10px] bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded">{group.indices.length} rows · {Math.round(group.similarity * 100)}% similar</span>
                    </div>
                    <div className="space-y-1">
                      {group.sampleRows?.slice(0, 2).map((row, j) => (
                        <p key={j} className="text-xs text-on-surface-variant truncate font-mono">
                          {Object.values(row).slice(0, 5).join(' | ')}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Validation Rules */}
          <SectionCard title="Auto Validation Rules" icon="rule" color="text-secondary" loading={loadingRules} onRun={runRules} buttonLabel="Generate Rules">
            {!rulesResult && <p className="text-sm text-on-surface-variant">Click "Generate Rules" to auto-detect validation rules from data patterns.</p>}
            {rulesResult?._error && <p className="text-sm text-error">{rulesResult._error}</p>}
            {rulesResult && !rulesResult._error && (
              <div className="space-y-2">
                <p className="text-xs text-on-surface-variant mb-3">{rulesResult.totalRules} rules generated</p>
                {rulesResult.rules?.slice(0, 20).map((rule, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-outline-variant/5 last:border-0">
                    <SeverityBadge severity={rule.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-on-surface">{rule.description}</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">{rule.column} · {rule.rule}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Column Dependencies */}
          <SectionCard title="Column Dependencies" icon="account_tree" color="text-tertiary" loading={loadingDeps} onRun={runDeps} buttonLabel="Detect">
            {!depsResult && <p className="text-sm text-on-surface-variant">Click "Detect" to find functional dependencies (e.g., zip code → city).</p>}
            {depsResult?._error && <p className="text-sm text-error">{depsResult._error}</p>}
            {depsResult && !depsResult._error && (
              <div className="space-y-2">
                {depsResult.dependencies?.length === 0 && (
                  <p className="text-sm text-on-surface-variant">No strong column dependencies detected.</p>
                )}
                {depsResult.dependencies?.map((dep, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-outline-variant/5 last:border-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-on-surface">{dep.from}</span>
                      <span className="material-symbols-outlined text-primary text-base">arrow_forward</span>
                      <span className="font-medium text-on-surface">{dep.to}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${dep.type === 'exact' ? 'bg-secondary/10 text-secondary' : 'bg-amber-400/10 text-amber-400'}`}>
                      {dep.type} · {Math.round(dep.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
