import { useEffect } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useIslandStore } from "../store/islandStore";
import {
  COLLAPSE_SPRING,
  DEFAULT_FLARE_RADIUS,
  EXPAND_SPRING,
  EXPANDED_BOTTOM_RADIUS,
  EXPANDED_NOTCH_HEIGHT,
  EXPANDED_NOTCH_WIDTH,
  IDLE_BOTTOM_RADIUS,
  IDLE_NOTCH_HEIGHT,
  IDLE_NOTCH_WIDTH,
  ISLAND_TOP_GAP,
  REDUCED_MOTION_DURATION,
  type NotchVariant,
} from "./constants";
import { buildNotchPath } from "./notchPath";
import { useHoverIntent } from "./useHoverIntent";

// Single switch for "notch" vs "island" variants
export const NOTCH_VARIANT: NotchVariant = "notch";

interface NotchProps {
  variant?: NotchVariant;
  flareRadius?: number;
  topGap?: number;
}

export default function Notch({
  variant = NOTCH_VARIANT,
  flareRadius = DEFAULT_FLARE_RADIUS,
  topGap = ISLAND_TOP_GAP,
}: NotchProps) {
  const mode = useIslandStore((s) => s.mode);
  const isExpanded = mode === "expanded";
  const reducedMotion = useReducedMotion();
  const { onMouseEnter, onMouseLeave, onClick } = useHoverIntent();

  const isNotch = variant === "notch";

  // Target values based on current state machine mode
  const targetWidth = isExpanded ? EXPANDED_NOTCH_WIDTH : IDLE_NOTCH_WIDTH;
  const targetHeight = isExpanded ? EXPANDED_NOTCH_HEIGHT : IDLE_NOTCH_HEIGHT;
  const targetBottomR = isExpanded ? EXPANDED_BOTTOM_RADIUS : IDLE_BOTTOM_RADIUS;

  // Individual Motion values driven by interruptible springs
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

  // Drive Motion values on state transition
  useEffect(() => {
    const transition = reducedMotion
      ? {
          type: "tween" as const,
          duration: REDUCED_MOTION_DURATION,
          ease: "easeOut" as const,
        }
      : isExpanded
      ? {
          type: "spring" as const,
          stiffness: EXPAND_SPRING.stiffness,
          damping: EXPAND_SPRING.damping,
          mass: EXPAND_SPRING.mass,
        }
      : {
          type: "spring" as const,
          stiffness: COLLAPSE_SPRING.stiffness,
          damping: COLLAPSE_SPRING.damping,
          mass: COLLAPSE_SPRING.mass,
        };

    animate(widthMotion, targetWidth, transition);
    animate(heightMotion, targetHeight, transition);
    animate(bottomRadiusMotion, targetBottomR, transition);
  }, [
    isExpanded,
    targetWidth,
    targetHeight,
    targetBottomR,
    reducedMotion,
    widthMotion,
    heightMotion,
    bottomRadiusMotion,
  ]);

  return (
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
        {/* Invisible 8px hit area extension on bottom and sides while idle */}
        {mode === "idle" && (
          <motion.path
            d={pathD}
            fill="none"
            stroke="transparent"
            strokeWidth={16}
            className="pointer-events-auto cursor-pointer"
          />
        )}

        {/* Visible notch vector path */}
        <motion.path
          d={pathD}
          fill="#000000"
          className="pointer-events-auto cursor-pointer"
        />
      </svg>

      {/* Placeholder content clipped within the notch boundary */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{
          paddingTop: isNotch ? 0 : topGap,
          paddingLeft: isNotch ? flareRadius : 0,
          paddingRight: isNotch ? flareRadius : 0,
        }}
      >
        <motion.div
          initial={false}
          animate={
            isExpanded
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 6 }
          }
          transition={
            isExpanded
              ? {
                  opacity: {
                    delay: reducedMotion ? 0 : 0.08,
                    duration: 0.16,
                    ease: "easeOut",
                  },
                  y: {
                    delay: reducedMotion ? 0 : 0.08,
                    duration: 0.16,
                    ease: "easeOut",
                  },
                }
              : {
                  opacity: { delay: 0, duration: 0.08, ease: "easeIn" },
                  y: { delay: 0, duration: 0.08, ease: "easeIn" },
                }
          }
          className="w-full h-full flex flex-col items-center justify-center pointer-events-none"
        >
          <span className="text-white text-base font-semibold tracking-tight">
            testnotch
          </span>
          <span className="text-neutral-400 text-xs font-normal tracking-wide mt-1">
            expanded
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
