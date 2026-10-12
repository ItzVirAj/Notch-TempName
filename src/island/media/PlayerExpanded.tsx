import { useEffect, useState } from "react";
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
 * Expanded media player view designed according to Apple HIG and modern dark aesthetics:
 * - Fits within the 480x96px expanded island body, inside 28px bottom-corner safe areas.
 * - Minimum 32px hit targets for all controls (36x36px with 18px icons).
 * - Single CSS scaleX progress transition with zero JavaScript animation loops.
 * - Timer interval runs ONLY while expanded and isPlaying is true.
 * - Stops event propagation on button clicks to prevent unintended panel collapse.
 */
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

  // Local live position for time labels (updated on a 1-second interval only while expanded & playing)
  const [displayPositionMs, setDisplayPositionMs] = useState(positionMs);

  useEffect(() => {
    setDisplayPositionMs(positionMs);
  }, [positionMs]);

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

  // Click handlers with stopPropagation to isolate island expansion/collapse
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

  // Progress bar calculation
  const hasValidDuration = durationMs > 0;
  const currentRatio = hasValidDuration
    ? Math.min(1, Math.max(0, positionMs / durationMs))
    : 0;
  const remainingSeconds = hasValidDuration && isPlaying
    ? Math.max(0, (durationMs - positionMs) / (1000 * (playbackRate || 1.0)))
    : 0;

  // CSS transition style for continuous playback progress without JS animation loops
  const progressStyle: React.CSSProperties = {
    transformOrigin: "left center",
    transform: isExpanded && isPlaying && hasValidDuration ? "scaleX(1)" : `scaleX(${currentRatio})`,
    transition:
      isExpanded && isPlaying && hasValidDuration && remainingSeconds > 0
        ? `transform ${remainingSeconds}s linear`
        : "none",
  };

  const remainingMs = Math.max(0, durationMs - displayPositionMs);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "12px 22px 14px 22px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* Top Section: Album Art | Metadata | Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          width: "100%",
          flex: 1,
        }}
      >
        {/* Album Cover (56x56px, 10px rounded corners) */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "10px",
            overflow: "hidden",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt="Album Artwork"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            /* Music note placeholder SVG */
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255, 255, 255, 0.45)"
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

        {/* Center: Title & Artist / Nothing Playing */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "2px",
          }}
        >
          {hasSession ? (
            <>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  letterSpacing: "-0.01em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {title || "Unknown Title"}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 400,
                  color: "rgba(255, 255, 255, 0.60)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {artist || "Unknown Artist"}
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "rgba(255, 255, 255, 0.55)",
                }}
              >
                Nothing playing
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 400,
                  color: "rgba(255, 255, 255, 0.35)",
                }}
              >
                System media idle
              </div>
            </>
          )}
        </div>

        {/* Right: Controls (Previous, Play/Pause, Next) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexShrink: 0,
          }}
        >
          {/* Previous Button */}
          <button
            type="button"
            aria-label="Previous track"
            disabled={!hasSession || !canPrevious}
            onClick={handlePrevious}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "transparent",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: hasSession && canPrevious ? "pointer" : "default",
              opacity: hasSession && canPrevious ? 0.85 : 0.25,
              pointerEvents: hasSession && canPrevious ? "auto" : "none",
              transition: "opacity 0.15s ease, transform 0.1s ease",
              outlineOffset: "2px",
            }}
            onMouseEnter={(e) => {
              if (canPrevious) e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              if (canPrevious) e.currentTarget.style.opacity = "0.85";
            }}
            onMouseDown={(e) => {
              if (canPrevious) e.currentTarget.style.transform = "scale(0.92)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {/* Previous Track SVG */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>

          {/* Play / Pause Button */}
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            disabled={!hasSession || !canPlayPause}
            onClick={handlePlayPause}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "rgba(255, 255, 255, 0.14)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: hasSession && canPlayPause ? "pointer" : "default",
              opacity: hasSession && canPlayPause ? 1 : 0.3,
              pointerEvents: hasSession && canPlayPause ? "auto" : "none",
              transition: "background-color 0.15s ease, transform 0.1s ease",
              outlineOffset: "2px",
            }}
            onMouseEnter={(e) => {
              if (canPlayPause)
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.22)";
            }}
            onMouseLeave={(e) => {
              if (canPlayPause)
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.14)";
            }}
            onMouseDown={(e) => {
              if (canPlayPause) e.currentTarget.style.transform = "scale(0.92)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {isPlaying ? (
              /* Pause Icon SVG */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              /* Play Icon SVG */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next Button */}
          <button
            type="button"
            aria-label="Next track"
            disabled={!hasSession || !canNext}
            onClick={handleNext}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "transparent",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: hasSession && canNext ? "pointer" : "default",
              opacity: hasSession && canNext ? 0.85 : 0.25,
              pointerEvents: hasSession && canNext ? "auto" : "none",
              transition: "opacity 0.15s ease, transform 0.1s ease",
              outlineOffset: "2px",
            }}
            onMouseEnter={(e) => {
              if (canNext) e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              if (canNext) e.currentTarget.style.opacity = "0.85";
            }}
            onMouseDown={(e) => {
              if (canNext) e.currentTarget.style.transform = "scale(0.92)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {/* Next Track SVG */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom Section: Progress Bar & Optional Time Labels */}
      {hasSession && hasValidDuration && (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            marginTop: "4px",
          }}
        >
          {/* Progress Bar Track */}
          <div
            style={{
              width: "100%",
              height: "3px",
              borderRadius: "1.5px",
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              overflow: "hidden",
            }}
          >
            {/* Animated Fill Bar (scaleX transform only) */}
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "1.5px",
                backgroundColor: "rgba(255, 255, 255, 0.85)",
                ...progressStyle,
              }}
            />
          </div>

          {/* Time Labels (Elapsed & Remaining) */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.45)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            <span>{formatTime(displayPositionMs)}</span>
            <span>-{formatTime(remainingMs)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
