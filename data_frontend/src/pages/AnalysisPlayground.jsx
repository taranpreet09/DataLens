import { useState, useCallback } from 'react'
import { useDataset } from '../context/DatasetContext'
import { analysisEngineApi } from '../lib/api'
import KMeansPanel from '../components/analysis/KMeansPanel'
import RegressionPanel from '../components/analysis/RegressionPanel'
import FeatureImportancePanel from '../components/analysis/FeatureImportancePanel'
import AnomalyDetectionPanel from '../components/analysis/AnomalyDetectionPanel'
import ForecastPanel from '../components/analysis/ForecastPanel'
import FFTPanel from '../components/analysis/FFTPanel'
import PredictPanel from '../components/analysis/PredictPanel'
import DebugPanel from '../components/analysis/DebugPanel'
import ClusterScatterPlot from '../components/charts/ClusterScatterPlot'
import ForecastChart from '../components/charts/ForecastChart'

const ALGORITHMS = [
  { id: 'kmeans', name: 'K-Means Clustering', icon: '◎', color: 'from-violet-500 to-purple-600' },
  { id: 'regression', name: 'Regression', icon: '📈', color: 'from-blue-500 to-cyan-600' },
  { id: 'predict', name: 'Predict Builder', icon: '🎯', color: 'from-indigo-500 to-purple-600' },
  { id: 'feature-importance', name: 'Feature Importance', icon: '🌳', color: 'from-green-500 to-emerald-600' },
  { id: 'anomaly', name: 'Anomaly Detection', icon: '🔍', color: 'from-red-500 to-orange-600' },
  { id: 'forecast', name: 'Holt-Winters Forecast', icon: '📊', color: 'from-amber-500 to-yellow-600' },
  { id: 'fft', name: 'FFT Seasonality', icon: '〰️', color: 'from-pink-500 to-rose-600' },
]

