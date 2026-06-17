import { useMemo } from 'react';
import * as THREE from 'three';
import type { Point2D, EllipseParams } from '../../types';
import { generateEllipsePoints } from '../../utils/geometry';
import { getDeviationColorHex } from '../../utils/colormap';

interface CrossSectionViewProps {
  points: Point2D[];
  ellipseParams: EllipseParams | null;
  baselineEllipse?: EllipseParams | null;
  deviations?: number[];
  width?: number;
  height?: number;
  deviationRange?: [number, number];
}

export function CrossSectionView({
  points,
  ellipseParams,
  baselineEllipse,
  deviations,
  width = 280,
  height = 280,
  deviationRange = [-20, 20],
}: CrossSectionViewProps) {
  const canvas = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    return canvas;
  }, [width, height]);

  useMemo(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0B1E3F';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1a3a6a';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = Math.min(canvas.width, canvas.height) / 6;

    ctx.strokeStyle = '#00D4FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, canvas.height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();

    if (points.length > 0) {
      points.forEach((p, i) => {
        const x = centerX + p.x * scale;
        const y = centerY - p.y * scale;

        if (deviations && deviations[i] !== undefined) {
          ctx.fillStyle = getDeviationColorHex(deviations[i], deviationRange);
        } else {
          ctx.fillStyle = '#00D4FF';
        }

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (baselineEllipse) {
      const baselinePoints = generateEllipsePoints(baselineEllipse, 100);
      ctx.strokeStyle = '#2ED573';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      baselinePoints.forEach((p, i) => {
        const x = centerX + p.x * scale;
        const y = centerY - p.y * scale;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (ellipseParams) {
      const ellipsePoints = generateEllipsePoints(ellipseParams, 100);
      ctx.strokeStyle = '#FFA502';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ellipsePoints.forEach((p, i) => {
        const x = centerX + p.x * scale;
        const y = centerY - p.y * scale;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#FFA502';
      ctx.beginPath();
      ctx.arc(centerX + ellipseParams.cx * scale, centerY - ellipseParams.cy * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px JetBrains Mono';
    ctx.textAlign = 'left';
    ctx.fillText('截面视图', 20, 40);

    ctx.font = '16px JetBrains Mono';
    ctx.fillStyle = '#2ED573';
    ctx.fillText('—— 基线椭圆', 20, canvas.height - 60);
    ctx.fillStyle = '#FFA502';
    ctx.fillText('—— 当前椭圆', 20, canvas.height - 30);
  }, [canvas, points, ellipseParams, baselineEllipse, deviations, deviationRange]);

  return (
    <div className="relative">
      <img
        src={canvas.toDataURL()}
        alt="Cross Section"
        className="rounded-lg border border-cyan-500/30"
        style={{ width, height }}
      />
    </div>
  );
}
