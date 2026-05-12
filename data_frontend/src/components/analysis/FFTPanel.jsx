import { useState } from 'react'

export default function FFTPanel({ numericColumns, dateColumns, onRun, loading }) {
  const [valueColumn, setValueColumn] = useState('')
  const [dateColumn, setDateColumn] = useState('')

  const handleRun = () => {
    onRun({
      valueColumn,
      dateColumn: dateColumn || undefined,
    })
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
      <h3 className="text-white font-semibold">FFT Seasonality Detection</h3>

      <div>
        <label className="text-xs text-gray-400">Value Column (time series)</label>
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

      <div className="bg-black/20 rounded p-3 text-xs text-gray-400">
        <p className="font-medium text-gray-300 mb-1">How it works:</p>
        <p>FFT decomposes your time series into frequency components, revealing hidden periodic patterns (daily, weekly, monthly cycles).</p>
      </div>

      <button
        onClick={handleRun}
        disabled={loading || !valueColumn}
        className="w-full py-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Detect Seasonality'}
      </button>
    </div>
  )
}
