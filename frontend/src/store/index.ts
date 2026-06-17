import { create } from 'zustand';
import {
  PointCloudData,
  CrossSectionData,
  DeformationResult,
  AlertData,
  SceneState,
  Point3D,
  DisplayControls,
  AlertThresholds,
  TimelineState,
  DeviationStats,
  PointCloudPhase,
  TrendForecastData,
  TrendForecastState,
} from '../types';

interface LoadingState {
  pointCloud: Record<string, boolean>;
  crossSection: Record<string, boolean>;
  deformation: Record<string, boolean>;
  alerts: boolean;
}

interface AppState {
  pointClouds: PointCloudData[];
  crossSections: CrossSectionData[];
  deformationResults: DeformationResult[];
  alerts: AlertData[];
  unacknowledgedAlertCount: number;
  scene: SceneState;
  loading: LoadingState;
  errors: Record<string, string | null>;
  currentDeformationResult: DeformationResult | null;
  deviationStats: DeviationStats | null;
  trendForecast: TrendForecastState;
}

interface AppActions {
  addPointCloud: (pc: PointCloudData) => void;
  removePointCloud: (id: string) => void;
  setPointClouds: (pcs: PointCloudData[]) => void;
  addCrossSection: (cs: CrossSectionData) => void;
  removeCrossSection: (id: string) => void;
  setCrossSections: (css: CrossSectionData[]) => void;
  addDeformationResult: (dr: DeformationResult) => void;
  setDeformationResults: (drs: DeformationResult[]) => void;
  setCurrentDeformationResult: (result: DeformationResult | null) => void;
  setDeviationStats: (stats: DeviationStats | null) => void;
  setTrendForecastData: (data: TrendForecastData | null) => void;
  setTrendForecastLoading: (loading: boolean) => void;
  setTrendForecastError: (error: string | null) => void;
  setForecastMonths: (months: number) => void;
  setConfidenceLevel: (level: number) => void;
  setShowForecast: (show: boolean) => void;
  setSelectedMetric: (metric: 'both' | 'settlement' | 'convergence') => void;
  addAlert: (alert: AlertData) => void;
  removeAlert: (alertId: string) => void;
  acknowledgeAlert: (id: string) => void;
  acknowledgeAllAlerts: () => void;
  setAlerts: (alerts: AlertData[]) => void;
  setScene: (scene: Partial<SceneState>) => void;
  setCurrentPhase: (phase: PointCloudPhase) => void;
  setCuttingPlanePosition: (position: number) => void;
  setCuttingPlaneThickness: (thickness: number) => void;
  setCuttingPlaneNormal: (normal: Point3D) => void;
  setDisplayControls: (controls: Partial<DisplayControls>) => void;
  toggleDisplayControl: (key: keyof DisplayControls) => void;
  setAlertThresholds: (thresholds: Partial<AlertThresholds>) => void;
  setTimelinePlaying: (isPlaying: boolean) => void;
  setCurrentTimeIndex: (index: number) => void;
  setPlaySpeed: (speed: number) => void;
  setTimePoints: (points: string[]) => void;
  nextTimePoint: () => void;
  prevTimePoint: () => void;
  setDeviationRange: (range: [number, number]) => void;
  setCurrentBimModelId: (id: string | null) => void;
  setCurrentPointCloudId: (id: string | null) => void;
  setCurrentCrossSectionId: (id: string | null) => void;
  setLoading: (key: keyof LoadingState, id: string, value: boolean) => void;
  setLoadingState: (state: Partial<LoadingState>) => void;
  setError: (key: string, error: string | null) => void;
  resetScene: () => void;
}

const defaultAlertThresholds: AlertThresholds = {
  convergenceWarning: 10,
  convergenceDanger: 20,
  settlementWarning: 15,
  settlementDanger: 30,
  maxDeviationWarning: 10,
  maxDeviationDanger: 20,
};

const defaultTimelineState: TimelineState = {
  isPlaying: false,
  currentTimeIndex: 0,
  timePoints: [],
  playSpeed: 1,
};

const defaultDisplayControls: DisplayControls = {
  showBimModel: true,
  showPointCloud: true,
  showChroma: true,
  showCuttingPlane: true,
};

