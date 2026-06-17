import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Point3D, PointCloudPhase } from '../../types';
import { PHASE_COLORS } from '../../types';
import { convertToThreeJSGeometry, downsamplePointCloud } from '../../utils/pointCloud';

interface PointCloudLoaderProps {
  points: Point3D[];
  phase: PointCloudPhase;
  visible?: boolean;
  pointSize?: number;
  colors?: Float32Array;
  showChroma?: boolean;
  maxPoints?: number;
}

export function PointCloudLoader({
  points,
  phase,
  visible = true,
  pointSize = 0.02,
  colors,
  showChroma = false,
  maxPoints = 500000,
}: PointCloudLoaderProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);

  const { positions, count, pointColors } = useMemo(() => {
    const processedPoints = downsamplePointCloud(points, maxPoints);
    const { positions, count } = convertToThreeJSGeometry(processedPoints);

    let pointColors: Float32Array | undefined = colors;

    if (!pointColors) {
      const color = new THREE.Color(PHASE_COLORS[phase]);
      pointColors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pointColors[i * 3] = color.r;
        pointColors[i * 3 + 1] = color.g;
        pointColors[i * 3 + 2] = color.b;
      }
    }

    return { positions, count, pointColors };
  }, [points, phase, colors, maxPoints]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (pointColors) {
      geo.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
    }
    return geo;
  }, [positions, pointColors]);

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.vertexColors = showChroma || !!colors;
    }
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (!visible || count === 0) return null;

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        ref={materialRef}
        size={pointSize}
        sizeAttenuation
        vertexColors={showChroma || !!colors}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
