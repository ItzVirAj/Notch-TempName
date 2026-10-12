import React from "react";
import type { Activity } from "../../store/activityStore";
import { BluetoothIndicator } from "./BluetoothIndicator";
import { WifiIndicator } from "./WifiIndicator";
import { ChargingIndicator } from "./ChargingIndicator";
import { BatteryLowIndicator } from "./BatteryLowIndicator";
import { VolumeIndicator } from "./VolumeIndicator";

interface ActivityPeekProps {
  activity: Activity;
}

function renderDeviceIcon(activity: Activity) {
  const { kind, deviceType } = activity;

  // Device-specific Bluetooth icons
  if (kind === "bluetooth") {
    switch (deviceType) {
      case "headphones":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
        );
      case "speaker":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <circle cx="12" cy="14" r="4" />
            <line x1="12" y1="6" x2="12.01" y2="6" strokeWidth="3" />
          </svg>
        );
      case "keyboard":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <line x1="6" y1="8" x2="6.01" y2="8" strokeWidth="2.5" />
            <line x1="10" y1="8" x2="10.01" y2="8" strokeWidth="2.5" />
            <line x1="14" y1="8" x2="14.01" y2="8" strokeWidth="2.5" />
            <line x1="18" y1="8" x2="18.01" y2="8" strokeWidth="2.5" />
            <line x1="8" y1="16" x2="16" y2="16" strokeWidth="2" />
          </svg>
        );
      case "mouse":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="3" width="12" height="18" rx="6" />
            <line x1="12" y1="7" x2="12" y2="11" />
          </svg>
        );
      case "phone":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="3" />
            <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" />
          </svg>
        );
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
          </svg>
        );
    }
  }

  // Kind-specific fallbacks
  switch (kind) {
    case "wifi":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      );
    case "charging":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="16" height="18" rx="2" />
          <path d="M9 1v2M13 1v2" />
          <path d="M10 8l-2 4h4l-2 4" fill="#30D158" />
        </svg>
      );
    case "battery-low":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="18" height="12" rx="2" />
          <path d="M22 10v4" />
          <line x1="8" y1="10" x2="8" y2="14" stroke="#FF453A" />
        </svg>
      );
    case "volume":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      );
    default:
      return null;
  }
}

export const ActivityPeek: React.FC<ActivityPeekProps> = ({ activity }) => {
  const { kind, title, subtitle, state, value } = activity;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 14px",
        boxSizing: "border-box",
        gap: "10px",
        pointerEvents: "auto",
        userSelect: "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Left: Device Icon Badge + Title / Subtitle Text */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          minWidth: 0,
          flex: 1,
        }}
      >
        {/* Left Glyph Icon */}
        <div
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "6px",
            backgroundColor: "rgba(255, 255, 255, 0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#FFFFFF",
          }}
        >
          {renderDeviceIcon(activity)}
        </div>

        {/* Title and Subtitle on a single line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            minWidth: 0,
            lineHeight: 1.2,
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#FFFFFF",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </span>

          {subtitle && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 400,
                color: "rgba(255, 255, 255, 0.55)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flexShrink: 1,
              }}
            >
              • {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Right: Small Animated Indicator (24px) */}
      <div
        style={{
          width: "24px",
          height: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          flexShrink: 0,
        }}
      >
        {kind === "bluetooth" && <BluetoothIndicator state={state} />}
        {kind === "wifi" && <WifiIndicator state={state} />}
        {kind === "charging" && <ChargingIndicator state={state} value={value} />}
        {kind === "battery-low" && <BatteryLowIndicator value={value} />}
        {kind === "volume" && <VolumeIndicator value={value} state={state} />}
      </div>
    </div>
  );
};
