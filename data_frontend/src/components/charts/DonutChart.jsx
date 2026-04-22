const COLORS = ['#94aaff', '#c799ff', '#ff9494', '#5cfd80', '#ffcc94', '#94d4ff', '#ff94d4'];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(cx, cy, r, startAngle, endAngle, thickness) {
  const innerR = r - thickness;
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export default function DonutChart({ data, size = 160, thickness = 28 }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((s, d) => s + (d.sum || d.count || 0), 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  let currentAngle = 0;
  const segments = data.map((d, i) => {
    const value = d.sum || d.count || 0;
    const pct = value / total;
    const sweep = pct * 360;
    const gap = data.length > 1 ? 1.5 : 0;
    const startAngle = currentAngle + gap / 2;
    const endAngle = currentAngle + sweep - gap / 2;
    currentAngle += sweep;

    return {
      ...d,
      value,
      pct: Math.round(pct * 100),
      color: COLORS[i % COLORS.length],
      path: endAngle > startAngle ? arcPath(cx, cy, r, startAngle, endAngle, thickness) : null,
    };
  });

  const topSegment = segments[0];

  return (
    <div className="flex items-start gap-4 w-full">
      {/* SVG Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          {/* Background ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r - thickness / 2}
            fill="none"
            stroke="#262626"
            strokeWidth={thickness}
          />
          {/* Segments — each shows a tooltip on hover */}
          {segments.map((seg, i) =>
            seg.path ? (
              <g key={i}>
                <path
                  d={seg.path}
                  fill={seg.color}
                  opacity={0.9}
                  className="transition-all hover:opacity-100 cursor-pointer"
                  style={{ filter: 'drop-shadow(0 0 0px transparent)' }}
                >
                  <title>{`${seg.label}: ${seg.pct}% (${seg.value?.toLocaleString()})`}</title>
                </path>
              </g>
            ) : null
          )}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold font-headline leading-none" style={{ color: topSegment?.color }}>
            {topSegment?.pct}%
          </span>
          <span
            className="text-[9px] text-on-surface-variant text-center leading-tight mt-0.5 px-1"
            style={{ maxWidth: size * 0.5 + 'px', wordBreak: 'break-word' }}
            title={topSegment?.label}
          >
            {topSegment?.label}
          </span>
        </div>
      </div>

      {/* Legend — full labels, no truncation */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0 overflow-y-auto" style={{ maxHeight: size }}>
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs group cursor-default" title={`${seg.label}: ${seg.value?.toLocaleString()} (${seg.pct}%)` }>
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0 flex-none transition-transform group-hover:scale-125"
              style={{ background: seg.color }}
            />
            <span className="text-on-surface font-medium flex-1 min-w-0 group-hover:text-white transition-colors" style={{ wordBreak: 'break-word' }}>
              {seg.label}
            </span>
            <span className="text-on-surface-variant shrink-0 tabular-nums group-hover:text-white transition-colors">{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}