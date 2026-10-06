"use client";

import { create } from "zustand";

/**
 * The visible slice of the timeline lanes, in lane pixels. Clip internals
 * (filmstrips, waveforms) draw only what's inside it, so a long project at
 * high zoom costs the same as a short one.
 */
export const useTimelineViewport = create<{ left: number; width: number }>()(() => ({ left: 0, width: 1600 }));

/** Granularity of viewport updates: content re-renders only when crossing a block. */
export const VIEWPORT_BLOCK = 400;

/** The drawable window for a clip, or null when it's off screen. Selector-friendly. */
export const useVisibleSpan = (clipLeft: number, clipWidth: number): [number, number] | null => {
  const key = useTimelineViewport((s) => `${Math.floor(s.left / VIEWPORT_BLOCK)}:${Math.ceil((s.left + s.width) / VIEWPORT_BLOCK)}`);
  const [a, b] = key.split(":").map(Number);
  // One block of margin on each side keeps fast scrolling from showing gaps.
  const winStart = (a - 1) * VIEWPORT_BLOCK;
  const winEnd = (b + 1) * VIEWPORT_BLOCK;
  const start = Math.max(0, winStart - clipLeft);
  const end = Math.min(clipWidth, winEnd - clipLeft);
  return end > start ? [start, end] : null;
};
