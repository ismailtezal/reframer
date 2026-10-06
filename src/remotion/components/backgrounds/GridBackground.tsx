import type React from "react";
import { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mixColors } from "../../../core/color";
import { GRAIN_TILE_SIZE, getGrainTile } from "../grain";
import { random01 } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Direction = "up" | "down" | "left" | "right" | "diagonal";

type Props = {
  background: string;
  lineColor: string;
  lineOpacity: number;
  /** px at 1080p */
  cellSize: number;
  pattern: "lines" | "dots" | "crosses";
  /** Receding floor grid with a horizon instead of a flat grid. */
  floor: boolean;
  glowColor: string;
  glow: number;
  glowPosition: "top" | "center" | "bottom";
  /** 0..1 — how strongly the grid fades out towards the edges */
  fade: number;
  /** cells per second */
  drift: number;
  direction: Direction;
  /** 0..1 — cells that softly light up and fade */
  highlights: number;
  noise: number;
  seed: number;
};

const DIRECTIONS: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  diagonal: [1, -1],
};

const mod = (a: number, n: number) => ((a % n) + n) % n;
const n1 = (v: number) => v.toFixed(1);

/** Gaussian-like falloff for radial glows (offset, relative opacity). */
const GLOW_STOPS: [number, number][] = [
  [0, 1],
  [0.18, 0.72],
  [0.38, 0.4],
  [0.6, 0.16],
  [0.8, 0.045],
  [1, 0],
];

