import { create } from "zustand";

export type IslandMode = "idle" | "expanded";

interface IslandState {
  mode: IslandMode;
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
}

export const useIslandStore = create<IslandState>((set) => ({
  mode: "idle",
  expand: () => set({ mode: "expanded" }),
  collapse: () => set({ mode: "idle" }),
  toggle: () =>
    set((state) => ({
      mode: state.mode === "idle" ? "expanded" : "idle",
    })),
}));
