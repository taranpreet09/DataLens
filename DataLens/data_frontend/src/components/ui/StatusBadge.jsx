export default function StatusBadge({ status }) {
  if (status === 'ready')
    return (
      <span className="flex items-center gap-1.5 text-secondary text-xs font-semibold">
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        Indexed
      </span>
    );
  if (status === 'processing')
    return (
      <span className="flex items-center gap-2 text-tertiary text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_#c799ff]"></span>
        Analyzing...
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-error text-xs font-semibold">
      <span className="material-symbols-outlined text-sm">error</span>
      Failed
    </span>
  );
}
