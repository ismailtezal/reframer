import { z } from "zod";

/**
 * Primitive building blocks shared by every part of the project model.
 *
 * Conventions:
 * - Time inside the project is measured in integer frames at `project.settings.fps`.
 * - Positions are canvas pixels. `x`/`y` always describe the CENTER of a box.
 * - Colors are any CSS color string (`#ff0055`, `rgba(...)`, `oklch(...)`).
 */

export const ColorSchema = z.string().min(1);
export type Color = z.infer<typeof ColorSchema>;

/** Named easing presets. Keep in sync with `src/core/easing.ts`. */
export const EASING_PRESETS = [
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "smooth", // expo-out: the "premium" default for entrances
  "snappy", // fast, critically damped spring
  "gentle", // slow, no-bounce spring
  "bouncy", // visible overshoot
  "playful", // small overshoot
  "heavy", // massive, slow settle
  "apple", // soft ease-out used for keynote-style reveals
  "anticipate", // back-in
  "overshoot", // back-out
  "hold", // step: jump at the end of the segment
] as const;
export const EasingPresetSchema = z.enum(EASING_PRESETS);
export type EasingPreset = z.infer<typeof EasingPresetSchema>;

export const BezierEasingSchema = z.object({
  type: z.literal("bezier"),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});

export const SpringEasingSchema = z.object({
  type: z.literal("spring"),
  damping: z.number().min(0.1).max(1000),
  stiffness: z.number().min(1).max(2000).optional(),
  mass: z.number().min(0.1).max(20).optional(),
});

export const EasingSchema = z.union([EasingPresetSchema, BezierEasingSchema, SpringEasingSchema]);
export type Easing = z.infer<typeof EasingSchema>;

/**
 * A keyframe. `frame` is relative to the start of the clip that owns it.
 * `easing` controls the curve from this keyframe to the next one.
 */
export const KeyframeSchema = z.object({
  frame: z.number().int().min(0),
  value: z.union([z.number(), z.string()]),
  easing: EasingSchema.optional(),
});
export type Keyframe = z.infer<typeof KeyframeSchema>;

/**
 * Animatable properties. Transform props are top-level names, component/text
 * props use a `props.` prefix (e.g. `props.progress`, `style.color`).
 */
export const AnimatablePropertySchema = z.string().min(1);
export type AnimatableProperty = z.infer<typeof AnimatablePropertySchema>;

export const KeyframeTracksSchema = z.record(AnimatablePropertySchema, z.array(KeyframeSchema));
export type KeyframeTracks = z.infer<typeof KeyframeTracksSchema>;

export const GradientStopSchema = z.object({
  color: ColorSchema,
  /** 0..1 */
  pos: z.number().min(0).max(1),
});

export const FillSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color: ColorSchema }),
  z.object({
    type: z.literal("linear"),
    /** CSS angle in degrees (0 = bottom-to-top, 90 = left-to-right). */
    angle: z.number(),
    stops: z.array(GradientStopSchema).min(2),
  }),
  z.object({
    type: z.literal("radial"),
    /** Center, 0..1 of the box */
    cx: z.number(),
    cy: z.number(),
    stops: z.array(GradientStopSchema).min(2),
  }),
]);
export type Fill = z.infer<typeof FillSchema>;

export const BlendModeSchema = z.enum([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "soft-light",
  "hard-light",
  "difference",
  "exclusion",
  "plus-lighter",
]);
export type BlendMode = z.infer<typeof BlendModeSchema>;
