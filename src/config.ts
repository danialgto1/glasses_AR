// Glasses fitting configuration - adjust these values to tune the fit
export const GLASSES_CONFIG = {
  // Camera settings (must match Scene.tsx camera)
  camera: {
    positionZ: 25,
    fov: 25,
  },

  // Position offsets for fine-tuning centering
  position: {
    offsetX: 0,           // Horizontal offset (positive = right)
    offsetY: 0,           // Vertical offset (positive = up)
    offsetZ: -1.2,           // Depth offset base
    depthScale:0,       // How much face Z affects glasses (perspective tracking)
    noseBridgeWeight: 0.3, // Blend nose bridge into Y calculation (0-1)
  },

  // Scale configuration
  scale: {
    baseModelWidth: .98,    // Reference width of glasses model
    multiplier: 9.30,      // Overall scale adjustment
    min: 0.3,             // Minimum scale clamp
    max: 50.0,             // Maximum scale clamp
    eyeWeight: 0.6,       // Weight for eye distance in width calculation
    faceWidthWeight: 0.4, // Weight for temple width in width calculation
  },

  // Rotation sensitivity
  rotation: {
    yawMultiplier: 0.60,   // Horizontal rotation sensitivity
    pitchMultiplier: -.7,  // Vertical rotation sensitivity (head up/down)
    rollMultiplier: .9,   // Tilt rotation sensitivity
    smoothing: .9,        // Smoothing factor (0-1, lower = smoother)
  },

  // Pivot point - glasses rotate around neck, not their center
  // These offsets define where glasses are relative to the neck pivot
  pivot: {
    enabled: true,
    y: -0.0095,   // Glasses are above neck (positive = up from neck)
    z: 0.04,    // Glasses are in front of neck (positive = forward from neck)
  },

  // Occlusion settings for hiding temple arms (opacity-based)
  occlusion: {
    enabled: false,       // Disable opacity fade (using clipping instead)
    yawThreshold: 0.25,   // Radians before fade starts
    fadeRange: 0.15,      // Radians over which to fade
  },

  // Clipping settings for cutting temple arms at ears (old method - disabled)
  clipping: {
    enabled: false,
    offsetX: 1,
  },

  // Head occluder - invisible box behind glasses that hides temple arms
  // This box is positioned in glasses local space, so it rotates with the glasses
  headOccluder: {
    enabled: true,  // Temporarily disabled to debug
    // Position relative to glasses center (in model units)
    position: {
      x: 0,       // Left/right offset
      y: 0,       // Up/down offset
      z: -.07,    // Behind the lens (negative = toward face)
    },
    // Size of the occluder box (in model units)
    size: {
      width: .13,   // Left-right size (should be wider than face)
      height: .2,  // Up-down size
      depth: .1,   // Front-back depth (thickness of "head")
    },
  },

  // Performance tuning
  performance: {
    frameSkip: 2,  // Run detection every N frames (1 = every frame, 2 = every other frame)
  },

  // MediaPipe landmark indices
  landmarks: {
    leftEyeOuter: 33,
    rightEyeOuter: 263,
    noseBridge: 168,
    leftTemple: 234,
    rightTemple: 454,
    forehead: 10,
    chin: 152,
  },
} as const;

export type GlassesConfig = typeof GLASSES_CONFIG;

export const GLASSES_OPTIONS = [
  { id: "sunglasses", label: "Sunglasses", path: "./glass_sunglasses.glb" },
  { id: "transparent", label: "Clear", path: "./glass_transparent.glb" },
] as const;
