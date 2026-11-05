import { type Ctx, ellipse, INK, inside, line, mul, type Pt, SHADE, taper } from "./pen";

/** Faces for the human cast: big expressive eyes, thick brows, a small nose and a mouth that can talk. */
export type Mouth = "flat" | "smile" | "grin" | "o" | "teeth" | "wavy" | "frown" | "open" | "sleep" | "smirk";

export type Face = {
  /** top lid: 0 open, 1 shut */
  lid: number;
  /** pupil size (1 = normal, 0.55 = shocked dots) */
  pupil: number;
  /** pupil offset, −1..1 each axis (x right, y down) */
  look: Pt;
  /** brow heights [inner, outer] in head-width % (+ = down) */
  brow: [number, number];
  mouth: Mouth;
  /** mouth open 0..1 (talking flaps on top of the shape) */
  open: number;
  /** ^ ^ happy arcs instead of open eyes */
  happy?: boolean;
  /** asleep: closed arcs */
  closed?: boolean;
  /** eye bags 0..1 */
  bags?: number;
  sweat?: number;
  /** catchlights in the eyes */
  shine?: boolean;
};

export const FACES: Record<string, Face> = {
  neutral: { lid: 0.2, pupil: 1, look: [0, 0.1], brow: [0, 0], mouth: "flat", open: 0, shine: true },
  tired: { lid: 0.42, pupil: 0.95, look: [0.15, 0.25], brow: [1, 2.5], mouth: "flat", open: 0, bags: 0.8, shine: true },
  exhausted: { lid: 0.4, pupil: 0.85, look: [0.25, 0.35], brow: [2, 3.5], mouth: "wavy", open: 0.15, bags: 1, shine: false },
  shock: { lid: 0, pupil: 0.55, look: [0, -0.1], brow: [-7, -6], mouth: "o", open: 0.8, sweat: 1, shine: true },
  determined: { lid: 0.22, pupil: 0.9, look: [0.35, 0.35], brow: [4, -2.5], mouth: "teeth", open: 0, shine: true },
  confused: { lid: 0.15, pupil: 0.9, look: [-0.4, -0.55], brow: [-4, 1], mouth: "wavy", open: 0.1, shine: true },
  awe: { lid: 0, pupil: 0.8, look: [0, -0.9], brow: [-5, -3], mouth: "o", open: 0.45, shine: true },
  panic: { lid: 0, pupil: 0.5, look: [0, 0], brow: [-6, 2], mouth: "wavy", open: 0.7, sweat: 1, shine: true },
  realize: { lid: 0.12, pupil: 1.05, look: [0, -0.05], brow: [-3.5, 1.5], mouth: "o", open: 0.2, bags: 0.7, shine: true },
  sad: { lid: 0.32, pupil: 1, look: [0.1, 0.3], brow: [-3, 2], mouth: "frown", open: 0, bags: 0.8, shine: true },
  grin: { lid: 0, pupil: 0.85, look: [0, 0], brow: [-3, -3], mouth: "grin", open: 0, happy: true },
  beam: { lid: 0, pupil: 0.85, look: [-0.3, 0], brow: [-4, -4], mouth: "grin", open: 0.3, shine: true },
  smile: { lid: 0.15, pupil: 1, look: [0.2, 0.2], brow: [-1, -1], mouth: "smile", open: 0, shine: true },
  focus: { lid: 0.3, pupil: 0.9, look: [0.3, 0.45], brow: [2, 0], mouth: "flat", open: 0, shine: true },
  asleep: { lid: 1, pupil: 1, look: [0, 0], brow: [0.5, 0.5], mouth: "sleep", open: 0.4, closed: true, bags: 0.6 },
};

export type FaceGeom = {
  cx: number;
  cy: number;
  /** head width (design units) */
  w: number;
  skin: string;
  /** where the face points: −1 left .. 1 right (features slide that way) */
  facing: number;
  glasses?: boolean;
  browColor?: string;
};

