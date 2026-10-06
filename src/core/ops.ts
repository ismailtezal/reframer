import { current, isDraft } from "immer";
import { createTrack, fullFrameTransform } from "./defaults";
import { newId } from "./ids";
import { shiftKeyframes, sortKeyframes, upsertKeyframe } from "./keyframes";
import { getClipEnd, getTrack, getTrackClips, isRangeFree } from "./project-utils";
import type { Asset, Clip, CodeComponent, Effect, Keyframe, Marker, Project, ProjectSettings, Track, Transition } from "./schema";

/**
 * The single edit API. Every mutation — timeline drags, inspector edits,
 * the built-in agent, MCP agents — goes through these functions. They mutate
 * an Immer draft (or a plain object) and throw `EditError` on violations.
 */

export type Actor = {
  kind: "user" | "ai" | "agent";
  /** e.g. "Claude Code", "gpt-6" */
  name?: string;
  turnId?: string;
};

export const USER: Actor = { kind: "user" };

export type EditErrorCode = "NOT_FOUND" | "LOCKED" | "HUMAN_EDITED" | "INVALID" | "OVERLAP";

export class EditError extends Error {
  constructor(
    public code: EditErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EditError";
  }
}

export type Placement = "exact" | "auto-track" | "ripple" | "overwrite";

export type EditOptions = {
  actor?: Actor;
  /** Allow agents to modify clips a human has edited. Only after the user asked. */
  force?: boolean;
};

const isAgent = (actor: Actor | undefined) => actor?.kind === "ai" || actor?.kind === "agent";

/** Deep clone that works on Immer drafts as well as plain objects. */
export const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(isDraft(value) ? current(value as never) : value)) as T;

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export const getClipOrThrow = (draft: Project, clipId: string): Clip => {
  const clip = draft.clips[clipId];
  if (!clip) throw new EditError("NOT_FOUND", `Clip "${clipId}" does not exist.`);
  return clip;
};

const getTrackOrThrow = (draft: Project, trackId: string): Track => {
  const track = getTrack(draft, trackId);
  if (!track) throw new EditError("NOT_FOUND", `Track "${trackId}" does not exist.`);
  return track;
};

export const assertTrackEditable = (draft: Project, trackId: string) => {
  const track = getTrackOrThrow(draft, trackId);
  if (track.locked) {
    throw new EditError("LOCKED", `Track "${track.name}" is locked by the user.`);
  }
};

export const assertClipEditable = (draft: Project, clip: Clip, opts: EditOptions = {}) => {
  assertTrackEditable(draft, clip.trackId);
  if (clip.locked) {
    throw new EditError("LOCKED", `Clip "${clip.name ?? clip.id}" is locked by the user.`);
  }
  if (isAgent(opts.actor) && clip.meta?.humanEdited && !opts.force) {
    throw new EditError(
      "HUMAN_EDITED",
      `Clip "${clip.name ?? clip.id}" was hand-edited by the user. Ask before changing it, then retry with force: true.`,
    );
  }
};

/** Records authorship: humans touching agent-made clips mark them human-owned. */
const stamp = (clip: Clip, actor: Actor | undefined) => {
  if (!actor || actor.kind !== "user") return;
  if (clip.meta && (clip.meta.createdBy === "ai" || clip.meta.createdBy === "agent")) {
    clip.meta.humanEdited = true;
  }
};

const touch = (draft: Project) => {
  draft.updatedAt = Date.now();
};

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export const addTrack = (draft: Project, input: { kind: Track["kind"]; name?: string; index?: number; magnetic?: boolean }): string => {
  const track = createTrack(input.kind, input.name ?? defaultTrackName(draft, input.kind), {
    magnetic: input.magnetic,
  });
  const index =
    input.index ??
    (input.kind === "audio"
      ? draft.tracks.length
      : Math.max(
          0,
          draft.tracks.findIndex((t) => t.kind === "visual"),
        ));
  draft.tracks.splice(Math.max(0, Math.min(index, draft.tracks.length)), 0, track);
  touch(draft);
  return track.id;
};

const defaultTrackName = (draft: Project, kind: Track["kind"]) => {
  const n = draft.tracks.filter((t) => t.kind === kind).length + 1;
  return kind === "audio" ? `Audio ${n}` : `Track ${n}`;
};

export const updateTrack = (draft: Project, trackId: string, patch: Partial<Omit<Track, "id" | "kind">>) => {
  const track = getTrackOrThrow(draft, trackId);
  Object.assign(track, patch);
  touch(draft);
};

