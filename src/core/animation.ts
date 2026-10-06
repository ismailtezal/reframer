import { resolveEasing } from "./easing";
import type { AnimationInOutType, AnimationPreset, ClipAnimations, Direction, LoopAnimation } from "./schema/clip";
import type { EasingPreset } from "./schema/primitives";
import { clamp, lerp } from "./time";

/**
 * Preset animations ("In / Out / Loop") as pure functions of time.
 * The renderer composes the resulting state with keyframed base values.
 */

export type Inset = { top: number; right: number; bottom: number; left: number };

export type AnimState = {
  /** px offsets */
  dx: number;
  dy: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  /** degrees */
  rotate: number;
  rotateX: number;
  rotateY: number;
  skewX: number;
  opacity: number;
  /** px */
  blur: number;
  /** Clip inset as fractions of the box (wipes). */
  inset: Inset | null;
  /** Iris radius as a fraction of the box diagonal (1 = fully open). */
  circle: number | null;
  /** Content offset inside a clipped box, fractions of box size (mask reveals). */
  innerDx: number;
  innerDy: number;
};

export const identityAnim = (): AnimState => ({
  dx: 0,
  dy: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  skewX: 0,
  opacity: 1,
  blur: 0,
  inset: null,
  circle: null,
  innerDx: 0,
  innerDy: 0,
});

export const combineAnim = (a: AnimState, b: AnimState): AnimState => ({
  dx: a.dx + b.dx,
  dy: a.dy + b.dy,
  scale: a.scale * b.scale,
  scaleX: a.scaleX * b.scaleX,
  scaleY: a.scaleY * b.scaleY,
  rotate: a.rotate + b.rotate,
  rotateX: a.rotateX + b.rotateX,
  rotateY: a.rotateY + b.rotateY,
  skewX: a.skewX + b.skewX,
  opacity: a.opacity * b.opacity,
  blur: a.blur + b.blur,
  inset:
    a.inset && b.inset
      ? {
          top: Math.max(a.inset.top, b.inset.top),
          right: Math.max(a.inset.right, b.inset.right),
          bottom: Math.max(a.inset.bottom, b.inset.bottom),
          left: Math.max(a.inset.left, b.inset.left),
        }
      : (a.inset ?? b.inset),
  circle: a.circle !== null && b.circle !== null ? Math.min(a.circle, b.circle) : (a.circle ?? b.circle),
  innerDx: a.innerDx + b.innerDx,
  innerDy: a.innerDy + b.innerDy,
});

/** Deterministic pseudo-random in [0, 1). */
export const hash01 = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const dirVector = (direction: Direction | undefined, fallback: Direction): [number, number] => {
  switch (direction ?? fallback) {
    case "left":
      return [-1, 0];
    case "right":
      return [1, 0];
    case "up":
      return [0, -1];
    case "down":
      return [0, 1];
  }
};

const DEFAULT_EASING: Record<AnimationInOutType, EasingPreset> = {
  fade: "ease-out",
  slide: "smooth",
  rise: "smooth",
  drop: "smooth",
  pop: "playful",
  zoom: "smooth",
  blur: "smooth",
  "rise-blur": "apple",
  spin: "smooth",
  flip: "smooth",
  wipe: "smooth",
  "mask-reveal": "smooth",
  stretch: "snappy",
  bounce: "bouncy",
  glitch: "linear",
  swing: "playful",
};

export type AnimContext = {
  /** min(canvasWidth, canvasHeight) / 1080 — keeps px offsets resolution independent */
  unit: number;
  canvasWidth: number;
  canvasHeight: number;
  /** Frame used to seed jitter (absolute timeline frame). */
  seedFrame: number;
};

/**
 * `p` goes 0 → 1 as the element arrives (for "out", pass 1 - exitProgress so the
 * same mapping plays in reverse).
 */
