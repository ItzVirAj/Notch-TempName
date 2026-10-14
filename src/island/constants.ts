export type NotchVariant = "notch" | "island";

// Fixed native window dimensions (scaled for 1.15x expanded view)
export const WINDOW_WIDTH = 780;
export const WINDOW_HEIGHT = 480;

// Universal flare and island gap
export const DEFAULT_FLARE_RADIUS = 12;
export const ISLAND_TOP_GAP = 6;

// State 1: Idle
export const IDLE_NOTCH_WIDTH = 200;
export const IDLE_NOTCH_HEIGHT = 18;
export const IDLE_BOTTOM_RADIUS = 14;

// State 2: Peek
export const PEEK_NOTCH_WIDTH = 260;
export const PEEK_NOTCH_HEIGHT = 40;
export const PEEK_BOTTOM_RADIUS = 20;

// State 2.5: Activity Peek
export const ACTIVITY_PEEK_WIDTH = 300;
export const ACTIVITY_PEEK_HEIGHT = 44;
export const ACTIVITY_BOTTOM_RADIUS = 20;

// Live Activities Timing & Rules
export const ACTIVITY_TTL_BLUETOOTH_MS = 3000;
export const ACTIVITY_TTL_WIFI_MS = 2500;
export const ACTIVITY_TTL_CHARGING_MS = 3000;
export const ACTIVITY_TTL_BATTERY_LOW_MS = 4000;
export const ACTIVITY_TTL_VOLUME_MS = 1500;
export const ACTIVITY_DEDUPE_WINDOW_MS = 1500;
export const ACTIVITY_INITIAL_SUPPRESSION_MS = 3000;
export const ACTIVITY_MAX_QUEUE_SIZE = 3;

// State 3: Expanded (Scaled 1.15x: 580*1.15=667, 255*1.15=294, 28*1.15=32)
export const EXPANDED_NOTCH_WIDTH = 667;
export const EXPANDED_NOTCH_HEIGHT_COMPACT = 294;
export const EXPANDED_NOTCH_HEIGHT_WITH_MEDIA = 294;
export const EXPANDED_NOTCH_HEIGHT = 294;
export const EXPANDED_BOTTOM_RADIUS = 32;

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
export const IDLE_HIT_STROKE_WIDTH = 2;        // 1px extension beyond shape (tight hit boundary)
export const ACTIVE_HIT_STROKE_WIDTH = 2;      // 1px extension beyond shape

// Native Win32 hit region padding & overshoot headroom (tight fit to maximize desktop click-through)
export const HIT_PADDING_IDLE = 1;             // 1px on each side & bottom in idle
export const HIT_PADDING_ACTIVE = 1;           // 1px on each side & bottom when peek/expanded
export const HIT_OVERSHOOT_HEADROOM = 1;       // 1px minimal headroom for spring motion

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
