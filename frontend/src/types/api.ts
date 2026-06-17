import type { EllipseParams, DeviationStats } from './index';

export interface BIMModel {
  id: string;
  name: string;
  file_path: string;
  length: number;
  width: number;
  height: number;
  axis_points: { x: number; y: number; z: number }[];
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

export interface Alert {
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
}

export interface AlertMessage {
  alert_id: string;
  measurement_id: string;
  level: 'warning' | 'danger';
  message: string;
  threshold: number;
  actual_value: number;
  cross_section_position: number;
  point_cloud_phase: string;
}

export interface StatusMessage {
  status: 'processing' | 'completed' | 'error';
  task_id: string;
  progress: number;
  message: string;
}

export interface PingMessage {
  timestamp: number;
}

export type WebSocketPayload = AlertMessage | StatusMessage | PingMessage;

export interface WebSocketMessage {
  type: 'alert' | 'status' | 'ping';
  payload: WebSocketPayload;
  timestamp: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