export const presetState = (
  type: AnimationInOutType,
  p: number,
  preset: Pick<AnimationPreset, "direction" | "intensity">,
  ctx: AnimContext,
  phase: "in" | "out",
): AnimState => {
  const s = identityAnim();
  const k = preset.intensity ?? 1;
  const u = ctx.unit;
  const inv = 1 - p;
  switch (type) {
    case "fade":
      s.opacity = p;
      break;
    case "slide": {
      const [vx, vy] = dirVector(preset.direction, phase === "in" ? "up" : "down");
      // "up" means it travels upward into place → starts below.
      const dist = 0.35 * k;
      s.dx = -vx * inv * dist * ctx.canvasWidth;
      s.dy = -vy * inv * dist * ctx.canvasHeight;
      s.opacity = clamp(p * 2.5, 0, 1);
      break;
    }
    case "rise":
      s.dy = inv * 48 * k * u;
      s.opacity = clamp(p * 1.6, 0, 1);
      break;
    case "drop":
      s.dy = -inv * 48 * k * u;
      s.opacity = clamp(p * 1.6, 0, 1);
      break;
    case "pop":
      s.scale = lerp(1 - 0.45 * k, 1, p);
      s.opacity = clamp(p * 3, 0, 1);
      break;
    case "zoom":
      s.scale = lerp(1 + 0.35 * k, 1, p);
      s.opacity = clamp(p * 1.4, 0, 1);
      break;
    case "blur":
      s.blur = inv * 24 * k * u;
      s.opacity = clamp(p * 1.3, 0, 1);
      break;
    case "rise-blur":
      s.dy = inv * 36 * k * u;
      s.blur = inv * 14 * k * u;
      s.opacity = clamp(p * 1.25, 0, 1);
      break;
    case "spin":
      s.rotate = -inv * 180 * k;
      s.scale = lerp(0.4, 1, p);
      s.opacity = clamp(p * 2, 0, 1);
      break;
    case "flip":
      s.rotateX = inv * 90 * k;
      s.opacity = clamp(p * 2, 0, 1);
      break;
    case "wipe": {
      const dir = preset.direction ?? (phase === "in" ? "right" : "right");
      const amount = clamp(inv, 0, 1);
      s.inset =
        dir === "right"
          ? { top: 0, right: amount, bottom: 0, left: 0 }
          : dir === "left"
            ? { top: 0, right: 0, bottom: 0, left: amount }
            : dir === "down"
              ? { top: 0, right: 0, bottom: amount, left: 0 }
              : { top: amount, right: 0, bottom: 0, left: 0 };
      break;
    }
    case "mask-reveal": {
      const [vx, vy] = dirVector(preset.direction, "up");
      s.inset = { top: 0, right: 0, bottom: 0, left: 0 };
      s.innerDx = -vx * inv * 1.05;
      s.innerDy = -vy * inv * 1.05;
      break;
    }
    case "stretch":
      s.scaleX = lerp(1 + 0.6 * k, 1, p);
      s.scaleY = lerp(1 - 0.55 * k, 1, p);
      s.opacity = clamp(p * 2, 0, 1);
      break;
    case "bounce":
      s.dy = -inv * 140 * k * u;
      s.opacity = clamp(p * 4, 0, 1);
      break;
    case "glitch": {
      const active = p < 0.95;
      const r = hash01(ctx.seedFrame);
      s.dx = active ? (r - 0.5) * 40 * k * u * inv : 0;
      s.skewX = active ? (hash01(ctx.seedFrame + 7) - 0.5) * 20 * inv : 0;
      s.opacity = active && hash01(ctx.seedFrame + 3) < 0.25 * inv ? 0.15 : clamp(p * 3, 0, 1);
      break;
    }
    case "swing":
      s.rotate = -inv * 24 * k;
      s.opacity = clamp(p * 2, 0, 1);
      break;
  }
  return s;
};

export const loopState = (loop: LoopAnimation, localFrame: number, clipDuration: number, ctx: AnimContext): AnimState => {
  const s = identityAnim();
  const k = loop.intensity ?? 1;
  const u = ctx.unit;
  const period = loop.period ?? 60;
  const phase = (localFrame / period) * Math.PI * 2;
  const progress = clipDuration > 1 ? localFrame / (clipDuration - 1) : 0;
  switch (loop.type) {
    case "float":
      s.dy = Math.sin(phase) * 10 * k * u;
      break;
    case "pulse":
      s.scale = 1 + Math.sin(phase) * 0.04 * k;
      break;
    case "breathe":
      s.scale = 1 + ((1 - Math.cos(phase)) / 2) * 0.03 * k;
      break;
    case "wiggle":
      s.rotate = Math.sin(phase) * 3 * k;
      break;
    case "sway":
      s.dx = Math.sin(phase) * 14 * k * u;
      break;
    case "spin":
      s.rotate = (localFrame / period) * 360 * (loop.direction === "left" ? -1 : 1);
      break;
    case "shake": {
      const f = Math.floor(localFrame / 2);
      s.dx = (hash01(f + ctx.seedFrame * 0.001) - 0.5) * 12 * k * u;
      s.dy = (hash01(f + 91) - 0.5) * 12 * k * u;
      break;
    }
    case "ken-burns": {
      s.scale = 1 + 0.12 * k * progress;
      const [vx, vy] = dirVector(loop.direction, "right");
      s.dx = vx * (progress - 0.5) * 0.03 * k * ctx.canvasWidth;
      s.dy = vy * (progress - 0.5) * 0.03 * k * ctx.canvasHeight;
      break;
    }
    case "drift": {
      const [vx, vy] = dirVector(loop.direction, "right");
      s.dx = vx * (progress - 0.5) * 40 * k * u;
      s.dy = vy * (progress - 0.5) * 40 * k * u;
      break;
    }
  }
  return s;
};

/** Full preset evaluation for a clip at a clip-local frame. */
export const evaluateClipAnimations = (
  animations: ClipAnimations | undefined,
  localFrame: number,
  clipDuration: number,
  ctx: AnimContext,
): AnimState => {
  let state = identityAnim();
  if (!animations) return state;
  const { in: enter, out: exit, loop } = animations;
  if (enter && localFrame < enter.duration) {
    const raw = clamp(localFrame / enter.duration, 0, 1);
    const p = resolveEasing(enter.easing, DEFAULT_EASING[enter.type])(raw);
    state = combineAnim(state, presetState(enter.type, p, enter, ctx, "in"));
  }
  if (exit) {
    const exitStart = clipDuration - exit.duration;
    if (localFrame >= exitStart) {
      const raw = clamp((localFrame - exitStart) / exit.duration, 0, 1);
      // Mirror the "in" curve: ease-in for exits feels natural.
      const eased = 1 - resolveEasing(exit.easing, DEFAULT_EASING[exit.type])(1 - raw);
      state = combineAnim(state, presetState(exit.type, 1 - eased, exit, ctx, "out"));
    }
  }
  if (loop) state = combineAnim(state, loopState(loop, localFrame, clipDuration, ctx));
  return state;
};

export const ANIMATION_LABELS: Record<AnimationInOutType, string> = {
  fade: "Fade",
  slide: "Slide",
  rise: "Rise",
  drop: "Drop",
  pop: "Pop",
  zoom: "Zoom",
  blur: "Blur",
  "rise-blur": "Rise + blur",
  spin: "Spin",
  flip: "Flip",
  wipe: "Wipe",
  "mask-reveal": "Mask reveal",
  stretch: "Stretch",
  bounce: "Bounce",
  glitch: "Glitch",
  swing: "Swing",
};
