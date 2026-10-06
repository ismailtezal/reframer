import { useCurrentFrame, useVideoConfig } from "remotion";
import { resolveEasing } from "../../core/easing";
import type { EasingPreset } from "../../core/schema";

/**
 * Small helpers shared by built-in motion components (and exposed to
 * AI-written code components via the `reframer` module).
 */

/** Resolution-independent unit: 1 at 1080p, scales with the shorter canvas edge. */
export const useUnit = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};

/** 0→1 progress of an animation that starts at `delay` frames and lasts `duration` frames. */
export const progress = (frame: number, delay: number, duration: number, easing: EasingPreset = "smooth"): number => {
  if (duration <= 0) return frame >= delay ? 1 : 0;
  const t = Math.min(1, Math.max(0, (frame - delay) / duration));
  return resolveEasing(easing)(t);
};

/** Same as `progress`, but reads the current frame. */
export const useProgress = (delay: number, duration: number, easing: EasingPreset = "smooth") => {
  const frame = useCurrentFrame();
  return progress(frame, delay, duration, easing);
};

/** Exit progress (0 while visible, → 1 over the last `duration` frames of the clip). */
export const useExit = (clipDuration: number, duration: number, easing: EasingPreset = "ease-in") => {
  const frame = useCurrentFrame();
  return progress(frame, clipDuration - duration, duration, easing);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Formats numbers like "1.2K", "3.4M", "42%", "$1,200". */
export const formatNumber = (
  value: number,
  opts: { decimals?: number; compact?: boolean; prefix?: string; suffix?: string; separator?: boolean } = {},
) => {
  const { decimals = 0, compact = false, prefix = "", suffix = "", separator = true } = opts;
  let v = value;
  let unitSuffix = "";
  if (compact) {
    const abs = Math.abs(v);
    if (abs >= 1e9) {
      v /= 1e9;
      unitSuffix = "B";
    } else if (abs >= 1e6) {
      v /= 1e6;
      unitSuffix = "M";
    } else if (abs >= 1e3) {
      v /= 1e3;
      unitSuffix = "K";
    }
  }
  const fixed = v.toFixed(decimals);
  const [int, dec] = fixed.split(".");
  const intFmt = separator ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : int;
  return `${prefix}${intFmt}${dec ? `.${dec}` : ""}${unitSuffix}${suffix}`;
};

/** Deterministic random in [0, 1) for a seed. */
export const random01 = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const splitWords = (text: string) => text.split(/(\s+)/).filter((t) => t.length > 0);
