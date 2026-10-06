import { barrelDistortion } from "@remotion/effects/barrel-distortion";
import { blur } from "@remotion/effects/blur";
import { chromaticAberration } from "@remotion/effects/chromatic-aberration";
import { colorCorrection } from "@remotion/effects/color-correction";
import { dropShadow } from "@remotion/effects/drop-shadow";
import { duotone } from "@remotion/effects/duotone";
import { exposure } from "@remotion/effects/exposure";
import { glow } from "@remotion/effects/glow";
import { grayscale } from "@remotion/effects/grayscale";
import { halftone } from "@remotion/effects/halftone";
import { lut } from "@remotion/effects/lut";
import { noise } from "@remotion/effects/noise";
import { pixelate } from "@remotion/effects/pixelate";
import { scanlines } from "@remotion/effects/scanlines";
import { vignette } from "@remotion/effects/vignette";
import { zoomBlur } from "@remotion/effects/zoom-blur";
import type { EffectDescriptor } from "remotion";
import { hash01 } from "../core/animation";
import { getLutCube } from "../core/luts";
import type { Effect } from "../core/schema";
import type { TransitionFx } from "./transitions";

/**
 * Maps Reframer effects to Remotion's GPU effects (for canvas-backed content:
 * video and images) and to CSS filters (for DOM content: text, shapes,
 * components). Shake is a transform and handled by the clip layer.
 */

const enabled = (e: Effect) => e.enabled !== false;

export type UploadedLutResolver = (assetId: string) => string | null;

export const toCanvasEffects = (
  effects: readonly Effect[] | undefined,
  unit: number,
  resolveUploadedLut?: UploadedLutResolver,
): EffectDescriptor<unknown>[] => {
  if (!effects) return [];
  const out: EffectDescriptor<unknown>[] = [];
  for (const e of effects) {
    if (!enabled(e)) continue;
    switch (e.type) {
      case "grade": {
        out.push(
          colorCorrection({
            exposure: e.exposure ?? 0,
            contrast: e.contrast ?? 1,
            saturation: e.saturation ?? 1,
            vibrance: e.vibrance ?? 0,
            temperature: e.temperature ?? 0,
            tint: e.tint ?? 0,
            highlights: e.highlights ?? 0,
            shadows: e.shadows ?? 0,
            whites: e.whites ?? 0,
            blacks: Math.min(1, (e.blacks ?? 0) + (e.fade ?? 0) * 1.6),
          }),
        );
        if (e.lut) {
          const intensity = e.lutIntensity ?? 1;
          const content = e.lut.startsWith("asset:") ? (resolveUploadedLut?.(e.lut.slice(6)) ?? null) : getLutCube(e.lut, intensity);
          if (content) out.push(lut({ content }));
        }
        break;
      }
      case "vignette":
        out.push(vignette({ amount: e.amount, radius: e.radius ?? 0.7, feather: e.feather ?? 0.4 }));
        break;
      case "grain":
        out.push(noise({ amount: Math.min(1, e.amount), seed: 0 }));
        break;
      case "blur":
        if (e.radius > 0) out.push(blur({ radius: e.radius * unit }));
        break;
      case "glow":
        out.push(
          glow({
            radius: e.radius * unit,
            intensity: e.intensity,
            threshold: e.threshold ?? 0.6,
            color: e.color,
          }),
        );
        break;
      case "chromatic-aberration":
        out.push(chromaticAberration({ amount: e.amount * unit, angle: e.angle ?? 0 }));
        break;
      case "zoom-blur":
        out.push(zoomBlur({ amount: e.amount * unit }));
        break;
      case "drop-shadow":
        out.push(
          dropShadow({
            radius: e.radius * unit,
            offsetX: e.offsetX * unit,
            offsetY: e.offsetY * unit,
            opacity: e.opacity,
            color: e.color,
          }),
        );
        break;
      case "pixelate":
        out.push(pixelate({ blockSize: Math.max(1, e.size * unit) }));
        break;
      case "duotone":
        out.push(duotone({ darkColor: e.dark, lightColor: e.light }));
        break;
      case "grayscale":
        out.push(grayscale({ amount: e.amount }));
        break;
      case "scanlines":
        out.push(scanlines({ amount: e.amount, spacing: Math.max(2, 4 * unit) }));
        break;
      case "halftone":
        out.push(halftone({ dotSize: Math.max(2, e.size * unit), colorMode: "source" }));
        break;
      case "shake":
        break;
    }
  }
  return out;
};

