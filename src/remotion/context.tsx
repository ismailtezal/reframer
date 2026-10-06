import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { useDelayRender } from "remotion";
import { blendCube } from "../core/luts";
import { getClipEnd } from "../core/project-utils";
import type { Project } from "../core/schema";

export type RenderContextValue = {
  project: Project;
  /** Turns asset `src` paths into URLs the current environment can fetch. */
  resolveSrc: (src: string) => string;
  /** Music ducking multiplier for an absolute timeline frame (1 = no ducking). */
  duckAt: (frame: number) => number;
  /** `.cube` text of an uploaded LUT asset (null until loaded). */
  resolveLut: (assetId: string) => string | null;
  /** True inside the editor (shows error placeholders instead of throwing). */
  editor: boolean;
};

// Uploaded LUT files, fetched once per session.
const lutCache = new Map<string, string>();
const lutPending = new Map<string, Promise<void>>();

/** Fetches every uploaded LUT the project references, holding the render until ready. */
const useUploadedLuts = (project: Project, resolveSrc: (src: string) => string) => {
  const { delayRender, continueRender } = useDelayRender();
  const [handles] = useState(() => new Set<string>());
  for (const clip of Object.values(project.clips)) {
    for (const effect of clip.effects ?? []) {
      if (effect.type !== "grade" || !effect.lut?.startsWith("asset:")) continue;
      const assetId = effect.lut.slice(6);
      const asset = project.assets[assetId];
      if (!asset || lutCache.has(assetId) || handles.has(assetId)) continue;
      handles.add(assetId);
      const handle = delayRender(`Loading LUT ${asset.name}`);
      const promise =
        lutPending.get(assetId) ??
        fetch(resolveSrc(asset.src))
          .then((r) => r.text())
          .then((text) => {
            lutCache.set(assetId, text);
          })
          .catch((err) => console.warn("[reframer] LUT load failed", err));
      lutPending.set(assetId, promise);
      promise.finally(() => continueRender(handle));
    }
  }
};

const RenderContext = createContext<RenderContextValue | null>(null);

export const useRenderContext = (): RenderContextValue => {
  const ctx = useContext(RenderContext);
  if (!ctx) throw new Error("Reframer render context missing");
  return ctx;
};

const DUCK_LEVEL = 0.28; // ≈ -11 dB
const RAMP_FRAMES = 8;

/** Speech ranges: voice audio clips and video clips with transcribed dialogue. */
const buildDucking = (project: Project) => {
  const ranges: [number, number][] = [];
  for (const clip of Object.values(project.clips)) {
    if (clip.type === "audio" && clip.role === "voice" && !clip.muted) {
      ranges.push([clip.start, getClipEnd(clip)]);
    }
    if (clip.type === "video" && !clip.muted && clip.volume > 0) {
      const asset = project.assets[clip.assetId];
      if (asset?.transcript && asset.transcript.words.length > 0) ranges.push([clip.start, getClipEnd(clip)]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  // Merge overlapping ranges.
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + RAMP_FRAMES) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return (frame: number) => {
    let best = 1;
    for (const [s, e] of merged) {
      if (frame < s - RAMP_FRAMES) break;
      if (frame > e + RAMP_FRAMES) continue;
      let m: number;
      if (frame < s) m = 1 - ((frame - (s - RAMP_FRAMES)) / RAMP_FRAMES) * (1 - DUCK_LEVEL);
      else if (frame > e) m = DUCK_LEVEL + ((frame - e) / RAMP_FRAMES) * (1 - DUCK_LEVEL);
      else m = DUCK_LEVEL;
      best = Math.min(best, m);
    }
    return best;
  };
};

export const RenderProvider = ({
  project,
  mediaBaseUrl,
  editor,
  children,
}: {
  project: Project;
  mediaBaseUrl?: string;
  editor: boolean;
  children: ReactNode;
}) => {
  const value = useMemo<RenderContextValue>(() => {
    const base = (mediaBaseUrl ?? "").replace(/\/$/, "");
    const lutIntensity = new Map<string, number>();
    for (const clip of Object.values(project.clips)) {
      for (const e of clip.effects ?? []) {
        if (e.type === "grade" && e.lut?.startsWith("asset:")) lutIntensity.set(e.lut.slice(6), e.lutIntensity ?? 1);
      }
    }
    return {
      project,
      editor,
      duckAt: buildDucking(project),
      resolveSrc: (src: string) => (src.startsWith("/") && base ? `${base}${src}` : src),
      resolveLut: (assetId: string) => {
        const cube = lutCache.get(assetId);
        if (!cube) return null;
        return blendCube(cube, lutIntensity.get(assetId) ?? 1);
      },
    };
  }, [project, mediaBaseUrl, editor]);
  useUploadedLuts(project, value.resolveSrc);
  return <RenderContext.Provider value={value}>{children}</RenderContext.Provider>;
};

/** Size of the clip's box, available to motion components. */
export type ClipBox = { width: number; height: number };
const ClipBoxContext = createContext<ClipBox>({ width: 1920, height: 1080 });
export const ClipBoxProvider = ClipBoxContext.Provider;
export const useClipBox = () => useContext(ClipBoxContext);
