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
import EmptyChartState from './EmptyChartState';

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
  if (!data || !data.length) return <EmptyChartState label="No data to visualize" />;

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
          <XAxis 
            dataKey={xAxisKey} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#767575', fontSize: 9, fontFamily: 'Inter' }}
            dy={10}
            tickFormatter={(val) => val.split(' – ')[0]} // Simplify range strings
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }} 
            tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: `${color}11` }} />
          <Bar 
            dataKey={barKey} 
            radius={[4, 4, 0, 0]}
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={color} fillOpacity={0.8} className="hover:opacity-100 transition-opacity" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
