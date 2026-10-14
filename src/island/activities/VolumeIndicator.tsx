import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

interface VolumeIndicatorProps {
  value?: number; // 0 - 100
  state?: string;
}

/* ---------- Design tokens ---------- */
const SEGMENTS = 14; // number of radial ticks
const SWEEP = 270; // degrees of arc covered
const START_ANGLE = -225; // where the arc begins (bottom-left)
const RADIUS_OUTER = 17;
const RADIUS_INNER = 13;
const CENTER = 20;

const palette = {
  surface: "rgba(18, 18, 22, 0.72)",
  border: "rgba(255, 255, 255, 0.08)",
  highlight: "rgba(255, 255, 255, 0.05)",
  tickIdle: "rgba(255, 255, 255, 0.10)",
  text: "rgba(255, 255, 255, 0.92)",
  textDim: "rgba(255, 255, 255, 0.38)",
  mute: "#FF5C5C",
  muteDim: "rgba(255, 92, 92, 0.25)",
};

/** Teal → amber gradient across the ring as volume climbs. */
const tickColor = (index: number) => {
  const t = index / (SEGMENTS - 1);
  const hue = 172 - t * 132; // 172 (teal) → 40 (amber)
  return `hsl(${hue} 90% ${62 - t * 8}%)`;
};

const polar = (angleDeg: number, r: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
};

export const VolumeIndicator: React.FC<VolumeIndicatorProps> = ({ value = 50, state }) => {
  const reducedMotion = useReducedMotion();
  const isMuted = state === "muted" || value === 0;
  const clamped = Math.max(0, Math.min(100, value));
  const ratio = isMuted ? 0 : clamped / 100;
  const activeCount = Math.round(ratio * SEGMENTS);

  const spring = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 30, mass: 0.6 };

  return (
    <motion.div
      role="meter"
      aria-label="Volume"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isMuted ? 0 : clamped}
      aria-valuetext={isMuted ? "Muted" : `${clamped} percent`}
      initial={false}
      animate={{
        borderColor: isMuted ? palette.muteDim : palette.border,
        boxShadow: isMuted
          ? "0 0 0 1px rgba(255, 92, 92, 0.25)"
          : `0 0 0 1px ${palette.border}`,
      }}
      transition={spring}
      style={{
        position: "relative",
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        backgroundColor: palette.surface,
        border: "1px solid transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 40 40"
        fill="none"
        style={{
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        {/* Highlight inner backing */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS_INNER - 1.5}
          fill={palette.highlight}
        />

        {/* Radial ticks */}
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const angle = START_ANGLE + (i / (SEGMENTS - 1)) * SWEEP;
          const p1 = polar(angle, RADIUS_INNER);
          const p2 = polar(angle, RADIUS_OUTER);
          const isActive = !isMuted && i < activeCount;

          return (
            <motion.line
              key={i}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              strokeLinecap="round"
              initial={false}
              animate={{
                stroke: isActive ? tickColor(i) : palette.tickIdle,
                strokeWidth: isActive ? 1.6 : 1.2,
                opacity: isActive ? 1 : 0.5,
              }}
              transition={spring}
            />
          );
        })}

        {/* Center Speaker Glyph / Mute State */}
        <AnimatePresence mode="wait">
          {isMuted ? (
            <motion.g
              key="muted"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.8 }}
              transition={spring}
              style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
            >
              <polygon
                points="14,18.5 16,18.5 19,16 19,24 16,21.5 14,21.5"
                fill={palette.mute}
              />
              <line
                x1="21.5"
                y1="18"
                x2="25.5"
                y2="22"
                stroke={palette.mute}
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <line
                x1="25.5"
                y1="18"
                x2="21.5"
                y2="22"
                stroke={palette.mute}
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </motion.g>
          ) : (
            <motion.g
              key="active"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.8 }}
              transition={spring}
              style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
            >
              <polygon
                points="14,18.5 16,18.5 19,16 19,24 16,21.5 14,21.5"
                fill={palette.text}
              />
              <motion.path
                d="M21.5 18 A 2.8 2.8 0 0 1 21.5 22"
                fill="none"
                stroke={clamped > 0 ? palette.text : palette.textDim}
                strokeWidth="1.2"
                strokeLinecap="round"
                initial={false}
                animate={{ opacity: clamped > 0 ? 1 : 0.2 }}
                transition={spring}
              />
              <motion.path
                d="M23.8 16.5 A 5.2 5.2 0 0 1 23.8 23.5"
                fill="none"
                stroke={clamped > 50 ? palette.text : palette.textDim}
                strokeWidth="1.2"
                strokeLinecap="round"
                initial={false}
                animate={{ opacity: clamped > 50 ? 1 : 0.2 }}
                transition={spring}
              />
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </motion.div>
  );
};
