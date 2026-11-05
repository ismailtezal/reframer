// hero.js — the sleepy fellow: round head, pie eyes, big button nose, striped nightcap with a pompom, nightshirt,
// noodle arms and white gloves. Parts (pieEye, brow, mouth, glove, ribbon) come from LemoLab's rubber-hose demo chars.js (MIT).
import * as T from './demo/toon.js';
import { P, pieEye, brow, mouth, glove, ribbon } from './demo/chars.js';
import { lerp } from './core/lib.js';
const { shape, stroke, ell, arc, spline, quad, push, pop, translate, rotate, scale, S } = T;

export const HR = 74;   // head radius

// stripes across a ribbon centre line c (inside a shade clip)
function stripes(c, every = 5, half = 90, col = P.light) {
  for (let i = 2; i < c.length - 2; i += every) {
    const a = c[i - 1], b = c[i + 1]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const nx = -dy, ny = dx, w = 5.5, p = c[i];
    shape([[p[0] - dx * w + nx * half, p[1] - dy * w + ny * half], [p[0] + dx * w + nx * half, p[1] + dy * w + ny * half], [p[0] + dx * w - nx * half, p[1] + dy * w - ny * half], [p[0] - dx * w - nx * half, p[1] - dy * w - ny * half]], { fill: col, stroke: false, boil: 0 });
  }
}
function pompom(x, y, r = 19) {
  shape(spline([[x - r, y], [x - r * .7, y - r * .8], [x, y - r * 1.05], [x + r * .75, y - r * .75], [x + r * 1.02, y], [x + r * .7, y + r * .8], [x, y + r], [x - r * .75, y + r * .7]], true, 4), { fill: P.white, shade: () => shape(ell(x + r * .5, y + r * .3, r * .55, r * .7), { fill: P.pale, stroke: false, boil: 0 }) });
}
// nightcap on the head (head-local): a striped cone flopping to the left, pompom at the tip
function capOnHead(flop, bob) {
  const c = spline([[2, -62], [12, -122], [-30, -170 + bob * .4], [-96 + flop * 10, -158 + bob], [-136 + flop * 16, -108 + bob * 1.5]], false, 7);
  shape(ribbon(c, 128, 20, false), { fill: P.white, shade: () => stripes(c, 5, 90) });
  const tip = c[c.length - 1]; pompom(tip[0], tip[1] + 8);
  // brim band over the top of the head
  const o = arc(0, 2, HR + 8, HR + 6, Math.PI * 1.06, Math.PI * 1.94, 22), i = arc(0, 2, HR - 12, HR - 14, Math.PI * 1.94, Math.PI * 1.06, 22);
  shape([...o, ...i], { fill: P.white, shade: () => shape(rect2(30, -100, 70, 80), { fill: P.pale, stroke: false, boil: 0 }) });
}
const rect2 = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
// the cap held in a glove: hanging limp below the wrist (world coords)
export function capInHand(x, y, sway = 0) {
  const c = spline([[x, y + 6], [x + 10 + sway * 6, y + 52], [x - 4 + sway * 10, y + 104], [x + 14 + sway * 14, y + 148]], false, 7);
  shape(ribbon(c, 74, 18, false), { fill: P.white, shade: () => stripes(c, 5, 60) });
  const tip = c[c.length - 1]; pompom(tip[0], tip[1] + 10, 17);
}

