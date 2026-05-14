import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

const CLUSTER_COLORS = [
  '#94aaff', '#c799ff', '#ff9494', '#94ffc7', '#ffcc94',
  '#94d4ff', '#ff94d4', '#e2ff94', '#94ffd4', '#d494ff',
  '#ffa894', '#94fff5', '#ffb3e6', '#b3ffb3', '#ffdb99',
];

function ClusterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-[#18181b] border border-[#c799ff33] rounded-xl shadow-2xl p-3 min-w-[160px] max-w-[260px] z-50">
      <div className="px-1 pb-2 border-b border-[#c799ff22]">
        <span className="text-[10px] font-semibold text-[#c799ff] uppercase tracking-wide">
          Cluster {point.cluster}
        </span>
      </div>
      <div className="pt-2 space-y-1">
        <div className="flex justify-between gap-3">
          <span className="text-[10px] text-[#888]">{point.xLabel || 'X'}</span>
          <span className="text-xs font-bold text-[#94aaff] tabular-nums">
            {typeof point.x === 'number' ? point.x.toFixed(3) : point.x}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[10px] text-[#888]">{point.yLabel || 'Y'}</span>
          <span className="text-xs font-bold text-[#94aaff] tabular-nums">
            {typeof point.y === 'number' ? point.y.toFixed(3) : point.y}
          </span>
        </div>
        {point.rowIndex !== undefined && (
          <div className="flex justify-between gap-3">
            <span className="text-[10px] text-[#888]">Row</span>
            <span className="text-xs text-white tabular-nums">{point.rowIndex}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Interactive clustering scatter plot with group coloring.
 * Props:
 *  - data: array of { x, y, cluster, rowIndex?, xLabel?, yLabel? }
 *  - clusterStats: object { [clusterId]: { size, centroid } }
 *  - xLabel: string
 *  - yLabel: string
 *  - showCentroids: boolean
 */
export default function ClusterScatterPlot({
  data,
  clusterStats,
  xLabel = 'Component 1',
  yLabel = 'Component 2',
  showCentroids = true,
}) {
  const [hiddenClusters, setHiddenClusters] = useState(new Set());

  const { clusterGroups, clusterIds } = useMemo(() => {
    if (!data?.length) return { clusterGroups: {}, clusterIds: [] };

    const groups = {};
    for (const point of data) {
      const cid = point.cluster ?? 0;
      if (!groups[cid]) groups[cid] = [];
      groups[cid].push({ ...point, xLabel, yLabel });
    }
    return { clusterGroups: groups, clusterIds: Object.keys(groups).sort((a, b) => a - b) };
  }, [data, xLabel, yLabel]);

  const centroidData = useMemo(() => {
    if (!showCentroids || !clusterStats) return [];
    return Object.entries(clusterStats).map(([id, stat]) => ({
      x: stat.centroid?.[0],
      y: stat.centroid?.[1],
      cluster: id,
      isCentroid: true,
      xLabel,
      yLabel,
    })).filter(c => c.x != null && c.y != null);
  }, [clusterStats, showCentroids, xLabel, yLabel]);

  const toggleCluster = (clusterId) => {
    setHiddenClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
      return next;
    });
  };

  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No cluster data to visualize
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Legend with toggle */}
      <div className="flex flex-wrap gap-2 px-2">
        {clusterIds.map(cid => {
          const color = CLUSTER_COLORS[cid % CLUSTER_COLORS.length];
          const hidden = hiddenClusters.has(cid);
          const size = clusterStats?.[cid]?.size || clusterGroups[cid]?.length || 0;
          return (
            <button
              key={cid}
              onClick={() => toggleCluster(cid)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                hidden
                  ? 'border-white/10 text-gray-500 opacity-50'
                  : 'border-white/20 text-white'
              }`}
              style={{ backgroundColor: hidden ? 'transparent' : `${color}22` }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: hidden ? '#555' : color }}
              />
              Cluster {cid} ({size})
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} />
            <XAxis
              dataKey="x"
              type="number"
              name={xLabel}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#767575', fontSize: 10 }}
              label={{ value: xLabel, position: 'bottom', offset: 10, fill: '#999', fontSize: 11 }}
            />
            <YAxis
              dataKey="y"
              type="number"
              name={yLabel}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#767575', fontSize: 10 }}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fill: '#999', fontSize: 11 }}
            />
            <ZAxis range={[30, 60]} />
            <Tooltip content={<ClusterTooltip />} />

            {/* Render each cluster as a separate Scatter */}
            {clusterIds.map(cid => {
              if (hiddenClusters.has(cid)) return null;
              const color = CLUSTER_COLORS[cid % CLUSTER_COLORS.length];
              return (
                <Scatter
                  key={`cluster-${cid}`}
                  name={`Cluster ${cid}`}
                  data={clusterGroups[cid]}
                  fill={color}
                  fillOpacity={0.7}
                />
              );
            })}

            {/* Centroids */}
            {showCentroids && centroidData.length > 0 && (
              <Scatter
                name="Centroids"
                data={centroidData.filter(c => !hiddenClusters.has(c.cluster))}
                shape="diamond"
                fill="#ffffff"
                strokeWidth={2}
              >
                {centroidData
                  .filter(c => !hiddenClusters.has(c.cluster))
                  .map((c, i) => (
                    <Cell
                      key={i}
                      fill="#ffffff"
                      stroke={CLUSTER_COLORS[c.cluster % CLUSTER_COLORS.length]}
                      strokeWidth={3}
                    />
                  ))}
              </Scatter>
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