/** CSS filter string for DOM content. Unsupported effects are skipped. */
export const toCssFilter = (effects: readonly Effect[] | undefined, unit: number): string => {
  if (!effects) return "";
  const parts: string[] = [];
  for (const e of effects) {
    if (!enabled(e)) continue;
    switch (e.type) {
      case "grade":
        if (e.exposure) parts.push(`brightness(${(2 ** e.exposure).toFixed(3)})`);
        if (e.contrast !== undefined && e.contrast !== 1) parts.push(`contrast(${e.contrast})`);
        if (e.saturation !== undefined && e.saturation !== 1) parts.push(`saturate(${e.saturation})`);
        if (e.temperature) parts.push(`sepia(${Math.max(0, e.temperature) * 0.35})`);
        break;
      case "blur":
        parts.push(`blur(${e.radius * unit}px)`);
        break;
      case "glow":
        parts.push(`drop-shadow(0 0 ${e.radius * unit * 0.6}px ${e.color ?? "rgba(255,255,255,0.75)"})`);
        break;
      case "drop-shadow":
        parts.push(
          `drop-shadow(${e.offsetX * unit}px ${e.offsetY * unit}px ${e.radius * unit}px ${e.color ?? `rgba(0,0,0,${e.opacity})`})`,
        );
        break;
      case "grayscale":
        parts.push(`grayscale(${e.amount})`);
        break;
      default:
        break;
    }
  }
  return parts.join(" ");
};

/** Pixel offset from a `shake` effect at a frame. */
export const shakeOffset = (effects: readonly Effect[] | undefined, frame: number, fps: number, unit: number) => {
  const shake = effects?.find((e): e is Extract<Effect, { type: "shake" }> => e.type === "shake" && enabled(e));
  if (!shake) return { x: 0, y: 0 };
  const step = Math.floor((frame / fps) * (shake.frequency ?? 12));
  return {
    x: (hash01(step * 1.31) - 0.5) * 2 * shake.intensity * unit,
    y: (hash01(step * 2.17 + 5) - 0.5) * 2 * shake.intensity * unit,
  };
};

/** Transition optics as GPU effects for media clips (applied after the clip's own look). */
export const transitionCanvasEffects = (fx: TransitionFx, unit: number): EffectDescriptor<unknown>[] => {
  const out: EffectDescriptor<unknown>[] = [];
  const mbx = (fx.motionBlur?.x ?? 0) * unit;
  const mby = (fx.motionBlur?.y ?? 0) * unit;
  if (mbx > 0.5) out.push(blur({ radius: mbx, vertical: false }));
  if (mby > 0.5) out.push(blur({ radius: mby, horizontal: false }));
  if ((fx.zoomBlur ?? 0) * unit > 0.5) out.push(zoomBlur({ amount: (fx.zoomBlur ?? 0) * unit, center: [0.5, 0.5] }));
  if (fx.rgbSplit && fx.rgbSplit.amount * unit > 0.3)
    out.push(chromaticAberration({ amount: fx.rgbSplit.amount * unit, angle: fx.rgbSplit.angle }));
  if (fx.exposure && Math.abs(fx.exposure) > 0.01) out.push(exposure({ stops: Math.max(-5, Math.min(5, fx.exposure)) }));
  if (fx.lens && fx.lens > 0.005) out.push(barrelDistortion({ amount: Math.min(1, fx.lens) }));
  if (fx.scanlines && fx.scanlines > 0.01)
    out.push(scanlines({ amount: Math.min(1, fx.scanlines), spacing: 3 * unit, thickness: Math.max(1, unit) }));
  return out;
};
