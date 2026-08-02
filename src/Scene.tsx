import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import type { FaceTransform } from "./App";
import { Environment, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { GLASSES_CONFIG as CONFIG, GLASSES_OPTIONS, type GlassesOption } from "./config";


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

type BlueprintOption = Extract<GlassesOption, { path: null }>;

function isBlueprintOption(g: GlassesOption): g is BlueprintOption {
  return g.path === null;
}

function getContentBounds(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { contentWidth: image.width, contentHeight: image.height };
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  let minX = image.width, maxX = 0, minY = image.height, maxY = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (data[(y * image.width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX > maxX || minY > maxY) return { contentWidth: image.width, contentHeight: image.height, minX: 0, minY: 0 };
  return { contentWidth: maxX - minX + 1, contentHeight: maxY - minY + 1, minX, minY };
}

const BlueprintGlasses = ({ bluePrints, glassWidth }: {
  bluePrints: BlueprintOption["bluePrints"];
  glassWidth: number;
}) => {
  const [frontTexture, leftTexture] = useTexture([bluePrints.front, bluePrints.left]);
  const multiplier = .0118
  const _glassWidth = glassWidth * multiplier

  const frontBounds = useMemo(() => {
    const img = frontTexture?.image as HTMLImageElement | undefined;
    return img ? getContentBounds(img) : null;
  }, [frontTexture]);

  const leftBounds = useMemo(() => {
    const img = leftTexture?.image as HTMLImageElement | undefined;
    return img ? getContentBounds(img) : null;
  }, [leftTexture]);

  const frontW = frontBounds?.contentWidth ?? 1;
  const frontH_px = frontBounds?.contentHeight ?? 1;
  const leftW = leftBounds?.contentWidth ?? 1;
  const leftH_px = leftBounds?.contentHeight ?? 1;

  const frontH = _glassWidth * (frontH_px / frontW);
  const sideW = frontH * (leftW / leftH_px);

  const croppedFront = useMemo(() => {
    const img = frontTexture?.image as HTMLImageElement | undefined;
    if (!img || !frontBounds) return frontTexture;
    const t = frontTexture.clone();
    t.repeat.set(frontBounds.contentWidth / img.width, frontBounds.contentHeight / img.height);
    t.offset.set((frontBounds.minX ?? 0) / img.width, (img.height - (frontBounds.minY ?? 0) - frontBounds.contentHeight) / img.height);
    t.needsUpdate = true;
    return t;
  }, [frontTexture, frontBounds]);

  const croppedLeft = useMemo(() => {
    const img = leftTexture?.image as HTMLImageElement | undefined;
    if (!img || !leftBounds) return leftTexture;
    const t = leftTexture.clone();
    t.repeat.set(leftBounds.contentWidth / img.width, leftBounds.contentHeight / img.height);
    t.offset.set((leftBounds.minX ?? 0) / img.width, (img.height - (leftBounds.minY ?? 0) - leftBounds.contentHeight) / img.height);
    t.needsUpdate = true;
    return t;
  }, [leftTexture, leftBounds]);

  return (
    <>
      {/* Front plane */}
      <mesh renderOrder={1}>
        <planeGeometry args={[_glassWidth, frontH]} />
        <meshBasicMaterial map={croppedFront} transparent alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Wearer's left side (camera's right, +X): left.png */}
      <mesh position={[_glassWidth / 2, 0, -sideW / 2]} scale={[-1, 1, 1]} rotation={[0, -Math.PI / 2, 0]} renderOrder={1}>
        <planeGeometry args={[sideW, frontH]} />
        <meshBasicMaterial map={croppedLeft} transparent alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Wearer's right side (camera's left, -X): left.png mirrored */}
      <mesh position={[-_glassWidth / 2, 0, -sideW / 2]} rotation={[0, Math.PI / 2, 0]}  renderOrder={1}>
        <planeGeometry args={[sideW, frontH]} />
        <meshBasicMaterial map={croppedLeft} transparent alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
};

// Preload all GLB models (skip null paths)
GLASSES_OPTIONS.forEach((g) => { if (g.path) useGLTF.preload(g.path); });

export default function Scene({ transform, glasses }: { transform: FaceTransform; glasses: GlassesOption }) {
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
        <Environment files={`${import.meta.env.BASE_URL}env.hdr`} backgroundBlurriness={0.5} />
      </Suspense>
    </Canvas>
  );
}
