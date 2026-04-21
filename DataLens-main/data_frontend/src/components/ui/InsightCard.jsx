const categoryIcons = {
  overview: 'dataset',
  numeric: 'monitoring',
  correlation: 'trending_up',
  timeseries: 'event',
  category: 'category',
  outlier: 'error_outline',
  quality: 'flag',
};

const categoryColors = {
  overview: 'text-primary',
  numeric: 'text-secondary',
  correlation: 'text-tertiary',
  timeseries: 'text-primary',
  category: 'text-amber-400',
  outlier: 'text-error',
  quality: 'text-amber-400',
};

export default function InsightCard({ insight }) {
  const icon = categoryIcons[insight.category] || 'lightbulb';
  const color = categoryColors[insight.category] || 'text-primary';

  return (
    <div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/10 hover:bg-surface-container transition-colors group">
      <div className="flex gap-3">
        <div className={`w-9 h-9 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 ${color} group-hover:scale-110 transition-transform`}>
          <span className="material-symbols-outlined text-lg">{icon}</span>
        </div>
        <p className="text-sm text-on-surface leading-relaxed">{insight.text}</p>
      </div>
    </div>
  );
}