export const removeTrack = (draft: Project, trackId: string, opts: EditOptions = {}) => {
  assertTrackEditable(draft, trackId);
  for (const clip of Object.values(draft.clips)) {
    if (clip.trackId === trackId) {
      assertClipEditable(draft, clip, opts);
      delete draft.clips[clip.id];
    }
  }
  draft.tracks = draft.tracks.filter((t) => t.id !== trackId);
  touch(draft);
};

export const moveTrack = (draft: Project, trackId: string, toIndex: number) => {
  const from = draft.tracks.findIndex((t) => t.id === trackId);
  if (from === -1) throw new EditError("NOT_FOUND", `Track "${trackId}" does not exist.`);
  const [track] = draft.tracks.splice(from, 1);
  draft.tracks.splice(Math.max(0, Math.min(toIndex, draft.tracks.length)), 0, track);
  touch(draft);
};

/** Finds (or creates) a track of the right kind where [start, end) is free. */
const findFreeTrack = (draft: Project, preferredTrackId: string, start: number, end: number, ignore: Set<string>) => {
  const preferred = getTrackOrThrow(draft, preferredTrackId);
  if (!preferred.locked && isRangeFree(draft, preferred.id, start, end, ignore)) return preferred.id;
  const idx = draft.tracks.findIndex((t) => t.id === preferred.id);
  // Search upwards first (overlays stack on top), then downwards.
  const candidates = [...draft.tracks.slice(0, idx).reverse(), ...draft.tracks.slice(idx + 1)].filter(
    (t) => t.kind === preferred.kind && !t.locked,
  );
  for (const t of candidates) {
    if (isRangeFree(draft, t.id, start, end, ignore)) return t.id;
  }
  return addTrack(draft, { kind: preferred.kind, index: preferred.kind === "audio" ? idx + 1 : idx });
};

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

const shiftTrackClips = (draft: Project, trackId: string, fromFrame: number, delta: number, ignore: Set<string>) => {
  for (const clip of Object.values(draft.clips)) {
    if (clip.trackId === trackId && !ignore.has(clip.id) && clip.start >= fromFrame) {
      clip.start = Math.max(0, clip.start + delta);
    }
  }
};

/** Removes the parts of other clips on `trackId` that overlap [start, end). */
const carveRange = (draft: Project, trackId: string, start: number, end: number, ignore: Set<string>, opts: EditOptions) => {
  for (const clip of Object.values(draft.clips)) {
    if (clip.trackId !== trackId || ignore.has(clip.id)) continue;
    const cEnd = getClipEnd(clip);
    if (clip.start >= end || cEnd <= start) continue;
    assertClipEditable(draft, clip, opts);
    if (clip.start >= start && cEnd <= end) {
      delete draft.clips[clip.id];
    } else if (clip.start < start && cEnd > end) {
      const rightId = splitClip(draft, clip.id, end, opts)[1];
      trimClip(draft, clip.id, { end: start }, opts);
      void rightId;
    } else if (clip.start < start) {
      trimClip(draft, clip.id, { end: start }, opts);
    } else {
      trimClip(draft, clip.id, { start: end }, opts);
    }
  }
};

export const insertClip = (draft: Project, clip: Clip, placement: Placement = "auto-track", opts: EditOptions = {}): string => {
  if (draft.clips[clip.id]) throw new EditError("INVALID", `Clip id "${clip.id}" already exists.`);
  const track = getTrackOrThrow(draft, clip.trackId);
  if ((clip.type === "audio") !== (track.kind === "audio")) {
    throw new EditError(
      "INVALID",
      clip.type === "audio" ? "Audio clips must go on an audio track." : `A ${clip.type} clip cannot go on audio track "${track.name}".`,
    );
  }
  if ("assetId" in clip && !draft.assets[clip.assetId]) {
    throw new EditError("NOT_FOUND", `Asset "${clip.assetId}" does not exist.`);
  }
  const end = getClipEnd(clip);
  const ignore = new Set([clip.id]);
  switch (placement) {
    case "exact":
      assertTrackEditable(draft, clip.trackId);
      if (!isRangeFree(draft, clip.trackId, clip.start, end, ignore)) {
        throw new EditError("OVERLAP", `The range is occupied on track "${track.name}".`);
      }
      break;
    case "auto-track":
      clip.trackId = findFreeTrack(draft, clip.trackId, clip.start, end, ignore);
      break;
    case "ripple": {
      assertTrackEditable(draft, clip.trackId);
      const spanning = Object.values(draft.clips).find(
        (c) => c.trackId === clip.trackId && c.start < clip.start && getClipEnd(c) > clip.start,
      );
      if (spanning) splitClip(draft, spanning.id, clip.start, opts);
      shiftTrackClips(draft, clip.trackId, clip.start, clip.duration, ignore);
      break;
    }
    case "overwrite":
      assertTrackEditable(draft, clip.trackId);
      carveRange(draft, clip.trackId, clip.start, end, ignore, opts);
      break;
  }
  if (opts.actor && !clip.meta) {
    clip.meta = {
      createdBy: opts.actor.kind === "user" ? "user" : opts.actor.kind,
      agent: opts.actor.name,
      turnId: opts.actor.turnId,
    };
  }
  draft.clips[clip.id] = clip;
  touch(draft);
  return clip.id;
};

