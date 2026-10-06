"use client";

import { toast } from "sonner";
import {
  createAudioClip,
  createBackgroundClip,
  createComponentClip,
  createImageClip,
  createShapeClip,
  createTextClip,
  createVideoClip,
} from "@/core/defaults";
import {
  addTrack,
  closeGaps,
  duplicateClips,
  EditError,
  insertClip,
  moveClip,
  removeClips,
  splitClip,
  trimClip,
  USER,
  updateClip,
} from "@/core/ops";
import { getClipEnd, getProjectDuration } from "@/core/project-utils";
import type { Asset, Clip, Fill, Project, ShapeClip, TextStyle, Track } from "@/core/schema";
import { secondsToFrames } from "@/core/time";
import { getMotionComponent } from "@/remotion/components/registry";
import { usePlaybackStore } from "./store/playback-store";
import { getProject, transact, useProjectStore } from "./store/project-store";
import { useUIStore } from "./store/ui-store";

/** Runs an edit and reports EditErrors as toasts instead of throwing. */
export const run = <T>(label: string, fn: (d: Project) => T, mergeKey?: string): T | undefined => {
  try {
    return transact(label, fn, { actor: USER, mergeKey });
  } catch (err) {
    if (err instanceof EditError) toast.error(err.message);
    else {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
    return undefined;
  }
};

const frameNow = () => usePlaybackStore.getState().frame;
const selection = () => useUIStore.getState().selectedClipIds;

const firstTrack = (project: Project, kind: Track["kind"]) => project.tracks.find((t) => t.kind === kind && !t.locked);

/** Track where new overlays go: the selected track if compatible, else the top visual track. */
const targetTrack = (project: Project, kind: Track["kind"]): string => {
  const selectedTrackId = useUIStore.getState().selectedTrackId;
  const sel = selectedTrackId ? project.tracks.find((t) => t.id === selectedTrackId) : undefined;
  if (sel && sel.kind === kind && !sel.locked) return sel.id;
  const t = firstTrack(project, kind);
  if (t) return t.id;
  return "";
};

const ensureTrack = (d: Project, kind: Track["kind"]) => {
  const id = targetTrack(d, kind);
  return id || addTrack(d, { kind });
};

// ---------------------------------------------------------------------------
// Timeline editing
// ---------------------------------------------------------------------------

export const splitAtPlayhead = (allTracks = false) => {
  const project = getProject();
  const frame = frameNow();
  const ids =
    allTracks || selection().length === 0
      ? Object.values(project.clips)
          .filter((c) => frame > c.start && frame < getClipEnd(c))
          .filter((c) => allTracks || selection().length === 0 || selection().includes(c.id))
          .map((c) => c.id)
      : selection().filter((id) => {
          const c = project.clips[id];
          return c && frame > c.start && frame < getClipEnd(c);
        });
  if (ids.length === 0) {
    toast("Move the playhead over a clip to split it");
    return;
  }
  const rights = run(`Split ${ids.length > 1 ? `${ids.length} clips` : "clip"}`, (d) =>
    ids.map((id) => splitClip(d, id, frame, { actor: USER })[1]),
  );
  if (rights) useUIStore.getState().select(rights);
};

export const deleteSelection = (ripple?: boolean) => {
  const ids = selection();
  if (ids.length === 0) return;
  const doRipple = ripple ?? useUIStore.getState().rippleDelete;
  run(`Delete ${ids.length > 1 ? `${ids.length} clips` : "clip"}`, (d) => removeClips(d, ids, { actor: USER, ripple: doRipple }));
  useUIStore.getState().clearSelection();
};

export const duplicateSelection = () => {
  const ids = selection();
  if (ids.length === 0) return;
  const created = run("Duplicate", (d) => duplicateClips(d, ids, undefined, { actor: USER }));
  if (created) useUIStore.getState().select(created);
};

/** Delete everything left/right of the playhead within selected (or all) clips under it. */
export const trimToPlayhead = (side: "left" | "right", rippleGap: boolean) => {
  const project = getProject();
  const frame = frameNow();
  const targets = Object.values(project.clips).filter(
    (c) => frame > c.start && frame < getClipEnd(c) && (selection().length === 0 || selection().includes(c.id)),
  );
  if (targets.length === 0) return;
  run(side === "left" ? "Trim start to playhead" : "Trim end to playhead", (d) => {
    for (const c of targets) {
      if (side === "left") {
        const removed = frame - c.start;
        trimClip(d, c.id, { start: frame }, { actor: USER });
        if (rippleGap) moveClip(d, c.id, { start: frame - removed }, "exact", { actor: USER });
      } else {
        trimClip(d, c.id, { end: frame }, { actor: USER });
      }
    }
  });
};

export const nudgeSelection = (frames: number) => {
  const ids = selection();
  if (ids.length === 0) return;
  run(
    "Nudge",
    (d) => {
      for (const id of ids) {
        const c = d.clips[id];
        if (c) moveClip(d, id, { start: Math.max(0, c.start + frames) }, "exact", { actor: USER });
      }
    },
    "nudge",
  );
};

export const closeTrackGaps = (trackId: string) => run("Close gaps", (d) => closeGaps(d, trackId, { actor: USER }));

export const updateClipProps = (clipId: string, patch: Record<string, unknown>, label = "Edit clip", mergeKey?: string) =>
  run(label, (d) => updateClip(d, clipId, patch, { actor: USER }), mergeKey ?? `edit:${clipId}:${Object.keys(patch).join(",")}`);

// ---------------------------------------------------------------------------
// Adding content
// ---------------------------------------------------------------------------

const placeAndSelect = (label: string, make: (d: Project) => Clip) => {
  const id = run(label, (d) => insertClip(d, make(d), "auto-track", { actor: USER }));
  if (id) useUIStore.getState().select([id]);
  return id;
};

export const addText = (opts: { text?: string; style?: Partial<TextStyle>; durationSec?: number; preset?: Partial<Clip> } = {}) =>
  placeAndSelect("Add text", (d) => {
    const clip = createTextClip(d.settings, {
      trackId: ensureTrack(d, "visual"),
      start: frameNow(),
      duration: secondsToFrames(opts.durationSec ?? 3, d.settings.fps),
      text: opts.text ?? "Your title",
      style: opts.style,
    });
    return { ...clip, ...(opts.preset as object) } as Clip;
  });

export const addShape = (shape: ShapeClip["shape"], fill?: Fill) =>
  placeAndSelect("Add shape", (d) => createShapeClip(d.settings, { trackId: ensureTrack(d, "visual"), start: frameNow(), shape, fill }));

export const addBackground = (fill: Fill) =>
  placeAndSelect("Add background", (d) => {
    // Backgrounds go on the bottom-most visual track.
    const visual = d.tracks.filter((t) => t.kind === "visual" && !t.locked);
    const trackId = visual[visual.length - 1]?.id ?? addTrack(d, { kind: "visual" });
    return createBackgroundClip(d.settings, {
      trackId,
      start: frameNow(),
      duration: Math.max(secondsToFrames(5, d.settings.fps), getProjectDuration(d) - frameNow()),
      fill,
    });
  });

export const addComponent = (componentId: string, props: Record<string, unknown> = {}) => {
  const def = getMotionComponent(componentId);
  return placeAndSelect(`Add ${def?.name ?? "element"}`, (d) => {
    const { width, height } = d.settings;
    const box = def?.defaultBox;
    return createComponentClip(d.settings, {
      trackId: ensureTrack(d, "visual"),
      start: frameNow(),
      duration: secondsToFrames(def?.defaultDuration ?? 4, d.settings.fps),
      component: componentId,
      name: def?.name,
      props,
      transform: box ? { x: box.x * width, y: box.y * height, width: box.width * width, height: box.height * height } : undefined,
    });
  });
};

export const addCodeComponentClip = (componentId: string, name: string, durationSec = 4) =>
  placeAndSelect(`Add ${name}`, (d) =>
    createComponentClip(d.settings, {
      trackId: ensureTrack(d, "visual"),
      start: frameNow(),
      duration: secondsToFrames(durationSec, d.settings.fps),
      component: `code:${componentId}`,
      name,
    }),
  );

/** Adds an asset to the timeline at the playhead (or `at`), choosing a sensible track. */
export const addAssetToTimeline = (asset: Asset, at?: { frame?: number; trackId?: string }) =>
  placeAndSelect(`Add ${asset.name}`, (d) => {
    const start = at?.frame ?? frameNow();
    if (asset.type === "audio") {
      const trackId = at?.trackId && d.tracks.find((t) => t.id === at.trackId)?.kind === "audio" ? at.trackId : ensureTrack(d, "audio");
      return createAudioClip(d.settings, asset, { trackId, start, role: "music" });
    }
    const trackId = at?.trackId && d.tracks.find((t) => t.id === at.trackId)?.kind === "visual" ? at.trackId : ensureTrack(d, "visual");
    if (asset.type === "video") return createVideoClip(d.settings, asset, { trackId, start });
    // Logos / PNGs with alpha look better contained; photos fill the frame.
    const isLogoLike = /\.(png|svg|webp)$/i.test(asset.name) && (asset.width ?? 0) < d.settings.width * 0.8;
    return createImageClip(d.settings, asset, {
      trackId,
      start,
      fit: isLogoLike ? "contain" : "cover",
      transform: isLogoLike
        ? {
            x: d.settings.width / 2,
            y: d.settings.height / 2,
            width: Math.min(d.settings.width * 0.4, asset.width ?? 600),
            height: Math.min(d.settings.height * 0.4, asset.height ?? 600),
          }
        : undefined,
    });
  });

export const undo = () => useProjectStore.getState().undo();
export const redo = () => useProjectStore.getState().redo();
