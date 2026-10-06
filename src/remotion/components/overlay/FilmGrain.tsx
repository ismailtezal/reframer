import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { random01 } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  amount: number;
  /** grain size multiplier */
  size: number;
  dust: number;
  scratches: number;
  vignette: number;
  /** exposure flicker */
  flicker: number;
  seed: number;
};

/**
 * Overlay grain for normal blending: each tile pixel is a white or black speck
 * whose alpha follows a bell-shaped noise value. Clips are isolated groups, so an
 * `overlay` blend inside a component cannot reach the footage below — this can.
 */
const SPECKLE_TILE = 192;
const SPECKLE_COUNT = 6;
const speckles: string[] = [];

const makeSpeckle = (seed: number): string => {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = SPECKLE_TILE;
  canvas.height = SPECKLE_TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(SPECKLE_TILE, SPECKLE_TILE);
  let s = (seed * 2654435761) >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (next() + next() + next() - 1.5) / 1.5; // ≈ normal in [-1, 1]
    const c = v > 0 ? 255 : 0;
    img.data[i] = c;
    img.data[i + 1] = c;
    img.data[i + 2] = c;
    img.data[i + 3] = Math.min(255, Math.abs(v) * 340);
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
};

/** Cached speckle tile (data URL) for a frame; cycle through with any integer. */
export const getSpeckleTile = (index: number): string => {
  const i = ((Math.floor(index) % SPECKLE_COUNT) + SPECKLE_COUNT) % SPECKLE_COUNT;
  if (speckles[i] === undefined) speckles[i] = makeSpeckle(i + 7);
  return speckles[i];
};

export const SPECKLE_TILE_SIZE = SPECKLE_TILE;

type Speck = {
  id: string;
  kind: "speck" | "hair";
  x: number;
  y: number;
  r: number;
  ry: number;
  rot: number;
  dark: boolean;
  a: number;
  d: string;
};
type Scratch = { id: string; x: number; y0: number; y1: number; wpx: number; a: number; dark: boolean };