const GridBackground: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const clip = Math.max(1, p.durationInFrames);
  const cell = Math.max(8, p.cellSize * unit);
  const lw = Math.max(1, 1.15 * unit);
  // Whole cells per clip, so the drift loops seamlessly whatever the clip length.
  const cellsPerClip = p.drift > 0 ? Math.max(1, Math.round((p.drift * clip) / fps)) : 0;
  const speed = (cellsPerClip * cell) / clip; // px per frame
  const travel = speed * frame;
  const [dx, dy] = DIRECTIONS[p.direction];
  const lineAlpha = Math.min(1, Math.max(0, p.lineOpacity));
  const litAlpha = Math.min(1, lineAlpha * (1 + 3.5 * p.glow));
  const litColor = mixColors(p.lineColor, p.glowColor, Math.min(1, p.glow * 1.4));

  let lineD = "";
  let markD = "";
  let lineMul = 1;
  let markMul = 1;
  let markFilled = false;
  let glowX = w / 2;
  let glowY = p.glowPosition === "top" ? -h * 0.03 : p.glowPosition === "bottom" ? h * 1.03 : h / 2;
  let focusY = p.glowPosition === "top" ? 40 : p.glowPosition === "bottom" ? 60 : 50;
  const horizon = h * 0.34;
  const depth = h - horizon;
  const highlights: { id: string; x: number; y: number; a: number }[] = [];

  if (p.floor) {
    glowX = w / 2;
    glowY = horizon;
    focusY = 80;
    // Perspective floor: screen y = horizon + depth / z for world depth z (z = 1 at the bottom edge).
    const forward = p.direction === "down" ? -1 : p.direction === "left" || p.direction === "right" ? 0 : 1;
    const lateral = p.direction === "left" ? -1 : p.direction === "right" || p.direction === "diagonal" ? 1 : 0;
    const phase = mod(travel / cell, 1);
    const step = cell / depth;
    for (let k = -1; k < 400; k++) {
      const z = 1 + (k - forward * phase) * step;
      if (z <= 0.02) continue;
      const gap = depth / z - depth / (z + step);
      if (gap < 1.6 * unit) break;
      lineD += `M0 ${n1(horizon + depth / z)}H${n1(w)}`;
    }
    const zFar = 60;
    const zNear = 0.55;
    const span = Math.ceil((w * 2.2) / cell);
    for (let j = -span; j <= span; j++) {
      const x = (j - lateral * phase) * cell;
      lineD += `M${n1(w / 2 + x / zFar)} ${n1(horizon + depth / zFar)}L${n1(w / 2 + x / zNear)} ${n1(horizon + depth / zNear)}`;
    }
  } else {
    // Flat grid, anchored so a line crosses the centre of the box at rest.
    const ox = mod(w / 2 + travel * dx, cell);
    const oy = mod(h / 2 + travel * dy, cell);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let x = ox - cell; x <= w + cell; x += cell) xs.push(x);
    for (let y = oy - cell; y <= h + cell; y += cell) ys.push(y);
    if (p.pattern !== "dots") {
      lineMul = p.pattern === "crosses" ? 0.42 : 1;
      lineD = xs.map((x) => `M${n1(x)} 0V${n1(h)}`).join("") + ys.map((y) => `M0 ${n1(y)}H${n1(w)}`).join("");
    }
    if (p.pattern === "dots") {
      const r = Math.max(1, 1.7 * unit);
      markFilled = true;
      markMul = 2.6;
      for (const x of xs) {
        for (const y of ys) {
          markD += `M${n1(x - r)} ${n1(y)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(2 * r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2 * r)} 0Z`;
        }
      }
    } else if (p.pattern === "crosses") {
      const arm = Math.max(5 * unit, cell * 0.1);
      markMul = 1.9;
      for (const x of xs) {
        for (const y of ys) {
          markD += `M${n1(x - arm)} ${n1(y)}H${n1(x + arm)}M${n1(x)} ${n1(y - arm)}V${n1(y + arm)}`;
        }
      }
    }

    // A few cells softly light up and fade, on integer cycles per clip (seamless loop).
    const slots = Math.round(Math.max(0, Math.min(1, p.highlights)) * 8);
    const cols = Math.max(1, Math.ceil(w / cell));
    const rows = Math.max(1, Math.ceil(h / cell));
    for (let s = 0; s < slots; s++) {
      const r1 = random01(p.seed * 101 + s * 7.31 + 1);
      const cycles = Math.max(1, Math.round(clip / (fps * (2.6 + 2.2 * r1))));
      const u = (frame / clip) * cycles + random01(p.seed * 31 + s * 3.7 + 2);
      const age = u - Math.floor(u);
      const cycle = mod(Math.floor(u), cycles);
      const rc = random01(p.seed * 17 + s * 13.1 + cycle * 7.7 + 3);
      const rr = random01(p.seed * 23 + s * 5.3 + cycle * 11.9 + 4);
      const rowBias = p.glowPosition === "top" ? 0.04 + 0.55 * rr : p.glowPosition === "bottom" ? 0.4 + 0.55 * rr : 0.2 + 0.6 * rr;
      const col = Math.floor((0.12 + 0.76 * rc) * cols);
      const row = Math.floor(rowBias * rows);
      // Grid origin when the highlight was born, then follow the drift continuously.
      const since = age * (clip / cycles);
      const born = travel - speed * since;
      const gx = mod(w / 2 + born * dx, cell) + speed * since * dx;
      const gy = mod(h / 2 + born * dy, cell) + speed * since * dy;
      highlights.push({
        id: `hl${s}`,
        x: gx + (col - 1) * cell,
        y: gy + (row - 1) * cell,
        a: Math.sin(Math.PI * age) ** 2 * (0.05 + 0.06 * random01(p.seed + s * 9.1 + cycle)),
      });
    }
  }

  const litR = Math.max(w, h) * 0.6;
  const glowPeak = 0.5 * p.glow;
  const edgeAlpha = Math.max(0, 1 - p.fade / 0.85);
  const innerStop = Math.max(0.05, 1 - p.fade * 0.85);
  const coreColor = mixColors(p.glowColor, "#FFFFFF", 0.35);

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
          <radialGradient id={`gl${uid}`}>
            {GLOW_STOPS.map(([o, a]) => (
              <stop key={o} offset={o} stopColor={p.glowColor} stopOpacity={a * glowPeak} />
            ))}
          </radialGradient>
          <radialGradient id={`gc${uid}`}>
            {GLOW_STOPS.map(([o, a]) => (
              <stop key={o} offset={o} stopColor={coreColor} stopOpacity={a * glowPeak * 0.65} />
            ))}
          </radialGradient>
          {/* Lines are lit by the glow: glow colour near the light, line colour further away. */}
          {[
            { key: "lt", mul: lineMul },
            { key: "lm", mul: markMul },
          ].map((g) => (
            <radialGradient key={g.key} id={`${g.key}${uid}`} gradientUnits="userSpaceOnUse" cx={glowX} cy={glowY} r={litR}>
              <stop offset="0" stopColor={litColor} stopOpacity={Math.min(1, litAlpha * g.mul)} />
              <stop
                offset="0.45"
                stopColor={mixColors(litColor, p.lineColor, 0.5)}
                stopOpacity={Math.min(1, ((litAlpha + lineAlpha) / 2) * g.mul)}
              />
              <stop offset="1" stopColor={p.lineColor} stopOpacity={Math.min(1, lineAlpha * g.mul)} />
            </radialGradient>
          ))}
          <radialGradient id={`fg${uid}`} cx="50%" cy={`${focusY}%`} r="75%">
            <stop offset={innerStop} stopColor="#FFFFFF" stopOpacity={1} />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity={edgeAlpha} />
          </radialGradient>
          <mask id={`fm${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
            <rect width={w} height={h} fill={`url(#fg${uid})`} />
          </mask>
          {p.floor ? (
            <>
              <linearGradient id={`hz${uid}`} gradientUnits="userSpaceOnUse" x1={0} y1={horizon} x2={0} y2={horizon + depth * 0.6}>
                <stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <stop offset="0.3" stopColor="#FFFFFF" stopOpacity={0.15} />
                <stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.55} />
                <stop offset="1" stopColor="#FFFFFF" stopOpacity={1} />
              </linearGradient>
              <mask id={`hm${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
                <rect width={w} height={h} fill={`url(#hz${uid})`} />
              </mask>
              <linearGradient id={`hl${uid}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={p.glowColor} stopOpacity={0} />
                <stop offset="0.5" stopColor={coreColor} stopOpacity={0.55 * p.glow} />
                <stop offset="1" stopColor={p.glowColor} stopOpacity={0} />
              </linearGradient>
            </>
          ) : null}
        </defs>
        {p.glow > 0 ? (
          <>
            <ellipse cx={glowX} cy={glowY} rx={w * 0.62} ry={(p.floor ? depth : h) * 0.62} fill={`url(#gl${uid})`} />
            <ellipse cx={glowX} cy={glowY} rx={w * 0.24} ry={(p.floor ? depth : h) * 0.2} fill={`url(#gc${uid})`} />
          </>
        ) : null}
        <g mask={`url(#fm${uid})`}>
          <g mask={p.floor ? `url(#hm${uid})` : undefined}>
            {highlights.map((c) => (
              <rect key={c.id} x={c.x + lw / 2} y={c.y + lw / 2} width={cell - lw} height={cell - lw} fill={p.glowColor} opacity={c.a} />
            ))}
            {lineD ? <path d={lineD} fill="none" stroke={`url(#lt${uid})`} strokeWidth={lw} /> : null}
            {markD ? (
              markFilled ? (
                <path d={markD} fill={`url(#lm${uid})`} />
              ) : (
                <path d={markD} fill="none" stroke={`url(#lm${uid})`} strokeWidth={lw} />
              )
            ) : null}
          </g>
        </g>
        {p.floor && p.glow > 0 ? <rect x={0} y={horizon - lw} width={w} height={lw * 1.6} fill={`url(#hl${uid})`} /> : null}
      </svg>
      {p.noise > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${getGrainTile(frame)})`,
            backgroundSize: `${Math.round(GRAIN_TILE_SIZE * Math.max(1, unit))}px`,
            opacity: p.noise * 0.14,
            mixBlendMode: "overlay",
          }}
        />
      ) : null}
    </div>
  );
};

export const gridBackground = defineMotionComponent<Props>({
  id: "grid-background",
  name: "Grid background",
  category: "background",
  description:
    "Vercel/Linear-style dark grid (lines, dots or crosses) with faded edges, a soft light glow that tints nearby lines, optional slow drift, lit cells and grain; `floor` turns it into a receding perspective floor with a horizon glow. Use behind product UI, terminals, code and launch titles; keep lines at 6-10% opacity.",
  schema: {
    background: { type: "color", label: "Background", default: "#08080A" },
    lineColor: { type: "color", label: "Line color", default: "#FFFFFF" },
    lineOpacity: { type: "number", label: "Line opacity", default: 0.08, min: 0, max: 0.5, step: 0.01 },
    cellSize: { type: "number", label: "Cell size", default: 72, min: 16, max: 240, step: 1 },
    pattern: { type: "enum", label: "Pattern", default: "lines", options: ["lines", "dots", "crosses"] },
    floor: { type: "boolean", label: "Perspective floor", default: false, description: "Receding floor grid with a horizon (lines only)" },
    glowColor: { type: "color", label: "Glow color", default: "#5B7CFF" },
    glow: { type: "number", label: "Glow", default: 0.55, min: 0, max: 1, step: 0.05 },
    glowPosition: { type: "enum", label: "Glow position", default: "top", options: ["top", "center", "bottom"] },
    fade: { type: "number", label: "Edge fade", default: 0.7, min: 0, max: 1, step: 0.05 },
    drift: { type: "number", label: "Drift (cells/s)", default: 0.15, min: 0, max: 2, step: 0.05 },
    direction: { type: "enum", label: "Drift direction", default: "up", options: ["up", "down", "left", "right", "diagonal"] },
    highlights: { type: "number", label: "Lit cells", default: 0.4, min: 0, max: 1, step: 0.05 },
    noise: { type: "number", label: "Grain", default: 0.35, min: 0, max: 1, step: 0.05 },
    seed: { type: "number", label: "Seed", default: 0, min: 0, max: 100, step: 1 },
  },
  defaults: {
    background: "#08080A",
    lineColor: "#FFFFFF",
    lineOpacity: 0.08,
    cellSize: 72,
    pattern: "lines",
    floor: false,
    glowColor: "#5B7CFF",
    glow: 0.55,
    glowPosition: "top",
    fade: 0.7,
    drift: 0.15,
    direction: "up",
    highlights: 0.4,
    noise: 0.35,
    seed: 0,
  },
  defaultDuration: 8,
  Component: GridBackground,
  tags: ["background", "grid", "vercel", "linear", "tech", "dark", "loop"],
});
