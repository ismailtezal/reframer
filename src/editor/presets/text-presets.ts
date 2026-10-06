import type { ClipAnimations, TextAnimation, TextStyle } from "@/core/schema";

export type TextPreset = {
  id: string;
  name: string;
  sample: string;
  /** Font size at 1080p (scaled to the canvas on insert). */
  style: Partial<TextStyle> & { fontFamily: string };
  textAnimation?: TextAnimation;
  animations?: ClipAnimations;
};

/**
 * Curated text looks. Each is a starting point: the inspector exposes every
 * value, and agents use the same presets by id.
 */
export const TEXT_PRESETS: TextPreset[] = [
  {
    id: "keynote",
    name: "Keynote headline",
    sample: "Pro. Beyond.",
    style: { fontFamily: "Inter Tight", fontWeight: 700, fontSize: 120, letterSpacing: -0.035, color: "#F5F5F7" },
    textAnimation: { type: "rise-blur", unit: "word", stagger: 3, duration: 22 },
    animations: { out: { type: "blur", duration: 12 } },
  },
  {
    id: "impact",
    name: "Impact",
    sample: "NO WAY.",
    style: { fontFamily: "Anton", fontWeight: 400, fontSize: 150, letterSpacing: 0, textTransform: "uppercase", color: "#FFFFFF" },
    textAnimation: { type: "slam", unit: "word", stagger: 4, duration: 10 },
  },
  {
    id: "beast",
    name: "Callout",
    sample: "$1,000,000",
    style: {
      fontFamily: "Bangers",
      fontWeight: 400,
      fontSize: 130,
      letterSpacing: 0.02,
      textTransform: "uppercase",
      color: "#FFD700",
      stroke: { color: "#000000", width: 10 },
      shadow: { color: "rgba(0,0,0,0.6)", blur: 8, x: 0, y: 6 },
    },
    animations: { in: { type: "pop", duration: 14 }, loop: { type: "pulse", period: 40, intensity: 0.6 } },
  },
  {
    id: "gradient",
    name: "Gradient",
    sample: "Ship faster",
    style: {
      fontFamily: "Plus Jakarta Sans",
      fontWeight: 800,
      fontSize: 120,
      letterSpacing: -0.03,
      color: "#FFFFFF",
      gradient: {
        type: "linear",
        angle: 100,
        stops: [
          { color: "#C4B5FD", pos: 0 },
          { color: "#60A5FA", pos: 1 },
        ],
      },
    },
    textAnimation: { type: "rise", unit: "word", stagger: 3, duration: 18 },
  },
  {
    id: "editorial",
    name: "Editorial serif",
    sample: "A quieter way to work",
    style: { fontFamily: "Instrument Serif", fontWeight: 400, fontSize: 110, letterSpacing: -0.01, italic: true, color: "#F4EFE6" },
    textAnimation: { type: "mask-up", unit: "line", stagger: 6, duration: 22 },
  },
  {
    id: "typewriter",
    name: "Typewriter",
    sample: "npm create reframer",
    style: { fontFamily: "JetBrains Mono", fontWeight: 500, fontSize: 56, letterSpacing: 0, color: "#E5E7EB", align: "left" },
    textAnimation: { type: "typewriter", unit: "char", stagger: 2, duration: 1 },
  },
  {
    id: "highlight",
    name: "Marker highlight",
    sample: "This changes everything",
    style: { fontFamily: "Inter", fontWeight: 800, fontSize: 84, letterSpacing: -0.02, color: "#111111" },
    textAnimation: { type: "highlight", unit: "word", stagger: 5, duration: 14, accentColor: "#FDE047" },
  },
  {
    id: "minimal",
    name: "Minimal subtitle",
    sample: "Designed for focus.",
    style: { fontFamily: "Inter", fontWeight: 500, fontSize: 52, letterSpacing: -0.01, color: "rgba(255,255,255,0.78)" },
    textAnimation: { type: "fade", unit: "word", stagger: 2, duration: 16 },
  },
  {
    id: "neon",
    name: "Neon",
    sample: "OPEN LATE",
    style: {
      fontFamily: "Monoton",
      fontWeight: 400,
      fontSize: 120,
      letterSpacing: 0.04,
      color: "#FDE7FF",
      shadow: { color: "#F0ABFC", blur: 28, x: 0, y: 0 },
    },
    animations: { in: { type: "glitch", duration: 16 }, loop: { type: "breathe", period: 60 } },
  },
  {
    id: "handwritten",
    name: "Handwritten",
    sample: "remember this",
    style: { fontFamily: "Caveat", fontWeight: 700, fontSize: 110, letterSpacing: 0, color: "#FFFFFF" },
    textAnimation: { type: "rise", unit: "word", stagger: 4, duration: 14 },
  },
  {
    id: "label",
    name: "Label box",
    sample: "Episode 12",
    style: {
      fontFamily: "Inter",
      fontWeight: 600,
      fontSize: 44,
      letterSpacing: 0,
      color: "#0A0A0A",
      background: { color: "#FFFFFF", paddingX: 22, paddingY: 10, radius: 12 },
    },
    animations: { in: { type: "wipe", duration: 14, direction: "right" } },
  },
  {
    id: "scramble",
    name: "Decode",
    sample: "ACCESS GRANTED",
    style: {
      fontFamily: "Space Grotesk",
      fontWeight: 700,
      fontSize: 90,
      letterSpacing: 0.04,
      textTransform: "uppercase",
      color: "#A7F3D0",
    },
    textAnimation: { type: "scramble", unit: "char", stagger: 1, duration: 14 },
  },
  {
    id: "stretch",
    name: "Stretch",
    sample: "BOUNCE",
    style: {
      fontFamily: "Archivo Black",
      fontWeight: 400,
      fontSize: 140,
      letterSpacing: -0.02,
      textTransform: "uppercase",
      color: "#FB7185",
    },
    textAnimation: { type: "stretch", unit: "char", stagger: 2, duration: 14 },
  },
  {
    id: "wave",
    name: "Wave",
    sample: "good vibes",
    style: { fontFamily: "Fredoka", fontWeight: 700, fontSize: 110, letterSpacing: 0, color: "#FDE68A" },
    textAnimation: { type: "wave", unit: "char", stagger: 2, duration: 14 },
  },
];

export const getTextPreset = (id: string) => TEXT_PRESETS.find((p) => p.id === id);
