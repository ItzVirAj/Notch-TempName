import React from "react";
import { useReducedMotion } from "motion/react";

interface VolumeIndicatorProps {
  value?: number; // 0 - 100
  state?: string;
}

export const VolumeIndicator: React.FC<VolumeIndicatorProps> = ({ value = 50, state }) => {
  const reducedMotion = useReducedMotion();
  const isMuted = state === "muted" || value === 0;
  const ratio = isMuted ? 0 : Math.max(0, Math.min(1, value / 100));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        height: "24px",
      }}
    >
      {/* Small Speaker Glyph */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255, 255, 255, 0.75)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {isMuted ? (
          <line x1="23" y1="9" x2="17" y2="15" stroke="#FF453A" strokeWidth="2.2" />
        ) : ratio > 0.5 ? (
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        ) : ratio > 0 ? (
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        ) : null}
      </svg>

      {/* Mini Horizontal Volume Level Bar */}
      <div
        style={{
          width: "24px",
          height: "4px",
          borderRadius: "2px",
          backgroundColor: "rgba(255, 255, 255, 0.18)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#FFFFFF",
            transformOrigin: "left center",
            transform: `scaleX(${ratio})`,
            transition: reducedMotion ? "none" : "transform 0.08s ease-out",
          }}
        />
      </div>
    </div>
  );
};
