import * as THREE from "three";
import type { Grade } from "./pipeline";

/**
 * Light presets per time of day / mood. The key is the one directional light (window sun, moonlight); its colour and
 * the coloured shade are the two tones of every world surface (toon.ts). Point lights are practicals: the desk lamp,
 * screen glow, the neon, the alarm. Cards take a tint and a side glow from the same preset, so the cast belongs to the
 * light. Grades are display-referred and gentle: lifted, coloured blacks, a soft S, a vignette.
 */
export type V3 = [number, number, number];
export type PointSpec = { pos: V3; color: string; intensity: number; distance: number };
export type LightPreset = {
  keyDir: V3;
  keyColor: string;
  keyI: number;
  shade: string;
  shadeK: number;
  points: PointSpec[];
  sky: "morning" | "night" | "dawn";
  skyGain: number;
  lamps: number;
  exposure: number;
  bloom: number;
  grade: Grade;
  cardTint: string;
  cardGain: number;
  cardGrad: number;
  cardGlow: string;
  cardGlowK: number;
  clear: string;
};

const G_DAY: Grade = { contrast: 0.22, lift: 0.035, sat: [1.0, 1.12, 1.04], shadowTint: [0.012, -0.004, 0.03], highTint: [0.012, 0.004, -0.012], vignette: [0.2, 0.55] };
const G_NIGHT: Grade = { contrast: 0.26, lift: 0.04, sat: [1.1, 1.18, 1.05], shadowTint: [0.004, -0.006, 0.04], highTint: [0.0, 0.006, 0.012], vignette: [0.28, 0.45] };
const G_DAWN: Grade = { contrast: 0.2, lift: 0.04, sat: [1.05, 1.14, 1.05], shadowTint: [0.02, -0.01, 0.035], highTint: [0.018, 0.004, -0.014], vignette: [0.22, 0.5] };

// Practicals around Mehmet's desk (desk at the origin, he sits at z ≈ −0.75 facing +z).
const DESK_LAMP: PointSpec = { pos: [0.62, 1.18, -0.3], color: "#ffb26b", intensity: 2.2, distance: 5 };
const MONITOR_GLOW: PointSpec = { pos: [0.3, 1.12, -0.25], color: "#86d8ff", intensity: 1.4, distance: 3 };
const AI_GLOW: PointSpec = { pos: [-0.42, 1.05, 0.35], color: "#6ff6ff", intensity: 1.3, distance: 3 };
const NEON: PointSpec = { pos: [-2.8, 2.4, -8.0], color: "#ff4fd8", intensity: 6, distance: 9 };
const OFF: PointSpec = { pos: [0, -50, 0], color: "#000000", intensity: 0, distance: 1 };

