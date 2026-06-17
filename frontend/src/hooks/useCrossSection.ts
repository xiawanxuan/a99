import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store';
import { analyzeCrossSection, computeDeviations, fitEllipse } from '../utils/pointCloud';
import { generateCompleteMockDataset } from '../services/mock';
import type { CrossSectionData, DeformationResult, Point3D, EllipseParams, AlertData } from '../types';

export function useCrossSection() {
  const {
    crossSections,
    deformationResults,
    scene,
    pointClouds,
    addCrossSection,
    setCrossSections,
    addDeformationResult,
    addAlert,
    setCurrentDeformationResult,
    setDeviationStats,
    setLoading,
    setError,
  } = useAppStore();

  const currentCrossSection = useMemo(() => {
    if (!scene.currentCrossSectionId) return null;
    return crossSections.find((cs) => cs.id === scene.currentCrossSectionId) || null;
  }, [crossSections, scene.currentCrossSectionId]);

  const latestDeformation = useMemo(() => {
    if (!scene.currentCrossSectionId) return null;
    const results = deformationResults.filter(
      (dr) => dr.crossSectionId === scene.currentCrossSectionId
    );
    return results.length > 0 ? results[results.length - 1] : null;
  }, [deformationResults, scene.currentCrossSectionId]);

  const loadCrossSections = useCallback(
    async (bimModelId: string) => {
      setLoading('crossSection', bimModelId, true);
      setError(`crossSection_${bimModelId}`, null);
      
      try {
        const mockData = generateCompleteMockDataset(100, 10);
        setCrossSections(mockData.crossSections);
        mockData.deformationResults.forEach(dr => addDeformationResult(dr));
      } catch (error) {
        setError(`crossSection_${bimModelId}`, error instanceof Error ? error.message : 'Failed to load cross sections');
      } finally {
        setLoading('crossSection', bimModelId, false);
      }
    },
    [setCrossSections, addDeformationResult, setLoading, setError]
  );

  const performCrossSectionAnalysis = useCallback(
    async (
      points: Point3D[],
      position: number,
      thickness: number = 0.05,
      baselineEllipse?: EllipseParams
    ): Promise<{ section: CrossSectionData; deformation: DeformationResult } | null> => {
      const sectionId = `section_${position}_${Date.now()}`;
      setLoading('crossSection', sectionId, true);
      setError(`crossSection_${sectionId}`, null);

      try {
        const analysisResult = analyzeCrossSection(points, position, thickness);
        
        const section: CrossSectionData = {
          id: sectionId,
          position,
          points: analysisResult.indices.map(i => points[i]),
          projectedPoints: analysisResult.projectedPoints,
          baselineEllipse: baselineEllipse || analysisResult.ellipseParams || {
            cx: 0, cy: 0, a: 1.5, b: 1.25, rotation: 0
          },
          baselineWidth: (baselineEllipse?.a || 1.5) * 2,
          baselineHeight: (baselineEllipse?.b || 1.25) * 2,
        };

        addCrossSection(section);

        let deformation: DeformationResult | null = null;
        if (analysisResult.ellipseParams && section.baselineEllipse) {
          const deviationResult = computeDeviations(
            analysisResult.projectedPoints,
            section.baselineEllipse,
            scene.deviationRange
          );

          const widthChange = (analysisResult.ellipseParams.a - section.baselineEllipse.a) * 2000;
          const settlement = (analysisResult.ellipseParams.cy - section.baselineEllipse.cy) * 1000;

          deformation = {
            id: `deformation_${sectionId}`,
            crossSectionId: sectionId,
            pointCloudId: scene.currentPointCloudId || '',
            convergence: widthChange,
            settlement,
            maxDeviation: deviationResult.stats.max,
            avgDeviation: deviationResult.stats.mean,
            ellipseParams: analysisResult.ellipseParams,
            deviationStats: deviationResult.stats,
            pointDeviations: deviationResult.deviations,
            pointColors: Array.from({ length: deviationResult.colors.length / 3 }, (_, i) => [
              deviationResult.colors[i * 3],
              deviationResult.colors[i * 3 + 1],
              deviationResult.colors[i * 3 + 2],
            ]),
            measuredAt: new Date().toISOString(),
          };

          addDeformationResult(deformation);
          setCurrentDeformationResult(deformation);
          setDeviationStats(deviationResult.stats);

          if (deviationResult.stats.max > scene.alertThresholds.maxDeviationWarning) {
            const alert: AlertData = {
              id: `alert_${sectionId}_${Date.now()}`,
              measurement_id: deformation.id,
              level: deviationResult.stats.max > scene.alertThresholds.maxDeviationDanger ? 'danger' : 'warning',
              message: `截面位置 ${position.toFixed(2)}m 处形变超限，最大偏差 ${deviationResult.stats.max.toFixed(2)}mm`,
              threshold: scene.alertThresholds.maxDeviationWarning,
              actual_value: deviationResult.stats.max,
              acknowledged: false,
              created_at: new Date().toISOString(),
              cross_section_position: position,
              point_cloud_phase: scene.currentPhase,
            };
            addAlert(alert);
          }
        }

        return deformation ? { section, deformation } : null;
      } catch (error) {
        setError(`crossSection_${sectionId}`, error instanceof Error ? error.message : 'Failed to analyze cross section');
        return null;
      } finally {
        setLoading('crossSection', sectionId, false);
      }
    },
    [addCrossSection, addDeformationResult, addAlert, setCurrentDeformationResult, setDeviationStats, setLoading, setError, scene]
  );

  const fitSectionEllipse = useCallback(
    (points: Point3D[], position: number, thickness: number = 0.05): EllipseParams | null => {
      const analysisResult = analyzeCrossSection(points, position, thickness);
      return analysisResult.ellipseParams;
    },
    []
  );

  return {
    crossSections,
    currentCrossSection,
    latestDeformation,
    loadCrossSections,
    performCrossSectionAnalysis,
    fitSectionEllipse,
  };
}
