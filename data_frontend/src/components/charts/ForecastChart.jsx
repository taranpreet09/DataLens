import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <div className="bg-[#18181b] border border-[#ffcc9433] rounded-xl shadow-2xl p-3 min-w-[180px] z-50">
      <div className="pb-2 border-b border-[#ffcc9422]">
        <p className="text-[10px] font-semibold text-[#ffcc94] uppercase tracking-wide">
          {entry.isForecast ? 'Forecast' : 'Historical'}
        </p>
        <p className="text-xs font-bold text-white mt-0.5">{entry.label || label}</p>
      </div>
      <div className="pt-2 space-y-1">
        {entry.actual != null && (
          <div className="flex justify-between gap-3">
            <span className="text-[10px] text-[#888]">Actual</span>
            <span className="text-xs font-bold text-[#94aaff] tabular-nums">
              {entry.actual.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
        {entry.forecast != null && (
          <div className="flex justify-between gap-3">
            <span className="text-[10px] text-[#888]">Forecast</span>
            <span className="text-xs font-bold text-[#ffcc94] tabular-nums">
              {entry.forecast.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
        {entry.upper != null && entry.lower != null && (
          <div className="flex justify-between gap-3">
            <span className="text-[10px] text-[#888]">95% CI</span>
            <span className="text-xs text-[#94ffc7] tabular-nums">
              [{entry.lower.toFixed(1)}, {entry.upper.toFixed(1)}]
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Forecast chart with confidence bands.
 * Props:
 *  - historicalData: array of { label, value }
 *  - forecastData: array of numbers (forecast values)
 *  - confidenceIntervals: array of { lower, upper }
 *  - fittedValues: array of numbers (fitted/smoothed values for historical period)
 *  - title: string
 *  - valueLabel: string
 */
export default function ForecastChart({
  historicalData = [],
  forecastData = [],
  confidenceIntervals = [],
  fittedValues = [],
  title = 'Forecast',
  valueLabel = 'Value',
}) {
  const chartData = useMemo(() => {
    const combined = [];

    // Historical points
    for (let i = 0; i < historicalData.length; i++) {
      const point = historicalData[i];
      combined.push({
        label: point.label || `${i + 1}`,
        actual: point.value,
        fitted: fittedValues[i] ?? null,
        forecast: null,
        upper: null,
        lower: null,
        isForecast: false,
      });
    }

    // Forecast points
    for (let i = 0; i < forecastData.length; i++) {
      const ci = confidenceIntervals[i];
      combined.push({
        label: `F+${i + 1}`,
        actual: null,
        fitted: null,
        forecast: forecastData[i],
        upper: ci?.upper ?? null,
        lower: ci?.lower ?? null,
        isForecast: true,
      });
    }

    return combined;
  }, [historicalData, forecastData, confidenceIntervals, fittedValues]);

  // Boundary index between historical and forecast
  const boundaryIndex = historicalData.length;

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No forecast data to visualize
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {title && (
        <h4 className="text-sm font-semibold text-white px-2">{title}</h4>
      )}
      <div className="w-full h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
            <defs>
              <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94ffc7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#94ffc7" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#767575', fontSize: 9 }}
              dy={10}
              interval="preserveStartEnd"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#767575', fontSize: 10 }}
              tickFormatter={(v) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(v)}
              label={{ value: valueLabel, angle: -90, position: 'insideLeft', offset: 10, fill: '#999', fontSize: 11 }}
            />
            <Tooltip content={<ForecastTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => <span className="text-xs text-gray-300">{value}</span>}
            />

            {/* Confidence band (Area between upper and lower) */}
            <Area
              dataKey="upper"
              stroke="none"
              fill="url(#confidenceBand)"
              fillOpacity={1}
              name="95% CI Upper"
              dot={false}
              activeDot={false}
              legendType="none"
            />
            <Area
              dataKey="lower"
              stroke="none"
              fill="#0e0e0e"
              fillOpacity={1}
              name="95% CI Lower"
              dot={false}
              activeDot={false}
              legendType="none"
            />

            {/* Historical actual line */}
            <Line
              dataKey="actual"
              stroke="#94aaff"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#94aaff' }}
              name="Actual"
              connectNulls={false}
            />

            {/* Fitted values line */}
            {fittedValues.length > 0 && (
              <Line
                dataKey="fitted"
                stroke="#c799ff"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                name="Fitted"
                connectNulls={false}
              />
            )}

            {/* Forecast line */}
            <Line
              dataKey="forecast"
              stroke="#ffcc94"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#ffcc94' }}
              activeDot={{ r: 5, fill: '#ffcc94' }}
              name="Forecast"
              connectNulls={false}
            />

            {/* Boundary reference line */}
            {boundaryIndex > 0 && boundaryIndex < chartData.length && (
              <ReferenceLine
                x={chartData[boundaryIndex - 1]?.label}
                stroke="#ffffff"
                strokeOpacity={0.3}
                strokeDasharray="5 5"
                label={{ value: 'Forecast →', position: 'top', fill: '#999', fontSize: 10 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
