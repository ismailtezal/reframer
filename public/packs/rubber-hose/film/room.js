// room.js — the bedroom: a cached grey watercolour shell (walls, wainscot, floor) + living props that breathe on the beat.
// makeBG / withCanvas / paperGrain are copied from LemoLab's rubber-hose demo bg.js (MIT); `wash` is imported from it.
import * as T from './demo/toon.js';
import { P } from './demo/chars.js';
import { wash } from './demo/bg.js';
import { mulberry, TAU } from './core/lib.js';
import { CX, CY } from './film.js';
import { IN } from './inputs.js';
const { shape, stroke, ell, arc, rr, rect, spline, quad, push, pop, translate, rotate, scale, S } = T;

// ——— cached background helpers (from the demo) ———
function paperGrain(g, w, h, seed = 3) {
  const rnd = mulberry(seed); g.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < w * h / 900; i++) { g.fillStyle = rnd() > .5 ? 'rgba(20,18,15,.06)' : 'rgba(255,255,250,.05)'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
}
function withCanvas(bg, fn) {
  const prev = T.g, oldB = T.BASE.slice(), oldL = T.S.lwScale, { PS, ox, oy } = bg;
  T.init(bg.cv); T.BASE.splice(0, 6, PS, 0, 0, PS, -ox * PS, -oy * PS); T.S.lwScale = PS; T.frame(0, { amp: 0 });
  const raw = () => T.g.setTransform(PS, 0, 0, PS, -ox * PS, -oy * PS);
  fn(T.g, raw); T.g.setTransform(1, 0, 0, 1, 0, 0);
  paperGrain(T.g, bg.cv.width, bg.cv.height, ox + 3);
  T.BASE.splice(0, 6, ...oldB); T.S.lwScale = oldL; T.init(prev.canvas);
}
function makeBG(x0, y0, x1, y1, PS) { const cv = document.createElement('canvas'); cv.width = Math.round((x1 - x0) * PS); cv.height = Math.round((y1 - y0) * PS); return { cv, ox: x0, oy: y0, PS, w: x1 - x0, h: y1 - y0 }; }

// camera: world point (cam.x, cam.y) → frame centre, zoom cam.z
export const camBase = cam => [cam.z, 0, 0, cam.z, CX - cam.x * cam.z, CY - cam.y * cam.z];
export function drawBG(sg, bg, cam) {
  sg.save(); sg.setTransform(cam.z, 0, 0, cam.z, CX - cam.x * cam.z, CY - cam.y * cam.z);
  sg.drawImage(bg.cv, bg.ox, bg.oy, bg.w, bg.h); sg.restore();
}

export const FLOOR_Y = 1174;
export function paintRoom() {
  const x0 = -160, x1 = 1240, W = x1 - x0, bg = makeBG(x0, 230, x1, 1740, 1.6);
  withCanvas(bg, (g, raw) => {
    // ceiling moulding
    wash(rect(x0 - 10, 220, W + 20, 84), '#3E3D3A', { seed: 21, edge: 0 });
    wash(rect(x0 - 10, 300, W + 20, 16), '#5A5853', { seed: 22 });
    // wallpaper: mid grey, faint stripes, small diamonds (it recedes)
    wash(rect(x0 - 10, 316, W + 20, 700), '#8C8981', { line: false, seed: 1, edge: 0 });
    raw();
    for (let x = x0; x < x1; x += 64) { g.fillStyle = 'rgba(255,253,245,.07)'; g.fillRect(x, 316, 22, 700); }
    for (let x = x0 + 32; x < x1; x += 128) for (let y = 360; y < 1000; y += 96) { g.fillStyle = 'rgba(30,28,24,.2)'; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 6, y); g.lineTo(x, y + 8); g.lineTo(x - 6, y); g.fill(); }
    // chair rail + panelled wainscot
    wash(rect(x0 - 10, 1006, W + 20, 18), '#4A4844', { seed: 5 });
    wash(rect(x0 - 10, 1024, W + 20, 130), '#77746D', { seed: 6, line: false });
    for (let x = x0 + 24; x < x1; x += 172) wash(rr(x, 1040, 144, 98, 6), '#817E77', { seed: x + 7, edge: .12, lw: 2.6 });
    wash(rect(x0 - 10, 1150, W + 20, 26), '#2E2D2A', { seed: 15 });
    // floorboards in perspective
    wash(rect(x0 - 10, FLOOR_Y, W + 20, 580), '#8E8B83', { seed: 16, line: false, edge: 0 });
    raw();
    const VP = [540, 560], yb = 1740, k = (yb - VP[1]) / (FLOOR_Y - VP[1]);
    for (let i = -14, n = 0; i <= 14; i++, n++) {
      const xa = 540 + i * 74, xb = 540 + (i + 1) * 74, A = 540 + (xa - 540) * k, B = 540 + (xb - 540) * k;
      if (n % 2) { g.fillStyle = 'rgba(30,28,24,.13)'; g.beginPath(); g.moveTo(xa, FLOOR_Y); g.lineTo(xb, FLOOR_Y); g.lineTo(B, yb); g.lineTo(A, yb); g.fill(); }
      g.strokeStyle = 'rgba(30,28,24,.45)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(xa, FLOOR_Y); g.lineTo(A, yb); g.stroke();
    }
    for (const yy of [1230, 1330, 1480]) { g.strokeStyle = 'rgba(30,28,24,.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke(); }
    // a round rag rug under the foot of the bed
    wash(ell(540, 1600, 520, 110, 60), '#6E6B64', { seed: 41, edge: .18 });
    wash(ell(540, 1600, 430, 84, 60), '#9A978F', { seed: 42, edge: .1, lw: 2.4 });
  });
  return bg;
}

