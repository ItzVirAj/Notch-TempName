import { create } from "zustand";

export interface MediaSnapshot {
  hasSession: boolean;
  title: string;
  artist: string;
  album: string;
  sourceApp?: string | null;
  isPlaying: boolean;
  playbackRate: number;
  positionMs: number;
  durationMs: number;
  canPlayPause: boolean;
  canNext: boolean;
  canPrevious: boolean;
  thumbnailVersion: number;
}

export const INITIAL_MEDIA_SNAPSHOT: MediaSnapshot = {
  hasSession: false,
  title: "",
  artist: "",
  album: "",
  sourceApp: null,
  isPlaying: false,
  playbackRate: 1.0,
  positionMs: 0,
  durationMs: 0,
  canPlayPause: false,
  canNext: false,
  canPrevious: false,
  thumbnailVersion: 0,
};

interface MediaStoreState {
  snapshot: MediaSnapshot;
  thumbnailUrl: string | null;
  setSnapshot: (snapshot: MediaSnapshot) => void;
  setThumbnailUrl: (url: string | null) => void;
}

export const useMediaStore = create<MediaStoreState>((set) => ({
  snapshot: INITIAL_MEDIA_SNAPSHOT,
  thumbnailUrl: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  setThumbnailUrl: (thumbnailUrl) => set({ thumbnailUrl }),
}));
