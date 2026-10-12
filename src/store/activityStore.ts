import { create } from "zustand";
import {
  ACTIVITY_DEDUPE_WINDOW_MS,
  ACTIVITY_INITIAL_SUPPRESSION_MS,
  ACTIVITY_MAX_QUEUE_SIZE,
  ACTIVITY_TTL_BATTERY_LOW_MS,
  ACTIVITY_TTL_BLUETOOTH_MS,
  ACTIVITY_TTL_CHARGING_MS,
  ACTIVITY_TTL_VOLUME_MS,
  ACTIVITY_TTL_WIFI_MS,
} from "../island/constants";
import { useSettingsStore } from "./settingsStore";

export type ActivityKind =
  | "bluetooth"
  | "wifi"
  | "charging"
  | "volume"
  | "battery-low";

export type ActivityDeviceType =
  | "headphones"
  | "speaker"
  | "keyboard"
  | "mouse"
  | "phone"
  | "generic";

export interface Activity {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle?: string;
  value?: number; // e.g., volume 0-100 or battery percentage
  state: "connected" | "disconnected" | "charging" | "unplugged" | "low" | "level";
  ttlMs: number;
  priority: number;
  deviceType?: ActivityDeviceType;
}

export const DEFAULT_PRIORITIES: Record<ActivityKind, number> = {
  "battery-low": 5,
  charging: 4,
  bluetooth: 3,
  wifi: 2,
  volume: 1,
};

export const DEFAULT_TTLS: Record<ActivityKind, number> = {
  "battery-low": ACTIVITY_TTL_BATTERY_LOW_MS,
  charging: ACTIVITY_TTL_CHARGING_MS,
  bluetooth: ACTIVITY_TTL_BLUETOOTH_MS,
  wifi: ACTIVITY_TTL_WIFI_MS,
  volume: ACTIVITY_TTL_VOLUME_MS,
};

interface ActivityState {
  currentActivity: Activity | null;
  queue: Activity[];
  isHovered: boolean;

  pushActivity: (activity: Omit<Activity, "priority" | "ttlMs"> & { priority?: number; ttlMs?: number }) => void;
  dismissCurrent: () => void;
  clearAll: () => void;
  setHovered: (hovered: boolean) => void;
}

// Global timer reference to ensure ONLY ONE dismiss timer exists at any time
let dismissTimerId: number | null = null;
let timerStartedAt: number = 0;
let remainingTtlMs: number = 0;

// App startup timestamp for initial 3-second alert suppression
const APP_START_TIME = Date.now();

// Deduplication log: map of `${kind}:${id}` -> last timestamp
const lastEventTimestamps = new Map<string, number>();

function clearDismissTimer() {
  if (dismissTimerId !== null) {
    window.clearTimeout(dismissTimerId);
    dismissTimerId = null;
  }
}

function scheduleDismiss(durationMs: number, onDismiss: () => void) {
  clearDismissTimer();
  remainingTtlMs = durationMs;
  timerStartedAt = Date.now();
  dismissTimerId = window.setTimeout(() => {
    dismissTimerId = null;
    onDismiss();
  }, durationMs);
}

