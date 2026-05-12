import { useState } from 'react'

export default function RegressionPanel({ columns, allColumns, onRun, loading }) {
  const [type, setType] = useState('linear')
  const [xColumn, setXColumn] = useState('')
  const [yColumn, setYColumn] = useState('')
  const [xColumns, setXColumns] = useState([])
  const [degree, setDegree] = useState(2)

  const toggleMultiCol = (col) => {
    setXColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    )
  }

  const handleRun = () => {
    const params = { yColumn, type }
    if (type === 'multiple') {
      params.xColumns = xColumns
    } else {
      params.xColumn = xColumn
    }
    if (type === 'polynomial') {
      params.degree = degree
    }
    onRun(params)
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
      <h3 className="text-white font-semibold">Regression Parameters</h3>

      {/* Type selector */}
      <div>
        <label className="text-xs text-gray-400">Type</label>
        <div className="flex gap-2 mt-1">
          {['linear', 'polynomial', 'multiple'].map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1 rounded text-xs font-medium ${
                type === t ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Target (Y) */}
      <div>
        <label className="text-xs text-gray-400">Target Column (Y)</label>
        <select
          value={yColumn}
          onChange={(e) => setYColumn(e.target.value)}
          className="w-full mt-1 px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm"
        >
          <option value="">Select...</option>
          {columns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>

      {/* Feature (X) */}
      {type !== 'multiple' ? (
        <div>
          <label className="text-xs text-gray-400">Feature Column (X)</label>
          <select
            value={xColumn}
            onChange={(e) => setXColumn(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm"
          >
            <option value="">Select...</option>
            {columns.filter(c => c !== yColumn).map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="text-xs text-gray-400">Feature Columns (X)</label>
          <div className="mt-1 max-h-32 overflow-y-auto space-y-1">
            {columns.filter(c => c !== yColumn).map(col => (
              <label key={col} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={xColumns.includes(col)}
                  onChange={() => toggleMultiCol(col)}
                  className="rounded bg-white/10 border-white/20 text-blue-500"
                />
                <span className="text-xs text-gray-300">{col}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Degree for polynomial */}
      {type === 'polynomial' && (
        <div>
          <label className="text-xs text-gray-400">Polynomial Degree</label>
          <input
            type="range"
            min="2"
            max="5"
            value={degree}
            onChange={(e) => setDegree(parseInt(e.target.value))}
            className="w-full mt-1"
          />
          <span className="text-xs text-gray-500">Degree: {degree}</span>
        </div>
      )}

      <button
        onClick={handleRun}
        disabled={loading || !yColumn}
        className="w-full py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Run Regression'}
      </button>
    </div>
  )
}
