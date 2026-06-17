import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store';
import { generateSyntheticPointCloud, generateDeformedPointCloud, calculateCylinderDeviations } from '../utils/pointCloud';
import type { PointCloudData, Point3D, EllipseParams } from '../types';

export function usePointCloud() {
  const {
    pointClouds,
    scene,
    addPointCloud,
    setPointClouds,
    setLoading,
    setError,
    setScene,
  } = useAppStore();

  const currentPointCloud = useMemo(() => {
    if (!scene.currentPointCloudId) return null;
    return pointClouds.find((pc) => pc.id === scene.currentPointCloudId) || null;
  }, [pointClouds, scene.currentPointCloudId]);

  const pointCloudsByPhase = useMemo(() => {
    const grouped: Record<string, PointCloudData[]> = {
      baseline: [],
      phase1: [],
      phase2: [],
    };
    for (const pc of pointClouds) {
      if (!grouped[pc.phase]) {
        grouped[pc.phase] = [];
      }
      grouped[pc.phase].push(pc);
    }
    return grouped;
  }, [pointClouds]);

  const loadPointCloud = useCallback(
    async (id: string) => {
      setLoading('pointCloud', id, true);
      setError(`pointCloud_${id}`, null);
      try {
        setScene({ currentPointCloudId: id });
      } catch (error) {
        setError(`pointCloud_${id}`, error instanceof Error ? error.message : 'Failed to load point cloud');
      } finally {
        setLoading('pointCloud', id, false);
      }
    },
    [setScene, setLoading, setError]
  );

  const loadPointCloudsByPhase = useCallback(
    async (phase: string) => {
      const phaseId = `load_${phase}`;
      setLoading('pointCloud', phaseId, true);
      setError(`pointCloud_${phaseId}`, null);
      
      try {
        const basePoints = generateSyntheticPointCloud(100, 3, 2.5, 5000);
        let points: Point3D[];
        let colors: number[][] | undefined;
        
        if (phase === 'baseline') {
          points = basePoints;
        } else if (phase === 'phase1') {
          points = generateDeformedPointCloud(basePoints, 0.008, 0.004);
        } else {
          points = generateDeformedPointCloud(basePoints, 0.015, 0.008);
        }

        const baselineEllipse: EllipseParams = { cx: 0, cy: 0, a: 1.5, b: 1.25, rotation: 0 };
        const deviationResult = calculateCylinderDeviations(points, baselineEllipse, scene.deviationRange);
        colors = deviationResult.colors;

        const pointCloud: PointCloudData = {
          id: `${phase}_${Date.now()}`,
          points,
          colors,
          pointCount: points.length,
          phase: phase as 'baseline' | 'phase1' | 'phase2',
          captureTime: new Date().toISOString(),
        };

        addPointCloud(pointCloud);
        setScene({ currentPointCloudId: pointCloud.id, currentPhase: phase as 'baseline' | 'phase1' | 'phase2' });
        
        return pointCloud;
      } catch (error) {
        setError(`pointCloud_${phaseId}`, error instanceof Error ? error.message : 'Failed to load point clouds');
        return null;
      } finally {
        setLoading('pointCloud', phaseId, false);
      }
    },
    [addPointCloud, setScene, setLoading, setError, scene.deviationRange]
  );

  const loadAllPointClouds = useCallback(
    async () => {
      const phases = ['baseline', 'phase1', 'phase2'];
      const loadedClouds: PointCloudData[] = [];
      
      for (const phase of phases) {
        const cloud = await loadPointCloudsByPhase(phase);
        if (cloud) {
          loadedClouds.push(cloud);
        }
      }
      
      return loadedClouds;
    },
    [loadPointCloudsByPhase]
  );

  const switchPhase = useCallback(
    (phase: 'baseline' | 'phase1' | 'phase2') => {
      const phaseClouds = pointCloudsByPhase[phase];
      if (phaseClouds.length > 0) {
        setScene({
          currentPhase: phase,
          currentPointCloudId: phaseClouds[0].id,
        });
      }
    },
    [pointCloudsByPhase, setScene]
  );

  const getPointCloudByIndex = useCallback(
    (index: number): PointCloudData | null => {
      if (index >= 0 && index < pointClouds.length) {
        return pointClouds[index];
      }
      return null;
    },
    [pointClouds]
  );

  return {
    pointClouds,
    currentPointCloud,
    pointCloudsByPhase,
    loadPointCloud,
    loadPointCloudsByPhase,
    loadAllPointClouds,
    switchPhase,
    getPointCloudByIndex,
  };
}
