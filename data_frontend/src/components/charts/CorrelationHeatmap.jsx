import { useState } from 'react';

function corrColor(v) {
  if (v === null || v === undefined || isNaN(v)) {
    return { bg: 'rgba(38,38,38,0.4)', text: '#767575' };
  }
  const abs = Math.abs(v);
  if (v > 0) {
    const intensity = abs;
    const r = Math.round(148 - 60 * intensity);
    const g = Math.round(170 - 140 * intensity);
    const b = 255;
    return {
      bg: `rgba(${r},${g},${b},${0.08 + intensity * 0.72})`,
      text: abs > 0.45 ? '#ffffff' : '#94aaff',
    };
  } else {
    const intensity = abs;
    const r = 255;
    const g = Math.round(148 - 148 * intensity);
    const b = Math.round(148 - 100 * intensity);
    return {
      bg: `rgba(${r},${g},${b},${0.08 + intensity * 0.72})`,
      text: abs > 0.45 ? '#ffffff' : '#ff9494',
    };
  }
}

function getStrength(r) {
  if (r === null || r === undefined) return '';
  const a = Math.abs(r);
  if (a >= 0.9) return 'Very strong';
  if (a >= 0.7) return 'Strong';
  if (a >= 0.5) return 'Moderate';
  if (a >= 0.3) return 'Weak';
  return 'Negligible';
}

export default function CorrelationHeatmap({ matrix, columns, insights = [] }) {
  const [hover, setHover] = useState(null);

  const cols = (columns || []).slice(0, 8);

  if (!matrix || cols.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40 py-12">
        <span className="material-symbols-outlined text-3xl">grid_view</span>
        <p className="text-xs text-on-surface-variant text-center">Need ≥ 2 numeric columns for correlation</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Matrix */}
      <div className="overflow-auto">
        {/* Header row */}
        <div
          className="flex gap-0.5 mb-0.5"
          style={{ paddingLeft: cols.length > 4 ? 56 : 64 }}
        >
          {cols.map((c) => (
            <div
              key={c}
              className="flex-1 min-w-0 text-[8px] text-on-surface-variant text-center truncate font-semibold py-0.5"
              title={c}
            >
              {c.length > 7 ? c.slice(0, 6) + '…' : c}
            </div>
          ))}
        </div>

        {/* Rows */}
        {cols.map((rowCol) => (
          <div key={rowCol} className="flex gap-0.5 mb-0.5 items-stretch">
            <span
              className="text-[8px] text-on-surface-variant text-right shrink-0 truncate font-semibold pr-1 flex items-center justify-end"
              style={{ width: cols.length > 4 ? 52 : 60 }}
              title={rowCol}
            >
              {rowCol.length > 9 ? rowCol.slice(0, 8) + '…' : rowCol}
            </span>
            {cols.map((colCol) => {
              const v = matrix[rowCol]?.[colCol];
              const { bg, text } = corrColor(v);
              const isHovered = hover?.row === rowCol && hover?.col === colCol;
              const isSelf = rowCol === colCol;

              return (
                <div
                  key={colCol}
                  onMouseEnter={() => !isSelf && setHover({ row: rowCol, col: colCol, v })}
                  onMouseLeave={() => setHover(null)}
                  className={`flex-1 min-w-0 rounded flex items-center justify-center font-mono transition-all cursor-default select-none
                    ${isHovered ? 'ring-2 ring-white/50 scale-110 z-10 relative' : ''}
                    ${isSelf ? 'opacity-40' : ''}`}
                  style={{
                    background: isSelf ? 'rgba(148,170,255,0.15)' : bg,
                    color: isSelf ? '#94aaff' : text,
                    fontSize: 9,
                    aspectRatio: '1',
                    minHeight: 24,
                  }}
                >
                  {v !== null && v !== undefined && !isNaN(v) ? (isSelf ? '1' : v.toFixed(2)) : '—'}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-2 rounded-full"
          style={{
            background:
              'linear-gradient(to right, rgba(255,80,80,0.85), rgba(38,38,38,0.4) 50%, rgba(100,130,255,0.9))',
          }}
        />
        <div className="flex justify-between text-[9px] text-on-surface-variant w-16 font-medium">
          <span>-1</span>
          <span>0</span>
          <span>+1</span>
        </div>
      </div>

      {/* Tooltip */}
      {hover && hover.v !== null && hover.v !== undefined && !isNaN(hover.v) && (
        <div className="bg-surface-container-high rounded-lg p-3 border border-outline-variant/20 text-xs">
          <p className="font-semibold text-on-surface truncate">
            {hover.row} × {hover.col}
          </p>
          <p className="text-on-surface-variant mt-0.5">
            r = {Number(hover.v).toFixed(4)} · {getStrength(hover.v)}{' '}
            {hover.v > 0 ? 'positive' : hover.v < 0 ? 'negative' : ''}
          </p>
        </div>
      )}

      {/* Insights */}
      {insights && insights.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Key Findings</p>
          {insights.map((ins, i) => (
            <div
              key={i}
              className={`text-xs leading-relaxed p-2.5 rounded-lg ${
                ins.type === 'positive' ? 'bg-primary/5 border border-primary/10' : 'bg-error/5 border border-error/10'
              }`}
            >
              {ins.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}