/** Draws eyes, brows, nose and mouth. `blink` (0..1) closes the lids on top of the expression. */
export const drawFace = (ctx: Ctx, g: FaceGeom, f: Face, blink = 0) => {
  const u = g.w / 100;
  const fx = g.facing * 4 * u;
  const eyeY = g.cy + 2 * u;
  const eyeDX = 20 * u;
  const erx = 9.6 * u;
  const ery = 11 * u;
  const lid = Math.min(1, Math.max(f.lid, blink));
  const shut = f.closed || lid > 0.92;

  // eye bags (tired)
  if (f.bags && !shut) {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.globalAlpha = 0.55 * f.bags;
      line(ctx, [[g.cx + fx + s * eyeDX - 7 * u, eyeY + ery + 2.2 * u], [g.cx + fx + s * eyeDX, eyeY + ery + 4.4 * u], [g.cx + fx + s * eyeDX + 7 * u, eyeY + ery + 2.2 * u]], 1.8 * u, "#8a6aa8");
      ctx.restore();
    }
  }

  for (const s of [-1, 1]) {
    const ex = g.cx + fx + s * eyeDX;
    if (f.happy) {
      line(ctx, [[ex - erx, eyeY + 2 * u], [ex, eyeY - ery * 0.75], [ex + erx, eyeY + 2 * u]], 2.6 * u);
      continue;
    }
    if (shut) {
      line(ctx, [[ex - erx, eyeY], [ex, eyeY + ery * 0.45], [ex + erx, eyeY]], 2.4 * u);
      continue;
    }
    const eyePath = () => ellipse(ctx, ex, eyeY, erx, ery);
    // sclera
    ctx.beginPath();
    eyePath();
    ctx.fillStyle = "#fffdf8";
    ctx.fill();
    inside(ctx, eyePath, () => {
      // pupil + iris
      const pr = 5.2 * u * f.pupil;
      const px = ex + f.look[0] * (erx - pr - 0.8 * u);
      const py = eyeY + f.look[1] * (ery - pr - 0.8 * u);
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = "#1d1428";
      ctx.fill();
      if (f.shine) {
        ctx.beginPath();
        ctx.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
      // upper lid in skin colour, with its ink edge
      if (lid > 0.01) {
        const ly = eyeY - ery + lid * 2 * ery;
        ctx.beginPath();
        ctx.rect(ex - erx - 2, eyeY - ery - 4, erx * 2 + 4, ly - (eyeY - ery) + 4);
        ctx.fillStyle = mul(g.skin, [0.96, 0.9, 0.92]);
        ctx.fill();
        line(ctx, [[ex - erx - 2, ly], [ex + erx + 2, ly]], 2.2 * u, INK, false);
      }
    });
    ctx.beginPath();
    eyePath();
    ctx.lineWidth = 1.9 * u;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  // glasses (Mehmet): round frames over the eyes
  if (g.glasses) {
    const gr = 15.5 * u;
    ctx.save();
    for (const s of [-1, 1]) {
      const ex = g.cx + fx + s * eyeDX;
      ctx.beginPath();
      ctx.arc(ex, eyeY + 0.5 * u, gr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(190,225,255,0.10)";
      ctx.fill();
      // glare stripe
      inside(ctx, () => ctx.arc(ex, eyeY + 0.5 * u, gr, 0, Math.PI * 2), () => {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(ex - gr, eyeY - gr * 0.2);
        ctx.lineTo(ex - gr * 0.2, eyeY - gr);
        ctx.lineTo(ex + gr * 0.15, eyeY - gr);
        ctx.lineTo(ex - gr, eyeY + gr * 0.25);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      ctx.beginPath();
      ctx.arc(ex, eyeY + 0.5 * u, gr, 0, Math.PI * 2);
      ctx.lineWidth = 3.4 * u;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    line(ctx, [[g.cx + fx - eyeDX + gr, eyeY - 1 * u], [g.cx + fx, eyeY - 2.6 * u], [g.cx + fx + eyeDX - gr, eyeY - 1 * u]], 3 * u);
    ctx.restore();
  }

  // brows: thick tapered strokes
  const by = eyeY - ery - (g.glasses ? 8.5 : 5.5) * u;
  for (const s of [-1, 1]) {
    const ex = g.cx + fx + s * eyeDX;
    const inner: Pt = [ex - s * 8 * u, by + f.brow[0] * u];
    const mid: Pt = [ex, by - 1.6 * u + (f.brow[0] + f.brow[1]) * 0.5 * u];
    const outer: Pt = [ex + s * 9.5 * u, by + f.brow[1] * u];
    taper(ctx, [inner, mid, outer], 5.2 * u, 2.6 * u, g.browColor ?? INK);
  }

  // nose: a small soft hook
  const nx = g.cx + fx * 1.6;
  const ny = eyeY + ery + 4 * u;
  line(ctx, [[nx - 2.2 * u, ny - 3 * u], [nx + 2.4 * u, ny + 1.6 * u], [nx - 1.4 * u, ny + 3.2 * u]], 2.2 * u);

  // sweat drop
  if (f.sweat) {
    const sx = g.cx + g.w * 0.43;
    const sy = g.cy - g.w * 0.12;
    ctx.save();
    ctx.globalAlpha = f.sweat;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 7 * u);
    ctx.quadraticCurveTo(sx + 4.6 * u, sy + 1 * u, sx, sy + 3.4 * u);
    ctx.quadraticCurveTo(sx - 4.6 * u, sy + 1 * u, sx, sy - 7 * u);
    ctx.fillStyle = "#a8dcff";
    ctx.fill();
    ctx.lineWidth = 1.6 * u;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  }

  drawMouth(ctx, g.cx + fx * 1.3, eyeY + ery + 15.5 * u, u, f.mouth, f.open, g.skin);
};

const drawMouth = (ctx: Ctx, mx: number, my: number, u: number, m: Mouth, open: number, skin: string) => {
  const lw = 2.4 * u;
  const opening = (wd: number, ht: number, teeth = false) => {
    const path = () => {
      ctx.moveTo(mx - wd, my - ht * 0.15);
      ctx.quadraticCurveTo(mx, my - ht * 0.35, mx + wd, my - ht * 0.15);
      ctx.quadraticCurveTo(mx + wd * 0.8, my + ht, mx, my + ht);
      ctx.quadraticCurveTo(mx - wd * 0.8, my + ht, mx - wd, my - ht * 0.15);
      ctx.closePath();
    };
    ctx.beginPath();
    path();
    ctx.fillStyle = "#5a1e33";
    ctx.fill();
    inside(ctx, path, () => {
      ctx.fillStyle = "#e9707e";
      ctx.beginPath();
      ellipse(ctx, mx, my + ht * 0.95, wd * 0.6, ht * 0.45);
      ctx.fill();
      if (teeth) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(mx - wd, my - ht * 0.4, wd * 2, ht * 0.32);
      }
    });
    ctx.beginPath();
    path();
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.stroke();
  };
  const talk = open > 0.05;
  switch (m) {
    case "flat":
      if (talk) opening(6 * u, 7 * u * open);
      else line(ctx, [[mx - 6 * u, my], [mx + 6 * u, my + 0.6 * u]], lw);
      break;
    case "smirk":
      line(ctx, [[mx - 6 * u, my + 0.5 * u], [mx + 2 * u, my + 1 * u], [mx + 7 * u, my - 1.6 * u]], lw);
      break;
    case "smile":
      if (talk) opening(8 * u, 4 * u + 7 * u * open);
      else line(ctx, [[mx - 8 * u, my - 1.5 * u], [mx, my + 3 * u], [mx + 8 * u, my - 1.5 * u]], lw);
      break;
    case "grin":
      opening(11 * u, 6 * u + 7 * u * open, true);
      break;
    case "o":
      {
        const r = 3.2 * u + 3.6 * u * open;
        const path = () => ellipse(ctx, mx, my + r * 0.3, r * 0.8, r);
        ctx.beginPath();
        path();
        ctx.fillStyle = "#5a1e33";
        ctx.fill();
        ctx.lineWidth = lw;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      break;
    case "teeth":
      {
        const wd = 9 * u;
        const ht = 3.2 * u + 3 * u * open;
        ctx.beginPath();
        ctx.rect(mx - wd, my - ht / 2, wd * 2, ht);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = lw;
        ctx.strokeStyle = INK;
        ctx.stroke();
        line(ctx, [[mx - wd, my], [mx + wd, my]], 1.3 * u, INK, false);
        for (const k of [-0.5, 0, 0.5]) line(ctx, [[mx + k * wd, my - ht / 2], [mx + k * wd, my + ht / 2]], 1.1 * u, INK, false);
      }
      break;
    case "wavy":
      if (open > 0.2) opening(7 * u, 6 * u * open);
      line(ctx, [[mx - 8 * u, my + 1 * u], [mx - 4 * u, my - 1.4 * u], [mx, my + 1 * u], [mx + 4 * u, my - 1.4 * u], [mx + 8 * u, my + 1 * u]], lw);
      break;
    case "frown":
      line(ctx, [[mx - 7 * u, my + 2.2 * u], [mx, my - 1.4 * u], [mx + 7 * u, my + 2.2 * u]], lw);
      break;
    case "open":
      opening(8 * u, 4 * u + 8 * u * open);
      break;
    case "sleep":
      {
        const r = 2.6 * u + 1.6 * u * open;
        ctx.beginPath();
        ellipse(ctx, mx + 2 * u, my + 1 * u, r, r * 0.8);
        ctx.fillStyle = "#5a1e33";
        ctx.fill();
        ctx.lineWidth = lw * 0.9;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      break;
  }
  void skin;
};

/** Shading crescent on a head/blob: the side away from the light, lavender-tinted. */
export const crescent = (ctx: Ctx, path: () => void, cx: number, cy: number, w: number, color: string, side = 1) => {
  inside(ctx, path, () => {
    ctx.fillStyle = mul(color, SHADE);
    ctx.beginPath();
    ellipse(ctx, cx + side * w * 0.62, cy + w * 0.12, w * 0.5, w * 0.75);
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
};
