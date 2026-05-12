import { useState } from 'react'

export default function ForecastPanel({ numericColumns, dateColumns, onRun, loading }) {
  const [valueColumn, setValueColumn] = useState('')
  const [dateColumn, setDateColumn] = useState('')
  const [seasonLength, setSeasonLength] = useState(12)
  const [forecastPeriods, setForecastPeriods] = useState(12)
  const [multiplicative, setMultiplicative] = useState(true)

  const handleRun = () => {
    onRun({
      valueColumn,
      dateColumn: dateColumn || undefined,
      seasonLength,
      forecastPeriods,
      multiplicative,
    })
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
      <h3 className="text-white font-semibold">Holt-Winters Forecast</h3>

      <div>
        <label className="text-xs text-gray-400">Value Column</label>
        <select
          value={valueColumn}
          onChange={(e) => setValueColumn(e.target.value)}
          className="w-full mt-1 px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm"
        >
          <option value="">Select...</option>
          {numericColumns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-400">Date Column (optional, for sorting)</label>
        <select
          value={dateColumn}
          onChange={(e) => setDateColumn(e.target.value)}
          className="w-full mt-1 px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm"
        >
          <option value="">None (use row order)</option>
          {dateColumns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-400">Season Length</label>
        <input
          type="number"
          min="2"
          max="365"
          value={seasonLength}
          onChange={(e) => setSeasonLength(parseInt(e.target.value) || 12)}
          className="w-full mt-1 px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-gray-400">Forecast Periods</label>
        <input
          type="range"
          min="1"
          max="52"
          value={forecastPeriods}
          onChange={(e) => setForecastPeriods(parseInt(e.target.value))}
          className="w-full mt-1"
        />
        <span className="text-xs text-gray-500">{forecastPeriods} periods</span>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={multiplicative}
          onChange={(e) => setMultiplicative(e.target.checked)}
          className="rounded bg-white/10 border-white/20 text-amber-500"
        />
        <span className="text-sm text-gray-300">Multiplicative seasonality</span>
      </label>

      <button
        onClick={handleRun}
        disabled={loading || !valueColumn}
        className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Generate Forecast'}
      </button>
    </div>
  )
}
