import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMediaStore } from "../../store/mediaStore";
import { useIslandStore } from "../../store/islandStore";

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function formatTime(ms: number): string {
  if (ms <= 0 || isNaN(ms)) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/* Design tokens */
const C = {
  ink: "#050506",
  surface: "rgba(255,255,255,0.055)",
  surfaceHi: "rgba(255,255,255,0.10)",
  hairline: "rgba(255,255,255,0.09)",
  text: "#F3F1EC",
  textDim: "rgba(243,241,236,0.58)",
  textFaint: "rgba(243,241,236,0.34)",
  signal: "#A9B8FF", // active / on
  charge: "#7EE2A8",
  warn: "#FFB547",
  low: "#FF6B6B",
};

const FONT =
  "'SF Pro Rounded', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const TAB_SIZE = 28;
const TAB_GAP = 2;
const BAR_COUNT = 46;
const VOL_TICKS = 22;

/* Scoped CSS: hover / focus / animation live here so inline styles stay simple */
const CSS = `
.pe-root, .pe-root * { box-sizing: border-box; }
.pe-btn { appearance: none; border: 0; background: transparent; padding: 0; margin: 0; color: inherit; font: inherit; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: transform .12s ease, background-color .15s ease, color .15s ease, opacity .15s ease; }
.pe-btn:focus-visible { outline: 2px solid ${C.signal}; outline-offset: 2px; }
.pe-btn:disabled { opacity: .35; cursor: default; }
.pe-ghost { color: ${C.textFaint}; }
.pe-ghost:hover { color: ${C.text}; }
.pe-press:active:not(:disabled) { transform: scale(.9); }
.pe-tab { color: ${C.textDim}; }
.pe-tab:hover { color: ${C.text}; }
.pe-tab[aria-selected="true"] { color: ${C.ink}; }
.pe-switch:hover .pe-switch-dot { background-color: ${C.surfaceHi}; }
.pe-switch[aria-pressed="true"]:hover .pe-switch-dot { filter: brightness(1.06); }
.pe-eq i { display: block; width: 3px; border-radius: 2px; background: ${C.signal}; height: 100%; transform-origin: bottom; transform: scaleY(.28); }
.pe-eq.on i { animation: pe-eq 0.9s ease-in-out infinite; }
.pe-eq.on i:nth-child(2) { animation-delay: -.3s; animation-duration: 1.1s; }
.pe-eq.on i:nth-child(3) { animation-delay: -.6s; animation-duration: .8s; }
.pe-eq.on i:nth-child(4) { animation-delay: -.15s; animation-duration: 1.2s; }
@keyframes pe-eq { 0%,100% { transform: scaleY(.25); } 50% { transform: scaleY(1); } }
.pe-bar { transition: background-color .12s ease; }
@media (prefers-reduced-motion: reduce) {
  .pe-eq.on i { animation: none; transform: scaleY(.7); }
  .pe-btn { transition: none; }
}
`;

/* ---------------------------------------------------------------------------
 * Icons
 * ------------------------------------------------------------------------- */

type IconProps = { size?: number };

const stroke = (size: number, children: React.ReactNode, sw = 2) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const IconHome = ({ size = 14 }: IconProps) =>
  stroke(
    size,
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </>
  );
const IconMusic = ({ size = 14 }: IconProps) =>
  stroke(
    size,
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  );
const IconTune = ({ size = 14 }: IconProps) =>
  stroke(
    size,
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="7" cy="18" r="2" fill="currentColor" />
    </>
  );
const IconFocus = ({ size = 14 }: IconProps) =>
  stroke(
    size,
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </>
  );
const IconPulse = ({ size = 14 }: IconProps) =>
  stroke(size, <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />);
const IconSignal = ({ size = 14 }: IconProps) =>
  stroke(
    size,
    <>
      <line x1="5" y1="20" x2="5" y2="15" />
      <line x1="10" y1="20" x2="10" y2="11" />
      <line x1="15" y1="20" x2="15" y2="7" />
      <line x1="20" y1="20" x2="20" y2="3" />
    </>,
    2.6
  );
const IconWifi = ({ size = 16 }: IconProps) =>
  stroke(
    size,
    <>
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </>,
    2.3
  );
const IconBluetooth = ({ size = 16 }: IconProps) =>
  stroke(size, <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />);
const IconLeaf = ({ size = 16 }: IconProps) =>
  stroke(
    size,
    <>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </>
  );
const IconPin = ({ size = 14, filled = false }: IconProps & { filled?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2.1"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-2l-2-3V5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v7l-2 3v2z" />
  </svg>
);
const IconGear = ({ size = 14 }: IconProps) =>
  stroke(
    size,
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>,
    1.9
  );
const IconClose = ({ size = 13 }: IconProps) =>
  stroke(
    size,
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>,
    2.4
  );
const IconPrev = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="4" y="5" width="2.6" height="14" rx="1.1" />
    <path d="M20 5.8v12.4a1 1 0 0 1-1.55.83L9.2 12.83a1 1 0 0 1 0-1.66l9.25-6.2A1 1 0 0 1 20 5.8z" />
  </svg>
);
const IconNext = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="17.4" y="5" width="2.6" height="14" rx="1.1" />
    <path d="M4 5.8v12.4a1 1 0 0 0 1.55.83l9.25-6.2a1 1 0 0 0 0-1.66L5.55 4.97A1 1 0 0 0 4 5.8z" />
  </svg>
);
const IconPlay = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 4.6v14.8a1 1 0 0 0 1.52.85l12-7.4a1 1 0 0 0 0-1.7l-12-7.4A1 1 0 0 0 7 4.6z" />
  </svg>
);
const IconPause = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="5.5" y="4" width="4.6" height="16" rx="1.4" />
    <rect x="13.9" y="4" width="4.6" height="16" rx="1.4" />
  </svg>
);
const IconSpeaker = ({ level, size = 15 }: { level: 0 | 1 | 2; size?: number }) =>
  stroke(
    size,
    <>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      {level === 0 && (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      )}
      {level >= 1 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
      {level >= 2 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
    </>,
    2.2
  );
const IconBolt = ({ size = 11 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.7L13.5 2z" />
  </svg>
);
const IconCloud = ({ size = 14 }: IconProps) =>
  stroke(
    size,
    <>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" />
    </>,
    1.9
  );

/* ---------------------------------------------------------------------------
 * Small presentational pieces
 * ------------------------------------------------------------------------- */

function BatteryGlyph({
  level,
  charging,
}: {
  level: number;
  charging: boolean;
}) {
  const pct = Math.round(clamp01(level) * 100);
  const color = charging ? C.charge : pct <= 20 ? C.low : C.text;
  const fillW = Math.max(2, (clamp01(level) * 20));
  return (
    <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">
      <rect x="0.75" y="0.75" width="25" height="14.5" rx="4.2" fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1.5" />
      <rect x="3" y="3" width={fillW} height="10" rx="2.4" fill={color} />
      <rect x="27.5" y="5" width="2" height="6" rx="1" fill={color} fillOpacity="0.45" />
    </svg>
  );
}

interface SwitchProps {
  label: string;
  sub: string;
  on: boolean;
  onToggle: (e: React.MouseEvent) => void;
  tone?: "signal" | "warn";
  children: React.ReactNode;
}

function Switch({ label, sub, on, onToggle, tone = "signal", children }: SwitchProps) {
  const onBg = tone === "warn" ? C.warn : C.signal;
  return (
    <button
      type="button"
      className="pe-btn pe-switch pe-press"
      aria-pressed={on}
      aria-label={`${label}: ${sub}`}
      onClick={onToggle}
      style={{
        flex: 1,
        minWidth: 0,
        flexDirection: "column",
        gap: 5,
      }}
    >
      <span
        className="pe-switch-dot"
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          backgroundColor: on ? onBg : C.surface,
          color: on ? C.ink : C.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </span>
      <span style={{ lineHeight: 1.15, textAlign: "center", maxWidth: "100%" }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text }}>{label}</span>
        <span
          style={{
            display: "block",
            fontSize: 10,
            color: C.textDim,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 78,
            margin: "0 auto",
          }}
        >
          {sub}
        </span>
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

interface PlayerExpandedProps {
  isExpanded?: boolean;
}

export function PlayerExpanded({ isExpanded = true }: PlayerExpandedProps) {
  const snapshot = useMediaStore((s) => s.snapshot);
  const thumbnailUrl = useMediaStore((s) => s.thumbnailUrl);
  const toIdle = useIslandStore((s) => s.toIdle);

  const {
    hasSession,
    title,
    artist,
    isPlaying,
    playbackRate,
    positionMs,
    durationMs,
    canPlayPause,
    canNext,
    canPrevious,
  } = snapshot;

  const [activeLauncher, setActiveLauncher] = useState<number>(0);
  const [isPinned, setIsPinned] = useState(false);

  /* ------------------------------ System state ------------------------------ */
  interface SystemControlsState {
    wifiEnabled: boolean;
    wifiName: string | null;
    bluetoothEnabled: boolean;
    energySaverEnabled: boolean;
    batteryLevel: number;
    isCharging: boolean;
  }

  const [isWifiOn, setIsWifiOn] = useState(true);
  const [wifiName, setWifiName] = useState<string>("Connected");
  const [isBluetoothOn, setIsBluetoothOn] = useState(false);
  const [isEnergySaverOn, setIsEnergySaverOn] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number>(1.0);
  const [isCharging, setIsCharging] = useState<boolean>(true);

  const fetchSystemControls = useCallback(() => {
    invoke<SystemControlsState>("system_get_controls")
      .then((res) => {
        if (res) {
          setIsWifiOn(res.wifiEnabled);
          setWifiName(res.wifiName || (res.wifiEnabled ? "Connected" : "Off"));
          setIsBluetoothOn(res.bluetoothEnabled);
          setIsEnergySaverOn(res.energySaverEnabled);
          if (typeof res.batteryLevel === "number" && !isNaN(res.batteryLevel)) {
            setBatteryLevel(res.batteryLevel);
          }
          setIsCharging(res.isCharging);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    fetchSystemControls();
  }, [fetchSystemControls]);

  useEffect(() => {
    if (!isExpanded) return;
    fetchSystemControls();
    const timer = window.setInterval(fetchSystemControls, 2500);
    return () => window.clearInterval(timer);
  }, [isExpanded, fetchSystemControls]);

  const handleToggleWifi = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isWifiOn;
    setIsWifiOn(next);
    invoke("system_toggle_wifi", { enable: next })
      .then(() => fetchSystemControls())
      .catch(() => { });
  };

  const handleToggleBluetooth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isBluetoothOn;
    setIsBluetoothOn(next);
    invoke("system_toggle_bluetooth", { enable: next })
      .then(() => fetchSystemControls())
      .catch(() => { });
  };

  const handleToggleEnergySaver = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEnergySaverOn(!isEnergySaverOn);
    invoke("system_toggle_energy_saver")
      .then(() => fetchSystemControls())
      .catch(() => { });
  };

  // Navigator Battery API (when available)
  useEffect(() => {
    let batteryInstance: any = null;
    let onLevelChange: (() => void) | null = null;
    let onChargingChange: (() => void) | null = null;
    let cancelled = false;

    if (typeof navigator !== "undefined" && "getBattery" in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          if (cancelled) return;
          batteryInstance = battery;
          setBatteryLevel(battery.level ?? 1.0);
          setIsCharging(battery.charging ?? true);

          onLevelChange = () => setBatteryLevel(battery.level ?? 1.0);
          onChargingChange = () => setIsCharging(battery.charging ?? true);

          battery.addEventListener("levelchange", onLevelChange);
          battery.addEventListener("chargingchange", onChargingChange);
        })
        .catch(() => { });
    }

    return () => {
      cancelled = true;
      if (batteryInstance) {
        try {
          if (onLevelChange) batteryInstance.removeEventListener("levelchange", onLevelChange);
          if (onChargingChange) batteryInstance.removeEventListener("chargingchange", onChargingChange);
        } catch { }
      }
    };
  }, []);

  /* --------------------------------- Volume --------------------------------- */
  const [volume, setVolume] = useState<number>(0.75);
  const [isMuted, setIsMuted] = useState(false);
  const isDraggingVolumeRef = useRef<boolean>(false);
  const volumeTrackRef = useRef<HTMLDivElement>(null);

  const fetchVolume = useCallback(() => {
    invoke<number>("media_get_volume")
      .then((vol) => {
        if (typeof vol === "number" && !isNaN(vol)) {
          const clamped = clamp01(vol);
          setVolume(clamped);
          setIsMuted(clamped === 0);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    fetchVolume();
  }, [fetchVolume]);

  useEffect(() => {
    if (isExpanded) fetchVolume();
  }, [isExpanded, fetchVolume]);

  const updateVolumeFromPointer = useCallback((clientX: number) => {
    if (!volumeTrackRef.current) return;
    const rect = volumeTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = clamp01((clientX - rect.left) / rect.width);
    setVolume(ratio);
    setIsMuted(ratio === 0);
    invoke("media_set_volume", { volume: ratio }).catch(() => { });
  }, []);

  const handleVolumePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingVolumeRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateVolumeFromPointer(e.clientX);
  };

  const handleVolumePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingVolumeRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    updateVolumeFromPointer(e.clientX);
  };

  const handleVolumePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingVolumeRef.current) return;
    e.stopPropagation();
    isDraggingVolumeRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMuted || volume === 0) {
      const restored = 0.5;
      setVolume(restored);
      setIsMuted(false);
      invoke("media_set_volume", { volume: restored }).catch(() => { });
    } else {
      setVolume(0);
      setIsMuted(true);
      invoke("media_set_volume", { volume: 0 }).catch(() => { });
    }
  };

  /* ------------------------------ Scrubber / transport ------------------------------ */
  const [displayPositionMs, setDisplayPositionMs] = useState(positionMs);
  const isDraggingScrubRef = useRef<boolean>(false);
  const scrubberTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDraggingScrubRef.current) setDisplayPositionMs(positionMs);
  }, [positionMs]);

  useEffect(() => {
    if (!isExpanded || !hasSession || !isPlaying || durationMs <= 0) return;
    const interval = window.setInterval(() => {
      setDisplayPositionMs((prev) => {
        if (isDraggingScrubRef.current) return prev;
        const next = prev + 1000 * (playbackRate || 1.0);
        return Math.min(next, durationMs);
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isExpanded, hasSession, isPlaying, durationMs, playbackRate]);

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canPlayPause || !hasSession) invoke("media_play_pause").catch(() => { });
  };
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canNext || !hasSession) invoke("media_next").catch(() => { });
  };
  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canPrevious || !hasSession) invoke("media_previous").catch(() => { });
  };

  const scrubTo = (clientX: number) => {
    if (!scrubberTrackRef.current) return;
    const dur = durationMs > 0 ? durationMs : 256000;
    const rect = scrubberTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = clamp01((clientX - rect.left) / rect.width);
    setDisplayPositionMs(ratio * dur);
  };

  const handleScrubPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingScrubRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrubTo(e.clientX);
  };
  const handleScrubPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingScrubRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    scrubTo(e.clientX);
  };
  const handleScrubPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingScrubRef.current) return;
    e.stopPropagation();
    isDraggingScrubRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { }
  };

  /* ------------------------------- Derived values ------------------------------- */
  const isPlaceholder = !hasSession || !title;
  const effectiveTitle = isPlaceholder ? "Nothing playing" : title;
  const effectiveArtist = isPlaceholder ? "Start music in any app" : artist || "Unknown artist";
  const effectiveDuration = isPlaceholder ? 0 : durationMs > 0 ? durationMs : 0;
  const effectivePosition = isPlaceholder ? 0 : displayPositionMs > 0 ? displayPositionMs : 0;
  const scrubRatio =
    effectiveDuration > 0 ? clamp01(effectivePosition / effectiveDuration) : 0;

  // Static pseudo-waveform: gives the scrubber a recognisable "audio" silhouette.
  const barHeights = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => {
        const v = Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.55)) * 0.7 + Math.abs(Math.sin(i * 0.31)) * 0.3;
        return 22 + v * 78; // percent of container height
      }),
    []
  );
  const playedBars = Math.round(scrubRatio * BAR_COUNT);

  const activeTicks = Math.round(volume * VOL_TICKS);
  const speakerLevel: 0 | 1 | 2 = isMuted || volume === 0 ? 0 : volume > 0.5 ? 2 : 1;
  const batteryPct = Math.round(clamp01(batteryLevel) * 100);

  const tabs = [
    { label: "Home", icon: <IconHome /> },
    { label: "Music", icon: <IconMusic /> },
    { label: "Mixer", icon: <IconTune /> },
    { label: "Focus", icon: <IconFocus /> },
    { label: "Performance", icon: <IconPulse /> },
    { label: "Network", icon: <IconSignal /> },
  ];

  /* ----------------------------------- Render ----------------------------------- */
  return (
    <div
      className="pe-root"
      style={{
        width: "100%",
        height: "100%",
        padding: "10px 22px 16px 22px",
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
        userSelect: "none",
        fontFamily: FONT,
        color: C.text,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{CSS}</style>

      {/* ============================== HEADER ============================== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 32,
          flexShrink: 0,
        }}
      >
        {/* Sliding segmented tabs */}
        <div
          role="tablist"
          aria-label="Island sections"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: TAB_GAP,
            padding: 2,
            borderRadius: 999,
            backgroundColor: C.surface,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 2,
              left: 2,
              width: TAB_SIZE,
              height: TAB_SIZE,
              borderRadius: "50%",
              backgroundColor: C.text,
              transform: `translateX(${activeLauncher * (TAB_SIZE + TAB_GAP)}px)`,
              transition: "transform .22s cubic-bezier(.3,1.25,.5,1)",
            }}
          />
          {tabs.map((t, idx) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={activeLauncher === idx}
              aria-label={t.label}
              title={t.label}
              className="pe-btn pe-tab"
              onClick={(e) => {
                e.stopPropagation();
                setActiveLauncher(idx);
              }}
              style={{
                position: "relative",
                width: TAB_SIZE,
                height: TAB_SIZE,
                borderRadius: "50%",
              }}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Status + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: C.textDim,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <IconCloud />
            <span style={{ fontWeight: 600, color: C.text }}>33°C</span>
          </div>

          <span style={{ width: 1, height: 14, backgroundColor: C.hairline }} />

          <button
            type="button"
            aria-label="Pin island"
            aria-pressed={isPinned}
            className="pe-btn pe-ghost pe-press"
            onClick={(e) => {
              e.stopPropagation();
              setIsPinned(!isPinned);
            }}
            style={{ color: isPinned ? C.signal : undefined }}
          >
            <IconPin filled={isPinned} />
          </button>

          <button
            type="button"
            aria-label="Settings"
            className="pe-btn pe-ghost pe-press"
            onClick={(e) => e.stopPropagation()}
          >
            <IconGear />
          </button>

          <button
            type="button"
            aria-label="Close island"
            className="pe-btn pe-ghost pe-press"
            onClick={(e) => {
              e.stopPropagation();
              toIdle();
            }}
          >
            <IconClose />
          </button>
        </div>
      </div>

      {/* ================================ BODY ================================ */}
      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          marginTop: 10,
          gap: 0,
        }}
      >
        {/* ---------------- LEFT: NOW PLAYING ---------------- */}
        <section
          aria-label="Now playing"
          style={{
            flex: 1.15,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingRight: 20,
          }}
        >
          {/* Artwork + meta */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                overflow: "hidden",
                flexShrink: 0,
                backgroundColor: C.surface,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.textFaint,
                boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
              }}
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <IconMusic size={22} />
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 650,
                  letterSpacing: "-0.015em",
                  color: isPlaceholder ? C.textDim : C.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {effectiveTitle}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: C.textDim,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: 2,
                }}
              >
                {effectiveArtist}
              </div>
            </div>

            {/* Live equalizer */}
            <div
              className={`pe-eq${isPlaying && !isPlaceholder ? " on" : ""}`}
              aria-hidden="true"
              style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 16, flexShrink: 0 }}
            >
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>

          {/* Waveform scrubber */}
          <div>
            <div
              ref={scrubberTrackRef}
              role="slider"
              aria-label="Track position"
              aria-valuemin={0}
              aria-valuemax={Math.round(effectiveDuration / 1000)}
              aria-valuenow={Math.round(effectivePosition / 1000)}
              onPointerDown={handleScrubPointerDown}
              onPointerMove={handleScrubPointerMove}
              onPointerUp={handleScrubPointerUp}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                height: 22,
                cursor: "pointer",
                touchAction: "none",
              }}
            >
              {barHeights.map((h, i) => (
                <span
                  key={i}
                  className="pe-bar"
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    borderRadius: 2,
                    backgroundColor: i < playedBars ? C.signal : "rgba(255,255,255,0.16)",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 3,
                fontSize: 10.5,
                color: C.textFaint,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span>{formatTime(effectivePosition)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>

          {/* Transport */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 22,
            }}
          >
            <button
              type="button"
              aria-label="Previous track"
              className="pe-btn pe-press"
              disabled={hasSession && !canPrevious}
              onClick={handlePrevious}
              style={{ width: 34, height: 34, borderRadius: "50%", color: C.text }}
            >
              <IconPrev />
            </button>

            <button
              type="button"
              aria-label={isPlaying ? "Pause" : "Play"}
              className="pe-btn pe-press"
              disabled={hasSession && !canPlayPause}
              onClick={handlePlayPause}
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                backgroundColor: C.text,
                color: C.ink,
              }}
            >
              {isPlaying ? <IconPause /> : <IconPlay />}
            </button>

            <button
              type="button"
              aria-label="Next track"
              className="pe-btn pe-press"
              disabled={hasSession && !canNext}
              onClick={handleNext}
              style={{ width: 34, height: 34, borderRadius: "50%", color: C.text }}
            >
              <IconNext />
            </button>
          </div>
        </section>

        {/* Divider */}
        <div
          aria-hidden="true"
          style={{ width: 1, alignSelf: "stretch", backgroundColor: C.hairline, flexShrink: 0 }}
        />

        {/* ---------------- RIGHT: SYSTEM ---------------- */}
        <section
          aria-label="System controls"
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingLeft: 20,
          }}
        >
          {/* Switches */}
          <div style={{ display: "flex", gap: 6 }}>
            <Switch
              label="Wi-Fi"
              sub={isWifiOn ? wifiName || "Connected" : "Off"}
              on={isWifiOn}
              onToggle={handleToggleWifi}
            >
              <IconWifi />
            </Switch>
            <Switch
              label="Bluetooth"
              sub={isBluetoothOn ? "On" : "Off"}
              on={isBluetoothOn}
              onToggle={handleToggleBluetooth}
            >
              <IconBluetooth />
            </Switch>
            <Switch
              label="Saver"
              sub={isEnergySaverOn ? "Low power" : "Off"}
              on={isEnergySaverOn}
              onToggle={handleToggleEnergySaver}
              tone="warn"
            >
              <IconLeaf />
            </Switch>
          </div>

          {/* Volume: tick meter */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              aria-label={speakerLevel === 0 ? "Unmute" : "Mute"}
              className="pe-btn pe-press"
              onClick={toggleMute}
              style={{ width: 24, height: 24, color: speakerLevel === 0 ? C.textDim : C.text, flexShrink: 0 }}
            >
              <IconSpeaker level={speakerLevel} />
            </button>

            <div
              ref={volumeTrackRef}
              role="slider"
              aria-label="Volume"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(volume * 100)}
              onPointerDown={handleVolumePointerDown}
              onPointerMove={handleVolumePointerMove}
              onPointerUp={handleVolumePointerUp}
              style={{
                flex: 1,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 3,
                cursor: "pointer",
                touchAction: "none",
              }}
            >
              {Array.from({ length: VOL_TICKS }, (_, i) => {
                const on = i < activeTicks;
                const h = 8 + (i / (VOL_TICKS - 1)) * 14;
                return (
                  <span
                    key={i}
                    className="pe-bar"
                    style={{
                      flex: 1,
                      height: h,
                      borderRadius: 2,
                      backgroundColor: on ? C.text : "rgba(255,255,255,0.16)",
                    }}
                  />
                );
              })}
            </div>

            <span
              style={{
                width: 32,
                textAlign: "right",
                fontSize: 12,
                fontWeight: 600,
                color: C.textDim,
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {Math.round(volume * 100)}
            </span>
          </div>

          {/* Battery */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BatteryGlyph level={batteryLevel} charging={isCharging} />
            <span
              style={{
                fontSize: 15,
                fontWeight: 650,
                letterSpacing: "-0.01em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {batteryPct}%
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: isCharging ? C.charge : C.textDim,
              }}
            >
              {isCharging && <IconBolt />}
              {isCharging ? "Charging" : batteryPct <= 20 ? "Low battery" : "On battery"}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}