const initialSceneState: SceneState = {
  currentPhase: 'baseline',
  cuttingPlanePosition: 50,
  cuttingPlaneThickness: 0.5,
  cuttingPlaneNormal: { x: 1, y: 0, z: 0 },
  displayControls: defaultDisplayControls,
  alertThresholds: defaultAlertThresholds,
  timeline: defaultTimelineState,
  deviationRange: [-20, 20],
  currentBimModelId: null,
  currentPointCloudId: null,
  currentCrossSectionId: null,
  showPointCloud: true,
  showBimModel: true,
  showCrossSection: true,
  showChromaLayer: false,
  isPlaying: false,
  currentTimeIndex: 0,
  timeRange: ['2024-01-01', '2024-12-31'],
  cameraPosition: { x: 0, y: -100, z: 50 },
  cameraTarget: { x: 0, y: 0, z: 0 },
};

const initialLoadingState: LoadingState = {
  pointCloud: {},
  crossSection: {},
  deformation: {},
  alerts: false,
};

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  pointClouds: [],
  crossSections: [],
  deformationResults: [],
  alerts: [],
  unacknowledgedAlertCount: 0,
  scene: initialSceneState,
  loading: initialLoadingState,
  errors: {},
  currentDeformationResult: null,
  deviationStats: null,
  trendForecast: {
    data: null,
    loading: false,
    error: null,
    forecastMonths: 3,
    confidenceLevel: 0.95,
    showForecast: true,
    selectedMetric: 'both',
  },

  addPointCloud: (pc) =>
    set((state) => ({
      pointClouds: [...state.pointClouds, pc],
    })),

  removePointCloud: (id) =>
    set((state) => ({
      pointClouds: state.pointClouds.filter((pc) => pc.id !== id),
    })),

  setPointClouds: (pcs) => set({ pointClouds: pcs }),

  addCrossSection: (cs) =>
    set((state) => ({
      crossSections: [...state.crossSections, cs],
    })),

  removeCrossSection: (id) =>
    set((state) => ({
      crossSections: state.crossSections.filter((cs) => cs.id !== id),
    })),

  setCrossSections: (css) => set({ crossSections: css }),

  addDeformationResult: (dr) =>
    set((state) => ({
      deformationResults: [...state.deformationResults, dr],
    })),

  setDeformationResults: (drs) => set({ deformationResults: drs }),

  setCurrentDeformationResult: (result) =>
    set({ currentDeformationResult: result }),

  setDeviationStats: (stats) => set({ deviationStats: stats }),

  setTrendForecastData: (data) =>
    set((state) => ({
      trendForecast: { ...state.trendForecast, data, loading: false, error: null },
    })),

  setTrendForecastLoading: (loading) =>
    set((state) => ({
      trendForecast: { ...state.trendForecast, loading },
    })),

  setTrendForecastError: (error) =>
    set((state) => ({
      trendForecast: { ...state.trendForecast, error, loading: false },
    })),

  setForecastMonths: (months) =>
    set((state) => ({
      trendForecast: { ...state.trendForecast, forecastMonths: months },
    })),

  setConfidenceLevel: (level) =>
    set((state) => ({
      trendForecast: { ...state.trendForecast, confidenceLevel: level },
    })),

  setShowForecast: (show) =>
    set((state) => ({
      trendForecast: { ...state.trendForecast, showForecast: show },
    })),

  setSelectedMetric: (metric) =>
    set((state) => ({
      trendForecast: { ...state.trendForecast, selectedMetric: metric },
    })),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts],
      unacknowledgedAlertCount: state.unacknowledgedAlertCount + 1,
    })),

  removeAlert: (alertId) =>
    set((state) => {
      const alert = state.alerts.find((a) => a.id === alertId);
      const wasUnacknowledged = alert && !alert.acknowledged;
      return {
        alerts: state.alerts.filter((a) => a.id !== alertId),
        unacknowledgedAlertCount: wasUnacknowledged
          ? state.unacknowledgedAlertCount - 1
          : state.unacknowledgedAlertCount,
      };
    }),

  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a
      ),
      unacknowledgedAlertCount: state.unacknowledgedAlertCount - 1,
    })),

  acknowledgeAllAlerts: () =>
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, acknowledged: true })),
      unacknowledgedAlertCount: 0,
    })),

  setAlerts: (alerts) =>
    set({
      alerts,
      unacknowledgedAlertCount: alerts.filter((a) => !a.acknowledged).length,
    }),

  setScene: (scene) =>
    set((state) => ({
      scene: { ...state.scene, ...scene },
    })),

  setCurrentPhase: (phase) => set((state) => ({
    scene: { ...state.scene, currentPhase: phase },
  })),

  setCuttingPlanePosition: (position) => set((state) => ({
    scene: { ...state.scene, cuttingPlanePosition: position },
  })),

  setCuttingPlaneThickness: (thickness) => set((state) => ({
    scene: { ...state.scene, cuttingPlaneThickness: thickness },
  })),

  setCuttingPlaneNormal: (normal) => set((state) => ({
    scene: { ...state.scene, cuttingPlaneNormal: normal },
  })),

  setDisplayControls: (controls) =>
    set((state) => ({
      scene: {
        ...state.scene,
        displayControls: { ...state.scene.displayControls, ...controls },
      },
    })),

  toggleDisplayControl: (key) =>
    set((state) => ({
      scene: {
        ...state.scene,
        displayControls: {
          ...state.scene.displayControls,
          [key]: !state.scene.displayControls[key],
        },
      },
    })),

  setAlertThresholds: (thresholds) =>
    set((state) => ({
      scene: {
        ...state.scene,
        alertThresholds: { ...state.scene.alertThresholds, ...thresholds },
      },
    })),

  setTimelinePlaying: (isPlaying) =>
    set((state) => ({
      scene: {
        ...state.scene,
        timeline: { ...state.scene.timeline, isPlaying },
      },
    })),

  setCurrentTimeIndex: (index) =>
    set((state) => ({
      scene: {
        ...state.scene,
        timeline: { ...state.scene.timeline, currentTimeIndex: index },
      },
    })),

  setPlaySpeed: (speed) =>
    set((state) => ({
      scene: {
        ...state.scene,
        timeline: { ...state.scene.timeline, playSpeed: speed },
      },
    })),

  setTimePoints: (timePoints) =>
    set((state) => ({
      scene: {
        ...state.scene,
        timeline: { ...state.scene.timeline, timePoints },
      },
    })),

  nextTimePoint: () =>
    set((state) => {
      const nextIndex = Math.min(
        state.scene.timeline.currentTimeIndex + 1,
        state.scene.timeline.timePoints.length - 1
      );
      return {
        scene: {
          ...state.scene,
          timeline: { ...state.scene.timeline, currentTimeIndex: nextIndex },
        },
      };
    }),

  prevTimePoint: () =>
    set((state) => {
      const prevIndex = Math.max(state.scene.timeline.currentTimeIndex - 1, 0);
      return {
        scene: {
          ...state.scene,
          timeline: { ...state.scene.timeline, currentTimeIndex: prevIndex },
        },
      };
    }),

  setDeviationRange: (range) => set((state) => ({
    scene: { ...state.scene, deviationRange: range },
  })),

  setCurrentBimModelId: (id) => set((state) => ({
    scene: { ...state.scene, currentBimModelId: id },
  })),

  setCurrentPointCloudId: (id) => set((state) => ({
    scene: { ...state.scene, currentPointCloudId: id },
  })),

  setCurrentCrossSectionId: (id) => set((state) => ({
    scene: { ...state.scene, currentCrossSectionId: id },
  })),

  setLoading: (key, id, value) =>
    set((state) => {
      if (key === 'alerts') {
        return {
          loading: {
            ...state.loading,
            alerts: value,
          },
        };
      }
      return {
        loading: {
          ...state.loading,
          [key]: {
            ...(state.loading[key] as Record<string, boolean>),
            [id]: value,
          },
        },
      };
    }),

  setLoadingState: (loadingState) =>
    set((state) => ({
      loading: { ...state.loading, ...loadingState },
    })),

  setError: (key, error) =>
    set((state) => ({
      errors: { ...state.errors, [key]: error },
    })),

  resetScene: () => set({
    scene: initialSceneState,
    currentDeformationResult: null,
    deviationStats: null,
  }),
}));

export { useSceneStore } from './useSceneStore';
