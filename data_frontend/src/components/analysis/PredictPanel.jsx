import { useState, useCallback } from 'react';

/**
 * Drag-and-drop "predict X from Y, Z" interface.
 * Users drag columns into target/feature zones to build a prediction model.
 */
export default function PredictPanel({ columns, numericColumns, onRun, loading }) {
  const [target, setTarget] = useState(null);
  const [features, setFeatures] = useState([]);
  const [modelType, setModelType] = useState('auto');
  const [draggedCol, setDraggedCol] = useState(null);

  const availableColumns = columns.filter(
    c => c !== target && !features.includes(c)
  );

  const handleDragStart = (col) => {
    setDraggedCol(col);
  };

  const handleDropTarget = useCallback((e) => {
    e.preventDefault();
    if (draggedCol) {
      // If dropping on target, remove from features if it was there
      setFeatures(prev => prev.filter(f => f !== draggedCol));
      setTarget(draggedCol);
      setDraggedCol(null);
    }
  }, [draggedCol]);

  const handleDropFeatures = useCallback((e) => {
    e.preventDefault();
    if (draggedCol && draggedCol !== target) {
      setFeatures(prev => prev.includes(draggedCol) ? prev : [...prev, draggedCol]);
      setDraggedCol(null);
    }
  }, [draggedCol, target]);

  const handleDragOver = (e) => e.preventDefault();

  const removeTarget = () => setTarget(null);
  const removeFeature = (col) => setFeatures(prev => prev.filter(f => f !== col));

  const handleRun = () => {
    if (!target || features.length === 0) return;
    onRun({
      targetColumn: target,
      featureColumns: features,
      modelType,
    });
  };

  const canRun = target && features.length > 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <span className="text-lg">🎯</span>
        Predict Builder
      </h3>
      <p className="text-xs text-gray-400">
        Drag columns into the zones below to define your prediction model.
      </p>

      {/* Model type selector */}
      <div>
        <label className="text-xs text-gray-400">Model Type</label>
        <div className="flex gap-2 mt-1">
          {[
            { id: 'auto', label: 'Auto' },
            { id: 'linear', label: 'Linear' },
            { id: 'polynomial', label: 'Polynomial' },
            { id: 'multiple', label: 'Multiple' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setModelType(t.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                modelType === t.id
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Drop zones */}
      <div className="grid grid-cols-1 gap-3">
        {/* Target zone */}
        <div
          onDrop={handleDropTarget}
          onDragOver={handleDragOver}
          className={`border-2 border-dashed rounded-lg p-3 transition-all min-h-[60px] ${
            draggedCol ? 'border-amber-400/60 bg-amber-400/5' : 'border-white/20 bg-black/20'
          }`}
        >
          <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-2">
            🎯 Predict (Target Y)
          </p>
          {target ? (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded text-xs font-medium border border-amber-500/30">
                {target}
              </span>
              <button
                onClick={removeTarget}
                className="text-gray-500 hover:text-red-400 text-xs"
                aria-label={`Remove ${target} from target`}
              >
                ✕
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">Drop a column here</p>
          )}
        </div>

        {/* Features zone */}
        <div
          onDrop={handleDropFeatures}
          onDragOver={handleDragOver}
          className={`border-2 border-dashed rounded-lg p-3 transition-all min-h-[80px] ${
            draggedCol && draggedCol !== target
              ? 'border-cyan-400/60 bg-cyan-400/5'
              : 'border-white/20 bg-black/20'
          }`}
        >
          <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-2">
            📊 From (Features X₁, X₂, ...)
          </p>
          {features.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {features.map(col => (
                <span
                  key={col}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs font-medium border border-cyan-500/30"
                >
                  {col}
                  <button
                    onClick={() => removeFeature(col)}
                    className="text-cyan-500 hover:text-red-400 ml-0.5"
                    aria-label={`Remove ${col} from features`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">Drop columns here</p>
          )}
        </div>
      </div>

      {/* Available columns */}
      <div>
        <label className="text-xs text-gray-400">Available Columns (drag to zones above)</label>
        <div className="mt-2 max-h-48 overflow-y-auto space-y-1 pr-1">
          {availableColumns.map(col => {
            const isNumeric = numericColumns.includes(col);
            return (
              <div
                key={col}
                draggable
                onDragStart={() => handleDragStart(col)}
                onDragEnd={() => setDraggedCol(null)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-grab active:cursor-grabbing transition-all select-none ${
                  draggedCol === col
                    ? 'bg-white/20 scale-95'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <span className="text-gray-500 text-xs">⠿</span>
                <span className="text-xs text-gray-200 flex-1 truncate">{col}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                  isNumeric ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                }`}>
                  {isNumeric ? 'num' : 'cat'}
                </span>
              </div>
            );
          })}
          {availableColumns.length === 0 && (
            <p className="text-xs text-gray-500 italic py-2">All columns assigned</p>
          )}
        </div>
      </div>

      {/* Quick-assign buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!target && numericColumns.length > 0) {
              setTarget(numericColumns[0]);
              setFeatures(numericColumns.slice(1));
            }
          }}
          className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-white/5 rounded transition-colors"
        >
          Auto-fill numeric
        </button>
        <button
          onClick={() => { setTarget(null); setFeatures([]); }}
          className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-white/5 rounded transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Equation preview */}
      {canRun && (
        <div className="bg-black/30 rounded p-2.5 border border-white/5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Model</p>
          <p className="text-xs text-cyan-300 font-mono mt-1">
            {target} = f({features.join(', ')})
          </p>
        </div>
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={loading || !canRun}
        className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-indigo-500/20"
      >
        {loading ? 'Training Model...' : `Predict ${target || '...'}`}
      </button>
    </div>
  );
}
