"use client";

import type { z } from "zod";
import type { ClipPatchSpec, ClipSpecInput, EffectSpec } from "@/agent/tool-schemas";
import {
  createAudioClip,
  createBackgroundClip,
  createComponentClip,
  createImageClip,
  createShapeClip,
  createTextClip,
  createVideoClip,
} from "@/core/defaults";
import { newId } from "@/core/ids";
import { addTrack } from "@/core/ops";
import type { Asset, Clip, ClipAnimations, Effect, Fill, Project, TextAnimation, TextStyle, Transition } from "@/core/schema";
import { getSfx } from "@/core/sfx";
import { getMotionComponent } from "@/remotion/components/registry";
import { getTextPreset } from "../presets/text-presets";

const fr = (sec: number, fps: number) => Math.max(0, Math.round(sec * fps));

type FillInput =
  | string
  | { type: "linear"; angle: number; colors: string[] }
  | { type: "radial"; cx?: number; cy?: number; colors: string[] };

export const toFill = (f: FillInput): Fill => {
  if (typeof f === "string") return { type: "solid", color: f };
  const stops = f.colors.map((color, i, arr) => ({ color, pos: arr.length === 1 ? 0 : i / (arr.length - 1) }));
  if (f.type === "linear") return { type: "linear", angle: f.angle, stops };
  return { type: "radial", cx: f.cx ?? 0.5, cy: f.cy ?? 0.5, stops };
};

export const toEffects = (specs: z.infer<typeof EffectSpec>[]): Effect[] => specs.map((e) => ({ ...e, id: newId("fx") }) as Effect);

type AnimInput = NonNullable<z.infer<typeof ClipPatchSpec>["animations"]>;

export const toAnimations = (a: AnimInput | undefined, fps: number, base?: ClipAnimations): ClipAnimations | undefined => {
  if (!a) return base;
  const out: ClipAnimations = { ...base };
  const preset = (p: NonNullable<AnimInput["in"]>) => ({
    type: p.type,
    duration: Math.max(1, fr(p.durationSec, fps)),
    easing: p.easing,
    direction: p.direction,
    intensity: p.intensity,
  });
  if (a.in === null) delete out.in;
  else if (a.in) out.in = preset(a.in);
  if (a.out === null) delete out.out;
  else if (a.out) out.out = preset(a.out);
  if (a.loop === null) delete out.loop;
  else if (a.loop) {
    out.loop = {
      type: a.loop.type,
      period: a.loop.periodSec ? Math.max(2, fr(a.loop.periodSec, fps)) : undefined,
      intensity: a.loop.intensity,
      direction: a.loop.direction,
    };
  }
  return Object.keys(out).length ? out : undefined;
};

export const toTransition = (
  t: { type: Transition["type"]; durationSec: number; direction?: Transition["direction"]; easing?: Transition["easing"] },
  fps: number,
): Transition => ({
  type: t.type,
  duration: Math.max(1, fr(t.durationSec, fps)),
  direction: t.direction,
  easing: t.easing,
});

type TextStyleInput = Partial<Omit<TextStyle, "gradient">> & { gradient?: string[] };

export const toTextStyle = (s: TextStyleInput | undefined): Partial<TextStyle> | undefined => {
  if (!s) return undefined;
  const { gradient, ...rest } = s;
  return {
    ...rest,
    ...(gradient ? { gradient: toFill({ type: "linear", angle: 100, colors: gradient }) } : {}),
  };
};

export const toTextAnimation = (t: {
  type: TextAnimation["type"];
  unit: TextAnimation["unit"];
  staggerFrames: number;
  durationFrames: number;
  easing?: TextAnimation["easing"];
  accentColor?: string;
}): TextAnimation => ({
  type: t.type,
  unit: t.unit,
  stagger: t.staggerFrames,
  duration: t.durationFrames,
  easing: t.easing,
  accentColor: t.accentColor,
});

