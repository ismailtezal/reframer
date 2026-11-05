import { crescentHead, hand, headShape, sleeve } from "./body";
import { drawFace, type Face } from "./face";
import { type Ctx, ellipse, INK, inked, inside, line, mul, type Pt, SHADE, smoothPath, taper } from "./pen";

/**
 * Mehmet: a tired developer in his thirties. Round head, messy dark hair with a cowlick, big round glasses over big
 * eyes, a mustard hoodie with a "</>" print and drawstrings. Seated card: 1000 × 1400 design units (1 unit = 1 mm);
 * the desk top sits at y ≈ 1080 on the card. Standing card: 1000 × 1800, feet at y ≈ 1780.
 */
export const MEHMET = {
  skin: "#f2c6a0",
  hair: "#2f2230",
  hoodie: "#f0b43c",
  hoodieDark: "#c98a22",
  cuff: "#d99a2a",
  jeans: "#3e5f9e",
  shoe: "#f4f1ea",
  mug: "#fdfaf3",
};

export type MehmetPose = "type" | "mug" | "scratch" | "panic" | "slump" | "sleep" | "back" | "stand" | "lookUp";

export type MehmetState = {
  pose: MehmetPose;
  face: Face;
  blink: number;
  /** typing phase (radians); hands alternate */
  typing: number;
  /** typing intensity 0..1 */
  typeAmp: number;
  /** head tilt (radians, + = clockwise) */
  tilt: number;
  /** head bob (units, + = down) */
  bob: number;
  /** hair messiness 0..1 (3 AM) */
  messy: number;
  /** shoulders drop (units) */
  slump: number;
};

const S = MEHMET;

const hair = (ctx: Ctx, cx: number, cy: number, w: number, messy: number) => {
  const h = w * 0.96;
  // cap of hair over the crown, with spiky fringe
  const pts: Pt[] = [];
  const n = 15;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI; // left → over the top → right
    const r = 1.06 + (i % 2 === 0 ? 0.035 : 0) + messy * (i % 3 === 0 ? 0.06 : 0);
    pts.push([cx + Math.cos(a) * w * 0.52 * r, cy - h * 0.06 + Math.sin(a) * h * 0.53 * r]);
  }
  // fringe back across the forehead (right → left), uneven
  const fringe: Pt[] = [
    [cx + w * 0.5, cy - h * 0.02],
    [cx + w * 0.38, cy - h * 0.2],
    [cx + w * 0.3, cy - h * 0.12],
    [cx + w * 0.16, cy - h * 0.25],
    [cx + w * 0.05, cy - h * 0.16],
    [cx - w * 0.1, cy - h * 0.27],
    [cx - w * 0.2, cy - h * 0.17],
    [cx - w * 0.34, cy - h * 0.24],
    [cx - w * 0.45, cy - h * 0.08],
    [cx - w * 0.52, cy + h * 0.02],
  ];
  const path = () => smoothPath(ctx, [...pts, ...fringe], true, 0.32);
  inked(ctx, path, S.hair, 8, [2, 3]);
  // sheen
  inside(ctx, path, () => {
    ctx.globalAlpha = 0.18;
    line(
      ctx,
      [
        [cx - w * 0.28, cy - h * 0.42],
        [cx - w * 0.05, cy - h * 0.48],
        [cx + w * 0.18, cy - h * 0.44],
      ],
      10,
      "#8c7aa6",
    );
    ctx.globalAlpha = 1;
  });
  // cowlick
  taper(
    ctx,
    [
      [cx + w * 0.05, cy - h * 0.52],
      [cx + w * 0.11, cy - h * 0.66 - messy * 20],
      [cx + w * 0.2, cy - h * 0.63 - messy * 26],
    ],
    16,
    3,
    S.hair,
  );
  line(
    ctx,
    [
      [cx + w * 0.05, cy - h * 0.53],
      [cx + w * 0.11, cy - h * 0.66 - messy * 20],
      [cx + w * 0.2, cy - h * 0.63 - messy * 26],
    ],
    5,
  );
  if (messy > 0.3) {
    taper(
      ctx,
      [
        [cx - w * 0.3, cy - h * 0.45],
        [cx - w * 0.42, cy - h * 0.6],
        [cx - w * 0.5, cy - h * 0.58],
      ],
      12,
      3,
      S.hair,
    );
    line(
      ctx,
      [
        [cx - w * 0.3, cy - h * 0.46],
        [cx - w * 0.42, cy - h * 0.6],
        [cx - w * 0.5, cy - h * 0.58],
      ],
      4.5,
    );
  }
};

