export default function QualityBadge({ score }) {
  const color = score >= 80 ? 'text-secondary' : score >= 50 ? 'text-amber-400' : 'text-error';
  const bg = score >= 80 ? 'bg-secondary/10 border-secondary/20' : score >= 50 ? 'bg-amber-400/10 border-amber-400/20' : 'bg-error/10 border-error/20';
  const label = score >= 80 ? 'Excellent' : score >= 50 ? 'Moderate' : 'Poor';

  return (
    <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border ${bg}`}>
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-surface-container-highest" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3"
            strokeDasharray={`${(score / 100) * 97.4} 97.4`}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${color}`}>{score}</span>
      </div>
      <div>
        <p className={`text-sm font-bold ${color}`}>{label}</p>
        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium">Quality</p>
      </div>
    </div>
  );
}
