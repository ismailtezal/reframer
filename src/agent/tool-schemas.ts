import { z } from "zod";
import {
  ANIMATION_IN_OUT_TYPES,
  CAPTION_ANIMATIONS,
  LOOP_TYPES,
  SHAPE_KINDS,
  TEXT_ANIMATIONS,
  TRANSITION_TYPES,
} from "../core/schema/clip";
import { EASING_PRESETS } from "../core/schema/primitives";

/**
 * The agent's tool contract — shared by the built-in agent (AI SDK) and the
 * MCP server (Claude Code, Codex, Cursor…). Units are agent-friendly:
 * time in SECONDS, positions in canvas PIXELS (x/y = box center).
 */

const sec = (d: string) => z.number().describe(d);

const Easing = z
  .union([
    z.enum(EASING_PRESETS),
    z.object({ type: z.literal("bezier"), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }),
    z.object({ type: z.literal("spring"), damping: z.number(), stiffness: z.number().optional(), mass: z.number().optional() }),
  ])
  .describe("Named preset (smooth = expo-out, apple, snappy, gentle, bouncy…) or a custom bezier/spring");

const Direction = z.enum(["left", "right", "up", "down"]);

const TransformSpec = z
  .object({
    x: z.number().describe("center x in px"),
    y: z.number().describe("center y in px"),
    width: z.number(),
    height: z.number(),
    scale: z.number(),
    rotation: z.number().describe("degrees"),
    opacity: z.number().min(0).max(1),
    radius: z.number().describe("corner radius px"),
    flipX: z.boolean(),
    flipY: z.boolean(),
  })
  .partial();

const AnimationPresetSpec = z.object({
  type: z.enum(ANIMATION_IN_OUT_TYPES),
  durationSec: z.number().positive(),
  easing: Easing.optional(),
  direction: Direction.optional(),
  intensity: z.number().min(0).max(4).optional(),
});

const AnimationsSpec = z
  .object({
    in: AnimationPresetSpec.nullable(),
    out: AnimationPresetSpec.nullable(),
    loop: z
      .object({
        type: z.enum(LOOP_TYPES),
        periodSec: z.number().positive().optional(),
        intensity: z.number().optional(),
        direction: Direction.optional(),
      })
      .nullable(),
  })
  .partial()
  .describe("Preset entrance/exit/loop animations (null removes)");

const TextAnimationSpec = z.object({
  type: z.enum(TEXT_ANIMATIONS),
  unit: z.enum(["char", "word", "line"]),
  staggerFrames: z.number().min(0).describe("frames between units, 2-4 feels premium"),
  durationFrames: z.number().min(1),
  easing: Easing.optional(),
  accentColor: z.string().optional(),
});

const TransitionSpec = z.object({
  type: z.enum(TRANSITION_TYPES),
  durationSec: z.number().positive(),
  direction: Direction.optional(),
  easing: Easing.optional(),
});

const ColorFill = z.union([
  z.string().describe("CSS color"),
  z.object({ type: z.literal("linear"), angle: z.number(), colors: z.array(z.string()).min(2) }),
  z.object({ type: z.literal("radial"), cx: z.number().optional(), cy: z.number().optional(), colors: z.array(z.string()).min(2) }),
]);

