import StatusBadge from './StatusBadge';

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ArtifactTable({ datasets, onExplore, onDelete }) {
  if (datasets.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-16 text-center space-y-3">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">inbox</span>
        <p className="text-on-surface-variant text-sm">No datasets yet. Upload a CSV or Excel file to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto bg-surface-container-low rounded-xl border border-outline-variant/10">
      <table className="w-full text-left border-collapse min-w-[500px]">
        <thead>
          <tr className="bg-surface-container-high">
            <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Artifact Name</th>
            <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant hidden sm:table-cell">Size</th>
            <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Rows</th>
            <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
            <th className="px-4 sm:px-6 py-3 sm:py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {datasets.map(ds => (
            <tr key={ds.id} className="hover:bg-surface-bright transition-colors group">
              <td className="px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined ${ds.ext === 'csv' ? 'text-secondary' : ds.ext === 'xlsx' || ds.ext === 'xls' ? 'text-primary' : 'text-tertiary'}`}>
                    {ds.ext === 'csv' ? 'table_rows' : ds.ext === 'xlsx' || ds.ext === 'xls' ? 'table_view' : 'data_object'}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{ds.name}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {new Date(ds.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {formatBytes(ds.size)}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-on-surface-variant hidden sm:table-cell">{formatBytes(ds.size)}</td>
              <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm font-medium">
                {ds.rowCount != null ? ds.rowCount.toLocaleString() : '—'}
              </td>
              <td className="px-4 sm:px-6 py-4 sm:py-5"><StatusBadge status={ds.status} /></td>
              <td className="px-4 sm:px-6 py-4 sm:py-5 text-right">
                <div className="flex items-center justify-end gap-2">
                  {ds.status === 'ready' && (
                    <button
                      onClick={() => onExplore(ds.id)}
                      className="bg-primary/10 text-primary hover:bg-primary hover:text-on-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded transition-all cursor-pointer"
                    >
                      Explore
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(ds.id)}
                    className="p-1.5 hover:bg-error/10 hover:text-error rounded transition-all cursor-pointer text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
