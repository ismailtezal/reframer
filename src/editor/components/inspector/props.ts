"use client";

import { evaluateKeyframes, upsertKeyframe } from "@/core/keyframes";
import { USER } from "@/core/ops";
import type { Clip, Project } from "@/core/schema";
import { run } from "../../actions";
import { usePlaybackStore } from "../../store/playback-store";

/**
 * Uniform access to animatable values by path:
 *   transform props: "x", "y", "width", "height", "scale", "rotation", "opacity"
 *   others: "volume", "blur", "drawProgress", "strokeWidth", "stroke",
 *           "style.color", "style.fontSize", "props.<name>"
 */

const TRANSFORM = new Set(["x", "y", "width", "height", "scale", "rotation", "opacity"]);

export const getBase = (clip: Clip, path: string): unknown => {
  if (TRANSFORM.has(path)) return clip.transform[path as keyof Clip["transform"]];
  if (path.startsWith("props.") && clip.type === "component") return clip.props[path.slice(6)];
  if (path.startsWith("style.") && (clip.type === "text" || clip.type === "captions")) {
    return (clip.style as Record<string, unknown>)[path.slice(6)];
  }
  if (path === "blur") return 0;
  return (clip as Record<string, unknown>)[path];
};

const setBase = (clip: Clip, path: string, value: unknown) => {
  if (TRANSFORM.has(path)) {
    (clip.transform as Record<string, unknown>)[path] = value;
  } else if (path.startsWith("props.") && clip.type === "component") {
    clip.props[path.slice(6)] = value;
  } else if (path.startsWith("style.") && (clip.type === "text" || clip.type === "captions")) {
    (clip.style as Record<string, unknown>)[path.slice(6)] = value;
  } else {
    (clip as Record<string, unknown>)[path] = value;
  }
};

const localFrame = (clip: Clip) => Math.max(0, Math.min(clip.duration - 1, usePlaybackStore.getState().frame - clip.start));

/** Current (keyframed) value at the playhead. */
export const valueAtPlayhead = <T>(clip: Clip, path: string, fallback: T): T => {
  const track = clip.keyframes?.[path];
  if (track && track.length > 0) {
    const v = evaluateKeyframes(track, localFrame(clip));
    return (v ?? fallback) as T;
  }
  const base = getBase(clip, path);
  return (base ?? fallback) as T;
};

export const keyframeState = (clip: Clip, path: string, timelineFrame: number): "none" | "track" | "on" => {
  const track = clip.keyframes?.[path];
  if (!track || track.length === 0) return "none";
  const local = timelineFrame - clip.start;
  return track.some((k) => k.frame === local) ? "on" : "track";
};

const markHuman = (clip: Clip) => {
  if (clip.meta && (clip.meta.createdBy === "ai" || clip.meta.createdBy === "agent")) clip.meta.humanEdited = true;
};

/** Sets a value honoring keyframes (keyframed → keyframe at playhead; otherwise base). */
export const setValue = (clipId: string, path: string, value: unknown, label?: string) =>
  run(
    label ?? `Edit ${path.replace(/^(props|style)\./, "")}`,
    (d: Project) => {
      const clip = d.clips[clipId];
      if (!clip) return;
      if (clip.locked) throw new Error("Clip is locked");
      const track = clip.keyframes?.[path];
      if (track && track.length > 0 && (typeof value === "number" || typeof value === "string")) {
        const f = localFrame(clip);
        const existing = track.find((k) => k.frame === f);
        clip.keyframes = { ...clip.keyframes, [path]: upsertKeyframe(track, { frame: f, value, easing: existing?.easing ?? "smooth" }) };
      } else {
        setBase(clip, path, value);
      }
      markHuman(clip);
      d.updatedAt = Date.now();
    },
    `set:${clipId}:${path}`,
  );

/** Diamond button behaviour. */
export const toggleKeyframe = (clipId: string, path: string, currentValue: number | string) =>
  run("Toggle keyframe", (d: Project) => {
    const clip = d.clips[clipId];
    if (!clip) return;
    const f = localFrame(clip);
    const track = clip.keyframes?.[path] ?? [];
    const exists = track.some((k) => k.frame === f);
    const next = exists ? track.filter((k) => k.frame !== f) : upsertKeyframe(track, { frame: f, value: currentValue, easing: "smooth" });
    const keyframes = { ...(clip.keyframes ?? {}) };
    if (next.length === 0) delete keyframes[path];
    else keyframes[path] = next;
    clip.keyframes = keyframes;
    // Removing the last keyframe keeps the value as the new base.
    if (next.length === 0) setBase(clip, path, currentValue);
    markHuman(clip);
  });

export const actor = USER;
