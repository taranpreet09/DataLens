import { useState } from 'react';

function corrColor(v) {
  if (v === null || v === undefined) return { bg: 'rgba(38,38,38,0.3)', text: '#767575' };
  const abs = Math.abs(v);
  if (v > 0) {
    // Purple scale for positive
    const r = Math.round(148 - 50 * abs);
    const g = Math.round(170 - 130 * abs);
    const b = 255;
    return { bg: `rgba(${r},${g},${b},${0.1 + abs * 0.7})`, text: abs > 0.5 ? '#fff' : '#94aaff' };
  } else {
    // Red scale for negative
    const r = 255;
    const g = Math.round(170 - 170 * abs);
    const b = Math.round(170 - 130 * abs);
    return { bg: `rgba(${r},${g},${b},${0.1 + abs * 0.7})`, text: abs > 0.5 ? '#fff' : '#ff9494' };
  }
}

function getStrength(r) {
  const a = Math.abs(r);
  if (a >= 0.9) return 'Very strong';
  if (a >= 0.7) return 'Strong';
  if (a >= 0.5) return 'Moderate';
  if (a >= 0.3) return 'Weak';
  return 'Negligible';
}

export default function CorrelationHeatmap({ matrix, columns, insights = [] }) {
  const [hover, setHover] = useState(null);
  const cols = columns.slice(0, 8); // Limit for visual clarity

  if (cols.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40 py-12">
        <span className="material-symbols-outlined text-3xl">grid_view</span>
        <p className="text-xs text-on-surface-variant">Need ≥ 2 numeric columns for correlation</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Matrix */}
      <div className="overflow-auto">
        {/* Header row */}
        <div className="flex gap-1 mb-1" style={{ paddingLeft: '72px' }}>
          {cols.map(c => (
            <div key={c} className="flex-1 text-[9px] text-on-surface-variant text-center truncate font-medium min-w-[42px]">{c.length > 8 ? c.slice(0, 7) + '…' : c}</div>
          ))}
        </div>
        {/* Rows */}
        {cols.map(rowCol => (
          <div key={rowCol} className="flex gap-1 mb-1 items-center">
            <span className="text-[9px] text-on-surface-variant w-[68px] text-right shrink-0 truncate font-medium pr-1">{rowCol.length > 10 ? rowCol.slice(0, 9) + '…' : rowCol}</span>
            {cols.map(colCol => {
              const v = matrix[rowCol]?.[colCol];
              const { bg, text } = corrColor(v);
              const isHovered = hover?.row === rowCol && hover?.col === colCol;
              return (
                <div
                  key={colCol}
                  onMouseEnter={() => setHover({ row: rowCol, col: colCol, v })}
                  onMouseLeave={() => setHover(null)}
                  className={`flex-1 aspect-square rounded-sm flex items-center justify-center text-[10px] font-mono transition-all cursor-default min-w-[42px] ${isHovered ? 'ring-2 ring-white/40 scale-110 z-10' : ''}`}
                  style={{ background: bg, color: text }}
                >
                  {v !== null && v !== undefined ? v.toFixed(2) : '—'}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 rounded-full" style={{ background: 'linear-gradient(to right, rgba(255,100,100,0.8), rgba(38,38,38,0.3) 50%, rgba(148,170,255,0.9))' }}></div>
        <div className="flex justify-between text-[9px] text-on-surface-variant w-20 font-medium">
          <span>-1</span><span>0</span><span>+1</span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hover && hover.v !== null && hover.v !== undefined && (
        <div className="bg-surface-container-high rounded-lg p-3 border border-outline-variant/20 text-xs">
          <p className="font-semibold text-on-surface">{hover.row} × {hover.col}</p>
          <p className="text-on-surface-variant">r = {hover.v.toFixed(4)} · {getStrength(hover.v)} {hover.v > 0 ? 'positive' : hover.v < 0 ? 'negative' : ''}</p>
        </div>
      )}

      {/* Correlation insights */}
      {insights.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Key Findings</p>
          {insights.map((ins, i) => (
            <div key={i} className={`text-xs leading-relaxed p-3 rounded-lg ${ins.type === 'positive' ? 'bg-primary/5 text-on-surface' : 'bg-error/5 text-on-surface'}`}>
              {ins.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
