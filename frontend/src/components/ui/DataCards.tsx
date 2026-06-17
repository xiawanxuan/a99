import { cn } from '../../lib/utils';

interface DataCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'normal' | 'warning' | 'danger';
  className?: string;
}

export function DataCard({
  label, value, unit, trend, status = 'normal', className }: DataCardProps) {
  const statusColors = {
    normal: 'text-green-400',
    warning: 'text-yellow-400',
    danger: 'text-red-400',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  return (
    <div
      className={cn(
        'bg-slate-900/60 backdrop-blur-sm border border-cyan-500/20 rounded-lg p-3 transition-all hover:border-cyan-500/40',
        className
      )}
    >
      <div className="text-xs text-gray-400 font-mono mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={cn('text-2xl font-bold font-mono', statusColors[status])}>
          {value}
        </span>
        {unit && <span className="text-sm text-gray-500 font-mono">{unit}</span>}
        {trend && (
          <span className={cn('text-sm', statusColors[status])}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
    </div>
  );
}

interface DataCardsGridProps {
  children: React.ReactNode;
  columns?: number;
}

export function DataCardsGrid({ children, columns = 2 }: DataCardsGridProps) {
  return (
    <div
      className={cn(
        'grid gap-3',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-3',
        columns === 4 && 'grid-cols-4',
      )}
    >
      {children}
    </div>
  );
}
