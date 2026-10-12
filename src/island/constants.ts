export type NotchVariant = "notch" | "island";

// Fixed native window dimensions (640x240)
export const WINDOW_WIDTH = 640;
export const WINDOW_HEIGHT = 240;

// Idle geometry
export const IDLE_NOTCH_WIDTH = 200;
export const IDLE_NOTCH_HEIGHT = 32;
export const IDLE_BOTTOM_RADIUS = 14;
export const DEFAULT_FLARE_RADIUS = 12;
export const ISLAND_TOP_GAP = 6;

// Expanded geometry
export const EXPANDED_NOTCH_WIDTH = 480;
export const EXPANDED_NOTCH_HEIGHT = 140;
export const EXPANDED_BOTTOM_RADIUS = 28;

// Backward-compatibility aliases
export const DEFAULT_NOTCH_WIDTH = IDLE_NOTCH_WIDTH;
export const DEFAULT_NOTCH_HEIGHT = IDLE_NOTCH_HEIGHT;
export const DEFAULT_BOTTOM_RADIUS = IDLE_BOTTOM_RADIUS;

// Spring physics (Apple HIG Dynamic Island spring response)
export const EXPAND_SPRING = {
  stiffness: 380,
  damping: 28,
  mass: 1,
} as const;

export const COLLAPSE_SPRING = {
  stiffness: 460,
  damping: 36,
  mass: 1,
} as const;

// Reduced motion fallback (Apple HIG Accessibility: 120ms non-bouncy tween)
export const REDUCED_MOTION_DURATION = 0.12;

// Hover intent timings (hysteresis)
export const HOVER_IN_DELAY_MS = 120;
export const HOVER_OUT_DELAY_MS = 250;
