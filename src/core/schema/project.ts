import { z } from "zod";
import { CaptionWordSchema, ClipSchema } from "./clip";
import { ColorSchema } from "./primitives";

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export const AssetTypeSchema = z.enum(["video", "audio", "image", "lut"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetAnalysisSchema = z.object({
  /** Seconds where hard cuts happen (reference-video analysis). */
  sceneCuts: z.array(z.number()).optional(),
  /** Seconds of detected beats (music). */
  beats: z.array(z.number()).optional(),
  bpm: z.number().optional(),
  /** Integrated loudness, LUFS-ish estimate. */
  loudness: z.number().optional(),
  /** Silent ranges in seconds [start, end]. */
  silences: z.array(z.tuple([z.number(), z.number()])).optional(),
  /** Dominant colors (hex), most dominant first. */
  palette: z.array(z.string()).optional(),
  colorStats: z
    .object({
      brightness: z.number(),
      contrast: z.number(),
      saturation: z.number(),
      warmth: z.number(),
    })
    .optional(),
});
export type AssetAnalysis = z.infer<typeof AssetAnalysisSchema>;

export const TranscriptSchema = z.object({
  language: z.string().optional(),
  /** Word-level timing in SOURCE media milliseconds. */
  words: z.array(CaptionWordSchema),
  text: z.string(),
  engine: z.string().optional(),
});
export type Transcript = z.infer<typeof TranscriptSchema>;

export const AssetSchema = z.object({
  id: z.string(),
  type: AssetTypeSchema,
  name: z.string(),
  /** URL the browser and renderer load the file from (relative to app origin). */
  src: z.string(),
  mimeType: z.string(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSec: z.number().optional(),
  fps: z.number().optional(),
  hasAudio: z.boolean().optional(),
  /** Small poster image URL / data URL. */
  thumbnail: z.string().optional(),
  /** Normalised peak amplitudes (0..1) at ~50 samples per second. */
  waveform: z.array(z.number()).optional(),
  transcript: TranscriptSchema.optional(),
  analysis: AssetAnalysisSchema.optional(),
  source: z.enum(["upload", "stock", "generated", "url", "builtin"]),
  /** For generated / stock assets. */
  origin: z
    .object({
      provider: z.string().optional(),
      prompt: z.string().optional(),
      model: z.string().optional(),
      url: z.string().optional(),
      attribution: z.string().optional(),
    })
    .optional(),
  createdAt: z.number(),
});
export type Asset = z.infer<typeof AssetSchema>;

// ---------------------------------------------------------------------------
// Tracks & markers
// ---------------------------------------------------------------------------

export const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["visual", "audio"]),
  muted: z.boolean(),
  hidden: z.boolean(),
  /** Locked tracks cannot be edited by humans OR agents. */
  locked: z.boolean(),
  /** Magnetic tracks close gaps automatically (CapCut "main track"). */
  magnetic: z.boolean().optional(),
});
export type Track = z.infer<typeof TrackSchema>;

export const MarkerSchema = z.object({
  id: z.string(),
  frame: z.number().int().min(0),
  label: z.string(),
  color: ColorSchema.optional(),
  kind: z.enum(["note", "beat", "chapter", "ai-flag"]),
});
export type Marker = z.infer<typeof MarkerSchema>;

// ---------------------------------------------------------------------------
// Brand kit & code components
// ---------------------------------------------------------------------------

export const BrandKitSchema = z.object({
  name: z.string().optional(),
  colors: z.object({
    primary: ColorSchema,
    secondary: ColorSchema.optional(),
    accent: ColorSchema.optional(),
    background: ColorSchema,
    text: ColorSchema,
  }),
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  logoAssetId: z.string().optional(),
  website: z.string().optional(),
  voice: z.string().optional(),
});
export type BrandKit = z.infer<typeof BrandKitSchema>;

/** A field in a code component's props schema (drives the auto-generated tweak panel). */
export const PropFieldSchema = z.object({
  type: z.enum(["string", "text", "number", "boolean", "color", "enum", "asset", "font"]),
  label: z.string().optional(),
  default: z.unknown(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  options: z.array(z.string()).optional(),
  description: z.string().optional(),
});
export type PropField = z.infer<typeof PropFieldSchema>;

export const CodeComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  /** TSX source with a default export. */
  source: z.string(),
  propsSchema: z.record(z.string(), PropFieldSchema),
  /** Suggested duration in frames. */
  durationHint: z.number().int().optional(),
  createdBy: z.enum(["user", "ai", "agent"]),
  updatedAt: z.number(),
});
export type CodeComponent = z.infer<typeof CodeComponentSchema>;

// ---------------------------------------------------------------------------
// Storyboard (plan-mode output)
// ---------------------------------------------------------------------------

export const StoryboardSceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** seconds */
  duration: z.number(),
  visual: z.string(),
  voiceover: z.string().optional(),
  onScreenText: z.string().optional(),
  status: z.enum(["planned", "building", "done"]).optional(),
});
export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const PROJECT_FORMAT_VERSION = 1;

export const ProjectSettingsSchema = z.object({
  width: z.number().int().min(16).max(7680),
  height: z.number().int().min(16).max(7680),
  fps: z.number().int().min(1).max(120),
  backgroundColor: ColorSchema,
  /** Fixed duration override in frames. When unset, duration = end of last clip. */
  durationInFrames: z.number().int().min(1).optional(),
});
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

export const ProjectSchema = z.object({
  formatVersion: z.literal(PROJECT_FORMAT_VERSION),
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  settings: ProjectSettingsSchema,
  /** Index 0 is the TOP track (drawn in front). */
  tracks: z.array(TrackSchema),
  clips: z.record(z.string(), ClipSchema),
  assets: z.record(z.string(), AssetSchema),
  markers: z.array(MarkerSchema),
  components: z.record(z.string(), CodeComponentSchema),
  brand: BrandKitSchema.optional(),
  /** Id of the active Style DNA (see core/styles). */
  styleId: z.string().optional(),
  brief: z
    .object({
      prompt: z.string(),
      storyboard: z.array(StoryboardSceneSchema).optional(),
    })
    .optional(),
});
export type Project = z.infer<typeof ProjectSchema>;
