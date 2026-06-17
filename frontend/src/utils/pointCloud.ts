import type { Point3D, Point2D, EllipseParams, DeviationStats } from '../types';
import {
  cutCrossSection,
  fitEllipse,
  distanceToEllipse,
  computeDeformation,
} from './geometry';
import { getColorArray } from './colormap';

export { cutCrossSection, fitEllipse, distanceToEllipse };

export interface SectionAnalysisResult {
  points: Point2D[];
  indices: number[];
  projectedPoints: Point2D[];
  ellipseParams: EllipseParams | null;
  pointCount: number;
}

export const generateMockPipePointCloud = generateSyntheticPointCloud;

export const crossSectionCut = cutCrossSection;

export function calculateCylinderDeviations(
  points: Point3D[],
  baselineEllipse: EllipseParams,
  deviationRange: [number, number] = [-20, 20]
): { deviations: number[]; colors: number[][] } {
  const deviations: number[] = [];
  const colors: number[][] = [];
  
  for (const point of points) {
    const point2D: Point2D = { x: point.y, y: point.z };
    const dev = distanceToEllipse(point2D, baselineEllipse) * 1000;
    deviations.push(dev);
    
    const t = Math.max(0, Math.min(1, (dev - deviationRange[0]) / (deviationRange[1] - deviationRange[0])));
    const r = Math.min(1, Math.max(0, t));
    colors.push([r, 0, 1 - r]);
  }
  
  return { deviations, colors };
}

export interface DeviationResult {
  deviations: number[];
  stats: DeviationStats;
  colors: Float32Array;
}

export function generateSyntheticPointCloud(
  length: number = 100,
  width: number = 3,
  height: number = 2.5,
  pointDensity: number = 5000
): Point3D[] {
  const points: Point3D[] = [];
  const numPoints = pointDensity;

  for (let i = 0; i < numPoints; i++) {
    const x = Math.random() * length;
    const theta = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.05 + 1;

    const y = (width / 2) * Math.cos(theta) * r + (Math.random() - 0.5) * 0.02;
    const z = (height / 2) * Math.sin(theta) * r + (Math.random() - 0.5) * 0.02;

    points.push({ x, y, z });
  }

  return points;
}

export function generateDeformedPointCloud(
  basePoints: Point3D[],
  deformationAmount: number = 0.01,
  settlementAmount: number = 0.005
): Point3D[] {
  return basePoints.map((p) => ({
    x: p.x,
    y: p.y * (1 + deformationAmount * (Math.random() - 0.5)),
    z: p.z * (1 + deformationAmount * (Math.random() - 0.5)) - settlementAmount,
  }));
}

export function analyzeCrossSection(
  points: Point3D[],
  position: number,
  thickness: number = 0.05
): SectionAnalysisResult {
  const planeNormal = { x: 1, y: 0, z: 0 };
  const planePoint = { x: position, y: 0, z: 0 };

  const len = Math.sqrt(
    planeNormal.x ** 2 + planeNormal.y ** 2 + planeNormal.z ** 2
  );
  const nx = planeNormal.x / len;
  const ny = planeNormal.y / len;
  const nz = planeNormal.z / len;
  const d = -(nx * planePoint.x + ny * planePoint.y + nz * planePoint.z);

  const { points: sectionPoints, indices } = cutCrossSection(
    points,
    { x: nx, y: ny, z: nz },
    d,
    thickness
  );

  const ellipseParams = fitEllipse(sectionPoints);

  return {
    points: sectionPoints,
    indices,
    projectedPoints: sectionPoints,
    ellipseParams,
    pointCount: sectionPoints.length,
  };
}

