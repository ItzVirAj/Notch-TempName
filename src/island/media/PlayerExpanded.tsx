import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMediaStore } from "../../store/mediaStore";
import { useIslandStore } from "../../store/islandStore";

function formatTime(ms: number): string {
  if (ms <= 0 || isNaN(ms)) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

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

  // Active top launcher tab
  const [activeLauncher, setActiveLauncher] = useState<number>(0);
  const [isPinned, setIsPinned] = useState(false);

  // --------------------------------------------------------------------------
  // Realtime System States: Wi-Fi, Bluetooth, Energy Saver, Battery, Volume
  // --------------------------------------------------------------------------
  const [isWifiOn, setIsWifiOn] = useState(true);
  const [isBluetoothOn, setIsBluetoothOn] = useState(true);
  const [isEnergySaverOn, setIsEnergySaverOn] = useState(false);

  // Realtime Battery API (Navigator Battery or desktop fallback)
  const [batteryLevel, setBatteryLevel] = useState<number>(1.0);
  const [isCharging, setIsCharging] = useState<boolean>(true);

  useEffect(() => {
    let batteryInstance: any = null;

    if (typeof navigator !== "undefined" && "getBattery" in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        batteryInstance = battery;
        setBatteryLevel(battery.level ?? 1.0);
        setIsCharging(battery.charging ?? true);

        const onLevelChange = () => setBatteryLevel(battery.level ?? 1.0);
        const onChargingChange = () => setIsCharging(battery.charging ?? true);

        battery.addEventListener("levelchange", onLevelChange);
        battery.addEventListener("chargingchange", onChargingChange);
      }).catch(() => {});
    }

    return () => {
      if (batteryInstance) {
        try {
          batteryInstance.removeEventListener("levelchange", () => {});
          batteryInstance.removeEventListener("chargingchange", () => {});
        } catch {}
      }
    };
  }, []);

  // Realtime Master Volume
  const [volume, setVolume] = useState<number>(0.75);
  const [isMuted, setIsMuted] = useState(false);
  const isDraggingVolumeRef = useRef<boolean>(false);
  const volumeTrackRef = useRef<HTMLDivElement>(null);

  const fetchVolume = useCallback(() => {
    invoke<number>("media_get_volume")
      .then((vol) => {
        if (typeof vol === "number" && !isNaN(vol)) {
          const clamped = Math.max(0, Math.min(1, vol));
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
    if (isExpanded) {
      fetchVolume();
    }
  }, [isExpanded, fetchVolume]);

  const updateVolumeFromPointer = useCallback((clientX: number) => {
    if (!volumeTrackRef.current) return;
    const rect = volumeTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setVolume(ratio);
    setIsMuted(ratio === 0);
    invoke("media_set_volume", { volume: ratio }).catch(() => {});
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
    } catch {}
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMuted || volume === 0) {
      const restored = 0.5;
      setVolume(restored);
      setIsMuted(false);
      invoke("media_set_volume", { volume: restored }).catch(() => {});
    } else {
      setVolume(0);
      setIsMuted(true);
      invoke("media_set_volume", { volume: 0 }).catch(() => {});
    }
  };

  // --------------------------------------------------------------------------
  // Music Player Scrubber & Transport
  // --------------------------------------------------------------------------
  const [displayPositionMs, setDisplayPositionMs] = useState(positionMs);
  const isDraggingScrubRef = useRef<boolean>(false);
  const scrubberTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDraggingScrubRef.current) {
      setDisplayPositionMs(positionMs);
    }
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
    if (canPlayPause || !hasSession) {
      invoke("media_play_pause").catch(() => {});
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canNext || !hasSession) {
      invoke("media_next").catch(() => {});
    }
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canPrevious || !hasSession) {
      invoke("media_previous").catch(() => {});
    }
  };

  const handleScrubPointerDown = (e: React.PointerEvent) => {
    if (!scrubberTrackRef.current) return;
    const dur = durationMs > 0 ? durationMs : 256000;
    e.stopPropagation();
    e.preventDefault();
    isDraggingScrubRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = scrubberTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDisplayPositionMs(ratio * dur);
  };

  const handleScrubPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingScrubRef.current || !scrubberTrackRef.current) return;
    const dur = durationMs > 0 ? durationMs : 256000;
    e.stopPropagation();
    e.preventDefault();
    const rect = scrubberTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDisplayPositionMs(ratio * dur);
  };

  const handleScrubPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingScrubRef.current) return;
    e.stopPropagation();
    isDraggingScrubRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const effectiveDuration = durationMs > 0 ? durationMs : 256000;
  const effectivePosition = displayPositionMs > 0 ? displayPositionMs : (hasSession ? 0 : 3000);
  const scrubRatio = Math.max(0, Math.min(1, effectivePosition / effectiveDuration));

  // Apple HIG System Accent Colors
  const APPLE_BLUE = "#0A84FF";
  const APPLE_GREEN = "#30D158";
  const APPLE_AMBER = "#FF9F0A";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "10px 24px 16px 24px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        pointerEvents: "auto",
        userSelect: "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER: Left Launcher Pill | Right Status & Action Bar     */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: "32px",
        }}
      >
        {/* Left Utility Launcher Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: "2px 4px",
          }}
        >
          {[
            /* 0: Grid / Dashboard */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>,
            /* 1: Music */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>,
            /* 2: Equalizer / Sliders */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>,
            /* 3: Focus / Coffee */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>,
            /* 4: Pulse / Performance */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>,
            /* 5: Signal / Network */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="16" width="3" height="5" rx="1" />
              <rect x="8.5" y="12" width="3" height="9" rx="1" />
              <rect x="14" y="8" width="3" height="13" rx="1" />
              <rect x="19.5" y="4" width="3" height="17" rx="1" />
            </svg>,
          ].map((icon, idx) => {
            const isActive = activeLauncher === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveLauncher(idx);
                }}
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  border: "none",
                  backgroundColor: isActive ? "#2A2A2E" : "transparent",
                  color: isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = "#FFFFFF";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
                }}
              >
                {icon}
              </button>
            );
          })}
        </div>

        {/* Right Status & Action Items */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "rgba(255, 255, 255, 0.75)" }}>
          {/* Weather */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span>🌩</span>
            <span style={{ fontWeight: 600 }}>33°C</span>
          </div>

          {/* Battery Status Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {Math.round(batteryLevel * 100)}%
            </span>
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                backgroundColor: APPLE_GREEN,
                color: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: 900,
              }}
            >
              ⚡
            </div>
          </div>

          {/* Pin Button */}
          <button
            type="button"
            aria-label="Pin island"
            onClick={(e) => {
              e.stopPropagation();
              setIsPinned(!isPinned);
            }}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              color: isPinned ? APPLE_BLUE : "rgba(255, 255, 255, 0.5)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-2l-2-3V5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v7l-2 3v2z" />
            </svg>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            aria-label="Settings"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              color: "rgba(255, 255, 255, 0.5)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.5)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* Close Button */}
          <button
            type="button"
            aria-label="Close island"
            onClick={(e) => {
              e.stopPropagation();
              toIdle();
            }}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              color: "rgba(255, 255, 255, 0.5)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.5)";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN TWO-COLUMN BODY: Left Music Card | Right Controls Panel  */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          gap: "14px",
          width: "100%",
          flex: 1,
          marginTop: "8px",
        }}
      >
        {/* =========================================================== */}
        {/* LEFT COLUMN: NOW PLAYING MUSIC PLAYER CARD                  */}
        {/* =========================================================== */}
        <div
          style={{
            flex: 1,
            borderRadius: "18px",
            background: "linear-gradient(145deg, #180927 0%, #351033 45%, #1C0C2D 80%, #0E0716 100%)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
            padding: "12px 14px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Top Row: Album Cover Art & Metadata */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                overflow: "hidden",
                background: thumbnailUrl ? "transparent" : "linear-gradient(135deg, #2D143D, #5C1D4A)",
                flexShrink: 0,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.7)" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              )}

              {/* Mini Music Note Badge in Bottom-Right Corner of Artwork */}
              <div
                style={{
                  position: "absolute",
                  bottom: "2px",
                  right: "2px",
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(0, 0, 0, 0.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" color="#FFFFFF">
                  <path d="M9 18V5l12-2v13" />
                </svg>
              </div>
            </div>

            {/* Title & Artist */}
            <div style={{ minWidth: 0, flex: 1, lineHeight: 1.2 }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {hasSession && title ? title : "Am I Dreaming (Metr..."}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(255, 255, 255, 0.65)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: "2px",
                }}
              >
                {hasSession && artist ? artist : "Metro Boomin"}
              </div>
            </div>
          </div>

          {/* Middle Row: Progress Scrubber Bar & Timestamps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div
              ref={scrubberTrackRef}
              onPointerDown={handleScrubPointerDown}
              onPointerMove={handleScrubPointerMove}
              onPointerUp={handleScrubPointerUp}
              style={{
                width: "100%",
                height: "12px",
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                position: "relative",
                touchAction: "none",
              }}
            >
              {/* Background Track */}
              <div
                style={{
                  width: "100%",
                  height: "3px",
                  borderRadius: "1.5px",
                  backgroundColor: "rgba(255, 255, 255, 0.18)",
                  position: "relative",
                }}
              >
                {/* Active White Fill */}
                <div
                  style={{
                    width: `${scrubRatio * 100}%`,
                    height: "100%",
                    backgroundColor: "#FFFFFF",
                    borderRadius: "1.5px",
                    position: "relative",
                  }}
                >
                  {/* Round White Thumb Dot */}
                  <div
                    style={{
                      position: "absolute",
                      right: "-3.5px",
                      top: "-2px",
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: "#FFFFFF",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Left Elapsed & Right Duration */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                color: "rgba(255, 255, 255, 0.55)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              <span>{formatTime(effectivePosition)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>

          {/* Bottom Row: Centered Playback Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "28px",
            }}
          >
            {/* Previous */}
            <button
              type="button"
              aria-label="Previous track"
              disabled={hasSession && !canPrevious}
              onClick={handlePrevious}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.9,
                transition: "transform 0.1s ease",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.88)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19,3 7,12 19,21" />
              </svg>
            </button>

            {/* Big Circular White Play/Pause Button */}
            <button
              type="button"
              aria-label={isPlaying ? "Pause" : "Play"}
              disabled={hasSession && !canPlayPause}
              onClick={handlePlayPause}
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#FFFFFF",
                color: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                padding: 0,
                transition: "transform 0.1s ease",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.92)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {isPlaying ? (
                /* Black Pause Bars */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                /* Black Play Triangle */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="7,4 19,12 7,20" />
                </svg>
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              aria-label="Next track"
              disabled={hasSession && !canNext}
              onClick={handleNext}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.9,
                transition: "transform 0.1s ease",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.88)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 17,12 5,21" />
              </svg>
            </button>
          </div>
        </div>

        {/* =========================================================== */}
        {/* RIGHT COLUMN: REPLACED CONTROL PANEL (Apple HIG Design)     */}
        {/* Wi-Fi | Volume | Bluetooth | Battery % | Energy Saver       */}
        {/* =========================================================== */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          {/* Row 1: Wi-Fi & Bluetooth Apple Toggles */}
          <div style={{ display: "flex", gap: "8px", width: "100%" }}>
            {/* Wi-Fi Tile */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsWifiOn(!isWifiOn);
              }}
              style={{
                flex: 1,
                height: "46px",
                borderRadius: "14px",
                backgroundColor: isWifiOn ? APPLE_BLUE : "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: isWifiOn ? "rgba(255, 255, 255, 0.22)" : "rgba(255, 255, 255, 0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "8px",
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              </div>

              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                <div style={{ fontSize: "12px", fontWeight: 700 }}>Wi-Fi</div>
                <div style={{ fontSize: "10px", opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isWifiOn ? "Connected" : "Off"}
                </div>
              </div>
            </div>

            {/* Bluetooth Tile */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsBluetoothOn(!isBluetoothOn);
              }}
              style={{
                flex: 1,
                height: "46px",
                borderRadius: "14px",
                backgroundColor: isBluetoothOn ? APPLE_BLUE : "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: isBluetoothOn ? "rgba(255, 255, 255, 0.22)" : "rgba(255, 255, 255, 0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "8px",
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
                </svg>
              </div>

              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                <div style={{ fontSize: "12px", fontWeight: 700 }}>Bluetooth</div>
                <div style={{ fontSize: "10px", opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isBluetoothOn ? "On" : "Off"}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Apple Full-Width Master Volume Slider */}
          <div
            ref={volumeTrackRef}
            onPointerDown={handleVolumePointerDown}
            onPointerMove={handleVolumePointerMove}
            onPointerUp={handleVolumePointerUp}
            style={{
              width: "100%",
              height: "36px",
              borderRadius: "18px",
              backgroundColor: "rgba(255, 255, 255, 0.10)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
              touchAction: "none",
              display: "flex",
              alignItems: "center",
              boxSizing: "border-box",
            }}
          >
            {/* Active White/Blue Volume Fill */}
            <div
              style={{
                width: `${volume * 100}%`,
                height: "100%",
                backgroundColor: "#FFFFFF",
                borderRadius: "18px",
                transition: isDraggingVolumeRef.current ? "none" : "width 0.08s ease",
              }}
            />

            {/* Speaker Icon anchored left */}
            <button
              type="button"
              aria-label="Mute toggle"
              onClick={toggleMute}
              style={{
                position: "absolute",
                left: "12px",
                background: "transparent",
                border: "none",
                padding: 0,
                color: volume > 0.12 ? "#000000" : "#FFFFFF",
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                transition: "color 0.15s ease",
              }}
            >
              {isMuted || volume === 0 ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
                </svg>
              )}
            </button>

            {/* Volume Percentage anchored right */}
            <span
              style={{
                position: "absolute",
                right: "12px",
                fontSize: "12px",
                fontWeight: 700,
                color: volume > 0.88 ? "#000000" : "#FFFFFF",
                fontVariantNumeric: "tabular-nums",
                pointerEvents: "none",
              }}
            >
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* Row 3: Battery Percent & Energy Saver Options */}
          <div style={{ display: "flex", gap: "8px", width: "100%" }}>
            {/* Battery Percent Card */}
            <div
              style={{
                flex: 1,
                height: "46px",
                borderRadius: "14px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: isCharging ? "rgba(48, 209, 88, 0.22)" : "rgba(255, 255, 255, 0.10)",
                  color: isCharging ? APPLE_GREEN : "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "8px",
                  flexShrink: 0,
                  fontSize: "11px",
                  fontWeight: 900,
                }}
              >
                {isCharging ? "⚡" : "🔋"}
              </div>

              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(batteryLevel * 100)}%
                </div>
                <div style={{ fontSize: "10px", opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isCharging ? "Charging" : "Battery"}
                </div>
              </div>
            </div>

            {/* Energy Saver Toggle */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsEnergySaverOn(!isEnergySaverOn);
              }}
              style={{
                flex: 1,
                height: "46px",
                borderRadius: "14px",
                backgroundColor: isEnergySaverOn ? APPLE_AMBER : "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                color: isEnergySaverOn ? "#18140B" : "#FFFFFF",
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: isEnergySaverOn ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "8px",
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                </svg>
              </div>

              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                <div style={{ fontSize: "11px", fontWeight: 700 }}>Energy Saver</div>
                <div style={{ fontSize: "10px", opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isEnergySaverOn ? "Low Power" : "Off"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