/** Partial update; `null` deletes a key. Shape-checked at runtime by the schema on save. */
export type ClipPatch = Record<string, unknown>;

const MERGE_KEYS = new Set(["transform", "style", "props", "animations", "meta"]);

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Applies a partial update. Nested objects in `transform`, `style`, `props`,
 * `animations` and `meta` merge; everything else replaces. `null` deletes a key.
 */
export const updateClip = (draft: Project, clipId: string, patch: ClipPatch, opts: EditOptions = {}) => {
  const clip = getClipOrThrow(draft, clipId);
  assertClipEditable(draft, clip, opts);
  const target = clip as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (key === "id" || key === "type") continue;
    if (key === "trackId" && typeof value === "string" && value !== clip.trackId) {
      moveClip(draft, clipId, { trackId: value }, "auto-track", opts);
      continue;
    }
    if (value === null) {
      delete target[key];
    } else if (MERGE_KEYS.has(key) && isPlainObject(value) && isPlainObject(target[key])) {
      const nested = target[key] as Record<string, unknown>;
      for (const [k, v] of Object.entries(value)) {
        if (v === null) delete nested[k];
        else nested[k] = v;
      }
    } else {
      target[key] = value;
    }
  }
  if (typeof patch.start === "number") clip.start = Math.max(0, Math.round(clip.start));
  if (typeof patch.duration === "number") clip.duration = Math.max(1, Math.round(clip.duration));
  stamp(clip, opts.actor);
  syncLinkedCaptions(draft, clip);
  touch(draft);
};

export const moveClip = (
  draft: Project,
  clipId: string,
  to: { start?: number; trackId?: string },
  placement: Placement = "auto-track",
  opts: EditOptions = {},
): string => {
  const clip = getClipOrThrow(draft, clipId);
  assertClipEditable(draft, clip, opts);
  const targetTrackId = to.trackId ?? clip.trackId;
  const target = getTrackOrThrow(draft, targetTrackId);
  if ((clip.type === "audio") !== (target.kind === "audio")) {
    throw new EditError("INVALID", "Audio and visual clips cannot share tracks.");
  }
  const start = Math.max(0, Math.round(to.start ?? clip.start));
  const end = start + clip.duration;
  const ignore = new Set([clip.id]);
  let trackId = targetTrackId;
  if (placement === "auto-track") {
    trackId = findFreeTrack(draft, targetTrackId, start, end, ignore);
  } else if (placement === "exact") {
    assertTrackEditable(draft, targetTrackId);
    if (!isRangeFree(draft, targetTrackId, start, end, ignore)) {
      throw new EditError("OVERLAP", `The range is occupied on track "${target.name}".`);
    }
  } else if (placement === "overwrite") {
    carveRange(draft, targetTrackId, start, end, ignore, opts);
  } else if (placement === "ripple") {
    shiftTrackClips(draft, targetTrackId, start, clip.duration, ignore);
  }
  clip.start = start;
  clip.trackId = trackId;
  stamp(clip, opts.actor);
  syncLinkedCaptions(draft, clip);
  touch(draft);
  return trackId;
};

const hasSourceMedia = (clip: Clip): clip is Extract<Clip, { trimStart: number }> => clip.type === "video" || clip.type === "audio";

const sourceFrames = (draft: Project, clip: Clip): number | undefined => {
  if (!("assetId" in clip)) return undefined;
  const asset = draft.assets[clip.assetId];
  if (!asset?.durationSec || asset.type === "image") return undefined;
  return Math.floor(asset.durationSec * draft.settings.fps);
};

