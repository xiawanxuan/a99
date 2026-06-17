import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import type { PointCloudPhase } from '../../types';
import { PHASE_NAMES } from '../../types';
import { cn } from '../../lib/utils';

interface TimelineProps {
  phases: PointCloudPhase[];
  currentIndex: number;
  isPlaying: boolean;
  playSpeed?: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (index: number) => void;
  onSpeedChange?: (speed: number) => void;
  className?: string;
}

export function Timeline({
  phases,
  currentIndex,
  isPlaying,
  playSpeed = 1,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onSpeedChange,
  className,
}: TimelineProps) {
  return (
    <div
      className={cn(
        'bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-4',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-cyan-400 font-mono">时间轴动画</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="p-2 hover:bg-cyan-500/20 rounded-lg transition-colors text-gray-400 hover:text-cyan-400 disabled:opacity-50"
            disabled={currentIndex === 0}
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg transition-colors text-cyan-400 hover:text-cyan-300"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={onNext}
            className="p-2 hover:bg-cyan-500/20 rounded-lg transition-colors text-gray-400 hover:text-cyan-400 disabled:opacity-50"
            disabled={currentIndex === phases.length - 1}
          >
            <SkipForward size={16} />
          </button>
          <div className="w-px h-6 bg-cyan-500/30 mx-1" />
          <select
            value={playSpeed}
            onChange={(e) => onSpeedChange?.(parseFloat(e.target.value))}
            className="bg-slate-800 text-cyan-400 text-sm px-2 py-1 rounded border border-cyan-500/30 focus:outline-none focus:border-cyan-500"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
      </div>

      <div className="relative">
        <input
          type="range"
          min={0}
          max={phases.length - 1}
          value={currentIndex}
          onChange={(e) => onSeek(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between mt-2">
          {phases.map((phase, index) => (
            <div
              key={phase}
              className={cn(
                'text-xs font-mono transition-colors',
                index <= currentIndex ? 'text-cyan-400' : 'text-gray-600'
              )}
            >
              {PHASE_NAMES[phase]}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-cyan-500/20">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">当前期次:</span>
          <span className="text-cyan-400 font-mono font-bold">
            {PHASE_NAMES[phases[currentIndex]]}
          </span>
        </div>
      </div>
    </div>
  );
}
