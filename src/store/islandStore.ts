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

interface IslandState {
  mode: IslandMode;
  setMode: (mode: IslandMode) => void;
  toPeek: () => void;
  toExpanded: () => void;
  toIdle: () => void;
}

export const useIslandStore = create<IslandState>((set) => ({
  mode: "idle",
  setMode: (mode) => set({ mode }),
  toPeek: () => set({ mode: "peek" }),
  toExpanded: () => set({ mode: "expanded" }),
  toIdle: () => set({ mode: "idle" }),
}));
