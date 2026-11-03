import type React from "react";
import { useId } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { random01 } from "../../components/helpers";
import { useClipBox } from "../../context";
import { Layer } from "../Camera";
import { useScenePaint } from "./light";
import { useSceneLight } from "./light-context";
import { mix, Shade, tone } from "./shade";

/**
 * Layered illustrated worlds: a sky with stars, hills that fade into the air with distance
 * (atmospheric perspective), forests of varied trees, planets, glows and drifting dust. Each layer
 * can sit at its own parallax depth inside <Camera>.
 */

const useBox = () => {
  const box = useClipBox();
  return { W: box.width, H: box.height };
};

export type SkyProps = {
  /** Top and horizon colors. */
  top?: string;
  bottom?: string;
  /** Number of stars (0 = none). */
  stars?: number;
  seed?: number;
  /** Stars only above this fraction of the height (default 0.75). */
  starsTo?: number;
};

/** Gradient sky with seeded, twinkling stars (a few big four-point sparkles). */
export const Sky: React.FC<SkyProps> = ({ top = "#0d1240", bottom = "#2f3c8f", stars = 90, seed = 1, starsTo = 0.75 }) => {
  const frame = useCurrentFrame();
  const { W, H } = useBox();
  const u = Math.min(W, H) / 1080;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${top} 0%, ${mix(top, bottom, 0.55)} 55%, ${bottom} 100%)` }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: stars }, (_, i) => {
          const sx = random01(seed * 1000 + i * 3) * W;
          const sy = random01(seed * 1000 + i * 3 + 1) ** 1.4 * H * starsTo;
          const big = random01(seed * 1000 + i * 3 + 2) > 0.93;
          const r = (big ? 3.2 : 0.8 + random01(i * 7 + seed) * 1.6) * u;
          const tw = 0.55 + 0.45 * Math.sin(frame / (14 + (i % 9) * 3) + i);
          if (big) {
            const s = r * 3.2;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: generated in a fixed, seeded order
              <g key={i} opacity={0.6 + 0.4 * tw} transform={`translate(${sx} ${sy})`}>
                <path
                  d={`M 0 ${-s} Q ${s * 0.12} ${-s * 0.12} ${s} 0 Q ${s * 0.12} ${s * 0.12} 0 ${s} Q ${-s * 0.12} ${s * 0.12} ${-s} 0 Q ${-s * 0.12} ${-s * 0.12} 0 ${-s} Z`}
                  fill="#fff7d6"
                />
              </g>
            );
          }
          // biome-ignore lint/suspicious/noArrayIndexKey: generated in a fixed, seeded order
          return <circle key={i} cx={sx} cy={sy} r={r} fill="#ffffff" opacity={0.35 + 0.5 * tw} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** A smooth seeded ridge line across the width (sum of a few sines). */
const ridge = (W: number, baseY: number, amp: number, seed: number, points = 48) => {
  const f1 = 1 + random01(seed) * 1.5;
  const f2 = 3 + random01(seed + 1) * 3;
  const f3 = 7 + random01(seed + 2) * 5;
  const o1 = random01(seed + 3) * 6.28;
  const o2 = random01(seed + 4) * 6.28;
  const o3 = random01(seed + 5) * 6.28;
  const pts: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const y = baseY - amp * (0.6 * Math.sin(t * f1 * 3.14 + o1) + 0.3 * Math.sin(t * f2 * 3.14 + o2) + 0.1 * Math.sin(t * f3 * 3.14 + o3));
    pts.push([t * W * 1.2 - W * 0.1, y]);
  }
  // Catmull-Rom → cubic Bézier for a soft silhouette.
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
};

export type HillsProps = {
  /** Color of the nearest hills; farther layers fade toward `air`. */
  color?: string;
  /** The sky color near the horizon (what distance fades into). */
  air?: string;
  /** Number of layers (back to front). */
  layers?: number;
  /** Where the farthest ridge sits, 0–1 from the top. */
  horizon?: number;
  /** Ridge height as a fraction of the frame height. */
  roughness?: number;
  seed?: number;
  /** Parallax inside <Camera>: depth of the farthest and nearest layer. */
  depth?: [number, number];
  /** Rim light along each ridge (the sun behind the hills). */
  rimColor?: string;
};

/** Rolling hills in layers, fading into the air with distance, each at its own parallax depth. */
export const Hills: React.FC<HillsProps> = ({
  color = "#1f3a5f",
  air = "#5b6fc4",
  layers = 4,
  horizon = 0.6,
  roughness = 0.07,
  seed = 3,
  depth = [0.35, 1.1],
  rimColor,
}) => {
  const { W, H } = useBox();
  const paint = useScenePaint();
  return (
    <>
      {Array.from({ length: layers }, (_, i) => {
        const t = layers === 1 ? 1 : i / (layers - 1); // 0 = farthest
        const baseY = H * (horizon + t * (1 - horizon) * 0.55);
        // Nearer layers carry more of the scene's light; farther ones dissolve into the air.
        const fill = mix(air, paint.base(color), 0.35 + 0.65 * t);
        const d = `${ridge(W, baseY, H * roughness * (0.6 + 0.6 * t), seed * 10 + i)} L ${W * 1.1} ${H * 1.2} L ${-W * 0.1} ${H * 1.2} Z`;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: generated in a fixed, seeded order
          <Layer key={i} depth={depth[0] + (depth[1] - depth[0]) * t}>
            <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <path d={d} fill={fill} />
              {rimColor ? (
                <path
                  d={ridge(W, baseY, H * roughness * (0.6 + 0.6 * t), seed * 10 + i)}
                  stroke={rimColor}
                  strokeOpacity={0.5 - 0.3 * t}
                  strokeWidth={3}
                  fill="none"
                />
              ) : null}
            </svg>
          </Layer>
        );
      })}
    </>
  );
};

export type TreeProps = {
  x: number;
  /** Ground point (px). */
  y: number;
  height: number;
  kind?: "pine" | "round" | "tall" | "bush";
  color?: string;
  trunk?: string;
  seed?: number;
  /** Sway amplitude in degrees (wind). */
  sway?: number;
};

type Blob = { x: number; y: number; r: number };

/** A seeded cloud of circles around (cx, cy): an irregular crown, never the same twice. */
const crownBlobs = (seed: number, n: number, cx: number, cy: number, rx: number, ry: number, r: number): Blob[] => [
  { x: cx, y: cy, r: r * 1.25 },
  ...Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (random01(seed * 11 + i) - 0.5) * 0.7;
    const d = 0.62 + random01(seed * 13 + i) * 0.38;
    return { x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: r * (0.72 + random01(seed * 17 + i) * 0.42) };
  }),
];

/**
 * A crown painted the way illustrators do it: a darker underside, the base mass, light caught on the
 * upper left of each lobe (clipped to the crown), a few dark pockets and sparkle highlights.
 */
const Crown: React.FC<{ blobs: Blob[]; color: string; id: string; seed: number }> = ({ blobs, color: own, id, seed }) => {
  const paint = useScenePaint();
  const color = paint.base(own);
  const shadow = paint.shadow(tone(own, -0.22, 6, 0.05));
  const pocket = paint.shadow(tone(own, -0.32, 10, 0.08));
  const light = paint.lit(tone(own, 0.14, -8));
  const sparkle = paint.lit(tone(own, 0.34, -14, -0.1));
  const top = Math.min(...blobs.map((b) => b.y - b.r));
  const bottom = Math.max(...blobs.map((b) => b.y + b.r));
  return (
    <>
      <defs>
        <clipPath id={`${id}-crown`}>
          {blobs.map((b, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: seeded, fixed order
            <circle key={i} cx={b.x} cy={b.y} r={b.r} />
          ))}
        </clipPath>
      </defs>
      {blobs.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: seeded, fixed order
        <circle key={`s${i}`} cx={b.x + b.r * 0.12} cy={b.y + b.r * 0.16} r={b.r} fill={shadow} />
      ))}
      <g clipPath={`url(#${id}-crown)`}>
        <rect x={-80} y={top - 4} width={160} height={bottom - top + 8} fill={shadow} />
        {blobs.map((b, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: seeded, fixed order
          <circle key={`b${i}`} cx={b.x - b.r * 0.1} cy={b.y - b.r * 0.14} r={b.r * 0.94} fill={color} />
        ))}
        {blobs.map((b, i) =>
          b.y - b.r < (top + bottom) / 2 + 6 ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: seeded, fixed order
            <circle key={`l${i}`} cx={b.x - b.r * 0.3} cy={b.y - b.r * 0.36} r={b.r * 0.58} fill={light} />
          ) : null,
        )}
        {blobs.slice(1, 4).map((b, i) => (
          <ellipse
            // biome-ignore lint/suspicious/noArrayIndexKey: seeded, fixed order
            key={`p${i}`}
            cx={b.x + b.r * 0.35}
            cy={b.y + b.r * 0.5}
            rx={b.r * 0.42}
            ry={b.r * 0.22}
            fill={pocket}
            opacity={0.55}
          />
        ))}
      </g>
      {blobs.slice(0, 5).map((b, i) =>
        random01(seed * 23 + i) > 0.35 ? (
          <ellipse
            // biome-ignore lint/suspicious/noArrayIndexKey: seeded, fixed order
            key={`k${i}`}
            cx={b.x - b.r * 0.42}
            cy={b.y - b.r * 0.5}
            rx={b.r * 0.16}
            ry={b.r * 0.09}
            fill={sparkle}
            transform={`rotate(-28 ${b.x - b.r * 0.42} ${b.y - b.r * 0.5})`}
          />
        ) : null,
      )}
    </>
  );
};

