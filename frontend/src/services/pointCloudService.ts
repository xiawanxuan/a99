import type { PointCloudData, Point3D } from '../types';
import { generateSyntheticPointCloud, generateDeformedPointCloud, generateMockPipePointCloud } from '../utils/pointCloud';

const API_BASE = '/api';

export async function fetchPointClouds(bimModelId: string): Promise<PointCloudData[]> {
  try {
    const response = await fetch(`${API_BASE}/bim-models/${bimModelId}/point-clouds`);
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch point clouds');
    }
    return data.data as PointCloudData[];
  } catch {
    return [];
  }
}

export async function fetchPointCloud(id: string): Promise<PointCloudData | null> {
  try {
    const response = await fetch(`${API_BASE}/point-clouds/${id}`);
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch point cloud');
    }
    return data.data as PointCloudData;
  } catch {
    return null;
  }
}

export async function loadPointCloudData(id: string): Promise<PointCloudData | null> {
  try {
    const response = await fetch(`${API_BASE}/point-clouds/${id}/data`);
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to load point cloud data');
    }

    return {
      id,
      points: data.data.points,
      colors: data.data.colors,
      pointCount: data.data.pointCount || data.data.points.length,
      phase: data.data.phase,
      captureTime: data.data.captureTime || new Date().toISOString(),
    };
  } catch {
    const phases: Array<'baseline' | 'phase1' | 'phase2'> = ['baseline', 'phase1', 'phase2'];
    const phase = phases[Math.floor(Math.random() * phases.length)];
    
    let points: Point3D[];
    
    if (phase === 'baseline') {
      points = generateSyntheticPointCloud(100, 3, 2.5, 5000);
    } else if (phase === 'phase1') {
      const base = generateSyntheticPointCloud(100, 3, 2.5, 5000);
      points = generateDeformedPointCloud(base, 0.008, 0.004);
    } else {
      const base = generateSyntheticPointCloud(100, 3, 2.5, 5000);
      points = generateDeformedPointCloud(base, 0.015, 0.008);
    }
    
    return {
      id,
      points,
      pointCount: points.length,
      phase,
      captureTime: new Date().toISOString(),
    };
  }
}

export async function loadPointCloudsByPhase(
  bimModelId: string,
  phase: 'baseline' | 'phase1' | 'phase2'
): Promise<PointCloudData[]> {
  try {
    const clouds = await fetchPointClouds(bimModelId);
    const filtered = clouds.filter((c) => c.phase === phase);
    const results: PointCloudData[] = [];
    
    for (const cloud of filtered) {
      const data = await loadPointCloudData(cloud.id);
      if (data) {
        results.push(data);
      }
    }
    
    return results;
  } catch {
    return [];
  }
}
