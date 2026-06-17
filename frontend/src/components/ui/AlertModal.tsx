import { AlertTriangle, X, CheckCircle, Clock } from 'lucide-react';
import type { AlertData } from '../../types';
import { cn } from '../../lib/utils';

interface AlertModalProps {
  alert: AlertData | null;
  onClose: () => void;
  onAcknowledge?: (alertId: string) => void;
}

export function AlertModal({ alert, onClose, onAcknowledge }: AlertModalProps) {
  if (!alert) return null;

  const isDanger = alert.level === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
        'relative bg-slate-900 border-2 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl',
        'animate-[slideIn_0.3s_ease-out]',
        isDanger
          ? 'border-red-500 shadow-[0_0_60px_rgba(255,71,87,0.5)]'
          : 'border-yellow-500 shadow-[0_0_60px_rgba(255,165,2,0.5)]'
      )}
        style={{
          animation: 'pulse 2s ease-in-out infinite',
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-3 rounded-full',
                isDanger ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
              )}
            >
              <AlertTriangle size={28} />
            </div>
            <div>
              <h3
                className={cn(
                  'text-xl font-bold font-mono',
                  isDanger ? 'text-red-400' : 'text-yellow-400'
                )}
              >
                {isDanger ? '严重形变告警' : '形变预警'}
              </h3>
              <p className="text-xs text-gray-400 font-mono">
                {new Date(alert.created_at).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-gray-200 font-mono">{alert.message}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 font-mono">阈值</div>
              <div className="text-lg font-bold text-white font-mono">
                {alert.threshold.toFixed(2)} mm
              </div>
            </div>
            <div
              className={cn(
                'rounded-lg p-3',
                isDanger ? 'bg-red-500/20' : 'bg-yellow-500/20'
              )}
            >
              <div className="text-xs text-gray-400 font-mono">实际值</div>
              <div
                className={cn(
                  'text-lg font-bold font-mono',
                  isDanger ? 'text-red-400' : 'text-yellow-400'
                )}
              >
                {alert.actual_value.toFixed(2)} mm
              </div>
            </div>
          </div>

          {alert.cross_section_position !== undefined && (
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 font-mono">截面位置</div>
              <div className="text-lg font-bold text-cyan-400 font-mono">
                {alert.cross_section_position.toFixed(2)} m
              </div>
            </div>
          )}

          {alert.point_cloud_phase && (
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 font-mono">点云期次</div>
              <div className="text-lg font-bold text-cyan-400 font-mono">
                {alert.point_cloud_phase}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          {!alert.acknowledged && onAcknowledge && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all font-mono',
                isDanger
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              )}
            >
              <CheckCircle size={18} />
              确认告警
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors font-mono"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
