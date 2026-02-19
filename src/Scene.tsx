import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import type { FaceTransform } from "./App";
import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GLASSES_CONFIG as CONFIG } from "./config";

// Head occluder - invisible box that blocks temple arms behind it
const HeadOccluder = () => {
  const occluderConfig = CONFIG.headOccluder;

  // Create depth-only material (writes to depth buffer, not color buffer)
  const depthMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      colorWrite: false,    // Don't write to color buffer (invisible)
      depthWrite: true,     // Do write to depth buffer (occludes things behind)
      side: THREE.FrontSide,
    });
  }, []);

  if (!occluderConfig?.enabled) return null;

  return (
    <mesh
      position={[
        occluderConfig.position.x,
        occluderConfig.position.y,
        occluderConfig.position.z,
      ]}
      renderOrder={0} // Render first so it writes depth before glasses
      material={depthMaterial}
    >
      <boxGeometry args={[
        occluderConfig.size.width,
        occluderConfig.size.height,
        occluderConfig.size.depth,
      ]} />
      
    </mesh>
  );
};

const Model = () => {
  const { scene, materials } = useGLTF("./glasses.glb");

  // Setup materials on mount
  useEffect(() => {
    Object.values(materials).forEach((mat) => {
      if (!(mat instanceof THREE.MeshStandardMaterial)) return;
      mat.roughness = 0.1;
      mat.metalness = 0.0;
      mat.envMapIntensity = 3.0;
      mat.needsUpdate = true;
    });

    // Set render order for all glasses meshes (render after occluder)
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.renderOrder = 1;
      }
    });
  }, [materials, scene]);

  return <primitive object={scene} position={[0, 0, 0]} />;
};

// Preload so the model is ready before first render
useGLTF.preload("./glasses.glb");

export default function Scene({ transform }: { transform: FaceTransform }) {
  const pivotConfig = CONFIG.pivot;
  const pivotY = pivotConfig?.enabled ? pivotConfig.y : 0;
  const pivotZ = pivotConfig?.enabled ? pivotConfig.z : 0;

  return (
    <Canvas
      gl={{
        alpha: true,
        antialias: true,
      }}
      camera={{
        position: [0, 0, CONFIG.camera.positionZ],
        fov: CONFIG.camera.fov,
        near: 0.1,
        far: 400,
      }}
    >
      <Suspense fallback={null}>
        {/* Outer group: position and scale (z tracks face depth for perspective) */}
        <group
          position={[transform.x, transform.y, transform.z]}
          scale={transform.scale}
        >
          {/* Middle group: rotation pivot (neck axis) */}
          <group rotation={[transform.rotX, transform.rotY, transform.rotZ]}>
            {/* Inner group: offset glasses from neck pivot */}
            <group position={[0, pivotY, pivotZ]}>
              <HeadOccluder />
              <Model />
            </group>
          </group>
          {/* <OrbitControls /> */}
        </group>
        <Environment files="./env.hdr" backgroundBlurriness={0.5} />
      </Suspense>
    </Canvas>
  );
}
