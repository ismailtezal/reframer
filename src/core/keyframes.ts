import { mixColors, parseColor } from "./color";
import { resolveEasing } from "./easing";
import type { Keyframe, KeyframeTracks } from "./schema/primitives";

/**
 * Evaluates a keyframe track at a clip-local frame.
 * Numbers interpolate, colors blend, other strings hold.
 */
export const evaluateKeyframes = (keyframes: readonly Keyframe[], frame: number): number | string | undefined => {
  if (keyframes.length === 0) return undefined;
  if (keyframes.length === 1 || frame <= keyframes[0].frame) return keyframes[0].value;
  const last = keyframes[keyframes.length - 1];
  if (frame >= last.frame) return last.value;

  // Tracks are kept sorted by the ops layer; find the active segment.
  let i = 0;
  while (i < keyframes.length - 1 && keyframes[i + 1].frame <= frame) i++;
  const from = keyframes[i];
  const to = keyframes[i + 1];
  const span = to.frame - from.frame;
  const t = span <= 0 ? 1 : (frame - from.frame) / span;
  const eased = resolveEasing(from.easing, "ease-in-out")(t);

  if (typeof from.value === "number" && typeof to.value === "number") {
    return from.value + (to.value - from.value) * eased;
  }
  if (typeof from.value === "string" && typeof to.value === "string" && parseColor(from.value) && parseColor(to.value)) {
    return mixColors(from.value, to.value, eased);
  }
  return eased >= 1 ? to.value : from.value;
};

export const evaluateNumber = (tracks: KeyframeTracks | undefined, property: string, frame: number, base: number): number => {
  const track = tracks?.[property];
  if (!track || track.length === 0) return base;
  const v = evaluateKeyframes(track, frame);
  return typeof v === "number" ? v : base;
};

export const evaluateAny = <T extends number | string>(tracks: KeyframeTracks | undefined, property: string, frame: number, base: T): T => {
  const track = tracks?.[property];
  if (!track || track.length === 0) return base;
  const v = evaluateKeyframes(track, frame);
  return v === undefined ? base : (v as T);
};

/** Inserts or replaces a keyframe, keeping the track sorted. */
export const upsertKeyframe = (track: Keyframe[], keyframe: Keyframe): Keyframe[] => {
  const next = track.filter((k) => k.frame !== keyframe.frame);
  next.push(keyframe);
  next.sort((a, b) => a.frame - b.frame);
  return next;
};

export const sortKeyframes = (track: Keyframe[]): Keyframe[] => [...track].sort((a, b) => a.frame - b.frame);

/** Shifts/trims a track when a clip's start is trimmed by `delta` frames. */
export const shiftKeyframes = (track: Keyframe[], delta: number): Keyframe[] =>
  track.map((k) => ({ ...k, frame: Math.max(0, k.frame + delta) }));
