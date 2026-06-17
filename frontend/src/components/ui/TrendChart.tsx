import React, { useMemo } from 'react';
import type { TrendForecastData } from '../../types';

interface TrendChartProps {
  data: TrendForecastData | null;
  loading?: boolean;
  selectedMetric: 'both' | 'settlement' | 'convergence';
  height?: number;
  threshold?: number;
}

interface ChartPoint {
  x: number;
  y: number;
  label: string;
  value: number;
}

const TrendChart: React.FC<TrendChartProps> = ({
  data,
  loading = false,
  selectedMetric = 'both',
  height = 220,
  threshold = 15,
}) => {
  const padding = { top: 20, right: 50, bottom: 40, left: 55 };
  const width = '100%';

  const chartData = useMemo(() => {
    if (!data) return null;

    const allDates = [...data.history_dates, ...data.forecast_dates];
    const nHistory = data.history_dates.length;
    const nTotal = allDates.length;

    let values: number[] = [];
    let lower: number[] = [];
    let upper: number[] = [];

    if (selectedMetric === 'settlement') {
      values = [...data.history_settlement, ...data.forecast_settlement];
      lower = [...data.history_settlement.map(v => v), ...data.settlement_lower];
      upper = [...data.history_settlement.map(v => v), ...data.settlement_upper];
    } else if (selectedMetric === 'convergence') {
      values = [...data.history_convergence, ...data.forecast_convergence];
      lower = [...data.history_convergence.map(v => v), ...data.convergence_lower];
      upper = [...data.history_convergence.map(v => v), ...data.convergence_upper];
    } else {
      const allVals = [
        ...data.history_settlement, ...data.forecast_settlement,
        ...data.history_convergence, ...data.forecast_convergence,
        ...data.settlement_lower, ...data.settlement_upper,
        ...data.convergence_lower, ...data.convergence_upper,
      ];
      values = allVals;
      lower = [...data.history_settlement.map(v => v), ...data.settlement_lower];
      upper = [...data.history_settlement.map(v => v), ...data.settlement_upper];
    }

    const allVals = [...values, ...lower, ...upper, threshold, -threshold];
    let yMin = Math.min(...allVals) * 1.15;
    let yMax = Math.max(...allVals) * 1.15;

    if (Math.abs(yMin) < 0.1) yMin = -5;
    if (Math.abs(yMax) < 0.1) yMax = 5;

    return {
      allDates,
      nHistory,
      nTotal,
      yMin,
      yMax,
      settlementHistory: data.history_settlement,
      settlementForecast: data.forecast_settlement,
      settlementLower: data.settlement_lower,
      settlementUpper: data.settlement_upper,
      convergenceHistory: data.history_convergence,
      convergenceForecast: data.forecast_convergence,
      convergenceLower: data.convergence_lower,
      convergenceUpper: data.convergence_upper,
    };
  }, [data, selectedMetric, threshold]);

  if (loading || !chartData) {
    return (
      <div className="flex items-center justify-center bg-slate-900/50 rounded-lg" style={{ height }}>
        <div className="text-slate-400 text-sm">
          {loading ? '加载中...' : '暂无数据'}
        </div>
      </div>
    );
  }

  const { allDates, nHistory, nTotal, yMin, yMax } = chartData;

  const getX = (i: number, chartW: number) => {
    const plotW = chartW - padding.left - padding.right;
    return padding.left + (i / (nTotal - 1)) * plotW;
  };

  const getY = (value: number, chartH: number) => {
    const plotH = chartH - padding.top - padding.bottom;
    return padding.top + plotH - ((value - yMin) / (yMax - yMin)) * plotH;
  };

  const generatePath = (values: number[], startIdx: number, count: number, chartW: number, chartH: number) => {
    let path = '';
    for (let i = 0; i < count; i++) {
      const x = getX(startIdx + i, chartW);
      const y = getY(values[i], chartH);
      path += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    return path;
  };

  const generateAreaPath = (
    upperVals: number[],
    lowerVals: number[],
    startIdx: number,
    count: number,
    chartW: number,
    chartH: number
  ) => {
    let path = '';
    for (let i = 0; i < count; i++) {
      const x = getX(startIdx + i, chartW);
      const y = getY(upperVals[i], chartH);
      path += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    for (let i = count - 1; i >= 0; i--) {
      const x = getX(startIdx + i, chartW);
      const y = getY(lowerVals[i], chartH);
      path += 'L' + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    path += 'Z';
    return path;
  };

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const range = yMax - yMin;
    const step = range / 5;
    for (let i = 0; i <= 5; i++) {
      ticks.push(yMin + i * step);
    }
    return ticks;
  }, [yMin, yMax]);

  const showSettlement = selectedMetric === 'both' || selectedMetric === 'settlement';
  const showConvergence = selectedMetric === 'both' || selectedMetric === 'convergence';

  return (
    <div className="w-full relative" style={{ height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 400 ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="settlementGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="convergenceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={`ytick-${i}`}>
            <line
              x1={padding.left}
              y1={getY(tick, height)}
              x2={400 - padding.right}
              y2={getY(tick, height)}
              stroke="#1e293b"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={getY(tick, height) + 4}
              fill="#64748b"
              fontSize="10"
              textAnchor="end"
            >
              {tick.toFixed(1)}
            </text>
          </g>
        ))}

        <line
          x1={padding.left}
          y1={getY(0, height)}
          x2={400 - padding.right}
          y2={getY(0, height)}
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="2 3"
        />

        <line
          x1={padding.left}
          y1={getY(threshold, height)}
          x2={400 - padding.right}
          y2={getY(threshold, height)}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="6 4"
          opacity="0.6"
        />
        <text
          x={400 - padding.right + 4}
          y={getY(threshold, height) + 3}
          fill="#ef4444"
          fontSize="9"
          opacity="0.8"
        >
          {threshold}mm
        </text>

        <line
          x1={padding.left}
          y1={getY(-threshold, height)}
          x2={400 - padding.right}
          y2={getY(-threshold, height)}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="6 4"
          opacity="0.6"
        />
        <text
          x={400 - padding.right + 4}
          y={getY(-threshold, height) + 3}
          fill="#ef4444"
          fontSize="9"
          opacity="0.8"
        >
          -{threshold}mm
        </text>

        <line
          x1={getX(nHistory - 1, 400)}
          y1={padding.top}
          x2={getX(nHistory - 1, 400)}
          y2={height - padding.bottom}
          stroke="#6366f1"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.5"
        />
        <text
          x={getX(nHistory - 1, 400)}
          y={padding.top - 4}
          fill="#6366f1"
          fontSize="9"
          textAnchor="middle"
          opacity="0.8"
        >
          当前
        </text>

        {showSettlement && (
          <>
            {data && chartData.settlementLower.length > 0 && (
              <path
                d={generateAreaPath(
                  chartData.settlementUpper,
                  chartData.settlementLower,
                  nHistory - 1,
                  chartData.settlementUpper.length + 1,
                  400,
                  height
                )}
                fill="url(#settlementGradient)"
                opacity="0.6"
              />
            )}

            <path
              d={generatePath(chartData.settlementHistory, 0, nHistory, 400, height)}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
              filter="url(#glow)"
            />

            <path
              d={generatePath(
                [chartData.settlementHistory[nHistory - 1], ...chartData.settlementForecast],
                nHistory - 1,
                chartData.settlementForecast.length + 1,
                400,
                height
              )}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
              strokeDasharray="6 4"
              opacity="0.85"
            />

            {chartData.settlementHistory.map((val, i) => (
              <circle
                key={`sh-${i}`}
                cx={getX(i, 400)}
                cy={getY(val, height)}
                r="3.5"
                fill="#06b6d4"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            ))}

            {chartData.settlementForecast.map((val, i) => (
              <circle
                key={`sf-${i}`}
                cx={getX(nHistory + i, 400)}
                cy={getY(val, height)}
                r="3"
                fill="#06b6d4"
                fillOpacity="0.6"
                stroke="#06b6d4"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
            ))}
          </>
        )}

        {showConvergence && (
          <>
            {data && chartData.convergenceLower.length > 0 && (
              <path
                d={generateAreaPath(
                  chartData.convergenceUpper,
                  chartData.convergenceLower,
                  nHistory - 1,
                  chartData.convergenceUpper.length + 1,
                  400,
                  height
                )}
                fill="url(#convergenceGradient)"
                opacity="0.5"
              />
            )}

            <path
              d={generatePath(chartData.convergenceHistory, 0, nHistory, 400, height)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              filter="url(#glow)"
            />

            <path
              d={generatePath(
                [chartData.convergenceHistory[nHistory - 1], ...chartData.convergenceForecast],
                nHistory - 1,
                chartData.convergenceForecast.length + 1,
                400,
                height
              )}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="6 4"
              opacity="0.85"
            />

            {chartData.convergenceHistory.map((val, i) => (
              <circle
                key={`ch-${i}`}
                cx={getX(i, 400)}
                cy={getY(val, height)}
                r="3.5"
                fill="#f59e0b"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            ))}

            {chartData.convergenceForecast.map((val, i) => (
              <circle
                key={`cf-${i}`}
                cx={getX(nHistory + i, 400)}
                cy={getY(val, height)}
                r="3"
                fill="#f59e0b"
                fillOpacity="0.6"
                stroke="#f59e0b"
                strokeWidth="1.5"
              />
            ))}
          </>
        )}

        {allDates.map((date, i) => {
          const showLabel = i === 0 || i === nHistory - 1 || i === nTotal - 1 || i % Math.ceil(nTotal / 4) === 0;
          if (!showLabel) return null;
          return (
            <g key={`xlabel-${i}`}>
              <text
                x={getX(i, 400)}
                y={height - padding.bottom + 18}
                fill="#64748b"
                fontSize="9"
                textAnchor="middle"
              >
                {date.slice(5)}
              </text>
            </g>
          );
        })}

        <text
          x={padding.left - 40}
          y={height / 2}
          fill="#64748b"
          fontSize="10"
          textAnchor="middle"
          transform={`rotate(-90, ${padding.left - 40}, ${height / 2})`}
        >
          形变量 (mm)
        </text>
      </svg>
    </div>
  );
};

export default TrendChart;
