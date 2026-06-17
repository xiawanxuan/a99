import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, Download, RefreshCw } from 'lucide-react';
import type { DeformationMeasurement, AlertData, EllipseParams, DeviationStats } from '../../types';
import { CrossSectionView } from '../three/CrossSectionView';
import { DataCard, DataCardsGrid } from './DataCards';
import { ColorLegend } from './ColorLegend';
import { cn } from '../../lib/utils';

interface AnalysisPanelProps {
  sectionPoints: { x: number; y: number }[];
  ellipseParams: EllipseParams | null;
  baselineEllipse: EllipseParams | null;
  deviations: number[];
  deviationStats: DeviationStats | null;
  measurement: DeformationMeasurement | null;
  alerts: AlertData[];
  deviationRange: [number, number];
  onRefresh: () => void;
  onExport?: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
  className?: string;
}

export function AnalysisPanel({
  sectionPoints,
  ellipseParams,
  baselineEllipse,
  deviations,
  deviationStats,
  measurement,
  alerts,
  deviationRange,
  onRefresh,
  onExport,
  onAcknowledgeAlert,
  className,
}: AnalysisPanelProps) {
  const chartData = deviationStats?.histogram?.map((value, index) => {
    const range = deviationRange[1] - deviationRange[0];
    const binWidth = range / 10;
    const binStart = deviationRange[0] + index * binWidth;
    return {
      name: `${binStart.toFixed(0)}`,
      value: value * 100,
    };
  });

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <div
      className={cn(
        'w-80 bg-slate-900/90 backdrop-blur-xl border-l border-cyan-500/30 h-full overflow-y-auto',
        className
      )}
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <Activity className="text-cyan-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-mono">分析面板</h2>
              <p className="text-xs text-gray-400 font-mono">截面形变分析</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRefresh}
              className="p-2 bg-slate-800 hover:bg-cyan-500/20 rounded-lg transition-colors text-cyan-400"
              title="刷新分析"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onExport}
              className="p-2 bg-slate-800 hover:bg-cyan-500/20 rounded-lg transition-colors text-cyan-400"
              title="导出数据"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <CrossSectionView
            points={sectionPoints}
            ellipseParams={ellipseParams}
            baselineEllipse={baselineEllipse}
            deviations={deviations}
            deviationRange={deviationRange}
          />
        </div>

        <div className="flex justify-center">
          <ColorLegend range={deviationRange} vertical={false} />
        </div>

        <div className="border-t border-cyan-500/20 pt-4">
          <h3 className="text-sm font-medium text-cyan-400 font-mono mb-3">
            形变参数
          </h3>
          <DataCardsGrid columns={2}>
            <DataCard
              label="收敛值"
              value={measurement?.convergence.toFixed(2) || '0.00'}
              unit="mm"
              status={
                measurement && Math.abs(measurement.convergence) > 15
                  ? 'danger'
                  : measurement && Math.abs(measurement.convergence) > 10
                  ? 'warning'
                  : 'normal'
              }
            />
            <DataCard
              label="沉降值"
              value={measurement?.settlement.toFixed(2) || '0.00'}
              unit="mm"
              status={
                measurement && Math.abs(measurement.settlement) > 15
                  ? 'danger'
                  : measurement && Math.abs(measurement.settlement) > 10
                  ? 'warning'
                  : 'normal'
              }
            />
            <DataCard
              label="最大偏差"
              value={measurement?.max_deviation.toFixed(2) || '0.00'}
              unit="mm"
              status={
                measurement && measurement.max_deviation > 15
                  ? 'danger'
                  : measurement && measurement.max_deviation > 10
                  ? 'warning'
                  : 'normal'
              }
            />
            <DataCard
              label="平均偏差"
              value={measurement?.avg_deviation.toFixed(2) || '0.00'}
              unit="mm"
            />
          </DataCardsGrid>
        </div>

        {ellipseParams && (
          <div className="border-t border-cyan-500/20 pt-4">
            <h3 className="text-sm font-medium text-cyan-400 font-mono mb-3">
              椭圆参数
            </h3>
            <DataCardsGrid columns={2}>
              <DataCard label="中心X" value={ellipseParams.cx.toFixed(4)} unit="m" />
              <DataCard label="中心Y" value={ellipseParams.cy.toFixed(4)} unit="m" />
              <DataCard label="长半轴" value={(ellipseParams.a * 2000).toFixed(2)} unit="mm" />
              <DataCard label="短半轴" value={(ellipseParams.b * 2000).toFixed(2)} unit="mm" />
            </DataCardsGrid>
          </div>
        )}

        {chartData && chartData.length > 0 && (
          <div className="border-t border-cyan-500/20 pt-4">
            <h3 className="text-sm font-medium text-cyan-400 font-mono mb-3">
              偏差分布
            </h3>
            <div className="h-40 bg-slate-800/50 rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a3a6a" />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0B1E3F',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#00D4FF' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => {
                      const value = parseFloat(entry.name);
                      const color =
                        value < -10
                          ? '#3b82f6'
                          : value < 0
                          ? '#06b6d4'
                          : value < 10
                          ? '#22c55e'
                          : value < 15
                          ? '#f59e0b'
                          : '#ef4444';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="border-t border-cyan-500/20 pt-4">
          <h3 className="text-sm font-medium text-cyan-400 font-mono mb-3">
            告警历史
            {unacknowledgedAlerts.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                {unacknowledgedAlerts.length}
              </span>
            )}
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-4 font-mono">
                暂无告警记录
              </div>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'p-3 rounded-lg border transition-all cursor-pointer',
                    alert.acknowledged
                      ? 'bg-slate-800/30 border-slate-700'
                      : alert.level === 'danger'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-yellow-500/10 border-yellow-500/30'
                  )}
                  onClick={() => !alert.acknowledged && onAcknowledgeAlert(alert.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div
                        className={cn(
                          'text-xs font-mono font-medium',
                          alert.acknowledged
                            ? 'text-gray-500'
                            : alert.level === 'danger'
                            ? 'text-red-400'
                            : 'text-yellow-400'
                        )}
                      >
                        {alert.level === 'danger' ? '严重告警' : '预警'}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 font-mono line-clamp-2">
                        {alert.message}
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          'text-sm font-mono font-bold',
                          alert.acknowledged
                            ? 'text-gray-500'
                            : alert.level === 'danger'
                            ? 'text-red-400'
                            : 'text-yellow-400'
                        )}
                      >
                        {alert.actual_value.toFixed(1)}mm
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {new Date(alert.created_at).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
