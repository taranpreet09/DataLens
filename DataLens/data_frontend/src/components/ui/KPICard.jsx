export default function KPICard({ label, value, sub, color, trend }) {
  return (
    <div className={`bg-surface-container-low p-4 sm:p-6 rounded-xl relative overflow-hidden group`}>
      <div className={`absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-${color}/5 rounded-full -mr-12 -mt-12 sm:-mr-16 sm:-mt-16 transition-transform group-hover:scale-110 duration-500`}></div>
      <div className="flex justify-between items-start mb-2 sm:mb-4">
        <span className="text-on-surface-variant font-medium text-[10px] sm:text-xs tracking-wider uppercase truncate pr-2">{label}</span>
        {trend && (
          <span className={`flex items-center text-${color} text-xs font-bold shrink-0`}>
            <span className="material-symbols-outlined text-sm">trending_up</span>
          </span>
        )}
      </div>
      <div className="text-xl sm:text-2xl lg:text-3xl font-headline font-extrabold tracking-tight mb-1 truncate">{value}</div>
      <div className="text-on-surface-variant text-[10px] sm:text-xs truncate">{sub}</div>
    </div>
  );
}
