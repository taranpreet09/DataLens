import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from 'recharts';
import EmptyChartState from './EmptyChartState';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const val = payload[0]?.value;
    const trend = payload.find(p => p.dataKey === 'trend')?.value;
    const formatted = typeof val === 'number' && val > 10000
      ? val.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : val?.toLocaleString();

    return (
      <div className="bg-[#1a1a1a] border border-[#94aaff44] p-3 rounded-lg shadow-2xl min-w-[140px]">
        <p className="text-[#adaaaa] text-[10px] uppercase font-bold tracking-widest mb-1">{label}</p>
        <p className="text-[#94aaff] text-sm font-bold font-inter">{formatted}</p>
        {trend !== undefined && trend !== null && (
          <p className="text-on-surface-variant text-[10px] mt-1">Trend: {trend.toLocaleString()}</p>
        )}
      </div>
    );
  }
  return null;
};

export default function DynamicTimeSeries({ data, trendLine, peak, trough, trendDirection }) {
  if (!data || data.length < 2) return <EmptyChartState label="No date column detected for time series" />;

  // Merge trend line data into series
  const merged = data.map((d, i) => ({
    ...d,
    trend: trendLine?.[i]?.value ?? null,
  }));

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={merged} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" strokeOpacity={0.05} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }}
            dy={10}
            minTickGap={60}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }}
            tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94aaff', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey="value"
            fill="url(#ts-area-grad)"
            stroke="none"
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#94aaff"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, stroke: '#1a1a1a', strokeWidth: 2, fill: '#94aaff' }}
            animationDuration={800}
          />
          {trendLine && (
            <Line
              type="monotone"
              dataKey="trend"
              stroke="#c799ff"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
              activeDot={false}
              animationDuration={600}
            />
          )}
          {peak && (
            <ReferenceDot
              x={peak.date}
              y={peak.value}
              r={7}
              fill="#94aaff"
              stroke="#1a1a1a"
              strokeWidth={2}
            />
          )}
          {trough && (
            <ReferenceDot
              x={trough.date}
              y={trough.value}
              r={7}
              fill="#ff9494"
              stroke="#1a1a1a"
              strokeWidth={2}
            />
          )}
          <defs>
            <linearGradient id="ts-area-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#94aaff" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#94aaff" stopOpacity={0} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      {(trendDirection || peak || trough) && (
        <div className="flex items-center gap-4 mt-4 pt-2 border-t border-outline-variant/10 text-[10px] text-on-surface-variant font-medium">
          {trendDirection && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-primary">
                {trendDirection === 'Upward trend' ? 'trending_up' : trendDirection === 'Downward trend' ? 'trending_down' : 'trending_flat'}
              </span>
              {trendDirection}
            </span>
          )}
          {peak && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#94aaff]"></span>
              Peak: {peak.date}
            </span>
          )}
          {trough && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#ff9494]"></span>
              Trough: {trough.date}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
