import type React from "react";
import { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mixColors } from "../../../core/color";
import { GRAIN_TILE_SIZE, getGrainTile } from "../grain";
import { random01 } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  background: string;
  color1: string;
  color2: string;
  color3: string;
  count: number;
  /** orb radius relative to the box's long side */
  size: number;
  intensity: number;
  /** 0..1 breathing amount */
  pulse: number;
  /** drift speed, roughly 60px/s at 1 (1080p) */
  speed: number;
  /** 0..1 — how far apart the orbs sit */
  spread: number;
  vignette: number;
  grain: number;
  seed: number;
};

/** Soft light falloff: broad body, long Gaussian-ish tail (offset, relative opacity). */
const ORB_STOPS: [number, number][] = [
  [0, 1],
  [0.25, 0.78],
  [0.5, 0.42],
  [0.72, 0.16],
  [0.88, 0.05],
  [1, 0],
];

const TAU = Math.PI * 2;

const GlowOrbs: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const clip = Math.max(1, p.durationInFrames);
  const clipSec = clip / fps;
  const n = Math.max(1, Math.min(6, Math.round(p.count)));
  const colors = [p.color1, p.color2, p.color3];
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  // Every motion runs an integer number of cycles per clip, so the clip loops seamlessly.
  const loop = frame / clip;
  const driftCycles = p.speed > 0 ? Math.max(1, Math.round((clipSec * p.speed) / 12)) : 0;
  const pxPerSec = p.speed * 60 * unit;
  const wander = driftCycles > 0 ? Math.min(short * 0.2, (pxPerSec * (clipSec / driftCycles)) / TAU) : 0;

  const orbs = Array.from({ length: n }, (_, i) => {
    const r1 = random01(p.seed * 31.7 + i * 7.13 + 1);
    const r2 = random01(p.seed * 17.3 + i * 3.91 + 2);
    const r3 = random01(p.seed * 11.1 + i * 5.37 + 3);
    // Golden-angle layout around the centre.
    const ang = i * 2.39996 + p.seed * 0.61 + r1 * 0.8;
    const rad = n === 1 ? 0 : (0.2 + 0.18 * r2) * (0.45 + p.spread);
    const k1 = driftCycles * (1 + (i % 2));
    const k2 = driftCycles * (1 + ((i + 1) % 3));
    const ox = wander * (Math.sin(loop * k1 * TAU + r1 * TAU) + 0.45 * Math.sin(loop * k2 * TAU + r3 * TAU));
    const oy = wander * (Math.cos(loop * k2 * TAU + r2 * TAU) + 0.45 * Math.cos(loop * k1 * TAU + r1 * TAU));
    const pulseCycles = Math.max(1, Math.round(clipSec / (4.5 + 2.5 * r3)));
    const beat = Math.sin(loop * pulseCycles * TAU + r2 * TAU);
    const color = colors[i % colors.length];
    return {
      id: `orb${i}`,
      color,
      core: mixColors(color, "#FFFFFF", 0.12),
      cx: w * (0.5 + Math.cos(ang) * rad) + ox,
      cy: h * (0.5 + Math.sin(ang) * rad * 0.85) + oy,
      r: long * p.size * (0.5 + 0.22 * r3) * (1 + 0.1 * p.pulse * beat),
      alpha: Math.min(1, p.intensity * (0.84 + 0.16 * p.pulse * beat)),
    };
  });

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", backgroundColor: p.background }}>
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, display: "block" }}
      >
        <defs>
          {orbs.map((o) => (
            <radialGradient key={o.id} id={`${o.id}${uid}`}>
              {ORB_STOPS.map(([offset, a]) => (
                <stop key={offset} offset={offset} stopColor={offset === 0 ? o.core : o.color} stopOpacity={a} />
              ))}
            </radialGradient>
          ))}
          <radialGradient id={`vg${uid}`} cx="50%" cy="50%" r="72%">
            <stop offset="0.45" stopColor="#000000" stopOpacity={0} />
            <stop offset="0.8" stopColor="#000000" stopOpacity={p.vignette * 0.45} />
            <stop offset="1" stopColor="#000000" stopOpacity={p.vignette * 0.85} />
          </radialGradient>
        </defs>
        {orbs.map((o) => (
          <circle
            key={o.id}
            cx={o.cx}
            cy={o.cy}
            r={o.r}
            fill={`url(#${o.id}${uid})`}
            opacity={o.alpha}
            style={{ mixBlendMode: "screen" }}
          />
        ))}
        {p.vignette > 0 ? <rect width={w} height={h} fill={`url(#vg${uid})`} /> : null}
      </svg>
      {p.grain > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${getGrainTile(frame)})`,
            backgroundSize: `${Math.round(GRAIN_TILE_SIZE * Math.max(1, unit))}px`,
            opacity: p.grain * 0.16,
            mixBlendMode: "overlay",
          }}
        />
      ) : null}
    </div>
  );
};

export const glowOrbs = defineMotionComponent<Props>({
  id: "glow-orbs",
  name: "Glow orbs",
  category: "background",
  description:
    "A few large, soft light orbs that drift and breathe on a dark base, with vignette and grain; loops seamlessly. Use as a calm atmospheric backdrop for logo stings, app promos and quotes (keep intensity low behind text, or pair 2 brand colors).",
  schema: {
    background: { type: "color", label: "Background", default: "#05060A" },
    color1: { type: "color", label: "Color 1", default: "#2563FF" },
    color2: { type: "color", label: "Color 2", default: "#12B5D6" },
    color3: { type: "color", label: "Color 3", default: "#FF7A3D" },
    count: { type: "number", label: "Orbs", default: 3, min: 1, max: 6, step: 1 },
    size: { type: "number", label: "Size", default: 0.65, min: 0.15, max: 1.5, step: 0.05 },
    intensity: { type: "number", label: "Intensity", default: 0.55, min: 0, max: 1, step: 0.05 },
    pulse: { type: "number", label: "Pulse", default: 0.5, min: 0, max: 1, step: 0.05 },
    speed: { type: "number", label: "Drift speed", default: 0.6, min: 0, max: 3, step: 0.05 },
    spread: { type: "number", label: "Spread", default: 0.6, min: 0, max: 1, step: 0.05 },
    vignette: { type: "number", label: "Vignette", default: 0.4, min: 0, max: 1, step: 0.05 },
    grain: { type: "number", label: "Grain", default: 0.35, min: 0, max: 1, step: 0.05 },
    seed: { type: "number", label: "Seed", default: 0, min: 0, max: 100, step: 1 },
  },
  defaults: {
    background: "#05060A",
    color1: "#2563FF",
    color2: "#12B5D6",
    color3: "#FF7A3D",
    count: 3,
    size: 0.65,
    intensity: 0.55,
    pulse: 0.5,
    speed: 0.6,
    spread: 0.6,
    vignette: 0.4,
    grain: 0.35,
    seed: 0,
  },
  defaultDuration: 8,
  Component: GlowOrbs,
  tags: ["background", "glow", "ambient", "bokeh", "loop", "premium"],
});
