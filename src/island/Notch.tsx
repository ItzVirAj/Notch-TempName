import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useIslandStore, type IslandMode } from "../store/islandStore";
import {
  ACTIVE_HIT_STROKE_WIDTH,
  COLLAPSE_SPRING,
  DEFAULT_FLARE_RADIUS,
  EXPAND_SPRING,
  EXPANDED_BOTTOM_RADIUS,
  EXPANDED_NOTCH_HEIGHT,
  EXPANDED_NOTCH_WIDTH,
  IDLE_BOTTOM_RADIUS,
  IDLE_HIT_STROKE_WIDTH,
  IDLE_NOTCH_HEIGHT,
  IDLE_NOTCH_WIDTH,
  ISLAND_TOP_GAP,
  PEEK_BOTTOM_RADIUS,
  PEEK_NOTCH_HEIGHT,
  PEEK_NOTCH_WIDTH,
  PEEK_SPRING,
  REDUCED_MOTION_DURATION,
  calculateHitRegionDimensions,
  type NotchVariant,
} from "./constants";
import { setNativeHitRegion } from "./hitRegion";
import { buildNotchPath } from "./notchPath";
import { useHoverIntent } from "./useHoverIntent";

// Single switch for "notch" vs "island" variants
export const NOTCH_VARIANT: NotchVariant = "notch";

interface NotchProps {
  variant?: NotchVariant;
  flareRadius?: number;
  topGap?: number;
  showDebugOutline?: boolean;
}

const TARGETS = {
  idle: {
    width: IDLE_NOTCH_WIDTH,
    height: IDLE_NOTCH_HEIGHT,
    bottomRadius: IDLE_BOTTOM_RADIUS,
  },
  peek: {
    width: PEEK_NOTCH_WIDTH,
    height: PEEK_NOTCH_HEIGHT,
    bottomRadius: PEEK_BOTTOM_RADIUS,
  },
  expanded: {
    width: EXPANDED_NOTCH_WIDTH,
    height: EXPANDED_NOTCH_HEIGHT,
    bottomRadius: EXPANDED_BOTTOM_RADIUS,
  },
} as const;

