import { type Ctx, ellipse, INK, inked, inside, mul, type Pt, SHADE, smoothPath } from "./pen";

/** Shared body parts for the human cast. */
export type HumanBase = { skin: string };

/** A round head with a fuller jaw, a slightly narrower chin and a soft crown: never a perfect circle. */
export const headShape = (cx: number, cy: number, w: number, h: number, seed = 0): Pt[] => {
  const n = 32;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = Math.sin(a); // + = down
    const c = Math.cos(a);
    let k = 1;
    k -= 0.07 * Math.pow(Math.max(0, s), 3); // chin narrows
    k += 0.035 * Math.max(0, s) * (1 - Math.abs(s)) * 2; // fuller cheeks / jaw corners
    k -= 0.025 * Math.pow(Math.max(0, -s), 2); // softer crown
    k += 0.012 * Math.sin(3 * a + seed); // a little hand-drawn asymmetry
    pts.push([cx + c * (w / 2) * k * (1 + 0.02 * c), cy + s * (h / 2) * k]);
  }
  return pts;
};

/** Shade crescent on the side away from the light (screen right), lavender-tinted. */
export const crescentHead = (ctx: Ctx, path: () => void, cx: number, cy: number, w: number, skin: string) => {
  inside(ctx, path, () => {
    ctx.fillStyle = mul(skin, SHADE);
    ctx.fillRect(cx - w, cy - w, w * 2, w * 2);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ellipse(ctx, cx - w * 0.07, cy - w * 0.06, w * 0.5, w * 0.5);
    ctx.fill();
  });
};

/** An arm in a sleeve: a smooth inked tube from shoulder through elbow to wrist, with a darker cuff. */
export const sleeve = (ctx: Ctx, pts: Pt[], color: string, cuff: string, width: number) => {
  const draw = (w: number, col: string, dx = 0, dy = 0) => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = w;
    ctx.strokeStyle = col;
    ctx.beginPath();
    smoothPath(ctx, pts, false, 0.6);
    ctx.stroke();
    ctx.restore();
  };
  draw(width + 18, INK, 3, 5);
  draw(width + 18, INK);
  draw(width, color);
  // shade along the lower edge of the tube
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.lineCap = "round";
  ctx.lineWidth = width * 0.35;
  ctx.strokeStyle = mul(color, SHADE);
  ctx.translate(width * 0.22, width * 0.18);
  ctx.beginPath();
  smoothPath(ctx, pts, false, 0.6);
  ctx.stroke();
  ctx.restore();
  // cuff at the wrist
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / l;
  const uy = (b[1] - a[1]) / l;
  const c0: Pt = [b[0] - ux * 42, b[1] - uy * 42];
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = width + 22;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(c0[0], c0[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.lineWidth = width + 4;
  ctx.strokeStyle = cuff;
  ctx.stroke();
  ctx.restore();
};

/** A cartoon mitt hand: palm with four soft finger bumps and a thumb. `side` −1 = left hand. */
export const hand = (ctx: Ctx, x: number, y: number, skin: string, side: number, rot = 0) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const path = () => {
    smoothPath(
      ctx,
      [
        [-44, -26],
        [-20, -40],
        [8, -40],
        [36, -30],
        [46, -6],
        [44, 18],
        [30, 34],
        [8, 40],
        [-18, 38],
        [-40, 24],
        [-48, 0],
      ],
      true,
      0.5,
    );
  };
  inked(ctx, path, skin, 8, [2, 3]);
  // thumb
  inked(ctx, () => ellipse(ctx, -side * 44, -6, 18, 24, -side * 0.5), skin, 7, [1, 2]);
  // finger lines
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (const fx of [-14, 6, 24]) {
    ctx.beginPath();
    ctx.moveTo(fx, 22);
    ctx.lineTo(fx + 1, 38);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
};
