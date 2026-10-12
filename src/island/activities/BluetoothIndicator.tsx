import React from "react";
import { useReducedMotion } from "motion/react";

interface BluetoothIndicatorProps {
  state: "connected" | "disconnected" | string;
}

export const BluetoothIndicator: React.FC<BluetoothIndicatorProps> = ({ state }) => {
  const reducedMotion = useReducedMotion();
  const isConnected = state === "connected";

  return (
    <div
      style={{
        position: "relative",
        width: "24px",
        height: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Soft Ripple Ring (plays once on connection) */}
      {isConnected && !reducedMotion && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1.5px solid rgba(10, 132, 255, 0.7)",
            animation: "btRipple 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Bluetooth Glyph */}
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isConnected ? "#0A84FF" : "rgba(255, 255, 255, 0.45)"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
        {!isConnected && (
          <line x1="2" y1="2" x2="22" y2="22" stroke="#FF453A" strokeWidth="2.4" />
        )}
      </svg>

      {/* Small Checkmark Badge when connected */}
      {isConnected && (
        <span
          style={{
            position: "absolute",
            bottom: "-1px",
            right: "-1px",
            width: "9px",
            height: "9px",
            borderRadius: "50%",
            backgroundColor: "#30D158",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 2px rgba(0,0,0,0.6)",
          }}
        >
          <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="4" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}

      <style>{`
        @keyframes btRipple {
          0% {
            transform: scale(0.85);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
