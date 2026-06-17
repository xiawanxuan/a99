import type { CrossSectionData, DeformationResult, Point3D, EllipseParams, DeviationStats, Point2D } from '../types';
import { analyzeCrossSection as utilsAnalyzeCrossSection, computeDeviations, fitEllipse } from '../utils/pointCloud';
import { pointToEllipseDistance, Plane } from '../utils/geometry';

const API_BASE = '/api';

export async function fetchCrossSections(bimModelId: string): Promise<CrossSectionData[]> {
  try {
    const response = await fetch(`${API_BASE}/bim-models/${bimModelId}/cross-sections`);
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch cross sections');
    }
    return data.data as CrossSectionData[];
  } catch {
    return [];
  }
}

export async function fetchCrossSection(id: string): Promise<CrossSectionData | null> {
  try {
    const response = await fetch(`${API_BASE}/cross-sections/${id}`);
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch cross section');
    }
    return data.data as CrossSectionData;
  } catch {
    return null;
  }
}

export async function performCrossSectionCut(
  pointCloudData: Point3D[],
  position: number,
  thickness: number = 0.05
): Promise<{ points: Point3D[]; projectedPoints: Point2D[] }> {
  const result = utilsAnalyzeCrossSection(pointCloudData, position, thickness);

  return {
    points: result.indices.map(i => pointCloudData[i]),
    projectedPoints: result.projectedPoints,
  };
}

export async function fitCrossSectionEllipse(
  projectedPoints: Point2D[]
): Promise<EllipseParams | null> {
  return fitEllipse(projectedPoints);
}

export async function calculateDeformation(
  crossSectionId: string,
  pointCloudId: string,
  measuredPoints: Point2D[],
  baselineEllipse: EllipseParams,
  baselineWidth: number,
  baselineHeight: number
): Promise<DeformationResult | null> {
  const ellipse = await fitCrossSectionEllipse(measuredPoints);
  if (!ellipse) return null;
  
  const deviationResult = computeDeviations(measuredPoints, baselineEllipse, [-20, 20]);
  
  const convergence = ((baselineWidth - (ellipse.a * 2)) / baselineWidth) * 100;
  const settlement = ((baselineHeight - (ellipse.b * 2)) / baselineHeight) * 100;

  const pointColors: number[][] = Array.from({ length: deviationResult.colors.length / 3 }, (_, i) => [
    deviationResult.colors[i * 3],
    deviationResult.colors[i * 3 + 1],
    deviationResult.colors[i * 3 + 2],
  ]);

  return {
    id: `deform-${Date.now()}`,
    crossSectionId,
    pointCloudId,
    convergence,
    settlement,
    maxDeviation: deviationResult.stats.max,
    avgDeviation: deviationResult.stats.mean,
    ellipseParams: ellipse,
    deviationStats: deviationResult.stats,
    pointDeviations: deviationResult.deviations,
    pointColors,
    measuredAt: new Date().toISOString(),
  };
}

export async function fetchDeformationMeasurements(
  crossSectionId: string
): Promise<DeformationResult[]> {
  try {
    const response = await fetch(
      `${API_BASE}/cross-sections/${crossSectionId}/deformation-measurements`
    );
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch deformation measurements');
    }
    return data.data as DeformationResult[];
  } catch {
    return [];
  }
}

export async function analyzeCrossSection(
  crossSection: CrossSectionData,
  pointCloudData: Point3D[]
): Promise<DeformationResult | null> {
  try {
    const cutResult = await performCrossSectionCut(
      pointCloudData,
      crossSection.position,
      0.05
    );

    if (cutResult.projectedPoints.length < 5) {
      return null;
    }

    return await calculateDeformation(
      crossSection.id,
      'current',
      cutResult.projectedPoints,
      crossSection.baselineEllipse,
      crossSection.baselineWidth,
      crossSection.baselineHeight
    );
  } catch {
    return null;
  }
}

export function calculateDeviationStats(deviations: number[]): DeviationStats {
  if (deviations.length === 0) {
    return { min: 0, max: 0, mean: 0, std: 0, histogram: [] };
  }

  const min = Math.min(...deviations);
  const max = Math.max(...deviations);
  const mean = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  const variance = deviations.reduce((a, b) => a + (b - mean) ** 2, 0) / deviations.length;
  const std = Math.sqrt(variance);

  const binCount = 10;
  const binSize = (max - min) / binCount || 1;
  const histogram: number[] = new Array(binCount).fill(0);
  
  for (const d of deviations) {
    const binIndex = Math.min(Math.floor((d - min) / binSize), binCount - 1);
    histogram[binIndex]++;
  }

  return { min, max, mean, std, histogram };
}