export default function Notch({
  variant = NOTCH_VARIANT,
  flareRadius = DEFAULT_FLARE_RADIUS,
  topGap = ISLAND_TOP_GAP,
  showDebugOutline = false,
}: NotchProps) {
  const mode = useIslandStore((s) => s.mode);
  const prevModeRef = useRef<IslandMode>("idle");
  const reducedMotion = useReducedMotion();
  const { onMouseEnter, onMouseLeave, onClick } = useHoverIntent();

  const isNotch = variant === "notch";

  // Helper to compute hit region dimensions for any given mode
  const getRegionForMode = (m: IslandMode) => {
    const t = TARGETS[m];
    const shapeWidth = isNotch ? t.width + 2 * flareRadius : t.width;
    const shapeHeight = isNotch ? t.height : t.height + topGap;
    return calculateHitRegionDimensions(shapeWidth, shapeHeight, m === "idle");
  };

  // State & refs for Win32 hit region synchronization
  const appliedRegionRef = useRef<{ width: number; height: number }>(
    getRegionForMode("idle")
  );
  const [appliedRegionState, setAppliedRegionState] = useState<{
    width: number;
    height: number;
  }>(getRegionForMode("idle"));
  const transitionIdRef = useRef<number>(0);

  const target = TARGETS[mode];

  // Motion values initialized to idle dimensions
  const widthMotion = useMotionValue(IDLE_NOTCH_WIDTH);
  const heightMotion = useMotionValue(IDLE_NOTCH_HEIGHT);
  const bottomRadiusMotion = useMotionValue(IDLE_BOTTOM_RADIUS);

  // Derive SVG container dimensions continuously from Motion values
  const totalWidthMotion = useTransform(widthMotion, (w) =>
    isNotch ? w + 2 * flareRadius : w
  );
  const totalHeightMotion = useTransform(heightMotion, (h) =>
    isNotch ? h : h + topGap
  );

  // Derive SVG path "d" attribute on each animation frame
  const pathD = useTransform(
    [widthMotion, heightMotion, bottomRadiusMotion],
    ([w, h, r]: number[]) => {
      return buildNotchPath({
        width: w,
        height: h,
        bottomRadius: r,
        flareRadius,
        variant,
        topGap,
      });
    }
  );

  // Drive Motion values with spring physics and synchronize native hit region
  useEffect(() => {
    const from = prevModeRef.current;
    const to = mode;
    prevModeRef.current = mode;

    const transitionId = ++transitionIdRef.current;
    const targetRegion = getRegionForMode(to);
    const currentApplied = appliedRegionRef.current;

    // Timing Rule:
    // If target is LARGER than current region, expand region immediately BEFORE animation starts.
    const isExpanding =
      targetRegion.width > currentApplied.width ||
      targetRegion.height > currentApplied.height;

    if (isExpanding) {
      const expandedWidth = Math.max(targetRegion.width, currentApplied.width);
      const expandedHeight = Math.max(targetRegion.height, currentApplied.height);
      appliedRegionRef.current = { width: expandedWidth, height: expandedHeight };
      setAppliedRegionState({ width: expandedWidth, height: expandedHeight });
      setNativeHitRegion(expandedWidth, expandedHeight);
    }

    let spring: { stiffness: number; damping: number; mass: number } = PEEK_SPRING;
    if (to === "idle" || (from === "expanded" && to === "peek")) {
      // Collapse or downsize: swift, authoritative collapse spring
      spring = COLLAPSE_SPRING;
    } else if (to === "expanded") {
      // Full expansion: lively Dynamic Island spring
      spring = EXPAND_SPRING;
    } else if (from === "idle" && to === "peek") {
      // Subtle peek: quick and light spring with minimal overshoot
      spring = PEEK_SPRING;
    }

    const transition = reducedMotion
      ? {
          type: "tween" as const,
          duration: REDUCED_MOTION_DURATION,
          ease: "easeOut" as const,
        }
      : {
          type: "spring" as const,
          stiffness: spring.stiffness,
          damping: spring.damping,
          mass: spring.mass,
        };

    const animW = animate(widthMotion, target.width, transition);
    const animH = animate(heightMotion, target.height, transition);
    const animR = animate(bottomRadiusMotion, target.bottomRadius, transition);

    let completed = false;
    const onAnimationSettled = () => {
      if (completed) return;
      completed = true;

      // Only shrink if this transition is still the active one (not superseded by a newer transition)
      if (transitionIdRef.current === transitionId) {
        const cur = appliedRegionRef.current;
        if (cur.width !== targetRegion.width || cur.height !== targetRegion.height) {
          appliedRegionRef.current = targetRegion;
          setAppliedRegionState(targetRegion);
          setNativeHitRegion(targetRegion.width, targetRegion.height);
        }
      }
    };

    Promise.all([animW, animH, animR]).then(onAnimationSettled).catch(() => {});

    // Safety timeout ensuring shrink occurs even if spring settlement resolution is delayed
    const safetyTimer = window.setTimeout(
      onAnimationSettled,
      reducedMotion ? 160 : 450
    );

    return () => {
      window.clearTimeout(safetyTimer);
    };
  }, [
    mode,
    target.width,
    target.height,
    target.bottomRadius,
    reducedMotion,
    widthMotion,
    heightMotion,
    bottomRadiusMotion,
    isNotch,
    flareRadius,
    topGap,
  ]);

  // Hit area extension: 8px (strokeWidth=16) in idle; 4px (strokeWidth=8) in peek/expanded
  const hitStrokeWidth =
    mode === "idle" ? IDLE_HIT_STROKE_WIDTH : ACTIVE_HIT_STROKE_WIDTH;

  return (
    <>
      {/* DEV Debug Outline: outlines the exact Win32 interactive hit region */}
      {showDebugOutline && (
        <div
          style={{
            width: appliedRegionState.width,
            height: appliedRegionState.height,
          }}
          className="absolute top-0 left-1/2 -translate-x-1/2 border border-dashed border-red-500 pointer-events-none box-border z-50"
        />
      )}

      <motion.div
        style={{
          width: totalWidthMotion,
          height: totalHeightMotion,
        }}
        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none select-none"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
      <svg
        className="w-full h-full overflow-visible pointer-events-none"
        shapeRendering="geometricPrecision"
      >
        {/* Invisible hit padding area (8px idle / 4px peek & expanded) */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="transparent"
          strokeWidth={hitStrokeWidth}
          className="pointer-events-auto cursor-pointer"
        />

        {/* Visible notch vector path */}
        <motion.path
          d={pathD}
          fill="#000000"
          className="pointer-events-auto cursor-pointer"
        />
      </svg>

      {/* Content Layer: Clipped strictly inside the notch body */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{
          paddingTop: isNotch ? 0 : topGap,
          paddingLeft: isNotch ? flareRadius : 0,
          paddingRight: isNotch ? flareRadius : 0,
        }}
      >
        {/* 1. Peek Label: subtle micro-label (12px, 70% white) */}
        <motion.div
          initial={false}
          animate={
            mode === "peek"
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: mode === "expanded" ? -4 : 4 }
          }
          transition={
            mode === "peek"
              ? {
                  opacity: {
                    delay: reducedMotion ? 0 : 0.06,
                    duration: 0.12,
                    ease: "easeOut",
                  },
                  y: {
                    delay: reducedMotion ? 0 : 0.06,
                    duration: 0.12,
                    ease: "easeOut",
                  },
                }
              : {
                  opacity: { delay: 0, duration: 0.06, ease: "easeIn" },
                  y: { delay: 0, duration: 0.06, ease: "easeIn" },
                }
          }
          className="w-full h-full flex items-center justify-center pointer-events-none"
        >
          <span className="text-xs text-white/70 font-medium tracking-tight">
            testnotch
          </span>
        </motion.div>

        {/* 2. Expanded Content: compact title & subtitle tailored for 96px height */}
        <motion.div
          initial={false}
          animate={
            mode === "expanded"
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 4 }
          }
          transition={
            mode === "expanded"
              ? {
                  opacity: {
                    delay: reducedMotion ? 0 : 0.08,
                    duration: 0.14,
                    ease: "easeOut",
                  },
                  y: {
                    delay: reducedMotion ? 0 : 0.08,
                    duration: 0.14,
                    ease: "easeOut",
                  },
                }
              : {
                  opacity: { delay: 0, duration: 0.06, ease: "easeIn" },
                  y: { delay: 0, duration: 0.06, ease: "easeIn" },
                }
          }
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          <span className="text-sm font-semibold text-white tracking-tight">
            testnotch
          </span>
          <span className="text-xs text-neutral-400 font-normal tracking-wide mt-0.5">
            expanded
          </span>
        </motion.div>
      </div>
    </motion.div>
    </>
  );
}
