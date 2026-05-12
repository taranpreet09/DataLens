import { useState } from 'react'

export default function AnomalyDetectionPanel({ columns, onRun, loading }) {
  const [selectedCols, setSelectedCols] = useState([])
  const [nTrees, setNTrees] = useState(100)
  const [contamination, setContamination] = useState(0.1)

  const toggleCol = (col) => {
    setSelectedCols(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    )
  }

  const handleRun = () => {
    onRun({
      columns: selectedCols.length > 0 ? selectedCols : undefined,
      nTrees,
      contamination,
    })
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
      <h3 className="text-white font-semibold">Isolation Forest Parameters</h3>

      <div>
        <label className="text-xs text-gray-400">Number of Trees</label>
        <input
          type="range"
          min="10"
          max="200"
          step="10"
          value={nTrees}
          onChange={(e) => setNTrees(parseInt(e.target.value))}
          className="w-full mt-1"
        />
        <span className="text-xs text-gray-500">{nTrees} trees</span>
      </div>

      <div>
        <label className="text-xs text-gray-400">Contamination (expected anomaly %)</label>
        <input
          type="range"
          min="0.01"
          max="0.3"
          step="0.01"
          value={contamination}
          onChange={(e) => setContamination(parseFloat(e.target.value))}
          className="w-full mt-1"
        />
        <span className="text-xs text-gray-500">{(contamination * 100).toFixed(0)}%</span>
      </div>

      <div>
        <label className="text-xs text-gray-400">Columns (leave empty for all numeric)</label>
        <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
          {columns.map(col => (
            <label key={col} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCols.includes(col)}
                onChange={() => toggleCol(col)}
                className="rounded bg-white/10 border-white/20 text-red-500"
              />
              <span className="text-xs text-gray-300">{col}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={loading}
        className="w-full py-2 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Detect Anomalies'}
      </button>
    </div>
  )
}
