import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMediaStore } from "../../store/mediaStore";

function formatTime(ms: number): string {
  if (ms <= 0 || isNaN(ms)) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

type TabKey = "Controls" | "Today" | "Stats" | "Clipboard" | "Apps" | "Wallpaper" | "Power";

interface PlayerExpandedProps {
  isExpanded?: boolean;
}

export function PlayerExpanded({ isExpanded = true }: PlayerExpandedProps) {
  const snapshot = useMediaStore((s) => s.snapshot);
  const thumbnailUrl = useMediaStore((s) => s.thumbnailUrl);

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

  // Active top navigation tab
  const [activeTab, setActiveTab] = useState<TabKey>("Controls");

  // Quick toggle states
  const [isWifiOn, setIsWifiOn] = useState(true);
  const [isBluetoothOn, setIsBluetoothOn] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isNightLightOn, setIsNightLightOn] = useState(false);
  const [isDarkModeOn, setIsDarkModeOn] = useState(true);

  // Master Volume state
  const [volume, setVolume] = useState<number>(0.64);
  const isDraggingVolumeRef = useRef<boolean>(false);
  const volumeTrackRef = useRef<HTMLDivElement>(null);

  // Scrubber state (only used when real music plays)
  const [displayPositionMs, setDisplayPositionMs] = useState(positionMs);
  const isDraggingScrubRef = useRef<boolean>(false);
  const scrubberTrackRef = useRef<HTMLDivElement>(null);

  // Sync real Windows master volume
  const fetchVolume = useCallback(() => {
    invoke<number>("media_get_volume")
      .then((vol) => {
        if (typeof vol === "number" && !isNaN(vol)) {
          setVolume(Math.max(0, Math.min(1, vol)));
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

  // Synchronize snapshot position when it updates from backend
  useEffect(() => {
    if (!isDraggingScrubRef.current) {
      setDisplayPositionMs(positionMs);
    }
  }, [positionMs]);

  // 1-second live playback position tick while playing & expanded
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

  // Volume pointer handlers
  const updateVolumeFromPointer = useCallback((clientX: number) => {
    if (!volumeTrackRef.current) return;
    const rect = volumeTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setVolume(ratio);
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

  // Media Transport Handlers
  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canPlayPause) {
      invoke("media_play_pause").catch(() => {});
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canNext) {
      invoke("media_next").catch(() => {});
    }
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canPrevious) {
      invoke("media_previous").catch(() => {});
    }
  };

  // Scrubber pointer handlers
  const handleScrubPointerDown = (e: React.PointerEvent) => {
    if (!scrubberTrackRef.current || durationMs <= 0) return;
    e.stopPropagation();
    e.preventDefault();
    isDraggingScrubRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = scrubberTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDisplayPositionMs(ratio * durationMs);
  };

  const handleScrubPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingScrubRef.current || !scrubberTrackRef.current || durationMs <= 0) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = scrubberTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDisplayPositionMs(ratio * durationMs);
  };

  const handleScrubPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingScrubRef.current) return;
    e.stopPropagation();
    isDraggingScrubRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Active amber / dark theme palette matching reference
  const AMBER = "#D4B06A";
  const AMBER_DARK = "#1E180D";
  const TILE_DARK = "#1E1E21";

  const scrubRatio = durationMs > 0 ? Math.max(0, Math.min(1, displayPositionMs / durationMs)) : 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "10px 18px 14px 18px",
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
      {/* TOP NAVIGATION TABS: Controls | Today | Stats | Clipboard ...  */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "2px 4px 6px 4px",
        }}
      >
        {(["Controls", "Today", "Stats", "Clipboard", "Apps", "Wallpaper", "Power"] as TabKey[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab(tab);
              }}
              style={{
                background: isActive ? "#26231C" : "transparent",
                border: "none",
                borderRadius: "14px",
                padding: "4px 12px",
                color: isActive ? AMBER : "#8E8E93",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = "#8E8E93";
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {activeTab === "Controls" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, justifyContent: "space-between" }}>
          {/* ----------------------------------------------------------- */}
          {/* ROW 1 TILES: Wi-Fi (Amber) | Bluetooth (Dark) | Audio (Amber) */}
          {/* ----------------------------------------------------------- */}
          <div style={{ display: "flex", gap: "8px", width: "100%" }}>
            {/* 1. Wi-Fi Tile */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsWifiOn(!isWifiOn);
              }}
              style={{
                flex: 1,
                height: "48px",
                borderRadius: "14px",
                backgroundColor: isWifiOn ? AMBER : TILE_DARK,
                color: isWifiOn ? AMBER_DARK : "#FFFFFF",
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
                  backgroundColor: isWifiOn ? "rgba(0,0,0,0.12)" : "#2B2B2F",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "8px",
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                <div style={{ fontSize: "12px", fontWeight: 700 }}>Wi-Fi</div>
                <div style={{ fontSize: "10px", opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isWifiOn ? "Home 5G" : "Off"}
                </div>
              </div>
              <div style={{ borderLeft: isWifiOn ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.10)", height: "22px", margin: "0 6px" }} />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* 2. Bluetooth Tile */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsBluetoothOn(!isBluetoothOn);
              }}
              style={{
                flex: 1,
                height: "48px",
                borderRadius: "14px",
                backgroundColor: isBluetoothOn ? AMBER : TILE_DARK,
                color: isBluetoothOn ? AMBER_DARK : "#FFFFFF",
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
                  backgroundColor: isBluetoothOn ? "rgba(0,0,0,0.12)" : "#2B2B2F",
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
                  {isBluetoothOn ? "Connected" : "Off"}
                </div>
              </div>
              <div style={{ borderLeft: isBluetoothOn ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.10)", height: "22px", margin: "0 6px" }} />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* 3. Audio Tile */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsAudioOn(!isAudioOn);
              }}
              style={{
                flex: 1,
                height: "48px",
                borderRadius: "14px",
                backgroundColor: isAudioOn ? AMBER : TILE_DARK,
                color: isAudioOn ? AMBER_DARK : "#FFFFFF",
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
                  backgroundColor: isAudioOn ? "rgba(0,0,0,0.12)" : "#2B2B2F",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "8px",
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                <div style={{ fontSize: "12px", fontWeight: 700 }}>Audio</div>
                <div style={{ fontSize: "10px", opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isAudioOn ? "Speakers" : "Muted"}
                </div>
              </div>
              <div style={{ borderLeft: isAudioOn ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.10)", height: "22px", margin: "0 6px" }} />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* ROW 2 TILES: Night Light (Dark) | Dark Mode (Amber)         */}
          {/* ----------------------------------------------------------- */}
          <div style={{ display: "flex", gap: "8px", width: "100%" }}>
            {/* Night Light */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsNightLightOn(!isNightLightOn);
              }}
              style={{
                flex: 1,
                height: "48px",
                borderRadius: "14px",
                backgroundColor: isNightLightOn ? AMBER : TILE_DARK,
                color: isNightLightOn ? AMBER_DARK : "#FFFFFF",
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
                  backgroundColor: isNightLightOn ? "rgba(0,0,0,0.12)" : "#2B2B2F",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "8px",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                <div style={{ fontSize: "12px", fontWeight: 700 }}>Night Light</div>
                <div style={{ fontSize: "10px", opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isNightLightOn ? "On" : "Off"}
                </div>
              </div>
              <div style={{ borderLeft: isNightLightOn ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.10)", height: "22px", margin: "0 6px" }} />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Dark mode */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsDarkModeOn(!isDarkModeOn);
              }}
              style={{
                flex: 1,
                height: "48px",
                borderRadius: "14px",
                backgroundColor: isDarkModeOn ? AMBER : TILE_DARK,
                color: isDarkModeOn ? AMBER_DARK : "#FFFFFF",
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
                  backgroundColor: isDarkModeOn ? "rgba(0,0,0,0.12)" : "#2B2B2F",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "8px",
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9z" />
                  <path d="M12 3v18" />
                  <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" opacity="0.6" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                <div style={{ fontSize: "12px", fontWeight: 700 }}>Dark mode</div>
                <div style={{ fontSize: "10px", opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isDarkModeOn ? "On" : "Off"}
                </div>
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* ROW 3: Full-Width Master Volume Slider (Amber fill + 64%)   */}
          {/* ----------------------------------------------------------- */}
          <div
            style={{
              width: "100%",
              height: "36px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              ref={volumeTrackRef}
              onPointerDown={handleVolumePointerDown}
              onPointerMove={handleVolumePointerMove}
              onPointerUp={handleVolumePointerUp}
              style={{
                flex: 1,
                height: "36px",
                borderRadius: "18px",
                backgroundColor: "#202023",
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                touchAction: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              {/* Amber Volume Fill Pill */}
              <div
                style={{
                  width: `${volume * 100}%`,
                  height: "100%",
                  backgroundColor: AMBER,
                  borderRadius: "18px",
                  transition: isDraggingVolumeRef.current ? "none" : "width 0.08s ease",
                }}
              />

              {/* Speaker Icon anchored on the left */}
              <div
                style={{
                  position: "absolute",
                  left: "14px",
                  color: volume > 0.08 ? AMBER_DARK : "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                  transition: "color 0.15s ease",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
                </svg>
              </div>
            </div>

            {/* Volume Percentage */}
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#FFFFFF",
                fontVariantNumeric: "tabular-nums",
                minWidth: "34px",
                textAlign: "right",
              }}
            >
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* ROW 4: Now Playing Card (Rendered ONLY when music is active) */}
          {/* ----------------------------------------------------------- */}
          {hasSession && (
            <div
              style={{
                width: "100%",
                borderRadius: "16px",
                backgroundColor: "#161619",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                padding: "8px 12px 10px 12px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {/* Top subheader: Speakers */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "rgba(255, 255, 255, 0.55)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                <span>Speakers</span>
              </div>

              {/* Center row: Cover | Title & Artist | Playback Controls */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                {/* Album Cover & Artist */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      overflow: "hidden",
                      background: thumbnailUrl ? "transparent" : "linear-gradient(135deg, #4A3E72, #945277)",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    )}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
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
                      {title || "Now Playing"}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "rgba(255, 255, 255, 0.55)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        marginTop: "1px",
                      }}
                    >
                      {artist || "Audio"}
                    </div>
                  </div>
                </div>

                {/* Controls: Previous | Big Play/Pause Button | Next */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  {/* Previous */}
                  <button
                    type="button"
                    aria-label="Previous track"
                    disabled={!canPrevious}
                    onClick={handlePrevious}
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      border: "none",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: canPrevious ? "pointer" : "default",
                      opacity: canPrevious ? 0.9 : 0.3,
                      padding: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="19 20 9 12 19 4 19 20" />
                      <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2.5" />
                    </svg>
                  </button>

                  {/* Play / Pause - Large cream circle matching screenshot */}
                  <button
                    type="button"
                    aria-label={isPlaying ? "Pause" : "Play"}
                    disabled={!canPlayPause}
                    onClick={handlePlayPause}
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "50%",
                      border: "none",
                      backgroundColor: "#F2E8D2",
                      color: "#181610",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: canPlayPause ? "pointer" : "default",
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1.5" />
                        <rect x="14" y="4" width="4" height="16" rx="1.5" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="7 4 19 12 7 20 7 4" />
                      </svg>
                    )}
                  </button>

                  {/* Next */}
                  <button
                    type="button"
                    aria-label="Next track"
                    disabled={!canNext}
                    onClick={handleNext}
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      border: "none",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: canNext ? "pointer" : "default",
                      opacity: canNext ? 0.9 : 0.3,
                      padding: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 4 15 12 5 20 5 4" />
                      <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2.5" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Bottom Scrubber (starts from real 0:00 or active position) */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums", minWidth: "26px" }}>
                  {formatTime(displayPositionMs)}
                </span>

                <div
                  ref={scrubberTrackRef}
                  onPointerDown={handleScrubPointerDown}
                  onPointerMove={handleScrubPointerMove}
                  onPointerUp={handleScrubPointerUp}
                  style={{
                    flex: 1,
                    height: "12px",
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    position: "relative",
                    touchAction: "none",
                  }}
                >
                  <div style={{ width: "100%", height: "3px", borderRadius: "1.5px", backgroundColor: "#2A2A2E", position: "relative" }}>
                    <div
                      style={{
                        width: `${scrubRatio * 100}%`,
                        height: "100%",
                        backgroundColor: AMBER,
                        borderRadius: "1.5px",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          right: "-3px",
                          top: "-2.5px",
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: AMBER,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums", minWidth: "26px", textAlign: "right" }}>
                  {formatTime(durationMs)}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Subview for other tabs: Today, Stats, Apps, Power, etc. */
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: 700, color: AMBER }}>{activeTab}</div>
          <div style={{ fontSize: "12px", opacity: 0.65 }}>
            {activeTab === "Today" && new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            {activeTab === "Stats" && "System CPU: 4% • Memory: Normal • Battery: 100%"}
            {activeTab === "Clipboard" && "Clipboard history synchronized"}
            {activeTab === "Apps" && "Quick app shortcuts"}
            {activeTab === "Wallpaper" && "Desktop background selector"}
            {activeTab === "Power" && "Sleep • Restart • Shut Down"}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("Controls");
            }}
            style={{
              marginTop: "4px",
              padding: "5px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "#FFFFFF",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Back to Controls
          </button>
        </div>
      )}
    </div>
  );
}
