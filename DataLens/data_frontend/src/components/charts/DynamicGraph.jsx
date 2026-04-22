import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
} from 'recharts';
import EmptyChartState from './EmptyChartState';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-[#c799ff44] p-3 rounded-lg shadow-2xl min-w-[120px]">
        <p className="text-[#adaaaa] text-[10px] font-bold mb-1 truncate max-w-[200px]">{label}</p>
        <p className="text-on-surface text-xs font-bold font-inter">
          Value: <span className="text-[#c799ff] ml-1">{payload[0].value.toLocaleString()}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function DynamicGraph({ data, type = "bar", xAxisKey = "range", barKey = "count", color = "#c799ff" }) {
  if (!data || !data.length) return <EmptyChartState label="No data to visualize" />;

  const PIE_COLORS = ['#c799ff', '#94aaff', '#94d4ff', '#94ffea', '#baff94', '#fff994', '#ffb494', '#ff94c7', '#d494ff', '#ff9494'];

  if (type === 'pie') {
    return (
      <div className="w-full h-full min-h-[300px] flex flex-col md:flex-row items-center justify-center gap-6">
        <div className="w-full md:w-1/2 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <Tooltip content={<CustomTooltip />} />
              <Pie data={data} dataKey={barKey} nameKey={xAxisKey} cx="50%" cy="50%" innerRadius={0} outerRadius={120} paddingAngle={2} animationDuration={800}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} className="hover:opacity-80 transition-opacity cursor-pointer" stroke="rgba(255,255,255,0.05)" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full md:w-1/2 max-h-[250px] md:max-h-[300px] overflow-y-auto pr-2">
          <div className="flex flex-col gap-2">
            {data.map((entry, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/10 text-xs hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                  <span className="text-on-surface font-medium truncate" title={String(entry[xAxisKey])}>{String(entry[xAxisKey])}</span>
                </div>
                <span className="text-on-surface-variant font-mono font-bold ml-4 flex-shrink-0">{entry[barKey].toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const renderChart = () => {
    switch (type) {
      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
            <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fill: '#767575', fontSize: 9, fontFamily: 'Inter' }} dy={10} tickFormatter={(val) => String(val).split(' – ')[0]} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }} tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value)} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey={barKey} stroke={color} fill={color} fillOpacity={0.3} animationDuration={800} />
          </AreaChart>
        );
      case 'scatter':
        return (
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
            <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fill: '#767575', fontSize: 9, fontFamily: 'Inter' }} dy={10} tickFormatter={(val) => String(val).split(' – ')[0]} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }} tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value)} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey={barKey} stroke="none" dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} animationDuration={800} />
          </LineChart>
        );

      case 'histogram':
      case 'bar':
      default:
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap={type === 'histogram' ? 0 : '10%'}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
            <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fill: '#767575', fontSize: 9, fontFamily: 'Inter' }} dy={10} tickFormatter={(val) => String(val).split(' – ')[0]} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }} tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value)} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: `${color}11` }} />
            <Bar dataKey={barKey} radius={type === 'histogram' ? [0, 0, 0, 0] : [4, 4, 0, 0]} animationDuration={800}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={color} fillOpacity={0.8} className="hover:opacity-100 transition-opacity" />
              ))}
            </Bar>
          </BarChart>
        );
    }
  };

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
