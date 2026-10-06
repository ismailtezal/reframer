import { type AnimContext, type AnimState, hash01, identityAnim, presetState } from "./animation";
import { resolveEasing } from "./easing";
import type { TextAnimation } from "./schema/clip";
import { clamp } from "./time";

/**
 * Per-unit (char / word / line) text animation, used by the text renderer.
 * Units enter in sequence: unit i starts at `i * stagger` frames.
 */

export type TextUnit = {
  text: string;
  /** whitespace / newline units are rendered but never animated */
  isSpace: boolean;
  lineIndex: number;
};

/** Splits text into animation units while preserving spaces and line breaks. */
export const splitTextUnits = (text: string, unit: TextAnimation["unit"]): TextUnit[][] => {
  const lines = text.split("\n");
  return lines.map((line, lineIndex) => {
    if (unit === "line") return [{ text: line, isSpace: false, lineIndex }];
    if (unit === "word") {
      return line
        .split(/(\s+)/)
        .filter((t) => t.length > 0)
        .map((t) => ({ text: t, isSpace: /^\s+$/.test(t), lineIndex }));
    }
    return Array.from(line).map((ch) => ({ text: ch, isSpace: ch === " ", lineIndex }));
  });
};

export type UnitRender = {
  state: AnimState;
  /** Replacement glyphs (scramble) */
  displayText?: string;
  /** 0..1 highlight bar width (highlight) */
  highlight?: number;
  visible: boolean;
};

const SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>";

export const evaluateTextUnit = (
  anim: TextAnimation,
  localFrame: number,
  unitIndex: number,
  unitText: string,
  ctx: AnimContext,
): UnitRender => {
  const start = unitIndex * anim.stagger;
  const raw = clamp((localFrame - start) / anim.duration, 0, 1);
  const defaultEase = anim.type === "pop" || anim.type === "slam" ? "playful" : anim.type === "rise-blur" ? "apple" : "smooth";
  const p = resolveEasing(anim.easing, defaultEase)(raw);
  const base = identityAnim();

  switch (anim.type) {
    case "none":
      return { state: base, visible: true };
    case "typewriter":
      return { state: base, visible: localFrame >= start };
    case "scramble": {
      if (raw >= 1) return { state: base, visible: true };
      if (localFrame < start) return { state: { ...base, opacity: 0 }, visible: true };
      const seed = Math.floor(localFrame / 2) + unitIndex * 31;
      const glyphs = Array.from(unitText)
        .map((ch, i) => (ch === " " ? " " : SCRAMBLE_GLYPHS[Math.floor(hash01(seed + i * 7) * SCRAMBLE_GLYPHS.length)]))
        .join("");
      return { state: base, displayText: glyphs, visible: true };
    }
    case "wave": {
      const enter = presetState("rise", p, { intensity: 0.6 }, ctx, "in");
      const wave = Math.sin((localFrame - start) / 6 + unitIndex * 0.6) * 6 * ctx.unit * (raw >= 1 ? 1 : raw);
      return { state: { ...enter, dy: enter.dy + wave }, visible: true };
    }
    case "mask-up": {
      const s = identityAnim();
      s.inset = { top: 0, right: 0, bottom: 0, left: 0 };
      s.innerDy = 1.1 * (1 - p);
      return { state: s, visible: true };
    }
    case "slam": {
      const s = identityAnim();
      s.scale = 1 + (1 - p) * 1.6;
      s.blur = (1 - p) * 10 * ctx.unit;
      s.opacity = clamp(raw * 4, 0, 1);
      return { state: s, visible: true };
    }
    case "highlight":
      return { state: base, highlight: p, visible: true };
    case "fade":
      return { state: presetState("fade", p, {}, ctx, "in"), visible: true };
    case "rise":
      return { state: presetState("rise", p, {}, ctx, "in"), visible: true };
    case "rise-blur":
      return { state: presetState("rise-blur", p, {}, ctx, "in"), visible: true };
    case "drop":
      return { state: presetState("drop", p, {}, ctx, "in"), visible: true };
    case "pop":
      return { state: presetState("pop", p, {}, ctx, "in"), visible: true };
    case "slide-left":
      return {
        state: presetState("slide", p, { direction: "left", intensity: 0.15 }, ctx, "in"),
        visible: true,
      };
    case "stretch":
      return { state: presetState("stretch", p, {}, ctx, "in"), visible: true };
  }
};

/** Frames needed for every unit to finish entering. */
export const textAnimationLength = (anim: TextAnimation, unitCount: number): number =>
  Math.max(0, unitCount - 1) * anim.stagger + anim.duration;
