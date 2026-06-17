import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, Effects } from '@react-three/drei';
import { EffectComposer, Bloom, FXAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Point3D, BIMModel, PointCloudPhase, EllipseParams } from '../../types';
import { BimModel } from './BimModel';
import { PointCloudLoader } from './PointCloudLoader';
import { CuttingPlane } from './CuttingPlane';
import { ChromaLayer } from './ChromaLayer';
import { getBoundingBox } from '../../utils/geometry';

interface SceneRendererProps {
  bimModel?: BIMModel | null;
  pointClouds: Record<PointCloudPhase, Point3D[]>;
  currentPhase: PointCloudPhase;
  showBimModel?: boolean;
  showPointCloud?: boolean;
  showCuttingPlane?: boolean;
  showChroma?: boolean;
  cuttingPlanePosition: number;
  cuttingPlaneThickness?: number;
  deviations?: number[];
  deviationRange?: [number, number];
  sectionIndices?: number[];
  baselineEllipse?: EllipseParams | null;
  onCuttingPlaneChange?: (position: number) => void;
}

function SceneContent({
  bimModel,
  pointClouds,
  currentPhase,
  showBimModel,
  showPointCloud,
  showCuttingPlane,
  showChroma,
  cuttingPlanePosition,
  cuttingPlaneThickness,
  deviations,
  deviationRange,
  sectionIndices,
  onCuttingPlaneChange,
}: Omit<SceneRendererProps, 'children'>) {
  const groupRef = useRef<THREE.Group>(null);

  const bounds = useMemo(() => {
    const allPoints: Point3D[] = [];
    Object.values(pointClouds).forEach((points) => {
      allPoints.push(...points);
    });
    if (allPoints.length > 0) {
      return getBoundingBox(allPoints);
    }
    return { minX: -10, maxX: 110, minY: -5, maxY: 5, minZ: -5, maxZ: 5 };
  }, [pointClouds]);

  const currentPoints = pointClouds[currentPhase] || [];

  const cameraPosition = useMemo(() => {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const distance = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ) * 1.5;
    return [centerX + distance, centerY + distance * 0.5, centerZ + distance] as [number, number, number];
  }, [bounds]);

  const targetPosition = useMemo(() => {
    return [(bounds.minX + bounds.maxX) / 2, 0, 0] as [number, number, number];
  }, [bounds]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.1) * 0.02;
    }
  });

  return (
    <>
      <color attach="background" args={['#050a18']} />
      <fog attach="fog" args={['#050a18', 50, 200]} />

      <ambientLight intensity={0.3} color="#4a90d9" />
      <directionalLight
        position={[50, 50, 25]}
        intensity={1}
        color="#ffffff"
        castShadow
      />
      <pointLight position={[0, 5, 5]} intensity={0.5} color="#00D4FF" />
      <pointLight position={[100, 5, 5]} intensity={0.5} color="#00D4FF" />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <group ref={groupRef}>
        {bimModel && <BimModel model={bimModel} visible={showBimModel} />}

        <PointCloudLoader
          points={currentPoints}
          phase={currentPhase}
          visible={showPointCloud}
          pointSize={0.03}
          showChroma={false}
        />

        {showChroma && deviations && (
          <ChromaLayer
            points={currentPoints}
            deviations={deviations}
            visible={true}
            pointSize={0.06}
            deviationRange={deviationRange}
            indices={sectionIndices}
          />
        )}

        <CuttingPlane
          position={cuttingPlanePosition}
          thickness={cuttingPlaneThickness}
          visible={showCuttingPlane}
          bounds={bounds}
          onPositionChange={onCuttingPlaneChange}
        />

        <gridHelper
          args={[200, 100, '#1a3a6a', '#0d1f3a']}
          position={[50, -2.5, 0]}
          rotation={[0, 0, 0]}
        />

        <axesHelper args={[10]} position={[0, -2, 0]} />
      </group>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={200}
        target={targetPosition}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={0.1}
      />

      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <FXAA />
      </EffectComposer>
    </>
  );
}

export function SceneRenderer(props: SceneRendererProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [80, 40, 80], fov: 60, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
