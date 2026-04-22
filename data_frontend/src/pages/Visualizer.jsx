import { useState, useEffect } from 'react';
import { useDataset } from '../context/DatasetContext';
import KPICard from '../components/ui/KPICard';
import DynamicTimeSeries from '../components/charts/DynamicTimeSeries';
import DynamicBarChart from '../components/charts/DynamicBarChart';
import DonutChart from '../components/charts/DonutChart';
import EmptyChartState from '../components/charts/EmptyChartState';
import DynamicChart from '../components/charts/DynamicChart';

export default function Visualizer() {
  const { activeDataset, datasets, setActive } = useDataset();
  const ds = activeDataset;
  const stats = ds?.stats;

  const filterIgnoredCols = (keys) => keys.filter(k => !/^(s\.?no\.?|id|serial\s*no|uuid)$/i.test(k));

  const pureHistKeys = stats?.histogramBuckets ? Object.keys(stats.histogramBuckets) : [];
  const pureCatKeys = stats?.categoricalStats ? Object.keys(stats.categoricalStats) : [];
  const comboKeys = filterIgnoredCols([...new Set([...pureHistKeys, ...pureCatKeys])]);

  const [selectedHistCol, setSelectedHistCol] = useState(null);
  const [histGraphType, setHistGraphType] = useState('pie');
  useEffect(() => { if (comboKeys.length) setSelectedHistCol(comboKeys[0]); }, [ds?.id]);
  
  let histData = null;
  let comboChartData = [];
  if (selectedHistCol) {
    if (stats?.histogramBuckets?.[selectedHistCol]) {
      histData = stats.histogramBuckets[selectedHistCol];
      comboChartData = histData.bins.map(b => ({ range: b.range, count: b.count }));
    } else if (stats?.categoricalStats?.[selectedHistCol]) {
      histData = stats.categoricalStats[selectedHistCol];
      comboChartData = histData.top10.map(c => ({ range: c.value, count: c.count }));
    }
  }

  const catAggKeys = stats?.categoryAggregations ? Object.keys(stats.categoryAggregations) : [];
  const [selectedCatCol, setSelectedCatCol] = useState(null);
  useEffect(() => {
    if (catAggKeys.length) setSelectedCatCol(catAggKeys[0]);
  }, [ds?.id]);
  const catAgg = selectedCatCol && stats?.categoryAggregations?.[selectedCatCol];

  const catStatKeys = stats?.categoricalStats ? Object.keys(stats.categoricalStats) : [];
  const [selectedFreqCol, setSelectedFreqCol] = useState(null);
  useEffect(() => {
    if (catStatKeys.length) setSelectedFreqCol(catStatKeys[0]);
  }, [ds?.id]);
  const freqData = selectedFreqCol && stats?.categoricalStats?.[selectedFreqCol];

  const kpis = [];
  if (stats) {
    kpis.push({
      label: 'Total Rows',
      value: ds.rowCount?.toLocaleString() ?? '—',
      sub: 'Records in dataset',
      color: 'secondary',
    });
    kpis.push({
      label: 'Columns',
      value: ds.headers?.length ?? '—',
      sub: `${stats.numericColumns.length} numeric, ${stats.categoricalColumns?.length ?? 0} cat`,
      color: 'primary',
    });
    kpis.push({
      label: 'Quality Score',
      value: `${stats.qualityScore}/100`,
      sub: stats.qualityScore >= 80 ? 'Excellent' : stats.qualityScore >= 50 ? 'Moderate' : 'Poor',
      color: stats.qualityScore >= 80 ? 'secondary' : 'error',
    });
    if (stats.timeSeries) {
      kpis.push({
        label: 'Trend',
        value: stats.timeSeries.trendDirection,
        sub: `Slope: ${stats.timeSeries.slope}`,
        color: stats.timeSeries.trendDirection === 'Upward trend' ? 'secondary' : 'error',
        trend: stats.timeSeries.trendDirection === 'Upward trend' ? '+' : null,
      });
    } else {
      kpis.push({
        label: 'Null Values',
        value: stats.qualityFlags.totalNullCount.toLocaleString(),
        sub: `${stats.qualityFlags.nullPct}% of cells`,
        color: 'error',
      });
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-8 max-w-[1600px] mx-auto w-full">
      {datasets.filter((d) => d.status === 'ready').length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {datasets
            .filter((d) => d.status === 'ready')
            .map((d) => (
              <button
                key={d.id}
                onClick={() => setActive(d.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  d.id === ds?.id
                    ? 'bg-primary text-on-primary shadow-lg'
                    : 'bg-surface-container-high border border-outline-variant/10 text-on-surface-variant hover:text-white'
                }`}
              >
                {d.name}
              </button>
            ))}
        </div>
      )}

      {!ds && (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/20 p-16">
          <span className="material-symbols-outlined text-6xl opacity-30">insights</span>
          <p className="text-sm font-medium">No dataset selected. Upload a file to visualize it here.</p>
        </div>
      )}

      {ds && stats && (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, i) => (
              <KPICard key={i} {...kpi} />
            ))}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 bg-surface-container p-5 sm:p-8 rounded-2xl flex flex-col min-h-[320px] lg:min-h-[420px] shadow-sm border border-outline-variant/5">
              <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-headline font-bold mb-1">
                    {stats.timeSeries ? 'Time Series Trend' : 'Distribution Analysis'}
                  </h3>
                  <p className="text-on-surface-variant text-xs">
                    {stats.timeSeries
                      ? `${stats.timeSeries.series.length} periods · ${stats.timeSeries.primaryCol}`
                      : histData
                      ? `${selectedHistCol} · ${histData.skewDirection ?? 'Distribution'}`
                      : 'Upload data with a date column for time series'}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {comboKeys.length > 0 && !stats.timeSeries && (
                    <select value={selectedHistCol ?? ''} onChange={e => setSelectedHistCol(e.target.value)}
                      className="bg-surface-container-lowest border border-outline-variant/20 text-xs rounded-lg px-4 py-2.5 text-on-surface font-medium focus:ring-2 focus:ring-primary cursor-pointer truncate">
                      {comboKeys.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  )}
                  {!stats.timeSeries && histData && (
                    <select value={histGraphType} onChange={e => setHistGraphType(e.target.value)}
                      className="bg-surface-container-lowest border border-outline-variant/20 text-xs rounded-lg px-4 py-2.5 text-primary font-bold focus:ring-2 focus:ring-primary cursor-pointer">
                      <option value="bar">Bar Chart</option>
                      <option value="pie">Pie Chart</option>
                      <option value="area">Area Graph</option>
                      <option value="scatter">Dotted Graph</option>
                      <option value="histogram">Histogram</option>
                    </select>
                  )}
                </div>
              </div>
              
              <div className="flex-grow relative h-full min-h-[280px]">
                {stats.timeSeries ? (
                  <DynamicTimeSeries
                    data={stats.timeSeries.series}
                    trendLine={stats.timeSeries.trendLine}
                    peak={stats.timeSeries.peak}
                    trough={stats.timeSeries.trough}
                    trendDirection={stats.timeSeries.trendDirection}
                  />
                ) : histData ? (
                  <DynamicChart data={comboChartData} graphType={histGraphType} xAxisKey="range" yAxisKey="count" />
                ) : (
                  <EmptyChartState />
                )}
              </div>

              {stats.timeSeries && (
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-surface-container-low rounded-lg p-3">
                    <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold mb-1">Peak</p>
                    <p className="font-bold text-primary truncate">{stats.timeSeries.peak?.value?.toLocaleString()}</p>
                    <p className="text-on-surface-variant text-[10px] truncate">{stats.timeSeries.peak?.date}</p>
                  </div>
                  <div className="bg-surface-container-low rounded-lg p-3">
                    <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold mb-1">Trough</p>
                    <p className="font-bold text-error truncate">{stats.timeSeries.trough?.value?.toLocaleString()}</p>
                    <p className="text-on-surface-variant text-[10px] truncate">{stats.timeSeries.trough?.date}</p>
                  </div>
                  <div className="bg-surface-container-low rounded-lg p-3">
                    <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold mb-1">P/T Ratio</p>
                    <p className="font-bold">{stats.timeSeries.peakToTroughRatio ?? '—'}×</p>
                    {stats.timeSeries.seasonalityHint && (
                      <p className="text-amber-400 text-[10px] mt-0.5 truncate" title={stats.timeSeries.seasonalityHint}>
                        {stats.timeSeries.seasonalityHint}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-surface-container p-5 sm:p-8 rounded-2xl flex flex-col relative overflow-hidden shadow-sm border border-outline-variant/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-tertiary/10 rounded-lg">
                  <span className="material-symbols-outlined text-tertiary text-lg">data_exploration</span>
                </div>
                <h3 className="font-headline font-bold text-base">Category Analysis</h3>
              </div>

              {catAgg ? (
                <div className="flex flex-col gap-4 flex-1">
                  {catAggKeys.length > 1 && (
                    <select
                      value={selectedCatCol ?? ''}
                      onChange={(e) => setSelectedCatCol(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 text-xs font-medium rounded-lg px-3 py-2 text-on-surface focus:ring-2 focus:ring-tertiary cursor-pointer"
                    >
                      {catAggKeys.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Donut */}
                  <DonutChart data={catAgg.donut} size={150} thickness={26} />

                  {catAgg.comparativeInsight && (
                    <div className="bg-surface-container-high rounded-lg p-3 text-xs text-on-surface leading-relaxed border border-outline-variant/10">
                      <span className="material-symbols-outlined text-amber-400 text-sm align-middle mr-1">lightbulb</span>
                      {catAgg.comparativeInsight}
                    </div>
                  )}

                  {/* Bar */}
                  <div style={{ height: 160, flex: 1 }}>
                    <DynamicBarChart data={catAgg.top5} xAxisKey="label" barKey="sum" color="#c799ff" />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40">
                  <span className="material-symbols-outlined text-3xl">category</span>
                  <p className="text-xs text-on-surface-variant text-center">No categorical columns detected</p>
                </div>
              )}
            </div>
          </section>

          {/* Frequency Distributions */}
          {catStatKeys.length > 0 && (
            <section className="bg-surface-container rounded-2xl p-5 sm:p-7 border border-outline-variant/5">
              <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-headline font-bold mb-1">Frequency Distribution</h3>
                  <p className="text-on-surface-variant text-xs">Value frequency for categorical columns</p>
                </div>
                {catStatKeys.length > 1 && (
                  <select
                    value={selectedFreqCol ?? ''}
                    onChange={(e) => setSelectedFreqCol(e.target.value)}
                    className="bg-surface-container-lowest border border-outline-variant/20 text-xs rounded-lg px-3 py-2 text-on-surface font-medium focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    {catStatKeys.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {freqData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div style={{ height: 260 }}>
                    <DynamicBarChart
                      data={freqData.top10.map((d) => ({ range: d.value, count: d.count }))}
                      xAxisKey="range"
                      barKey="count"
                      color="#94d4ff"
                    />
                  </div>

                  <div className="bg-surface-container-low rounded-xl overflow-auto border border-outline-variant/10 max-h-[280px]">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-surface-container-high sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            Value
                          </th>
                          <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            Count
                          </th>
                          <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            %
                          </th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant w-28">
                            Bar
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {freqData.top10.map((d, i) => (
                          <tr key={i} className="hover:bg-surface-bright transition-colors">
                            <td className="px-4 py-2.5 font-medium truncate max-w-[150px] text-xs">{d.value}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs">{d.count.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs">{d.pct}%</td>
                            <td className="px-4 py-2.5">
                              <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${d.pct}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Date Analysis */}
          {stats.dateColumns?.length > 0 && (
            <section className="bg-surface-container rounded-2xl p-5 sm:p-7 border border-outline-variant/5">
              <h3 className="text-lg font-headline font-bold mb-5">Date Column Analysis</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.dateColumns.map((col) => {
                  const d = stats.dateStats[col];
                  if (!d) return null;
                  return (
                    <div key={col} className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/10 space-y-3">
                      <p className="font-bold text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-lg">calendar_month</span>
                        {col}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-on-surface-variant">Earliest</span>
                          <p className="font-mono font-bold">{d.earliest}</p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">Latest</span>
                          <p className="font-mono font-bold">{d.latest}</p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">Span</span>
                          <p className="font-bold">{d.rangeInDays} days</p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">Top Day</span>
                          <p className="font-bold">{d.mostCommonDay}</p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">Top Month</span>
                          <p className="font-bold">{d.mostCommonMonth}</p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">Max Gap</span>
                          <p className={`font-bold ${d.hasGapAnomaly ? 'text-error' : ''}`}>
                            {d.largestGapDays}d {d.hasGapAnomaly ? '⚠️' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}