export function computeDeviations(
  sectionPoints: Point2D[],
  baselineEllipse: EllipseParams,
  deviationRange: [number, number] = [-20, 20]
): DeviationResult {
  const deviations = sectionPoints.map((p) => distanceToEllipse(p, baselineEllipse) * 1000);

  let sum = 0;
  let sumSq = 0;
  let minDev = Infinity;
  let maxDev = -Infinity;

  for (const d of deviations) {
    sum += d;
    sumSq += d * d;
    minDev = Math.min(minDev, d);
    maxDev = Math.max(maxDev, d);
  }

  const n = deviations.length;
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const std = Math.sqrt(variance);

  const histogram = computeHistogram(deviations, deviationRange[0], deviationRange[1], 10);

  const colors = getColorArray(deviations, deviationRange[0], deviationRange[1], 'coolwarm');

  return {
    deviations,
    stats: {
      min: minDev,
      max: maxDev,
      mean,
      std,
      histogram,
    },
    colors,
  };
}

function computeHistogram(
  data: number[],
  min: number,
  max: number,
  bins: number
): number[] {
  const histogram = new Array(bins).fill(0);
  const binWidth = (max - min) / bins;

  for (const d of data) {
    if (d < min || d > max) continue;
    let binIdx = Math.floor((d - min) / binWidth);
    if (binIdx >= bins) binIdx = bins - 1;
    histogram[binIdx]++;
  }

  const total = data.length;
  if (total > 0) {
    for (let i = 0; i < histogram.length; i++) {
      histogram[i] /= total;
    }
  }

  return histogram;
}

export function convertToThreeJSGeometry(points: Point3D[]): {
  positions: Float32Array;
  count: number;
} {
  const positions = new Float32Array(points.length * 3);

  for (let i = 0; i < points.length; i++) {
    positions[i * 3] = points[i].x;
    positions[i * 3 + 1] = points[i].y;
    positions[i * 3 + 2] = points[i].z;
  }

  return { positions, count: points.length };
}

export function downsamplePointCloud(
  points: Point3D[],
  targetCount: number
): Point3D[] {
  if (points.length <= targetCount) return points;

  const factor = Math.ceil(points.length / targetCount);
  const result: Point3D[] = [];

  for (let i = 0; i < points.length; i += factor) {
    result.push(points[i]);
  }

  return result;
}

export function getPhaseDeformation(
  currentEllipse: EllipseParams,
  baselineEllipse: EllipseParams
): { convergence: number; settlement: number } {
  return computeDeformation(currentEllipse, baselineEllipse);
}

export function loadPLYFromArrayBuffer(buffer: ArrayBuffer): Point3D[] {
  const dataView = new DataView(buffer);
  const decoder = new TextDecoder();
  let offset = 0;

  const headerLines: string[] = [];
  let line = '';

  while (offset < buffer.byteLength) {
    const char = dataView.getUint8(offset++);
    if (char === 10) {
      headerLines.push(line);
      if (line === 'end_header') break;
      line = '';
    } else {
      line += String.fromCharCode(char);
    }
  }

  let pointCount = 0;
  let format = 'ascii';

  for (const headerLine of headerLines) {
    const parts = headerLine.trim().split(/\s+/);
    if (parts[0] === 'format') {
      format = parts[1];
    } else if (parts[0] === 'element' && parts[1] === 'vertex') {
      pointCount = parseInt(parts[2], 10);
    }
  }

  const points: Point3D[] = [];

  if (format === 'ascii') {
    const text = decoder.decode(buffer.slice(offset));
    const lines = text.split('\n');

    for (let i = 0; i < Math.min(lines.length, pointCount); i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 3) {
        points.push({
          x: parseFloat(parts[0]),
          y: parseFloat(parts[1]),
          z: parseFloat(parts[2]),
        });
      }
    }
  } else {
    const isLittleEndian = format === 'binary_little_endian';

    for (let i = 0; i < pointCount; i++) {
      points.push({
        x: dataView.getFloat32(offset, isLittleEndian),
        y: dataView.getFloat32(offset + 4, isLittleEndian),
        z: dataView.getFloat32(offset + 8, isLittleEndian),
      });
      offset += 12;
    }
  }

  return points;
}
