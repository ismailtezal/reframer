/**
 * Canvas2D drawing helpers for the 2D cast. Every character is drawn in design units on a 1000-wide canvas space;
 * the canvas transform scales it to the texture. The ink is a dark plum, thicker on the shadow side (bottom right):
 * each shape is first drawn as an ink silhouette nudged toward the shadow, then stroked, then filled, so the line
 * reads hand-drawn rather than a uniform vector stroke.
 */
export const INK = "#2a1c38";

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

/** Seeded PRNG (mulberry32): every wobble is deterministic. */
export const rng = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Smooth closed path through points (Catmull-Rom → Bézier). */
export const smoothPath = (ctx: Ctx, pts: Pt[], closed = true, tension = 0.5) => {
  const n = pts.length;
  const p = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const t = tension / 3;
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t, p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
};

/** A soft blob (head, hands, bodies): an ellipse with per-angle radius scaling. */
export const blobPts = (cx: number, cy: number, rx: number, ry: number, shape: (a: number) => number = () => 1, n = 28): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = shape(a);
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });

/**
 * Fill a closed shape with ink weighted to the shadow side: a nudged ink copy underneath, the stroke, then the fill.
 * `w` is the base line width in design units.
 */
export const inked = (ctx: Ctx, path: () => void, fill: string | CanvasGradient, w = 9, nudge: Pt = [3, 5]) => {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.translate(nudge[0], nudge[1]);
  ctx.beginPath();
  path();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.lineWidth = w;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.lineJoin = "round";
  ctx.beginPath();
  path();
  ctx.lineWidth = w;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
};

/** Clip to a path and paint inside it (shading crescents, patterns). */
export const inside = (ctx: Ctx, path: () => void, paint: () => void) => {
  ctx.save();
  ctx.beginPath();
  path();
  ctx.clip();
  paint();
  ctx.restore();
};

/** A tapered ink stroke along points (brows, folds, hair strands). */
export const taper = (ctx: Ctx, pts: Pt[], w0: number, w1: number, color = INK) => {
  ctx.save();
  ctx.fillStyle = color;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const w = lerp(w0, w1, i / (pts.length - 1)) / 2;
    left.push([pts[i][0] - (dy / l) * w, pts[i][1] + (dx / l) * w]);
    right.push([pts[i][0] + (dy / l) * w, pts[i][1] - (dx / l) * w]);
  }
  ctx.beginPath();
  smoothPath(ctx, [...left, ...right.reverse()], true, 0.35);
  ctx.fill();
  if (w0 > 2) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], w0 / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (w1 > 2) {
    ctx.beginPath();
    ctx.arc(pts[pts.length - 1][0], pts[pts.length - 1][1], w1 / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/** A plain round-capped line. */
export const line = (ctx: Ctx, pts: Pt[], w: number, color = INK, smooth = true) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (smooth && pts.length > 2) smoothPath(ctx, pts, false);
  else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
  ctx.restore();
};

export const ellipse = (ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0) => {
  ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
};

/** Mixes two hex colours. */
export const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const c = (s: number) => Math.round(lerp(ch(pa, s), ch(pb, s), t));
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
};

/** Multiplies a hex colour per channel (shading). */
export const mul = (a: string, k: [number, number, number]) => {
  const p = parseInt(a.slice(1), 16);
  const c = (s: number, f: number) => Math.max(0, Math.min(255, Math.round(((p >> s) & 255) * f)));
  return `#${((1 << 24) | (c(16, k[0]) << 16) | (c(8, k[1]) << 8) | c(0, k[2])).toString(16).slice(1)}`;
};

/** Lavender-tinted shade for skin and cloth (the shadow side), never grey or brown. */
export const SHADE: [number, number, number] = [0.86, 0.8, 0.92];
