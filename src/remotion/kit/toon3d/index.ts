import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { AITerminal } from "./ai";
import { Card, contactBlob } from "./card";
import { BOSS, type BossState, drawBoss, drawCoworker } from "./chars/cast";
import { drawFace, FACES, type Face } from "./chars/face";
import { drawMehmet, MEHMET, MEHMET_DEFAULT, type MehmetState } from "./chars/mehmet";
import * as pen from "./chars/pen";
import { buildCity } from "./city";
import * as film from "./film";
import { Fx, G, GLYPHS } from "./fx";
import { blendPreset, type LightPreset, PRESETS, Rig } from "./lights";
import { buildOffice } from "./office";
import {
  bookSpine,
  canvasTex,
  clockFace,
  keyboardTex,
  neonTex,
  paperEdgeTex,
  posterTex,
  prDocTex,
  rug,
  skyline,
  wallPaint,
  whiteboardTex,
  woodFloor,
} from "./paint";
import { NOINK, Pipeline } from "./pipeline";
import { drawAIFace, drawCode, drawError, drawFixed, Screen } from "./screens";
import { CardMaterial, glow, TOON, toon } from "./toon";

export * from "./film";
export type { LightPreset, Face, MehmetState as HeroState, BossState };

/** A preset with overrides (practical lights for your own set, a warmer key, a different sky…). */
export const light = (base: keyof typeof PRESETS | LightPreset, over: Partial<LightPreset> = {}): LightPreset => ({
  ...(typeof base === "string" ? PRESETS[base] : base),
  ...over,
});

/** A face from the library with overrides: face("shock", { sweat: 0.9 }). */
export const face = (name: string, over: Partial<Face> = {}): Face => ({ ...FACES[name], ...over });

type HeroPalette = typeof MEHMET;
type BossPalette = typeof BOSS;

/**
 * Draws the hero character (young person: hair, glasses, hoodie, jeans; poses type, mug, scratch, panic, slump,
 * sleep, back, stand, lookUp) in any palette, so one rig makes many different people.
 */
export const drawHero = (ctx: CanvasRenderingContext2D, st: Partial<MehmetState>, palette: Partial<HeroPalette> = {}) => {
  const saved = { ...MEHMET };
  Object.assign(MEHMET, palette);
  try {
    drawMehmet(ctx, { ...MEHMET_DEFAULT, ...st });
  } finally {
    Object.assign(MEHMET, saved);
  }
};

/** Draws the boss figure (standing adult; poses idle, point, open, thumbs) in any palette. */
export const drawElder = (ctx: CanvasRenderingContext2D, st: BossState, palette: Partial<BossPalette> = {}) => {
  const saved = { ...BOSS };
  Object.assign(BOSS, palette);
  try {
    drawBoss(ctx, st);
  } finally {
    Object.assign(BOSS, saved);
  }
};

/** Everything a toon 3D film component imports from "reframer/toon3d". */
export const toon3dModule = {
  // film + camera grammar
  ...film,
  // look
  Pipeline,
  NOINK,
  TOON,
  toon,
  glow,
  CardMaterial,
  // light
  Rig,
  PRESETS,
  blendPreset,
  light,
  // world building
  RoundedBoxGeometry,
  canvasTex,
  woodFloor,
  rug,
  wallPaint,
  skyline,
  keyboardTex,
  clockFace,
  whiteboardTex,
  neonTex,
  posterTex,
  bookSpine,
  prDocTex,
  paperEdgeTex,
  // characters on cards
  Card,
  contactBlob,
  pen,
  drawFace,
  FACES,
  face,
  drawHero,
  HERO_DEFAULT: MEHMET_DEFAULT,
  HERO_PALETTE: { ...MEHMET },
  drawElder,
  ELDER_PALETTE: { ...BOSS },
  drawCoworker,
  // screens and the screen character
  Screen,
  drawCode,
  drawError,
  drawFixed,
  drawAIFace,
  AITerminal,
  // effects
  Fx,
  G,
  GLYPHS,
  // ready-made sets (examples to learn from or reuse, not the style itself)
  buildOffice,
  buildCity,
};