/** One illustrated tree: pine, round, tall (cypress) or bush, lit from the upper left, swaying a little. */
export const Tree: React.FC<TreeProps> = ({
  x,
  y,
  height,
  kind = "pine",
  color: ownColor = "#2f9e6e",
  trunk: ownTrunk = "#5b3a29",
  seed = 1,
  sway = 1.5,
}) => {
  const frame = useCurrentFrame();
  const paint = useScenePaint();
  const id = `kz-tree-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const s = height / 100;
  const rot = sway * Math.sin(frame / (26 + random01(seed) * 14) + seed);
  // In a <SceneLight>, shadows lean toward the scene's ambient color and lit sides toward its light.
  const trunk = paint.base(ownTrunk);
  const bark = paint.shadow(tone(ownTrunk, -0.25, 4));
  const barkLight = paint.lit(tone(ownTrunk, 0.12, -4));
  const color = paint.base(ownColor);
  const dark = paint.shadow(tone(ownColor, -0.22, 6, 0.05));
  const light = paint.lit(tone(ownColor, 0.14, -8));
  // A tapered trunk with its shaded side, and a soft contact shadow on the ground.
  const stem = (top: number, w: number, branches: boolean) => (
    <>
      <ellipse cx={2} cy={1} rx={w * 3.2} ry={2.6} fill="#000" opacity={0.16} />
      <path
        d={`M ${-w} 1 C ${-w * 0.8} ${top * 0.4} ${-w * 0.55} ${top * 0.8} ${-w * 0.45} ${top} L ${w * 0.45} ${top} C ${w * 0.55} ${top * 0.8} ${w * 0.8} ${top * 0.4} ${w} 1 Z`}
        fill={trunk}
      />
      <path
        d={`M ${w * 0.1} 1 L ${w * 0.05} ${top} L ${w * 0.45} ${top} C ${w * 0.55} ${top * 0.8} ${w * 0.8} ${top * 0.4} ${w} 1 Z`}
        fill={bark}
      />
      <path
        d={`M ${-w * 0.75} -2 C ${-w * 0.62} ${top * 0.4} ${-w * 0.5} ${top * 0.7} ${-w * 0.42} ${top * 0.9}`}
        stroke={barkLight}
        strokeWidth={0.9}
        fill="none"
        strokeLinecap="round"
      />
      {branches ? (
        <>
          <path
            d={`M 0 ${top * 0.72} Q ${-w * 2.4} ${top * 0.9} ${-w * 3.4} ${top * 1.12}`}
            stroke={trunk}
            strokeWidth={w * 0.55}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M ${w * 0.2} ${top * 0.82} Q ${w * 2.2} ${top * 0.98} ${w * 3} ${top * 1.18}`}
            stroke={bark}
            strokeWidth={w * 0.5}
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : null}
    </>
  );
  const body = (() => {
    switch (kind) {
      case "pine": {
        // Stacked tiers (bottom first, each overlapping the one below), with soft corners and a
        // lit left / shaded right split; a thin darker band under each hem where the tier above shades it.
        const tiers = [
          { hem: -24, apex: -70, w: 33 },
          { hem: -44, apex: -86, w: 27 },
          { hem: -63, apex: -99, w: 20 },
          { hem: -80, apex: -110, w: 13 },
        ].map((t, i) => {
          const sway = (random01(seed * 29 + i) - 0.5) * 2;
          const d = `M ${sway * 0.4} ${t.apex} C ${t.w * 0.22} ${t.apex + 6} ${t.w * 0.72} ${t.hem - 10} ${t.w} ${t.hem - 1.5} Q ${t.w * 1.04} ${t.hem + 1.5} ${t.w * 0.84} ${t.hem + 2} Q 0 ${t.hem + 5} ${-t.w * 0.84} ${t.hem + 2} Q ${-t.w * 1.04} ${t.hem + 1.5} ${-t.w} ${t.hem - 1.5} C ${-t.w * 0.72} ${t.hem - 10} ${-t.w * 0.22} ${t.apex + 6} ${sway * 0.4} ${t.apex} Z`;
          return { ...t, d, i, sway };
        });
        return (
          <>
            {stem(-24, 4.2, false)}
            {tiers.map((t) => (
              <g key={t.i}>
                <clipPath id={`${id}-t${t.i}`}>
                  <path d={t.d} />
                </clipPath>
                <path d={t.d} fill={color} />
                <g clipPath={`url(#${id}-t${t.i})`}>
                  <path d={`M ${t.sway * 0.4} ${t.apex - 2} L ${t.w * 1.4} ${t.hem + 8} L ${t.w * 0.06} ${t.hem + 8} Z`} fill={dark} />
                  <path
                    d={`M ${-t.w * 1.1} ${t.apex + (t.hem - t.apex) * 0.62} L ${t.sway * 0.4} ${t.apex - 2} L ${-t.w * 0.18} ${t.hem + 8} L ${-t.w * 1.1} ${t.hem + 8} Z`}
                    fill={light}
                    opacity={0.35}
                  />
                  <rect x={-t.w * 1.2} y={t.hem - 3.2} width={t.w * 2.4} height={8} fill={tone(color, -0.32, 10, 0.06)} opacity={0.38} />
                </g>
              </g>
            ))}
          </>
        );
      }
      case "round":
        return (
          <>
            {stem(-50, 4.8, true)}
            <Crown blobs={crownBlobs(seed, 7, 0, -66, 26, 20, 19)} color={ownColor} id={id} seed={seed} />
          </>
        );
      case "tall": {
        // A cypress flame: lit left, shaded right, and a few soft lobes so the edge isn't one smooth curve.
        const flame = "M 0 -106 C 13 -92 19 -62 15 -36 C 12 -26 6 -22 0 -22 C -6 -22 -12 -26 -15 -36 C -19 -62 -13 -92 0 -106 Z";
        return (
          <>
            {stem(-26, 3.2, false)}
            <clipPath id={`${id}-flame`}>
              <path d={flame} />
            </clipPath>
            <path d={flame} fill={color} />
            <g clipPath={`url(#${id}-flame)`}>
              <path d="M 1 -110 C 9 -90 13 -60 12 -20 L 30 -20 L 30 -110 Z" fill={dark} />
              <path d="M -1 -104 C -9 -86 -13 -60 -12 -34 L -20 -34 L -20 -104 Z" fill={light} opacity={0.4} />
              {[-46, -64, -82].map((cy, i) => (
                <ellipse key={cy} cx={6 + i} cy={cy} rx={9 - i * 2} ry={5 - i} fill={dark} opacity={0.45} />
              ))}
            </g>
          </>
        );
      }
      default:
        return <Crown blobs={crownBlobs(seed, 6, 2, -17, 24, 9, 13)} color={ownColor} id={id} seed={seed} />;
    }
  })();
  return (
    <svg
      viewBox="-60 -112 120 116"
      width={120 * s}
      height={116 * s}
      style={{ position: "absolute", left: x - 60 * s, top: y - 112 * s, overflow: "visible" }}
    >
      <g transform={`rotate(${rot} 0 0)${paint.flip === -1 ? " scale(-1 1)" : ""}`}>{body}</g>
    </svg>
  );
};

