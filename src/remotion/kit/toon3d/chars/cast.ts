import { crescentHead, hand, headShape, sleeve } from "./body";
import { drawFace, type Face } from "./face";
import { type Ctx, ellipse, INK, inked, inside, line, mul, type Pt, SHADE, smoothPath, taper } from "./pen";

/**
 * The rest of the cast. The boss: big, bald with a shine, a trimmed beard, the startup uniform (navy blazer over a
 * rocket tee, lanyard, chinos, white sneakers). Standing card 1000 × 1800. Coworkers: seated cards 1000 × 1400,
 * drawn in the background (typing, mostly out of focus).
 */
export const BOSS = {
  skin: "#e3a77f",
  beard: "#4a3026",
  blazer: "#2d4a8f",
  blazerDark: "#22386d",
  tee: "#fbf7ee",
  chinos: "#d8b98a",
  shoe: "#ffffff",
  lanyard: "#e4483b",
};

export type BossPose = "idle" | "point" | "open" | "thumbs";
export type BossState = { pose: BossPose; face: Face; blink: number; tilt: number; bob: number; lean: number };

const torsoPath = (ctx: Ctx, cx: number, top: number, bottom: number, wTop: number, wBot: number) => () => {
  ctx.moveTo(cx - wTop / 2 + 60, top);
  ctx.quadraticCurveTo(cx - wTop / 2 - 20, top + 10, cx - wTop / 2 - 6, top + 110);
  ctx.quadraticCurveTo(cx - wBot / 2 - 20, (top + bottom) / 2, cx - wBot / 2, bottom);
  ctx.lineTo(cx + wBot / 2, bottom);
  ctx.quadraticCurveTo(cx + wBot / 2 + 20, (top + bottom) / 2, cx + wTop / 2 + 6, top + 110);
  ctx.quadraticCurveTo(cx + wTop / 2 + 20, top + 10, cx + wTop / 2 - 60, top);
  ctx.closePath();
};

