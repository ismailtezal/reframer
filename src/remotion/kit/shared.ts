import { useVideoConfig } from "remotion";
import { resolveEasing } from "../../core/easing";
import type { EasingPreset } from "../../core/schema";
import { useClipBox } from "../context";

/**
 * Shared bits for the kit: studio-grade building blocks (light, camera, devices, type) that
 * AI-written code components import from `reframer`, so the craft lives in tuned parts instead
 * of being re-invented in every scene.
 */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 0→1 over [start, start + duration) frames with a named easing. */
export const ramp = (frame: number, start: number, duration: number, easing: EasingPreset = "smooth") =>
  duration <= 0 ? (frame >= start ? 1 : 0) : resolveEasing(easing)(clamp((frame - start) / duration, 0, 1));

/** The clip's length in frames (the whole composition outside the editor). */
export const useClipDuration = () => {
  const box = useClipBox() as { durationInFrames?: number };
  const { durationInFrames } = useVideoConfig();
  return box.durationInFrames ?? durationInFrames;
};

/** "#rrggbb" (or "#rgb") → "rgba(r,g,b,a)". Other color strings pass through untouched. */
export const rgba = (hex: string, alpha: number) => {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const n = Number.parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(alpha, 0, 1)})`;
};

/** Resolution-independent unit: 1 at 1080p (shorter canvas edge, like the built-in components). */
export const useKitUnit = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};