/** Moves a clip's start and/or end edge. Media clips keep their content in place. */
export const trimClip = (draft: Project, clipId: string, edges: { start?: number; end?: number }, opts: EditOptions = {}) => {
  const clip = getClipOrThrow(draft, clipId);
  assertClipEditable(draft, clip, opts);
  const oldStart = clip.start;
  const oldEnd = getClipEnd(clip);
  let newStart = edges.start !== undefined ? Math.round(edges.start) : oldStart;
  let newEnd = edges.end !== undefined ? Math.round(edges.end) : oldEnd;

  if (hasSourceMedia(clip)) {
    const total = sourceFrames(draft, clip);
    // Can't reveal frames before the source starts.
    const minStart = oldStart - clip.trimStart / clip.speed;
    newStart = Math.max(Math.ceil(minStart), newStart);
    if (total !== undefined) {
      const maxEnd = newStart + (total - (clip.trimStart + (newStart - oldStart) * clip.speed)) / clip.speed;
      newEnd = Math.min(Math.floor(maxEnd), newEnd);
    }
  }
  newStart = Math.max(0, newStart);
  if (newEnd - newStart < 1) throw new EditError("INVALID", "A clip must be at least one frame long.");

  const delta = newStart - oldStart;
  if (delta !== 0) {
    if (hasSourceMedia(clip)) {
      clip.trimStart = Math.max(0, Math.round(clip.trimStart + delta * clip.speed));
    }
    if (clip.keyframes) {
      for (const [prop, track] of Object.entries(clip.keyframes)) {
        clip.keyframes[prop] = shiftKeyframes(track, -delta);
      }
    }
  }
  clip.start = newStart;
  clip.duration = newEnd - newStart;
  if (clip.transitionIn && clip.transitionIn.duration > clip.duration) {
    clip.transitionIn.duration = clip.duration;
  }
  stamp(clip, opts.actor);
  syncLinkedCaptions(draft, clip);
  touch(draft);
};

/** Splits at an absolute timeline frame. Returns [leftId, rightId]. */
export const splitClip = (draft: Project, clipId: string, frame: number, opts: EditOptions = {}): [string, string] => {
  const clip = getClipOrThrow(draft, clipId);
  assertClipEditable(draft, clip, opts);
  const at = Math.round(frame);
  if (at <= clip.start || at >= getClipEnd(clip)) {
    throw new EditError("INVALID", "Split point must be inside the clip.");
  }
  const right = cloneValue(clip);
  right.id = newId("clip");
  const leftDuration = at - clip.start;
  right.start = at;
  right.duration = clip.duration - leftDuration;
  delete right.transitionIn;
  if (hasSourceMedia(right) && hasSourceMedia(clip)) {
    right.trimStart = Math.round(clip.trimStart + leftDuration * clip.speed);
    right.fadeIn = undefined;
    clip.fadeOut = undefined;
  }
  if (right.keyframes) {
    for (const [prop, track] of Object.entries(right.keyframes)) {
      right.keyframes[prop] = shiftKeyframes(track, -leftDuration).filter(
        (k, i, arr) => k.frame > 0 || i === arr.length - 1 || arr[i + 1].frame > 0,
      );
    }
  }
  // The left half keeps the entrance, the right half keeps the exit.
  if (clip.animations) {
    right.animations = { ...clip.animations, in: undefined };
    clip.animations = { ...clip.animations, out: undefined };
  }
  if (right.type === "captions" && right.timeBase === "clip" && clip.type === "captions") {
    const offsetMs = (leftDuration / draft.settings.fps) * 1000;
    right.words = clip.words
      .filter((w) => w.endMs > offsetMs)
      .map((w) => ({
        ...w,
        startMs: w.startMs - offsetMs,
        endMs: w.endMs - offsetMs,
        timestampMs: w.timestampMs === null ? null : w.timestampMs - offsetMs,
      }));
    clip.words = clip.words.filter((w) => w.startMs < offsetMs);
  }
  clip.duration = leftDuration;
  stamp(clip, opts.actor);
  stamp(right, opts.actor);
  draft.clips[right.id] = right;
  touch(draft);
  return [clip.id, right.id];
};