export const EffectSpec = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("grade"),
    exposure: z.number().optional(),
    contrast: z.number().optional().describe("1 = neutral"),
    saturation: z.number().optional().describe("1 = neutral"),
    vibrance: z.number().optional(),
    temperature: z.number().optional().describe("-1 cool .. 1 warm"),
    tint: z.number().optional(),
    highlights: z.number().optional(),
    shadows: z.number().optional(),
    fade: z.number().optional().describe("lifted blacks 0..0.4"),
    lut: z
      .string()
      .optional()
      .describe(
        "look id: film-print, teal-orange, portra, bleach-bypass, mono-noir, pastel-dream, vhs, warm-vlog, cool-doc, matte-fade, vivid-pop, golden-hour",
      ),
    lutIntensity: z.number().optional(),
  }),
  z.object({ type: z.literal("vignette"), amount: z.number() }),
  z.object({ type: z.literal("grain"), amount: z.number() }),
  z.object({ type: z.literal("blur"), radius: z.number() }),
  z.object({
    type: z.literal("glow"),
    radius: z.number(),
    intensity: z.number(),
    threshold: z.number().optional(),
    color: z.string().optional(),
  }),
  z.object({ type: z.literal("chromatic-aberration"), amount: z.number() }),
  z.object({ type: z.literal("zoom-blur"), amount: z.number() }),
  z.object({ type: z.literal("shake"), intensity: z.number(), frequency: z.number().optional() }),
  z.object({
    type: z.literal("drop-shadow"),
    radius: z.number(),
    offsetX: z.number(),
    offsetY: z.number(),
    opacity: z.number(),
    color: z.string().optional(),
  }),
  z.object({ type: z.literal("pixelate"), size: z.number() }),
  z.object({ type: z.literal("duotone"), dark: z.string(), light: z.string() }),
  z.object({ type: z.literal("grayscale"), amount: z.number() }),
  z.object({ type: z.literal("scanlines"), amount: z.number() }),
  z.object({ type: z.literal("halftone"), size: z.number() }),
]);

const TextStyleSpec = z
  .object({
    fontFamily: z.string().describe("Any Google Fonts family"),
    fontWeight: z.number(),
    fontSize: z.number().describe("px; >= 56 for headlines, >= 36 body at 1080p"),
    italic: z.boolean(),
    color: z.string(),
    gradient: z.array(z.string()).min(2).describe("gradient fill colors (left→right)"),
    align: z.enum(["left", "center", "right"]),
    lineHeight: z.number(),
    letterSpacing: z.number().describe("em, e.g. -0.03 for display type"),
    textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]),
    stroke: z.object({ color: z.string(), width: z.number() }),
    shadow: z.object({ color: z.string(), blur: z.number(), x: z.number(), y: z.number() }),
    background: z.object({ color: z.string(), paddingX: z.number(), paddingY: z.number(), radius: z.number() }),
  })
  .partial();

const clipBase = {
  startSec: sec("timeline start in seconds"),
  durationSec: sec("timeline duration in seconds"),
  trackId: z.string().optional().describe("Target track id; omit to auto-place (overlays go on top). Use 'new' to create a track."),
  name: z.string().optional().describe("Short label shown on the timeline"),
  transform: TransformSpec.optional(),
  animations: AnimationsSpec.optional(),
  transitionIn: TransitionSpec.optional().describe("Transition from the previous clip on the same track"),
  effects: z.array(EffectSpec).optional(),
  note: z.string().optional().describe("Why you made this choice (shown to the user in the inspector)"),
};

export const ClipSpec = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("video"),
    assetId: z.string(),
    trimStartSec: z.number().optional().describe("seconds skipped at the start of the source"),
    speed: z.number().optional(),
    volume: z.number().optional(),
    muted: z.boolean().optional(),
    fit: z.enum(["cover", "contain", "fill"]).optional(),
    ...clipBase,
  }),
  z.object({ type: z.literal("image"), assetId: z.string(), fit: z.enum(["cover", "contain", "fill"]).optional(), ...clipBase }),
  z.object({
    type: z.literal("audio"),
    assetId: z.string(),
    trimStartSec: z.number().optional(),
    volume: z.number().optional(),
    role: z.enum(["music", "voice", "sfx", "other"]).optional(),
    fadeInSec: z.number().optional(),
    fadeOutSec: z.number().optional(),
    duck: z.boolean().optional().describe("Music dips under speech (on by default for role music)"),
    duckDb: z.number().optional().describe("How far it dips under speech in dB (default 15; a style's duckDb)"),
    ...clipBase,
  }),
  z.object({
    type: z.literal("sfx"),
    sound: z.string().describe("Sound effect id from the SFX library (see get_project → sfxLibrary)"),
    volume: z.number().optional(),
    startSec: sec("when the sound plays"),
    trackId: z.string().optional(),
    name: z.string().optional(),
  }),
  z.object({
    type: z.literal("text"),
    text: z.string(),
    preset: z
      .string()
      .optional()
      .describe(
        "Text preset id: keynote, impact, beast, gradient, editorial, typewriter, highlight, minimal, neon, handwritten, label, scramble, stretch, wave",
      ),
    style: TextStyleSpec.optional(),
    textAnimation: TextAnimationSpec.optional(),
    ...clipBase,
  }),
  z.object({
    type: z.literal("shape"),
    shape: z.enum(SHAPE_KINDS),
    fill: ColorFill.optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
    cornerRadius: z.number().optional(),
    ...clipBase,
  }),
  z.object({ type: z.literal("background"), fill: ColorFill, ...clipBase }),
  z.object({
    type: z.literal("component"),
    component: z.string().describe("Built-in component id (see list_components) or 'code:<id>' for a code component"),
    props: z.record(z.string(), z.unknown()).optional(),
    ...clipBase,
  }),
]);
export type ClipSpecInput = z.infer<typeof ClipSpec>;

