import { useState } from 'react'

export default function FeatureImportancePanel({ columns, onRun, loading }) {
  const [targetColumn, setTargetColumn] = useState('')
  const [criterion, setCriterion] = useState('gini')
  const [maxDepth, setMaxDepth] = useState(10)

  const handleRun = () => {
    onRun({ targetColumn, criterion, maxDepth })
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
      <h3 className="text-white font-semibold">Decision Tree Feature Importance</h3>

      <div>
        <label className="text-xs text-gray-400">Target Column</label>
        <select
          value={targetColumn}
          onChange={(e) => setTargetColumn(e.target.value)}
          className="w-full mt-1 px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm"
        >
          <option value="">Select...</option>
          {columns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-400">Split Criterion</label>
        <div className="flex gap-2 mt-1">
          {['gini', 'entropy'].map(c => (
            <button
              key={c}
              onClick={() => setCriterion(c)}
              className={`px-3 py-1 rounded text-xs font-medium ${
                criterion === c ? 'bg-green-500 text-white' : 'bg-white/5 text-gray-400'
              }`}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400">Max Tree Depth</label>
        <input
          type="range"
          min="3"
          max="20"
          value={maxDepth}
          onChange={(e) => setMaxDepth(parseInt(e.target.value))}
          className="w-full mt-1"
        />
        <span className="text-xs text-gray-500">{maxDepth}</span>
      </div>

      <button
        onClick={handleRun}
        disabled={loading || !targetColumn}
        className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Compute Importance'}
      </button>
    </div>
  )
}
