import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { useMediaStore } from "../../store/mediaStore";
import { useIslandStore } from "../../store/islandStore";

/* ---------------------------------------------------------------------------
 * UI/UX Pro Max Design Intelligence: Helpers & Design Tokens
 * ------------------------------------------------------------------------- */

function formatTime(ms: number): string {
  if (ms <= 0 || isNaN(ms)) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const BAR_COUNT_COMPACT = 42;
const BAR_COUNT_FULL = 72;

/* Scoped CSS with Accessibility & Motion Discipline */
const CSS = `
  .pe-glass-surface {
    background: rgba(255, 255, 255, 0.045);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }
  .pe-glass-pill {
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.09);
  }
  
  /* Live Audio Equalizer Keyframes (GPU Accelerated) */
  @keyframes eq-scale-1 {
    0%, 100% { transform: scaleY(0.25); }
    50% { transform: scaleY(0.95); }
  }
  @keyframes eq-scale-2 {
    0%, 100% { transform: scaleY(0.40); }
    50% { transform: scaleY(1.00); }
  }
  @keyframes eq-scale-3 {
    0%, 100% { transform: scaleY(0.20); }
    50% { transform: scaleY(0.80); }
  }
  @keyframes eq-scale-4 {
    0%, 100% { transform: scaleY(0.35); }
    50% { transform: scaleY(0.90); }
  }
  .pe-eq-bar {
    transform-origin: bottom;
    will-change: transform;
    height: 100%;
  }
  .pe-eq-bar-1 { animation: eq-scale-1 0.85s ease-in-out infinite; }
  .pe-eq-bar-2 { animation: eq-scale-2 0.7s ease-in-out infinite 0.15s; }
  .pe-eq-bar-3 { animation: eq-scale-3 0.95s ease-in-out infinite 0.3s; }
  .pe-eq-bar-4 { animation: eq-scale-4 0.75s ease-in-out infinite 0.08s; }
  .pe-eq-paused { animation: none !important; transform: scaleY(0.25) !important; }

  @media (prefers-reduced-motion: reduce) {
    .pe-eq-bar-1, .pe-eq-bar-2, .pe-eq-bar-3, .pe-eq-bar-4 {
      animation: none !important;
      transform: scaleY(0.4) !important;
    }
  }
`;

/* ---------------------------------------------------------------------------
 * Vector SVG Icons (Stroke-width 2px, High Contrast)
 * ------------------------------------------------------------------------- */

type IconProps = { size?: number; className?: string };

const IconOverview = ({ size = 15, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const IconMusic = ({ size = 15, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const IconTune = ({ size = 15, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const IconWifi = ({ size = 17, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

const IconBluetooth = ({ size = 17, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
  </svg>
);

const IconLeaf = ({ size = 17, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);

const IconCloud = ({ size = 14, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" />
  </svg>
);

const IconPin = ({ size = 14, filled = false, className = "" }: IconProps & { filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-2l-2-3V5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v7l-2 3v2z" />
  </svg>
);

const IconClose = ({ size = 14, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconPrev = ({ size = 18, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <rect x="4" y="5" width="2.6" height="14" rx="1.1" />
    <path d="M20 5.8v12.4a1 1 0 0 1-1.55.83L9.2 12.83a1 1 0 0 1 0-1.66l9.25-6.2A1 1 0 0 1 20 5.8z" />
  </svg>
);

const IconNext = ({ size = 18, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <rect x="17.4" y="5" width="2.6" height="14" rx="1.1" />
    <path d="M4 5.8v12.4a1 1 0 0 0 1.55.83l9.25-6.2a1 1 0 0 0 0-1.66L5.55 4.97A1 1 0 0 0 4 5.8z" />
  </svg>
);

const IconPlay = ({ size = 20, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M7 4.6v14.8a1 1 0 0 0 1.52.85l12-7.4a1 1 0 0 0 0-1.7l-12-7.4A1 1 0 0 0 7 4.6z" />
  </svg>
);

const IconPause = ({ size = 20, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <rect x="5.5" y="4" width="4.6" height="16" rx="1.4" />
    <rect x="13.9" y="4" width="4.6" height="16" rx="1.4" />
  </svg>
);

const IconSpeaker = ({ level, size = 17, className = "" }: { level: 0 | 1 | 2; size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
    {level === 0 && (
      <>
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </>
    )}
    {level >= 1 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
    {level >= 2 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
  </svg>
);

const IconBolt = ({ size = 11, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.7L13.5 2z" />
  </svg>
);

/* ---------------------------------------------------------------------------
 * Apple Battery Capsule Component
 * ------------------------------------------------------------------------- */

function AppleBatteryGlyph({ level, charging }: { level: number; charging: boolean }) {
  const pct = Math.round(clamp01(level) * 100);
  const color = charging
    ? "#34D399" // emerald
    : pct <= 20
    ? "#EF4444" // red alert
    : pct <= 35
    ? "#F59E0B" // amber warn
    : "#F8FAFC"; // crisp light

  const fillWidth = Math.max(2, clamp01(level) * 22);

  return (
    <div className="relative inline-flex items-center" aria-hidden="true">
      <svg width="30" height="14" viewBox="0 0 30 14" fill="none">
        {/* Outer pill frame */}
        <rect x="0.75" y="0.75" width="25" height="12.5" rx="4" stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.45" />
        {/* Fill level */}
        <rect x="2.5" y="2.5" width={fillWidth} height="9" rx="2.2" fill={color} />
        {/* Terminal nub */}
        <path d="M28 4.8v4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.45" />
      </svg>
      {charging && (
        <span className="absolute inset-0 flex items-center justify-center text-black drop-shadow-sm pr-1">
          <IconBolt size={10} />
        </span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Tactile Switch Button
 * ------------------------------------------------------------------------- */

interface TactileSwitchProps {
  label: string;
  sub: string;
  active: boolean;
  onToggle: (e: React.MouseEvent) => void;
  accent: "blue" | "indigo" | "amber" | "emerald";
  icon: React.ReactNode;
}

function TactileSwitch({ label, sub, active, onToggle, accent, icon }: TactileSwitchProps) {
  const accentClasses = {
    blue: active
      ? "bg-blue-500 text-white shadow-[0_4px_16px_rgba(59,130,246,0.35)] border-blue-400/50"
      : "bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white border-white/[0.07]",
    indigo: active
      ? "bg-indigo-500 text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)] border-indigo-400/50"
      : "bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white border-white/[0.07]",
    amber: active
      ? "bg-amber-500 text-black shadow-[0_4px_16px_rgba(245,158,11,0.35)] border-amber-300/60"
      : "bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white border-white/[0.07]",
    emerald: active
      ? "bg-emerald-500 text-black shadow-[0_4px_16px_rgba(16,185,129,0.35)] border-emerald-300/60"
      : "bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white border-white/[0.07]",
  }[accent];

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${label}: ${sub}`}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onToggle}
      className={`group relative flex-1 min-w-0 flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border transition-[transform,background-color,border-color,box-shadow] duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${accentClasses}`}
    >
      <div className={`p-2 rounded-[10px] transition-[transform,color] duration-200 ${active ? "scale-105" : "text-white/70 group-hover:text-white"}`}>
        {icon}
      </div>
      <div className="text-center w-full px-1">
        <div className="text-[12px] font-bold tracking-tight truncate leading-tight">
          {label}
        </div>
        <div className={`text-[10px] truncate font-medium mt-0.5 ${active ? "opacity-90" : "text-slate-400"}`}>
          {sub}
        </div>
      </div>
    </motion.button>
  );
}

/* ---------------------------------------------------------------------------
 * Main PlayerExpanded Component
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

  const [activeTab, setActiveTab] = useState<number>(0);
  const [isPinned, setIsPinned] = useState(false);

  /* ------------------------------ System State ------------------------------ */
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
      .catch(() => {});
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
      .catch(() => {});
  };

  const handleToggleBluetooth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isBluetoothOn;
    setIsBluetoothOn(next);
    invoke("system_toggle_bluetooth", { enable: next })
      .then(() => fetchSystemControls())
      .catch(() => {});
  };

  const handleToggleEnergySaver = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isEnergySaverOn;
    setIsEnergySaverOn(next);
    invoke("system_toggle_energy_saver")
      .then(() => fetchSystemControls())
      .catch(() => {});
  };

  /* Battery API fallback */
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
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      if (batteryInstance) {
        try {
          if (onLevelChange) batteryInstance.removeEventListener("levelchange", onLevelChange);
          if (onChargingChange) batteryInstance.removeEventListener("chargingchange", onChargingChange);
        } catch {}
      }
    };
  }, []);

  /* --------------------------------- Volume --------------------------------- */
  const [volume, setVolume] = useState<number>(0.75);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState<number>(0.75);
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
      .catch(() => {});
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
    if (ratio > 0) {
      setPrevVolume(ratio);
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
    invoke("media_set_volume", { volume: ratio }).catch(() => {});
  }, []);

  const handleVolumeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = clamp01(volume + 0.05);
      setVolume(next);
      setPrevVolume(next);
      setIsMuted(false);
      invoke("media_set_volume", { volume: next }).catch(() => {});
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = clamp01(volume - 0.05);
      setVolume(next);
      if (next > 0) setPrevVolume(next);
      setIsMuted(next === 0);
      invoke("media_set_volume", { volume: next }).catch(() => {});
    }
  };

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
    } catch {}
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMuted || volume === 0) {
      const restored = prevVolume > 0 ? prevVolume : 0.5;
      setVolume(restored);
      setIsMuted(false);
      invoke("media_set_volume", { volume: restored }).catch(() => {});
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
      invoke("media_set_volume", { volume: 0 }).catch(() => {});
    }
  };

  /* --------------------------- Scrubber / Transport --------------------------- */
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
    if (canPlayPause || !hasSession) invoke("media_play_pause").catch(() => {});
  };
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canNext || !hasSession) invoke("media_next").catch(() => {});
  };
  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canPrevious || !hasSession) invoke("media_previous").catch(() => {});
  };

  const scrubTo = (clientX: number) => {
    if (!scrubberTrackRef.current) return;
    const dur = durationMs > 0 ? durationMs : 240000;
    const rect = scrubberTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = clamp01((clientX - rect.left) / rect.width);
    setDisplayPositionMs(ratio * dur);
  };

  const handleScrubKeyDown = (e: React.KeyboardEvent) => {
    const dur = durationMs > 0 ? durationMs : 240000;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = Math.min(dur, displayPositionMs + 5000);
      setDisplayPositionMs(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = Math.max(0, displayPositionMs - 5000);
      setDisplayPositionMs(next);
    }
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
    } catch {}
  };

  /* ----------------------------- Derived Values ----------------------------- */
  const isPlaceholder = !hasSession || !title;
  const effectiveTitle = isPlaceholder ? "Not Playing" : title;
  const effectiveArtist = isPlaceholder ? "Start audio in any app" : artist || "Unknown Artist";
  const effectiveDuration = isPlaceholder ? 0 : durationMs > 0 ? durationMs : 0;
  const effectivePosition = isPlaceholder ? 0 : displayPositionMs > 0 ? displayPositionMs : 0;
  const scrubRatio = effectiveDuration > 0 ? clamp01(effectivePosition / effectiveDuration) : 0;

  /* Waveform audio silhouette (Compact & Full) */
  const barHeightsCompact = useMemo(
    () =>
      Array.from({ length: BAR_COUNT_COMPACT }, (_, i) => {
        const v = Math.abs(Math.sin(i * 1.55) * Math.cos(i * 0.45)) * 0.72 + Math.abs(Math.sin(i * 0.28)) * 0.28;
        return 24 + v * 76;
      }),
    []
  );

  const barHeightsFull = useMemo(
    () =>
      Array.from({ length: BAR_COUNT_FULL }, (_, i) => {
        const v = Math.abs(Math.sin(i * 0.95) * Math.cos(i * 0.35)) * 0.7 + Math.abs(Math.sin(i * 0.18)) * 0.3;
        return 22 + v * 78;
      }),
    []
  );

  const playedBarsCompact = Math.round(scrubRatio * BAR_COUNT_COMPACT);
  const playedBarsFull = Math.round(scrubRatio * BAR_COUNT_FULL);

  const speakerLevel: 0 | 1 | 2 = isMuted || volume === 0 ? 0 : volume > 0.5 ? 2 : 1;
  const batteryPct = Math.round(clamp01(batteryLevel) * 100);

  const tabs = [
    { label: "Overview", icon: <IconOverview size={15} /> },
    { label: "Now Playing", icon: <IconMusic size={15} /> },
    { label: "Controls", icon: <IconTune size={15} /> },
  ];

  /* ---------------------------------------------------------------------------
   * View Renderers
   * ------------------------------------------------------------------------- */

  // Left Bento (Overview Tab)
  const renderNowPlayingCompact = () => (
    <div className="relative flex-1 min-w-0 flex flex-col justify-between p-4.5 rounded-2xl pe-glass-surface overflow-hidden">
      {/* Ambient Album Glow behind card */}
      {thumbnailUrl && (
        <div
          className="absolute -top-10 -left-10 w-44 h-44 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundImage: `url(${thumbnailUrl})`, backgroundSize: "cover" }}
          aria-hidden="true"
        />
      )}

      {/* Top row: Artwork + Meta + Equalizer */}
      <div className="relative z-10 flex items-center gap-3.5">
        {/* Album Artwork Squircle */}
        <div className="relative w-14 h-14 rounded-[14px] overflow-hidden bg-white/5 border border-white/10 shadow-xl flex-shrink-0 flex items-center justify-center">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt="Album cover"
              className="w-full h-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
            />
          ) : (
            <div className="text-slate-400">
              <IconMusic size={24} />
            </div>
          )}
        </div>

        {/* Track Title & Artist */}
        <div
          className="flex-1 min-w-0"
          style={{
            maskImage: "linear-gradient(to right, black 85%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, black 85%, transparent 100%)",
          }}
        >
          <div
            className={`text-[15px] font-bold tracking-tight truncate leading-tight [text-wrap:balance] ${
              isPlaceholder ? "text-slate-400 font-normal" : "text-slate-50"
            }`}
          >
            {effectiveTitle}
          </div>
          <div className="text-[13px] text-slate-400 truncate mt-1 font-medium [text-wrap:pretty]">{effectiveArtist}</div>
        </div>

        {/* Live Audio Equalizer */}
        <div
          className="flex items-end gap-[2.5px] h-5 w-5 flex-shrink-0 pr-1"
          title={isPlaying ? "Playing" : "Paused"}
          aria-hidden="true"
        >
          <span className={`w-[3px] rounded-full bg-indigo-400 pe-eq-bar ${isPlaying && !isPlaceholder ? "pe-eq-bar-1" : "pe-eq-paused"}`} />
          <span className={`w-[3px] rounded-full bg-indigo-400 pe-eq-bar ${isPlaying && !isPlaceholder ? "pe-eq-bar-2" : "pe-eq-paused"}`} />
          <span className={`w-[3px] rounded-full bg-indigo-400 pe-eq-bar ${isPlaying && !isPlaceholder ? "pe-eq-bar-3" : "pe-eq-paused"}`} />
          <span className={`w-[3px] rounded-full bg-indigo-400 pe-eq-bar ${isPlaying && !isPlaceholder ? "pe-eq-bar-4" : "pe-eq-paused"}`} />
        </div>
      </div>

      {/* Mid: Waveform Scrubber */}
      <div className="relative z-10 my-1.5">
        <div
          ref={scrubberTrackRef}
          role="slider"
          aria-label="Track progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(effectiveDuration / 1000)}
          aria-valuenow={Math.round(effectivePosition / 1000)}
          onKeyDown={handleScrubKeyDown}
          onPointerDown={handleScrubPointerDown}
          onPointerMove={handleScrubPointerMove}
          onPointerUp={handleScrubPointerUp}
          className="group flex items-center justify-between gap-[2px] h-6 cursor-pointer touch-none py-1 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none rounded-lg"
          tabIndex={0}
        >
          {barHeightsCompact.map((h, i) => {
            const isPlayed = i < playedBarsCompact;
            return (
              <span
                key={i}
                className="flex-1 rounded-[1.5px] transition-colors duration-150"
                style={{
                  height: `${h}%`,
                  backgroundColor: isPlayed ? "#818CF8" : "rgba(255, 255, 255, 0.13)",
                  boxShadow: isPlayed ? "0 0 6px rgba(129, 140, 248, 0.35)" : "none",
                }}
              />
            );
          })}
        </div>

        {/* Timestamps */}
        <div className="flex justify-between text-[11px] font-medium text-slate-400 font-mono tracking-tight tabular-nums mt-1">
          <span>{formatTime(effectivePosition)}</span>
          <span>{formatTime(effectiveDuration)}</span>
        </div>
      </div>

      {/* Bottom: Transport Controls */}
      <div className="relative z-10 flex items-center justify-center gap-6 mt-1">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={handlePrevious}
          disabled={hasSession && !canPrevious}
          aria-label="Previous track"
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
        >
          <IconPrev size={18} />
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={handlePlayPause}
          disabled={hasSession && !canPlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg shadow-white/20 hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
        >
          {isPlaying ? <IconPause size={20} /> : <IconPlay size={20} className="translate-x-0.5" />}
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={handleNext}
          disabled={hasSession && !canNext}
          aria-label="Next track"
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
        >
          <IconNext size={18} />
        </motion.button>
      </div>
    </div>
  );

  // Right Bento (Overview Tab)
  const renderSystemCompact = () => (
    <div className="flex-1 min-w-0 flex flex-col justify-between p-4.5 rounded-2xl pe-glass-surface">
      {/* 3 Control Center Switches */}
      <div className="flex items-center gap-2.5">
        <TactileSwitch
          label="Wi-Fi"
          sub={isWifiOn ? wifiName || "Connected" : "Off"}
          active={isWifiOn}
          onToggle={handleToggleWifi}
          accent="blue"
          icon={<IconWifi size={18} />}
        />
        <TactileSwitch
          label="Bluetooth"
          sub={isBluetoothOn ? "On" : "Off"}
          active={isBluetoothOn}
          onToggle={handleToggleBluetooth}
          accent="indigo"
          icon={<IconBluetooth size={18} />}
        />
        <TactileSwitch
          label="Saver"
          sub={isEnergySaverOn ? "Low Power" : "Off"}
          active={isEnergySaverOn}
          onToggle={handleToggleEnergySaver}
          accent="amber"
          icon={<IconLeaf size={18} />}
        />
      </div>

      {/* Volume Controller */}
      <div className="flex items-center gap-3 my-1.5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={toggleMute}
          aria-label={speakerLevel === 0 ? "Unmute" : "Mute"}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${
            speakerLevel === 0 ? "text-slate-500 hover:text-slate-300" : "text-slate-300 hover:text-white"
          }`}
        >
          <IconSpeaker level={speakerLevel} size={17} />
        </motion.button>

        <div
          ref={volumeTrackRef}
          role="slider"
          aria-label="Volume level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volume * 100)}
          onKeyDown={handleVolumeKeyDown}
          onPointerDown={handleVolumePointerDown}
          onPointerMove={handleVolumePointerMove}
          onPointerUp={handleVolumePointerUp}
          className="group relative flex-1 h-7 flex items-center cursor-pointer touch-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none rounded-lg"
          tabIndex={0}
        >
          {/* Pill track */}
          <div className="relative w-full h-2.5 bg-white/[0.08] group-hover:bg-white/[0.12] rounded-full overflow-hidden transition-colors">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/90 to-white rounded-full transition-[width] duration-75"
              style={{ width: `${volume * 100}%` }}
            />
          </div>

          {/* Glowing thumb on hover/drag */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md shadow-black/40 pointer-events-none transition-transform duration-150 group-hover:scale-125 group-active:scale-125"
            style={{ left: `calc(${volume * 100}% - 8px)` }}
          />
        </div>

        <span className="text-[13px] font-bold text-slate-300 font-mono tabular-nums w-8 text-right">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Bottom Bar: Battery & Status */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <AppleBatteryGlyph level={batteryLevel} charging={isCharging} />
          <span className="text-[13px] font-bold text-slate-100 font-mono tabular-nums">
            {batteryPct}%
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            {isCharging ? "Charging" : batteryPct <= 20 ? "Low Power" : "On Battery"}
          </span>
        </div>

        {isEnergySaverOn && (
          <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/25">
            Eco
          </span>
        )}
      </div>
    </div>
  );

  // Dedicated "Now Playing" View (Immersive Music Stage)
  const renderNowPlayingDedicated = () => (
    <div className="relative w-full h-full flex flex-col justify-between p-5 rounded-2xl pe-glass-surface overflow-hidden">
      {thumbnailUrl && (
        <div
          className="absolute -top-16 -left-16 w-64 h-64 rounded-full blur-3xl opacity-35 pointer-events-none"
          style={{ backgroundImage: `url(${thumbnailUrl})`, backgroundSize: "cover" }}
          aria-hidden="true"
        />
      )}

      {/* Header Info */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-xl flex-shrink-0 flex items-center justify-center">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Album artwork" className="w-full h-full object-cover" />
            ) : (
              <div className="text-slate-400">
                <IconMusic size={28} />
              </div>
            )}
          </div>
          <div
            className="flex-1 min-w-0"
            style={{
              maskImage: "linear-gradient(to right, black 85%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to right, black 85%, transparent 100%)",
            }}
          >
            <div className="text-base font-bold text-slate-50 tracking-tight leading-tight truncate max-w-[360px]">
              {effectiveTitle}
            </div>
            <div className="text-sm text-slate-400 font-medium mt-1 truncate max-w-[360px]">
              {effectiveArtist}
            </div>
          </div>
        </div>

        {/* Quality Badge & Equalizer */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-1 rounded-full">
            Lossless
          </span>
          <div className="flex items-end gap-[3px] h-6 w-6 pr-1" aria-hidden="true">
            <span className={`w-[3px] rounded-full bg-indigo-400 pe-eq-bar ${isPlaying && !isPlaceholder ? "pe-eq-bar-1" : "pe-eq-paused"}`} />
            <span className={`w-[3px] rounded-full bg-indigo-400 pe-eq-bar ${isPlaying && !isPlaceholder ? "pe-eq-bar-2" : "pe-eq-paused"}`} />
            <span className={`w-[3px] rounded-full bg-indigo-400 pe-eq-bar ${isPlaying && !isPlaceholder ? "pe-eq-bar-3" : "pe-eq-paused"}`} />
            <span className={`w-[3px] rounded-full bg-indigo-400 pe-eq-bar ${isPlaying && !isPlaceholder ? "pe-eq-bar-4" : "pe-eq-paused"}`} />
          </div>
        </div>
      </div>

      {/* Expanded Waveform Scrubber */}
      <div className="relative z-10 my-2">
        <div
          ref={scrubberTrackRef}
          role="slider"
          aria-label="Track progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(effectiveDuration / 1000)}
          aria-valuenow={Math.round(effectivePosition / 1000)}
          onKeyDown={handleScrubKeyDown}
          onPointerDown={handleScrubPointerDown}
          onPointerMove={handleScrubPointerMove}
          onPointerUp={handleScrubPointerUp}
          className="group flex items-center justify-between gap-[2px] h-8 cursor-pointer touch-none py-1 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none rounded-lg"
          tabIndex={0}
        >
          {barHeightsFull.map((h, i) => {
            const isPlayed = i < playedBarsFull;
            return (
              <span
                key={i}
                className="flex-1 rounded-[1.5px] transition-colors duration-150"
                style={{
                  height: `${h}%`,
                  backgroundColor: isPlayed ? "#818CF8" : "rgba(255, 255, 255, 0.12)",
                  boxShadow: isPlayed ? "0 0 6px rgba(129, 140, 248, 0.4)" : "none",
                }}
              />
            );
          })}
        </div>

        <div className="flex justify-between text-xs font-medium text-slate-400 font-mono tabular-nums mt-1">
          <span>{formatTime(effectivePosition)}</span>
          <span>{formatTime(effectiveDuration)}</span>
        </div>
      </div>

      {/* Transport & Actions */}
      <div className="relative z-10 flex items-center justify-center gap-8">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={handlePrevious}
          disabled={hasSession && !canPrevious}
          aria-label="Previous track"
          className="w-11 h-11 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
        >
          <IconPrev size={20} />
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={handlePlayPause}
          disabled={hasSession && !canPlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-13 h-13 rounded-full bg-white text-black flex items-center justify-center shadow-xl shadow-white/20 hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
        >
          {isPlaying ? <IconPause size={22} /> : <IconPlay size={22} className="translate-x-0.5" />}
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={handleNext}
          disabled={hasSession && !canNext}
          aria-label="Next track"
          className="w-11 h-11 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
        >
          <IconNext size={20} />
        </motion.button>
      </div>
    </div>
  );

  // Dedicated "Controls" View (Hardware Dashboard Mode)
  const renderControlsDedicated = () => (
    <div className="w-full h-full flex flex-col justify-between p-5 rounded-2xl pe-glass-surface">
      {/* Top: 3 Large Control Center Cards */}
      <div className="grid grid-cols-3 gap-3.5">
        <TactileSwitch
          label="Wi-Fi"
          sub={isWifiOn ? wifiName || "Connected" : "Off"}
          active={isWifiOn}
          onToggle={handleToggleWifi}
          accent="blue"
          icon={<IconWifi size={20} />}
        />
        <TactileSwitch
          label="Bluetooth"
          sub={isBluetoothOn ? "On" : "Off"}
          active={isBluetoothOn}
          onToggle={handleToggleBluetooth}
          accent="indigo"
          icon={<IconBluetooth size={20} />}
        />
        <TactileSwitch
          label="Energy Saver"
          sub={isEnergySaverOn ? "Active" : "Disabled"}
          active={isEnergySaverOn}
          onToggle={handleToggleEnergySaver}
          accent="amber"
          icon={<IconLeaf size={20} />}
        />
      </div>

      {/* Mid: Master Volume Slider with Haptic Pill */}
      <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={toggleMute}
          aria-label={speakerLevel === 0 ? "Unmute" : "Mute"}
          className={`p-2.5 rounded-xl transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${
            speakerLevel === 0 ? "text-slate-500 hover:text-slate-300" : "text-slate-200 hover:text-white"
          }`}
        >
          <IconSpeaker level={speakerLevel} size={20} />
        </motion.button>

        <div
          ref={volumeTrackRef}
          role="slider"
          aria-label="Volume level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volume * 100)}
          onKeyDown={handleVolumeKeyDown}
          onPointerDown={handleVolumePointerDown}
          onPointerMove={handleVolumePointerMove}
          onPointerUp={handleVolumePointerUp}
          className="group relative flex-1 h-8 flex items-center cursor-pointer touch-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none rounded-lg"
          tabIndex={0}
        >
          <div className="relative w-full h-3 bg-white/[0.08] group-hover:bg-white/[0.12] rounded-full overflow-hidden transition-colors">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-400 to-white rounded-full transition-[width] duration-75"
              style={{ width: `${volume * 100}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4.5 h-4.5 bg-white rounded-full shadow-lg shadow-black/50 pointer-events-none transition-transform duration-150 group-hover:scale-125 group-active:scale-125"
            style={{ left: `calc(${volume * 100}% - 9px)` }}
          />
        </div>

        <span className="text-sm font-bold text-slate-200 font-mono tabular-nums w-10 text-right">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Bottom: Battery Hardware Glance */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <AppleBatteryGlyph level={batteryLevel} charging={isCharging} />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100 font-mono tabular-nums">
                {batteryPct}%
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {isCharging ? "Charging" : batteryPct <= 20 ? "Low Power" : "On Battery"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEnergySaverOn && (
            <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/25">
              Eco Mode
            </span>
          )}
          <span className="text-xs font-semibold text-slate-400 bg-white/[0.05] border border-white/[0.07] px-3 py-1 rounded-full">
            Windows Media
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between px-6 pt-3.5 pb-4.5 select-none text-slate-100 font-sans pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <style>{CSS}</style>

      {/* =========================================================================
       * TOP BAR: Segmented Pill Switcher & Quick Utility Chips
       * ========================================================================= */}
      <div className="flex items-center justify-between h-8 px-1 flex-shrink-0">
        {/* Sliding Segmented Pill */}
        <div
          role="tablist"
          aria-label="Expanded island modes"
          className="relative flex items-center p-1 bg-white/[0.05] border border-white/[0.07] rounded-full"
        >
          {tabs.map((tab, idx) => {
            const isCurrent = activeTab === idx;
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab(idx);
                }}
                className={`relative z-10 flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${
                  isCurrent ? "text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {isCurrent && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    className="absolute inset-0 bg-white/[0.14] border border-white/[0.12] rounded-full shadow-sm"
                  />
                )}
                <span className="relative z-10">{tab.icon}</span>
                <span className="relative z-10 text-[12px] tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Utility Island */}
        <div className="flex items-center gap-2.5">
          {/* Weather Glance Pill */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full pe-glass-pill text-xs font-semibold text-slate-300"
            title="Weather: 33°C Clear"
          >
            <IconCloud size={14} className="text-sky-300" />
            <span className="font-bold text-white tracking-tight">33°C</span>
          </div>

          <span className="w-px h-4 bg-white/10" aria-hidden="true" />

          {/* Pin Toggle */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsPinned(!isPinned);
            }}
            aria-label="Pin island"
            aria-pressed={isPinned}
            title={isPinned ? "Unpin island" : "Pin island"}
            className={`p-2 rounded-full transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${
              isPinned
                ? "text-indigo-300 bg-indigo-500/20 border border-indigo-500/40"
                : "text-slate-400 hover:text-white hover:bg-white/[0.08]"
            }`}
          >
            <IconPin size={14} filled={isPinned} />
          </motion.button>

          {/* Close / Collapse Island */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              toIdle();
            }}
            aria-label="Close island"
            title="Collapse"
            className="p-2 rounded-full text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none"
          >
            <IconClose size={14} />
          </motion.button>
        </div>
      </div>

      {/* =========================================================================
       * MAIN CONTENT STAGE (Animated Tab Switching)
       * ========================================================================= */}
      <div className="flex-1 min-h-0 mt-3">
        <AnimatePresence mode="wait">
          {activeTab === 0 && (
            <motion.div
              key="tab-overview"
              initial={{ opacity: 0, scale: 0.98, y: 3 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -3 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              className="w-full h-full flex gap-3.5"
            >
              {renderNowPlayingCompact()}
              {renderSystemCompact()}
            </motion.div>
          )}

          {activeTab === 1 && (
            <motion.div
              key="tab-now-playing"
              initial={{ opacity: 0, scale: 0.98, y: 3 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -3 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              className="w-full h-full"
            >
              {renderNowPlayingDedicated()}
            </motion.div>
          )}

          {activeTab === 2 && (
            <motion.div
              key="tab-controls"
              initial={{ opacity: 0, scale: 0.98, y: 3 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -3 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              className="w-full h-full"
            >
              {renderControlsDedicated()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}