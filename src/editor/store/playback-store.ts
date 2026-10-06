"use client";

import type { PlayerRef } from "@remotion/player";
import { create } from "zustand";

/**
 * Playback state lives in its own tiny store: the playhead updates up to 60×/s
 * and only the playhead, timecode and transport should re-render for it.
 */

type PlaybackStore = {
  frame: number;
  playing: boolean;
  /** In/out range for loop playback and range export. */
  inFrame: number | null;
  outFrame: number | null;
  loop: boolean;
  setFrame: (frame: number) => void;
  setPlaying: (playing: boolean) => void;
  setInOut: (inFrame: number | null, outFrame: number | null) => void;
  setLoop: (loop: boolean) => void;
};

export const usePlaybackStore = create<PlaybackStore>()((set) => ({
  frame: 0,
  playing: false,
  inFrame: null,
  outFrame: null,
  loop: false,
  setFrame: (frame) => set({ frame }),
  setPlaying: (playing) => set({ playing }),
  setInOut: (inFrame, outFrame) => set({ inFrame, outFrame }),
  setLoop: (loop) => set({ loop }),
}));

let player: PlayerRef | null = null;

export const registerPlayer = (ref: PlayerRef | null) => {
  player = ref;
};

export const getPlayer = () => player;

export const seek = (frame: number) => {
  const f = Math.max(0, Math.round(frame));
  usePlaybackStore.getState().setFrame(f);
  player?.seekTo(f);
};

export const play = () => player?.play();
export const pause = () => player?.pause();
export const togglePlay = () => player?.toggle();
export const getCurrentFrame = () => player?.getCurrentFrame() ?? usePlaybackStore.getState().frame;

const COARSE_STEP = 15;

/**
 * The playhead for UI that doesn't need every frame (inspector values): exact
 * while paused, and only every 15th frame during playback.
 */
export const useCoarseFrame = (): number => {
  const v = usePlaybackStore((s) => (s.playing ? -1 - Math.floor(s.frame / COARSE_STEP) : s.frame));
  return v < 0 ? (-v - 1) * COARSE_STEP : v;
};