export default function AnalysisPlayground() {
  const { activeDataset } = useDataset()
  const [selectedAlgo, setSelectedAlgo] = useState('kmeans')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [debugInfo, setDebugInfo] = useState(null)

  const runAnalysis = useCallback(async (algoId, params) => {
    if (!activeDataset?.dbId) {
      setError('No dataset selected or dataset not synced to server.')
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)
    setDebugInfo(null)

    const t0 = performance.now()
    try {
      let result
      switch (algoId) {
        case 'kmeans':
          result = await analysisEngineApi.kMeans(activeDataset.dbId, params)
          break
        case 'regression':
          result = await analysisEngineApi.regression(activeDataset.dbId, params)
          break
        case 'feature-importance':
          result = await analysisEngineApi.featureImportance(activeDataset.dbId, params)
          break
        case 'anomaly':
          result = await analysisEngineApi.anomalyDetection(activeDataset.dbId, params)
          break
        case 'forecast':
          result = await analysisEngineApi.forecast(activeDataset.dbId, params)
          break
        case 'fft':
          result = await analysisEngineApi.fft(activeDataset.dbId, params)
          break
        case 'predict':
          // Predict uses regression with multiple features
          result = await analysisEngineApi.regression(activeDataset.dbId, {
            yColumn: params.targetColumn,
            xColumns: params.featureColumns,
            type: params.modelType === 'auto' ? 'multiple' : params.modelType,
          })
          break
        default:
          throw new Error(`Unknown algorithm: ${algoId}`)
      }

      const clientTime = Math.round(performance.now() - t0)
      setResults(result)
      setDebugInfo({
        algorithm: algoId,
        params,
        serverExecutionTime: result.executionTime,
        clientRoundTrip: clientTime,
        timestamp: new Date().toISOString(),
        datasetRows: activeDataset.rowCount,
      })
    } catch (err) {
      setError(err.message)
      setDebugInfo({
        algorithm: algoId,
        params,
        error: err.message,
        clientRoundTrip: Math.round(performance.now() - t0),
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }, [activeDataset])

  const numericColumns = activeDataset?.headers?.filter(h => {
    const type = activeDataset.stats?.columnTypes?.[h]
    return type === 'numeric'
  }) || []

  const dateColumns = activeDataset?.headers?.filter(h => {
    const type = activeDataset.stats?.columnTypes?.[h]
    return type === 'date'
  }) || []

  const allColumns = activeDataset?.headers || []

  if (!activeDataset || activeDataset.status !== 'ready') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🧪</div>
          <h2 className="text-xl font-semibold text-white mb-2">Analysis Playground</h2>
          <p className="text-gray-400">Upload and select a dataset to start analyzing.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Analysis Playground</h1>
            <p className="text-sm text-gray-400 mt-1">
              Dataset: <span className="text-cyan-400">{activeDataset.name}</span>
              {' · '}{activeDataset.rowCount?.toLocaleString()} rows
              {' · '}{numericColumns.length} numeric columns
            </p>
          </div>
        </div>

        {/* Algorithm Selector */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {ALGORITHMS.map(algo => (
            <button
              key={algo.id}
              onClick={() => { setSelectedAlgo(algo.id); setResults(null); setError(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedAlgo === algo.id
                  ? `bg-gradient-to-r ${algo.color} text-white shadow-lg`
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <span className="mr-1.5">{algo.icon}</span>
              {algo.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Left: Parameters */}
          <div className="xl:col-span-1">
            {selectedAlgo === 'kmeans' && (
              <KMeansPanel
                columns={numericColumns}
                onRun={(params) => runAnalysis('kmeans', params)}
                loading={loading}
              />
            )}
            {selectedAlgo === 'regression' && (
              <RegressionPanel
                columns={numericColumns}
                allColumns={allColumns}
                onRun={(params) => runAnalysis('regression', params)}
                loading={loading}
              />
            )}
            {selectedAlgo === 'predict' && (
              <PredictPanel
                columns={allColumns}
                numericColumns={numericColumns}
                onRun={(params) => runAnalysis('predict', params)}
                loading={loading}
              />
            )}
            {selectedAlgo === 'feature-importance' && (
              <FeatureImportancePanel
                columns={allColumns}
                onRun={(params) => runAnalysis('feature-importance', params)}
                loading={loading}
              />
            )}
            {selectedAlgo === 'anomaly' && (
              <AnomalyDetectionPanel
                columns={numericColumns}
                onRun={(params) => runAnalysis('anomaly', params)}
                loading={loading}
              />
            )}
            {selectedAlgo === 'forecast' && (
              <ForecastPanel
                numericColumns={numericColumns}
                dateColumns={dateColumns}
                onRun={(params) => runAnalysis('forecast', params)}
                loading={loading}
              />
            )}
            {selectedAlgo === 'fft' && (
              <FFTPanel
                numericColumns={numericColumns}
                dateColumns={dateColumns}
                onRun={(params) => runAnalysis('fft', params)}
                loading={loading}
              />
            )}
          </div>

          {/* Right: Results + Debug */}
          <div className="xl:col-span-2 space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm font-medium">Error</p>
                <p className="text-red-300 text-sm mt-1">{error}</p>
              </div>
            )}

            {loading && (
              <div className="bg-white/5 rounded-lg p-8 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
                <span className="ml-3 text-gray-300">Running analysis...</span>
              </div>
            )}

            {results && !loading && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-3">Results</h3>
                <ResultsView algorithm={selectedAlgo} results={results} />
              </div>
            )}

            {debugInfo && (
              <DebugPanel info={debugInfo} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultsView({ algorithm, results }) {
  switch (algorithm) {
    case 'kmeans':
      return <KMeansResults results={results} />
    case 'regression':
    case 'predict':
      return <RegressionResults results={results} />
    case 'feature-importance':
      return <FeatureImportanceResults results={results} />
    case 'anomaly':
      return <AnomalyResults results={results} />
    case 'forecast':
      return <ForecastResults results={results} />
    case 'fft':
      return <FFTResults results={results} />
    default:
      return <pre className="text-xs text-gray-300 overflow-auto">{JSON.stringify(results, null, 2)}</pre>
  }
}

function KMeansResults({ results }) {
  // Build scatter data from assignments if available
  const scatterData = results.assignments?.map((cluster, i) => ({
    x: results.projectedPoints?.[i]?.[0] ?? i,
    y: results.projectedPoints?.[i]?.[1] ?? cluster,
    cluster,
    rowIndex: i,
  })) || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="K" value={results.k} />
        <MetricCard label="WCSS" value={results.wcss?.toLocaleString()} />
        <MetricCard label="Silhouette" value={results.silhouetteScore?.toFixed(3)} />
        <MetricCard label="Valid Rows" value={results.validRows?.toLocaleString()} />
      </div>

      {/* Quality Indicators */}
      {results.silhouetteScore != null && (
        <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
          results.silhouetteScore > 0.5 ? 'bg-emerald-500/15 text-emerald-300' :
          results.silhouetteScore > 0.25 ? 'bg-amber-500/15 text-amber-300' :
          'bg-red-500/15 text-red-300'
        }`}>
          {results.silhouetteScore > 0.5
            ? `Strong clustering structure (silhouette = ${results.silhouetteScore.toFixed(3)})`
            : results.silhouetteScore > 0.25
            ? `Moderate clustering structure (silhouette = ${results.silhouetteScore.toFixed(3)})`
            : `Weak clustering — consider fewer clusters or different columns (silhouette = ${results.silhouetteScore.toFixed(3)})`
          }
          {results.daviesBouldinIndex != null && (
            <span className="ml-2 opacity-70">· DB Index: {results.daviesBouldinIndex.toFixed(3)}</span>
          )}
        </div>
      )}

      {/* Interactive Cluster Scatter Plot (#35) */}
      {scatterData.length > 0 && (
        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
          <ClusterScatterPlot
            data={scatterData}
            clusterStats={results.clusterStats}
            xLabel={results.columnsUsed?.[0] || 'Dimension 1'}
            yLabel={results.columnsUsed?.[1] || 'Dimension 2'}
            showCentroids={true}
          />
        </div>
      )}

      {results.clusterStats && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Cluster Details</h4>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(results.clusterStats).map(([id, stat]) => (
              <span key={id} className="px-2 py-1 bg-violet-500/20 text-violet-300 rounded text-xs">
                Cluster {id}: {stat.size} pts{stat.avgSilhouette != null ? ` (s=${stat.avgSilhouette.toFixed(2)})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {results.elbow && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Elbow Method (WCSS by K)</h4>
          <div className="flex gap-1 items-end h-20">
            {results.elbow.wcssValues?.map(({ k, wcss }) => {
              const maxW = results.elbow.wcssValues[0]?.wcss || 1
              const height = (wcss / maxW) * 100
              return (
                <div key={k} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-full rounded-t ${k === results.k ? 'bg-cyan-400' : 'bg-white/20'}`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-gray-500 mt-1">{k}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function RegressionResults({ results }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="R²" value={results.rSquared} />
        <MetricCard label="Adj. R²" value={results.adjustedRSquared} />
        <MetricCard label="RMSE" value={results.rmse} />
        <MetricCard label="N" value={results.n} />
      </div>

      {/* Model diagnostics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {results.fStatistic != null && (
          <div className="bg-black/20 rounded px-2.5 py-1.5">
            <p className="text-[9px] text-gray-500 uppercase">F-Statistic</p>
            <p className="text-xs text-white font-mono">{results.fStatistic}</p>
          </div>
        )}
        {results.durbinWatson != null && (
          <div className="bg-black/20 rounded px-2.5 py-1.5">
            <p className="text-[9px] text-gray-500 uppercase">Durbin-Watson</p>
            <p className="text-xs text-white font-mono">{results.durbinWatson}</p>
            <p className="text-[9px] text-gray-600">
              {results.durbinWatson > 1.5 && results.durbinWatson < 2.5 ? 'No autocorrelation' :
               results.durbinWatson <= 1.5 ? 'Positive autocorrelation' : 'Negative autocorrelation'}
            </p>
          </div>
        )}
        {results.type && (
          <div className="bg-black/20 rounded px-2.5 py-1.5">
            <p className="text-[9px] text-gray-500 uppercase">Type</p>
            <p className="text-xs text-white font-mono capitalize">{results.type}</p>
          </div>
        )}
      </div>

      {/* VIF for multiple regression */}
      {results.vif && results.featureNames && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Multicollinearity (VIF)</h4>
          <div className="space-y-1">
            {results.featureNames.map((name, i) => {
              const vif = results.vif[i];
              const isHigh = vif > 5;
              return (
                <div key={name} className="flex justify-between text-xs">
                  <span className="text-gray-400">{name}</span>
                  <span className={`font-mono ${isHigh ? 'text-amber-400' : 'text-white'}`}>
                    {vif === Infinity ? '∞' : vif?.toFixed(2)}{isHigh ? ' ⚠️' : ''}
                  </span>
                </div>
              );
            })}
          </div>
          {results.vif.some(v => v > 5) && (
            <p className="text-[10px] text-amber-400/70 mt-1">⚠ VIF &gt; 5 suggests multicollinearity — consider removing correlated features.</p>
          )}
        </div>
      )}

      {results.equation && (
        <div className="bg-black/30 rounded p-3">
          <p className="text-xs text-gray-400">Equation</p>
          <p className="text-sm text-cyan-300 font-mono mt-1">{results.equation}</p>
        </div>
      )}
      {results.coefficients && results.type === 'multiple' && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Coefficients</h4>
          <div className="space-y-1">
            {results.featureNames?.map((name, i) => (
              <div key={name} className="flex justify-between text-xs">
                <span className="text-gray-400">{name}</span>
                <span className="text-white font-mono">{results.coefficients[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FeatureImportanceResults({ results }) {
  const entries = Object.entries(results.importances || {})
  const maxVal = entries[0]?.[1] || 1

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Task" value={results.taskType} />
        <MetricCard label="Features" value={results.nFeatures} />
        <MetricCard label="Samples" value={results.nSamples} />
        <MetricCard label="Criterion" value={results.criterion} />
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">Feature Importance</h4>
        <div className="space-y-2">
          {entries.map(([name, value]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-32 truncate">{name}</span>
              <div className="flex-1 bg-white/5 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                  style={{ width: `${(value / maxVal) * 100}%` }}
                />
              </div>
              <span className="text-xs text-white font-mono w-12 text-right">{(value * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AnomalyResults({ results }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Anomalies" value={results.nAnomalies} />
        <MetricCard label="Threshold" value={results.threshold} />
        <MetricCard label="Trees" value={results.nTrees} />
        <MetricCard label="Valid Rows" value={results.validRows?.toLocaleString()} />
      </div>
      {results.anomalyRows?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Top Anomalies</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left p-1">Row</th>
                  <th className="text-left p-1">Score</th>
                  {results.columnsUsed?.slice(0, 4).map(col => (
                    <th key={col} className="text-left p-1">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.anomalyRows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="p-1 text-gray-400">{row.originalIndex}</td>
                    <td className="p-1 text-red-400 font-mono">{row.score}</td>
                    {results.columnsUsed?.slice(0, 4).map(col => (
                      <td key={col} className="p-1 text-white">{row.values?.[col]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ForecastResults({ results }) {
  // Build historical data for the chart
  const historicalData = results.fittedValues?.map((v, i) => ({
    label: results.dates?.[i] || `${i + 1}`,
    value: results.originalValues?.[i] ?? v,
  })) || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="RMSE" value={results.rmse} />
        <MetricCard label="Series Length" value={results.seriesLength} />
        <MetricCard label="Season" value={results.params?.seasonLength} />
        <MetricCard label="Forecast" value={`${results.forecast?.length} periods`} />
      </div>

      {/* Forecast Chart with Confidence Bands (#36) */}
      {results.forecast && (
        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
          <ForecastChart
            historicalData={historicalData}
            forecastData={results.forecast}
            confidenceIntervals={results.confidenceIntervals || []}
            fittedValues={results.fittedValues || []}
            title="Holt-Winters Forecast"
            valueLabel={results.params?.valueColumn || 'Value'}
          />
        </div>
      )}

      {results.confidenceIntervals && results.confidenceIntervals.length > 0 && (
        <div className="text-xs text-gray-400 bg-black/20 rounded p-3">
          <p className="font-medium text-gray-300 mb-1">95% Confidence Intervals</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {results.confidenceIntervals.slice(0, 8).map((ci, i) => (
              <div key={i} className="bg-white/5 rounded p-1.5">
                <span className="text-[10px] text-gray-500">Period {i + 1}</span>
                <p className="text-xs font-mono">[{ci.lower?.toFixed(1)}, {ci.upper?.toFixed(1)}]</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FFTResults({ results }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard label="Signal Length" value={results.signalLength} />
        <MetricCard label="Est. Season" value={results.estimatedSeasonLength || 'None'} />
        <MetricCard label="Peaks Found" value={results.dominantFrequencies?.length || 0} />
      </div>
      <div className="bg-black/30 rounded p-3">
        <p className="text-xs text-gray-400">Summary</p>
        <p className="text-sm text-pink-300 mt-1">{results.seasonalitySummary}</p>
      </div>
      {results.dominantFrequencies?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Dominant Frequencies</h4>
          <div className="space-y-1">
            {results.dominantFrequencies.map((f, i) => (
              <div key={i} className="flex justify-between text-xs bg-white/5 rounded p-2">
                <span className="text-gray-400">Period: {f.period}</span>
                <span className="text-pink-300 font-mono">Magnitude: {f.magnitude}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-black/30 rounded-lg p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-white mt-0.5">{value ?? '—'}</p>
    </div>
  )
}
