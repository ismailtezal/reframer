import { newId } from "./ids";
import {
  type Asset,
  type AudioClip,
  type BackgroundClip,
  type CaptionStyle,
  type CaptionsClip,
  type CaptionWord,
  type ClipMeta,
  type ComponentClip,
  type Fill,
  type ImageClip,
  PROJECT_FORMAT_VERSION,
  type Project,
  type ProjectSettings,
  type ShapeClip,
  type TextClip,
  type TextStyle,
  type Track,
  type Transform,
  type VideoClip,
} from "./schema";
import { secondsToFrames } from "./time";

export const ASPECT_PRESETS = {
  "16:9": { width: 1920, height: 1080, label: "Landscape", hint: "YouTube, web" },
  "9:16": { width: 1080, height: 1920, label: "Vertical", hint: "Shorts, Reels, TikTok" },
  "1:1": { width: 1080, height: 1080, label: "Square", hint: "Feed posts" },
  "4:5": { width: 1080, height: 1350, label: "Portrait", hint: "Instagram feed" },
} as const;
export type AspectPresetId = keyof typeof ASPECT_PRESETS;

type Size = Pick<ProjectSettings, "width" | "height">;

const unit = (s: Size) => Math.min(s.width, s.height) / 1080;

export const fullFrameTransform = (s: Size, overrides: Partial<Transform> = {}): Transform => ({
  x: s.width / 2,
  y: s.height / 2,
  width: s.width,
  height: s.height,
  scale: 1,
  rotation: 0,
  opacity: 1,
  ...overrides,
});

export const createTrack = (kind: Track["kind"], name?: string, extra: Partial<Track> = {}): Track => ({
  id: newId("track"),
  name: name ?? (kind === "audio" ? "Audio" : "Track"),
  kind,
  muted: false,
  hidden: false,
  locked: false,
  ...extra,
});

export const createProject = (opts: {
  name?: string;
  width?: number;
  height?: number;
  fps?: number;
  backgroundColor?: string;
}): Project => {
  const now = Date.now();
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    id: newId("proj"),
    name: opts.name ?? "Untitled video",
    createdAt: now,
    updatedAt: now,
    settings: {
      width: opts.width ?? 1920,
      height: opts.height ?? 1080,
      fps: opts.fps ?? 30,
      backgroundColor: opts.backgroundColor ?? "#000000",
    },
    tracks: [createTrack("visual", "Overlay"), createTrack("visual", "Main", { magnetic: false }), createTrack("audio", "Audio")],
    clips: {},
    assets: {},
    markers: [],
    components: {},
  };
};

export const defaultTextStyle = (s: Size, overrides: Partial<TextStyle> = {}): TextStyle => ({
  fontFamily: "Inter",
  fontWeight: 700,
  fontSize: Math.round(80 * unit(s)),
  color: "#ffffff",
  align: "center",
  lineHeight: 1.1,
  letterSpacing: -0.02,
  textTransform: "none",
  ...overrides,
});

export const defaultCaptionStyle = (s: Size, overrides: Partial<CaptionStyle> = {}): CaptionStyle => ({
  preset: "bold-pop",
  fontFamily: "Montserrat",
  fontWeight: 800,
  fontSize: Math.round(72 * unit(s)),
  color: "#ffffff",
  activeColor: "#FFE14D",
  textTransform: "uppercase",
  stroke: { color: "#000000", width: Math.max(2, Math.round(6 * unit(s))) },
  shadow: { color: "rgba(0,0,0,0.6)", blur: 12, x: 0, y: 4 },
  animation: "pop",
  combineMs: 600,
  maxWordsPerPage: 3,
  lineHeight: 1.05,
  ...overrides,
});

type ClipBaseInput = {
  trackId: string;
  start?: number;
  duration?: number;
  name?: string;
  meta?: ClipMeta;
};

export const createTextClip = (
  s: Size & { fps: number },
  input: ClipBaseInput & {
    text: string;
    style?: Partial<TextStyle>;
    transform?: Partial<Transform>;
  },
): TextClip => {
  const style = defaultTextStyle(s, input.style);
  return {
    id: newId("clip"),
    type: "text",
    trackId: input.trackId,
    name: input.name,
    start: input.start ?? 0,
    duration: input.duration ?? secondsToFrames(3, s.fps),
    text: input.text,
    style,
    transform: {
      x: s.width / 2,
      y: s.height / 2,
      width: Math.round(s.width * 0.8),
      height: Math.round(style.fontSize * style.lineHeight * 1.2),
      scale: 1,
      rotation: 0,
      opacity: 1,
      ...input.transform,
    },
    animations: {
      in: { type: "rise-blur", duration: Math.round(s.fps * 0.6) },
      out: { type: "fade", duration: Math.round(s.fps * 0.3) },
    },
    meta: input.meta,
  };
};

export const createVideoClip = (
  s: Size & { fps: number },
  asset: Asset,
  input: ClipBaseInput & { trimStart?: number; transform?: Partial<Transform> },
): VideoClip => {
  const assetFrames = asset.durationSec ? secondsToFrames(asset.durationSec, s.fps) : s.fps * 5;
  const trimStart = input.trimStart ?? 0;
  return {
    id: newId("clip"),
    type: "video",
    trackId: input.trackId,
    name: input.name ?? asset.name,
    start: input.start ?? 0,
    duration: Math.max(1, input.duration ?? assetFrames - trimStart),
    assetId: asset.id,
    trimStart,
    speed: 1,
    volume: 1,
    fit: "cover",
    transform: fullFrameTransform(s, input.transform),
    meta: input.meta,
  };
};