export type ForestProps = {
  /** Ground line, 0–1 of the height. */
  ground?: number;
  count?: number;
  /** Tree heights in px (min, max). */
  heights?: [number, number];
  color?: string;
  /** Mixes in this color with distance (pass the air color). */
  air?: string;
  /** 0 = crisp, 1 = fully faded into the air. */
  haze?: number;
  kinds?: TreeProps["kind"][];
  seed?: number;
  /** Horizontal span as 0–1 of the width. */
  from?: number;
  to?: number;
};

/** A row of varied trees (seeded kinds, heights and spacing), not one shape stamped over and over. */
export const Forest: React.FC<ForestProps> = ({
  ground = 0.8,
  count = 14,
  heights = [90, 170],
  color = "#2f9e6e",
  air,
  haze = 0,
  kinds = ["pine", "round", "tall", "pine", "bush"],
  seed = 7,
  from = 0,
  to = 1,
}) => {
  const { W, H } = useBox();
  const fill = air ? mix(color, air, haze) : color;
  const trunk = air ? mix("#5b3a29", air, haze) : "#5b3a29";
  return (
    <AbsoluteFill>
      {Array.from({ length: count }, (_, i) => {
        const jitter = (random01(seed * 50 + i) - 0.5) * 0.6;
        const tx = W * (from + ((to - from) * (i + 0.5 + jitter)) / count);
        const h = heights[0] + (heights[1] - heights[0]) * random01(seed * 70 + i);
        const kind = kinds[Math.floor(random01(seed * 90 + i) * kinds.length)];
        const shade = tone(fill, (random01(seed * 30 + i) - 0.5) * 0.12, (random01(seed * 40 + i) - 0.5) * 10);
        return (
          <Tree
            // biome-ignore lint/suspicious/noArrayIndexKey: generated in a fixed, seeded order
            key={i}
            x={tx}
            y={H * ground + random01(seed * 20 + i) * 6}
            height={kind === "bush" ? h * 0.45 : h}
            kind={kind}
            color={shade}
            trunk={trunk}
            seed={seed * 13 + i}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export type PlanetProps = {
  x: number;
  y: number;
  /** Diameter in px. */
  size: number;
  color?: string;
  /** Atmosphere glow color (null = none). */
  atmosphere?: string | null;
  /** Surface pattern drifting across the disc. */
  surface?: "bands" | "continents" | "craters" | "none";
  surfaceColor?: string;
  rings?: boolean;
  /** Direction of the sun (the lit side). */
  light?: { x: number; y: number };
  /** Surface drift in px per second at the equator. */
  spin?: number;
  seed?: number;
};

/** A planet: lit hemisphere with a soft terminator, rim atmosphere, a drifting surface, optional rings. */
export const Planet: React.FC<PlanetProps> = ({
  x,
  y,
  size,
  color = "#4f7cff",
  atmosphere = "#8fd3ff",
  surface = "continents",
  surfaceColor,
  rings = false,
  light = { x: -0.7, y: -0.5 },
  spin = 12,
  seed = 2,
}) => {
  const frame = useCurrentFrame();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const r = size / 2;
  const len = Math.hypot(light.x, light.y) || 1;
  const lx = light.x / len;
  const ly = light.y / len;
  const drift = ((frame / 30) * spin) % (size * 2);
  const sc = surfaceColor ?? tone(color, -0.15, 15);
  const pad = r * 0.6;
  const blobs = Array.from({ length: 7 }, (_, i) => ({
    cx: random01(seed * 10 + i) * size * 2,
    cy: (random01(seed * 10 + i + 50) - 0.5) * size * 0.9,
    rx: size * (0.12 + random01(seed * 10 + i + 90) * 0.18),
    ry: size * (0.07 + random01(seed * 10 + i + 130) * 0.1),
  }));
  return (
    <svg
      viewBox={`${-r - pad} ${-r - pad} ${size + pad * 2} ${size + pad * 2}`}
      width={size + pad * 2}
      height={size + pad * 2}
      style={{ position: "absolute", left: x - r - pad, top: y - r - pad, overflow: "visible" }}
    >
      <defs>
        <clipPath id={`${id}-disc`}>
          <circle r={r} />
        </clipPath>
        <radialGradient id={`${id}-lit`} cx={0.5 + lx * 0.32} cy={0.5 + ly * 0.32} r={0.85}>
          <stop offset="0%" stopColor={tone(color, 0.22, -6)} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={tone(color, -0.45, 18)} />
        </radialGradient>
        <linearGradient id={`${id}-night`} x1={0.5 + lx * 0.5} y1={0.5 + ly * 0.5} x2={0.5 - lx * 0.5} y2={0.5 - ly * 0.5}>
          <stop offset="0.38" stopColor="#070a24" stopOpacity={0} />
          <stop offset="0.7" stopColor="#070a24" stopOpacity={0.55} />
          <stop offset="1" stopColor="#070a24" stopOpacity={0.78} />
        </linearGradient>
        <radialGradient id={`${id}-atmo`} r={0.5}>
          <stop offset="62%" stopColor={atmosphere ?? "#000"} stopOpacity={0} />
          <stop offset="72%" stopColor={atmosphere ?? "#000"} stopOpacity={0.45} />
          <stop offset="100%" stopColor={atmosphere ?? "#000"} stopOpacity={0} />
        </radialGradient>
      </defs>
      {atmosphere ? <circle r={r * 1.45} fill={`url(#${id}-atmo)`} /> : null}
      {rings ? (
        <ellipse
          rx={r * 1.75}
          ry={r * 0.36}
          fill="none"
          stroke={tone(color, 0.3, -20)}
          strokeOpacity={0.55}
          strokeWidth={r * 0.12}
          transform="rotate(-14)"
        />
      ) : null}
      <circle r={r} fill={`url(#${id}-lit)`} />
      <g clipPath={`url(#${id}-disc)`}>
        {surface === "bands"
          ? [-0.55, -0.25, 0.05, 0.35, 0.6].map((b, i) => (
              <rect key={b} x={-r} y={r * b} width={size} height={r * (0.08 + (i % 2) * 0.06)} fill={sc} opacity={0.35} />
            ))
          : null}
        {surface === "continents"
          ? blobs.map((b, i) => (
              <ellipse
                // biome-ignore lint/suspicious/noArrayIndexKey: generated in a fixed, seeded order
                key={i}
                cx={((b.cx - drift + size * 2) % (size * 2)) - size}
                cy={b.cy}
                rx={b.rx}
                ry={b.ry}
                fill={sc}
                opacity={0.75}
              />
            ))
          : null}
        {surface === "craters"
          ? blobs.map((b, i) => (
              <circle
                // biome-ignore lint/suspicious/noArrayIndexKey: generated in a fixed, seeded order
                key={i}
                cx={((b.cx - drift + size * 2) % (size * 2)) - size}
                cy={b.cy}
                r={b.ry * 0.8}
                fill={tone(color, -0.18)}
                opacity={0.6}
              />
            ))
          : null}
        {/* Night side: a soft terminator away from the light. */}
        <circle r={r} fill={`url(#${id}-night)`} />
      </g>
      {/* Thin lit rim on the sun side. */}
      <circle
        r={r - 1}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.35}
        strokeWidth={Math.max(1.5, r * 0.025)}
        strokeDasharray={`${Math.PI * r * 0.8} ${Math.PI * r * 1.2}`}
        transform={`rotate(${(Math.atan2(ly, lx) * 180) / Math.PI - 72})`}
      />
    </svg>
  );
};

/** A soft radial light (sun, lamp, glowing object): use behind what should glow. */
export const Glow: React.FC<{ x: number; y: number; size: number; color?: string; strength?: number; pulse?: number }> = ({
  x,
  y,
  size,
  color = "#ffd36e",
  strength = 0.7,
  pulse = 0,
}) => {
  const frame = useCurrentFrame();
  const k = 1 + pulse * Math.sin(frame / 12);
  return (
    <div
      style={{
        position: "absolute",
        left: x - (size * k) / 2,
        top: y - (size * k) / 2,
        width: size * k,
        height: size * k,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, ${color}${Math.round(strength * 120)
          .toString(16)
          .padStart(2, "0")} 22%, transparent 70%)`,
        opacity: strength,
        pointerEvents: "none",
      }}
    />
  );
};

/** Slowly drifting specks (dust, spores, plankton, embers) for depth; seeded and loop-free. */
export const Dust: React.FC<{ count?: number; color?: string; size?: number; speed?: number; seed?: number; opacity?: number }> = ({
  count = 40,
  color = "#ffffff",
  size = 4,
  speed = 1,
  seed = 5,
  opacity = 0.35,
}) => {
  const frame = useCurrentFrame();
  const { W, H } = useBox();
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const vx = (random01(seed * 100 + i) - 0.5) * 0.6 * speed;
        const vy = (-0.2 - random01(seed * 100 + i + 1) * 0.5) * speed;
        const px = (((random01(seed * 100 + i + 2) * W + vx * frame) % W) + W) % W;
        const py = (((random01(seed * 100 + i + 3) * H + vy * frame) % H) + H) % H;
        const r = size * (0.4 + random01(seed * 100 + i + 4));
        // biome-ignore lint/suspicious/noArrayIndexKey: generated in a fixed, seeded order
        return <circle key={i} cx={px} cy={py} r={r} fill={color} opacity={opacity * (0.4 + 0.6 * random01(i + seed))} />;
      })}
    </svg>
  );
};

/** A puffy shaded cloud. */
export const Cloud: React.FC<{ x: number; y: number; width: number; color?: string; drift?: number; seed?: number }> = ({
  x,
  y,
  width,
  color = "#f4f1ff",
  drift = 6,
  seed = 1,
}) => {
  const frame = useCurrentFrame();
  const scene = useSceneLight();
  const s = width / 200;
  const dx = (frame / 30) * drift;
  const puffs = [
    [-60, -10, 34],
    [-22, -34, 46],
    [26, -28, 40],
    [62, -8, 30],
    [0, 0, 44],
  ].map(([cx, cy, r], i) => [cx + (random01(seed * 9 + i) - 0.5) * 10, cy, r] as const);
  return (
    <svg
      viewBox="-110 -90 220 120"
      width={220 * s}
      height={120 * s}
      style={{ position: "absolute", left: x - 110 * s + dx, top: y - 90 * s, overflow: "visible" }}
    >
      <Shade depth={9} rim={0} shadow={scene ? undefined : "#6a5fb0"} shadowOpacity={0.35}>
        {puffs.map(([cx, cy, r], i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: generated in a fixed, seeded order
          <circle key={i} cx={cx} cy={cy} r={r} fill={color} />
        ))}
        <rect x={-80} y={-8} width={160} height={34} rx={17} fill={color} />
      </Shade>
    </svg>
  );
};