/** Partial update — every field optional. `null` removes optional fields. */
export const ClipPatchSpec = z
  .object({
    startSec: z.number(),
    durationSec: z.number(),
    trackId: z.string(),
    name: z.string(),
    text: z.string(),
    style: TextStyleSpec,
    textAnimation: TextAnimationSpec.nullable(),
    props: z.record(z.string(), z.unknown()).describe("Component props to merge"),
    transform: TransformSpec,
    animations: AnimationsSpec,
    transitionIn: TransitionSpec.nullable(),
    effects: z.array(EffectSpec).describe("Replaces all effects"),
    volume: z.number(),
    muted: z.boolean(),
    speed: z.number(),
    fit: z.enum(["cover", "contain", "fill"]),
    fill: ColorFill,
    stroke: z.string(),
    strokeWidth: z.number(),
    hidden: z.boolean(),
    note: z.string(),
  })
  .partial();

const CaptionStyleSpec = z
  .object({
    fontFamily: z.string(),
    fontWeight: z.number(),
    fontSize: z.number(),
    color: z.string(),
    activeColor: z.string(),
    activeBackground: z.string(),
    emphasisColor: z.string(),
    textTransform: z.enum(["none", "uppercase", "lowercase"]),
    animation: z.enum(CAPTION_ANIMATIONS),
    maxWordsPerPage: z.number(),
    combineMs: z.number(),
    yPct: z.number().describe("vertical center as fraction of frame height"),
  })
  .partial();

