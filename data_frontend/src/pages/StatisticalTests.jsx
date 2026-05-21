import { useState, useMemo } from 'react';
import { useDataset } from '../context/DatasetContext';
import { analysisApi } from '../lib/api';

// ─── Result Card ──────────────────────────────────────────────────────────────
function ResultCard({ title, icon, color, result, onClose }) {
  if (!result) return null;
  return (
    <div className="bg-surface-container-high rounded-2xl border border-outline-variant/10 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-surface-container-highest flex items-center justify-center ${color}`}>
            <span className="material-symbols-outlined text-lg">{icon}</span>
          </div>
          <h3 className="font-headline font-bold text-sm">{title}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
      <div className="px-5 py-4">
        {result.error ? (
          <p className="text-error text-sm">{result.error}</p>
        ) : (
          <div className="space-y-3">
            {result.summary && (
              <div className={`px-4 py-3 rounded-xl text-sm font-medium ${result.significant ? 'bg-secondary/10 text-secondary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                {result.significant ? '✓ Statistically significant (p < 0.05)' : '✗ Not statistically significant (p ≥ 0.05)'}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {result.metrics?.map((m, i) => (
                <div key={i} className="bg-surface-container-low rounded-xl px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold mb-0.5">{m.label}</p>
                  <p className="text-sm font-bold text-on-surface">{m.value}</p>
                </div>
              ))}
            </div>
            {result.interpretation && (
              <p className="text-xs text-on-surface-variant leading-relaxed mt-2">{result.interpretation}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Column Selector ──────────────────────────────────────────────────────────
function ColumnSelect({ label, value, onChange, columns, filterType }) {
  const filtered = filterType ? columns.filter(c => c.type === filterType) : columns;
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
      >
        <option value="">Select column...</option>
        {filtered.map(c => (
          <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StatisticalTests() {
  const { activeDataset, datasets, setActive } = useDataset();
  const ds = activeDataset;
  const stats = ds?.stats;

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  // Test form state
  const [testType, setTestType] = useState('normality');
  const [col1, setCol1] = useState('');
  const [col2, setCol2] = useState('');
  const [groupCol, setGroupCol] = useState('');
  const [group1, setGroup1] = useState('');
  const [group2, setGroup2] = useState('');

  // Build column list with types
  const columns = useMemo(() => {
    if (!stats) return [];
    return (ds.headers || stats.headers || []).map(h => ({
      name: h,
      type: stats.columnTypes?.[h] || 'unknown',
    }));
  }, [ds?.id, stats]);

  const numericCols = columns.filter(c => c.type === 'numeric');
  const categoricalCols = columns.filter(c => c.type === 'categorical');

  // Get unique values for a categorical column (from stats)
  const groupValues = useMemo(() => {
    if (!groupCol || !stats?.categoricalStats?.[groupCol]) return [];
    return stats.categoricalStats[groupCol].top5?.map(t => t.value) || [];
  }, [groupCol, stats]);

  const datasetId = ds?.dbId || ds?.id;

  const runTest = async () => {
    if (!datasetId) return;
    setLoading(true);

    try {
      let response;
      let formatted;

      switch (testType) {
        case 'normality': {
          if (!col1) throw new Error('Select a numeric column');
          response = await analysisApi.normality(datasetId, { column: col1 });
          const r = response.result;
          formatted = {
            title: `Normality Test — ${col1}`,
            summary: true,
            significant: !r.isNormal, // significant = NOT normal
            metrics: [
              { label: 'Test Statistic', value: r.statistic?.toFixed(4) },
              { label: 'P-Value', value: r.pValue < 0.001 ? '< 0.001' : r.pValue?.toFixed(4) },
              { label: 'Skewness', value: r.skewness?.toFixed(4) },
              { label: 'Kurtosis', value: r.kurtosis?.toFixed(4) },
              { label: 'Sample Size', value: response.n },
              ...(response.confidenceInterval ? [
                { label: '95% CI', value: `[${response.confidenceInterval.lower?.toFixed(2)}, ${response.confidenceInterval.upper?.toFixed(2)}]` },
              ] : []),
            ],
            interpretation: r.isNormal
              ? `${col1} appears normally distributed (p = ${r.pValue?.toFixed(4)}). Parametric tests are appropriate.`
              : `${col1} deviates from normality (p = ${r.pValue?.toFixed(4)}). Consider non-parametric tests.`,
          };
          break;
        }

        case 'ttest': {
          if (!col1 || !groupCol) throw new Error('Select a numeric column and a group column');
          response = await analysisApi.tTest(datasetId, {
            numericColumn: col1,
            groupColumn: groupCol,
            group1Value: group1 || undefined,
            group2Value: group2 || undefined,
          });
          const r = response.result;
          const groups = response.groups;
          const groupNames = Object.keys(groups);
          formatted = {
            title: `T-Test — ${col1} by ${groupCol}`,
            summary: true,
            significant: r.significant,
            metrics: [
              { label: 'T-Statistic', value: r.tStatistic?.toFixed(4) },
              { label: 'P-Value', value: r.pValue < 0.001 ? '< 0.001' : r.pValue?.toFixed(4) },
              { label: 'Degrees of Freedom', value: r.degreesOfFreedom?.toFixed(1) },
              { label: `Mean (${groupNames[0]})`, value: groups[groupNames[0]]?.mean?.toFixed(2) },
              { label: `Mean (${groupNames[1]})`, value: groups[groupNames[1]]?.mean?.toFixed(2) },
              { label: 'Mean Difference', value: r.meanDiff?.toFixed(4) },
              { label: "Cohen's d", value: r.cohensD?.toFixed(4) },
              { label: 'Effect Size', value: r.effectSizeLabel },
              { label: '95% CI', value: `[${r.confidenceInterval?.lower?.toFixed(2)}, ${r.confidenceInterval?.upper?.toFixed(2)}]` },
            ],
            interpretation: r.significant
              ? `There is a statistically significant difference in ${col1} between ${groupNames[0]} and ${groupNames[1]} (p = ${r.pValue?.toFixed(4)}, d = ${r.cohensD?.toFixed(3)} — ${r.effectSizeLabel} effect).`
              : `No significant difference in ${col1} between ${groupNames[0]} and ${groupNames[1]} (p = ${r.pValue?.toFixed(4)}).`,
          };
          break;
        }

        case 'anova': {
          if (!col1 || !groupCol) throw new Error('Select a numeric column and a group column');
          response = await analysisApi.anova(datasetId, { numericColumn: col1, groupColumn: groupCol });
          const r = response.result;
          formatted = {
            title: `ANOVA — ${col1} by ${groupCol}`,
            summary: true,
            significant: r.significant,
            metrics: [
              { label: 'F-Statistic', value: r.fStatistic?.toFixed(4) },
              { label: 'P-Value', value: r.pValue < 0.001 ? '< 0.001' : r.pValue?.toFixed(4) },
              { label: 'DF (Between)', value: r.degreesOfFreedom?.between },
              { label: 'DF (Within)', value: r.degreesOfFreedom?.within },
              { label: 'Groups', value: response.groupNames?.length },
            ],
            interpretation: r.significant
              ? `At least one group mean differs significantly (F = ${r.fStatistic?.toFixed(2)}, p = ${r.pValue?.toFixed(4)}). Groups: ${response.groupNames?.join(', ')}.`
              : `No significant difference between group means (F = ${r.fStatistic?.toFixed(2)}, p = ${r.pValue?.toFixed(4)}).`,
          };
          break;
        }

        case 'chi-square': {
          if (!col1 || !col2) throw new Error('Select two categorical columns');
          response = await analysisApi.chiSquare(datasetId, { column1: col1, column2: col2 });
          const r = response.result;
          formatted = {
            title: `Chi-Square — ${col1} × ${col2}`,
            summary: true,
            significant: r.significant,
            metrics: [
              { label: 'Chi-Square', value: r.chiSquare?.toFixed(4) },
              { label: 'P-Value', value: r.pValue < 0.001 ? '< 0.001' : r.pValue?.toFixed(4) },
              { label: 'Degrees of Freedom', value: r.degreesOfFreedom },
              { label: "Cramér's V", value: r.cramersV?.toFixed(4) },
              { label: 'Effect Size', value: r.effectSize },
            ],
            interpretation: r.significant
              ? `${col1} and ${col2} are significantly associated (χ² = ${r.chiSquare?.toFixed(2)}, p = ${r.pValue?.toFixed(4)}). Effect: ${r.effectSize}.`
              : `No significant association between ${col1} and ${col2} (p = ${r.pValue?.toFixed(4)}).`,
          };
          break;
        }

        case 'correlation': {
          if (!col1 || !col2) throw new Error('Select two numeric columns');
          response = await analysisApi.correlation(datasetId, { column1: col1, column2: col2 });
          const r = response.result;
          formatted = {
            title: `Correlation — ${col1} × ${col2}`,
            summary: true,
            significant: r.significant,
            metrics: [
              { label: 'Pearson r', value: r.r?.toFixed(4) },
              { label: 'T-Statistic', value: r.tStatistic?.toFixed(4) },
              { label: 'P-Value', value: r.pValue < 0.001 ? '< 0.001' : r.pValue?.toFixed(4) },
              { label: 'Sample Size', value: response.n },
            ],
            interpretation: r.significant
              ? `The correlation between ${col1} and ${col2} is statistically significant (r = ${r.r?.toFixed(3)}, p = ${r.pValue?.toFixed(4)}).`
              : `The correlation between ${col1} and ${col2} is not statistically significant (r = ${r.r?.toFixed(3)}, p = ${r.pValue?.toFixed(4)}).`,
          };
          break;
        }

        case 'confidence': {
          response = await analysisApi.confidenceIntervals(datasetId, 0.95);
          const intervals = response.intervals;
          const keys = Object.keys(intervals);
          formatted = {
            title: '95% Confidence Intervals (All Numeric)',
            metrics: keys.slice(0, 12).map(k => ({
              label: k,
              value: `${intervals[k].lower?.toFixed(2)} – ${intervals[k].upper?.toFixed(2)}`,
            })),
            interpretation: `Confidence intervals computed for ${keys.length} numeric columns at 95% confidence level.`,
          };
          break;
        }

        case 'mann-whitney': {
          if (!col1 || !groupCol) throw new Error('Select a numeric column and a group column');
          response = await analysisApi.mannWhitney(datasetId, {
            numericColumn: col1,
            groupColumn: groupCol,
            group1Value: group1 || undefined,
            group2Value: group2 || undefined,
          });
          const r = response.result;
          formatted = {
            title: `Mann-Whitney U — ${col1} by ${groupCol}`,
            summary: true,
            significant: r.significant,
            metrics: [
              { label: 'U Statistic', value: r.uStatistic?.toFixed(2) },
              { label: 'Z Score', value: r.zScore?.toFixed(4) },
              { label: 'P-Value', value: r.pValue < 0.001 ? '< 0.001' : r.pValue?.toFixed(4) },
              { label: 'Effect Size (r)', value: r.effectSize?.toFixed(4) },
              { label: 'Effect', value: r.effectSizeLabel },
              { label: 'Median Diff', value: r.medianDiff?.toFixed(4) },
            ],
            interpretation: r.significant
              ? `The distributions differ significantly (U = ${r.uStatistic?.toFixed(1)}, p = ${r.pValue?.toFixed(4)}). Effect size: ${r.effectSizeLabel} (r = ${r.effectSize?.toFixed(3)}).`
              : `No significant difference between distributions (U = ${r.uStatistic?.toFixed(1)}, p = ${r.pValue?.toFixed(4)}).`,
          };
          break;
        }

        case 'paired-ttest': {
          if (!col1 || !col2) throw new Error('Select two numeric columns (before/after)');
          if (col1 === col2) throw new Error('Pick two different columns — paired t-test compares before vs after measurements.');
          response = await analysisApi.pairedTTest(datasetId, { column1: col1, column2: col2 });
          const r = response?.result;
          if (!r) throw new Error(response?.message || 'Paired t-test could not be computed (insufficient or constant data).');
          formatted = {
            title: `Paired T-Test — ${col1} vs ${col2}`,
            summary: true,
            significant: r.significant,
            metrics: [
              { label: 'T-Statistic', value: r.tStatistic?.toFixed(4) },
              { label: 'P-Value', value: r.pValue < 0.001 ? '< 0.001' : r.pValue?.toFixed(4) },
              { label: 'Degrees of Freedom', value: r.degreesOfFreedom },
              { label: 'Mean Difference', value: r.meanDiff?.toFixed(4) },
              { label: "Cohen's d", value: r.cohensD?.toFixed(4) },
              { label: 'Effect Size', value: r.effectSizeLabel },
              { label: '95% CI', value: `[${r.confidenceInterval?.lower?.toFixed(3)}, ${r.confidenceInterval?.upper?.toFixed(3)}]` },
              { label: 'Pairs', value: r.n },
            ],
            interpretation: r.significant
              ? `The paired measurements differ significantly (t = ${r.tStatistic?.toFixed(3)}, p = ${r.pValue?.toFixed(4)}). Mean difference: ${r.meanDiff?.toFixed(3)}. Effect: ${r.effectSizeLabel} (d = ${r.cohensD?.toFixed(3)}).`
              : `No significant difference between paired measurements (t = ${r.tStatistic?.toFixed(3)}, p = ${r.pValue?.toFixed(4)}).`,
          };
          break;
        }

        default:
          throw new Error('Unknown test type');
      }

      setResults(prev => [{ id: Date.now(), icon: getTestIcon(testType), color: getTestColor(testType), ...formatted }, ...prev]);
    } catch (err) {
      setResults(prev => [{ id: Date.now(), title: `Error — ${testType}`, icon: 'error', color: 'text-error', error: err.message }, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg">science</span>
            </div>
            <h1 className="text-2xl font-bold font-headline tracking-tight">Statistical Tests</h1>
          </div>
          <p className="text-on-surface-variant text-sm">
            {ds ? <>Run hypothesis tests on <strong className="text-on-surface">{ds.name}</strong></> : 'Upload a dataset to get started'}
          </p>
        </div>

        {datasets.filter(d => d.status === 'ready').length > 1 && (
          <select value={ds?.id ?? ''} onChange={e => setActive(e.target.value)}
            className="bg-surface-container-high border border-outline-variant/20 text-xs rounded-lg px-3 py-2 text-on-surface font-medium focus:ring-2 focus:ring-primary cursor-pointer">
            {datasets.filter(d => d.status === 'ready').map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      {!ds && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/20 p-16">
          <span className="material-symbols-outlined text-3xl text-primary">science</span>
          <h2 className="text-xl font-bold font-headline">No Dataset Selected</h2>
          <p className="text-on-surface-variant text-sm max-w-xs">Upload a dataset from the Dashboard first.</p>
        </div>
      )}

      {ds && stats && (
        <>
          {/* Test Configuration */}
          <div className="bg-surface-container-high rounded-2xl border border-outline-variant/10 p-5 space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Configure Test</p>

            {/* Test type selector */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {TEST_TYPES.map(t => (
                <button key={t.id} onClick={() => { setTestType(t.id); setCol1(''); setCol2(''); setGroupCol(''); }}
                  className={`p-3 rounded-xl border text-left transition-all ${testType === t.id ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-low border-outline-variant/10 text-on-surface-variant hover:border-primary/20'}`}>
                  <span className="material-symbols-outlined text-base mb-1 block">{t.icon}</span>
                  <span className="text-[11px] font-semibold">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Column selectors based on test type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(testType === 'normality' || testType === 'ttest' || testType === 'anova' || testType === 'mann-whitney') && (
                <ColumnSelect label="Numeric Column" value={col1} onChange={setCol1} columns={columns} filterType="numeric" />
              )}
              {testType === 'paired-ttest' && (
                <>
                  <ColumnSelect label="Column 1 (Before)" value={col1} onChange={setCol1} columns={columns} filterType="numeric" />
                  <ColumnSelect label="Column 2 (After)" value={col2} onChange={setCol2} columns={columns} filterType="numeric" />
                </>
              )}
              {testType === 'chi-square' && (
                <>
                  <ColumnSelect label="Column 1 (Categorical)" value={col1} onChange={setCol1} columns={columns} filterType="categorical" />
                  <ColumnSelect label="Column 2 (Categorical)" value={col2} onChange={setCol2} columns={columns} filterType="categorical" />
                </>
              )}
              {testType === 'correlation' && (
                <>
                  <ColumnSelect label="Column 1 (Numeric)" value={col1} onChange={setCol1} columns={columns} filterType="numeric" />
                  <ColumnSelect label="Column 2 (Numeric)" value={col2} onChange={setCol2} columns={columns} filterType="numeric" />
                </>
              )}
              {(testType === 'ttest' || testType === 'anova' || testType === 'mann-whitney') && (
                <ColumnSelect label="Group Column (Categorical)" value={groupCol} onChange={setGroupCol} columns={columns} filterType="categorical" />
              )}
              {testType === 'ttest' && groupCol && groupValues.length > 0 && (
                <>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1 block">Group 1</label>
                    <select value={group1} onChange={e => setGroup1(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface">
                      <option value="">Auto (first group)</option>
                      {groupValues.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1 block">Group 2</label>
                    <select value={group2} onChange={e => setGroup2(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface">
                      <option value="">Auto (second group)</option>
                      {groupValues.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            <button onClick={runTest} disabled={loading}
              className="px-5 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {loading ? (
                <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Running...</>
              ) : (
                <><span className="material-symbols-outlined text-sm">play_arrow</span> Run Test</>
              )}
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Results ({results.length})</p>
                <button onClick={() => setResults([])} className="text-[10px] text-on-surface-variant hover:text-on-surface uppercase tracking-widest font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">close</span> Clear all
                </button>
              </div>
              {results.map(r => (
                <ResultCard key={r.id} title={r.title} icon={r.icon} color={r.color} result={r} onClose={() => setResults(prev => prev.filter(x => x.id !== r.id))} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const TEST_TYPES = [
  { id: 'normality', label: 'Normality', icon: 'equalizer' },
  { id: 'ttest', label: 'T-Test', icon: 'compare_arrows' },
  { id: 'paired-ttest', label: 'Paired T-Test', icon: 'sync_alt' },
  { id: 'mann-whitney', label: 'Mann-Whitney', icon: 'swap_vert' },
  { id: 'anova', label: 'ANOVA', icon: 'stacked_bar_chart' },
  { id: 'chi-square', label: 'Chi-Square', icon: 'grid_on' },
  { id: 'correlation', label: 'Correlation', icon: 'hub' },
  { id: 'confidence', label: 'Conf. Intervals', icon: 'target' },
];

function getTestIcon(type) {
  return TEST_TYPES.find(t => t.id === type)?.icon || 'science';
}

function getTestColor(type) {
  const colors = { normality: 'text-primary', ttest: 'text-secondary', 'paired-ttest': 'text-secondary', 'mann-whitney': 'text-amber-400', anova: 'text-tertiary', 'chi-square': 'text-amber-400', correlation: 'text-primary', confidence: 'text-secondary' };
  return colors[type] || 'text-primary';
}
