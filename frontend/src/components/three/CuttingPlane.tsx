import { useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Point3D } from '../../types';

interface CuttingPlaneProps {
  position: number;
  thickness?: number;
  normal?: Point3D;
  visible?: boolean;
  onPositionChange?: (position: number) => void;
  bounds?: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
}

export function CuttingPlane({
  position,
  thickness = 0.1,
  normal = { x: 1, y: 0, z: 0 },
  visible = true,
  onPositionChange,
  bounds,
}: CuttingPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const [isDragging, setIsDragging] = useState(false);

  const planeSize = useCallback(() => {
    if (bounds) {
      const width = bounds.maxY - bounds.minY + 4;
      const height = bounds.maxZ - bounds.minZ + 4;
      return { width, height };
    }
    return { width: 10, height: 10 };
  }, [bounds]);

  const { width, height } = planeSize();

  const planeGeometry = new THREE.PlaneGeometry(width, height);
  const edgeGeometry = new THREE.EdgesGeometry(planeGeometry);

  const thicknessGeometry = new THREE.BoxGeometry(thickness, width, height);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    if (meshRef.current && onPositionChange) {
      onPositionChange(meshRef.current.position.x);
    }
  }, [onPositionChange]);

  const handleObjectChange = useCallback(() => {
    if (meshRef.current && onPositionChange && isDragging) {
      const newX = meshRef.current.position.x;
      if (bounds) {
        const clampedX = Math.max(bounds.minX - 1, Math.min(bounds.maxX + 1, newX));
        if (clampedX !== newX) {
          meshRef.current.position.x = clampedX;
        }
      }
      onPositionChange(meshRef.current.position.x);
    }
  }, [onPositionChange, isDragging, bounds]);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.addEventListener('dragging-changed', (event: any) => {
        if (!event.value) {
          handleDragEnd();
        } else {
          handleDragStart();
        }
      });
      controlsRef.current.addEventListener('objectChange', handleObjectChange);
    }
  });

  if (!visible) return null;

  return (
    <group position={[position, 0, 0]}>
      <TransformControls
        ref={controlsRef}
        mode="translate"
        showX={true}
        showY={false}
        showZ={false}
        camera={camera}
      >
        <mesh ref={meshRef}>
          <primitive object={thicknessGeometry} attach="geometry" />
          <meshStandardMaterial
            color="#00D4FF"
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </TransformControls>

      <mesh>
        <primitive object={planeGeometry} attach="geometry" />
        <meshBasicMaterial
          color="#00D4FF"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial color="#00D4FF" linewidth={2} />
      </lineSegments>

      <mesh position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[0.3, 0.4, 32]} />
        <meshBasicMaterial color="#FF4757" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
