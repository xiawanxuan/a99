import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BIMModel } from '../../types';

interface BimModelProps {
  model: BIMModel;
  visible?: boolean;
  opacity?: number;
}

export function BimModel({ model, visible = true, opacity = 0.3 }: BimModelProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);

  const { geometry, edges } = useMemo(() => {
    const { length, width, height, axis_points } = model;

    const tubePoints: THREE.Vector3[] = [];
    const segments = 50;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = t * length;

      let y = 0;
      let z = 0;

      if (axis_points && axis_points.length >= 2) {
        const idx = Math.min(Math.floor(t * (axis_points.length - 1)), axis_points.length - 2);
        const localT = t * (axis_points.length - 1) - idx;
        const p1 = axis_points[idx];
        const p2 = axis_points[Math.min(idx + 1, axis_points.length - 1)];
        y = p1.y + (p2.y - p1.y) * localT;
        z = p1.z + (p2.z - p1.z) * localT;
      }

      tubePoints.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(tubePoints);
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, Math.min(width, height) / 2, 16, false);

    const edgeGeometry = new THREE.EdgesGeometry(tubeGeometry);

    return { geometry: tubeGeometry, edges: edgeGeometry };
  }, [model]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.02;
    }
  });

  if (!visible) return null;

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color="#0B1E3F"
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
      <lineSegments ref={edgesRef} geometry={edges}>
        <lineBasicMaterial color="#00D4FF" transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
}
