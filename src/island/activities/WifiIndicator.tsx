import React from "react";
import { useReducedMotion } from "motion/react";

interface WifiIndicatorProps {
  state: "connected" | "disconnected" | string;
}

export const WifiIndicator: React.FC<WifiIndicatorProps> = ({ state }) => {
  const reducedMotion = useReducedMotion();
  const isConnected = state === "connected";

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
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Arc 1: Outer Arc */}
        <path
          d="M1.42 9a16 16 0 0 1 21.16 0"
          stroke={isConnected ? "#0A84FF" : "rgba(255, 255, 255, 0.25)"}
          strokeWidth="2.2"
          style={{
            animation: isConnected && !reducedMotion ? "wifiArcFill 0.4s ease 0.16s forwards" : "none",
            opacity: isConnected ? 1 : 0.25,
          }}
        />

        {/* Arc 2: Middle Arc */}
        <path
          d="M5 12.55a11 11 0 0 1 14.08 0"
          stroke={isConnected ? "#0A84FF" : "rgba(255, 255, 255, 0.25)"}
          strokeWidth="2.2"
          style={{
            animation: isConnected && !reducedMotion ? "wifiArcFill 0.4s ease 0.08s forwards" : "none",
            opacity: isConnected ? 1 : 0.25,
          }}
        />

        {/* Arc 3: Inner Dot / Base */}
        <path
          d="M8.53 16.11a6 6 0 0 1 6.95 0"
          stroke={isConnected ? "#0A84FF" : "rgba(255, 255, 255, 0.25)"}
          strokeWidth="2.2"
          style={{
            animation: isConnected && !reducedMotion ? "wifiArcFill 0.4s ease 0s forwards" : "none",
            opacity: isConnected ? 1 : 0.25,
          }}
        />
        <circle
          cx="12"
          cy="20"
          r="1"
          fill={isConnected ? "#0A84FF" : "rgba(255, 255, 255, 0.25)"}
        />

        {/* Disconnected strike-through */}
        {!isConnected && (
          <line x1="2" y1="2" x2="22" y2="22" stroke="#FF453A" strokeWidth="2.4" />
        )}
      </svg>

      <style>{`
        @keyframes wifiArcFill {
          0% {
            opacity: 0.2;
            transform: scale(0.95);
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
