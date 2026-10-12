import React from "react";
import { useReducedMotion } from "motion/react";

interface ChargingIndicatorProps {
  state: "charging" | "unplugged" | string;
  value?: number; // 0 - 100
}

export const ChargingIndicator: React.FC<ChargingIndicatorProps> = ({ state, value = 100 }) => {
  const reducedMotion = useReducedMotion();
  const isCharging = state === "charging";
  const clampedPercent = Math.max(5, Math.min(100, Math.round(value)));
  const fillWidth = (clampedPercent / 100) * 14;

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
      >
        {/* Battery Outer Outline */}
        <rect
          x="1"
          y="1"
          width="18"
          height="12"
          rx="3"
          stroke={isCharging ? "#30D158" : "rgba(255, 255, 255, 0.45)"}
          strokeWidth="1.6"
        />

        {/* Battery Positive Terminal Tip */}
        <path
          d="M21 5v4"
          stroke={isCharging ? "#30D158" : "rgba(255, 255, 255, 0.45)"}
          strokeWidth="1.8"
        />

        {/* Level Fill */}
        <rect
          x="3"
          y="3"
          width={fillWidth}
          height="8"
          rx="1.5"
          fill={isCharging ? "#30D158" : "rgba(255, 255, 255, 0.55)"}
          style={{
            transition: reducedMotion ? "none" : "width 0.3s ease",
          }}
        />

        {/* Small Lightning Bolt Badge / Icon */}
        {isCharging ? (
          <path
            d="M10 2.5 L6.5 8 L10.5 8 L8 12 L13.5 6.5 L9.5 6.5 Z"
            fill="#FFFFFF"
            style={{
              animation: reducedMotion ? "none" : "chargingBoltFade 0.4s ease forwards",
            }}
          />
        ) : (
          /* Unplugged slash/mark */
          <line x1="6" y1="2" x2="14" y2="12" stroke="#FF453A" strokeWidth="1.6" />
        )}
      </svg>

      <style>{`
        @keyframes chargingBoltFade {
          0% {
            opacity: 0;
            transform: scale(0.6);
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
