import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { calculateCylinderDeviations } from '../utils/pointCloud';
import type { PointCloudData, Point3D, EllipseParams } from '../types';

interface UseAnimationOptions {
  defaultFrameRate?: number;
  defaultTransitionDuration?: number;
}

interface UseAnimationReturn {
  isPlaying: boolean;
  currentTimeIndex: number;
  timeRange: [string, string];
  frameRate: number;
  transitionProgress: number;
  isTransitioning: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;
  nextFrame: () => void;
  prevFrame: () => void;
  seekTo: (index: number) => void;
  setTimeRange: (range: [string, string]) => void;
  setFrameRate: (fps: number) => void;
  interpolatePointClouds: (
    from: PointCloudData,
    to: PointCloudData,
    progress: number
  ) => PointCloudData;
  interpolatePoints: (
    from: Point3D[],
    to: Point3D[],
    progress: number
  ) => Point3D[];
  getAnimatedPointCloud: (
    from: PointCloudData,
    to: PointCloudData
  ) => PointCloudData;
  smoothTransition: (
    targetValue: number,
    duration?: number
  ) => Promise<number>;
}

export function useAnimation(
  options: UseAnimationOptions = {}
): UseAnimationReturn {
  const { scene, pointClouds, setScene } = useAppStore();
  const {
    defaultFrameRate = 2,
    defaultTransitionDuration = 500,
  } = options;

  const [frameRate, setFrameRate] = useState(defaultFrameRate);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const timeRange: [string, string] = useMemo(() => {
    if (pointClouds.length >= 2) {
      return [pointClouds[0].captureTime, pointClouds[pointClouds.length - 1].captureTime];
    }
    return [new Date().toISOString(), new Date().toISOString()];
  }, [pointClouds]);

  const play = useCallback(() => {
    setScene({ isPlaying: true });
  }, [setScene]);

  const pause = useCallback(() => {
    setScene({ isPlaying: false });
  }, [setScene]);

  const togglePlay = useCallback(() => {
    setScene({ isPlaying: !scene.isPlaying });
  }, [scene.isPlaying, setScene]);

  const stop = useCallback(() => {
    setScene({ isPlaying: false, currentTimeIndex: 0 });
  }, [setScene]);

  const nextFrame = useCallback(() => {
    const maxIndex = pointClouds.length - 1;
    const nextIndex = Math.min(scene.currentTimeIndex + 1, maxIndex);
    setScene({ currentTimeIndex: nextIndex });
  }, [scene.currentTimeIndex, pointClouds.length, setScene]);

  const prevFrame = useCallback(() => {
    const prevIndex = Math.max(scene.currentTimeIndex - 1, 0);
    setScene({ currentTimeIndex: prevIndex });
  }, [scene.currentTimeIndex, setScene]);

  const seekTo = useCallback((index: number) => {
    const maxIndex = pointClouds.length - 1;
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));
    setScene({ currentTimeIndex: clampedIndex });
  }, [pointClouds.length, setScene]);

  const setTimeRange = useCallback((range: [string, string]) => {
    setScene({ timeRange: range });
  }, [setScene]);

  const interpolatePoints = useCallback((
    from: Point3D[],
    to: Point3D[],
    progress: number
  ): Point3D[] => {
    const length = Math.min(from.length, to.length);
    const result: Point3D[] = new Array(length);
    
    for (let i = 0; i < length; i++) {
      result[i] = {
        x: from[i].x + (to[i].x - from[i].x) * progress,
        y: from[i].y + (to[i].y - from[i].y) * progress,
        z: from[i].z + (to[i].z - from[i].z) * progress,
      };
    }
    
    return result;
  }, []);

  const interpolatePointClouds = useCallback((
    from: PointCloudData,
    to: PointCloudData,
    progress: number
  ): PointCloudData => {
    const interpolatedPoints = interpolatePoints(from.points, to.points, progress);
    
    let colors: number[][] | undefined;
    if (from.colors && to.colors) {
      const fromColors = Array.isArray(from.colors) ? from.colors : [];
      const toColors = Array.isArray(to.colors) ? to.colors : [];
      const length = Math.min(fromColors.length, toColors.length);
      colors = new Array(length);
      for (let i = 0; i < length; i++) {
        colors[i] = [
          fromColors[i][0] + (toColors[i][0] - fromColors[i][0]) * progress,
          fromColors[i][1] + (toColors[i][1] - fromColors[i][1]) * progress,
          fromColors[i][2] + (toColors[i][2] - fromColors[i][2]) * progress,
        ];
      }
    }
    
    return {
      id: `interpolated_${from.id}_${to.id}_${progress}`,
      points: interpolatedPoints,
      colors,
      pointCount: interpolatedPoints.length,
      phase: progress < 0.5 ? from.phase : to.phase,
      captureTime: progress < 0.5 ? from.captureTime : to.captureTime,
    };
  }, [interpolatePoints]);

  const getAnimatedPointCloud = useCallback((
    from: PointCloudData,
    to: PointCloudData
  ): PointCloudData => {
    return interpolatePointClouds(from, to, transitionProgress);
  }, [interpolatePointClouds, transitionProgress]);

  const smoothTransition = useCallback((
    targetValue: number,
    duration: number = defaultTransitionDuration
  ): Promise<number> => {
    return new Promise((resolve) => {
      setIsTransitioning(true);
      const startTime = performance.now();
      const startValue = transitionProgress;
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const newValue = startValue + (targetValue - startValue) * easeProgress;
        
        setTransitionProgress(newValue);
        
        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setIsTransitioning(false);
          resolve(targetValue);
        }
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
    });
  }, [transitionProgress, defaultTransitionDuration]);

  useEffect(() => {
    if (!scene.isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      const frameInterval = 1000 / frameRate;
      
      if (deltaTime >= frameInterval) {
        lastTimeRef.current = currentTime;
        
        const maxIndex = Math.max(pointClouds.length - 1, 0);
        if (scene.currentTimeIndex >= maxIndex) {
          setScene({ currentTimeIndex: 0 });
        } else {
          nextFrame();
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [scene.isPlaying, frameRate, scene.currentTimeIndex, pointClouds.length, nextFrame, setScene]);

  return {
    isPlaying: scene.isPlaying,
    currentTimeIndex: scene.currentTimeIndex,
    timeRange,
    frameRate,
    transitionProgress,
    isTransitioning,
    play,
    pause,
    togglePlay,
    stop,
    nextFrame,
    prevFrame,
    seekTo,
    setTimeRange,
    setFrameRate,
    interpolatePointClouds,
    interpolatePoints,
    getAnimatedPointCloud,
    smoothTransition,
  };
}