/** Resolves the track for a new clip: explicit id, "new", or the top unlocked track of the right kind. */
const resolveTrack = (draft: Project, kind: "visual" | "audio", trackId: string | undefined) => {
  if (trackId === "new") return addTrack(draft, { kind });
  if (trackId && draft.tracks.some((t) => t.id === trackId)) return trackId;
  const t = draft.tracks.find((x) => x.kind === kind && !x.locked);
  return t ? t.id : addTrack(draft, { kind });
};

const requireAsset = (draft: Project, id: string): Asset => {
  const a = draft.assets[id];
  if (!a) throw new Error(`Asset "${id}" not found. Use get_project to see asset ids, or import_media first.`);
  return a;
};

/** Builds a Clip from the agent-facing spec. Throws with actionable messages. */
export const specToClip = (draft: Project, spec: ClipSpecInput, meta: Clip["meta"]): Clip => {
  const s = draft.settings;
  const fps = s.fps;
  if (spec.type === "sfx") {
    const sfx = getSfx(spec.sound);
    if (!sfx) throw new Error(`Unknown sound "${spec.sound}". Valid ids are listed in your instructions.`);
    // SFX become small audio assets on first use.
    const assetId = `asset_sfx_${sfx.id.replace(/[^a-z0-9]/g, "")}`;
    if (!draft.assets[assetId]) {
      draft.assets[assetId] = {
        id: assetId,
        type: "audio",
        name: sfx.name,
        src: sfx.src,
        mimeType: "audio/wav",
        durationSec: sfx.durationSec,
        source: "builtin",
        createdAt: Date.now(),
      };
    }
    const trackId = resolveTrack(draft, "audio", spec.trackId);
    const clip = createAudioClip(s, draft.assets[assetId], {
      trackId,
      start: fr(spec.startSec, fps),
      role: "sfx",
      volume: spec.volume ?? 0.8,
      name: spec.name ?? sfx.name,
      meta,
    });
    return clip;
  }

  const start = fr(spec.startSec, fps);
  const duration = Math.max(1, fr(spec.durationSec, fps));
  const base = { start, duration, name: spec.name, meta: { ...meta, note: spec.note ?? meta?.note } as Clip["meta"] };
  const transformOverrides = spec.transform ?? {};
  let clip: Clip;

  switch (spec.type) {
    case "video": {
      const asset = requireAsset(draft, spec.assetId);
      clip = createVideoClip(s, asset, {
        ...base,
        trackId: resolveTrack(draft, "visual", spec.trackId),
        trimStart: fr(spec.trimStartSec ?? 0, fps),
        transform: transformOverrides,
      });
      if (spec.speed) clip.speed = spec.speed;
      if (spec.volume !== undefined) clip.volume = spec.volume;
      if (spec.muted) clip.muted = true;
      if (spec.fit) clip.fit = spec.fit;
      break;
    }
    case "image": {
      const asset = requireAsset(draft, spec.assetId);
      clip = createImageClip(s, asset, {
        ...base,
        trackId: resolveTrack(draft, "visual", spec.trackId),
        fit: spec.fit,
        transform: transformOverrides,
      });
      break;
    }
    case "audio": {
      const asset = requireAsset(draft, spec.assetId);
      clip = createAudioClip(s, asset, {
        ...base,
        trackId: resolveTrack(draft, "audio", spec.trackId),
        trimStart: fr(spec.trimStartSec ?? 0, fps),
        role: spec.role,
        volume: spec.volume,
      });
      if (spec.fadeInSec) clip.fadeIn = fr(spec.fadeInSec, fps);
      if (spec.fadeOutSec) clip.fadeOut = fr(spec.fadeOutSec, fps);
      if (spec.duck !== undefined) clip.duck = spec.duck;
      if (spec.duckDb !== undefined) clip.duckDb = Math.min(40, Math.max(0, spec.duckDb));
      break;
    }
    case "text": {
      const preset = spec.preset ? getTextPreset(spec.preset) : undefined;
      const unit = Math.min(s.width, s.height) / 1080;
      const presetStyle = preset ? { ...preset.style, fontSize: Math.round((preset.style.fontSize ?? 80) * unit) } : {};
      clip = createTextClip(s, {
        ...base,
        trackId: resolveTrack(draft, "visual", spec.trackId),
        text: spec.text,
        style: { ...presetStyle, ...toTextStyle(spec.style as TextStyleInput) },
        transform: transformOverrides,
      });
      if (preset?.textAnimation) clip.textAnimation = preset.textAnimation;
      if (preset?.animations) clip.animations = preset.animations;
      if (spec.textAnimation) clip.textAnimation = toTextAnimation(spec.textAnimation);
      break;
    }
    case "shape":
      clip = createShapeClip(s, {
        ...base,
        trackId: resolveTrack(draft, "visual", spec.trackId),
        shape: spec.shape,
        fill: spec.fill ? toFill(spec.fill as FillInput) : undefined,
        stroke: spec.stroke,
        strokeWidth: spec.strokeWidth,
        transform: transformOverrides,
      });
      if (spec.cornerRadius !== undefined) clip.cornerRadius = spec.cornerRadius;
      break;
    case "background":
      clip = createBackgroundClip(s, {
        ...base,
        trackId: resolveTrack(draft, "visual", spec.trackId),
        fill: toFill(spec.fill as FillInput),
      });
      break;
    case "component": {
      const isCode = spec.component.startsWith("code:");
      const def = isCode ? undefined : getMotionComponent(spec.component);
      if (!isCode && !def) throw new Error(`Unknown component "${spec.component}". Use list_components.`);
      if (isCode && !draft.components[spec.component.slice(5)]) throw new Error(`Code component "${spec.component}" not found.`);
      const box = def?.defaultBox;
      clip = createComponentClip(s, {
        ...base,
        trackId: resolveTrack(draft, "visual", spec.trackId),
        component: spec.component,
        props: spec.props,
        transform: {
          ...(box ? { x: box.x * s.width, y: box.y * s.height, width: box.width * s.width, height: box.height * s.height } : {}),
          ...transformOverrides,
        },
      });
      if (!spec.name) clip.name = def?.name ?? draft.components[spec.component.slice(5)]?.name;
      break;
    }
  }
  if (spec.animations) clip.animations = toAnimations(spec.animations, fps, clip.animations);
  if (spec.transitionIn) clip.transitionIn = toTransition(spec.transitionIn, fps);
  if (spec.effects) clip.effects = toEffects(spec.effects);
  return clip;
};

