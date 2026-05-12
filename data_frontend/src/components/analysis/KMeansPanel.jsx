import { useState } from 'react'

export default function KMeansPanel({ columns, onRun, loading }) {
  const [selectedCols, setSelectedCols] = useState([])
  const [k, setK] = useState('')
  const [autoSelect, setAutoSelect] = useState(true)
  const [maxK, setMaxK] = useState(10)

  const toggleCol = (col) => {
    setSelectedCols(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    )
  }

  const handleRun = () => {
    onRun({
      columns: selectedCols.length > 0 ? selectedCols : undefined,
      k: autoSelect ? undefined : (parseInt(k) || undefined),
      autoSelect,
      maxK,
    })
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
      <h3 className="text-white font-semibold">K-Means Parameters</h3>

      {/* Auto-K toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoSelect}
          onChange={(e) => setAutoSelect(e.target.checked)}
          className="rounded bg-white/10 border-white/20 text-cyan-500"
        />
        <span className="text-sm text-gray-300">Auto-select K (Elbow Method)</span>
      </label>

      {!autoSelect && (
        <div>
          <label className="text-xs text-gray-400">Number of Clusters (K)</label>
          <input
            type="number"
            min="2"
            max="20"
            value={k}
            onChange={(e) => setK(e.target.value)}
            placeholder="e.g. 3"
            className="w-full mt-1 px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm"
          />
        </div>
      )}

      {autoSelect && (
        <div>
          <label className="text-xs text-gray-400">Max K to test</label>
          <input
            type="range"
            min="3"
            max="15"
            value={maxK}
            onChange={(e) => setMaxK(parseInt(e.target.value))}
            className="w-full mt-1"
          />
          <span className="text-xs text-gray-500">{maxK}</span>
        </div>
      )}

      {/* Column selection */}
      <div>
        <label className="text-xs text-gray-400">Columns (leave empty for all numeric)</label>
        <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
          {columns.map(col => (
            <label key={col} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCols.includes(col)}
                onChange={() => toggleCol(col)}
                className="rounded bg-white/10 border-white/20 text-violet-500"
              />
              <span className="text-xs text-gray-300">{col}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={loading}
        className="w-full py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Run K-Means'}
      </button>
    </div>
  )
}