export const removeClips = (draft: Project, clipIds: readonly string[], opts: EditOptions & { ripple?: boolean } = {}) => {
  const clips = clipIds.map((id) => getClipOrThrow(draft, id));
  for (const clip of clips) assertClipEditable(draft, clip, opts);
  // Delete right-to-left so ripple shifts stay correct.
  const sorted = [...clips].sort((a, b) => b.start - a.start);
  for (const clip of sorted) {
    delete draft.clips[clip.id];
    const track = getTrack(draft, clip.trackId);
    if (opts.ripple || track?.magnetic) {
      shiftTrackClips(draft, clip.trackId, getClipEnd(clip), -clip.duration, new Set());
    }
    // Captions linked to a removed clip go with it.
    for (const other of Object.values(draft.clips)) {
      if (other.type === "captions" && other.sourceClipId === clip.id) delete draft.clips[other.id];
    }
  }
  touch(draft);
};

export const duplicateClips = (draft: Project, clipIds: readonly string[], offsetFrames?: number, opts: EditOptions = {}): string[] => {
  const ids: string[] = [];
  for (const id of clipIds) {
    const clip = getClipOrThrow(draft, id);
    const copy = cloneValue(clip);
    copy.id = newId("clip");
    copy.start = clip.start + (offsetFrames ?? clip.duration);
    if (copy.meta) copy.meta = { ...copy.meta, humanEdited: undefined };
    ids.push(insertClip(draft, copy, "auto-track", opts));
  }
  return ids;
};

/**
 * Removes [start, end) from the given tracks (all unlocked tracks by default)
 * and closes the gap — the primitive behind silence/filler removal.
 */
export const rippleDeleteRange = (draft: Project, range: { start: number; end: number; trackIds?: string[] }, opts: EditOptions = {}) => {
  const start = Math.round(range.start);
  const end = Math.round(range.end);
  if (end <= start) return;
  const trackIds = range.trackIds ?? draft.tracks.filter((t) => !t.locked).map((t) => t.id);
  for (const trackId of trackIds) {
    carveRange(draft, trackId, start, end, new Set(), opts);
    shiftTrackClips(draft, trackId, end, -(end - start), new Set());
  }
  for (const marker of draft.markers) {
    if (marker.frame >= end) marker.frame -= end - start;
  }
  touch(draft);
};

/** Removes gaps on a track by sliding clips left. */
export const closeGaps = (draft: Project, trackId: string, opts: EditOptions = {}) => {
  assertTrackEditable(draft, trackId);
  let cursor = 0;
  for (const clip of getTrackClips(draft, trackId)) {
    assertClipEditable(draft, clip, opts);
    if (clip.start > cursor) clip.start = cursor;
    cursor = getClipEnd(clip);
  }
  touch(draft);
};

// ---------------------------------------------------------------------------
// Keyframes, transitions, effects
// ---------------------------------------------------------------------------

export const setKeyframes = (draft: Project, clipId: string, property: string, keyframes: Keyframe[] | null, opts: EditOptions = {}) => {
  const clip = getClipOrThrow(draft, clipId);
  assertClipEditable(draft, clip, opts);
  clip.keyframes ??= {};
  if (keyframes === null || keyframes.length === 0) delete clip.keyframes[property];
  else clip.keyframes[property] = sortKeyframes(keyframes.map((k) => ({ ...k, frame: Math.max(0, Math.round(k.frame)) })));
  stamp(clip, opts.actor);
  touch(draft);
};

export const addKeyframe = (draft: Project, clipId: string, property: string, keyframe: Keyframe, opts: EditOptions = {}) => {
  const clip = getClipOrThrow(draft, clipId);
  assertClipEditable(draft, clip, opts);
  clip.keyframes ??= {};
  clip.keyframes[property] = upsertKeyframe(clip.keyframes[property] ?? [], {
    ...keyframe,
    frame: Math.max(0, Math.round(keyframe.frame)),
  });
  stamp(clip, opts.actor);
  touch(draft);
};

export const removeKeyframe = (draft: Project, clipId: string, property: string, frame: number, opts: EditOptions = {}) => {
  const clip = getClipOrThrow(draft, clipId);
  assertClipEditable(draft, clip, opts);
  const track = clip.keyframes?.[property];
  if (!track) return;
  const next = track.filter((k) => k.frame !== frame);
  if (next.length === 0) delete clip.keyframes?.[property];
  else if (clip.keyframes) clip.keyframes[property] = next;
  stamp(clip, opts.actor);
  touch(draft);
};