export const PRESETS: Record<string, LightPreset> = {
  morning: {
    keyDir: [-0.55, 0.62, -0.56],
    keyColor: "#ffd9a6",
    keyI: 1.7,
    shade: "#8a96cf",
    shadeK: 0.52,
    points: [OFF, OFF, OFF, { ...NEON, intensity: 1.5 }, OFF, OFF],
    sky: "morning",
    skyGain: 1.05,
    lamps: 0.6,
    exposure: 1.0,
    bloom: 0.55,
    grade: G_DAY,
    cardTint: "#fff2e2",
    cardGain: 1.0,
    cardGrad: 0.12,
    cardGlow: "#000000",
    cardGlowK: 0,
    clear: "#cfe0f5",
  },
  day: {
    keyDir: [-0.5, 0.72, -0.48],
    keyColor: "#fff0d8",
    keyI: 1.72,
    shade: "#8c9ad0",
    shadeK: 0.54,
    points: [OFF, { ...MONITOR_GLOW, intensity: 0.5 }, { ...AI_GLOW, intensity: 0.8 }, { ...NEON, intensity: 1.2 }, OFF, OFF],
    sky: "morning",
    skyGain: 1.1,
    lamps: 0.5,
    exposure: 1.0,
    bloom: 0.55,
    grade: G_DAY,
    cardTint: "#fff6ec",
    cardGain: 1.0,
    cardGrad: 0.12,
    cardGlow: "#5fd8ff",
    cardGlowK: 0.05,
    clear: "#cfe0f5",
  },
  night: {
    keyDir: [-0.35, 0.55, -0.76],
    keyColor: "#7d8fe8",
    keyI: 0.62,
    shade: "#262a5c",
    shadeK: 0.55,
    points: [DESK_LAMP, MONITOR_GLOW, AI_GLOW, NEON, OFF, OFF],
    sky: "night",
    skyGain: 1.0,
    lamps: 0,
    exposure: 1.12,
    bloom: 0.75,
    grade: G_NIGHT,
    cardTint: "#a9b2f2",
    cardGain: 0.86,
    cardGrad: 0.2,
    cardGlow: "#58c8ff",
    cardGlowK: 0.32,
    clear: "#0e1030",
  },
  alarm: {
    keyDir: [-0.35, 0.55, -0.76],
    keyColor: "#6d78d8",
    keyI: 0.5,
    shade: "#2a1d48",
    shadeK: 0.55,
    points: [{ ...DESK_LAMP, intensity: 1.2 }, { ...MONITOR_GLOW, color: "#ff4a5a", intensity: 1.6 }, AI_GLOW, NEON, { pos: [0.2, 2.9, 0.6], color: "#ff2238", intensity: 14, distance: 10 }, OFF],
    sky: "night",
    skyGain: 0.9,
    lamps: 0,
    exposure: 1.1,
    bloom: 0.85,
    grade: G_NIGHT,
    cardTint: "#d7a2c2",
    cardGain: 0.9,
    cardGrad: 0.22,
    cardGlow: "#ff3a52",
    cardGlowK: 0.35,
    clear: "#140818",
  },
  twist: {
    keyDir: [-0.3, 0.6, -0.74],
    keyColor: "#6a7ce0",
    keyI: 0.42,
    shade: "#1b1f4a",
    shadeK: 0.5,
    points: [{ ...DESK_LAMP, intensity: 2.6 }, { ...MONITOR_GLOW, intensity: 1.0 }, AI_GLOW, { ...NEON, intensity: 3 }, OFF, OFF],
    sky: "night",
    skyGain: 0.85,
    lamps: 0,
    exposure: 1.15,
    bloom: 0.9,
    grade: G_NIGHT,
    cardTint: "#b9b8f0",
    cardGain: 0.9,
    cardGrad: 0.2,
    cardGlow: "#ffb26b",
    cardGlowK: 0.22,
    clear: "#0a0c26",
  },
  dawn: {
    keyDir: [-0.25, 0.26, -0.93],
    keyColor: "#ffb58f",
    keyI: 1.45,
    shade: "#76669e",
    shadeK: 0.6,
    points: [{ ...DESK_LAMP, intensity: 0.8 }, { ...MONITOR_GLOW, intensity: 0.3 }, { ...AI_GLOW, intensity: 1.0 }, { ...NEON, intensity: 1.2 }, OFF, OFF],
    sky: "dawn",
    skyGain: 1.05,
    lamps: 0,
    exposure: 1.02,
    bloom: 0.65,
    grade: G_DAWN,
    cardTint: "#ffe0d2",
    cardGain: 0.98,
    cardGrad: 0.15,
    cardGlow: "#6ff6ff",
    cardGlowK: 0.06,
    clear: "#f0c4b0",
  },
  city: {
    keyDir: [0.45, 0.55, -0.7],
    keyColor: "#9aa8ff",
    keyI: 0.75,
    shade: "#2a2458",
    shadeK: 0.55,
    points: [OFF, OFF, OFF, OFF, OFF, OFF],
    sky: "night",
    skyGain: 1,
    lamps: 0,
    exposure: 1.1,
    bloom: 0.85,
    grade: G_NIGHT,
    cardTint: "#b4b8f4",
    cardGain: 0.95,
    cardGrad: 0.18,
    cardGlow: "#ff7ad8",
    cardGlowK: 0.12,
    clear: "#120f33",
  },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixHex = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
const mixV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mixGrade = (a: Grade, b: Grade, t: number): Grade => ({
  contrast: lerp(a.contrast, b.contrast, t),
  lift: lerp(a.lift, b.lift, t),
  sat: mixV(a.sat, b.sat, t),
  shadowTint: mixV(a.shadowTint, b.shadowTint, t),
  highTint: mixV(a.highTint, b.highTint, t),
  vignette: [lerp(a.vignette[0], b.vignette[0], t), lerp(a.vignette[1], b.vignette[1], t)],
});

/** A preset blended toward another (time-lapse, alarm fading out). The sky switches at the midpoint. */
export const blendPreset = (a: LightPreset, b: LightPreset, t: number): LightPreset => {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    keyDir: mixV(a.keyDir, b.keyDir, t),
    keyColor: mixHex(a.keyColor, b.keyColor, t),
    keyI: lerp(a.keyI, b.keyI, t),
    shade: mixHex(a.shade, b.shade, t),
    shadeK: lerp(a.shadeK, b.shadeK, t),
    points: a.points.map((p, i) => {
      const q = b.points[i];
      const pos = p.intensity === 0 ? q.pos : q.intensity === 0 ? p.pos : mixV(p.pos, q.pos, t);
      return { pos, color: mixHex(p.intensity ? p.color : q.color, q.intensity ? q.color : p.color, t), intensity: lerp(p.intensity, q.intensity, t), distance: lerp(p.distance, q.distance, t) };
    }),
    sky: t < 0.5 ? a.sky : b.sky,
    skyGain: lerp(a.skyGain, b.skyGain, t),
    lamps: lerp(a.lamps, b.lamps, t),
    exposure: lerp(a.exposure, b.exposure, t),
    bloom: lerp(a.bloom, b.bloom, t),
    grade: mixGrade(a.grade, b.grade, t),
    cardTint: mixHex(a.cardTint, b.cardTint, t),
    cardGain: lerp(a.cardGain, b.cardGain, t),
    cardGrad: lerp(a.cardGrad, b.cardGrad, t),
    cardGlow: mixHex(a.cardGlow, b.cardGlow, t),
    cardGlowK: lerp(a.cardGlowK, b.cardGlowK, t),
    clear: mixHex(a.clear, b.clear, t),
  };
};