export const drawBoss = (ctx: Ctx, st: BossState) => {
  const B = BOSS;
  const cx = 500;
  const sh = 640;
  ctx.save();
  ctx.translate(500, 1780);
  ctx.rotate(st.lean);
  ctx.translate(-500, -1780);
  // legs + shoes
  for (const s of [-1, 1]) {
    inked(
      ctx,
      () => {
        ctx.moveTo(cx + s * 20, 1190);
        ctx.lineTo(cx + s * 200, 1190);
        ctx.lineTo(cx + s * 185, 1690);
        ctx.lineTo(cx + s * 60, 1690);
        ctx.closePath();
      },
      B.chinos,
      9,
      [3, 4],
    );
    inked(ctx, () => ellipse(ctx, cx + s * 130, 1728, 118, 50), B.shoe, 8, [2, 4]);
    line(
      ctx,
      [
        [cx + s * 70, 1722],
        [cx + s * 190, 1722],
      ],
      5,
      "#c9d2e6",
    );
  }
  // tee + blazer
  const tee = torsoPath(ctx, cx, sh, 1230, 760, 800);
  inked(ctx, tee, B.tee, 10, [4, 6]);
  // rocket on the tee
  inside(ctx, tee, () => {
    ctx.save();
    ctx.translate(cx, sh + 330);
    ctx.rotate(-0.6);
    ctx.fillStyle = "#ff7a3d";
    ctx.beginPath();
    ctx.moveTo(0, -80);
    ctx.quadraticCurveTo(40, -20, 30, 60);
    ctx.lineTo(-30, 60);
    ctx.quadraticCurveTo(-40, -20, 0, -80);
    ctx.fill();
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.moveTo(-22, 66);
    ctx.lineTo(0, 120);
    ctx.lineTo(22, 66);
    ctx.fill();
    ctx.fillStyle = "#6fd3ff";
    ctx.beginPath();
    ctx.arc(0, -10, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  for (const s of [-1, 1]) {
    const lapel = () => {
      ctx.moveTo(cx + s * 380, sh + 20);
      ctx.lineTo(cx + s * 120, sh + 10);
      ctx.lineTo(cx + s * 175, sh + 260);
      ctx.lineTo(cx + s * 230, 1235);
      ctx.lineTo(cx + s * 410, 1235);
      ctx.quadraticCurveTo(cx + s * 425, sh + 300, cx + s * 380, sh + 20);
      ctx.closePath();
    };
    inked(ctx, lapel, s > 0 ? mul(B.blazer, [0.9, 0.9, 0.96]) : B.blazer, 9, [3, 5]);
    line(
      ctx,
      [
        [cx + s * 120, sh + 10],
        [cx + s * 200, sh + 120],
        [cx + s * 175, sh + 260],
      ],
      6,
    );
  }
  // lanyard + badge
  line(
    ctx,
    [
      [cx - 95, sh + 10],
      [cx - 10, sh + 330],
      [cx + 10, sh + 330],
      [cx + 95, sh + 10],
    ],
    16,
    B.lanyard,
    false,
  );
  inked(ctx, () => ctx.roundRect(cx - 52, sh + 320, 104, 132, 12), "#ffffff", 7, [2, 3]);
  ctx.fillStyle = "#2d4a8f";
  ctx.fillRect(cx - 40, sh + 336, 80, 26);
  ctx.fillStyle = "#c7cbd6";
  ctx.fillRect(cx - 36, sh + 380, 72, 10);
  ctx.fillRect(cx - 36, sh + 400, 50, 10);

  // arms
  const armW = 128;
  let lHand: Pt = [cx - 395, 1150];
  let rHand: Pt = [cx + 395, 1150];
  const larm: Pt[] = [
    [cx - 360, sh + 90],
    [cx - 430, sh + 300],
    [cx - 400, 1100],
  ];
  let rarm: Pt[] = [
    [cx + 360, sh + 90],
    [cx + 430, sh + 300],
    [cx + 400, 1100],
  ];
  let rRot = 0;
  let pointUp = false;
  if (st.pose === "point") {
    rHand = [cx + 330, 140 + st.bob * 0.5];
    rarm = [
      [cx + 360, sh + 90],
      [cx + 520, sh - 150],
      [rHand[0] + 20, rHand[1] + 70],
    ];
    pointUp = true;
  } else if (st.pose === "open") {
    lHand = [cx - 520, sh - 40];
    rHand = [cx + 520, sh - 40];
    larm.splice(0, 3, [cx - 360, sh + 90], [cx - 520, sh + 200], [lHand[0] + 10, lHand[1] + 60]);
    rarm = [
      [cx + 360, sh + 90],
      [cx + 520, sh + 200],
      [rHand[0] - 10, rHand[1] + 60],
    ];
  } else if (st.pose === "thumbs") {
    rHand = [cx + 300, sh + 160];
    rarm = [
      [cx + 360, sh + 90],
      [cx + 470, sh + 420],
      [rHand[0] + 30, rHand[1] + 60],
    ];
    rRot = -0.3;
  }
  sleeve(ctx, larm, B.blazer, B.blazerDark, armW);
  if (!pointUp) sleeve(ctx, rarm, B.blazer, B.blazerDark, armW);

  // head
  ctx.save();
  ctx.translate(cx, 360 + st.bob);
  ctx.rotate(st.tilt);
  ctx.translate(-cx, -360);
  inked(ctx, () => ctx.rect(cx - 70, 520, 140, 130), mul(B.skin, [0.9, 0.84, 0.9]), 7, [1, 2]);
  const W = 480;
  for (const s of [-1, 1]) inked(ctx, () => ellipse(ctx, cx + s * W * 0.5, 380, W * 0.08, W * 0.115), B.skin, 7);
  const headP = () => smoothPath(ctx, headShape(cx, 360, W, W * 0.98, 1.3), true);
  inked(ctx, headP, B.skin, 9, [3, 5]);
  crescentHead(ctx, headP, cx, 360, W, B.skin);
  // side hair tufts + beard
  for (const s of [-1, 1]) {
    inked(
      ctx,
      () =>
        smoothPath(
          ctx,
          [
            [cx + s * 238, 290],
            [cx + s * 256, 340],
            [cx + s * 246, 410],
            [cx + s * 216, 380],
            [cx + s * 214, 320],
          ],
          true,
        ),
      "#5b463c",
      6,
      [1, 2],
    );
  }
  inside(ctx, headP, () => {
    ctx.fillStyle = B.beard;
    ctx.beginPath();
    ctx.moveTo(cx - 240, 400);
    ctx.quadraticCurveTo(cx - 200, 610, cx, 615);
    ctx.quadraticCurveTo(cx + 200, 610, cx + 240, 400);
    ctx.lineTo(cx + 205, 400);
    ctx.quadraticCurveTo(cx + 150, 545, cx, 548);
    ctx.quadraticCurveTo(cx - 150, 545, cx - 205, 400);
    ctx.closePath();
    ctx.fill();
    // scalp shine
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#fff4e6";
    ctx.beginPath();
    ellipse(ctx, cx - 90, 205, 70, 30, -0.35);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  drawFace(ctx, { cx, cy: 360, w: W, skin: B.skin, facing: -0.2, browColor: B.beard }, st.face, st.blink);
  ctx.restore();

  if (pointUp) {
    sleeve(ctx, rarm, B.blazer, B.blazerDark, armW);
    // pointing hand: fist with the index finger up
    ctx.save();
    ctx.translate(rHand[0], rHand[1]);
    inked(ctx, () => ctx.roundRect(-10, -120, 34, 110, 17), B.skin, 7, [1, 2]);
    inked(ctx, () => ellipse(ctx, 0, 0, 52, 46), B.skin, 8, [2, 3]);
    ctx.restore();
  } else {
    hand(ctx, rHand[0], rHand[1], B.skin, 1, rRot);
    if (st.pose === "thumbs") {
      inked(ctx, () => ctx.roundRect(rHand[0] - 18, rHand[1] - 110, 36, 80, 18), B.skin, 7, [1, 2]);
    }
  }
  hand(ctx, lHand[0], lHand[1], B.skin, -1, 0);
  ctx.restore();
};

/** Background coworkers (seated, typing). */
export type CoworkerId = "zeynep" | "can" | "elif";
const CO: Record<
  CoworkerId,
  { skin: string; hair: string; top: string; topDark: string; style: "ponytail" | "curly" | "bob"; phones?: string; beard?: boolean }
> = {
  zeynep: { skin: "#c58a66", hair: "#2a1b1f", top: "#8d6ad8", topDark: "#6e50b4", style: "ponytail", phones: "#2fc3b0" },
  can: { skin: "#d9a57c", hair: "#231a1a", top: "#4fae6a", topDark: "#3a8a52", style: "curly", beard: true },
  elif: { skin: "#f3d0b4", hair: "#a2482e", top: "#ef6a5a", topDark: "#cc4f42", style: "bob" },
};

export type CoworkerState = { face: Face; blink: number; typing: number; typeAmp: number; bob: number; tilt: number };

export const drawCoworker = (ctx: Ctx, id: CoworkerId, st: CoworkerState) => {
  const c = CO[id];
  const cx = 500;
  const sh = 650;
  const top = torsoPath(ctx, cx, sh, 1400, 660, 720);
  inked(ctx, top, c.top, 10, [4, 6]);
  inside(ctx, top, () => {
    const g = ctx.createLinearGradient(cx - 360, 0, cx + 360, 0);
    g.addColorStop(0.6, "rgba(0,0,0,0)");
    g.addColorStop(1, mul(c.top, SHADE));
    ctx.fillStyle = g;
    ctx.fillRect(0, sh, 1000, 800);
  });
  const ty = (k: number) => Math.max(0, Math.sin(st.typing + k * 2.3)) * 22 * st.typeAmp;
  sleeve(
    ctx,
    [
      [cx - 290, sh + 90],
      [cx - 340, sh + 330],
      [cx - 170, 1060 - ty(0)],
    ],
    c.top,
    c.topDark,
    104,
  );
  sleeve(
    ctx,
    [
      [cx + 290, sh + 90],
      [cx + 340, sh + 330],
      [cx + 170, 1060 - ty(1)],
    ],
    c.top,
    c.topDark,
    104,
  );
  ctx.save();
  ctx.translate(cx, 390 + st.bob);
  ctx.rotate(st.tilt);
  ctx.translate(-cx, -390);
  const W = 410;
  if (c.style === "ponytail") {
    taper(
      ctx,
      [
        [cx + 150, 250],
        [cx + 260, 300],
        [cx + 280, 470],
        [cx + 230, 560],
      ],
      90,
      30,
      c.hair,
    );
  }
  if (c.style === "bob") {
    inked(ctx, () => smoothPath(ctx, headShape(cx, 410, W * 1.18, W * 1.12), true), c.hair, 8, [2, 3]);
  }
  inked(ctx, () => ctx.rect(cx - 48, 520, 96, 140), mul(c.skin, [0.9, 0.84, 0.9]), 7, [1, 2]);
  for (const s of [-1, 1]) inked(ctx, () => ellipse(ctx, cx + s * W * 0.5, 400, W * 0.075, W * 0.11), c.skin, 7);
  const hp = () => smoothPath(ctx, headShape(cx, 390, W, W * 0.96, id.length), true);
  inked(ctx, hp, c.skin, 9, [3, 5]);
  crescentHead(ctx, hp, cx, 390, W, c.skin);
  // hair caps
  const cap = (ext: number, spikes: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI + (i / 14) * Math.PI;
      const r = 1.07 + (i % 2 ? spikes : 0);
      pts.push([cx + Math.cos(a) * W * 0.52 * r, 375 + Math.sin(a) * W * 0.52 * r]);
    }
    pts.push([cx + W * 0.5, 375 + ext], [cx + W * 0.2, 300], [cx - W * 0.15, 315], [cx - W * 0.5, 375 + ext]);
    inked(ctx, () => smoothPath(ctx, pts, true, 0.4), c.hair, 8, [2, 3]);
  };
  if (c.style === "curly") cap(10, 0.07);
  else cap(40, 0);
  if (c.beard) {
    inside(ctx, hp, () => {
      ctx.fillStyle = c.hair;
      ctx.beginPath();
      ctx.moveTo(cx - 205, 410);
      ctx.quadraticCurveTo(cx - 170, 600, cx, 600);
      ctx.quadraticCurveTo(cx + 170, 600, cx + 205, 410);
      ctx.quadraticCurveTo(cx, 540, cx - 205, 410);
      ctx.fill();
    });
  }
  drawFace(ctx, { cx, cy: 390, w: W, skin: c.skin, facing: 0.25, browColor: c.hair }, st.face, st.blink);
  if (c.phones) {
    ctx.save();
    ctx.lineWidth = 34;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, 380, 235, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.lineWidth = 22;
    ctx.strokeStyle = c.phones;
    ctx.stroke();
    ctx.restore();
    for (const s of [-1, 1]) inked(ctx, () => ctx.roundRect(cx + s * 225 - 45, 330, 90, 140, 36), c.phones, 8, [2, 3]);
  }
  ctx.restore();
  hand(ctx, cx - 170, 1060 - ty(0), c.skin, -1, 0);
  hand(ctx, cx + 170, 1060 - ty(1), c.skin, 1, 0);
};
