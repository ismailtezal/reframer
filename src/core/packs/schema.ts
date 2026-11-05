import { z } from "zod";
import { CaptionStyleSchema } from "../schema/clip";

/**
 * Style packs: a look you can make films in, shipped as one folder (`public/packs/<id>/`).
 *
 *   pack.json   this manifest: identity, engine, template inputs, edit defaults, credits
 *   GUIDE.md    the style's rules for whoever makes a film in it (an agent or a person)
 *   film/       the engine's files; for a "page" engine, film/index.html follows the page contract
 *   poster.jpg  a still for galleries
 *
 * A pack is meant to be read by other hosts too (a template gallery that shows the poster and the
 * preview, builds a form from `inputs` and renders the film): nothing in the folder depends on
 * Reframer except `edit`, the defaults for the voice, music and captions Reframer lays on top.
 *
 * Engines:
 * - page: a web page that draws second `t` itself when asked (`window.render(t)`, `window.DUR`,
 *   `window.READY`) and reads its template inputs from `window.PACK_INPUTS`. Reframer plays it in
 *   the timeline as a `page-film` clip; any headless browser can render it.
 * - remotion-kit: a module code components import (e.g. `reframer/toon3d`); the guide says how.
 * - ai-keyframes: stills from an image model, moved and cut in the timeline; the guide holds the
 *   prompt recipe.
 * - blender: scenes built and rendered by Blender scripts.
 */

export const PACK_ENGINE_KINDS = ["page", "remotion-kit", "ai-keyframes", "blender"] as const;
export type PackEngineKind = (typeof PACK_ENGINE_KINDS)[number];

export const PACK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,47}$/;

export const PackInputSchema = z
  .object({
    /** Key the film reads from `window.PACK_INPUTS`. */
    key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    type: z.enum(["string", "text", "number", "boolean", "color", "enum", "list"]),
    /** Form label in the audience's language. */
    label: z.string().min(1),
    labelEn: z.string().optional(),
    help: z.string().optional(),
    default: z.unknown(),
    required: z.boolean().optional(),
    /** Longest text (or list item) the layout was designed for. */
    maxLength: z.number().int().positive().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(z.string()).optional(),
    /** Most items a "list" takes. */
    maxItems: z.number().int().positive().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.type === "enum" && !input.options?.length)
      ctx.addIssue({ code: "custom", message: `Input "${input.key}" is an enum without options` });
  });
export type PackInput = z.infer<typeof PackInputSchema>;

/** The page of a "page" engine, relative to the pack folder (a fixed place, so hosts need no lookup). */
export const PAGE_FILM_ENTRY = "film/index.html";

const PageEngineSchema = z.object({
  kind: z.literal("page"),
  /** The size the film lays itself out for. Its clip box should have the same aspect. */
  size: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  /** Length in seconds when the inputs don't change it (the page's own `window.DUR` is the truth). */
  durationSec: z.number().positive().optional(),
  /** What the film calls on its host (e.g. "webgl2"); hosts that can't provide them skip the pack. */
  needs: z.array(z.string()).optional(),
});

const KitEngineSchema = z.object({
  kind: z.literal("remotion-kit"),
  /** Import name in code components, e.g. "reframer/toon3d". */
  module: z.string(),
});

const KeyframesEngineSchema = z.object({
  kind: z.literal("ai-keyframes"),
  /** The image model the prompt recipe was tuned on. */
  imageModel: z.string().optional(),
});

const BlenderEngineSchema = z.object({
  kind: z.literal("blender"),
  /** Entry script, relative to the pack folder. */
  script: z.string().optional(),
});

export const PackEngineSchema = z.discriminatedUnion("kind", [
  PageEngineSchema,
  KitEngineSchema,
  KeyframesEngineSchema,
  BlenderEngineSchema,
]);
export type PackEngine = z.infer<typeof PackEngineSchema>;

/** Defaults for what Reframer lays over the picture. Everything is optional: a guide can say it instead. */
export const PackEditSchema = z.object({
  voice: z
    .object({
      /** ElevenLabs voice id. */
      voiceId: z.string().optional(),
      model: z.string().optional(),
      /** How the narration should sound and be written. */
      direction: z.string().optional(),
    })
    .optional(),
  /** Prompt for a generated instrumental bed. */
  music: z.object({ prompt: z.string() }).optional(),
  /** Prompts for sound effects that belong to the style. */
  sfx: z.array(z.string()).optional(),
  captions: z
    .object({
      style: CaptionStyleSchema.partial(),
      /** Center line of the captions in canvas px (1920-high canvas for 9:16). */
      y: z.number().optional(),
    })
    .optional(),
  /** A Style DNA preset (`reframer styles`) that fits on top. */
  styleId: z.string().optional(),
});
export type PackEdit = z.infer<typeof PackEditSchema>;

export const PackCreditSchema = z.object({
  name: z.string(),
  url: z.string().url().optional(),
  /** SPDX id or a short licence name, e.g. "MIT", "CC-BY-4.0". */
  license: z.string(),
  note: z.string().optional(),
});

/**
 * A moment the film is built around: where a narration line starts and a sound lands. Films with a
 * fixed timeline list them so a template can voice each line on its beat.
 */
export const PackBeatSchema = z.object({
  atSec: z.number().min(0),
  /** What happens on screen then. */
  label: z.string(),
  /** The input whose text is spoken from here (a narration line). */
  say: z.string().optional(),
  /** Longest that line may run before the next beat, in seconds. */
  maxSec: z.number().positive().optional(),
  /** A sound effect that lands here (a prompt or a library id). */
  sfx: z.string().optional(),
});
export type PackBeat = z.infer<typeof PackBeatSchema>;

const PackManifestBaseSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(PACK_ID_PATTERN),
  name: z.string().min(1),
  /** One or two sentences: what it looks like and what it's good for. */
  description: z.string().min(1),
  tags: z.array(z.string()).default([]),
  formats: z.array(z.enum(["9:16", "16:9", "1:1", "4:5"])).min(1),
  durationSec: z.object({ min: z.number().positive(), typical: z.number().positive(), max: z.number().positive() }),
  engine: PackEngineSchema,
  /** The guide, relative to the pack folder. */
  guide: z.string().default("GUIDE.md"),
  /** Gallery still, relative to the pack folder or a URL. */
  poster: z.string().optional(),
  /** Preview video, relative to the pack folder or a URL. */
  preview: z.string().optional(),
  inputs: z.array(PackInputSchema).default([]),
  beats: z.array(PackBeatSchema).default([]),
  edit: PackEditSchema.default({}),
  credits: z.array(PackCreditSchema).default([]),
});

export const PackManifestSchema = PackManifestBaseSchema.superRefine((m, ctx) => {
  const keys = new Set<string>();
  for (const input of m.inputs) {
    if (keys.has(input.key)) ctx.addIssue({ code: "custom", path: ["inputs"], message: `Input "${input.key}" is listed twice` });
    keys.add(input.key);
  }
  for (const [i, beat] of m.beats.entries())
    if (beat.say && !keys.has(beat.say))
      ctx.addIssue({ code: "custom", path: ["beats", i, "say"], message: `Beat says "${beat.say}", which is not an input` });
  const d = m.durationSec;
  if (!(d.min <= d.typical && d.typical <= d.max))
    ctx.addIssue({ code: "custom", path: ["durationSec"], message: "Expected min ≤ typical ≤ max" });
});
export type PackManifest = z.infer<typeof PackManifestSchema>;
