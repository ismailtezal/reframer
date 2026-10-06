import { z } from "zod";
import {
  AnimationInOutTypeSchema,
  CaptionStyleSchema,
  LoopTypeSchema,
  TextAnimationTypeSchema,
  TransitionTypeSchema,
} from "../schema/clip";
import { EasingSchema } from "../schema/primitives";

/**
 * Style DNA — a parameterised description of an editing style ("edit it like
 * MrBeast", "Apple keynote", "Kurzgesagt"). Deterministic parts (grade, type,
 * captions, transitions, motion) are applied by `applyStyleDNA`; creative parts
 * (pacing, structure, sound, signature tells) guide the agent.
 *
 * Confidence tags: "measured" (frame-by-frame study), "reported" (tutorials,
 * preset makers), "approx" (best-practice estimate).
 */

export const STYLE_ARCHETYPES = [
  "retention_entertainment",
  "talking_head_short",
  "podcast_clip",
  "talking_head_edu",
  "talking_head_premium",
  "tech_review_premium",
  "tech_review_entertainment",
  "edu_animation",
  "doc_essay",
  "cinematic_vlog",
  "chaotic_vlog",
  "music_montage",
  "brand_film",
  "saas_launch",
  "trailer",
  "auteur_look",
  "retro_texture",
  "event_or_property",
  "stream_clip",
  "minimal_essay",
] as const;
export const StyleArchetypeSchema = z.enum(STYLE_ARCHETYPES);
export type StyleArchetype = z.infer<typeof StyleArchetypeSchema>;

export const TypeRoleSchema = z.object({
  /** Google Fonts family used for rendering (always available). */
  fontFamily: z.string(),
  /** What the original style uses, if different (informational). */
  originalFont: z.string().optional(),
  fontWeight: z.number().int().min(100).max(1000),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]),
  /** em */
  letterSpacing: z.number(),
  lineHeight: z.number().optional(),
  color: z.string(),
  /** Gradient fill for hero words, CSS colors (2-3 stops). */
  gradient: z.array(z.string()).optional(),
  stroke: z.object({ color: z.string(), width: z.number() }).optional(),
  shadow: z.object({ color: z.string(), blur: z.number(), x: z.number(), y: z.number() }).optional(),
  /** Font size as % of frame height. */
  sizePctH: z.number(),
  italic: z.boolean().optional(),
});
export type TypeRole = z.infer<typeof TypeRoleSchema>;

export const StyleDNASchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["creator", "brand", "genre", "custom"]),
  archetype: StyleArchetypeSchema,
  /** One-line description shown in the style picker. */
  description: z.string(),
  /** Real-world reference, e.g. "MrBeast" — styles are "inspired by", never affiliated. */
  inspiredBy: z.string().optional(),
  tags: z.array(z.string()),

  format: z.object({
    aspect: z.enum(["16:9", "9:16", "1:1", "4:5"]),
    fps: z.number().int(),
    /** Typical length in seconds */
    durationSec: z.object({ min: z.number(), typical: z.number(), max: z.number() }),
    /** Optional letterbox ratio, e.g. 2.39 */
    letterbox: z.number().optional(),
  }),

  pacing: z.object({
    /** Average shot length in seconds */
    aslSec: z.number(),
    cutStyle: z.enum(["hard", "jump", "mixed", "continuous", "beat"]),
    beatSync: z.enum(["none", "loose", "strict"]),
    /** Gaps longer than this are removed from talking footage (ms). 0 = keep. */
    maxSilenceMs: z.number(),
    keepFillers: z.boolean(),
    hook: z.string(),
    ending: z.enum(["abrupt", "cta", "outro_card", "cliffhanger", "loop", "logo_sting", "fade"]),
    punchIn: z
      .object({
        /** 1.1 = 110% */
        scale: z.number(),
        perMin: z.number(),
        /** 0 = hard cut punch, >0 = animated over N frames */
        durFrames: z.number(),
      })
      .optional(),
  }),

  grade: z.object({
    exposure: z.number(),
    contrast: z.number(),
    saturation: z.number(),
    vibrance: z.number(),
    temperature: z.number(),
    tint: z.number(),
    highlights: z.number(),
    shadows: z.number(),
    /** lifted blacks / matte */
    fade: z.number(),
    /** Built-in LUT id (see core/luts), optional */
    lut: z.string().optional(),
    vignette: z.number(),
    grain: z.number(),
    chromaticAberration: z.number().optional(),
    glow: z.number().optional(),
    look: z.string(),
  }),

  palette: z.object({
    background: z.string(),
    foreground: z.string(),
    accents: z.array(z.string()),
    /** e.g. "60/30/10", "single accent on neutrals" */
    rule: z.string().optional(),
  }),

  typography: z.object({
    title: TypeRoleSchema,
    body: TypeRoleSchema,
    callout: TypeRoleSchema.optional(),
  }),

  captions: z.object({
    mode: z.enum(["none", "callout_only", "phrase", "word_group", "word_by_word", "karaoke"]),
    /** Caption style applied to caption clips (merged onto defaults). */
    style: CaptionStyleSchema.partial(),
    /** Fraction of frame height where captions sit (center line). */
    yPct: z.number(),
  }),

  transitions: z.object({
    primary: TransitionTypeSchema.or(z.literal("cut")),
    secondary: z.array(TransitionTypeSchema),
    /** Frames at 30fps */
    durationFrames: z.number().int(),
    /** Share of cuts that get a transition (0..1) */
    frequency: z.number(),
    avoid: z.array(z.string()),
  }),

  motion: z.object({
    enter: AnimationInOutTypeSchema,
    exit: AnimationInOutTypeSchema,
    easing: EasingSchema,
    textAnimation: TextAnimationTypeSchema,
    textUnit: z.enum(["char", "word", "line"]),
    /** frames between text units */
    stagger: z.number(),
    idleLoop: LoopTypeSchema.optional(),
    /** Ken Burns on stills */
    kenBurns: z.boolean(),
    shake: z.boolean(),
    motionBlur: z.boolean(),
    /** Max overshoot % allowed on UI elements */
    overshootPct: z.number(),
  }),

  overlays: z.array(z.string()),

  sound: z.object({
    music: z.string(),
    bpm: z.tuple([z.number(), z.number()]),
    sfx: z.array(z.string()),
    sfxPerMin: z.number(),
    /** dB music ducks under voice */
    duckDb: z.number(),
  }),

  /** The 3-5 tells that make the style instantly recognisable. Highest priority. */
  signature: z.array(z.string()),
  /** Things this style never does. */
  avoid: z.array(z.string()),
  /** Extra natural-language direction for the agent. */
  agentNotes: z.string().optional(),
});
export type StyleDNA = z.infer<typeof StyleDNASchema>;
