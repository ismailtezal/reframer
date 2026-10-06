import { z } from "zod";
import { BlendModeSchema, ColorSchema, EasingSchema, FillSchema, KeyframeTracksSchema } from "./primitives";

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

export const CropSchema = z.object({
  top: z.number().min(0).max(1),
  right: z.number().min(0).max(1),
  bottom: z.number().min(0).max(1),
  left: z.number().min(0).max(1),
});
export type Crop = z.infer<typeof CropSchema>;

export const TransformSchema = z.object({
  /** Center of the box, canvas px. */
  x: z.number(),
  y: z.number(),
  /** Box size, canvas px. Text clips treat `height` as a minimum (content grows). */
  width: z.number().min(1),
  height: z.number().min(1),
  scale: z.number(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  crop: CropSchema.optional(),
  /** Corner radius in px (media + shapes). */
  radius: z.number().min(0).optional(),
});
export type Transform = z.infer<typeof TransformSchema>;

// ---------------------------------------------------------------------------
// Preset animations (CapCut-style "In / Out / Loop")
// ---------------------------------------------------------------------------

export const ANIMATION_IN_OUT_TYPES = [
  "fade",
  "slide",
  "rise", // slide up a little + fade (the workhorse)
  "drop",
  "pop", // scale from small with overshoot
  "zoom", // scale from large
  "blur", // blur + fade (Apple-style when combined with rise)
  "rise-blur",
  "spin",
  "flip",
  "wipe",
  "mask-reveal", // clip from one edge, content slides in under the mask
  "stretch",
  "bounce",
  "glitch",
  "swing",
] as const;
export const AnimationInOutTypeSchema = z.enum(ANIMATION_IN_OUT_TYPES);
export type AnimationInOutType = z.infer<typeof AnimationInOutTypeSchema>;

export const DirectionSchema = z.enum(["left", "right", "up", "down"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const AnimationPresetSchema = z.object({
  type: AnimationInOutTypeSchema,
  /** frames */
  duration: z.number().int().min(1),
  easing: EasingSchema.optional(),
  direction: DirectionSchema.optional(),
  /** 0..2, 1 = default strength */
  intensity: z.number().min(0).max(4).optional(),
});
export type AnimationPreset = z.infer<typeof AnimationPresetSchema>;

export const LOOP_TYPES = ["float", "pulse", "breathe", "wiggle", "sway", "spin", "shake", "ken-burns", "drift"] as const;
export const LoopTypeSchema = z.enum(LOOP_TYPES);
export type LoopType = z.infer<typeof LoopTypeSchema>;

export const LoopAnimationSchema = z.object({
  type: LoopTypeSchema,
  /** Frames per cycle (ken-burns/drift: ignored, they span the clip). */
  period: z.number().int().min(2).optional(),
  intensity: z.number().min(0).max(4).optional(),
  direction: DirectionSchema.optional(),
});
export type LoopAnimation = z.infer<typeof LoopAnimationSchema>;

export const ClipAnimationsSchema = z.object({
  in: AnimationPresetSchema.optional(),
  out: AnimationPresetSchema.optional(),
  loop: LoopAnimationSchema.optional(),
});
export type ClipAnimations = z.infer<typeof ClipAnimationsSchema>;

// ---------------------------------------------------------------------------
// Transitions — attached to the INCOMING clip; they play over the cut with the
// previous clip on the same track (the previous clip borrows "handle" frames).
// ---------------------------------------------------------------------------

export const TRANSITION_TYPES = [
  "fade", // cross dissolve
  "dip-to-black",
  "dip-to-white",
  "slide",
  "push",
  "wipe",
  "zoom-in",
  "zoom-out",
  "whip", // fast push with motion blur
  "blur",
  "flash",
  "glitch",
  "iris",
  "clock-wipe",
  "spin",
  "flip",
  "light-leak",
  "stretch", // squash-and-stretch push
  "warp", // lens bulge through the cut
] as const;
export const TransitionTypeSchema = z.enum(TRANSITION_TYPES);
export type TransitionType = z.infer<typeof TransitionTypeSchema>;

export const TransitionSchema = z.object({
  type: TransitionTypeSchema,
  /** frames */
  duration: z.number().int().min(1),
  direction: DirectionSchema.optional(),
  easing: EasingSchema.optional(),
});
export type Transition = z.infer<typeof TransitionSchema>;

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

const effectBase = {
  id: z.string(),
  enabled: z.boolean().optional(),
};

export const GradeEffectSchema = z.object({
  ...effectBase,
  type: z.literal("grade"),
  /** stops, -5..5 */
  exposure: z.number().optional(),
  /** multiplier, 1 = neutral */
  contrast: z.number().optional(),
  /** multiplier, 1 = neutral */
  saturation: z.number().optional(),
  /** -1..1 */
  vibrance: z.number().optional(),
  /** -1 (blue) .. 1 (amber) */
  temperature: z.number().optional(),
  /** -1 (green) .. 1 (magenta) */
  tint: z.number().optional(),
  /** -1..1 */
  highlights: z.number().optional(),
  shadows: z.number().optional(),
  whites: z.number().optional(),
  blacks: z.number().optional(),
  /** Lifted blacks / matte look, 0..0.4 */
  fade: z.number().optional(),
  /** Built-in LUT id (see core/luts) or `asset:<assetId>` for an uploaded .cube */
  lut: z.string().optional(),
  /** 0..1 */
  lutIntensity: z.number().optional(),
});

export const EffectSchema = z.discriminatedUnion("type", [
  GradeEffectSchema,
  z.object({
    ...effectBase,
    type: z.literal("vignette"),
    amount: z.number(),
    radius: z.number().optional(),
    feather: z.number().optional(),
  }),
  z.object({
    ...effectBase,
    type: z.literal("grain"),
    amount: z.number(),
  }),
  z.object({ ...effectBase, type: z.literal("blur"), radius: z.number() }),
  z.object({
    ...effectBase,
    type: z.literal("glow"),
    radius: z.number(),
    intensity: z.number(),
    threshold: z.number().optional(),
    color: ColorSchema.optional(),
  }),
  z.object({
    ...effectBase,
    type: z.literal("chromatic-aberration"),
    amount: z.number(),
    angle: z.number().optional(),
  }),
  z.object({ ...effectBase, type: z.literal("zoom-blur"), amount: z.number() }),
  z.object({
    ...effectBase,
    type: z.literal("shake"),
    /** px */
    intensity: z.number(),
    /** shakes per second */
    frequency: z.number().optional(),
  }),
  z.object({
    ...effectBase,
    type: z.literal("drop-shadow"),
    radius: z.number(),
    offsetX: z.number(),
    offsetY: z.number(),
    opacity: z.number(),
    color: ColorSchema.optional(),
  }),
  z.object({ ...effectBase, type: z.literal("pixelate"), size: z.number() }),
  z.object({
    ...effectBase,
    type: z.literal("duotone"),
    dark: ColorSchema,
    light: ColorSchema,
  }),
  z.object({
    ...effectBase,
    type: z.literal("grayscale"),
    amount: z.number(),
  }),
  z.object({
    ...effectBase,
    type: z.literal("scanlines"),
    amount: z.number(),
  }),
  z.object({
    ...effectBase,
    type: z.literal("halftone"),
    size: z.number(),
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;
export type EffectType = Effect["type"];
export type GradeEffect = z.infer<typeof GradeEffectSchema>;

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export const TextStyleSchema = z.object({
  fontFamily: z.string(),
  fontWeight: z.number().int().min(100).max(1000),
  fontSize: z.number().min(1),
  italic: z.boolean().optional(),
  color: ColorSchema,
  /** Overrides `color` with a gradient fill clipped to the glyphs. */
  gradient: FillSchema.optional(),
  align: z.enum(["left", "center", "right"]),
  lineHeight: z.number().min(0.5).max(4),
  /** em */
  letterSpacing: z.number().min(-0.5).max(2),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]),
  stroke: z.object({ color: ColorSchema, width: z.number().min(0) }).optional(),
  shadow: z
    .object({
      color: ColorSchema,
      blur: z.number().min(0),
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  background: z
    .object({
      color: ColorSchema,
      paddingX: z.number().min(0),
      paddingY: z.number().min(0),
      radius: z.number().min(0),
    })
    .optional(),
});
export type TextStyle = z.infer<typeof TextStyleSchema>;

export const TEXT_ANIMATIONS = [
  "none",
  "fade",
  "rise",
  "rise-blur",
  "drop",
  "pop",
  "slide-left",
  "typewriter",
  "scramble",
  "wave",
  "mask-up",
  "stretch",
  "slam",
  "highlight",
] as const;
export const TextAnimationTypeSchema = z.enum(TEXT_ANIMATIONS);
export type TextAnimationType = z.infer<typeof TextAnimationTypeSchema>;

export const TextAnimationSchema = z.object({
  type: TextAnimationTypeSchema,
  unit: z.enum(["char", "word", "line"]),
  /** frames between units */
  stagger: z.number().min(0),
  /** frames each unit takes to animate */
  duration: z.number().int().min(1),
  easing: EasingSchema.optional(),
  /** Accent color used by `highlight` (marker sweep). */
  accentColor: ColorSchema.optional(),
});
export type TextAnimation = z.infer<typeof TextAnimationSchema>;

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------

export const CaptionWordSchema = z.object({
  /** Include leading whitespace (Remotion caption convention), e.g. " world". */
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  timestampMs: z.number().nullable(),
  confidence: z.number().nullable(),
  /** Emphasis flag for keyword coloring. */
  emphasis: z.boolean().optional(),
  emoji: z.string().optional(),
});
export type CaptionWord = z.infer<typeof CaptionWordSchema>;

export const CAPTION_ANIMATIONS = [
  "none",
  "pop",
  "bounce",
  "fade",
  "karaoke",
  "highlight-box",
  "underline",
  "slide-up",
  "typewriter",
] as const;

export const CaptionStyleSchema = z.object({
  /** Preset id this style was derived from (informational). */
  preset: z.string().optional(),
  fontFamily: z.string(),
  fontWeight: z.number().int().min(100).max(1000),
  fontSize: z.number().min(1),
  color: ColorSchema,
  /** Color of the word currently being spoken. */
  activeColor: ColorSchema,
  /** Background behind the active word (box/pill styles). */
  activeBackground: ColorSchema.optional(),
  /** Color for emphasised keywords. */
  emphasisColor: ColorSchema.optional(),
  textTransform: z.enum(["none", "uppercase", "lowercase"]),
  stroke: z.object({ color: ColorSchema, width: z.number().min(0) }).optional(),
  shadow: z
    .object({
      color: ColorSchema,
      blur: z.number().min(0),
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  /** Box behind the whole page of words. */
  background: z
    .object({
      color: ColorSchema,
      padding: z.number().min(0),
      radius: z.number().min(0),
    })
    .optional(),
  animation: z.enum(CAPTION_ANIMATIONS),
  /** Group words that start within this many ms into one page. */
  combineMs: z.number().min(0),
  maxWordsPerPage: z.number().int().min(1).max(20),
  /** Letter spacing in em */
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
  /** Show emoji attached to words. */
  showEmoji: z.boolean().optional(),
});
export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

export const ClipMetaSchema = z.object({
  createdBy: z.enum(["user", "ai", "template", "agent"]),
  /** Display name of the agent that created it, e.g. "Claude Code". */
  agent: z.string().optional(),
  turnId: z.string().optional(),
  /** Set when a human edits an AI-created clip. Agents must respect it. */
  humanEdited: z.boolean().optional(),
  /** Free-form note visible in the inspector (agents use it to explain choices). */
  note: z.string().optional(),
  /** Label color for organisation. */
  label: z.string().optional(),
});
export type ClipMeta = z.infer<typeof ClipMetaSchema>;

const clipBase = {
  id: z.string(),
  trackId: z.string(),
  name: z.string().optional(),
  /** Timeline start frame. */
  start: z.number().int().min(0),
  /** Timeline duration in frames. */
  duration: z.number().int().min(1),
  transform: TransformSchema,
  keyframes: KeyframeTracksSchema.optional(),
  animations: ClipAnimationsSchema.optional(),
  effects: z.array(EffectSchema).optional(),
  transitionIn: TransitionSchema.optional(),
  blendMode: BlendModeSchema.optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  meta: ClipMetaSchema.optional(),
};

export const MediaFitSchema = z.enum(["cover", "contain", "fill"]);
export type MediaFit = z.infer<typeof MediaFitSchema>;

export const VideoClipSchema = z.object({
  ...clipBase,
  type: z.literal("video"),
  assetId: z.string(),
  /** Source frames skipped before the clip starts (project fps). */
  trimStart: z.number().int().min(0),
  speed: z.number().min(0.1).max(16),
  /** 0..2 */
  volume: z.number().min(0).max(2),
  muted: z.boolean().optional(),
  /** frames */
  fadeIn: z.number().int().min(0).optional(),
  fadeOut: z.number().int().min(0).optional(),
  fit: MediaFitSchema,
});

export const AudioClipSchema = z.object({
  ...clipBase,
  type: z.literal("audio"),
  assetId: z.string(),
  trimStart: z.number().int().min(0),
  speed: z.number().min(0.1).max(16),
  volume: z.number().min(0).max(2),
  muted: z.boolean().optional(),
  fadeIn: z.number().int().min(0).optional(),
  fadeOut: z.number().int().min(0).optional(),
  /** Music ducks under voice when `duck` is set. */
  role: z.enum(["music", "voice", "sfx", "other"]).optional(),
  duck: z.boolean().optional(),
  /** How far it ducks under speech, in dB (default 15). */
  duckDb: z.number().min(0).max(40).optional(),
});

export const ImageClipSchema = z.object({
  ...clipBase,
  type: z.literal("image"),
  assetId: z.string(),
  fit: MediaFitSchema,
});

export const TextClipSchema = z.object({
  ...clipBase,
  type: z.literal("text"),
  text: z.string(),
  style: TextStyleSchema,
  textAnimation: TextAnimationSchema.optional(),
});

export const SHAPE_KINDS = ["rect", "ellipse", "triangle", "star", "polygon", "line", "arrow"] as const;

export const ShapeClipSchema = z.object({
  ...clipBase,
  type: z.literal("shape"),
  shape: z.enum(SHAPE_KINDS),
  fill: FillSchema.optional(),
  stroke: ColorSchema.optional(),
  strokeWidth: z.number().min(0).optional(),
  cornerRadius: z.number().min(0).optional(),
  /** polygon / star point count */
  points: z.number().int().min(3).max(24).optional(),
  /** 0..1 — how much of the outline is drawn (draw-on animations). */
  drawProgress: z.number().min(0).max(1).optional(),
});

export const BackgroundClipSchema = z.object({
  ...clipBase,
  type: z.literal("background"),
  fill: FillSchema,
});

export const CaptionsClipSchema = z.object({
  ...clipBase,
  type: z.literal("captions"),
  words: z.array(CaptionWordSchema),
  /**
   * `clip`: word times are relative to this clip's start.
   * `source`: word times are source-media times of `sourceClipId`, so the
   * captions follow that clip when it is trimmed, moved or sped up.
   */
  timeBase: z.enum(["clip", "source"]),
  sourceClipId: z.string().optional(),
  style: CaptionStyleSchema,
});

export const ComponentClipSchema = z.object({
  ...clipBase,
  type: z.literal("component"),
  /** Built-in motion component id (e.g. "kinetic-title") or `code:<componentId>`. */
  component: z.string(),
  props: z.record(z.string(), z.unknown()),
});

export const ClipSchema = z.discriminatedUnion("type", [
  VideoClipSchema,
  AudioClipSchema,
  ImageClipSchema,
  TextClipSchema,
  ShapeClipSchema,
  BackgroundClipSchema,
  CaptionsClipSchema,
  ComponentClipSchema,
]);

export type Clip = z.infer<typeof ClipSchema>;
export type ClipType = Clip["type"];
export type VideoClip = z.infer<typeof VideoClipSchema>;
export type AudioClip = z.infer<typeof AudioClipSchema>;
export type ImageClip = z.infer<typeof ImageClipSchema>;
export type TextClip = z.infer<typeof TextClipSchema>;
export type ShapeClip = z.infer<typeof ShapeClipSchema>;
export type BackgroundClip = z.infer<typeof BackgroundClipSchema>;
export type CaptionsClip = z.infer<typeof CaptionsClipSchema>;
export type ComponentClip = z.infer<typeof ComponentClipSchema>;
export type MediaClip = VideoClip | AudioClip;

export const CLIP_TYPES: readonly ClipType[] = ["video", "audio", "image", "text", "shape", "background", "captions", "component"];

export const isMediaClip = (clip: Clip): clip is VideoClip | AudioClip => clip.type === "video" || clip.type === "audio";

export const isVisualClip = (clip: Clip): boolean => clip.type !== "audio";
