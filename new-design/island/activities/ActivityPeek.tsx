import type { CSSProperties, ReactNode } from "react";
import type { Activity } from "../../store/activityStore";
import {
  BatteryIcon,
  BluetoothIcon,
  BoltIcon,
  CheckIcon,
  CloseIcon,
  HeadphonesIcon,
  KeyboardIcon,
  MouseIcon,
  PhoneIcon,
  SpeakerBoxIcon,
  SpeakerIcon,
  WifiIcon,
} from "../icons";

interface ActivityPeekProps {
  activity: Activity;
}

/** Left glyph: tells you what the alert is about before you read it. */
function Glyph({ a }: { a: Activity }) {
  const off = a.state === "disconnected";
  switch (a.kind) {
    case "bluetooth": {
      if (off) return <BluetoothIcon size={18} off />;
      switch (a.deviceType) {
        case "headphones": return <HeadphonesIcon size={18} />;
        case "speaker": return <SpeakerBoxIcon size={18} />;
        case "keyboard": return <KeyboardIcon size={18} />;
        case "mouse": return <MouseIcon size={18} />;
        case "phone": return <PhoneIcon size={18} />;
        default: return <BluetoothIcon size={18} />;
      }
    }
    case "wifi":
      return <WifiIcon size={18} off={off} />;
    case "charging":
      return a.state === "charging" ? <BoltIcon size={17} /> : <BatteryIcon size={18} level={(a.value ?? 50) / 100} />;
    case "battery-low":
      return <BatteryIcon size={18} level={(a.value ?? 15) / 100} />;
    case "volume":
      return <SpeakerIcon size={18} level={(a.value ?? 0) / 100} muted={a.subtitle === "Muted"} />;
  }
}

/** Right end: one small finite animation that says what changed. */
function Indicator({ a }: { a: Activity }) {
  const pct = Math.max(0, Math.min(100, a.value ?? 0));

  switch (a.kind) {
    case "bluetooth":
      return a.state === "connected" ? (
        <>
          <span className="nt-ripple" />
          <span className="nt-pop" style={{ color: "var(--nt-bone)", display: "grid" }}>
            <CheckIcon size={16} />
          </span>
        </>
      ) : (
        <span className="nt-pop" style={{ color: "var(--nt-ash)", display: "grid" }}>
          <CloseIcon size={15} />
        </span>
      );

    case "wifi": {
      const off = a.state === "disconnected";
      const arc = (d: string, delay: number) => (
        <path key={d} d={d} className="nt-arc" data-off={off} style={{ animationDelay: `${delay}ms` }} />
      );
      return (
        <svg width="26" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {arc("M9 16.2a5 5 0 0 1 6 0", 0)}
          {arc("M5.5 12.6a10 10 0 0 1 13 0", 90)}
          {arc("M2 9a15 15 0 0 1 20 0", 180)}
          <circle cx="12" cy="19.6" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    }

    case "charging":
    case "battery-low": {
      const low = a.kind === "battery-low";
      const charging = a.state === "charging";
      const color = low ? "var(--nt-alarm)" : charging ? "var(--nt-charge)" : "var(--nt-bone)";
      const fillStyle: CSSProperties = { transformBox: "fill-box", transformOrigin: "left center" };
      return (
        <svg
          width="44"
          height="24"
          viewBox="0 0 44 24"
          aria-hidden="true"
          className={low ? "nt-pulse" : undefined}
          style={{ color }}
        >
          <rect x="1" y="4" width="36" height="16" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
          <rect x="39.5" y="9" width="2.5" height="6" rx="1.2" fill="currentColor" opacity="0.5" />
          <rect
            x="4"
            y="7"
            width={Math.max(3, 30 * (pct / 100))}
            height="10"
            rx="3"
            fill="currentColor"
            className={charging || low ? "nt-fillbar" : undefined}
            style={fillStyle}
          />
        </svg>
      );
    }

    case "volume": {
      const muted = a.subtitle === "Muted";
      return (
        <div className="nt-level" aria-hidden="true">
          <div style={{ transform: `scaleX(${muted ? 0 : pct / 100})`, transition: "transform 80ms ease-out" }} />
        </div>
      );
    }
  }
}

export function ActivityPeek({ activity }: ActivityPeekProps): ReactNode {
  return (
    <div className="nt-activity">
      <div className="nt-activity-main">
        <span className="nt-activity-glyph">
          <Glyph a={activity} />
        </span>
        <div className="nt-activity-text">
          <div className="nt-activity-title">{activity.title}</div>
          {activity.subtitle && <div className="nt-activity-sub">{activity.subtitle}</div>}
        </div>
      </div>
      <div className="nt-activity-end">
        {/* key restarts the animation when a different alert replaces this one */}
        <Indicator key={`${activity.kind}-${activity.id}-${activity.state}`} a={activity} />
      </div>
    </div>
  );
}
