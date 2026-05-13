/**
 * DataLoadingState — shown while a dataset is being processed/hydrated.
 * Used across all pages that consume `stats` so the UI never goes blank during hydration.
 */
export default function DataLoadingState({
  title = 'Preparing visualizations',
  subtitle,
  rowCount,
  columnCount,
  stage,
}) {
  const stageMessages = {
    processing: 'Processing dataset on server...',
    parsing: 'Parsing file...',
    computing: 'Computing statistics...',
    hydrating: 'Computing statistics...',
  };

  const message = subtitle ?? stageMessages[stage] ?? 'Crunching numbers, almost there...';

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] gap-6 bg-surface-container-low rounded-2xl border border-outline-variant/10 p-12 mx-4 sm:mx-0">
      {/* Animated ring */}
      <div className="relative">
        <div className="h-20 w-20 rounded-full border-4 border-outline-variant/20" />
        <div className="absolute inset-0 h-20 w-20 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-spin" />
        <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-primary text-2xl">
          insights
        </span>
      </div>

      {/* Title + subtitle */}
      <div className="text-center space-y-2 max-w-md">
        <h3 className="text-lg font-headline font-bold text-on-surface">{title}</h3>
        <p className="text-sm text-on-surface-variant">{message}</p>
      </div>

      {/* Meta row */}
      {(rowCount || columnCount) && (
        <div className="flex gap-6 text-xs text-on-surface-variant">
          {rowCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">table_rows</span>
              <span className="font-mono">{rowCount.toLocaleString()} rows</span>
            </div>
          )}
          {columnCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">view_column</span>
              <span className="font-mono">{columnCount} columns</span>
            </div>
          )}
        </div>
      )}

      {/* Progress bar (indeterminate) */}
      <div className="w-full max-w-xs h-1 bg-surface-container-highest rounded-full overflow-hidden">
        <div className="h-full w-1/3 bg-primary rounded-full animate-[loadbar_1.5s_ease-in-out_infinite]" />
      </div>
      <style>{`
        @keyframes loadbar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