export const createAudioClip = (
  s: Size & { fps: number },
  asset: Asset,
  input: ClipBaseInput & { trimStart?: number; role?: AudioClip["role"]; volume?: number },
): AudioClip => {
  const assetFrames = asset.durationSec ? secondsToFrames(asset.durationSec, s.fps) : s.fps * 5;
  const trimStart = input.trimStart ?? 0;
  return {
    id: newId("clip"),
    type: "audio",
    trackId: input.trackId,
    name: input.name ?? asset.name,
    start: input.start ?? 0,
    duration: Math.max(1, input.duration ?? assetFrames - trimStart),
    assetId: asset.id,
    trimStart,
    speed: 1,
    volume: input.volume ?? (input.role === "music" ? 0.6 : 1),
    role: input.role,
    duck: input.role === "music" ? true : undefined,
    transform: fullFrameTransform(s),
    meta: input.meta,
  };
};

export const createImageClip = (
  s: Size & { fps: number },
  asset: Asset,
  input: ClipBaseInput & { transform?: Partial<Transform>; fit?: ImageClip["fit"] },
): ImageClip => ({
  id: newId("clip"),
  type: "image",
  trackId: input.trackId,
  name: input.name ?? asset.name,
  start: input.start ?? 0,
  duration: input.duration ?? secondsToFrames(4, s.fps),
  assetId: asset.id,
  fit: input.fit ?? "cover",
  transform: fullFrameTransform(s, input.transform),
  meta: input.meta,
});

export const createShapeClip = (
  s: Size & { fps: number },
  input: ClipBaseInput & {
    shape: ShapeClip["shape"];
    fill?: Fill;
    stroke?: string;
    strokeWidth?: number;
    transform?: Partial<Transform>;
  },
): ShapeClip => {
  const size = Math.round(320 * unit(s));
  return {
    id: newId("clip"),
    type: "shape",
    trackId: input.trackId,
    name: input.name,
    start: input.start ?? 0,
    duration: input.duration ?? secondsToFrames(3, s.fps),
    shape: input.shape,
    fill: input.fill ?? (input.shape === "line" || input.shape === "arrow" ? undefined : { type: "solid", color: "#ffffff" }),
    stroke: input.stroke ?? (input.shape === "line" || input.shape === "arrow" ? "#ffffff" : undefined),
    strokeWidth: input.strokeWidth ?? (input.shape === "line" || input.shape === "arrow" ? Math.round(10 * unit(s)) : 0),
    cornerRadius: input.shape === "rect" ? Math.round(24 * unit(s)) : undefined,
    transform: {
      x: s.width / 2,
      y: s.height / 2,
      width: size,
      height: input.shape === "line" || input.shape === "arrow" ? Math.round(40 * unit(s)) : size,
      scale: 1,
      rotation: 0,
      opacity: 1,
      ...input.transform,
    },
    animations: { in: { type: "pop", duration: Math.round(s.fps * 0.5) } },
    meta: input.meta,
  };
};

export const createBackgroundClip = (s: Size & { fps: number }, input: ClipBaseInput & { fill: Fill }): BackgroundClip => ({
  id: newId("clip"),
  type: "background",
  trackId: input.trackId,
  name: input.name ?? "Background",
  start: input.start ?? 0,
  duration: input.duration ?? secondsToFrames(5, s.fps),
  fill: input.fill,
  transform: fullFrameTransform(s),
  meta: input.meta,
});

export const createCaptionsClip = (
  s: Size & { fps: number },
  input: ClipBaseInput & {
    words: CaptionWord[];
    timeBase?: CaptionsClip["timeBase"];
    sourceClipId?: string;
    style?: Partial<CaptionStyle>;
    transform?: Partial<Transform>;
  },
): CaptionsClip => {
  const portrait = s.height > s.width;
  return {
    id: newId("clip"),
    type: "captions",
    trackId: input.trackId,
    name: input.name ?? "Captions",
    start: input.start ?? 0,
    duration: input.duration ?? secondsToFrames(5, s.fps),
    words: input.words,
    timeBase: input.timeBase ?? "clip",
    sourceClipId: input.sourceClipId,
    style: defaultCaptionStyle(s, input.style),
    transform: {
      x: s.width / 2,
      y: Math.round(s.height * (portrait ? 0.64 : 0.8)),
      width: Math.round(s.width * (portrait ? 0.86 : 0.7)),
      height: Math.round(220 * unit(s)),
      scale: 1,
      rotation: 0,
      opacity: 1,
      ...input.transform,
    },
    meta: input.meta,
  };
};

export const createComponentClip = (
  s: Size & { fps: number },
  input: ClipBaseInput & {
    component: string;
    props?: Record<string, unknown>;
    transform?: Partial<Transform>;
  },
): ComponentClip => ({
  id: newId("clip"),
  type: "component",
  trackId: input.trackId,
  name: input.name,
  start: input.start ?? 0,
  duration: input.duration ?? secondsToFrames(4, s.fps),
  component: input.component,
  props: input.props ?? {},
  transform: fullFrameTransform(s, input.transform),
  meta: input.meta,
});