/** The rig: one shadow-casting key + six practicals. Counts never change, so no shader recompiles mid-film. */
export class Rig {
  readonly key: THREE.DirectionalLight;
  readonly points: THREE.PointLight[];
  readonly group = new THREE.Group();
  constructor() {
    this.key = new THREE.DirectionalLight("#ffffff", 1);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = 2.5;
    const c = this.key.shadow.camera;
    c.left = -9;
    c.right = 9;
    c.top = 9;
    c.bottom = -9;
    c.near = 0.5;
    c.far = 60;
    this.group.add(this.key, this.key.target);
    this.points = Array.from({ length: 6 }, () => {
      const p = new THREE.PointLight("#ffffff", 0, 5, 2);
      this.group.add(p);
      return p;
    });
  }

  /** Applies a preset. `focus` is the point the shadow frustum centres on (the shot's subject). */
  apply(p: LightPreset, focus: THREE.Vector3, toonShade: THREE.Color) {
    const d = new THREE.Vector3(...p.keyDir).normalize();
    this.key.position.copy(focus).addScaledVector(d, 25);
    this.key.target.position.copy(focus);
    this.key.target.updateMatrixWorld();
    this.key.color.set(p.keyColor);
    this.key.intensity = p.keyI;
    // shade = the shade hue at shadeK × the key's luminance (shadeK is the shadow/lit ratio)
    const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const key = new THREE.Color(p.keyColor).multiplyScalar(p.keyI);
    const hue = new THREE.Color(p.shade);
    toonShade.copy(hue).multiplyScalar((p.shadeK * lum(key)) / Math.max(1e-4, lum(hue)));
    p.points.forEach((s, i) => {
      const l = this.points[i];
      l.position.set(...s.pos);
      l.color.set(s.color);
      l.intensity = s.intensity;
      l.distance = s.distance;
    });
  }
}