// head + face. p: { x, y, tilt, shake, tq, eyeL, eyeR, brows, browsL, mouth:{type,open,w}, cap:'on'|'off', flop, bob, hair (0..1) }
export function head(p) {
  const sh = p.shake ? [Math.sin(p.tq * 97) * p.shake, Math.cos(p.tq * 83) * p.shake * .5] : [0, 0];
  push(); translate(p.x + sh[0], p.y + sh[1]); rotate(p.tilt || 0);
  // ears (behind the head)
  for (const s of [-1, 1]) shape(ell(s * (HR - 2), 10, 17, 25, 20), { fill: P.white, shade: () => shape(ell(s * (HR + 4), 12, 7, 15, 14), { fill: P.light, stroke: false, boil: 0 }) });
  // head: flat white, one hard form-shadow band on the right
  shape(ell(0, 0, HR, HR * .97, 64), { fill: P.white, shade: () => shape(ell(HR * .78, 10, HR * .5, HR * 1.2, 30), { fill: P.pale, stroke: false, boil: 0 }) });
  if (p.cap === 'off') {   // three hairs spring up from the bald top
    const h = p.hair ?? 1, wob = Math.sin((p.tq || 0) * 9) * (1 - Math.min(1, h)) * 10;
    for (const [dx, a] of [[-14, -.35], [0, 0], [14, .35]]) {
      const base = [dx, -HR + 3], tip = [dx + Math.sin(a) * 34 * h + wob, -HR - 34 * h];
      stroke(spline([base, [dx + a * 12, -HR - 18 * h], tip, [tip[0] + 9 * Math.sign(a || 1), tip[1] + 6]], false, 6), S.lw * .85);
    }
  } else capOnHead(p.flop || 0, p.bob || 0);
  // eyes
  const eyeY = -6, ex = 26;
  pieEye(-ex, eyeY, 19, 27, { ...(p.eyeL || {}), lidCol: P.white });
  pieEye(ex, eyeY, 19, 27, { ...(p.eyeR || {}), lidCol: P.white });
  if (p.brows) { brow(-ex, eyeY - 40, 30, p.brows, -1); brow(ex, eyeY - 40, 30, p.brows, 1); }
  else if (p.browsL) brow(-ex, eyeY - 40, 30, p.browsL, -1);
  // cheeks, nose, mouth
  for (const s of [-1, 1]) shape(ell(s * 47, 32, 13, 8, 14), { fill: P.pale, stroke: false, boil: .3 });
  shape(ell(0, 26, 22, 15, 22), { fill: P.ink, lw: S.lw * .6 });
  shape(ell(-6, 21, 5, 3.4, 10), { fill: P.white, stroke: false, boil: 0 });
  const M = p.mouth || { type: 'smile' };
  mouth(0, 52, M.w || 50, M.type, M);
  pop();
}

// nightshirt torso (world coords): neck at (x, neckY); runs down under the blanket
export function torso(x, neckY, b = 0) {
  const w0 = 28, w1 = 80, w2 = 96, yb = neckY + 230;
  shape(spline([[x - w0, neckY], [x - w1, neckY + 44], [x - w2, yb], [x + w2, yb], [x + w1, neckY + 44], [x + w0, neckY]], true, 6), {
    fill: "#DCD9D0", shade: () => {
      for (let i = -4; i <= 4; i++) shape(rect2(x + i * 26 - 4, neckY - 10, 8, 260), { fill: P.mid, stroke: false, boil: 0 });
      shape(rect2(x + 46, neckY - 10, 80, 260), { fill: 'rgba(90,88,82,.22)', stroke: false, boil: 0 });
    }
  });
  shape([[x - 32, neckY - 6], [x, neckY + 36], [x + 32, neckY - 6], [x + 15, neckY - 10], [x, neckY + 12], [x - 15, neckY - 10]], { fill: P.white, lw: S.lw * .6 });
  for (const yy of [neckY + 58, neckY + 96]) shape(ell(x, yy, 6, 6, 10), { fill: P.ink, stroke: false, boil: 0 });
}

// noodle arm along control points (world coords) + glove at the end
export function armPath(pts, w = 15) {
  const c = spline(pts, false, 8);
  shape(ribbon(c, w, w), { fill: P.ink, lw: S.lw * .8 });
  return c;
}
export function hand(c, type = 'open', k = 1.15, flip = false, rot = null) {
  const e = c[c.length - 1], q = c[Math.max(0, c.length - 4)];
  const ang = rot ?? Math.atan2(e[1] - q[1], e[0] - q[0]);
  glove(e[0], e[1], ang, type, k, { flip });
  return { x: e[0], y: e[1], ang };
}
