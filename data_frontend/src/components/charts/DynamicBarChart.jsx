import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  YAxis,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-[#c799ff44] p-3 rounded-lg shadow-2xl min-w-[120px]">
        <p className="text-[#adaaaa] text-[10px] font-bold mb-1 truncate max-w-[200px]">{label}</p>
        <p className="text-on-surface text-xs font-bold font-inter">
          Count: <span className="text-[#c799ff] ml-1">{payload[0].value.toLocaleString()}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function DynamicBarChart({ data, xAxisKey = "range", barKey = "count", color = "#c799ff" }) {
  if (!data || !data.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] w-full gap-3 opacity-40">
        <span className="material-symbols-outlined text-3xl">bar_chart</span>
        <p className="text-xs text-on-surface-variant font-medium text-center">No data to visualize</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
          <XAxis
            dataKey={xAxisKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#767575', fontSize: 9, fontFamily: 'Inter' }}
            dy={10}
            tickFormatter={(val) => {
              if (typeof val === 'string' && val.includes(' – ')) return val.split(' – ')[0];
              if (typeof val === 'string' && val.length > 12) return val.slice(0, 10) + '…';
              return val;
            }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }}
            tickFormatter={(value) =>
              new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value)
            }
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: `${color}18` }} />
          <Bar dataKey={barKey} radius={[4, 4, 0, 0]} animationDuration={800} isAnimationActive={true}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={color} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}