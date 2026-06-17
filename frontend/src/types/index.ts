export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface EllipseParams {
  cx: number;
  cy: number;
  a: number;
  b: number;
  rotation: number;
  theta?: number;
}

export interface DeviationStats {
  min: number;
  max: number;
  mean: number;
  std: number;
  histogram: number[];
}

export interface BIMModel {
  id: string;
  name: string;
  file_path: string;
  length: number;
  width: number;
  height: number;
  axis_points: Point3D[];
  created_at: string;
}

export interface PointCloud {
  id: string;
  bim_model_id: string;
  phase: 'baseline' | 'phase1' | 'phase2';
  file_path: string;
  point_count: number;
  capture_time: string;
  created_at: string;
}

export interface CrossSection {
  id: string;
  bim_model_id: string;
  position: number;
  baseline_width: number;
  baseline_height: number;
  baseline_ellipse: EllipseParams;
  created_at: string;
}

export interface DeformationMeasurement {
  id: string;
  cross_section_id: string;
  point_cloud_id: string;
  convergence: number;
  settlement: number;
  max_deviation: number;
  avg_deviation: number;
  ellipse_params: EllipseParams;
  deviation_stats: DeviationStats;
  measured_at: string;
}

export interface AlertData {
  id: string;
  measurement_id: string;
  user_id?: string;
  level: 'warning' | 'danger';
  message: string;
  threshold: number;
  actual_value: number;
  acknowledged: boolean;
  acknowledged_at?: string;
  created_at: string;
  cross_section_position?: number;
  point_cloud_phase?: string;
}

export interface CrossSectionAnalysisResult {
  measurement: DeformationMeasurement;
  cross_section: CrossSection;
  point_count: number;
  ellipse_params: EllipseParams;
  deviations: number[];
  stats: DeviationStats;
  colors: number[];
  section_points: Point2D[];
}

export interface PointCloudData {
  id: string;
  points: Point3D[];
  colors?: number[][] | Float32Array;
  pointCount: number;
  phase: 'baseline' | 'phase1' | 'phase2';
  captureTime: string;
}

export interface CrossSectionData {
  id: string;
  position: number;
  points: Point3D[];
  projectedPoints: Point2D[];
  baselineEllipse: EllipseParams;
  baselineWidth: number;
  baselineHeight: number;
}

export interface DeformationResult {
  id: string;
  crossSectionId: string;
  pointCloudId: string;
  convergence: number;
  settlement: number;
  maxDeviation: number;
  avgDeviation: number;
  ellipseParams: EllipseParams;
  deviationStats: DeviationStats;
  pointDeviations: number[];
  pointColors: number[][];
  measuredAt: string;
}

export interface PlaneEquation {
  normal: Point3D;
  d: number;
}

export type PointCloudPhase = 'baseline' | 'phase1' | 'phase2';

export const PHASE_NAMES: Record<PointCloudPhase, string> = {
  baseline: '基线期',
  phase1: '一期',
  phase2: '二期',
};

export const PHASE_COLORS: Record<PointCloudPhase, string> = {
  baseline: '#00D4FF',
  phase1: '#2ED573',
  phase2: '#FFA502',
};

export interface DisplayControls {
  showBimModel: boolean;
  showPointCloud: boolean;
  showChroma: boolean;
  showCuttingPlane: boolean;
}

export interface AlertThresholds {
  convergenceWarning: number;
  convergenceDanger: number;
  settlementWarning: number;
  settlementDanger: number;
  maxDeviationWarning: number;
  maxDeviationDanger: number;
}

export interface TimelineState {
  isPlaying: boolean;
  currentTimeIndex: number;
  timePoints: string[];
  playSpeed: number;
}

export interface SceneState {
  currentPhase: PointCloudPhase;
  cuttingPlanePosition: number;
  cuttingPlaneThickness: number;
  cuttingPlaneNormal: Point3D;
  displayControls: DisplayControls;
  alertThresholds: AlertThresholds;
  timeline: TimelineState;
  deviationRange: [number, number];
  currentBimModelId: string | null;
  currentPointCloudId: string | null;
  currentCrossSectionId: string | null;
  showPointCloud: boolean;
  showBimModel: boolean;
  showCrossSection: boolean;
  showChromaLayer: boolean;
  isPlaying: boolean;
  currentTimeIndex: number;
  timeRange: [string, string];
  cameraPosition: Point3D;
  cameraTarget: Point3D;
}
