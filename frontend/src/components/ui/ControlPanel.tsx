import { Layers, Scissors, AlertCircle, Settings, Eye, EyeOff } from 'lucide-react';
import type { PointCloudPhase, DisplayControls, AlertThresholds } from '../../types';
import { PHASE_NAMES, PHASE_COLORS } from '../../types';
import { cn } from '../../lib/utils';

interface ControlPanelProps {
  phases: PointCloudPhase[];
  currentPhase: PointCloudPhase;
  onPhaseChange: (phase: PointCloudPhase) => void;
  displayControls: DisplayControls;
  onDisplayControlChange: (controls: Partial<DisplayControls>) => void;
  cuttingPlanePosition: number;
  onCuttingPlanePositionChange: (position: number) => void;
  cuttingPlaneThickness: number;
  onCuttingPlaneThicknessChange: (thickness: number) => void;
  deviationRange: [number, number];
  onDeviationRangeChange: (range: [number, number]) => void;
  alertThresholds: AlertThresholds;
  onAlertThresholdChange: (thresholds: Partial<AlertThresholds>) => void;
  pointCount: number;
  className?: string;
}

const displayOptions: { key: keyof DisplayControls; label: string; icon: any }[] = [
  { key: 'showBimModel', label: 'BIM模型', icon: Layers },
  { key: 'showPointCloud', label: '点云数据', icon: Eye },
  { key: 'showChroma', label: '形变色谱', icon: Settings },
  { key: 'showCuttingPlane', label: '切割平面', icon: Scissors },
];

export function ControlPanel({
  phases,
  currentPhase,
  onPhaseChange,
  displayControls,
  onDisplayControlChange,
  cuttingPlanePosition,
  onCuttingPlanePositionChange,
  cuttingPlaneThickness,
  onCuttingPlaneThicknessChange,
  deviationRange,
  onDeviationRangeChange,
  alertThresholds,
  onAlertThresholdChange,
  pointCount,
  className,
}: ControlPanelProps) {
  const handleToggleDisplay = (key: keyof DisplayControls) => {
    onDisplayControlChange({ [key]: !displayControls[key] } as Partial<DisplayControls>);
  };

  return (
    <div
      className={cn(
        'w-72 bg-slate-900/90 backdrop-blur-xl border-r border-cyan-500/30 h-full overflow-y-auto',
        className
      )}
    >
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
            <Layers className="text-cyan-400" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-mono">参数面板</h2>
            <p className="text-xs text-gray-400 font-mono">形变监测控制</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-cyan-400 font-mono flex items-center gap-2">
            <Layers size={14} />
            点云数据
          </h3>
          <div className="space-y-2">
            {phases.map((phase) => (
              <button
                key={phase}
                onClick={() => onPhaseChange(phase)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-lg border transition-all font-mono',
                  currentPhase === phase
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                    : 'bg-slate-800/50 border-slate-700 text-gray-400 hover:border-cyan-500/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: PHASE_COLORS[phase] }}
                  />
                  <span>{PHASE_NAMES[phase]}</span>
                </div>
                {currentPhase === phase && (
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-500 font-mono text-right">
            点云数量: {pointCount.toLocaleString()}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-cyan-400 font-mono flex items-center gap-2">
            <Eye size={14} />
            显示控制
          </h3>
          <div className="space-y-2">
            {displayOptions.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleToggleDisplay(key)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-lg border transition-all',
                  displayControls[key]
                    ? 'bg-cyan-500/10 border-cyan-500/50'
                    : 'bg-slate-800/50 border-slate-700'
                )}
              >
                <div className="flex items-center gap-2 text-gray-300 font-mono">
                  <Icon size={16} />
                  <span className="text-sm">{label}</span>
                </div>
                {displayControls[key] ? (
                  <Eye size={16} className="text-cyan-400" />
                ) : (
                  <EyeOff size={16} className="text-gray-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-cyan-400 font-mono flex items-center gap-2">
            <Scissors size={14} />
            截面切割
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1 font-mono">
                <span>切割位置</span>
                <span className="text-cyan-400">{cuttingPlanePosition.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={cuttingPlanePosition}
                onChange={(e) => onCuttingPlanePositionChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1 font-mono">
                <span>切割厚度</span>
                <span className="text-cyan-400">{cuttingPlaneThickness.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min={0.01}
                max={2}
                step={0.01}
                value={cuttingPlaneThickness}
                onChange={(e) => onCuttingPlaneThicknessChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-cyan-400 font-mono flex items-center gap-2">
            <AlertCircle size={14} />
            告警阈值
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1 font-mono">
                <span>最大偏差阈值</span>
                <span className="text-cyan-400">
                  {alertThresholds.maxDeviationWarning} mm
                </span>
              </div>
              <input
                type="number"
                min={5}
                max={50}
                step={1}
                value={alertThresholds.maxDeviationWarning}
                onChange={(e) =>
                  onAlertThresholdChange({
                    maxDeviationWarning: parseFloat(e.target.value),
                  })
                }
                className="w-full bg-slate-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1 font-mono">
                <span>收敛预警</span>
                <span className="text-cyan-400">
                  {alertThresholds.convergenceWarning} mm
                </span>
              </div>
              <input
                type="number"
                min={5}
                max={50}
                step={1}
                value={alertThresholds.convergenceWarning}
                onChange={(e) =>
                  onAlertThresholdChange({
                    convergenceWarning: parseFloat(e.target.value),
                  })
                }
                className="w-full bg-slate-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-cyan-400 font-mono flex items-center gap-2">
            <Settings size={14} />
            色谱范围
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 font-mono">最小值 (mm)</label>
              <input
                type="number"
                value={deviationRange[0]}
                onChange={(e) =>
                  onDeviationRangeChange([
                    parseFloat(e.target.value),
                    deviationRange[1],
                  ])
                }
                className="w-full bg-slate-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono">最大值 (mm)</label>
              <input
                type="number"
                value={deviationRange[1]}
                onChange={(e) =>
                  onDeviationRangeChange([
                    deviationRange[0],
                    parseFloat(e.target.value),
                  ])
                }
                className="w-full bg-slate-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
