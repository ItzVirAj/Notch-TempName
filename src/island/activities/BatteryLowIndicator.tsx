import React from "react";
import { useReducedMotion } from "motion/react";

interface BatteryLowIndicatorProps {
  value?: number; // e.g. 10 or 20
}

export const BatteryLowIndicator: React.FC<BatteryLowIndicatorProps> = ({ value = 15 }) => {
  const reducedMotion = useReducedMotion();
  const clamped = Math.max(5, Math.min(25, Math.round(value)));
  const fillWidth = (clamped / 100) * 14;

  return (
    <div
      style={{
        width: "24px",
        height: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <svg
        width="22"
        height="14"
        viewBox="0 0 24 14"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          animation: reducedMotion ? "none" : "batteryLowPulse 0.8s ease-in-out 2",
        }}
      >
        {/* Red Outline */}
        <rect
          x="1"
          y="1"
          width="18"
          height="12"
          rx="3"
          stroke="#FF453A"
          strokeWidth="1.6"
        />

        {/* Positive Terminal */}
        <path d="M21 5v4" stroke="#FF453A" strokeWidth="1.8" />

        {/* Critical Low Red Fill */}
        <rect
          x="3"
          y="3"
          width={Math.max(2.5, fillWidth)}
          height="8"
          rx="1.5"
          fill="#FF453A"
        />

        {/* Warning Exclamation Mark */}
        <line x1="10" y1="4" x2="10" y2="8" stroke="#FFFFFF" strokeWidth="1.4" />
        <circle cx="10" cy="10" r="0.75" fill="#FFFFFF" />
      </svg>

      <style>{`
        @keyframes batteryLowPulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.45;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};
