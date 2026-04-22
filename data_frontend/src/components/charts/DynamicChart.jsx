import {
  ResponsiveContainer,
  BarChart, Bar,
  PieChart, Pie, Cell,
  AreaChart, Area,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import EmptyChartState from './EmptyChartState';

const COLORS = [
  '#94aaff', '#c799ff', '#ff9494', '#94ffc7', '#ffcc94', '#94d4ff',
  '#ff94d4', '#e2ff94', '#94ffd4', '#d494ff', '#ff9494', '#94fff5'
];

const CustomTooltip = ({ active, payload, label, graphType }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const value = payload[0].value;
    const name = payload[0].name || label || data.label || data.range || data.value;
    
    return (
      <div className="bg-[#1a1a1a] border border-[#c799ff44] p-3 rounded-lg shadow-2xl min-w-[120px] z-50">
        <p className="text-[#adaaaa] text-[10px] font-bold mb-1 truncate max-w-[200px]">{name}</p>
        <p className="text-on-surface text-xs font-bold font-inter">
          Value: <span className="text-[#c799ff] ml-1">{value?.toLocaleString()}</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }) => {
  return (
    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pl-4 pr-2 pb-4 scrollbar-thin scrollbar-thumb-surface-container-highest" style={{ pointerEvents: 'auto' }}>
      {payload.map((entry, index) => (
        <div key={`item-${index}`} className="flex items-center gap-2 text-xs">
          <span className="w-3 h-3 rounded-sm shrink-0 shadow-sm" style={{ backgroundColor: entry.color }}></span>
          <span className="truncate text-on-surface font-medium flex-1 max-w-[120px]" title={entry.value}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function DynamicChart({ data, graphType = 'bar', xAxisKey = 'label', yAxisKey = 'sum' }) {
  if (!data || !data.length) return <EmptyChartState label="No data to visualize" />;

  const chartMargin = { top: 20, right: 30, left: -10, bottom: 20 };

  const renderChart = () => {
    switch (graphType) {
      case 'pie': {
        const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
          const RADIAN = Math.PI / 180;
          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
          const x = cx + radius * Math.cos(-midAngle * RADIAN);
          const y = cy + radius * Math.sin(-midAngle * RADIAN);
          if (percent < 0.05) return null; // Hide label for tiny slices
          return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" className="drop-shadow-md">
              {`${(percent * 100).toFixed(0)}%`}
            </text>
          );
        };

        return (
          <PieChart>
            <Pie
              data={data}
              cx="45%"
              cy="50%"
              innerRadius={0}
              outerRadius="80%"
              dataKey={yAxisKey}
              nameKey={xAxisKey}
              stroke="#1e1e24"
              strokeWidth={2}
              labelLine={false}
              label={renderCustomizedLabel}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity cursor-pointer" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip graphType="pie" />} />
            <Legend content={<CustomLegend />} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ pointerEvents: 'auto' }} />
          </PieChart>
        );
      }

      case 'area':
        return (
          <AreaChart data={data} margin={chartMargin}>
            <defs>
              <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94aaff" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#94aaff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
            <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }} dy={10} tickFormatter={(val) => String(val).split(' – ')[0]} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }} tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value)} />
            <Tooltip content={<CustomTooltip graphType="area" />} cursor={{ stroke: '#94aaff', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey={yAxisKey} stroke="#94aaff" strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" />
          </AreaChart>
        );

      case 'dotted':
      case 'scatter':
        return (
          <ScatterChart margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} />
            <XAxis dataKey={xAxisKey} type="category" axisLine={false} tickLine={false} tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }} dy={10} tickFormatter={(val) => String(val).split(' – ')[0]} />
            <YAxis dataKey={yAxisKey} type="number" axisLine={false} tickLine={false} tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }} tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value)} />
            <ZAxis range={[50, 400]} />
            <Tooltip content={<CustomTooltip graphType="scatter" />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Data" data={data} fill="#ffcc94">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Scatter>
          </ScatterChart>
        );

      case 'histogram':
      case 'bar':
      default:
        return (
          <BarChart data={data} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
            <XAxis 
              dataKey={xAxisKey} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#767575', fontSize: 9, fontFamily: 'Inter' }}
              dy={10}
              tickFormatter={(val) => String(val).split(' – ')[0]}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Inter' }} 
              tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value)}
            />
            <Tooltip content={<CustomTooltip graphType="bar" />} cursor={{ fill: `#c799ff11` }} />
            <Bar 
              dataKey={yAxisKey} 
              radius={[4, 4, 0, 0]}
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={graphType === 'histogram' ? '#94d4ff' : COLORS[index % COLORS.length]} fillOpacity={0.8} className="hover:opacity-100 transition-opacity" />
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