/** Converts an agent patch into an internal clip patch (timing handled separately). */
export const specPatchToClipPatch = (patch: z.infer<typeof ClipPatchSpec>, clip: Clip, fps: number): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.text !== undefined) out.text = patch.text;
  if (patch.style !== undefined) out.style = toTextStyle(patch.style as TextStyleInput);
  if (patch.textAnimation !== undefined) out.textAnimation = patch.textAnimation === null ? null : toTextAnimation(patch.textAnimation);
  if (patch.props !== undefined) out.props = patch.props;
  if (patch.transform !== undefined) out.transform = patch.transform;
  if (patch.animations !== undefined) {
    out.animations = null;
    const next = toAnimations(patch.animations, fps, clip.animations);
    if (next) out.animations = next;
  }
  if (patch.transitionIn !== undefined) out.transitionIn = patch.transitionIn === null ? null : toTransition(patch.transitionIn, fps);
  if (patch.effects !== undefined) out.effects = toEffects(patch.effects);
  if (patch.volume !== undefined) out.volume = patch.volume;
  if (patch.muted !== undefined) out.muted = patch.muted;
  if (patch.speed !== undefined) out.speed = patch.speed;
  if (patch.fit !== undefined) out.fit = patch.fit;
  if (patch.fill !== undefined) out.fill = toFill(patch.fill as FillInput);
  if (patch.stroke !== undefined) out.stroke = patch.stroke;
  if (patch.strokeWidth !== undefined) out.strokeWidth = patch.strokeWidth;
  if (patch.hidden !== undefined) out.hidden = patch.hidden;
  if (patch.note !== undefined) out.meta = { note: patch.note };
  return out;
};
