import { useMemo } from 'react';
import * as THREE from 'three';
import type { Point3D } from '../../types';
import { getColorArray } from '../../utils/colormap';

interface ChromaLayerProps {
  points: Point3D[];
  deviations: number[];
  visible?: boolean;
  pointSize?: number;
  deviationRange?: [number, number];
  indices?: number[];
}

export function ChromaLayer({
  points,
  deviations,
  visible = true,
  pointSize = 0.05,
  deviationRange = [-20, 20],
  indices,
}: ChromaLayerProps) {
  const { positions, colors, count } = useMemo(() => {
    const displayPoints = indices
      ? indices.map((i) => points[i]).filter(Boolean)
      : points;

    const displayDeviations = indices
      ? indices.map((i) => deviations[i]).filter((_, i) => points[i])
      : deviations;

    const positions = new Float32Array(displayPoints.length * 3);
    const colors = getColorArray(
      displayDeviations,
      deviationRange[0],
      deviationRange[1],
      'coolwarm'
    );

    for (let i = 0; i < displayPoints.length; i++) {
      positions[i * 3] = displayPoints[i].x;
      positions[i * 3 + 1] = displayPoints[i].y;
      positions[i * 3 + 2] = displayPoints[i].z;
    }

    return { positions, colors, count: displayPoints.length };
  }, [points, deviations, deviationRange, indices]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  if (!visible || count === 0) return null;

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={pointSize}
        sizeAttenuation
        vertexColors
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