export const setTransition = (draft: Project, clipId: string, transition: Transition | null, opts: EditOptions = {}) => {
  const clip = getClipOrThrow(draft, clipId);
  assertClipEditable(draft, clip, opts);
  if (transition === null) delete clip.transitionIn;
  else clip.transitionIn = { ...transition, duration: Math.min(Math.max(1, Math.round(transition.duration)), clip.duration) };
  stamp(clip, opts.actor);
  touch(draft);
};

type EffectInput = Effect extends infer E ? (E extends Effect ? Omit<E, "id"> & { id?: string } : never) : never;

export const addEffect = (draft: Project, clipId: string, effect: EffectInput, opts: EditOptions = {}): string => {
  const clip = getClipOrThrow(draft, clipId);
  assertClipEditable(draft, clip, opts);
  const id = effect.id ?? newId("fx");
  clip.effects ??= [];
  // One grade per clip: replace instead of stacking.
  if (effect.type === "grade") clip.effects = clip.effects.filter((e) => e.type !== "grade");
  clip.effects.push({ ...effect, id } as Effect);
  stamp(clip, opts.actor);
  touch(draft);
  return id;
};

export const updateEffect = (draft: Project, clipId: string, effectId: string, patch: Record<string, unknown>, opts: EditOptions = {}) => {
  const clip = getClipOrThrow(draft, clipId);
  assertClipEditable(draft, clip, opts);
  const effect = clip.effects?.find((e) => e.id === effectId);
  if (!effect) throw new EditError("NOT_FOUND", `Effect "${effectId}" not found on clip.`);
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id" || k === "type") continue;
    if (v === null) delete (effect as Record<string, unknown>)[k];
    else (effect as Record<string, unknown>)[k] = v;
  }
  stamp(clip, opts.actor);
  touch(draft);
};

export const removeEffect = (draft: Project, clipId: string, effectId: string, opts: EditOptions = {}) => {
  const clip = getClipOrThrow(draft, clipId);
  assertClipEditable(draft, clip, opts);
  clip.effects = clip.effects?.filter((e) => e.id !== effectId);
  stamp(clip, opts.actor);
  touch(draft);
};

// ---------------------------------------------------------------------------
// Assets, markers, components, settings
// ---------------------------------------------------------------------------

export const addAsset = (draft: Project, asset: Asset) => {
  draft.assets[asset.id] = asset;
  touch(draft);
};

export const updateAsset = (draft: Project, assetId: string, patch: Partial<Asset>) => {
  const asset = draft.assets[assetId];
  if (!asset) throw new EditError("NOT_FOUND", `Asset "${assetId}" does not exist.`);
  Object.assign(asset, patch);
  touch(draft);
};

export const removeAsset = (draft: Project, assetId: string, opts: EditOptions = {}) => {
  const using = Object.values(draft.clips).filter((c) => "assetId" in c && c.assetId === assetId);
  removeClips(
    draft,
    using.map((c) => c.id),
    opts,
  );
  delete draft.assets[assetId];
  touch(draft);
};

export const addMarker = (draft: Project, marker: Omit<Marker, "id"> & { id?: string }): string => {
  const id = marker.id ?? newId("marker");
  draft.markers.push({ ...marker, id, frame: Math.max(0, Math.round(marker.frame)) });
  draft.markers.sort((a, b) => a.frame - b.frame);
  touch(draft);
  return id;
};

export const updateMarker = (draft: Project, markerId: string, patch: Partial<Omit<Marker, "id">>) => {
  const marker = draft.markers.find((m) => m.id === markerId);
  if (!marker) throw new EditError("NOT_FOUND", `Marker "${markerId}" does not exist.`);
  Object.assign(marker, patch);
  draft.markers.sort((a, b) => a.frame - b.frame);
  touch(draft);
};

export const removeMarkers = (draft: Project, ids: readonly string[]) => {
  const set = new Set(ids);
  draft.markers = draft.markers.filter((m) => !set.has(m.id));
  touch(draft);
};

export const upsertComponent = (draft: Project, component: CodeComponent) => {
  draft.components[component.id] = component;
  touch(draft);
};

export const removeComponent = (draft: Project, componentId: string, opts: EditOptions = {}) => {
  const using = Object.values(draft.clips).filter((c) => c.type === "component" && c.component === `code:${componentId}`);
  removeClips(
    draft,
    using.map((c) => c.id),
    opts,
  );
  delete draft.components[componentId];
  touch(draft);
};

