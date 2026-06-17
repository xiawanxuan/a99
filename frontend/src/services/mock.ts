import type {
  Point3D,
  EllipseParams,
  PointCloudData,
  CrossSectionData,
  DeformationResult,
  AlertData,
  DeviationStats,
  PointCloudPhase,
} from '../types';

export function generatePipeAxis(
  length: number = 100,
  segments: number = 20,
  amplitude: number = 2
): Point3D[] {
  const axis: Point3D[] = [];
  const step = length / segments;

  for (let i = 0; i <= segments; i++) {
    const x = i * step;
    const y = Math.sin((i / segments) * Math.PI * 2) * amplitude;
    const z = Math.cos((i / segments) * Math.PI) * amplitude * 0.5;
    axis.push({ x, y, z });
  }

  return axis;
}

export function generatePointCloudPhase(
  phase: PointCloudPhase,
  length: number = 100,
  radius: number = 3,
  height: number = 2.5,
  pointsPerMeter: number = 500,
  noise: number = 0.02
): PointCloudData {
  const points: Point3D[] = [];
  const colors: number[][] = [];
  const totalPoints = length * pointsPerMeter;

  const deformationScale =
    phase === 'baseline' ? 0 : phase === 'phase1' ? 0.03 : 0.06;

  for (let i = 0; i < totalPoints; i++) {
    const x = Math.random() * length;
    const angle = Math.random() * Math.PI * 2;

    const deformFactor =
      1 +
      Math.sin(x * 0.1) * deformationScale +
      Math.sin(angle * 4) * deformationScale * 0.5;

    const rx = radius * deformFactor + (Math.random() - 0.5) * noise;
    const ry = height * deformFactor + (Math.random() - 0.5) * noise;

    const y = rx * Math.cos(angle);
    const z = ry * Math.sin(angle);

    points.push({ x, y, z });

    const grayValue = 0.6 + Math.random() * 0.3;
    colors.push([grayValue, grayValue, grayValue]);
  }

  const now = new Date();
  const captureOffset =
    phase === 'baseline' ? 0 : phase === 'phase1' ? 30 : 60;
  now.setDate(now.getDate() - captureOffset);

  return {
    id: `point-cloud-${phase}`,
    points,
    colors,
    pointCount: totalPoints,
    phase,
    captureTime: now.toISOString(),
  };
}

export function generateAllPointClouds(
  length?: number,
  radius?: number,
  height?: number
): PointCloudData[] {
  const phases: PointCloudPhase[] = ['baseline', 'phase1', 'phase2'];
  return phases.map((phase) =>
    generatePointCloudPhase(phase, length, radius, height)
  );
}

export function generateBaselineEllipse(
  width: number = 6,
  height: number = 5
): EllipseParams {
  return {
    cx: 0,
    cy: 0,
    a: width / 2,
    b: height / 2,
    rotation: 0,
  };
}

export function generateCrossSections(
  length: number = 100,
  count: number = 10,
  width: number = 6,
  height: number = 5
): CrossSectionData[] {
  const sections: CrossSectionData[] = [];
  const step = length / (count + 1);

  for (let i = 1; i <= count; i++) {
    const position = i * step;
    const baselineEllipse = generateBaselineEllipse(width, height);

    sections.push({
      id: `cross-section-${i}`,
      position,
      points: [],
      projectedPoints: [],
      baselineEllipse,
      baselineWidth: width,
      baselineHeight: height,
    });
  }

  return sections;
}

function generateDeviationStats(
  baseDeviation: number,
  scale: number = 1
): DeviationStats {
  const min = -20 * scale + baseDeviation;
  const max = 25 * scale + baseDeviation;
  const mean = baseDeviation;
  const std = 5 * scale;

  const histogram: number[] = [];
  const binCount = 20;
  for (let i = 0; i < binCount; i++) {
    const binCenter = min + (i / binCount) * (max - min);
    const gaussian = Math.exp(-((binCenter - mean) ** 2) / (2 * std * std));
    histogram.push(Math.floor(gaussian * 1000 + Math.random() * 100));
  }

  return { min, max, mean, std, histogram };
}

function generatePointDeviations(
  count: number,
  baseDeviation: number,
  scale: number = 1
): { deviations: number[]; colors: number[][] } {
  const deviations: number[] = [];
  const colors: number[][] = [];

  for (let i = 0; i < count; i++) {
    const deviation =
      baseDeviation + (Math.random() - 0.5) * 20 * scale + Math.sin(i * 0.1) * 5;
    deviations.push(deviation);

    const normalized = Math.max(-1, Math.min(1, deviation / 20));
    const r = Math.max(0, normalized);
    const b = Math.max(0, -normalized);
    const g = 1 - Math.abs(normalized) * 0.5;
    colors.push([r, g, b]);
  }

  return { deviations, colors };
}

