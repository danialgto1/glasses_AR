import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import type { FaceTransform } from "./App";
import { Environment, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { GLASSES_CONFIG as CONFIG, GLASSES_OPTIONS } from "./config";


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
    <>
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
        <mesh
      position={[
        occluderConfig.position.x,
        occluderConfig.position.y,
        occluderConfig.position.z-.1,
      ]}
      renderOrder={0} // Render first so it writes depth before glasses
      material={depthMaterial}
    >
      <boxGeometry args={[
        occluderConfig.size.width+.1,
        occluderConfig.size.height,
        occluderConfig.size.depth,
      ]} />

    </mesh>
        </>
  );
};


const Model = ({ path }: { path: string }) => {
  const { scene, materials } = useGLTF(path);

  // Setup materials on mount
  useEffect(() => {
    // Set render order for all glasses meshes (render after occluder)
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.renderOrder = 1;
      }
    });
  }, [materials, scene]);

  return <primitive object={scene} position={[0, 0, 0]} />;
};

type AnyGlassesOption = typeof GLASSES_OPTIONS[number];
type BlueprintOption = Extract<AnyGlassesOption, { path: null }>;

function isBlueprintOption(g: AnyGlassesOption): g is BlueprintOption {
  return g.path === null;
}

const BlueprintGlasses = ({ bluePrints, glassWidth }: {
  bluePrints: BlueprintOption["bluePrints"];
  glassWidth: number;
}) => {
  const [frontTexture, leftTexture] = useTexture([bluePrints.front, bluePrints.left]);
  const multiplier = .0118
  const _glassWidth = glassWidth * multiplier

  const frontImg = frontTexture?.image as HTMLImageElement | undefined;
  const leftImg = leftTexture?.image as HTMLImageElement | undefined;

  // Both blueprint images share the same px scale, so one px→world factor sizes everything
  const pxToWorld = _glassWidth / (frontImg?.width ?? 1);
  const frontH = (frontImg?.height ?? 1) * pxToWorld;
  const sideW = (leftImg?.width ?? 1) * pxToWorld;
  const sideH = (leftImg?.height ?? 1) * pxToWorld;

  return (
    <>
      {/* Front plane */}
      <mesh renderOrder={1}>
        <planeGeometry args={[_glassWidth, frontH]} />
        <meshBasicMaterial map={frontTexture} transparent alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Wearer's left side (camera's right, +X): left.png */}
      <mesh position={[_glassWidth / 2, 0, -sideW / 2]} scale={[-1, 1, 1]} rotation={[0, -Math.PI / 2, 0]} renderOrder={1}>
        <planeGeometry args={[sideW, sideH]} />
        <meshBasicMaterial map={leftTexture} transparent alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Wearer's right side (camera's left, -X): left.png mirrored */}
      <mesh position={[-_glassWidth / 2, 0, -sideW / 2]} rotation={[0, Math.PI / 2, 0]}  renderOrder={1}>
        <planeGeometry args={[sideW, sideH]} />
        <meshBasicMaterial map={leftTexture} transparent alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
};

// Preload all GLB models (skip null paths)
GLASSES_OPTIONS.forEach((g) => { if (g.path) useGLTF.preload(g.path); });

export default function Scene({ transform, glasses }: { transform: FaceTransform; glasses: AnyGlassesOption }) {
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
          <group rotation={[transform.rotX - (0.1), transform.rotY, transform.rotZ]}>
            {/* Inner group: offset glasses from neck pivot */}
            <group position={[0, pivotY, pivotZ]}>
              <HeadOccluder />
              {isBlueprintOption(glasses) ? (
                <BlueprintGlasses bluePrints={glasses.bluePrints} glassWidth={glasses.glassWidth} />
              ) : (
                <Model path={glasses.path} />
              )}
            </group>
          </group>
          {/* <OrbitControls /> */}
        </group>
        <Environment files="./env.hdr" backgroundBlurriness={0.5} />
      </Suspense>
    </Canvas>
  );
}
