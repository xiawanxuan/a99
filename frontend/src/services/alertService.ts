import type { AlertData, DeformationResult } from '../types';

const API_BASE = '/api';
const WARNING_THRESHOLD = 15;
const DANGER_THRESHOLD = 30;

export async function fetchAlerts(params?: {
  page?: number;
  page_size?: number;
  acknowledged?: boolean;
}): Promise<AlertData[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.page_size !== undefined) queryParams.append('page_size', params.page_size.toString());
    if (params?.acknowledged !== undefined) queryParams.append('acknowledged', params.acknowledged.toString());

    const response = await fetch(`${API_BASE}/alerts?${queryParams.toString()}`);
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch alerts');
    }
    return data.data as AlertData[];
  } catch {
    return [];
  }
}

export async function acknowledgeAlert(alertId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    });
    const data = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

export async function checkDeformationAlerts(
  deformationResult: DeformationResult,
  crossSectionPosition?: number,
  pointCloudPhase?: string
): Promise<AlertData | null> {
  const { maxDeviation, convergence, settlement, id } = deformationResult;

  let alertData: AlertData | null = null;

  if (Math.abs(maxDeviation) >= DANGER_THRESHOLD) {
    alertData = {
      id: `alert-${Date.now()}`,
      measurement_id: id,
      level: 'danger',
      message: `严重形变警报：最大偏差 ${maxDeviation.toFixed(2)}mm 超过危险阈值 ${DANGER_THRESHOLD}mm`,
      threshold: DANGER_THRESHOLD,
      actual_value: Math.abs(maxDeviation),
      acknowledged: false,
      created_at: new Date().toISOString(),
      cross_section_position: crossSectionPosition,
      point_cloud_phase: pointCloudPhase,
    };
  } else if (Math.abs(maxDeviation) >= WARNING_THRESHOLD) {
    alertData = {
      id: `alert-${Date.now()}`,
      measurement_id: id,
      level: 'warning',
      message: `形变警告：最大偏差 ${maxDeviation.toFixed(2)}mm 超过警告阈值 ${WARNING_THRESHOLD}mm`,
      threshold: WARNING_THRESHOLD,
      actual_value: Math.abs(maxDeviation),
      acknowledged: false,
      created_at: new Date().toISOString(),
      cross_section_position: crossSectionPosition,
      point_cloud_phase: pointCloudPhase,
    };
  } else if (Math.abs(convergence) >= DANGER_THRESHOLD) {
    alertData = {
      id: `alert-${Date.now()}`,
      measurement_id: id,
      level: 'danger',
      message: `收敛变形警报：收敛率 ${convergence.toFixed(2)}% 超过危险阈值`,
      threshold: DANGER_THRESHOLD,
      actual_value: Math.abs(convergence),
      acknowledged: false,
      created_at: new Date().toISOString(),
      cross_section_position: crossSectionPosition,
      point_cloud_phase: pointCloudPhase,
    };
  } else if (Math.abs(settlement) >= DANGER_THRESHOLD) {
    alertData = {
      id: `alert-${Date.now()}`,
      measurement_id: id,
      level: 'danger',
      message: `沉降变形警报：沉降率 ${settlement.toFixed(2)}% 超过危险阈值`,
      threshold: DANGER_THRESHOLD,
      actual_value: Math.abs(settlement),
      acknowledged: false,
      created_at: new Date().toISOString(),
      cross_section_position: crossSectionPosition,
      point_cloud_phase: pointCloudPhase,
    };
  }

  return alertData;
}

interface WebSocketAlertMessage {
  alert_id: string;
  measurement_id: string;
  level: 'warning' | 'danger';
  message: string;
  threshold: number;
  actual_value: number;
  cross_section_position?: number;
  point_cloud_phase?: string;
}

export function parseWebSocketAlert(message: WebSocketAlertMessage): AlertData {
  return {
    id: message.alert_id,
    measurement_id: message.measurement_id,
    level: message.level,
    message: message.message,
    threshold: message.threshold,
    actual_value: message.actual_value,
    acknowledged: false,
    created_at: new Date().toISOString(),
    cross_section_position: message.cross_section_position,
    point_cloud_phase: message.point_cloud_phase,
  };
}
