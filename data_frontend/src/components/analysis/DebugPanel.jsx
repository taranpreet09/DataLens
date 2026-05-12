export default function DebugPanel({ info }) {
  if (!info) return null

  return (
    <div className="bg-black/40 border border-white/10 rounded-lg p-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Debug Panel
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-gray-500">Algorithm</span>
          <p className="text-white font-mono">{info.algorithm}</p>
        </div>
        <div>
          <span className="text-gray-500">Server Time</span>
          <p className="text-cyan-300 font-mono">{info.serverExecutionTime ?? '—'}ms</p>
        </div>
        <div>
          <span className="text-gray-500">Round Trip</span>
          <p className="text-amber-300 font-mono">{info.clientRoundTrip}ms</p>
        </div>
        <div>
          <span className="text-gray-500">Dataset Rows</span>
          <p className="text-white font-mono">{info.datasetRows?.toLocaleString() ?? '—'}</p>
        </div>
      </div>

      {info.error && (
        <div className="mt-3 p-2 bg-red-500/10 rounded">
          <span className="text-red-400 text-xs font-mono">{info.error}</span>
        </div>
      )}

      <details className="mt-3">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
          Parameters
        </summary>
        <pre className="mt-2 text-[10px] text-gray-400 font-mono overflow-auto max-h-32 bg-black/30 rounded p-2">
          {JSON.stringify(info.params, null, 2)}
        </pre>
      </details>

      <p className="text-[10px] text-gray-600 mt-2">{info.timestamp}</p>
    </div>
  )
}
