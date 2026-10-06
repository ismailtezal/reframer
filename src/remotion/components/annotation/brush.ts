import { random01 } from "../helpers";

/**
 * Geometry for hand-drawn marker strokes. A centre line (dense polyline) is
 * turned into a filled outline whose width varies along it, like pen
 * pressure, with round caps. Pure math, so every renderer draws it the same.
 */

export type Pt = { x: number; y: number };

/** Points of a stroke plus each point's position (0..1) along the WHOLE stroke. */
export type StrokeSlice = { pts: Pt[]; u: number[] };

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Smooth deterministic wobble, roughly in [-1, 1]: a few sines with seeded phases. */
export const wobble = (x: number, seed: number) =>
  0.6 * Math.sin(x + random01(seed) * 6.283) +
  0.3 * Math.sin(x * 2.3 + random01(seed + 1) * 6.283) +
  0.1 * Math.sin(x * 5.1 + random01(seed + 2) * 6.283);

const cumulative = (pts: Pt[]) => {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return acc;
};

/**
 * The part of a polyline between `from` and `to` (fractions of its length).
 * `u` stays relative to the full line so tapers don't slide while it draws on.
 */
export const sliceStroke = (pts: Pt[], from: number, to: number): StrokeSlice => {
  const acc = cumulative(pts);
  const total = acc[acc.length - 1] ?? 0;
  const a = clamp01(from) * total;
  const b = clamp01(to) * total;
  if (pts.length < 2 || total <= 0 || b - a < 0.5) return { pts: [], u: [] };
  const pointAt = (len: number): Pt => {
    let i = 1;
    while (i < acc.length - 1 && acc[i] < len) i++;
    const k = (len - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
    return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
  };
  const out: StrokeSlice = { pts: [pointAt(a)], u: [a / total] };
  for (let i = 1; i < pts.length - 1; i++) {
    if (acc[i] > a + 0.25 && acc[i] < b - 0.25) {
      out.pts.push(pts[i]);
      out.u.push(acc[i] / total);
    }
  }
  out.pts.push(pointAt(b));
  out.u.push(b / total);
  return out;
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const pt = (q: Pt) => `${r2(q.x)} ${r2(q.y)}`;

/** SVG path `d` of the filled outline of a stroke of width `width(u)`, with round caps. */
export const brushPath = ({ pts, u }: StrokeSlice, width: (u: number) => number): string => {
  const n = pts.length;
  if (n < 2) return "";
  const sideA: Pt[] = [];
  const sideB: Pt[] = [];
  const half: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
    const h = Math.max(0.3, width(u[i]) / 2);
    const nx = (-(next.y - prev.y) / len) * h;
    const ny = ((next.x - prev.x) / len) * h;
    half.push(h);
    sideA.push({ x: pts[i].x + nx, y: pts[i].y + ny });
    sideB.push({ x: pts[i].x - nx, y: pts[i].y - ny });
  }
  let d = `M${pt(sideA[0])}`;
  for (let i = 1; i < n; i++) d += `L${pt(sideA[i])}`;
  d += `A${r2(half[n - 1])} ${r2(half[n - 1])} 0 0 0 ${pt(sideB[n - 1])}`;
  for (let i = n - 2; i >= 0; i--) d += `L${pt(sideB[i])}`;
  d += `A${r2(half[0])} ${r2(half[0])} 0 0 0 ${pt(sideA[0])}Z`;
  return d;
};

/** Bounding box of point lists, grown by `pad` on every side. */
export const boundsOf = (lists: Pt[][], pad: number) => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const list of lists) {
    for (const q of list) {
      minX = Math.min(minX, q.x);
      minY = Math.min(minY, q.y);
      maxX = Math.max(maxX, q.x);
      maxY = Math.max(maxY, q.y);
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
};
