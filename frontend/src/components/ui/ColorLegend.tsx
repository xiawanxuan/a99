import { useMemo } from 'react';
import { getDeviationColorHex } from '../../utils/colormap';

interface ColorLegendProps {
  range?: [number, number];
  title?: string;
  vertical?: boolean;
}

export function ColorLegend({ range = [-20, 20], title = '形变色谱', vertical = true }: ColorLegendProps) {
  const colors = useMemo(() => {
    const result: { value: number; color: string }[] = [];
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const value = range[0] + t * (range[1] - range[0]) * t;
      const value2 = range[0] + (range[1] - range[0]) * t;
      result.push({
        value: value2,
        color: getDeviationColorHex(value2, range),
      });
    }
    return result;
  }, [range]);

  if (vertical) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-cyan-400 font-mono">{title}</span>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-40 rounded overflow-hidden"
            style={{
              background: `linear-gradient(to top, ${colors[0].color}, ${colors[Math.floor(colors.length / 2)].color}, ${colors[colors.length - 1].color}`,
            }}
          />
          <div className="flex flex-col justify-between h-40 text-xs text-gray-400 font-mono">
            <span>{range[1].toFixed(0)} mm</span>
            <span>{((range[0] + range[1]) / 2).toFixed(0)} mm</span>
            <span>{range[0].toFixed(0)} mm</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-cyan-400 font-mono">{title}</span>
      <div className="flex items-center gap-2">
        <div
          className="h-4 w-40 rounded overflow-hidden"
          style={{
            background: `linear-gradient(to right, ${colors[0].color}, ${colors[Math.floor(colors.length / 2)].color}, ${colors[colors.length - 1].color}`,
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 font-mono w-40">
        <span>{range[0]} mm</span>
        <span>{((range[0] + range[1]) / 2).toFixed(0)} mm</span>
        <span>{range[1]} mm</span>
      </div>
    </div>
  );
}