const hairBack = (ctx: Ctx, cx: number, cy: number, w: number) => {
  const path = () => smoothPath(ctx, headShape(cx, cy - 6, w * 1.03, w * 1.0), true);
  inked(ctx, path, S.hair, 8, [2, 3]);
  inside(ctx, path, () => {
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 5; i++)
      line(
        ctx,
        [
          [cx - w * 0.3 + i * w * 0.15, cy - w * 0.45],
          [cx - w * 0.25 + i * w * 0.14, cy + w * 0.1],
        ],
        6,
        "#8c7aa6",
      );
    ctx.globalAlpha = 1;
  });
};

const head = (ctx: Ctx, st: MehmetState, cx: number, cy: number, w: number) => {
  // ears
  for (const s of [-1, 1]) {
    inked(ctx, () => ellipse(ctx, cx + s * w * 0.5, cy + w * 0.04, w * 0.075, w * 0.11), S.skin, 7);
  }
  const path = () => smoothPath(ctx, headShape(cx, cy, w, w * 0.96), true);
  inked(ctx, path, S.skin, 9, [3, 5]);
  crescentHead(ctx, path, cx, cy, w, S.skin);
  // a hint of stubble on the chin (more at 3 AM)
  inside(ctx, path, () => {
    ctx.globalAlpha = 0.045 + st.messy * 0.035;
    ctx.fillStyle = "#4a4a7a";
    ctx.beginPath();
    ellipse(ctx, cx, cy + w * 0.47, w * 0.24, w * 0.11);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  hair(ctx, cx, cy, w, st.messy);
  drawFace(ctx, { cx, cy, w, skin: S.skin, facing: 0.15, glasses: true, browColor: S.hair }, st.face, st.blink);
};

const hoodieTorso = (ctx: Ctx, top: number, bottom: number, cx: number, wTop: number, wBot: number) => {
  const path = () => {
    ctx.moveTo(cx - wTop / 2 + 50, top);
    ctx.quadraticCurveTo(cx - wTop / 2 - 10, top + 10, cx - wTop / 2, top + 90);
    ctx.lineTo(cx - wBot / 2, bottom);
    ctx.lineTo(cx + wBot / 2, bottom);
    ctx.lineTo(cx + wTop / 2, top + 90);
    ctx.quadraticCurveTo(cx + wTop / 2 + 10, top + 10, cx + wTop / 2 - 50, top);
    ctx.closePath();
  };
  inked(ctx, path, S.hoodie, 10, [4, 6]);
  // side shade (away from the window light) + a soft fold
  inside(ctx, path, () => {
    const g = ctx.createLinearGradient(cx - wBot / 2, 0, cx + wBot / 2, 0);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.62, "rgba(0,0,0,0)");
    g.addColorStop(1, mul(S.hoodie, SHADE));
    ctx.fillStyle = g;
    ctx.fillRect(cx - wBot, top, wBot * 2, bottom - top);
  });
  return path;
};

const hoodFront = (ctx: Ctx, cx: number, top: number) => {
  // hood roll around the neck
  const path = () => {
    ctx.moveTo(cx - 175, top + 10);
    ctx.quadraticCurveTo(cx, top - 40, cx + 175, top + 10);
    ctx.quadraticCurveTo(cx + 120, top + 95, cx, top + 100);
    ctx.quadraticCurveTo(cx - 120, top + 95, cx - 175, top + 10);
    ctx.closePath();
  };
  inked(ctx, path, S.hoodieDark, 9, [2, 4]);
  // collar opening
  inked(
    ctx,
    () => {
      ctx.moveTo(cx - 70, top + 20);
      ctx.quadraticCurveTo(cx, top + 85, cx + 70, top + 20);
      ctx.quadraticCurveTo(cx, top + 40, cx - 70, top + 20);
    },
    mul(S.skin, [0.82, 0.74, 0.84]),
    6,
    [1, 2],
  );
  // drawstrings
  for (const s of [-1, 1]) {
    line(
      ctx,
      [
        [cx + s * 45, top + 70],
        [cx + s * 52, top + 150],
        [cx + s * 46, top + 205],
      ],
      9,
      "#fff7e8",
    );
    line(
      ctx,
      [
        [cx + s * 45, top + 70],
        [cx + s * 52, top + 150],
        [cx + s * 46, top + 205],
      ],
      3,
      INK,
    );
    inked(ctx, () => ellipse(ctx, cx + s * 46, top + 216, 9, 14), "#e8e2d4", 4, [1, 1]);
  }
};

const print = (ctx: Ctx, cx: number, cy: number) => {
  ctx.save();
  ctx.font = "800 70px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff4d8";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.lineJoin = "round";
  ctx.strokeText("</>", cx, cy);
  ctx.fillText("</>", cx, cy);
  ctx.restore();
};

const mug = (ctx: Ctx, x: number, y: number) => {
  const body = () => {
    ctx.moveTo(x - 52, y - 70);
    ctx.lineTo(x + 52, y - 70);
    ctx.quadraticCurveTo(x + 54, y + 40, x + 44, y + 60);
    ctx.lineTo(x - 44, y + 60);
    ctx.quadraticCurveTo(x - 54, y + 40, x - 52, y - 70);
    ctx.closePath();
  };
  // handle
  ctx.save();
  ctx.lineWidth = 22;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(x + 58, y - 5, 30, -1.2, 1.2);
  ctx.stroke();
  ctx.lineWidth = 12;
  ctx.strokeStyle = S.mug;
  ctx.stroke();
  ctx.restore();
  inked(ctx, body, S.mug, 8, [2, 3]);
  inside(ctx, body, () => {
    ctx.fillStyle = "#e4483b";
    ctx.fillRect(x - 60, y - 30, 120, 22);
    ctx.fillStyle = mul(S.mug, SHADE);
    ctx.fillRect(x + 25, y - 75, 40, 140);
  });
  ctx.beginPath();
  ellipse(ctx, x, y - 70, 50, 10);
  ctx.fillStyle = "#4a2a1a";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
};

/** Seated / standing Mehmet. */
export const drawMehmet: (ctx: Ctx, st: MehmetState) => void = (ctx, st) => {
  if (st.pose === "stand" || st.pose === "lookUp") return drawStanding(ctx, st);
  if (st.pose === "sleep") return drawSleeping(ctx, st);
  const cx = 500;
  const sh = 640 + st.slump;
  const typeA = (k: number) => Math.max(0, Math.sin(st.typing + k * 2.1)) * 26 * st.typeAmp;

  if (st.pose === "back") {
    // from behind: hood, shoulders, elbows out toward the desk
    hoodieTorso(ctx, sh - 10, 1400, cx, 720, 780);
    for (const s of [-1, 1])
      sleeve(
        ctx,
        [
          [cx + s * 330, sh + 80],
          [cx + s * 380, sh + 300],
          [cx + s * 260, 1060],
        ],
        S.hoodie,
        S.cuff,
        120,
      );
    const hood = () => {
      ctx.moveTo(cx - 190, sh + 10);
      ctx.quadraticCurveTo(cx, sh - 60, cx + 190, sh + 10);
      ctx.quadraticCurveTo(cx + 150, sh + 210, cx, sh + 240);
      ctx.quadraticCurveTo(cx - 150, sh + 210, cx - 190, sh + 10);
    };
    inked(ctx, hood, S.hoodieDark, 9, [2, 4]);
    ctx.save();
    ctx.translate(cx, 380 + st.bob);
    ctx.rotate(st.tilt);
    for (const s of [-1, 1]) inked(ctx, () => ellipse(ctx, s * 220, 20, 33, 48), S.skin, 7);
    hairBack(ctx, 0, 0, 440);
    ctx.restore();
    return;
  }

  // body
  hoodieTorso(ctx, sh, 1400, cx, 700 - st.slump * 0.4, 760);
  print(ctx, cx, sh + 300);
  // arms behind/in front depending on pose
  const L: Pt[] = [];
  const R: Pt[] = [];
  let mugAt: Pt | null = null;
  let handL: Pt = [cx - 130, 1075 - typeA(0)];
  let handR: Pt = [cx + 130, 1075 - typeA(1)];
  switch (st.pose) {
    case "type":
      L.push([cx - 300, sh + 90], [cx - 360, sh + 330], [handL[0] - 40, handL[1] - 20]);
      R.push([cx + 300, sh + 90], [cx + 360, sh + 330], [handR[0] + 40, handR[1] - 20]);
      break;
    case "mug":
      L.push([cx - 300, sh + 90], [cx - 360, sh + 330], [handL[0] - 40, handL[1] - 20]);
      handR = [cx + 210, sh + 250];
      R.push([cx + 300, sh + 90], [cx + 380, sh + 400], [handR[0] + 30, handR[1] + 50]);
      mugAt = [handR[0] - 30, handR[1] - 40];
      break;
    case "scratch":
      L.push([cx - 300, sh + 90], [cx - 360, sh + 330], [handL[0] - 40, handL[1] - 20]);
      handR = [cx + 170, 170 + st.bob + Math.sin(st.typing * 2) * 10];
      R.push([cx + 300, sh + 90], [cx + 420, sh - 120], [handR[0] + 40, handR[1] + 50]);
      break;
    case "panic":
      handL = [cx - 230, 330 + st.bob];
      handR = [cx + 230, 330 + st.bob];
      L.push([cx - 300, sh + 90], [cx - 430, sh - 40], [handL[0] - 30, handL[1] + 50]);
      R.push([cx + 300, sh + 90], [cx + 430, sh - 40], [handR[0] + 30, handR[1] + 50]);
      break;
    case "slump":
      handL = [cx - 230, 1110];
      handR = [cx + 230, 1110];
      L.push([cx - 290, sh + 90], [cx - 330, sh + 330], [handL[0] - 10, handL[1] - 40]);
      R.push([cx + 290, sh + 90], [cx + 330, sh + 330], [handR[0] + 10, handR[1] - 40]);
      break;
  }
  const armsOverHead = st.pose === "panic" || st.pose === "scratch";
  if (!armsOverHead) {
    sleeve(ctx, L, S.hoodie, S.cuff, 112);
    sleeve(ctx, R, S.hoodie, S.cuff, 112);
  }
  hoodFront(ctx, cx, sh - 8);
  // head
  ctx.save();
  ctx.translate(cx, 380 + st.bob);
  ctx.rotate(st.tilt);
  ctx.translate(-cx, -380);
  // neck
  inked(ctx, () => ctx.rect(cx - 52, 520, 104, 120), mul(S.skin, [0.9, 0.84, 0.9]), 7, [1, 2]);
  head(ctx, st, cx, 380, 440);
  ctx.restore();
  if (armsOverHead) {
    sleeve(ctx, L, S.hoodie, S.cuff, 112);
    sleeve(ctx, R, S.hoodie, S.cuff, 112);
  }
  hand(ctx, handL[0], handL[1], S.skin, -1, st.pose === "panic" ? -0.5 : 0);
  if (mugAt) mug(ctx, mugAt[0], mugAt[1]);
  hand(ctx, handR[0], handR[1], S.skin, 1, st.pose === "panic" ? 0.5 : 0);
};

const drawSleeping = (ctx: Ctx, st: MehmetState) => {
  const cx = 500;
  // hunched back, arms folded on the desk, head resting on them
  hoodieTorso(ctx, 820, 1400, cx, 760, 800);
  hoodFront(ctx, cx + 40, 830);
  sleeve(
    ctx,
    [
      [cx - 330, 900],
      [cx - 300, 1060],
      [cx + 120, 1085],
    ],
    S.hoodie,
    S.cuff,
    120,
  );
  sleeve(
    ctx,
    [
      [cx + 330, 900],
      [cx + 320, 1050],
      [cx - 110, 1060],
    ],
    S.hoodie,
    S.cuff,
    120,
  );
  ctx.save();
  ctx.translate(cx - 20, 905 + st.bob);
  ctx.rotate(-1.15 + st.tilt);
  ctx.translate(-(cx - 20), -905);
  head(ctx, st, cx - 20, 905, 440);
  ctx.restore();
  // drool
  ctx.save();
  ctx.globalAlpha = 0.85;
  line(
    ctx,
    [
      [cx - 95, 1015],
      [cx - 98, 1045],
      [cx - 92, 1065],
    ],
    9,
    "#bfe6ff",
  );
  ctx.restore();
};

const drawStanding = (ctx: Ctx, st: MehmetState) => {
  const cx = 500;
  const sh = 600 + st.slump;
  // legs (jeans) and shoes
  for (const s of [-1, 1]) {
    inked(
      ctx,
      () => {
        ctx.moveTo(cx + s * 30, 1180);
        ctx.lineTo(cx + s * 175, 1180);
        ctx.lineTo(cx + s * 165, 1700);
        ctx.lineTo(cx + s * 55, 1700);
        ctx.closePath();
      },
      S.jeans,
      9,
      [3, 4],
    );
    inked(ctx, () => ellipse(ctx, cx + s * 120, 1730, 105, 48), S.shoe, 8, [2, 4]);
  }
  hoodieTorso(ctx, sh, 1250, cx, 690, 740);
  print(ctx, cx, sh + 280);
  sleeve(
    ctx,
    [
      [cx - 300, sh + 90],
      [cx - 370, sh + 330],
      [cx - 330, sh + 560],
    ],
    S.hoodie,
    S.cuff,
    112,
  );
  sleeve(
    ctx,
    [
      [cx + 300, sh + 90],
      [cx + 370, sh + 330],
      [cx + 330, sh + 560],
    ],
    S.hoodie,
    S.cuff,
    112,
  );
  hoodFront(ctx, cx, sh - 8);
  ctx.save();
  ctx.translate(cx, 350 + st.bob);
  ctx.rotate(st.tilt);
  ctx.translate(-cx, -350);
  inked(ctx, () => ctx.rect(cx - 52, 490, 104, 120), mul(S.skin, [0.9, 0.84, 0.9]), 7, [1, 2]);
  head(ctx, st, cx, 350, 440);
  ctx.restore();
  hand(ctx, cx - 330, sh + 600, S.skin, -1, 0);
  hand(ctx, cx + 330, sh + 600, S.skin, 1, 0);
};

export const MEHMET_DEFAULT: MehmetState = {
  pose: "type",
  face: { lid: 0.2, pupil: 1, look: [0, 0], brow: [0, 0], mouth: "flat", open: 0 },
  blink: 0,
  typing: 0,
  typeAmp: 0,
  tilt: 0,
  bob: 0,
  messy: 0,
  slump: 0,
};
