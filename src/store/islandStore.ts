import { create } from "zustand";

/**
 * State Transition Table:
 *
 * | Current State | Trigger Event                       | Next State | Timing / Rule                         |
 * | :------------ | :---------------------------------- | :--------- | :------------------------------------ |
 * | idle          | pointer enters notch               | peek       | 120ms hover delay                     |
 * | idle          | click on notch                      | expanded   | immediate                             |
 * | peek          | click on notch                      | expanded   | immediate                             |
 * | peek          | pointer leaves                      | idle       | 250ms hysteresis delay                |
 * | expanded      | click on notch                      | peek       | immediate                             |
 * | expanded      | pointer leaves                      | idle       | 400ms leave delay                     |
 * | any (leaving) | pointer re-enters before delay fires| (no change)| cancels leave timer, preserves state  |
 * | any           | click                               | (target)   | cancels all pending timers            |
 */
export type IslandMode = "idle" | "peek" | "expanded";

export type CollapsedMode =
  | "music"
  | "charging_connected"
  | "charging_disconnected"
  | "wifi_connected"
  | "wifi_disconnected"
  | "bluetooth_connected"
  | "bluetooth_disconnected"
  | "airplane_on"
  | "airplane_off"
  | "low_power";

interface IslandState {
  mode: IslandMode;
  collapsedMode: CollapsedMode;
  setMode: (mode: IslandMode) => void;
  setCollapsedMode: (collapsedMode: CollapsedMode) => void;
  expand: () => void;
  toPeek: () => void;
  toExpanded: () => void;
  toIdle: () => void;
}

export const useIslandStore = create<IslandState>((set) => ({
  mode: "idle",
  collapsedMode: "music",
  setMode: (mode) => set({ mode }),
  setCollapsedMode: (collapsedMode) => set({ collapsedMode }),
  expand: () => set({ mode: "expanded" }),
  toPeek: () => set({ mode: "peek" }),
  toExpanded: () => set({ mode: "expanded" }),
  toIdle: () => set({ mode: "idle" }),
}));