export const useActivityStore = create<ActivityState>((set, get) => {
  const advanceQueueOrClear = () => {
    clearDismissTimer();
    const { queue } = get();

    if (queue.length > 0) {
      // Pick next activity with highest priority
      const next = queue[0];
      const remainingQueue = queue.slice(1);
      set({ currentActivity: next, queue: remainingQueue });

      if (!get().isHovered) {
        scheduleDismiss(next.ttlMs, () => {
          advanceQueueOrClear();
        });
      } else {
        remainingTtlMs = next.ttlMs;
      }
    } else {
      set({ currentActivity: null, queue: [] });
    }
  };

  return {
    currentActivity: null,
    queue: [],
    isHovered: false,

    pushActivity: (raw) => {
      // 1. Initial 3-second suppression rule
      if (Date.now() - APP_START_TIME < ACTIVITY_INITIAL_SUPPRESSION_MS) {
        return;
      }

      // 2. Check settings toggles
      const settings = useSettingsStore.getState();
      if (!settings.liveActivitiesEnabled) return;
      if (raw.kind === "bluetooth" && !settings.bluetoothActivitiesEnabled) return;
      if (raw.kind === "wifi" && !settings.wifiActivitiesEnabled) return;
      if (raw.kind === "volume" && !settings.volumeActivitiesEnabled) return;
      if (raw.kind === "charging" && !settings.chargingActivitiesEnabled) return;
      if (raw.kind === "battery-low" && !settings.batteryLowActivitiesEnabled) return;

      const priority = raw.priority ?? DEFAULT_PRIORITIES[raw.kind];
      const ttlMs = raw.ttlMs ?? DEFAULT_TTLS[raw.kind];
      const fullActivity: Activity = {
        ...raw,
        priority,
        ttlMs,
      };

      const now = Date.now();
      const eventKey = `${fullActivity.kind}:${fullActivity.id}:${fullActivity.state}`;

      // 3. Ignore duplicate events for same kind, id & state arriving within 1500ms
      // (Exception: volume updates value continuously and is not suppressed)
      if (fullActivity.kind !== "volume") {
        const lastSeen = lastEventTimestamps.get(eventKey);
        if (lastSeen && now - lastSeen < ACTIVITY_DEDUPE_WINDOW_MS) {
          return;
        }
        lastEventTimestamps.set(eventKey, now);
      }

      const { currentActivity, queue } = get();

      // 4. Same kind and ID: replace in-place (updates content, restarts timer, no re-expand animation)
      if (currentActivity && currentActivity.kind === fullActivity.kind && currentActivity.id === fullActivity.id) {
        set({ currentActivity: fullActivity });
        if (!get().isHovered) {
          scheduleDismiss(fullActivity.ttlMs, () => {
            advanceQueueOrClear();
          });
        } else {
          remainingTtlMs = fullActivity.ttlMs;
        }
        return;
      }

      // 5. If no activity is active, display immediately
      if (!currentActivity) {
        set({ currentActivity: fullActivity });
        if (!get().isHovered) {
          scheduleDismiss(fullActivity.ttlMs, () => {
            advanceQueueOrClear();
          });
        } else {
          remainingTtlMs = fullActivity.ttlMs;
        }
        return;
      }

      // 6. Higher priority replaces current activity immediately; displace old current into queue
      if (fullActivity.priority > currentActivity.priority) {
        clearDismissTimer();
        const updatedQueue = [currentActivity, ...queue].slice(0, ACTIVITY_MAX_QUEUE_SIZE);
        set({ currentActivity: fullActivity, queue: updatedQueue });

        if (!get().isHovered) {
          scheduleDismiss(fullActivity.ttlMs, () => {
            advanceQueueOrClear();
          });
        } else {
          remainingTtlMs = fullActivity.ttlMs;
        }
        return;
      }

      // 7. Lower or equal priority waits in queue (max 3 queued, drop oldest if full)
      const nextQueue = [...queue, fullActivity];
      if (nextQueue.length > ACTIVITY_MAX_QUEUE_SIZE) {
        nextQueue.shift(); // drop the oldest
      }
      set({ queue: nextQueue });
    },

    dismissCurrent: () => {
      advanceQueueOrClear();
    },

    clearAll: () => {
      clearDismissTimer();
      set({ currentActivity: null, queue: [] });
    },

    setHovered: (hovered: boolean) => {
      const prev = get().isHovered;
      if (prev === hovered) return;

      set({ isHovered: hovered });
      const { currentActivity } = get();
      if (!currentActivity) return;

      if (hovered) {
        // Pointer over notch: pause activity timer (the activity stays)
        if (dismissTimerId !== null) {
          const elapsed = Date.now() - timerStartedAt;
          remainingTtlMs = Math.max(1000, remainingTtlMs - elapsed);
          clearDismissTimer();
        }
      } else {
        // Pointer left: resume dismiss timer with remaining TTL
        const resumeDuration = remainingTtlMs > 0 ? remainingTtlMs : currentActivity.ttlMs;
        scheduleDismiss(resumeDuration, () => {
          advanceQueueOrClear();
        });
      }
    },
  };
});
