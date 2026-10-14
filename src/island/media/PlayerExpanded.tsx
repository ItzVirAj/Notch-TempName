import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { useMediaStore } from "../../store/mediaStore";
import { useIslandStore } from "../../store/islandStore";

/* ============================================================================
 * PlayerExpanded — "Obsidian Deck" design overhaul
 *
 * Design language:
 *  - Single-view editorial layout: no tabs, everything glanceable at once
 *    (HIG: transient surfaces should not require navigation).
 *  - Dynamic accent color sampled from the album artwork; the whole panel
 *    tints to whatever is playing. Falls back to warm brass when no art.
 *  - Matte obsidian surfaces: layered solid rgba + hairline strokes.
 *    NO backdrop-filter (per project performance rules).
 *  - Mono tabular numerals for all time/percent readouts.
 *  - Equalizer animates only while actually playing; honors
 *    prefers-reduced-motion.
 * ========================================================================== */

/* ----------------------------- Utilities --------------------------------- */

function formatTime(ms: number): string {
  if (ms <= 0 || isNaN(ms)) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Default accent when no artwork is available: warm brass. */
const FALLBACK_ACCENT = { r: 235, g: 185, b: 110 };

/** rgba() helper from an {r,g,b} triple. */
const rgba = (c: { r: number; g: number; b: number }, a: number) =>
  `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;

/**
 * Sample a dominant accent color from the artwork by averaging a tiny
 * downscaled canvas, then lifting it toward a vivid, readable tone.
 * Runs once per thumbnail URL — zero per-frame cost.
 */
function useAccentColor(thumbnailUrl: string | null) {
  const [accent, setAccent] = useState(FALLBACK_ACCENT);

  useEffect(() => {
    if (!thumbnailUrl) {
      setAccent(FALLBACK_ACCENT);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 12;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          // Skip near-black / near-white pixels so letterboxing and glare
          // don't wash out the sampled tone.
          const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (lum < 24 || lum > 235) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (count === 0) {
          setAccent(FALLBACK_ACCENT);
          return;
        }
        r /= count; g /= count; b /= count;
        // Lift toward a vivid, legible accent: boost saturation + brightness.
        const max = Math.max(r, g, b) || 1;
        const boost = 215 / max;
        const sat = 1.35;
        const mean = (r + g + b) / 3;
        const lift = (ch: number) =>
          Math.round(Math.max(70, Math.min(255, (mean + (ch - mean) * sat) * boost)));
        setAccent({ r: lift(r), g: lift(g), b: lift(b) });
      } catch {
        setAccent(FALLBACK_ACCENT);
      }
    };
    img.onerror = () => { if (!cancelled) setAccent(FALLBACK_ACCENT); };
    img.src = thumbnailUrl;
    return () => { cancelled = true; };
  }, [thumbnailUrl]);

  return accent;
}

/* --------------------------- Scoped keyframes ----------------------------- */

const CSS = `
  @keyframes od-eq-a { 0%,100% { transform: scaleY(0.30); } 50% { transform: scaleY(1.00); } }
  @keyframes od-eq-b { 0%,100% { transform: scaleY(0.55); } 50% { transform: scaleY(0.22); } }
  @keyframes od-eq-c { 0%,100% { transform: scaleY(0.40); } 50% { transform: scaleY(0.85); } }
  @keyframes od-eq-d { 0%,100% { transform: scaleY(0.75); } 50% { transform: scaleY(0.35); } }
  @keyframes od-eq-e { 0%,100% { transform: scaleY(0.25); } 50% { transform: scaleY(0.70); } }

  .od-eq span {
    display: block;
    width: 3px;
    border-radius: 99px;
    height: 100%;
    transform-origin: bottom;
    will-change: transform;
    transform: scaleY(0.25);
  }
  .od-eq.playing span:nth-child(1) { animation: od-eq-a 0.92s ease-in-out infinite; }
  .od-eq.playing span:nth-child(2) { animation: od-eq-b 0.68s ease-in-out infinite 0.12s; }
  .od-eq.playing span:nth-child(3) { animation: od-eq-c 0.81s ease-in-out infinite 0.26s; }
  .od-eq.playing span:nth-child(4) { animation: od-eq-d 0.74s ease-in-out infinite 0.05s; }
  .od-eq.playing span:nth-child(5) { animation: od-eq-e 0.99s ease-in-out infinite 0.33s; }

  @media (prefers-reduced-motion: reduce) {
    .od-eq.playing span { animation: none !important; transform: scaleY(0.5) !important; }
  }
`;

/* ------------------------------- Icons ------------------------------------ */

type IconProps = { size?: number; className?: string };

const IconWifi = ({ size = 16, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

const IconBluetooth = ({ size = 16, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
  </svg>
);

const IconLeaf = ({ size = 16, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);

const IconMusic = ({ size = 16, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const IconPin = ({ size = 13, filled = false, className = "" }: IconProps & { filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-2l-2-3V5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v7l-2 3v2z" />
  </svg>
);

const IconClose = ({ size = 13, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconPrev = ({ size = 17, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <rect x="4" y="5" width="2.6" height="14" rx="1.1" />
    <path d="M20 5.8v12.4a1 1 0 0 1-1.55.83L9.2 12.83a1 1 0 0 1 0-1.66l9.25-6.2A1 1 0 0 1 20 5.8z" />
  </svg>
);

const IconNext = ({ size = 17, className = "" }: IconProps) => (
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

const IconSpeaker = ({ level, size = 15, className = "" }: { level: 0 | 1 | 2; size?: number; className?: string }) => (
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

const IconBolt = ({ size = 10, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.7L13.5 2z" />
  </svg>
);

/* --------------------------- Battery capsule ------------------------------ */

function BatteryCapsule({ level, charging }: { level: number; charging: boolean }) {
  const pct = Math.round(clamp01(level) * 100);
  const color = charging ? "#4ADE80" : pct <= 20 ? "#F87171" : pct <= 35 ? "#FBBF24" : "#E7E5E4";
  const fillWidth = Math.max(2, clamp01(level) * 20);

  return (
    <span className="relative inline-flex items-center" aria-hidden="true">
      <svg width="28" height="13" viewBox="0 0 28 13" fill="none">
        <rect x="0.75" y="0.75" width="23" height="11.5" rx="3.6" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
        <rect x="2.4" y="2.4" width={fillWidth} height="8.2" rx="2" fill={color} />
        <path d="M26.2 4.4v4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
      </svg>
      {charging && (
        <span className="absolute inset-0 flex items-center justify-center text-black pr-1">
          <IconBolt size={9} />
        </span>
      )}
    </span>
  );
}

/* ----------------------------- Dock toggle -------------------------------- */

interface DockToggleProps {
  label: string;
  active: boolean;
  onToggle: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
  title?: string;
}

/**
 * Monochrome control-center chip: active = solid white fill with black
 * glyph; inactive = ghost outline. Cohesive with the accent-tinted panel
 * without fighting it for attention.
 */
function DockToggle({ label, active, onToggle, icon, title }: DockToggleProps) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      title={title || label}
      whileTap={{ scale: 0.93 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      onClick={onToggle}
      className={`flex items-center gap-2 h-9 px-3.5 rounded-full border transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none ${
        active
          ? "bg-white text-black border-white shadow-[0_2px_14px_rgba(255,255,255,0.22)]"
          : "bg-white/[0.04] text-stone-400 border-white/[0.09] hover:text-white hover:bg-white/[0.08]"
      }`}
    >
      {icon}
      <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">{label}</span>
    </motion.button>
  );
}

/* ============================================================================
 * Main component
 * ========================================================================== */

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
    sourceApp,
    isPlaying,
    playbackRate,
    positionMs,
    durationMs,
    canPlayPause,
    canNext,
    canPrevious,
  } = snapshot;

  const [isPinned, setIsPinned] = useState(false);
  const accent = useAccentColor(thumbnailUrl);

  /* ----------------------------- System state ----------------------------- */

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

  // Poll only while the panel is actually open — zero idle work.
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

  /* Browser Battery API fallback (Tauri webview supports it on Windows) */
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

  /* -------------------------------- Volume -------------------------------- */

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

  /* -------------------------- Scrubber / transport ------------------------- */

  const [displayPositionMs, setDisplayPositionMs] = useState(positionMs);
  const isDraggingScrubRef = useRef<boolean>(false);
  const scrubberTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDraggingScrubRef.current) setDisplayPositionMs(positionMs);
  }, [positionMs]);

  // Local 1 Hz tick while the panel is open AND something is playing.
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
      setDisplayPositionMs(Math.min(dur, displayPositionMs + 5000));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setDisplayPositionMs(Math.max(0, displayPositionMs - 5000));
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

  /* ---------------------------- Derived values ----------------------------- */

  const isPlaceholder = !hasSession || !title;
  const effectiveTitle = isPlaceholder ? "Nothing Playing" : title;
  const effectiveArtist = isPlaceholder ? "Start audio in any app to take control" : artist || "Unknown Artist";
  const effectiveDuration = isPlaceholder ? 0 : durationMs > 0 ? durationMs : 0;
  const effectivePosition = isPlaceholder ? 0 : displayPositionMs > 0 ? displayPositionMs : 0;
  const scrubRatio = effectiveDuration > 0 ? clamp01(effectivePosition / effectiveDuration) : 0;

  const speakerLevel: 0 | 1 | 2 = isMuted || volume === 0 ? 0 : volume > 0.5 ? 2 : 1;
  const batteryPct = Math.round(clamp01(batteryLevel) * 100);

  const accentSolid = rgba(accent, 1);
  const eyebrowText = (sourceApp || "System Media").replace(/\.exe$/i, "").toUpperCase();

  // Static ambient tint derived from accent — painted once, zero runtime cost.
  const ambientStyle = useMemo<React.CSSProperties>(
    () => ({
      background: `
        radial-gradient(540px 260px at 18% 0%, ${rgba(accent, 0.16)}, transparent 62%),
        radial-gradient(420px 220px at 88% 110%, ${rgba(accent, 0.09)}, transparent 60%)
      `,
    }),
    [accent]
  );

  /* -------------------------------- Render -------------------------------- */

  return (
    <div
      className="relative w-full h-full flex flex-col select-none text-stone-100 font-sans pointer-events-auto px-6 pt-3 pb-4 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <style>{CSS}</style>

      {/* Ambient accent wash */}
      <div className="absolute inset-0 pointer-events-none" style={ambientStyle} aria-hidden="true" />

      {/* ====================================================================
       *  HEADER — eyebrow source label · equalizer · pin · close
       * ==================================================================== */}
      <div className="relative z-10 flex items-center justify-between h-7 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: accentSolid, boxShadow: `0 0 8px ${rgba(accent, 0.8)}` }}
            aria-hidden="true"
          />
          <span className="text-[10px] font-bold tracking-[0.18em] text-stone-400 truncate">
            {eyebrowText}
          </span>
          <span className="w-px h-3 bg-white/15 flex-shrink-0" aria-hidden="true" />
          <span className="text-[10px] font-semibold tracking-[0.18em] text-stone-500 whitespace-nowrap">
            NOW PLAYING
          </span>

          {/* Equalizer — animates only while playing */}
          <div
            className={`od-eq flex items-end gap-[2.5px] h-3.5 ml-1 ${isPlaying && !isPlaceholder ? "playing" : ""}`}
            title={isPlaying ? "Playing" : "Paused"}
            aria-hidden="true"
          >
            <span style={{ backgroundColor: accentSolid }} />
            <span style={{ backgroundColor: accentSolid }} />
            <span style={{ backgroundColor: accentSolid }} />
            <span style={{ backgroundColor: accentSolid }} />
            <span style={{ backgroundColor: accentSolid }} />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsPinned(!isPinned);
            }}
            aria-label="Pin island"
            aria-pressed={isPinned}
            title={isPinned ? "Unpin island" : "Pin island"}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none ${
              isPinned
                ? "text-black bg-white"
                : "text-stone-500 hover:text-white hover:bg-white/[0.08]"
            }`}
          >
            <IconPin size={12} filled={isPinned} />
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={(e) => {
              e.stopPropagation();
              toIdle();
            }}
            aria-label="Close island"
            title="Collapse"
            className="w-7 h-7 rounded-full flex items-center justify-center text-stone-500 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            <IconClose size={12} />
          </motion.button>
        </div>
      </div>

      {/* ====================================================================
       *  MAIN STAGE — artwork hero · title block · progress · transport
       * ==================================================================== */}
      <div className="relative z-10 flex items-stretch gap-5 mt-2.5 flex-1 min-h-0">
        {/* Artwork hero */}
        <div className="relative flex-shrink-0 w-[142px] self-center">
          <div
            className="relative w-[142px] h-[142px] rounded-[22px] overflow-hidden flex items-center justify-center"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: `0 18px 44px -14px ${rgba(accent, 0.45)}, 0 4px 18px rgba(0,0,0,0.6)`,
            }}
          >
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Album artwork" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-stone-600">
                <IconMusic size={34} />
              </div>
            )}
            {/* Hairline inner stroke for depth */}
            <div
              className="absolute inset-0 rounded-[22px] pointer-events-none"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 0 0 1px rgba(255,255,255,0.05)" }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Right column */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          {/* Title block — oversized editorial type */}
          <div
            className="min-w-0"
            style={{
              maskImage: "linear-gradient(to right, black 88%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to right, black 88%, transparent 100%)",
            }}
          >
            <div
              className={`text-[21px] leading-[1.15] font-extrabold tracking-[-0.02em] truncate ${
                isPlaceholder ? "text-stone-500" : "text-stone-50"
              }`}
            >
              {effectiveTitle}
            </div>
            <div className="text-[13px] text-stone-400 font-medium truncate mt-0.5">
              {effectiveArtist}
            </div>
          </div>

          {/* Progress line */}
          <div className="mt-2.5">
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
              className="group relative h-6 flex items-center cursor-pointer touch-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none rounded-lg"
              tabIndex={0}
            >
              {/* Track */}
              <div className="relative w-full h-[4px] group-hover:h-[6px] rounded-full bg-white/[0.10] overflow-hidden transition-[height] duration-150">
                <div
                  className="absolute top-0 left-0 h-full rounded-full"
                  style={{
                    width: `${scrubRatio * 100}%`,
                    background: `linear-gradient(90deg, ${rgba(accent, 0.75)}, ${accentSolid})`,
                    boxShadow: `0 0 10px ${rgba(accent, 0.5)}`,
                  }}
                />
              </div>
              {/* Thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 transition-opacity duration-150"
                style={{
                  left: `calc(${scrubRatio * 100}% - 6px)`,
                  backgroundColor: "#fff",
                  boxShadow: `0 0 0 3px rgba(0,0,0,0.5), 0 0 12px ${rgba(accent, 0.7)}`,
                }}
                aria-hidden="true"
              />
            </div>

            <div className="flex justify-between text-[11px] font-medium text-stone-500 font-mono tabular-nums -mt-0.5">
              <span>{formatTime(effectivePosition)}</span>
              <span>{effectiveDuration > 0 ? `−${formatTime(Math.max(0, effectiveDuration - effectivePosition))}` : "0:00"}</span>
            </div>
          </div>

          {/* Transport */}
          <div className="flex items-center justify-center gap-7 mt-0.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={handlePrevious}
              disabled={hasSession && !canPrevious}
              aria-label="Previous track"
              className="w-10 h-10 rounded-full flex items-center justify-center text-stone-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              <IconPrev size={18} />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={handlePlayPause}
              disabled={hasSession && !canPlayPause}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="w-12 h-12 rounded-full flex items-center justify-center text-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
              style={{
                background: `linear-gradient(180deg, #fff, ${rgba({ r: Math.min(255, accent.r + 40), g: Math.min(255, accent.g + 40), b: Math.min(255, accent.b + 40) }, 0.9)})`,
                boxShadow: `0 6px 22px -4px ${rgba(accent, 0.6)}, 0 2px 8px rgba(0,0,0,0.5)`,
              }}
            >
              {isPlaying ? <IconPause size={20} /> : <IconPlay size={20} className="translate-x-0.5" />}
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={handleNext}
              disabled={hasSession && !canNext}
              aria-label="Next track"
              className="w-10 h-10 rounded-full flex items-center justify-center text-stone-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              <IconNext size={18} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* ====================================================================
       *  SYSTEM DOCK — toggles · volume · battery (single hairline strip)
       * ==================================================================== */}
      <div
        className="relative z-10 flex items-center gap-3 mt-3 px-3 h-[52px] rounded-[18px] flex-shrink-0"
        style={{
          backgroundColor: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <DockToggle
          label="Wi-Fi"
          title={isWifiOn ? `Wi-Fi: ${wifiName}` : "Wi-Fi: Off"}
          active={isWifiOn}
          onToggle={handleToggleWifi}
          icon={<IconWifi size={14} />}
        />
        <DockToggle
          label="Bluetooth"
          title={isBluetoothOn ? "Bluetooth: On" : "Bluetooth: Off"}
          active={isBluetoothOn}
          onToggle={handleToggleBluetooth}
          icon={<IconBluetooth size={14} />}
        />
        <DockToggle
          label="Saver"
          title={isEnergySaverOn ? "Energy Saver: On" : "Energy Saver: Off"}
          active={isEnergySaverOn}
          onToggle={handleToggleEnergySaver}
          icon={<IconLeaf size={14} />}
        />

        <span className="w-px h-6 bg-white/10 flex-shrink-0" aria-hidden="true" />

        {/* Volume */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={toggleMute}
            aria-label={speakerLevel === 0 ? "Unmute" : "Mute"}
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none ${
              speakerLevel === 0 ? "text-stone-600 hover:text-stone-400" : "text-stone-300 hover:text-white"
            }`}
          >
            <IconSpeaker level={speakerLevel} size={15} />
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
            className="group relative flex-1 min-w-[70px] h-7 flex items-center cursor-pointer touch-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none rounded-lg"
            tabIndex={0}
          >
            <div className="relative w-full h-[4px] group-hover:h-[6px] bg-white/[0.10] rounded-full overflow-hidden transition-[height] duration-150">
              <div
                className="absolute top-0 left-0 h-full bg-white rounded-full"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md shadow-black/50 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 transition-opacity duration-150"
              style={{ left: `calc(${volume * 100}% - 6px)` }}
              aria-hidden="true"
            />
          </div>

          <span className="text-[11px] font-bold text-stone-400 font-mono tabular-nums w-8 text-right flex-shrink-0">
            {Math.round(volume * 100)}%
          </span>
        </div>

        <span className="w-px h-6 bg-white/10 flex-shrink-0" aria-hidden="true" />

        {/* Battery glance */}
        <div
          className="flex items-center gap-2 flex-shrink-0 pr-1"
          title={isCharging ? `Battery ${batteryPct}% — Charging` : `Battery ${batteryPct}%`}
        >
          <BatteryCapsule level={batteryLevel} charging={isCharging} />
          <span className="text-[12px] font-bold text-stone-200 font-mono tabular-nums">{batteryPct}%</span>
          {isEnergySaverOn && (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/25 px-2 py-[2px] rounded-full">
              Eco
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