export const TOOL_SCHEMAS = {
  get_project: {
    description:
      "Read the current timeline: canvas, tracks, clips (ids, types, timing in seconds, key props), assets (ids, durations, transcripts available?) and markers. Call this first, and again after the user may have edited.",
    input: z.object({
      rangeSec: z.tuple([z.number(), z.number()]).optional().describe("Only clips overlapping this time range"),
      includeTranscripts: z.boolean().optional().describe("Include transcript text of assets (can be long)"),
    }),
  },
  get_clips: {
    description: "Full details (all properties, keyframes, effects) of specific clips.",
    input: z.object({ ids: z.array(z.string()).min(1) }),
  },
  set_plan: {
    description:
      "Show the user your step-by-step plan as a live checklist before multi-step work. Keep steps short and concrete (≤ 8). Update progress with update_plan.",
    input: z.object({
      steps: z
        .array(z.object({ title: z.string(), rangeSec: z.tuple([z.number(), z.number()]).optional() }))
        .min(1)
        .max(12),
    }),
  },
  update_plan: {
    description: "Mark a plan step as running/done/failed/skipped (0-based index).",
    input: z.object({
      index: z.number().int().min(0),
      status: z.enum(["running", "done", "failed", "skipped"]),
      note: z.string().optional(),
    }),
  },
  add_clips: {
    description:
      "Add clips to the timeline (batched). Times in seconds, positions in px (x/y = center). Returns the new clip ids. The user watches clips appear live.",
    input: z.object({ clips: z.array(ClipSpec).min(1).max(60) }),
  },
  update_clips: {
    description:
      "Change existing clips (batched partial updates). Nested objects merge (transform, style, props, animations). Clips the user hand-edited are protected: set force only after the user explicitly asked.",
    input: z.object({
      updates: z
        .array(z.object({ id: z.string(), patch: ClipPatchSpec }))
        .min(1)
        .max(60),
      force: z.boolean().optional(),
    }),
  },
  delete_clips: {
    description: "Delete clips. ripple=true closes the gap on their tracks.",
    input: z.object({ ids: z.array(z.string()).min(1), ripple: z.boolean().optional() }),
  },
  split_clip: {
    description: "Split a clip at an absolute timeline time. Returns [leftId, rightId].",
    input: z.object({ id: z.string(), atSec: z.number() }),
  },
  trim_clip: {
    description: "Move a clip's start and/or end edge (absolute timeline seconds). Media stays in place (like an NLE trim).",
    input: z.object({ id: z.string(), startSec: z.number().optional(), endSec: z.number().optional() }),
  },
  ripple_delete_range: {
    description:
      "Remove a time range from the timeline on all unlocked tracks (or given tracks) and close the gap. For cutting out sections.",
    input: z.object({ startSec: z.number(), endSec: z.number(), trackIds: z.array(z.string()).optional() }),
  },
  set_keyframes: {
    description:
      "Animate any property with keyframes. timeSec is RELATIVE to the clip start. Properties: x, y, width, height, scale, rotation, opacity, blur, volume, drawProgress, style.color, style.fontSize, props.<componentProp>. Empty keyframes removes the animation.",
    input: z.object({
      id: z.string(),
      property: z.string(),
      keyframes: z.array(z.object({ timeSec: z.number().min(0), value: z.union([z.number(), z.string()]), easing: Easing.optional() })),
    }),
  },
  set_transition: {
    description:
      "Set (or remove with null) the transition INTO a clip from the previous clip on the same track. Most cuts should stay plain cuts (load the transitions skill).",
    input: z.object({
      id: z.string(),
      transition: TransitionSpec.nullable(),
      withSound: z
        .boolean()
        .optional()
        .describe("Also place the transition's matching built-in sound (whip, whoosh, impact…) with its peak exactly on the cut"),
    }),
  },
  apply_style: {
    description:
      "Apply a Style DNA (creator/brand/genre look) deterministically: color grade + LUT, typography, caption style, entrance motion, transitions. Use a preset id (see list_styles) or pass a custom style object. Returns what changed plus the style's creative direction (pacing, hooks, signature tells) for you to follow.",
    input: z.object({
      styleId: z.string().optional(),
      custom: z.record(z.string(), z.unknown()).optional().describe("A full StyleDNA object when no preset matches"),
      parts: z
        .array(z.enum(["grade", "typography", "captions", "motion", "transitions"]))
        .optional()
        .describe("Default: all"),
      clipIds: z.array(z.string()).optional().describe("Limit to these clips"),
    }),
  },
  list_styles: {
    description:
      "List Style DNA presets (creators like MrBeast/MKBHD/Kurzgesagt, brands like Apple/Linear, genres like A24 trailer/VHS). Use query to filter.",
    input: z.object({ query: z.string().optional() }),
  },
  get_style: {
    description: "Full Style DNA of a preset: grade values, fonts, caption specs, pacing, sound, signature tells and agent notes.",
    input: z.object({ styleId: z.string() }),
  },
  list_components: {
    description: "Built-in motion components (titles, backgrounds, charts, devices, social, annotations…) with their props and defaults.",
    input: z.object({ category: z.string().optional() }),
  },
  create_component: {
    description:
      "Write a custom Remotion component (TSX) when no built-in component fits. `export default function X(props)`; drive animation ONLY with useCurrentFrame()/interpolate/spring; props.width/props.height/props.durationInFrames are provided. Allowed imports: react, remotion, @remotion/shapes, @remotion/paths, @remotion/noise, @remotion/layout-utils, @remotion/media, @remotion/rough-notation, reframer (useFonts, fontStack, progress, ease, formatNumber, random01). Expose every tweakable value in propsSchema so the user gets sliders. Returns compile errors if any.",
    input: z.object({
      name: z.string(),
      description: z.string(),
      source: z.string(),
      propsSchema: z
        .record(
          z.string(),
          z.object({
            type: z.enum(["string", "text", "number", "boolean", "color", "enum", "asset", "font"]),
            label: z.string().optional(),
            default: z.unknown(),
            min: z.number().optional(),
            max: z.number().optional(),
            step: z.number().optional(),
            options: z.array(z.string()).optional(),
          }),
        )
        .describe("Props the user can tweak"),
      place: z
        .object({
          startSec: z.number(),
          durationSec: z.number(),
          trackId: z.string().optional(),
          props: z.record(z.string(), z.unknown()).optional(),
        })
        .optional()
        .describe("Also add it to the timeline"),
    }),
  },
  update_component: {
    description: "Update a code component's source and/or props schema (fix errors, refine). Returns compile errors if any.",
    input: z.object({
      componentId: z.string(),
      source: z.string().optional(),
      propsSchema: z.record(z.string(), z.unknown()).optional(),
    }),
  },
  get_errors: {
    description: "Runtime errors from code components currently on screen. Check after creating components.",
    input: z.object({}),
  },
  add_captions: {
    description:
      "Add animated word-level captions for a video/audio clip (transcribes it first if needed — can take a while). The captions stay synced when the clip is trimmed or moved.",
    input: z.object({
      clipId: z.string(),
      preset: z.string().optional().describe("bold-pop, hormozi, beast, clean, karaoke, box, tiktok, doc, minimal, underline, typewriter"),
      style: CaptionStyleSpec.optional(),
      emphasizeKeywords: z.boolean().optional().describe("Mark key words for emphasis color"),
    }),
  },
  transcribe: {
    description: "Transcribe a video/audio asset (word timestamps). Returns the text and word count.",
    input: z.object({ assetId: z.string() }),
  },
  remove_silences: {
    description: "Cut silent gaps out of a talking clip (ripple). Requires a transcript (transcribes if needed). Returns the cuts made.",
    input: z.object({
      clipId: z.string(),
      minSilenceSec: z.number().optional().describe("Gaps longer than this are removed (default 0.6)"),
      paddingSec: z.number().optional().describe("Breathing room kept around speech (default 0.12)"),
    }),
  },
  remove_fillers: {
    description: "Cut filler words (um, uh; aggressive also removes like/you know/basically) from a talking clip.",
    input: z.object({ clipId: z.string(), aggressive: z.boolean().optional() }),
  },
  detect_beats: {
    description:
      "Analyze a music asset the way an editor listens: bpm, beat times, downbeats (bar starts), energy sections (intro/build/drop/high/mid/low/outro with 0–1 energy) and the strongest hits. Use it before cutting to music. Optionally add beat markers.",
    input: z.object({ assetId: z.string(), addMarkers: z.boolean().optional() }),
  },
  add_markers: {
    description: "Add timeline markers (notes, chapters, or flags for the user to review).",
    input: z.object({
      markers: z
        .array(z.object({ timeSec: z.number(), label: z.string(), kind: z.enum(["note", "chapter", "ai-flag", "beat"]).optional() }))
        .min(1),
    }),
  },
  set_canvas: {
    description: "Change format / frame rate / background. Changing aspect re-flows every clip automatically (one timeline, many formats).",
    input: z.object({
      aspect: z.enum(["16:9", "9:16", "1:1", "4:5"]).optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      fps: z.number().optional(),
      backgroundColor: z.string().optional(),
    }),
  },
  review_frames: {
    description:
      "Look at your work: renders frames (default: a contact sheet across the video) and runs the video linter. Use before saying you're done. Vision-capable models receive the images.",
    input: z.object({
      timesSec: z.array(z.number()).max(12).optional(),
      count: z.number().int().min(1).max(12).optional().describe("Evenly spaced frames when timesSec is omitted (default 6)"),
    }),
  },
  seek: {
    description: "Move the playhead (to show the user something).",
    input: z.object({ timeSec: z.number() }),
  },
  select_clips: {
    description: "Select clips in the editor so the user sees them in the inspector.",
    input: z.object({ ids: z.array(z.string()) }),
  },
  ask_user: {
    description:
      "Ask the user a short question with clickable options (always include a sensible default first). Use only for genuine taste decisions or missing info.",
    input: z.object({ question: z.string(), options: z.array(z.string()).min(2).max(5) }),
  },
  import_media: {
    description:
      "Download media from a URL into the project (images, video, audio). For search_audio results pass name, license and credit so the credits are kept. Returns the asset id.",
    input: z.object({
      url: z.string().url(),
      name: z.string().optional(),
      license: z.string().optional().describe('License from search_audio, e.g. "CC BY 4.0"'),
      credit: z.string().optional().describe("Credit line from search_audio (required for CC BY)"),
    }),
  },
  search_audio: {
    description:
      "Search real, free-to-use music (Kevin MacLeod, Jamendo) and recorded sound effects (Freesound). Returns candidates with duration, tags, license and credit line; import the chosen one with import_media. Never synthesize music or fake a sound you can find recorded.",
    input: z.object({
      kind: z.enum(["music", "sfx"]),
      query: z
        .string()
        .describe(
          'Music: mood + genre + instrument words, e.g. "uplifting electronic", "tense cinematic", "calm piano", "lofi hip hop". SFX: the exact sound, e.g. "camera shutter", "mechanical keyboard typing", "cash register", "crowd cheer".',
        ),
      minSec: z.number().optional().describe("Shortest acceptable length in seconds (music: about the video length)"),
      maxSec: z.number().optional(),
    }),
  },
  search_stock: {
    description:
      "Search free stock footage/photos (Pexels). Returns candidates with ids, previews and URLs to pass to import_media. Requires a Pexels key in settings.",
    input: z.object({
      query: z.string(),
      type: z.enum(["video", "photo"]).optional(),
      orientation: z.enum(["landscape", "portrait", "square"]).optional(),
    }),
  },
  generate_image: {
    description: "Generate an image with the user's image model (backgrounds, b-roll stills, illustrations). Returns the new asset id.",
    input: z.object({ prompt: z.string(), aspect: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4"]).optional() }),
  },
  generate_voiceover: {
    description:
      "Text-to-speech voiceover with the user's speech model. Adds the audio as an asset (and optionally to the timeline). Returns asset id and duration.",
    input: z.object({
      text: z.string(),
      voice: z.string().optional(),
      startSec: z.number().optional().describe("Also place it on the timeline at this time"),
    }),
  },
  set_brand: {
    description: "Set the brand kit (colors, fonts, logo asset) that styles should follow.",
    input: z.object({
      name: z.string().optional(),
      colors: z
        .object({
          primary: z.string(),
          secondary: z.string().optional(),
          accent: z.string().optional(),
          background: z.string(),
          text: z.string(),
        })
        .optional(),
      fonts: z.object({ heading: z.string(), body: z.string() }).optional(),
      logoAssetId: z.string().optional(),
    }),
  },
  load_skill: {
    description:
      "Load a skill (expert playbook) by name before tackling that kind of video. Available skills are listed in your instructions.",
    input: z.object({ name: z.string() }),
  },
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

/** Tools that run on the server (no editor state needed). Everything else runs in the editor. */
export const SERVER_TOOLS = new Set<ToolName>(["load_skill"]);

/** Tools the user must answer in the UI. */
export const INTERACTIVE_TOOLS = new Set<ToolName>(["ask_user"]);

export type ToolInput<T extends ToolName> = z.infer<(typeof TOOL_SCHEMAS)[T]["input"]>;
