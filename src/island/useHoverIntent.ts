import { useEffect, useRef } from "react";
import { useIslandStore } from "../store/islandStore";
import {
  EXPANDED_LEAVE_DELAY_MS,
  HOVER_IN_PEEK_DELAY_MS,
  PEEK_LEAVE_DELAY_MS,
} from "./constants";

/**
 * Hover Intent & Hysteresis State Machine:
 *
 * - idle -> peek: hover for 120ms
 * - peek -> expanded: click
 * - expanded -> peek: click
 * - idle -> expanded: click
 * - peek -> idle: leave after 250ms
 * - expanded -> idle: leave after 400ms (cushion against accidental mouse slips)
 * - re-enter during leave delay: cancel leave timer, maintain current state
 * - click: cancel all pending timers, transition immediately
 */
export function useHoverIntent() {
  const mode = useIslandStore((s) => s.mode);
  const setMode = useIslandStore((s) => s.setMode);

  // Keep a ref of mode for event callbacks without stale closures
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const hoverInTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (hoverInTimer.current !== null) {
      window.clearTimeout(hoverInTimer.current);
      hoverInTimer.current = null;
    }
    if (leaveTimer.current !== null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  const onMouseEnter = () => {
    // 1. If mouse was leaving and re-enters before the timer fired, cancel leave and preserve current state
    if (leaveTimer.current !== null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }

    // 2. If currently idle, schedule peek transition after 120ms
    if (modeRef.current === "idle") {
      hoverInTimer.current = window.setTimeout(() => {
        setMode("peek");
        hoverInTimer.current = null;
      }, HOVER_IN_PEEK_DELAY_MS);
    }
  };

  const onMouseLeave = () => {
    // 1. If cursor brushed in and out before hover timer fired, cancel peek expansion
    if (hoverInTimer.current !== null) {
      window.clearTimeout(hoverInTimer.current);
      hoverInTimer.current = null;
    }

    // 2. Schedule collapse to idle based on current state's hysteresis window
    if (modeRef.current === "peek") {
      leaveTimer.current = window.setTimeout(() => {
        setMode("idle");
        leaveTimer.current = null;
      }, PEEK_LEAVE_DELAY_MS);
    } else if (modeRef.current === "expanded") {
      leaveTimer.current = window.setTimeout(() => {
        setMode("idle");
        leaveTimer.current = null;
      }, EXPANDED_LEAVE_DELAY_MS);
    }
  };

  const onClick = () => {
    clearTimers();

    // Toggle logic:
    // If expanded -> collapse directly back to idle (original state)
    // If idle or peek -> expand to controls
    if (modeRef.current === "expanded") {
      setMode("idle");
    } else {
      setMode("expanded");
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  return {
    onMouseEnter,
    onMouseLeave,
    onClick,
  };
}
