import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { useDelayRender } from "remotion";
import { blendCube } from "../core/luts";
import { getClipEnd } from "../core/project-utils";
import type { Clip, Project } from "../core/schema";

export type RenderContextValue = {
  project: Project;
  /** Turns asset `src` paths into URLs the current environment can fetch. */
  resolveSrc: (src: string) => string;
  /** Music ducking multiplier for an absolute timeline frame (1 = no ducking). */
  /** Gain for ducked music at a timeline frame (depthDb defaults to 15). */
  duckAt: (frame: number, depthDb?: number) => number;
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

/** Default depth music ducks under speech (research: keep the bed 18–25 dB under the voice). */
const DEFAULT_DUCK_DB = 15;
/** Duck starts a little before the first word, releases slowly, and bridges short pauses so it doesn't pump. */
const ATTACK_SEC = 0.25;
const RELEASE_SEC = 0.6;
const BRIDGE_SEC = 1.2;

/** Speech ranges from transcript word timings (whole clip when there is no transcript). */
const buildDucking = (project: Project) => {
  const fps = project.settings.fps;
  const ranges: [number, number][] = [];
  const addSpeech = (clip: Extract<Clip, { type: "audio" | "video" }>, wholeClipFallback: boolean) => {
    const end = getClipEnd(clip);
    const words = project.assets[clip.assetId]?.transcript?.words ?? [];
    if (!words.length) {
      if (wholeClipFallback) ranges.push([clip.start, end]);
      return;
    }
    for (const w of words) {
      const s0 = clip.start + ((w.startMs / 1000) * fps - clip.trimStart) / clip.speed;
      const s1 = clip.start + ((w.endMs / 1000) * fps - clip.trimStart) / clip.speed;
      if (s1 <= clip.start || s0 >= end) continue;
      ranges.push([Math.max(clip.start, s0), Math.min(end, s1)]);
    }
  };
  for (const clip of Object.values(project.clips)) {
    if (clip.type === "audio" && clip.role === "voice" && !clip.muted) addSpeech(clip, true);
    if (clip.type === "video" && !clip.muted && clip.volume > 0) addSpeech(clip, false);
  }
  ranges.sort((x, y) => x[0] - y[0]);
  const bridge = BRIDGE_SEC * fps;
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + bridge) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const attack = ATTACK_SEC * fps;
  const release = RELEASE_SEC * fps;
  const smooth = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
  return (frame: number, depthDb = DEFAULT_DUCK_DB) => {
    let amount = 0;
    for (const [start, end] of merged) {
      if (frame < start - attack) break;
      if (frame > end + release) continue;
      const a2 = frame < start ? smooth((frame - (start - attack)) / attack) : frame > end ? 1 - smooth((frame - end) / release) : 1;
      amount = Math.max(amount, a2);
    }
    return 1 - amount * (1 - 10 ** (-depthDb / 20));
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
