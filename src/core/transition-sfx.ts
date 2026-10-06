import type { TransitionType } from "./schema";

/**
 * The sound a transition plugin pack ships with each transition, using the
 * built-in library (src/core/sfx.ts). `peakSec` is where the sound's peak sits
 * inside the file; it is aligned with the transition's cut (its midpoint), the
 * frame where the picture swaps. Dissolves and dips stay silent on purpose.
 */
export const TRANSITION_SFX: Partial<Record<TransitionType, { sfx: string; peakSec: number; volume: number }>> = {
  whip: { sfx: "whip", peakSec: 0.12, volume: 0.6 },
  push: { sfx: "whoosh", peakSec: 0.45, volume: 0.5 },
  slide: { sfx: "swoosh", peakSec: 0.17, volume: 0.45 },
  "zoom-in": { sfx: "whoosh-fast", peakSec: 0.19, volume: 0.55 },
  "zoom-out": { sfx: "whoosh-fast", peakSec: 0.19, volume: 0.55 },
  spin: { sfx: "swoosh", peakSec: 0.17, volume: 0.55 },
  stretch: { sfx: "whoosh-fast", peakSec: 0.19, volume: 0.5 },
  warp: { sfx: "bass-hit", peakSec: 0, volume: 0.6 },
  flash: { sfx: "impact", peakSec: 0, volume: 0.65 },
  "dip-to-white": { sfx: "impact", peakSec: 0, volume: 0.55 },
  glitch: { sfx: "glitch", peakSec: 0.3, volume: 0.45 },
  "light-leak": { sfx: "sparkle", peakSec: 0.3, volume: 0.35 },
  wipe: { sfx: "swoosh", peakSec: 0.17, volume: 0.4 },
  iris: { sfx: "swoosh", peakSec: 0.17, volume: 0.4 },
  "clock-wipe": { sfx: "swoosh", peakSec: 0.17, volume: 0.4 },
};

/** Timeline frame where a paired sound starts, so its peak lands on the transition's cut. */
export const pairedSfxStart = (type: TransitionType, clipStart: number, durationFrames: number, fps: number) => {
  const pair = TRANSITION_SFX[type];
  if (!pair) return null;
  const cut = clipStart + Math.floor(durationFrames / 2);
  return { ...pair, start: Math.max(0, Math.round(cut - pair.peakSec * fps)) };
};
