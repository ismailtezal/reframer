import type React from "react";
import { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mixColors } from "../../../core/color";
import { lerp, random01 } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Style = "dust" | "starfield" | "bokeh";
type Direction = "up" | "down" | "left" | "right" | "still" | "outward";

type Props = {
  style: Style;
  color: string;
  accentColor: string;
  background: string;
  /** Skip the background so particles can be layered over other clips. */
  transparent: boolean;
  density: number;
  size: number;
  speed: number;
  direction: Direction;
  twinkle: number;
  /** 0..1 — size/speed/brightness variation between near and far particles */
  depth: number;
  /** 0..1 — dust only: a soft shaft of light the motes drift through */
  light: number;
  seed: number;
};

type StyleSpec = {
  count: [number, number];
  size: [number, number];
  alpha: [number, number];
  life: [number, number];
  /** px per second at 1080p */
  speed: number;
  accentShare: number;
};

const SPECS: Record<Style, StyleSpec> = {
  dust: { count: [40, 150], size: [2, 5.6], alpha: [0.32, 0.95], life: [5, 9], speed: 22, accentShare: 0.35 },
  starfield: { count: [16, 48], size: [1.4, 2.9], alpha: [0.55, 1], life: [10, 18], speed: 8, accentShare: 0.3 },
  bokeh: { count: [8, 36], size: [24, 96], alpha: [0.45, 1], life: [6, 11], speed: 14, accentShare: 0.55 },
};

const DIRS: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  still: [0, 0],
  outward: [0, 0],
};

const TAU = Math.PI * 2;
const STAR_BUCKETS = 8;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const n1 = (v: number) => v.toFixed(1);

type Particle = { id: string; x: number; y: number; r: number; a: number; near: number; accent: boolean; spikes: boolean };