// ——— living props (local origin = bottom centre unless noted; b = breath −1..1) ———
const breathe = (b, a = .05) => scale(1 - b * a * .6, 1 + b * a);

export function windowProp(b) {   // reuse of the demo's breathing window + curtains
  return { x: 200, y: 806 };
}

export function calendar(x, y, b) {   // origin = the nail
  push(); translate(x, y); scale(1 - b * .03, 1 + b * .055);
  shape(ell(0, 0, 6, 6), { fill: P.dark });
  stroke([[0, 0], [-34, 24]], S.lw * .5); stroke([[0, 0], [34, 24]], S.lw * .5);
  shape(rr(-74, 22, 148, 186, 8), { fill: P.pale, shade: () => shape(rect(30, 10, 60, 210), { fill: P.light, stroke: false, boil: 0 }) });
  shape(rr(-74, 22, 148, 40, 8), { fill: P.dark });
  for (const s of [-1, 1]) shape(ell(s * 40, 26, 6, 9), { fill: P.light, lw: S.lw * .5 });
  T.text('1', 0, 118, { font: '78px Shrikhand', fill: P.ink, base: 'middle' });
  T.text(IN.calendar, 0, 182, { font: '21px Limelight', fill: P.ink, base: 'middle' });
  pop();
}

export const SHELF = { x0: 790, x1: 1050, y: 640 };
export function shelf(b, bump = 0) {
  const { x0, x1, y } = SHELF;
  for (const bx of [826, 1010]) shape([[bx - 12, y + 14], [bx + 12, y + 14], [bx + 12, y + 70]], { fill: P.dmid, lw: S.lw * .7 });
  shape(rr(x0, y, x1 - x0, 22, 5), { fill: '#5E5C57' });
  const books = [[808, 26, 92, P.dmid], [838, 30, 106, '#4A4844'], [872, 24, 80, P.mid]];
  books.forEach(([bx, w, h, c], i) => {
    push(); translate(bx, y - bump * (12 + i * 5)); rotate(bump * (i - 1) * .12); breathe(b * (i % 2 ? -1 : 1), .07);
    shape(rr(-w / 2, -h, w, h, 4), { fill: c, shade: () => { shape(rect(-w / 2, -h + 14, w, 7), { fill: P.light, stroke: false, boil: 0 }); shape(rect(-w / 2, -26, w, 6), { fill: P.light, stroke: false, boil: 0 }); } });
    pop();
  });
}

export const STAND = { x: 910, y: 1196, top: 1058 };
export function nightstand(b, bump = 0) {
  push(); translate(STAND.x, STAND.y); breathe(b, .055);
  for (const s of [-1, 1]) shape(rr(s * 72 - 8, -10, 16, 14, 4), { fill: P.dark });
  shape(rr(-84, -122, 168, 114, 6), { fill: '#7C7972', shade: () => shape(rect(40, -130, 60, 130), { fill: P.dmid, stroke: false, boil: 0 }) });
  shape(rr(-70, -106, 140, 48, 5), { fill: '#8E8B83' });
  shape(ell(0, -82, 9, 9), { fill: P.dark });
  translate(0, bump * 3);
  shape(rr(-98, -140, 196, 22, 6), { fill: '#5E5C57' });
  pop();
}

// bed: front view from the foot, slightly high angle. Head end against the wall.
export function headboard(b) {
  push(); translate(540, 1196); breathe(b, .035); translate(-540, -1196);
  const top = spline([[336, 820], [440, 784], [540, 772], [640, 784], [744, 820]], false, 8);
  shape([...top, [744, 1160], [336, 1160]], { fill: P.dmid, shade: () => {
    shape([...spline([[370, 846], [450, 816], [540, 806], [630, 816], [710, 846]], false, 8), [710, 1160], [370, 1160]], { fill: '#7C7972', lw: S.lw * .6 });
    shape(rect(640, 760, 120, 420), { fill: '#5E5C57', stroke: false, boil: 0 });
  } });
  for (const px of [318, 762]) {
    shape(rr(px - 17, 774, 34, 424, 8), { fill: P.dark });
    shape(ell(px, 758, 21, 21), { fill: P.dmid, shade: () => shape(ell(px - 6, 752, 6, 5), { fill: P.light, stroke: false, boil: 0 }) });
  }
  pop();
}

