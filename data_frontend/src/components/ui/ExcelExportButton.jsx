import { useState } from 'react';
import { exportDatasetToExcel } from '../../lib/excelExport';

/**
 * Excel export button with options for which sheets to include.
 * Props:
 *  - dataset: the active dataset object from DatasetContext
 */
export default function ExcelExportButton({ dataset }) {
  const [exporting, setExporting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState({
    includeStats: true,
    includeQuality: true,
    includeCorrelations: true,
  });

  const handleExport = async () => {
    if (!dataset || exporting) return;
    setExporting(true);
    try {
      await exportDatasetToExcel(dataset, options);
    } catch (err) {
      console.error('Excel export error:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
      setShowOptions(false);
    }
  };

  if (!dataset || dataset.status !== 'ready') return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={exporting}
        className="flex items-center gap-2 px-4 h-[52px] bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg text-sm transition-all disabled:opacity-50 active:scale-95"
      >
        <span className="material-symbols-outlined text-sm">
          {exporting ? 'hourglass_empty' : 'table_view'}
        </span>
        {exporting ? 'Exporting...' : 'Export Excel'}
      </button>

      {showOptions && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface-container-high border border-outline-variant/20 rounded-xl shadow-2xl p-4 space-y-3 z-50">
          <p className="text-xs font-semibold text-on-surface">Excel Export Options</p>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeStats}
              onChange={(e) => setOptions(prev => ({ ...prev, includeStats: e.target.checked }))}
              className="rounded bg-white/10 border-white/20 text-green-500"
            />
            <span className="text-xs text-on-surface-variant">Statistics sheet</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeQuality}
              onChange={(e) => setOptions(prev => ({ ...prev, includeQuality: e.target.checked }))}
              className="rounded bg-white/10 border-white/20 text-green-500"
            />
            <span className="text-xs text-on-surface-variant">Quality sheet</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeCorrelations}
              onChange={(e) => setOptions(prev => ({ ...prev, includeCorrelations: e.target.checked }))}
              className="rounded bg-white/10 border-white/20 text-green-500"
            />
            <span className="text-xs text-on-surface-variant">Correlations sheet</span>
          </label>

          <div className="flex gap-2 pt-2 border-t border-outline-variant/10">
            <button
              onClick={handleExport}
              className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Download .xlsx
            </button>
            <button
              onClick={() => setShowOptions(false)}
              className="px-3 py-1.5 bg-surface-container text-on-surface-variant rounded-lg text-xs font-medium hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