const Particles: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const short = Math.min(w, h);
  const clip = Math.max(1, p.durationInFrames);
  const clipSec = clip / fps;
  const loop = frame / clip;
  const spec = SPECS[p.style];
  const density = Math.max(0, Math.min(1, p.density));
  const [dx, dy] = DIRS[p.direction];
  const moving = p.direction !== "still" && p.speed > 0;
  const salt = p.style === "dust" ? 1 : p.style === "starfield" ? 2 : 3;

  // Dust light shaft: a diagonal beam from the top-left that the motes light up in.
  const light = p.style === "dust" ? Math.max(0, Math.min(1, p.light)) : 0;
  const beamAng = (62 * Math.PI) / 180;
  const beamDir = { x: Math.cos(beamAng), y: Math.sin(beamAng) };
  const beamFrom = { x: w * 0.1, y: -h * 0.15 };
  const beamLen = Math.hypot(w, h) * 1.05;
  const beamWidth = short * 0.3;
  const beamAt = (x: number, y: number) => {
    const rx = x - beamFrom.x;
    const ry = y - beamFrom.y;
    const along = (rx * beamDir.x + ry * beamDir.y) / beamLen;
    const across = Math.abs(rx * beamDir.y - ry * beamDir.x) / beamWidth;
    return Math.exp(-across * across) * smoothstep(-0.05, 0.25, along) * (1 - smoothstep(0.65, 1.05, along));
  };

  /**
   * Particles live on integer cycles per clip: each fades in, drifts and fades out,
   * then respawns elsewhere while invisible — so the clip loops seamlessly.
   */
  const place = (i: number, sizeRange: [number, number], alphaRange: [number, number]): Particle => {
    const r = (k: number) => random01(p.seed * 131.1 + i * 17.17 + k * 7.31 + salt * 1000);
    const near = lerp(0.5, r(1) ** 1.7, p.depth);
    const accent = r(9) < spec.accentShare;
    const twinkleCycles = Math.max(1, Math.round(clipSec / (0.9 + 2.2 * r(6))));
    const tw = 1 - p.twinkle * 0.65 * (0.5 + 0.5 * Math.sin(loop * twinkleCycles * TAU + r(5) * TAU));
    let size = lerp(sizeRange[0], sizeRange[1], near) * p.size * unit;
    let alpha = lerp(alphaRange[0], alphaRange[1], near);
    let x: number;
    let y: number;
    if (!moving) {
      // Still: fixed positions with a tiny looping wobble.
      const k = Math.max(1, Math.round(clipSec / 7));
      x = r(2) * w + Math.sin(loop * k * TAU + r(7) * TAU) * 6 * unit * near;
      y = r(3) * h + Math.cos(loop * k * TAU + r(8) * TAU) * 6 * unit * near;
    } else {
      const outward = p.direction === "outward";
      const lifeSec = lerp(spec.life[0], spec.life[1], r(4)) * (outward ? 0.6 / Math.max(0.2, p.speed) : 1);
      const cycles = Math.max(1, Math.round(clipSec / lifeSec));
      const period = clip / cycles;
      const u = frame / period + r(10);
      const age = u - Math.floor(u);
      const cycle = mod(Math.floor(u), cycles);
      const rs = (k: number) => random01(p.seed * 71.3 + i * 13.3 + cycle * 29.7 + k * 5.1 + salt * 300);
      if (outward) {
        // Flying through: depth shrinks over the life, so particles accelerate outwards and grow.
        const z = 1 - 0.9 * age;
        const ang = rs(1) * TAU;
        const r0 = lerp(0.03, 0.22, rs(2)) * short;
        x = w / 2 + Math.cos(ang) * (r0 / z);
        y = h / 2 + Math.sin(ang) * (r0 / z);
        size *= Math.min(3, 0.45 / z);
        alpha *= smoothstep(0, 0.3, age) * (1 - smoothstep(0.85, 1, age));
      } else {
        const dist = spec.speed * p.speed * lerp(0.35, 1, near) * unit * (period / fps);
        const margin = 0.06 * short;
        const wobble = Math.sin(age * TAU * (1 + Math.floor(rs(3) * 2)) + rs(4) * TAU) * 10 * unit * near;
        x = lerp(-margin, w + margin, rs(1)) + dx * dist * (age - 0.5) + -dy * wobble;
        y = lerp(-margin, h + margin, rs(2)) + dy * dist * (age - 0.5) + dx * wobble;
        alpha *= smoothstep(0, 0.2, age) * (1 - smoothstep(0.72, 1, age));
      }
    }
    if (light > 0) alpha *= Math.min(1.25, 1 - 0.78 * light + 1.3 * light * beamAt(x, y));
    return { id: `p${i}`, x, y, r: size, a: Math.min(1, alpha * tw), near, accent, spikes: r(11) < 0.12 };
  };

  const count = Math.round(lerp(spec.count[0], spec.count[1], density));
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) particles.push(place(i, spec.size, spec.alpha));

  // Starfield: many tiny stars packed into a few paths, bucketed by brightness.
  const starPaths = Array.from({ length: STAR_BUCKETS }, (_, b) => ({
    id: `bucket${b}`,
    opacity: (b + 0.5) / STAR_BUCKETS,
    d: "",
  }));
  if (p.style === "starfield") {
    const tiny = Math.round(lerp(160, 520, density));
    for (let i = 0; i < tiny; i++) {
      const s = place(10000 + i, [0.6, 1.4], [0.14, 0.9]);
      const b = Math.min(STAR_BUCKETS - 1, Math.floor(s.a * STAR_BUCKETS));
      if (s.a <= 0.02 || s.x < -4 || s.y < -4 || s.x > w + 4 || s.y > h + 4) continue;
      const r = Math.max(0.5, s.r);
      starPaths[b].d += `M${n1(s.x - r)} ${n1(s.y)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(2 * r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2 * r)} 0Z`;
    }
  }

  const tint = p.style === "bokeh" ? p.accentColor : mixColors(p.color, p.accentColor, 0.85);
  const centre =
    p.style === "starfield"
      ? mixColors(p.background, "#22305A", 0.45)
      : mixColors(p.background, p.accentColor, p.style === "dust" ? 0.04 : 0.06);
  const beamColor = mixColors(p.color, p.accentColor, 0.45);
  const beamMid = { x: beamFrom.x + beamDir.x * beamLen * 0.45, y: beamFrom.y + beamDir.y * beamLen * 0.45 };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: p.transparent ? undefined : p.background,
        backgroundImage: p.transparent ? undefined : `radial-gradient(ellipse 75% 65% at 50% 45%, ${centre} 0%, ${p.background} 100%)`,
      }}
    >
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, display: "block" }}
      >
        <defs>
          {[
            { key: "c", color: p.color },
            { key: "a", color: tint },
          ].map((g) => (
            <g key={g.key}>
              <radialGradient id={`soft${g.key}${uid}`}>
                <stop offset="0" stopColor={g.color} stopOpacity={1} />
                <stop offset="0.35" stopColor={g.color} stopOpacity={0.7} />
                <stop offset="0.7" stopColor={g.color} stopOpacity={0.18} />
                <stop offset="1" stopColor={g.color} stopOpacity={0} />
              </radialGradient>
              <radialGradient id={`disc${g.key}${uid}`}>
                <stop offset="0" stopColor={g.color} stopOpacity={0.84} />
                <stop offset="0.6" stopColor={g.color} stopOpacity={0.88} />
                <stop offset="0.84" stopColor={g.color} stopOpacity={1} />
                <stop offset="0.93" stopColor={g.color} stopOpacity={0.62} />
                <stop offset="1" stopColor={g.color} stopOpacity={0} />
              </radialGradient>
            </g>
          ))}
          <linearGradient id={`sh${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={p.color} stopOpacity={0} />
            <stop offset="0.5" stopColor={p.color} stopOpacity={0.8} />
            <stop offset="1" stopColor={p.color} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`sv${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.color} stopOpacity={0} />
            <stop offset="0.5" stopColor={p.color} stopOpacity={0.8} />
            <stop offset="1" stopColor={p.color} stopOpacity={0} />
          </linearGradient>
          <radialGradient id={`beam${uid}`}>
            <stop offset="0" stopColor={beamColor} stopOpacity={0.11 * light} />
            <stop offset="0.5" stopColor={beamColor} stopOpacity={0.05 * light} />
            <stop offset="1" stopColor={beamColor} stopOpacity={0} />
          </radialGradient>
        </defs>
        {light > 0 ? (
          <ellipse
            cx={beamMid.x}
            cy={beamMid.y}
            rx={beamLen * 0.55}
            ry={beamWidth * 1.1}
            transform={`rotate(${(beamAng * 180) / Math.PI} ${beamMid.x} ${beamMid.y})`}
            fill={`url(#beam${uid})`}
          />
        ) : null}
        {starPaths.map((s) => (s.d ? <path key={s.id} d={s.d} fill={p.color} opacity={s.opacity} /> : null))}
        <g style={{ mixBlendMode: p.transparent ? undefined : "screen" }}>
          {particles.map((q) => {
            if (q.a <= 0.003) return null;
            const key = q.accent ? "a" : "c";
            if (p.style === "bokeh") {
              // The nearest lights are so far out of focus they lose their rim.
              return q.near > 0.85 ? (
                <circle key={q.id} cx={q.x} cy={q.y} r={q.r * 1.3} fill={`url(#soft${key}${uid})`} opacity={q.a * 0.8} />
              ) : (
                <circle key={q.id} cx={q.x} cy={q.y} r={q.r} fill={`url(#disc${key}${uid})`} opacity={q.a} />
              );
            }
            if (p.style === "dust") {
              // Motes right in front of the lens are big, soft and faint.
              return q.near > 0.78 ? (
                <circle key={q.id} cx={q.x} cy={q.y} r={q.r * 4} fill={`url(#soft${key}${uid})`} opacity={q.a * 0.38} />
              ) : (
                <circle key={q.id} cx={q.x} cy={q.y} r={q.r * 1.8} fill={`url(#soft${key}${uid})`} opacity={q.a} />
              );
            }
            const spike = q.r * 9;
            return (
              <g key={q.id} opacity={q.a}>
                <circle cx={q.x} cy={q.y} r={q.r * 4.5} fill={`url(#soft${key}${uid})`} opacity={0.3} />
                <circle cx={q.x} cy={q.y} r={q.r} fill={q.accent ? tint : p.color} />
                {q.spikes ? (
                  <>
                    <rect x={q.x - spike} y={q.y - q.r * 0.18} width={spike * 2} height={q.r * 0.36} fill={`url(#sh${uid})`} />
                    <rect x={q.x - q.r * 0.18} y={q.y - spike} width={q.r * 0.36} height={spike * 2} fill={`url(#sv${uid})`} />
                  </>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export const particles = defineMotionComponent<Props>({
  id: "particles",
  name: "Particles",
  category: "background",
  description:
    "Deterministic, seamlessly looping particles: dust motes drifting through a soft shaft of light, a twinkling starfield, or warm out-of-focus bokeh — drifting in a direction or flying outwards. Use sparingly for atmosphere (cinematic intros, night/space, music); `transparent` layers it over other backgrounds. Avoid on product/UI shots.",
  schema: {
    style: { type: "enum", label: "Style", default: "dust", options: ["dust", "starfield", "bokeh"] },
    color: { type: "color", label: "Color", default: "#FFFFFF" },
    accentColor: { type: "color", label: "Tint", default: "#FFC98A" },
    background: { type: "color", label: "Background", default: "#060709" },
    transparent: { type: "boolean", label: "Transparent background", default: false },
    density: { type: "number", label: "Density", default: 0.5, min: 0, max: 1, step: 0.05 },
    size: { type: "number", label: "Size", default: 1, min: 0.25, max: 3, step: 0.05 },
    speed: { type: "number", label: "Speed", default: 1, min: 0, max: 4, step: 0.05 },
    direction: { type: "enum", label: "Direction", default: "up", options: ["up", "down", "left", "right", "still", "outward"] },
    twinkle: { type: "number", label: "Twinkle", default: 0.45, min: 0, max: 1, step: 0.05 },
    depth: { type: "number", label: "Depth", default: 0.7, min: 0, max: 1, step: 0.05 },
    light: { type: "number", label: "Light shaft (dust)", default: 0.6, min: 0, max: 1, step: 0.05 },
    seed: { type: "number", label: "Seed", default: 0, min: 0, max: 100, step: 1 },
  },
  defaults: {
    style: "dust",
    color: "#FFFFFF",
    accentColor: "#FFC98A",
    background: "#060709",
    transparent: false,
    density: 0.5,
    size: 1,
    speed: 1,
    direction: "up",
    twinkle: 0.45,
    depth: 0.7,
    light: 0.6,
    seed: 0,
  },
  defaultDuration: 8,
  Component: Particles,
  tags: ["background", "particles", "dust", "stars", "bokeh", "space", "loop"],
});
