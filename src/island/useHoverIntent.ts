import { useEffect, useRef } from "react";
import { useIslandStore } from "../store/islandStore";
import { HOVER_IN_DELAY_MS, HOVER_OUT_DELAY_MS } from "./constants";

export function useHoverIntent() {
  const mode = useIslandStore((s) => s.mode);
  const expand = useIslandStore((s) => s.expand);
  const collapse = useIslandStore((s) => s.collapse);
  const toggle = useIslandStore((s) => s.toggle);

  const hoverInTimer = useRef<number | null>(null);
  const hoverOutTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (hoverInTimer.current !== null) {
      window.clearTimeout(hoverInTimer.current);
      hoverInTimer.current = null;
    }
    if (hoverOutTimer.current !== null) {
      window.clearTimeout(hoverOutTimer.current);
      hoverOutTimer.current = null;
    }
  };

  const onMouseEnter = () => {
    // If the cursor re-enters while a collapse is pending, cancel the collapse
    if (hoverOutTimer.current !== null) {
      window.clearTimeout(hoverOutTimer.current);
      hoverOutTimer.current = null;
    }

    // Only schedule expansion if currently idle
    if (mode === "idle") {
      hoverInTimer.current = window.setTimeout(() => {
        expand();
        hoverInTimer.current = null;
      }, HOVER_IN_DELAY_MS);
    }
  };

  const onMouseLeave = () => {
    // If cursor left before the 120ms expansion delay fired, cancel the expansion
    if (hoverInTimer.current !== null) {
      window.clearTimeout(hoverInTimer.current);
      hoverInTimer.current = null;
    }

    // If currently expanded, collapse after hysteresis delay
    if (mode === "expanded") {
      hoverOutTimer.current = window.setTimeout(() => {
        collapse();
        hoverOutTimer.current = null;
      }, HOVER_OUT_DELAY_MS);
    }
  };

  const onClick = () => {
    clearTimers();
    toggle();
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
