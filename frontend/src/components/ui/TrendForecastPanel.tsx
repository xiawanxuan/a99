import React, { useEffect, useMemo } from 'react';
import TrendChart from './TrendChart';
import { useAppStore } from '../../store';
import { localMockForecast } from '../../services/forecastService';

interface TrendForecastPanelProps {
  position?: number;
}

const TrendForecastPanel: React.FC<TrendForecastPanelProps> = ({ position = 0.5 }) => {
  const {
    trendForecast,
    setTrendForecastData,
    setTrendForecastLoading,
    setTrendForecastError,
    setForecastMonths,
    setConfidenceLevel,
    setShowForecast,
    setSelectedMetric,
  } = useAppStore();

  const { data, loading, error, forecastMonths, confidenceLevel, showForecast, selectedMetric } = trendForecast;

  useEffect(() => {
    const loadForecast = async () => {
      setTrendForecastLoading(true);
      setTrendForecastError(null);
      try {
        const result = localMockForecast(12, '2025-01-15', position, forecastMonths, confidenceLevel);
        setTrendForecastData(result);
      } catch (err) {
        setTrendForecastError(err instanceof Error ? err.message : '预测失败');
      }
    };
    loadForecast();
  }, [position, forecastMonths, confidenceLevel, setTrendForecastData, setTrendForecastLoading, setTrendForecastError]);

  const riskLevelColor = (level: string) => {
    switch (level) {
      case '高': return 'text-red-400 bg-red-500/20 border-red-500/50';
      case '中': return 'text-amber-400 bg-amber-500/20 border-amber-500/50';
      default: return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/50';
    }
  };

  const formatDate = (dateStr: string) => {
    return dateStr.slice(5).replace('-', '/');
  };

  const summary = data?.summary;

  const metricOptions: { value: 'both' | 'settlement' | 'convergence'; label: string; color: string }[] = useMemo(() => [
    { value: 'both', label: '全部', color: 'bg-slate-600' },
    { value: 'settlement', label: '沉降', color: 'bg-cyan-500' },
    { value: 'convergence', label: '收敛', color: 'bg-amber-500' },
  ], []);

  const confidenceOptions = [
    { value: 0.9, label: '90%' },
    { value: 0.95, label: '95%' },
    { value: 0.99, label: '99%' },
  ];

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          形变趋势预测
          <span className="text-xs text-slate-500 font-normal">LSTM模型</span>
        </h3>
        <button
          onClick={() => setShowForecast(!showForecast)}
          className={`text-xs px-2 py-0.5 rounded-md transition-all ${
            showForecast
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
              : 'bg-slate-800 text-slate-500 border border-slate-700'
          }`}
        >
          {showForecast ? '显示预测' : '隐藏预测'}
        </button>
      </div>

      <div className="flex gap-1 bg-slate-800/50 p-0.5 rounded-lg">
        {metricOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedMetric(opt.value)}
            className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              selectedMetric === opt.value
                ? 'bg-slate-700 text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${opt.color}`} />
            {opt.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <TrendChart
          data={showForecast ? data : (data ? { ...data, forecast_dates: [], forecast_settlement: [], forecast_convergence: [], settlement_lower: [], settlement_upper: [], convergence_lower: [], convergence_upper: [] } as any : null)}
          loading={loading}
          selectedMetric={selectedMetric}
          height={180}
          threshold={summary?.alert_threshold || 15}
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg">
            <span className="text-red-400 text-xs">{error}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center gap-1">
          <span className="text-slate-500 text-[10px]">预测周期</span>
          <select
            value={forecastMonths}
            onChange={(e) => setForecastMonths(Number(e.target.value))}
            className="w-full bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-md border border-slate-700 focus:outline-none focus:border-indigo-500/50"
          >
            <option value={1}>1个月</option>
            <option value={3}>3个月</option>
            <option value={6}>6个月</option>
          </select>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-slate-500 text-[10px]">置信度</span>
          <select
            value={confidenceLevel}
            onChange={(e) => setConfidenceLevel(Number(e.target.value))}
            className="w-full bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-md border border-slate-700 focus:outline-none focus:border-indigo-500/50"
          >
            {confidenceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-slate-500 text-[10px]">历史数据</span>
          <div className="w-full text-center bg-slate-800/50 text-slate-300 text-xs px-2 py-1.5 rounded-md border border-slate-700/50">
            {summary?.history_periods || 12}期
          </div>
        </div>
      </div>

      {summary && (
        <div className="space-y-3 pt-2 border-t border-slate-700/50">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                <span className="text-xs text-slate-400">沉降趋势</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-lg font-semibold text-cyan-400">
                  {summary.final_settlement_forecast >= 0 ? '+' : ''}
                  {summary.final_settlement_forecast.toFixed(1)}
                  <span className="text-[10px] font-normal text-slate-500 ml-0.5">mm</span>
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${riskLevelColor(summary.settlement_risk_level)}`}>
                  {summary.settlement_risk_level}风险
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                趋势: {summary.settlement_trend >= 0 ? '+' : ''}{summary.settlement_trend.toFixed(2)} mm/期
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs text-slate-400">收敛趋势</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-lg font-semibold text-amber-400">
                  {summary.final_convergence_forecast >= 0 ? '+' : ''}
                  {summary.final_convergence_forecast.toFixed(1)}
                  <span className="text-[10px] font-normal text-slate-500 ml-0.5">mm</span>
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${riskLevelColor(summary.convergence_risk_level)}`}>
                  {summary.convergence_risk_level}风险
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                趋势: {summary.convergence_trend >= 0 ? '+' : ''}{summary.convergence_trend.toFixed(2)} mm/期
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2">
            <span className="text-xs text-slate-400">总体风险评估</span>
            <span className={`text-sm font-semibold px-2 py-0.5 rounded-md border ${riskLevelColor(summary.overall_risk_level)}`}>
              {summary.overall_risk_level}风险
            </span>
          </div>

          {summary.will_exceed_threshold && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-sm">⚠</span>
                <div className="text-[11px] text-red-300 leading-relaxed">
                  预测显示未来 {forecastMonths} 个月内形变量将超过 {summary.alert_threshold}mm 阈值，
                  建议加强监测频率并采取预防措施。
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {data && (
        <div className="pt-2 border-t border-slate-700/50">
          <div className="text-[10px] text-slate-500 mb-2">预测明细</div>
          <div className="grid grid-cols-3 gap-1.5">
            {data.forecast_dates.map((date, i) => (
              <div
                key={date}
                className="bg-slate-800/40 rounded-md p-1.5 text-center"
              >
                <div className="text-[10px] text-slate-500">{formatDate(date)}</div>
                {selectedMetric !== 'convergence' && (
                  <div className="text-[10px] text-cyan-400 mt-0.5">
                    沉 {data.forecast_settlement[i].toFixed(1)}
                  </div>
                )}
                {selectedMetric !== 'settlement' && (
                  <div className="text-[10px] text-amber-400">
                    收 {data.forecast_convergence[i].toFixed(1)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrendForecastPanel;
