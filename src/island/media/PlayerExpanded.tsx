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

/**
 * Builds the smooth wavy audio waveform SVG path starting from playedX to totalWidth.
 * Matches the Apple Music / Dynamic Island sine-wave scrubber aesthetic.
 */
function buildWavyPath(startX: number, endX: number, centerY: number, amplitude: number = 3.8): string {
  if (startX >= endX - 2) return "";

  const waveLength = 54; // Wave cycle length in pixels
  const step = 3;        // Sampling step
  let d = `M ${startX.toFixed(1)} ${centerY.toFixed(1)}`;

  for (let x = startX; x <= endX; x += step) {
    const dx = x - startX;
    const remaining = endX - x;

    // Smooth envelope damping at both ends for seamless tangent connections
    const startEnvelope = Math.min(1, dx / 14);
    const endEnvelope = Math.min(1, remaining / 14);
    const envelope = startEnvelope * endEnvelope;

    // Sine calculation
    const y = centerY + Math.sin((dx / waveLength) * 2 * Math.PI) * amplitude * envelope;
    d += ` L ${x.toFixed(1)} ${y.toFixed(2)}`;
  }

  // Ensure path concludes exactly at end point
  d += ` L ${endX.toFixed(1)} ${centerY.toFixed(1)}`;
  return d;
}

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

  // Local live position for time labels and scrubber
  const [displayPositionMs, setDisplayPositionMs] = useState(positionMs);
  const [scrubberWidth, setScrubberWidth] = useState(280);
  const scrubberContainerRef = useRef<HTMLDivElement>(null);

  // Volume state
  const [volume, setVolume] = useState<number>(0.5);
  const [prevVolume, setPrevVolume] = useState<number>(0.5);
  const [isVolumeOpen, setIsVolumeOpen] = useState<boolean>(false);
  const isDraggingVolumeRef = useRef<boolean>(false);
  const volumeTrackRef = useRef<HTMLDivElement>(null);

  // Sync volume from system on mount and when volume slider opens
  const fetchVolume = useCallback(() => {
    invoke<number>("media_get_volume")
      .then((vol) => {
        if (typeof vol === "number" && !isNaN(vol)) {
          setVolume(Math.max(0, Math.min(1, vol)));
          if (vol > 0) setPrevVolume(vol);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchVolume();
  }, [fetchVolume]);

  useEffect(() => {
    if (isVolumeOpen) {
      fetchVolume();
    }
  }, [isVolumeOpen, fetchVolume]);

  // Synchronize snapshot position when it updates from backend
  useEffect(() => {
    setDisplayPositionMs(positionMs);
  }, [positionMs]);

  // 1-second timer while playing & expanded
  useEffect(() => {
    if (!isExpanded || !hasSession || !isPlaying || durationMs <= 0) return;

    const interval = window.setInterval(() => {
      setDisplayPositionMs((prev) => {
        const next = prev + 1000 * (playbackRate || 1.0);
        return Math.min(next, durationMs);
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isExpanded, hasSession, isPlaying, durationMs, playbackRate]);

  // Measure scrubber width dynamically
  useEffect(() => {
    if (!scrubberContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 20) {
          setScrubberWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(scrubberContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Transport control handlers (stopPropagation prevents closing the notch)
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

  // Volume adjustment handlers
  const updateVolumeFromPointer = useCallback((clientX: number) => {
    if (!volumeTrackRef.current) return;
    const rect = volumeTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setVolume(ratio);
    if (ratio > 0) setPrevVolume(ratio);
    invoke("media_set_volume", { volume: ratio }).catch(() => {});
  }, []);

  const handleVolumeTrackPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingVolumeRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateVolumeFromPointer(e.clientX);
  };

  const handleVolumeTrackPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingVolumeRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    updateVolumeFromPointer(e.clientX);
  };

  const handleVolumeTrackPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingVolumeRef.current) return;
    e.stopPropagation();
    isDraggingVolumeRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
      invoke("media_set_volume", { volume: 0 }).catch(() => {});
    } else {
      const restore = prevVolume > 0 ? prevVolume : 0.3;
      setVolume(restore);
      invoke("media_set_volume", { volume: restore }).catch(() => {});
    }
  };

  // Scrubber geometry calculations
  const effectiveDuration = durationMs > 0 ? durationMs : 215000; // fallback duration for preview
  const effectivePosition = hasSession && durationMs > 0 ? displayPositionMs : 15000;
  const progressRatio = Math.max(0, Math.min(1, effectivePosition / effectiveDuration));
  const centerY = 10;
  const playedX = Math.max(4, progressRatio * scrubberWidth);
  const wavyPath = buildWavyPath(playedX, scrubberWidth, centerY, 3.6);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "14px 24px 16px 24px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        pointerEvents: "none",
        userSelect: "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* ROW 1: Album Cover (Left) | Title & Artist (Center) | Balance  */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          position: "relative",
        }}
      >
        {/* Album Artwork (48x48px, rounded squircle corners) */}
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "10px",
            overflow: "hidden",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt="Cover Art"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255, 255, 255, 0.65)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          )}
        </div>

        {/* Center: Track Title & Artist (Centered layout matching screenshot) */}
        <div
          style={{
            position: "absolute",
            left: "64px",
            right: "64px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: "-0.015em",
              lineHeight: 1.25,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {hasSession ? (title || "Unknown Title") : "We Found Love"}
          </div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.60)",
              lineHeight: 1.2,
              marginTop: "2px",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {hasSession ? (artist || "Unknown Artist") : "Rihanna"}
          </div>
        </div>

        {/* Right side balance spacer */}
        <div style={{ width: "48px", height: "48px", flexShrink: 0 }} />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ROW 2: Scrubber (0:15  ───────~~~~~  3:35)                    */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          width: "100%",
          padding: "0 2px",
          boxSizing: "border-box",
        }}
      >
        {/* Elapsed Time */}
        <span
          style={{
            fontSize: "12px",
            fontWeight: 400,
            color: "rgba(255, 255, 255, 0.70)",
            fontVariantNumeric: "tabular-nums",
            minWidth: "30px",
            textAlign: "right",
            lineHeight: 1,
          }}
        >
          {formatTime(effectivePosition)}
        </span>

        {/* Wavy Scrubber Line */}
        <div
          ref={scrubberContainerRef}
          style={{
            flex: 1,
            height: "20px",
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <svg
            width="100%"
            height="20"
            style={{ overflow: "visible", display: "block" }}
          >
            {/* Played Line: flat, crisp white solid line with rounded end */}
            <line
              x1="0"
              y1={centerY}
              x2={playedX}
              y2={centerY}
              stroke="#FFFFFF"
              strokeWidth="3.2"
              strokeLinecap="round"
            />

            {/* Remaining Line: smooth sine waves in subtle muted gray */}
            {wavyPath && (
              <path
                d={wavyPath}
                fill="none"
                stroke="rgba(255, 255, 255, 0.28)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>

        {/* Total Duration */}
        <span
          style={{
            fontSize: "12px",
            fontWeight: 400,
            color: "rgba(255, 255, 255, 0.70)",
            fontVariantNumeric: "tabular-nums",
            minWidth: "30px",
            textAlign: "left",
            lineHeight: 1,
          }}
        >
          {formatTime(effectiveDuration)}
        </span>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ROW 3: Centered Controls (◀◀  ❚❚  ▶▶) + Expandable Volume      */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          position: "relative",
          width: "100%",
          height: "36px",
        }}
      >
        {/* Centered Transport Controls */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "30px",
          }}
        >
          {/* Rewind / Previous (◀◀) */}
          <button
            type="button"
            aria-label="Previous Track"
            disabled={hasSession && !canPrevious}
            onClick={handlePrevious}
            style={{
              width: "32px",
              height: "32px",
              border: "none",
              backgroundColor: "transparent",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: (!hasSession || canPrevious) ? "pointer" : "default",
              opacity: (!hasSession || canPrevious) ? 0.95 : 0.25,
              pointerEvents: "auto",
              transition: "transform 0.1s ease, opacity 0.15s ease",
              padding: 0,
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.88)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {/* Double left triangles */}
            <svg width="22" height="16" viewBox="0 0 24 16" fill="currentColor">
              <polygon points="11,1 1,8 11,15" />
              <polygon points="23,1 12,8 23,15" />
            </svg>
          </button>

          {/* Play / Pause (❚❚ or ▶) */}
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            disabled={hasSession && !canPlayPause}
            onClick={handlePlayPause}
            style={{
              width: "36px",
              height: "36px",
              border: "none",
              backgroundColor: "transparent",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: (!hasSession || canPlayPause) ? "pointer" : "default",
              opacity: (!hasSession || canPlayPause) ? 1.0 : 0.3,
              pointerEvents: "auto",
              transition: "transform 0.1s ease, opacity 0.15s ease",
              padding: 0,
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.88)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {isPlaying || !hasSession ? (
              /* Pause icon: Two vertical pills (❚❚) */
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <rect x="3.5" y="2" width="4.2" height="16" rx="2" />
                <rect x="12.3" y="2" width="4.2" height="16" rx="2" />
              </svg>
            ) : (
              /* Play icon: Triangle (▶) */
              <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
                <polygon points="5,2 19,11 5,20" />
              </svg>
            )}
          </button>

          {/* Fast Forward / Next (▶▶) */}
          <button
            type="button"
            aria-label="Next Track"
            disabled={hasSession && !canNext}
            onClick={handleNext}
            style={{
              width: "32px",
              height: "32px",
              border: "none",
              backgroundColor: "transparent",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: (!hasSession || canNext) ? "pointer" : "default",
              opacity: (!hasSession || canNext) ? 0.95 : 0.25,
              pointerEvents: "auto",
              transition: "transform 0.1s ease, opacity 0.15s ease",
              padding: 0,
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.88)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {/* Double right triangles */}
            <svg width="22" height="16" viewBox="0 0 24 16" fill="currentColor">
              <polygon points="1,1 12,8 1,15" />
              <polygon points="13,1 23,8 13,15" />
            </svg>
          </button>
        </div>

        {/* Expandable Volume Slider on the Right */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            position: "relative",
            zIndex: 10,
          }}
        >
          {isVolumeOpen ? (
            /* EXPANDED VOLUME PILL */
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.12)",
                borderRadius: "16px",
                padding: "3px 10px 3px 8px",
                pointerEvents: "auto",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                border: "1px solid rgba(255, 255, 255, 0.10)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Speaker / Mute Toggle Icon */}
              <button
                type="button"
                aria-label="Toggle Mute"
                onClick={toggleMute}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  opacity: volume === 0 ? 0.45 : 0.9,
                }}
              >
                {volume === 0 ? (
                  /* Muted speaker */
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  /* Active speaker */
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
                  </svg>
                )}
              </button>

              {/* Interactive Volume Slider Track */}
              <div
                ref={volumeTrackRef}
                onPointerDown={handleVolumeTrackPointerDown}
                onPointerMove={handleVolumeTrackPointerMove}
                onPointerUp={handleVolumeTrackPointerUp}
                style={{
                  width: "68px",
                  height: "16px",
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  position: "relative",
                  touchAction: "none",
                }}
              >
                {/* Background track */}
                <div
                  style={{
                    width: "100%",
                    height: "4px",
                    borderRadius: "2px",
                    backgroundColor: "rgba(255, 255, 255, 0.22)",
                    overflow: "hidden",
                  }}
                >
                  {/* Fill track */}
                  <div
                    style={{
                      width: `${volume * 100}%`,
                      height: "100%",
                      borderRadius: "2px",
                      backgroundColor: "#FFFFFF",
                      transition: isDraggingVolumeRef.current ? "none" : "width 0.08s ease",
                    }}
                  />
                </div>
              </div>

              {/* Volume Percentage */}
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "rgba(255, 255, 255, 0.75)",
                  fontVariantNumeric: "tabular-nums",
                  minWidth: "26px",
                  textAlign: "right",
                  lineHeight: 1,
                }}
              >
                {Math.round(volume * 100)}%
              </span>

              {/* Close Button */}
              <button
                type="button"
                aria-label="Close Volume Slider"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVolumeOpen(false);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255, 255, 255, 0.5)",
                  cursor: "pointer",
                  marginLeft: "2px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#FFFFFF";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.5)";
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            /* COLLAPSED SPEAKER BUTTON */
            <button
              type="button"
              aria-label="Expand Volume Control"
              onClick={(e) => {
                e.stopPropagation();
                setIsVolumeOpen(true);
              }}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "transparent",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                opacity: 0.8,
                pointerEvents: "auto",
                transition: "opacity 0.15s ease, background-color 0.15s ease, transform 0.1s ease",
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.10)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.8";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.92)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {volume === 0 ? (
                /* Muted speaker */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                /* Normal speaker */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