/** Changes canvas settings; re-lays out clips when the size changes. */
export const updateSettings = (draft: Project, patch: Partial<ProjectSettings>, opts: { reflow?: boolean } = {}) => {
  const old = { ...draft.settings };
  const oldFps = old.fps;
  Object.assign(draft.settings, patch);
  if (patch.fps && patch.fps !== oldFps) retimeProject(draft, oldFps, patch.fps);
  if ((opts.reflow ?? true) && (old.width !== draft.settings.width || old.height !== draft.settings.height)) {
    reflowForCanvas(draft, old.width, old.height);
  }
  touch(draft);
};

/** Converts every frame value when the frame rate changes. */
const retimeProject = (draft: Project, fromFps: number, toFps: number) => {
  const r = toFps / fromFps;
  const conv = (f: number) => Math.round(f * r);
  for (const clip of Object.values(draft.clips)) {
    clip.start = conv(clip.start);
    clip.duration = Math.max(1, conv(clip.duration));
    if (hasSourceMedia(clip)) clip.trimStart = conv(clip.trimStart);
    if (clip.transitionIn) clip.transitionIn.duration = Math.max(1, conv(clip.transitionIn.duration));
    if (clip.animations?.in) clip.animations.in.duration = Math.max(1, conv(clip.animations.in.duration));
    if (clip.animations?.out) clip.animations.out.duration = Math.max(1, conv(clip.animations.out.duration));
    if (clip.keyframes) {
      for (const track of Object.values(clip.keyframes)) for (const k of track) k.frame = conv(k.frame);
    }
  }
  for (const m of draft.markers) m.frame = conv(m.frame);
  if (draft.settings.durationInFrames) draft.settings.durationInFrames = conv(draft.settings.durationInFrames);
};

/**
 * Re-lays out clips for a new canvas size ("one timeline, many formats").
 * Full-frame layers stay full-frame, positions scale per axis, and type
 * scales with the shorter edge so text stays readable in vertical formats.
 */
export const reflowForCanvas = (draft: Project, oldW: number, oldH: number) => {
  const { width: W, height: H } = draft.settings;
  const sx = W / oldW;
  const sy = H / oldH;
  const su = Math.min(W, H) / Math.min(oldW, oldH);
  for (const clip of Object.values(draft.clips)) {
    const t = clip.transform;
    const fullFrame =
      Math.abs(t.width - oldW) < 2 && Math.abs(t.height - oldH) < 2 && Math.abs(t.x - oldW / 2) < 2 && Math.abs(t.y - oldH / 2) < 2;
    if (fullFrame) {
      clip.transform = {
        ...fullFrameTransform({ width: W, height: H }),
        scale: t.scale,
        rotation: t.rotation,
        opacity: t.opacity,
        crop: t.crop,
        radius: t.radius,
        flipX: t.flipX,
        flipY: t.flipY,
      };
      continue;
    }
    t.x = t.x * sx;
    t.y = t.y * sy;
    if (clip.type === "text") {
      t.width = Math.min(W * 0.92, t.width * sx);
      t.height = t.height * su;
      clip.style.fontSize = Math.max(8, Math.round(clip.style.fontSize * su));
    } else if (clip.type === "captions") {
      t.width = Math.min(W * 0.9, t.width * sx);
      clip.style.fontSize = Math.max(8, Math.round(clip.style.fontSize * su));
      if (H > W && oldW > oldH) t.y = H * 0.64;
      if (W > H && oldH > oldW) t.y = H * 0.8;
    } else {
      t.width = t.width * su;
      t.height = t.height * su;
    }
    if (clip.keyframes) {
      for (const [prop, track] of Object.entries(clip.keyframes)) {
        const factor = prop === "x" ? sx : prop === "y" ? sy : prop === "width" || prop === "height" ? su : 1;
        if (factor !== 1) for (const k of track) if (typeof k.value === "number") k.value *= factor;
      }
    }
  }
};

/** Keeps caption clips aligned with the media clip they were transcribed from. */
const syncLinkedCaptions = (draft: Project, clip: Clip) => {
  if (clip.type !== "video" && clip.type !== "audio") return;
  for (const other of Object.values(draft.clips)) {
    if (other.type === "captions" && other.sourceClipId === clip.id && other.timeBase === "source") {
      other.start = clip.start;
      other.duration = clip.duration;
    }
  }
};