export function pillow(b) {
  push(); translate(540, 1100); scale(1 + b * .03, 1 - b * .04);
  shape(spline([[-128, -50], [0, -64], [128, -50], [140, 0], [128, 54], [0, 62], [-128, 54], [-140, 0]], true, 6), { fill: "#E4E1D8", shade: () => {
    shape(spline([[30, 40], [130, 26], [150, 60], [50, 80]], true, 5), { fill: P.light, stroke: false, boil: 0 });
  } });
  stroke(quad([-118, -40], [-100, 0], [-120, 40]), S.lw * .5); stroke(quad([118, -40], [100, 0], [120, 40]), S.lw * .5);
  pop();
}

// blanket body (below the sheet fold) — fold = y of the turned-down sheet
export function blanket(b, fold) {
  const L0 = 330, R0 = 750, Lf = 250, Rf = 830, yf = 1410;
  const pts = [[L0, fold], ...quad([L0, fold], [L0 - 46, (fold + yf) / 2], [Lf, yf], 10).slice(1), [Rf, yf], ...quad([Rf, yf], [R0 + 46, (fold + yf) / 2], [R0, fold], 10).slice(1)];
  shape(pts, { fill: '#D6D3CA', shade: () => {
    // quilt checks in perspective
    const g = T.g;
    for (let r = 0; r < 7; r++) {
      const ya = fold + (yf - fold) * Math.pow(r / 7, 1.15), yb2 = fold + (yf - fold) * Math.pow((r + 1) / 7, 1.15);
      for (let c = -5; c <= 5; c++) {
        if ((r + c) % 2 === 0) continue;
        const wa = (R0 - L0) / 8 * (1 + r / 7 * .3), wb = (R0 - L0) / 8 * (1 + (r + 1) / 7 * .3);
        shape([[540 + c * wa, ya], [540 + (c + 1) * wa, ya], [540 + (c + 1) * wb, yb2], [540 + c * wb, yb2]], { fill: '#B9B6AD', stroke: false, boil: 0 });
      }
    }
    // body mound: hard form-shadow band on its right side (light from the upper left)
    shape(spline([[600, fold], [660, fold + 60], [650, 1300], [610, 1420], [800, 1420], [800, fold]], true, 6), { fill: 'rgba(60,58,54,.16)', stroke: false, boil: 0 });
    stroke(spline([[598, fold + 10], [640, fold + 90], [628, 1330]], false, 6), S.lw * .5, { line: P.dmid, boil: .5 });
  } });
}
// the turned-down white sheet at the fold (drawn over the arm roots)
export function sheetFold(fold) {
  const top = fold - 16, bot = fold + 16, wave = [];
  for (let i = 0; i <= 12; i++) { const x = 322 + i * 36; wave.push([x, bot + Math.sin(i * 1.7) * 3]); }
  shape([[324, top], ...quad([324, top], [540, top - 6], [756, top], 10).slice(1), [758, bot], ...wave.reverse()], { fill: P.white, shade: () => shape(rect(640, top - 10, 140, 50), { fill: P.pale, stroke: false, boil: 0 }) });
}
// toes poking up under the blanket at the foot end
export function toes(b, wig = 0) {
  for (const [x, s] of [[478, -1], [602, 1]]) {
    push(); translate(x, 1400); rotate(s * .05 + wig * s * .14); scale(1, 1 + b * .05);
    shape(spline([[-34, 0], [-30, -40], [0, -62], [30, -40], [34, 0]], false, 6).concat([[34, 6], [-34, 6]]), { fill: '#D6D3CA', shade: () => shape(rect(8, -80, 40, 90), { fill: 'rgba(60,58,54,.16)', stroke: false, boil: 0 }) });
    pop();
  }
}
export function footboard(b) {
  push(); translate(540, 1700); breathe(b, .025); translate(-540, -1700);
  shape(rr(236, 1392, 608, 320, 10), { fill: P.dmid, shade: () => {
    shape(rr(270, 1430, 540, 300, 8), { fill: '#7C7972', lw: S.lw * .6 });
    shape(rect(700, 1380, 160, 340), { fill: '#5E5C57', stroke: false, boil: 0 });
  } });
  shape(rr(226, 1384, 628, 24, 10), { fill: '#5E5C57' });
  for (const px of [214, 866]) {
    shape(rr(px - 21, 1376, 42, 360, 9), { fill: P.dark });
    shape(ell(px, 1358, 26, 26), { fill: P.dmid, shade: () => shape(ell(px - 8, 1350, 7, 6), { fill: P.light, stroke: false, boil: 0 }) });
  }
  pop();
}
