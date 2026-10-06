import type { CaptionStyle } from "./schema";

export type CaptionPreset = {
  id: string;
  name: string;
  description: string;
  /** Font size at a 1080px short side; scaled on apply. */
  style: Omit<CaptionStyle, "preset">;
};

/**
 * Caption looks. Sizes are for a 1080px short side and are scaled to the
 * project when applied. "Inspired by" names describe a style, not affiliation.
 */
export const CAPTION_PRESETS: CaptionPreset[] = [
  {
    id: "bold-pop",
    name: "Bold pop",
    description: "Big uppercase words, yellow active word, springy pop. The default for shorts.",
    style: {
      fontFamily: "Montserrat",
      fontWeight: 800,
      fontSize: 72,
      color: "#FFFFFF",
      activeColor: "#FFE14D",
      textTransform: "uppercase",
      stroke: { color: "#000000", width: 6 },
      shadow: { color: "rgba(0,0,0,0.6)", blur: 12, x: 0, y: 4 },
      animation: "pop",
      combineMs: 600,
      maxWordsPerPage: 3,
      lineHeight: 1.05,
    },
  },
  {
    id: "hormozi",
    name: "Hormozi-style",
    description: "Heavy Montserrat Black, 1–3 words, one keyword in yellow/green, thick outline.",
    style: {
      fontFamily: "Montserrat",
      fontWeight: 900,
      fontSize: 92,
      color: "#FFFFFF",
      activeColor: "#FFFFFF",
      emphasisColor: "#FFD93D",
      textTransform: "uppercase",
      stroke: { color: "#000000", width: 10 },
      shadow: { color: "rgba(0,0,0,0.9)", blur: 0, x: 0, y: 5 },
      animation: "pop",
      combineMs: 450,
      maxWordsPerPage: 3,
      lineHeight: 1,
      letterSpacing: -0.01,
    },
  },
  {
    id: "beast",
    name: "MrBeast-style",
    description: "Comic-bold font, thick black stroke, saturated active color, bouncy.",
    style: {
      fontFamily: "Bangers",
      fontWeight: 400,
      fontSize: 110,
      color: "#FFFFFF",
      activeColor: "#FFD700",
      emphasisColor: "#3CFF7A",
      textTransform: "uppercase",
      stroke: { color: "#000000", width: 10 },
      shadow: { color: "rgba(0,0,0,0.7)", blur: 6, x: 0, y: 6 },
      animation: "bounce",
      combineMs: 500,
      maxWordsPerPage: 2,
      lineHeight: 1,
      letterSpacing: 0.02,
      showEmoji: true,
    },
  },
  {
    id: "clean",
    name: "Clean",
    description: "Sentence case, soft shadow, calm fade. Talking-head and educational content.",
    style: {
      fontFamily: "Inter",
      fontWeight: 700,
      fontSize: 58,
      color: "#FFFFFF",
      activeColor: "#FFFFFF",
      textTransform: "none",
      shadow: { color: "rgba(0,0,0,0.65)", blur: 18, x: 0, y: 3 },
      animation: "fade",
      combineMs: 1400,
      maxWordsPerPage: 6,
      lineHeight: 1.2,
    },
  },
  {
    id: "karaoke",
    name: "Karaoke fill",
    description: "Words fill with color as they are spoken. Great for lyrics and music.",
    style: {
      fontFamily: "Montserrat",
      fontWeight: 800,
      fontSize: 70,
      color: "rgba(255,255,255,0.45)",
      activeColor: "#FFFFFF",
      textTransform: "uppercase",
      shadow: { color: "rgba(0,0,0,0.5)", blur: 14, x: 0, y: 3 },
      animation: "karaoke",
      combineMs: 1200,
      maxWordsPerPage: 5,
      lineHeight: 1.1,
    },
  },
  {
    id: "box",
    name: "Highlight box",
    description: "Active word sits in a colored pill. Modern, legible, brandable.",
    style: {
      fontFamily: "Inter",
      fontWeight: 800,
      fontSize: 66,
      color: "#FFFFFF",
      activeColor: "#FFFFFF",
      activeBackground: "#7C3AED",
      textTransform: "none",
      shadow: { color: "rgba(0,0,0,0.55)", blur: 12, x: 0, y: 3 },
      animation: "highlight-box",
      combineMs: 900,
      maxWordsPerPage: 4,
      lineHeight: 1.15,
    },
  },
  {
    id: "tiktok",
    name: "TikTok outline",
    description: "Classic white text with black outline, quick word groups.",
    style: {
      fontFamily: "Figtree",
      fontWeight: 800,
      fontSize: 68,
      color: "#FFFFFF",
      activeColor: "#FE2C55",
      textTransform: "none",
      stroke: { color: "#000000", width: 5 },
      animation: "pop",
      combineMs: 700,
      maxWordsPerPage: 3,
      lineHeight: 1.05,
    },
  },
  {
    id: "doc",
    name: "Documentary subtitle",
    description: "Small, two lines, translucent bar. Interviews, docs, accessibility.",
    style: {
      fontFamily: "Inter",
      fontWeight: 500,
      fontSize: 40,
      color: "#FFFFFF",
      activeColor: "#FFFFFF",
      textTransform: "none",
      background: { color: "rgba(0,0,0,0.6)", padding: 14, radius: 8 },
      animation: "none",
      combineMs: 2600,
      maxWordsPerPage: 12,
      lineHeight: 1.3,
    },
  },
  {
    id: "minimal",
    name: "Minimal lowercase",
    description: "Small lowercase phrases with blur-fade. Aesthetic, essay, Dan-Koe-like.",
    style: {
      fontFamily: "Inter",
      fontWeight: 500,
      fontSize: 48,
      color: "#F4F4F5",
      activeColor: "#FFFFFF",
      textTransform: "lowercase",
      shadow: { color: "rgba(255,255,255,0.25)", blur: 18, x: 0, y: 0 },
      animation: "slide-up",
      combineMs: 1600,
      maxWordsPerPage: 6,
      lineHeight: 1.25,
    },
  },
  {
    id: "underline",
    name: "Underline",
    description: "Active word underlined in an accent color.",
    style: {
      fontFamily: "Poppins",
      fontWeight: 700,
      fontSize: 64,
      color: "#FFFFFF",
      activeColor: "#22D3EE",
      textTransform: "none",
      shadow: { color: "rgba(0,0,0,0.6)", blur: 14, x: 0, y: 3 },
      animation: "underline",
      combineMs: 1000,
      maxWordsPerPage: 4,
      lineHeight: 1.2,
    },
  },
  {
    id: "typewriter",
    name: "Typewriter",
    description: "Monospace words appear exactly as they are spoken.",
    style: {
      fontFamily: "JetBrains Mono",
      fontWeight: 600,
      fontSize: 52,
      color: "#E5E7EB",
      activeColor: "#A7F3D0",
      textTransform: "none",
      background: { color: "rgba(0,0,0,0.55)", padding: 12, radius: 6 },
      animation: "typewriter",
      combineMs: 1500,
      maxWordsPerPage: 6,
      lineHeight: 1.3,
    },
  },
];

export const getCaptionPreset = (id: string) => CAPTION_PRESETS.find((p) => p.id === id);

/** Scales a preset to a canvas (sizes are authored at a 1080px short side). */
export const scaledCaptionStyle = (preset: CaptionPreset, canvas: { width: number; height: number }): CaptionStyle => {
  const unit = Math.min(canvas.width, canvas.height) / 1080;
  const s = preset.style;
  return {
    ...s,
    preset: preset.id,
    fontSize: Math.round(s.fontSize * unit),
    stroke: s.stroke ? { ...s.stroke, width: Math.max(1, Math.round(s.stroke.width * unit)) } : undefined,
    shadow: s.shadow ? { ...s.shadow, blur: s.shadow.blur * unit, y: s.shadow.y * unit, x: s.shadow.x * unit } : undefined,
    background: s.background ? { ...s.background, padding: s.background.padding * unit, radius: s.background.radius * unit } : undefined,
  };
};
