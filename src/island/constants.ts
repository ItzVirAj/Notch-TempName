export type NotchVariant = "notch" | "island";

// Fixed native window dimensions (640x240)
export const WINDOW_WIDTH = 640;
export const WINDOW_HEIGHT = 240;

// Universal flare and island gap
export const DEFAULT_FLARE_RADIUS = 12;
export const ISLAND_TOP_GAP = 6;

// State 1: Idle
export const IDLE_NOTCH_WIDTH = 200;
export const IDLE_NOTCH_HEIGHT = 32;
export const IDLE_BOTTOM_RADIUS = 14;

// State 2: Peek
export const PEEK_NOTCH_WIDTH = 260;
export const PEEK_NOTCH_HEIGHT = 44;
export const PEEK_BOTTOM_RADIUS = 20;

// State 3: Expanded
export const EXPANDED_NOTCH_WIDTH = 480;
export const EXPANDED_NOTCH_HEIGHT = 132;
export const EXPANDED_BOTTOM_RADIUS = 28;

// Backward-compatibility aliases
export const DEFAULT_NOTCH_WIDTH = IDLE_NOTCH_WIDTH;
export const DEFAULT_NOTCH_HEIGHT = IDLE_NOTCH_HEIGHT;
export const DEFAULT_BOTTOM_RADIUS = IDLE_BOTTOM_RADIUS;

// Spring configurations per transition intent
// 1. idle -> peek: quick and light, subtle overshoot
export const PEEK_SPRING = {
  stiffness: 420,
  damping: 30,
  mass: 1,
} as const;

// 2. peek -> expanded / idle -> expanded: buoyant Dynamic Island spring
export const EXPAND_SPRING = {
  stiffness: 380,
  damping: 28,
  mass: 1,
} as const;

// 3. any -> idle / expanded -> peek: agile, authoritative collapse
export const COLLAPSE_SPRING = {
  stiffness: 460,
  damping: 36,
  mass: 1,
} as const;

// Reduced motion fallback (Apple HIG Accessibility: 120ms non-bouncy tween)
export const REDUCED_MOTION_DURATION = 0.12;

// Hover intent & hysteresis timings
export const HOVER_IN_PEEK_DELAY_MS = 120;
export const PEEK_LEAVE_DELAY_MS = 250;
export const EXPANDED_LEAVE_DELAY_MS = 400;

// Hit-area extensions (half of strokeWidth)
export const IDLE_HIT_STROKE_WIDTH = 16;       // 8px extension beyond shape
export const ACTIVE_HIT_STROKE_WIDTH = 8;       // 4px extension beyond shape

// Native Win32 hit region padding & overshoot headroom
export const HIT_PADDING_IDLE = 8;             // 8px on each side & bottom in idle
export const HIT_PADDING_ACTIVE = 4;           // 4px on each side & bottom when peek/expanded
export const HIT_OVERSHOOT_HEADROOM = 12;      // 12px extra headroom on width & height for spring overshoot

export function calculateHitRegionDimensions(
  shapeWidth: number,
  shapeHeight: number,
  isIdle: boolean
): { width: number; height: number } {
  const padding = isIdle ? HIT_PADDING_IDLE : HIT_PADDING_ACTIVE;
  return {
    width: shapeWidth + padding * 2 + HIT_OVERSHOOT_HEADROOM * 2,
    height: shapeHeight + padding + HIT_OVERSHOOT_HEADROOM,
  };
}
