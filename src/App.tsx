import { useRef, useState, useEffect, useCallback } from 'react'
import './App.css'
import * as vision from '@mediapipe/tasks-vision';
import Scene from './Scene';
import { GLASSES_CONFIG as CONFIG, GLASSES_OPTIONS } from './config';

export interface FaceTransform {
  x: number;
  y: number;
  z: number;  // Depth position for perspective tracking
  scale: number;
  rotZ: number;
  rotY: number;
  rotX: number;
  leftArmOpacity: number;
  rightArmOpacity: number;
  // Ear positions for clipping (in local model space, before group transform)
  leftEarClipX: number;
  rightEarClipX: number;
}

// Calculate visible area based on camera settings
const FOV_RAD = (CONFIG.camera.fov * Math.PI) / 180;
const VISIBLE_HEIGHT = 2 * CONFIG.camera.positionZ * Math.tan(FOV_RAD / 2);

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGlasses, setSelectedGlasses] = useState<string>(GLASSES_OPTIONS[0].path);
  const detectorRef = useRef<vision.FaceLandmarker | null>(null);
  const [faceTransform, setFaceTransform] = useState<FaceTransform | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const animFrameRef = useRef<number>(0);
  const loopRef = useRef<FrameRequestCallback | null>(null);
  const prevTransformRef = useRef<FaceTransform | null>(null);
  const containerSizeRef = useRef({ width: 640, height: 480 });
  const frameCountRef = useRef(0);
  const { FaceLandmarker, FilesetResolver } = vision;

  // Cache container size to avoid per-frame DOM reads
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      containerSizeRef.current = {
        width: entry.contentRect.width || 640,
        height: entry.contentRect.height || 480,
      };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Store loop in a ref so it can self-schedule without breaking React compiler rules
  useEffect(() => {
    loopRef.current = () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector) return;

      // Frame-skip: only run detection every N frames
      frameCountRef.current = (frameCountRef.current + 1) % CONFIG.performance.frameSkip;
      if (frameCountRef.current !== 0) {
        animFrameRef.current = requestAnimationFrame(loopRef.current!);
        return;
      }

      const results = detector.detectForVideo(video, performance.now());

      if (results?.faceLandmarks?.length > 0) {
        const lm = results.faceLandmarks[0];

        // Extract landmarks
        const leftEye = lm[CONFIG.landmarks.leftEyeOuter];
        const rightEye = lm[CONFIG.landmarks.rightEyeOuter];
        const noseBridge = lm[CONFIG.landmarks.noseBridge];
        const leftTemple = lm[CONFIG.landmarks.leftTemple];
        const rightTemple = lm[CONFIG.landmarks.rightTemple];
        const forehead = lm[CONFIG.landmarks.forehead];
        const chin = lm[CONFIG.landmarks.chin];

        const { width: containerWidth, height: containerHeight } = containerSizeRef.current;
        const aspectRatio = containerWidth / containerHeight;
        const visibleWidth = VISIBLE_HEIGHT * aspectRatio;

        // === POSITION: Convert normalized coords to 3D world coordinates ===
        const cx = (leftEye.x + rightEye.x) / 2;
        const eyeMidY = (leftEye.y + rightEye.y) / 2;
        // Blend nose bridge for better vertical alignment
        const centerY = eyeMidY * (1 - CONFIG.position.noseBridgeWeight) +
                        noseBridge.y * CONFIG.position.noseBridgeWeight;

        const worldX = (cx - 0.5) * visibleWidth + CONFIG.position.offsetX;
        const worldY = -(centerY - 0.5) * VISIBLE_HEIGHT + CONFIG.position.offsetY;
        // Track depth using nose bridge Z for proper perspective when rotating head
        const faceZ = noseBridge.z;  // MediaPipe normalized depth (-0.1 to 0.1 typically)
        const worldZ = faceZ * CONFIG.position.depthScale + CONFIG.position.offsetZ;

        // === SCALE: Use both eye distance and face width ===
        const eyeDist = Math.hypot(
          rightEye.x - leftEye.x,
          rightEye.y - leftEye.y,
          rightEye.z - leftEye.z
        );
        const faceWidth = Math.hypot(
          rightTemple.x - leftTemple.x,
          rightTemple.y - leftTemple.y,
          rightTemple.z - leftTemple.z
        );
        const effectiveWidth = eyeDist * CONFIG.scale.eyeWeight +
                               faceWidth * CONFIG.scale.faceWidthWeight;
        const scale = Math.max(
          CONFIG.scale.min,
          Math.min(
            CONFIG.scale.max,
            (effectiveWidth * visibleWidth * CONFIG.scale.multiplier) / CONFIG.scale.baseModelWidth
          )
        );

        // === ROTATION: Improved yaw using depth, pitch using forehead/chin ===
        const rotZ = -Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) *
                     CONFIG.rotation.rollMultiplier;

        // Better yaw using eye depth difference
        const eyeDepthDiff = rightEye.z - leftEye.z;
        const eyeHorizDist = rightEye.x - leftEye.x;
        const rotY = Math.atan2(eyeDepthDiff * 2, eyeHorizDist) * CONFIG.rotation.yawMultiplier;

        // Better pitch using depth difference between forehead and chin
        const foreheadDepth = forehead.z;
        const chinDepth = chin.z;
        const faceHeight = Math.abs(forehead.y - chin.y);
        // When looking down: chin closer (smaller z), forehead further (larger z)
        // When looking up: chin further (larger z), forehead closer (smaller z)
        const rotX = Math.atan2((foreheadDepth - chinDepth) * 2, faceHeight) * CONFIG.rotation.pitchMultiplier;

        // === OCCLUSION: Calculate arm opacity based on yaw ===
        const threshold = CONFIG.occlusion.yawThreshold;
        const fadeRange = CONFIG.occlusion.fadeRange;

        // Left arm fades when turning right (positive yaw)
        const leftArmOpacity = CONFIG.occlusion.enabled && rotY > threshold
          ? Math.max(0, 1 - (rotY - threshold) / fadeRange)
          : 1;

        // Right arm fades when turning left (negative yaw)
        const rightArmOpacity = CONFIG.occlusion.enabled && rotY < -threshold
          ? Math.max(0, 1 - (-rotY - threshold) / fadeRange)
          : 1;

        // === CLIPPING: Calculate ear positions for clipping temple arms ===
        // Convert temple/ear positions to local model space (relative to glasses center)
        // These are used to position clipping planes at the ear
        const clipOffset = CONFIG.clipping?.offsetX ?? 0;
        const leftEarClipX = (leftTemple.x - cx) * visibleWidth / scale + clipOffset;
        const rightEarClipX = (rightTemple.x - cx) * visibleWidth / scale - clipOffset;

        // === SMOOTHING: Apply exponential smoothing ===
        const smooth = CONFIG.rotation.smoothing;
        const prev = prevTransformRef.current;

        const newTransform: FaceTransform = prev
          ? {
              x: prev.x + (worldX - prev.x) * smooth,
              y: prev.y + (worldY - prev.y) * smooth,
              z: prev.z + (worldZ - prev.z) * smooth,
              scale: prev.scale + (scale - prev.scale) * smooth,
              rotX: prev.rotX + (rotX - prev.rotX) * smooth,
              rotY: prev.rotY + (rotY - prev.rotY) * smooth,
              rotZ: prev.rotZ + (rotZ - prev.rotZ) * smooth,
              leftArmOpacity,
              rightArmOpacity,
              leftEarClipX: prev.leftEarClipX + (leftEarClipX - prev.leftEarClipX) * smooth,
              rightEarClipX: prev.rightEarClipX + (rightEarClipX - prev.rightEarClipX) * smooth,
            }
          : { x: worldX, y: worldY, z: worldZ, scale, rotX, rotY, rotZ, leftArmOpacity, rightArmOpacity, leftEarClipX, rightEarClipX };

        prevTransformRef.current = newTransform;
        setFaceTransform(newTransform);
      } else {
        setFaceTransform(null);
        prevTransformRef.current = null;
      }

      animFrameRef.current = requestAnimationFrame(loopRef.current!);
    };
  });

  const startLoop = useCallback(() => {
    if (loopRef.current) {
      animFrameRef.current = requestAnimationFrame(loopRef.current);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "./wasm"
      );
      detectorRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: false,
        runningMode: "VIDEO" as const,
        numFaces: 1
      });
      setIsLoading(false);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setVideoDimensions({ width: videoRef.current.videoWidth || 0, height: videoRef.current.videoHeight });
      }
    }
    init();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [FaceLandmarker, FilesetResolver]);

  return (
    <>
      <div ref={containerRef} className='relative' style={{width:videoDimensions?.width+" px", height:videoDimensions?.height+ " px"}}>
        {isLoading && <p className='absolute inset-0 z-10 text-white p-2'>Loading...</p>}
        {faceTransform  && 
        <div className={` w-full h-full absolute z-100 `}
        // style={{width:videoDimensions?.width+" px", height:videoDimensions?.height+ " px"}}
        >

          <Scene transform={faceTransform} glassesPath={selectedGlasses} />
         </div>

        }
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-100 flex gap-2">
          {GLASSES_OPTIONS.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGlasses(g.path)}
              style={{
                padding: "6px 16px",
                borderRadius: "999px",
                border: selectedGlasses === g.path ? "2px solid white" : "2px solid transparent",
                background: selectedGlasses === g.path ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.4)",
                color: "white",
                cursor: "pointer",
                fontWeight: selectedGlasses === g.path ? 700 : 400,
                backdropFilter: "blur(6px)",
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
        <video
          className=' object-cover fi w-full h-full -z-10'
          style={{width:videoDimensions?.width+" px", height:videoDimensions?.height+ " px"}}
          
          onLoadedData={startLoop}
          ref={videoRef}
          autoPlay
          muted
          playsInline
          >
          
        </video>
          </div>
    </>
  );
}

export default App
