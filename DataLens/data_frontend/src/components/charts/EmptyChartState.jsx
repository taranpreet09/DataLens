export default function EmptyChartState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[250px] w-full gap-3 opacity-40">
      <span className="material-symbols-outlined text-3xl">bar_chart</span>
      <p className="text-xs text-on-surface-variant font-medium text-center max-w-xs">{label}</p>
    </div>
  );
}