export function generateDeformationResult(
  crossSection: CrossSectionData,
  pointCloud: PointCloudData,
  deformationScale: number = 1
): DeformationResult {
  const baseDeviation = deformationScale * 8;
  const pointCount = 500;

  const { deviations, colors } = generatePointDeviations(
    pointCount,
    baseDeviation,
    deformationScale
  );

  const stats = generateDeviationStats(baseDeviation, deformationScale);

  const ellipseParams: EllipseParams = {
    ...crossSection.baselineEllipse,
    a: crossSection.baselineEllipse.a - baseDeviation * 0.001,
    b: crossSection.baselineEllipse.b - baseDeviation * 0.0015,
  };

  return {
    id: `deformation-${crossSection.id}-${pointCloud.phase}`,
    crossSectionId: crossSection.id,
    pointCloudId: pointCloud.id,
    convergence: baseDeviation * 1.2,
    settlement: baseDeviation * 0.8,
    maxDeviation: stats.max,
    avgDeviation: stats.mean,
    ellipseParams,
    deviationStats: stats,
    pointDeviations: deviations,
    pointColors: colors,
    measuredAt: pointCloud.captureTime,
  };
}

export function generateAllDeformationResults(
  crossSections: CrossSectionData[],
  pointClouds: PointCloudData[]
): DeformationResult[] {
  const results: DeformationResult[] = [];

  for (const crossSection of crossSections) {
    for (const pointCloud of pointClouds) {
      const scale =
        pointCloud.phase === 'baseline'
          ? 0.1
          : pointCloud.phase === 'phase1'
          ? 0.6
          : 1;
      results.push(
        generateDeformationResult(crossSection, pointCloud, scale)
      );
    }
  }

  return results;
}

export function generateAlerts(
  deformationResults: DeformationResult[],
  crossSections: CrossSectionData[]
): AlertData[] {
  const alerts: AlertData[] = [];
  let alertId = 0;

  for (const result of deformationResults) {
    const crossSection = crossSections.find(
      (cs) => cs.id === result.crossSectionId
    );
    if (!crossSection) continue;

    const phase = result.pointCloudId.includes('baseline')
      ? 'baseline'
      : result.pointCloudId.includes('phase1')
      ? 'phase1'
      : 'phase2';

    if (phase === 'baseline') continue;

    const warningThreshold = 10;
    const dangerThreshold = 20;

    if (Math.abs(result.maxDeviation) >= dangerThreshold) {
      alerts.push({
        id: `alert-${alertId++}`,
        measurement_id: result.id,
        level: 'danger',
        message: `截面位置 ${crossSection.position.toFixed(
          1
        )}m 处最大偏差 ${result.maxDeviation.toFixed(
          2
        )}mm，超过危险阈值`,
        threshold: dangerThreshold,
        actual_value: result.maxDeviation,
        acknowledged: false,
        created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        cross_section_position: crossSection.position,
        point_cloud_phase: phase,
      });
    } else if (Math.abs(result.maxDeviation) >= warningThreshold) {
      alerts.push({
        id: `alert-${alertId++}`,
        measurement_id: result.id,
        level: 'warning',
        message: `截面位置 ${crossSection.position.toFixed(
          1
        )}m 处最大偏差 ${result.maxDeviation.toFixed(
          2
        )}mm，超过警告阈值`,
        threshold: warningThreshold,
        actual_value: result.maxDeviation,
        acknowledged: Math.random() > 0.5,
        created_at: new Date(Date.now() - Math.random() * 86400000 * 2).toISOString(),
        cross_section_position: crossSection.position,
        point_cloud_phase: phase,
      });
    }

    if (Math.abs(result.convergence) >= 15) {
      alerts.push({
        id: `alert-${alertId++}`,
        measurement_id: result.id,
        level: 'danger',
        message: `截面位置 ${crossSection.position.toFixed(
          1
        )}m 处收敛值 ${result.convergence.toFixed(
          2
        )}mm，超过安全阈值`,
        threshold: 15,
        actual_value: result.convergence,
        acknowledged: false,
        created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        cross_section_position: crossSection.position,
        point_cloud_phase: phase,
      });
    }
  }

  return alerts.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export interface MockDataset {
  axis: Point3D[];
  pointClouds: PointCloudData[];
  crossSections: CrossSectionData[];
  deformationResults: DeformationResult[];
  alerts: AlertData[];
}

export function generateCompleteMockDataset(
  length: number = 100,
  crossSectionCount: number = 10
): MockDataset {
  const axis = generatePipeAxis(length);
  const pointClouds = generateAllPointClouds(length);
  const crossSections = generateCrossSections(length, crossSectionCount);
  const deformationResults = generateAllDeformationResults(
    crossSections,
    pointClouds
  );
  const alerts = generateAlerts(deformationResults, crossSections);

  return {
    axis,
    pointClouds,
    crossSections,
    deformationResults,
    alerts,
  };
}

export function getTimePoints(pointClouds: PointCloudData[]): string[] {
  return pointClouds.map((pc) => pc.captureTime);
}
