const severityStyles = {
  danger: 'bg-error/10 text-error border-error/20',
  warning: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  info: 'bg-primary/10 text-primary border-primary/20',
};

const severityIcons = {
  danger: 'error',
  warning: 'warning',
  info: 'info',
};

export default function QualityFlagChips({ flags }) {
  if (!flags || flags.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/10 border border-secondary/20">
        <span className="material-symbols-outlined text-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
        <span className="text-xs font-semibold text-secondary">No quality issues detected</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((flag, i) => (
        <div
          key={i}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${severityStyles[flag.severity] || severityStyles.info}`}
          title={flag.detail}
        >
          <span className="material-symbols-outlined text-sm">{severityIcons[flag.severity] || 'info'}</span>
          <span className="truncate max-w-[280px]">{flag.detail}</span>
        </div>
      ))}
    </div>
  );
}
