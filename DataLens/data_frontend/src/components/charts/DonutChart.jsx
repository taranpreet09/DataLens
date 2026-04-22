const COLORS = ['#94aaff', '#c799ff', '#ff9494', '#94ffc7', '#ffcc94', '#94d4ff'];

export default function DonutChart({ data, size = 180, thickness = 24 }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.sum, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  let accumulated = 0;
  const segments = data.map((d, i) => {
    const pct = d.sum / total;
    const dashArray = pct * circumference;
    const dashOffset = -accumulated * circumference;
    accumulated += pct;
    return {
      ...d,
      pct: Math.round(pct * 100),
      color: COLORS[i % COLORS.length],
      dashArray,
      dashOffset,
    };
  });

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-surface-container-highest" />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${seg.dashArray} ${circumference - seg.dashArray}`}
              strokeDashoffset={seg.dashOffset}
              className="transition-all hover:opacity-80"
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold font-headline">{segments[0]?.pct}%</span>
          <span className="text-[9px] text-on-surface-variant truncate max-w-[60px]">{segments[0]?.label}</span>
        </div>
      </div>
      <div className="space-y-1.5 flex-1 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: seg.color }}></span>
            <span className="truncate text-on-surface font-medium flex-1">{seg.label}</span>
            <span className="text-on-surface-variant shrink-0">{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
