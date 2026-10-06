"use client";

import { evaluateNumber, upsertKeyframe } from "@/core/keyframes";
import type { Clip, Project } from "@/core/schema";

/**
 * After-Effects-style "stopwatch" semantics: if a property already has
 * keyframes, editing it at the playhead creates/updates a keyframe there;
 * otherwise the base value changes.
 */

const BASE_PATHS: Record<string, (c: Clip) => number | undefined> = {
  x: (c) => c.transform.x,
  y: (c) => c.transform.y,
  width: (c) => c.transform.width,
  height: (c) => c.transform.height,
  scale: (c) => c.transform.scale,
  rotation: (c) => c.transform.rotation,
  opacity: (c) => c.transform.opacity,
};

export const isKeyframed = (clip: Clip, prop: string) => (clip.keyframes?.[prop]?.length ?? 0) > 0;

/** Current value of a transform property at a timeline frame (keyframes applied). */
export const valueAt = (clip: Clip, prop: string, timelineFrame: number): number => {
  const base = BASE_PATHS[prop]?.(clip) ?? 0;
  const local = Math.max(0, Math.min(clip.duration - 1, timelineFrame - clip.start));
  return evaluateNumber(clip.keyframes, prop, local, base);
};

/** Mutates a draft clip: sets a transform property honoring keyframes. */
export const setTransformValue = (
  draft: Project,
  clipId: string,
  prop: keyof Clip["transform"] & string,
  value: number,
  timelineFrame: number,
) => {
  const clip = draft.clips[clipId];
  if (!clip) return;
  if (isKeyframed(clip, prop)) {
    const local = Math.max(0, Math.min(clip.duration - 1, timelineFrame - clip.start));
    const track = clip.keyframes?.[prop] ?? [];
    const existing = track.find((k) => k.frame === local);
    clip.keyframes = {
      ...clip.keyframes,
      [prop]: upsertKeyframe(track, { frame: local, value, easing: existing?.easing ?? "smooth" }),
    };
  } else {
    (clip.transform as Record<string, unknown>)[prop] = value;
  }
  if (clip.meta && (clip.meta.createdBy === "ai" || clip.meta.createdBy === "agent")) clip.meta.humanEdited = true;
};
