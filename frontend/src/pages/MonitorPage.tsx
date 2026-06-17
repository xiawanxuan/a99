import { useEffect, useMemo, useCallback, useState } from 'react';
import { useAppStore } from '../store';
import { SceneRenderer } from '../components/three/SceneRenderer';
import { ControlPanel } from '../components/ui/ControlPanel';
import { AnalysisPanel } from '../components/ui/AnalysisPanel';
import { Timeline } from '../components/ui/Timeline';
import { AlertModal } from '../components/ui/AlertModal';
import { generateCompleteMockDataset, generateAllPointClouds, generateCrossSections, generateAllDeformationResults, generateAlerts } from '../services/mock';
import { analyzeCrossSection, computeDeviations, fitEllipse } from '../utils/pointCloud';
import { PHASE_NAMES, type PointCloudPhase, type Point3D, type AlertData, type DeformationMeasurement, type EllipseParams, type DeviationStats, type PointCloudData } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAnimation } from '../hooks/useAnimation';

const PHASES: PointCloudPhase[] = ['baseline', 'phase1', 'phase2'];

export default function MonitorPage() {
  const {
    scene,
    pointClouds,
    crossSections,
    deformationResults,
    alerts,
    currentDeformationResult,
    deviationStats,
    setPointClouds,
    setCrossSections,
    setDeformationResults,
    setAlerts,
    setCurrentDeformationResult,
    setDeviationStats,
    setCurrentPhase,
    setCuttingPlanePosition,
    setCuttingPlaneThickness,
    setDeviationRange,
    setAlertThresholds,
    setDisplayControls,
    setTimelinePlaying,
    setCurrentTimeIndex,
    setPlaySpeed,
    setTimePoints,
    addAlert,
    acknowledgeAlert,
  } = useAppStore();

  const [activeAlert, setActiveAlert] = useState<AlertData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const mockData = useMemo(() => generateCompleteMockDataset(100, 10), []);

  useEffect(() => {
    if (!isInitialized) {
      const pointClouds = generateAllPointClouds(100, 3, 2.5);
      const crossSections = generateCrossSections(100, 10, 6, 5);
      const deformationResults = generateAllDeformationResults(crossSections, pointClouds);
      const alerts = generateAlerts(deformationResults, crossSections);
      const timePoints = pointClouds.map(pc => pc.captureTime);

      setPointClouds(pointClouds);
      setCrossSections(crossSections);
      setDeformationResults(deformationResults);
      setAlerts(alerts);
      setTimePoints(timePoints);
      setIsInitialized(true);
    }
  }, [isInitialized, setPointClouds, setCrossSections, setDeformationResults, setAlerts, setTimePoints]);

  const { sendJson } = useWebSocket('ws://localhost:8080/ws/alerts', {
    autoConnect: false,
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'alert') {
          const alertMessage = data.payload;
          const alert: AlertData = {
            id: alertMessage.alert_id,
            measurement_id: alertMessage.measurement_id,
            level: alertMessage.level,
            message: alertMessage.message,
            threshold: alertMessage.threshold,
            actual_value: alertMessage.actual_value,
            acknowledged: false,
            created_at: new Date().toISOString(),
            cross_section_position: alertMessage.cross_section_position,
            point_cloud_phase: alertMessage.point_cloud_phase,
          };
          addAlert(alert);
          setActiveAlert(alert);
        }
      } catch {
        // ignore
      }
    },
  });

  const currentPhaseIndex = useMemo(() => {
    return PHASES.indexOf(scene.currentPhase);
  }, [scene.currentPhase]);

  const currentPointCloud = useMemo(() => {
    return pointClouds.find(pc => pc.phase === scene.currentPhase) || null;
  }, [pointClouds, scene.currentPhase]);

  const currentCrossSection = useMemo(() => {
    return crossSections[0] || null;
  }, [crossSections]);

  const {
    currentTimeIndex: currentFrame,
    isPlaying: timelineIsPlaying,
    play,
    pause,
    togglePlay: toggle,
    seekTo: seek,
    nextFrame: next,
    prevFrame: prev,
  } = useAnimation({
    defaultFrameRate: scene.timeline.playSpeed,
  });

  useEffect(() => {
    if (timelineIsPlaying !== scene.timeline.isPlaying) {
      if (scene.timeline.isPlaying) {
        play();
      } else {
        pause();
      }
    }
  }, [scene.timeline.isPlaying, timelineIsPlaying, play, pause]);

  useEffect(() => {
    if (currentFrame !== scene.timeline.currentTimeIndex) {
      setCurrentPhase(PHASES[currentFrame]);
      setCurrentTimeIndex(currentFrame);
    }
  }, [currentFrame, scene.timeline.currentTimeIndex, setCurrentPhase, setCurrentTimeIndex]);

  const sectionAnalysis = useMemo(() => {
    if (!currentPointCloud || !currentCrossSection) return null;

    const points = currentPointCloud.points as Point3D[];
    const result = analyzeCrossSection(
      points,
      scene.cuttingPlanePosition,
      scene.cuttingPlaneThickness
    );

    return result;
  }, [currentPointCloud, currentCrossSection, scene.cuttingPlanePosition, scene.cuttingPlaneThickness]);

  const sectionPoints = useMemo(() => {
    return sectionAnalysis?.projectedPoints || [];
  }, [sectionAnalysis]);

  const ellipseParams = useMemo(() => {
    if (!sectionAnalysis || sectionAnalysis.projectedPoints.length < 5) return null;
    return fitEllipse(sectionAnalysis.projectedPoints);
  }, [sectionAnalysis]);

  const deviations = useMemo(() => {
    if (!sectionAnalysis || !currentCrossSection) return [];
    
    const result = computeDeviations(
      sectionAnalysis.projectedPoints,
      currentCrossSection.baselineEllipse,
      scene.deviationRange
    );
    
    return result.deviations;
  }, [sectionAnalysis, currentCrossSection, scene.deviationRange]);

  const measurement = useMemo((): DeformationMeasurement | null => {
    if (!sectionAnalysis || !ellipseParams || !currentCrossSection) return null;

    const stats: DeviationStats = {
      min: Math.min(...deviations),
      max: Math.max(...deviations),
      mean: deviations.reduce((a, b) => a + b, 0) / deviations.length,
      std: Math.sqrt(deviations.reduce((a, b) => a + Math.pow(b - (deviations.reduce((c, d) => c + d, 0) / deviations.length), 2), 0) / deviations.length),
      histogram: [],
    };

    return {
      id: `measurement-${Date.now()}`,
      cross_section_id: currentCrossSection.id,
      point_cloud_id: currentPointCloud?.id || '',
      convergence: (currentCrossSection.baselineWidth - ellipseParams.a * 2) * 1000,
      settlement: (currentCrossSection.baselineHeight - ellipseParams.b * 2) * 1000,
      max_deviation: stats.max,
      avg_deviation: stats.mean,
      ellipse_params: ellipseParams,
      deviation_stats: stats,
      measured_at: new Date().toISOString(),
    };
  }, [sectionAnalysis, ellipseParams, currentCrossSection, deviations, currentPointCloud]);

  useEffect(() => {
    if (measurement) {
      setCurrentDeformationResult({
        id: measurement.id,
        crossSectionId: measurement.cross_section_id,
        pointCloudId: measurement.point_cloud_id,
        convergence: measurement.convergence,
        settlement: measurement.settlement,
        maxDeviation: measurement.max_deviation,
        avgDeviation: measurement.avg_deviation,
        ellipseParams: measurement.ellipse_params,
        deviationStats: measurement.deviation_stats,
        pointDeviations: deviations,
        pointColors: [],
        measuredAt: measurement.measured_at,
      });
      setDeviationStats(measurement.deviation_stats);

      if (Math.abs(measurement.max_deviation) > scene.alertThresholds.maxDeviationWarning && !activeAlert) {
        const alert: AlertData = {
          id: `alert-${Date.now()}`,
          measurement_id: measurement.id,
          level: Math.abs(measurement.max_deviation) > scene.alertThresholds.maxDeviationDanger ? 'danger' : 'warning',
          message: `截面位置 ${scene.cuttingPlanePosition.toFixed(1)}m 处最大偏差 ${measurement.max_deviation.toFixed(2)}mm，超过安全阈值`,
          threshold: scene.alertThresholds.maxDeviationWarning,
          actual_value: Math.abs(measurement.max_deviation),
          acknowledged: false,
          created_at: new Date().toISOString(),
          cross_section_position: scene.cuttingPlanePosition,
          point_cloud_phase: scene.currentPhase,
        };
        addAlert(alert);
        setActiveAlert(alert);
      }
    }
  }, [measurement, deviations, scene.cuttingPlanePosition, scene.alertThresholds, scene.currentPhase, addAlert, activeAlert, setCurrentDeformationResult, setDeviationStats]);

  const handlePhaseChange = useCallback((phase: PointCloudPhase) => {
    setCurrentPhase(phase);
    seek(PHASES.indexOf(phase));
  }, [setCurrentPhase, seek]);

  const handleCuttingPlaneChange = useCallback((position: number) => {
    setCuttingPlanePosition(position);
  }, [setCuttingPlanePosition]);

  const handleThicknessChange = useCallback((thickness: number) => {
    setCuttingPlaneThickness(thickness);
  }, [setCuttingPlaneThickness]);

  const handleDeviationRangeChange = useCallback((range: [number, number]) => {
    setDeviationRange(range);
  }, [setDeviationRange]);

  const handleThresholdChange = useCallback((thresholds: Partial<typeof scene.alertThresholds>) => {
    setAlertThresholds(thresholds);
  }, [setAlertThresholds]);

  const handleDisplayControlChange = useCallback((controls: Partial<typeof scene.displayControls>) => {
    setDisplayControls(controls);
  }, [setDisplayControls]);

  const handleTimelinePlay = useCallback(() => {
    setTimelinePlaying(true);
  }, [setTimelinePlaying]);

  const handleTimelinePause = useCallback(() => {
    setTimelinePlaying(false);
  }, [setTimelinePlaying]);

  const handleTimelineSeek = useCallback((index: number) => {
    seek(index);
    setCurrentPhase(PHASES[index]);
  }, [seek, setCurrentPhase]);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaySpeed(speed);
  }, [setPlaySpeed]);

  const handleAcknowledgeAlert = useCallback((alertId: string) => {
    acknowledgeAlert(alertId);
    if (activeAlert?.id === alertId) {
      setActiveAlert(null);
    }
  }, [acknowledgeAlert, activeAlert]);

  const handleAlertClose = useCallback(() => {
    setActiveAlert(null);
  }, []);

  const handleRefreshAnalysis = useCallback(() => {
    if (currentPointCloud && currentCrossSection) {
      const result = analyzeCrossSection(
        currentPointCloud.points as Point3D[],
        scene.cuttingPlanePosition,
        scene.cuttingPlaneThickness
      );
      if (result.projectedPoints.length >= 5) {
        const ellipse = fitEllipse(result.projectedPoints);
        const devResult = computeDeviations(
          result.projectedPoints,
          currentCrossSection.baselineEllipse,
          scene.deviationRange
        );
        setDeviationStats(devResult.stats);
      }
    }
  }, [currentPointCloud, currentCrossSection, scene.cuttingPlanePosition, scene.cuttingPlaneThickness, scene.deviationRange, setDeviationStats]);

  const handleExportData = useCallback(() => {
    if (measurement) {
      const dataStr = JSON.stringify(measurement, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deformation-measurement-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [measurement]);

  const unacknowledgedAlerts = useMemo(() => {
    return alerts.filter(a => !a.acknowledged);
  }, [alerts]);

  useEffect(() => {
    if (unacknowledgedAlerts.length > 0 && !activeAlert) {
      setActiveAlert(unacknowledgedAlerts[0]);
    }
  }, [unacknowledgedAlerts, activeAlert]);

  const pointCloudsRecord = useMemo((): Record<PointCloudPhase, Point3D[]> => {
    const record: Record<PointCloudPhase, Point3D[]> = {
      baseline: [],
      phase1: [],
      phase2: [],
    };
    pointClouds.forEach(pc => {
      record[pc.phase] = pc.points;
    });
    return record;
  }, [pointClouds]);

  const sectionIndices = useMemo(() => {
    return sectionAnalysis?.indices || [];
  }, [sectionAnalysis]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900/80 backdrop-blur-md border-b border-cyan-500/30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-mono">城市地下综合管廊形变监测系统</h1>
            <p className="text-xs text-gray-400 font-mono">3D Point Cloud Deformation Monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">当前期次:</span>
            <span className="text-sm font-bold text-cyan-400 font-mono">
              {PHASE_NAMES[scene.currentPhase]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">点云数量:</span>
            <span className="text-sm font-bold text-green-400 font-mono">
              {currentPointCloud?.pointCount?.toLocaleString() || '0'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${unacknowledgedAlerts.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-xs text-gray-400 font-mono">
              {unacknowledgedAlerts.length > 0 ? `${unacknowledgedAlerts.length} 条告警` : '系统正常'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <ControlPanel
          phases={PHASES}
          currentPhase={scene.currentPhase}
          onPhaseChange={handlePhaseChange}
          displayControls={scene.displayControls}
          onDisplayControlChange={handleDisplayControlChange}
          cuttingPlanePosition={scene.cuttingPlanePosition}
          onCuttingPlanePositionChange={handleCuttingPlaneChange}
          cuttingPlaneThickness={scene.cuttingPlaneThickness}
          onCuttingPlaneThicknessChange={handleThicknessChange}
          deviationRange={scene.deviationRange}
          onDeviationRangeChange={handleDeviationRangeChange}
          alertThresholds={scene.alertThresholds}
          onAlertThresholdChange={handleThresholdChange}
          pointCount={currentPointCloud?.pointCount || 0}
        />

        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 relative">
            <SceneRenderer
              bimModel={null}
              pointClouds={pointCloudsRecord}
              currentPhase={scene.currentPhase}
              showBimModel={scene.displayControls.showBimModel}
              showPointCloud={scene.displayControls.showPointCloud}
              showChroma={scene.displayControls.showChroma}
              showCuttingPlane={scene.displayControls.showCuttingPlane}
              cuttingPlanePosition={scene.cuttingPlanePosition}
              cuttingPlaneThickness={scene.cuttingPlaneThickness}
              deviations={deviations}
              deviationRange={scene.deviationRange}
              sectionIndices={sectionIndices}
              baselineEllipse={currentCrossSection?.baselineEllipse || null}
              onCuttingPlaneChange={handleCuttingPlaneChange}
            />
          </div>

          <div className="absolute bottom-4 left-4 right-4 z-10">
            <Timeline
              phases={PHASES}
              currentIndex={currentPhaseIndex}
              isPlaying={timelineIsPlaying}
              playSpeed={scene.timeline.playSpeed}
              onPlay={handleTimelinePlay}
              onPause={handleTimelinePause}
              onNext={next}
              onPrev={prev}
              onSeek={handleTimelineSeek}
              onSpeedChange={handleSpeedChange}
            />
          </div>
        </div>

        <AnalysisPanel
          sectionPoints={sectionPoints}
          ellipseParams={ellipseParams as EllipseParams | null}
          baselineEllipse={currentCrossSection?.baselineEllipse || null}
          deviations={deviations}
          deviationStats={deviationStats}
          measurement={measurement}
          alerts={alerts}
          deviationRange={scene.deviationRange}
          onRefresh={handleRefreshAnalysis}
          onExport={handleExportData}
          onAcknowledgeAlert={handleAcknowledgeAlert}
        />
      </div>

      <AlertModal
        alert={activeAlert}
        onClose={handleAlertClose}
        onAcknowledge={handleAcknowledgeAlert}
      />
    </div>
  );
}