const FilmGrain: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  // Dirt, scratches and flicker change on film frames (24 fps), like a real print.
  const ff = Math.floor((frame * 24) / fps);
  const seed = p.seed * 1000;
  const tilePx = SPECKLE_TILE * 1.35 * unit * Math.max(0.3, p.size);
  const ox = random01(ff * 3.17 + seed + 1) * tilePx;
  const oy = random01(ff * 5.31 + seed + 2) * tilePx;

  const specks: Speck[] = [];
  const candidates = Math.round(4 + p.dust * 14);
  for (let i = 0; i < candidates; i++) {
    const r = (k: number) => random01(ff * 31.1 + i * 7.7 + k * 1.37 + seed + 3);
    if (r(1) > p.dust * 0.42) continue;
    const x = r(2) * w;
    const y = r(3) * h;
    const dark = r(4) < 0.78;
    if (r(5) < 0.22) {
      // A curled hair caught in the gate.
      const len = (24 + r(6) * 60) * unit;
      const ang = r(7) * Math.PI * 2;
      const ex = x + Math.cos(ang) * len;
      const ey = y + Math.sin(ang) * len;
      const bend = (r(8) - 0.5) * len * 0.9;
      const cx = (x + ex) / 2 - Math.sin(ang) * bend;
      const cy = (y + ey) / 2 + Math.cos(ang) * bend;
      specks.push({
        id: `h${i}`,
        kind: "hair",
        x,
        y,
        r: 0,
        ry: 0,
        rot: 0,
        dark,
        a: 0.35 + r(9) * 0.4,
        d: `M${x} ${y}Q${cx} ${cy} ${ex} ${ey}`,
      });
    } else {
      const rad = (1.4 + r(6) ** 2 * 5.5) * unit;
      specks.push({
        id: `s${i}`,
        kind: "speck",
        x,
        y,
        r: rad,
        ry: rad * (0.45 + r(7) * 0.55),
        rot: r(8) * 180,
        dark,
        a: 0.45 + r(9) * 0.45,
        d: "",
      });
    }
  }

  const scratches: Scratch[] = [];
  const slots = Math.round(p.scratches * 4);
  for (let s = 0; s < slots; s++) {
    const life = 8 + Math.floor(random01(seed + s * 9.7 + 4) * 18);
    const u = ff + Math.floor(random01(seed + s * 3.3 + 5) * life);
    const cycle = Math.floor(u / life);
    const rc = (k: number) => random01(cycle * 17.3 + s * 41.9 + k * 2.9 + seed + 6);
    if (rc(1) > 0.6) continue;
    const jitter = (random01(ff * 11.3 + s * 5.1 + seed) - 0.5) * 3 * unit;
    const full = rc(2) < 0.6;
    const y0 = full ? 0 : rc(3) * h * 0.6;
    scratches.push({
      id: `k${s}`,
      x: rc(4) * w + ((u % life) / life) * rc(5) * 30 * unit + jitter,
      y0,
      y1: full ? h : y0 + (0.25 + rc(6) * 0.5) * h,
      wpx: (0.8 + rc(7) * 1.2) * unit,
      a: (0.08 + rc(8) * 0.16) * (0.55 + 0.45 * random01(ff * 7.9 + s + seed)),
      dark: rc(9) < 0.3,
    });
  }

  const flick = p.flicker * 0.07 * random01(ff * 13.7 + seed + 8);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", pointerEvents: "none" }}>
      {p.vignette > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 72% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${(p.vignette * 0.45).toFixed(3)}) 82%, rgba(0,0,0,${(p.vignette * 0.85).toFixed(3)}) 100%)`,
          }}
        />
      ) : null}
      {flick > 0.001 ? <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${flick.toFixed(3)})` }} /> : null}
      {p.amount > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${getSpeckleTile(ff)})`,
            backgroundSize: `${tilePx.toFixed(1)}px`,
            backgroundPosition: `${ox.toFixed(1)}px ${oy.toFixed(1)}px`,
            opacity: Math.min(1, p.amount * 0.34),
          }}
        />
      ) : null}
      {specks.length + scratches.length > 0 ? (
        <svg
          aria-hidden="true"
          width="100%"
          height="100%"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, display: "block" }}
        >
          {scratches.map((s) => (
            <rect key={s.id} x={s.x} y={s.y0} width={s.wpx} height={s.y1 - s.y0} fill={s.dark ? "#000000" : "#FFFFFF"} opacity={s.a} />
          ))}
          {specks.map((s) =>
            s.kind === "hair" ? (
              <path
                key={s.id}
                d={s.d}
                fill="none"
                stroke={s.dark ? "#000000" : "#FFFFFF"}
                strokeWidth={1.3 * unit}
                strokeLinecap="round"
                opacity={s.a}
              />
            ) : (
              <ellipse
                key={s.id}
                cx={s.x}
                cy={s.y}
                rx={s.r}
                ry={s.ry}
                transform={`rotate(${s.rot} ${s.x} ${s.y})`}
                fill={s.dark ? "#000000" : "#FFFFFF"}
                opacity={s.a}
              />
            ),
          )}
        </svg>
      ) : null}
    </div>
  );
};

export const filmGrain = defineMotionComponent<Props>({
  id: "film-grain",
  name: "Film grain",
  category: "overlay",
  description:
    "Analog film texture over everything below it: animated grain, occasional dust, hairs and gate scratches on a 24 fps cadence, a soft vignette and exposure flicker. Put it on the top track across the whole edit; keep amount 0.3-0.6 for subtle polish, raise dust/scratches only for a deliberately vintage look.",
  schema: {
    amount: { type: "number", label: "Grain", default: 0.45, min: 0, max: 1, step: 0.05 },
    size: { type: "number", label: "Grain size", default: 1, min: 0.5, max: 3, step: 0.05 },
    dust: { type: "number", label: "Dust", default: 0.3, min: 0, max: 1, step: 0.05 },
    scratches: { type: "number", label: "Scratches", default: 0.25, min: 0, max: 1, step: 0.05 },
    vignette: { type: "number", label: "Vignette", default: 0.3, min: 0, max: 1, step: 0.05 },
    flicker: { type: "number", label: "Flicker", default: 0.25, min: 0, max: 1, step: 0.05 },
    seed: { type: "number", label: "Seed", default: 0, min: 0, max: 100, step: 1 },
  },
  defaults: {
    amount: 0.45,
    size: 1,
    dust: 0.3,
    scratches: 0.25,
    vignette: 0.3,
    flicker: 0.25,
    seed: 0,
  },
  defaultDuration: 6,
  Component: FilmGrain,
  tags: ["overlay", "film", "grain", "vintage", "texture", "analog"],
});
