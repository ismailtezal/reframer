// SON TESLİM: 23:59 — one function per shot. S = { t, lt (time in shot), u (0..1), g (picture), e (glow), A (plates) }
import { canvas, rng, rgba, mix, airbrush, vgrad, TAU, cel, poly, path, line, LWK } from './demo/cel.js';
import { W, H, cpuCanvas, clamp, seg, ss, eio, eo, ei, f12, f8, q12, hash, PAL, celLayer, speedLines, flare, lamp, led, ledWidth } from './kit.js';
import { WIN } from './plates.js';
import { head80 } from './dev80.js';
import { IN } from './inputs.js';

const P = PAL.screen;
const RIM = { c: '#ff5fc8', d: [-1, -.7] };   // magenta neon rim from the window behind her
const cam = (S, x, y, z, rot = 0) => { for (const c of [S.g, S.e]) { c.translate(x, y); c.rotate(rot); c.scale(z, z); c.translate(-x, -y); } };
const shake = (S, amp, seed = 0) => { const f = Math.floor(S.t * 30); const dx = (hash(f + seed) - .5) * amp, dy = (hash(f * 1.7 + 9 + seed) - .5) * amp; for (const c of [S.g, S.e]) c.translate(dx, dy); };

// ——— foreground utility pole + wires (fastest multiplane layer) ———
function pole(g, top) {
  g.save(); g.fillStyle = '#06041a'; g.strokeStyle = '#06041a';
  g.fillRect(968, top, 30, 4000);
  for (const [dy, w] of [[60, 190], [150, 150]]) { g.fillRect(983 - w * .75, top + dy, w, 14); for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(983 - w * .75 + 18 + k * (w - 36) / 2, top + dy - 6, 7, 0, TAU); g.fill(); } }
  g.beginPath(); g.roundRect(944, top + 250, 46, 110, 10); g.fill();
  g.lineWidth = 3.2;
  for (let k = 0; k < 4; k++) { const y0 = top + 54 + (k > 1 ? 90 : 0), x0 = 860 + (k % 2) * 90; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(400, y0 + 260 + k * 30, -60, y0 + 120 + k * 40); g.stroke(); }
  g.strokeStyle = rgba('#ff7ac0', .35); g.lineWidth = 1.2;   // city-glow catching the wires
  for (let k = 0; k < 4; k++) { const y0 = top + 54 + (k > 1 ? 90 : 0), x0 = 860 + (k % 2) * 90; g.beginPath(); g.moveTo(x0, y0 + 2); g.quadraticCurveTo(400, y0 + 262 + k * 30, -60, y0 + 122 + k * 40); g.stroke(); }
  g.fillStyle = rgba('#ff7ac0', .25); g.fillRect(968, top, 3, 4000);
  g.restore();
}

// ——— 1 crane down: moon → neon towers → her lit window, then a truck-in through it ———
export function sky(S) {
  const { g, e, A, lt } = S;
  const k = eio(clamp(lt / 2.15)), push = ei(seg(lt, 1.95, 2.6));
  const yF = -k * (A.far.h - H), yN = 1120 - k * 2200;
  const wx = WIN.x, wy = WIN.y + yN, z = 1 + push * 2.6;
  g.save(); e.save();
  for (const c of [g, e]) { c.translate(wx, wy); c.scale(z, z); c.translate(-wx, -wy); }
  g.drawImage(A.far.c, 0, yF); e.drawImage(A.far.e, 0, yF);
  g.drawImage(A.near.c, 0, yN); e.drawImage(A.near.e, 0, yN);
  // her window breathes with the scrolling screen (light moves, drawing held)
  const fl = .75 + .25 * Math.sin(lt * 9) * Math.sin(lt * 3.1);
  airbrush(e, wx, wy, 160, 130, '#7ff6ff', .35 * fl);
  pole(g, 260 - k * 3900);
  g.restore(); e.restore();
  // a few drifting sparkles of city haze in front (on twos)
  const R = rng(9 + f12(S.t) % 3);
  for (let i = 0; i < 26; i++) { const x = R() * W, y = R() * H; g.fillStyle = rgba('#ffd0f0', .25 + R() * .3); g.fillRect(x, y, 2, 2); }
}

// ——— room behind her: dark violet wall, window onto the neon city (out of focus), curtains ———
const ROOM = {};
function roomView(A, ww, wh) {
  if (!ROOM.c) { for (const k of ['c', 'e']) { const [cv, x] = cpuCanvas(ww + 120, Math.round(wh * 1.3)); x.filter = 'blur(7px)'; x.drawImage(A.far[k], 0, 1400, 1080, 1200, 0, 0, ww + 120, wh * 1.3); x.filter = 'none'; ROOM[k] = cv; } }
  return ROOM;
}
function room(S, A, o = {}) {
  const { g, e } = S;
  vgrad(g, 0, 0, W, H, [[0, '#120a26'], [.6, '#1c1036'], [1, '#0c0618']]);
  const wx0 = o.wx0 ?? 60, wy0 = o.wy0 ?? 120, ww = o.ww ?? 960, wh = o.wh ?? 820;
  g.save(); g.beginPath(); g.rect(wx0, wy0, ww, wh); g.clip();
  const RV = roomView(A, ww, wh); g.drawImage(RV.c, wx0 - 60, wy0 - 40);
  const R = rng(19);
  for (let i = 0; i < 22; i++) { const x = wx0 + R() * ww, y = wy0 + wh * .35 + R() * wh * .7, r = 18 + R() * 46, col = ['#ff3fa4', '#35e7ff', '#ffd23f', '#b36bff'][i % 4];
    g.fillStyle = rgba(col, .2); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = rgba(col, .35); g.lineWidth = 2; g.stroke();
    e.fillStyle = rgba(col, .22); e.beginPath(); e.arc(x, y, r, 0, TAU); e.fill(); }
  g.restore();
  e.save(); e.beginPath(); e.rect(wx0, wy0, ww, wh); e.clip(); e.globalAlpha = .55; e.drawImage(RV.e, wx0 - 60, wy0 - 40); e.restore();
  // window frame + mullions + curtains
  g.fillStyle = '#0a0616'; g.fillRect(wx0 - 20, wy0 - 20, ww + 40, 22); g.fillRect(wx0 - 20, wy0 + wh, ww + 40, 30); g.fillRect(wx0 + ww / 2 - 9, wy0, 18, wh); g.fillRect(wx0, wy0 + wh * .42, ww, 14);
  for (const [x0, dir] of [[wx0 - 40, 1], [wx0 + ww + 40, -1]]) {
    cel(g, [[x0, wy0 - 40], [x0 + dir * 150, wy0 - 40], [x0 + dir * 110, wy0 + wh * .5], [x0 + dir * 170, wy0 + wh + 60], [x0, wy0 + wh + 60]], { f: '#2a1440', s: '#160a26', sh: [[[x0 + dir * 40, wy0 - 40], [x0 + dir * 70, wy0 - 40], [x0 + dir * 60, wy0 + wh + 60], [x0 + dir * 30, wy0 + wh + 60]]], rim: { c: '#ff5fc8', d: [-dir * 3, 0] }, l: '#0a0414', lw: 3 });
  }
}

// ——— the deadline clock (desk LED clock), drawn in place ———
function clockBox(g, e, x, y, w, h, txt, o = {}) {
  const body = new Path2D(); body.roundRect(x, y, w, h, h * .12);
  cel(g, body, { f: '#24202e', s: '#121018', so: [0, -h * .1], h: '#4a4560', ho: [0, h * .03], l: '#050408', lw: 3, rim: o.rim });
  const face = new Path2D(); face.roundRect(x + w * .05, y + h * .14, w * .9, h * .66, h * .06);
  g.fillStyle = '#0c0306'; g.fill(face);
  g.save(); g.clip(face); g.fillStyle = rgba('#ff2a2a', .06); g.fill(face);
  const dh = h * .46, dw = ledWidth(txt, dh);
  led(g, e, txt, x + (w - dw) / 2, y + h * .24, dh, '#ff2a2a', { colon: o.colon ?? 1, glow: o.glow ?? 1 });
  g.fillStyle = rgba('#ffffff', .1); g.beginPath(); g.moveTo(x + w * .05, y + h * .14); g.lineTo(x + w * .5, y + h * .14); g.lineTo(x + w * .3, y + h * .8); g.lineTo(x + w * .05, y + h * .8); g.fill();   // glass glare
  g.restore();
  g.fillStyle = '#ff9a3c'; g.beginPath(); g.arc(x + w * .9, y + h * .9, h * .03, 0, TAU); g.fill();
  if (e) { e.fillStyle = rgba('#ff9a3c', .8); e.beginPath(); e.arc(x + w * .9, y + h * .9, h * .05, 0, TAU); e.fill(); }
}

// ——— 2 over-the-monitor medium shot: her face in the screen glow; 23:57 on the clock ———
export function desk(S) {
  const { g, e, A, t, lt, u } = S;
  g.save(); e.save(); cam(S, 540, 1000, 1 + ss(u) * .05);
  room(S, A);
  const tq = f8(t) / 8, blink = Math.abs(tq - 3.375) < .06;
  const s = 3.35, hx = 560, hy = 985;
  celLayer(S, c => {
    c.translate(hx, hy); c.scale(s, s); LWK.k = .75;
    head80(c, P, { view: 'q', expr: 'determined', open: blink ? 0 : .78, lid: .4, look: [.15, .35], mouth: 'set', ponytail: false, headset: false, wind: 0, ph: (f12(t) % 8) / 8, rim: RIM, skinRim: '#ff8ad8', reflect: '#7ff6ff', blush: .15, E: { brow: [4, -2, 1.5] } });
    LWK.k = 1;
    // scrolling-code light bands moving up her face (move light, not drawings)
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
    for (let k = 0; k < 5; k++) { const y = 1900 - ((lt * 520 + k * 330) % 1700); c.fillStyle = rgba('#7ff6ff', .1 + (k % 2) * .06); c.fillRect(0, y, W, 26 + (k % 3) * 18); }
    const gl = c.createLinearGradient(0, 1500, 0, 600); gl.addColorStop(0, rgba('#5ff0ff', .28)); gl.addColorStop(1, rgba('#5ff0ff', 0)); c.fillStyle = gl; c.fillRect(0, 0, W, H);
  });
  // monitor back (foreground, lower left): beige CRT seen from behind, screen light wrapping round its edges
  const M = [[-60, 1330], [520, 1300, 1], [600, 1420], [640, 1920], [-60, 1920]];
  e.save(); e.filter = 'blur(16px)'; e.strokeStyle = rgba('#5ff0ff', .85); e.lineWidth = 34; e.stroke(path(M)); e.filter = 'none'; e.restore(); e.fillStyle = '#000'; e.fill(path(M));
  cel(g, path(M), { f: '#2e2a3c', s: '#1a1724', so: [16, 30], h: '#4a4460', l: '#08060e', lw: 4, rim: { c: '#9ff8ff', d: [-3, 4] },
    clipFn: gg => { gg.fillStyle = rgba('#0c0a14', .6); for (let k = 0; k < 6; k++) gg.fillRect(120, 1480 + k * 38, 300, 10); } });
  // desk + clock (23:57, colon blinking 1 Hz)
  g.fillStyle = '#1a0f22'; g.fillRect(600, 1790, 480, 130); g.fillStyle = '#3a2440'; g.fillRect(600, 1786, 480, 8);
  clockBox(g, e, 680, 1590, 360, 200, IN.clock(-2), { colon: (t % 1) < .5 ? 1 : 0, rim: { c: '#7ff6ff', d: [-3, 3] } });
  g.restore(); e.restore();
}

// ——— 3 the clock hits 23:58: impact frame → radial lines, shake ———
export function clock(S) {
  const { g, e, t, lt, u } = S;
  if (lt < .07) {   // 2-frame impact: monochrome inverted silhouette over radial lines
    g.fillStyle = '#0a0410'; g.fillRect(0, 0, W, H);
    speedLines(g, 3, { type: 'radial', cx: 540, cy: 960, n: 110, col: '#ff2a3a', a: .95, r0: 120, seed: 61 });
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(70, 700, 940, 520, 60); g.fill();
    led(g, null, IN.clock(-1), 540 - ledWidth(IN.clock(-1), 260) / 2, 830, 260, '#000000', { off: 'rgba(0,0,0,0)' });
    return { bloom: .3 };
  }
  const kick = Math.exp(-lt * 5);
  g.save(); e.save(); cam(S, 540, 960, 1.04 + kick * .1 + u * .05, (hash(f12(t)) - .5) * .02 * kick); shake(S, 40 * kick);
  const gr = g.createRadialGradient(540, 960, 40, 540, 960, 1300); gr.addColorStop(0, '#ff5a3c'); gr.addColorStop(.3, '#a0123a'); gr.addColorStop(1, '#1a0418'); g.fillStyle = gr; g.fillRect(-200, -200, W + 400, H + 400);
  speedLines(g, f12(t), { type: 'radial', cx: 540, cy: 960, n: 130, col: '#ffffff', a: .7, r0: 520, seed: 71 });
  speedLines(g, f12(t) + 2, { type: 'radial', cx: 540, cy: 960, n: 70, col: '#1a0418', a: .7, r0: 560, seed: 72 });
  clockBox(g, e, 70, 700, 940, 520, IN.clock(-1), { glow: 1.2, rim: { c: '#ffd0a0', d: [-6, 6] } });
  g.restore(); e.restore();
  return { bloom: 1.0 };
}

// ——— 4 bust push-in on horizontal speed lines: "Proje teslimine iki dakika." ———
export function bust(S) {
  const { g, e, t, lt, u } = S;
  vgrad(g, 0, 0, W, H, [[0, '#0a0a30'], [.5, '#1a1050'], [1, '#2a0c3e']]);
  speedLines(g, f12(t), { type: 'h', n: 70, col: '#5fd8ff', a: .55, hmax: 6, seed: 81 });
  speedLines(g, f12(t) + 5, { type: 'h', n: 30, col: '#ff5fc8', a: .4, hmax: 4, seed: 82 });
  speedLines(e, f12(t), { type: 'h', n: 24, col: '#3fb8ff', a: .35, hmax: 5, seed: 83 });
  g.save(); e.save(); cam(S, 540, 900, 1 + eio(u) * .1);
  const s = 4.3;
  celLayer(S, c => {
    c.translate(520, 930); c.scale(s, s); LWK.k = .62;
    head80(c, P, { view: 'q', expr: 'determined', look: [.3, .05], mouth: 'set', ponytail: false, headset: false, wind: .7, ph: (f12(t) % 4) / 4, rim: { c: '#5ff0ff', d: [.75, -.45] }, reflect: '#7ff6ff', blush: .18, light: [1, -.6] });
    LWK.k = 1;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
    const bx = -900 + ((lt * 1500) % 3200);
    const gr = c.createLinearGradient(bx, 0, bx + 600, 260); gr.addColorStop(0, rgba('#ff5fc8', 0)); gr.addColorStop(.5, rgba('#ff5fc8', .2)); gr.addColorStop(1, rgba('#ff5fc8', 0));
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
  });
  g.restore(); e.restore();
}

// ——— 5 eye-strip extreme close-up: "Ve o, pes etmeyecek." → eyes snap open → glint → push into the highlight ———
export const EYES = { open: 7.36, glint: 8.24 };
export function eyes(S) {
  const { g, e, t, lt, u } = S, dur = S.dur;
  const push = ei(seg(lt, 2.4, dur));   // final push into the eye
  const tq = f8(t) / 8, k = Math.floor((tq - EYES.open) * 8);
  const E = k < 0 ? { open: .55, lid: .5, look: [.1, .3], brow: [3, -1, 1.5] } : k === 0 ? { open: .78, lid: .38, look: [.25, .1], brow: [5, -2, 1] } : k === 1 ? { open: .92, lid: .3, look: [.3, 0], brow: [7, -3, 1] } : { open: 1.02, lid: .22, look: [.3, 0], brow: [8, -3, .6] };
  // background: focus lines on deep crimson
  const gr = g.createRadialGradient(540, 960, 60, 540, 960, 1200); gr.addColorStop(0, '#ff3a5a'); gr.addColorStop(.45, '#5a0c38'); gr.addColorStop(1, '#10041c'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  speedLines(g, f12(t), { type: 'radial', cx: 540, cy: 960, n: 140, col: '#ffffff', a: .55, r0: 300, seed: 91 });
  const bandH = 600 + push * 1400, y0 = 960 - bandH / 2;
  const s = 9 * (1 + push * 3.2), cx = 540 + 18 * s * 0 , cy = 960;
  const ax = -17, ay = 19;   // near-eye highlight (local)
  const ox = 540 - (6 + (ax - 6) * push) * s, oy = cy - (16 + (ay - 16) * push) * s;
  celLayer(S, c => {
    c.save(); c.beginPath(); c.rect(0, y0, W, bandH); c.clip();
    vgrad(c, 0, y0, W, bandH, [[0, '#1a0c2e'], [1, '#2a1238']]);
    c.translate(ox, oy); c.scale(s, s); LWK.k = .42;
    head80(c, P, { view: 'q', expr: 'determined', open: E.open, lid: E.lid, look: E.look, mouth: 'set', ponytail: false, headset: false, wind: .4, ph: (f12(t) % 4) / 4, rim: { c: '#ff5fc8', d: [-.35, -.25] }, reflect: '#7ff6ff', blush: .15, E: { brow: E.brow } });
    LWK.k = 1; c.restore();
    c.globalCompositeOperation = 'source-atop';
    const bx = -700 + ((lt * 1100) % 2600); const lg = c.createLinearGradient(bx, 0, bx + 500, 200); lg.addColorStop(0, rgba('#5ff0ff', 0)); lg.addColorStop(.5, rgba('#5ff0ff', .16)); lg.addColorStop(1, rgba('#5ff0ff', 0));
    c.fillStyle = lg; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.strokeRect(-10, y0, W + 20, bandH);
  });
  // glint (キラッ) on the near eye's highlight, then it grows as we push into it
  const hx = ox + ax * s, hy = oy + ay * s;
  const ga = Math.sin(seg(t, EYES.glint - .06, EYES.glint + .5) * Math.PI);
  if (ga > 0) flare(e, hx, hy, .55 * ga, '#ffffff', { ghosts: false, streak: 520, spikes: 4, rot: .78 });
  if (push > 0) { flare(e, hx, hy, .3 + push * 2.4, '#e8fbff', { ghosts: push < .5, streak: 900, spikes: 6, rot: .3 }); const wf = ei(seg(lt, dur - .45, dur)); g.fillStyle = rgba('#ffffff', wf); g.fillRect(0, 0, W, H); e.fillStyle = rgba('#ffffff', wf * .8); e.fillRect(0, 0, W, H); }
  return { bloom: .85 + push * .6, expo: 1.06 + push * .4 };
}

// ——— 6 title card: SON TESLİM + 23:59, backlit, flickers on at 12 fps, light sweep, glint on the İ dot ———
function chromeText(g, e, txt, x, y, size, flick, o = {}) {
  g.save(); g.font = `italic 900 ${size}px Kanit`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  let sc = 1; const mw = g.measureText(txt).width; if (mw > (o.max || 980)) sc = (o.max || 980) / mw;
  g.translate(x, y); g.scale(sc, 1);
  const top = -size * .74, gr = g.createLinearGradient(0, top, 0, size * .02);
  gr.addColorStop(0, '#e8f6ff'); gr.addColorStop(.44, '#7fc8ff'); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(.55, '#3a2a7a'); gr.addColorStop(.8, '#ff6aa0'); gr.addColorStop(1, '#ffd08a');
  g.strokeStyle = '#120830'; g.lineWidth = size * .12; g.strokeText(txt, 0, 0);
  g.strokeStyle = '#ff3fa4'; g.lineWidth = size * .045; g.strokeText(txt, 0, 0);
  g.fillStyle = gr; g.fillText(txt, 0, 0);
  g.restore();
  e.save(); e.font = `italic 900 ${size}px Kanit`; e.textAlign = 'center'; e.lineJoin = 'round'; e.translate(x, y); e.scale(sc, 1);
  e.strokeStyle = rgba('#ff3fa4', .9 * flick); e.lineWidth = size * .07; e.strokeText(txt, 0, 0);
  e.fillStyle = rgba('#9fd8ff', .3 * flick); e.fillText(txt, 0, 0); e.restore();
  return mw * sc;
}
const [SW, SWX] = cpuCanvas(W, H), [, DUMMY] = cpuCanvas(8, 8);
export function title(S) {
  const { g, e, t, lt, u } = S;
  g.save(); e.save(); cam(S, 540, 960, 1 + u * .045);
  // 80s sunburst: slow-turning rays over a deep radial field
  const gr = g.createRadialGradient(540, 980, 40, 540, 980, 1300); gr.addColorStop(0, '#ff4f9a'); gr.addColorStop(.35, '#5a1a7a'); gr.addColorStop(1, '#07051e'); g.fillStyle = gr; g.fillRect(-100, -100, W + 200, H + 200);
  g.save(); g.translate(540, 980); g.rotate(lt * .08);
  for (let i = 0; i < 24; i += 2) { g.fillStyle = rgba('#ffffff', .05); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 2400, i * TAU / 24, (i + 1) * TAU / 24); g.closePath(); g.fill(); }
  g.restore();
  const R = rng(91); for (let i = 0; i < 200; i++) { g.fillStyle = rgba('#ffffff', .2 + R() * .5); g.fillRect(R() * W, R() * H * .7, 2, 2); }
  speedLines(g, f12(t), { type: 'h', n: 26, col: '#9fb8ff', a: .3, hmax: 4, seed: 4 });
  // city silhouette + horizon glow at the bottom
  vgrad(g, 0, 1450, W, 470, [[0, rgba('#ff3fa4', 0)], [1, rgba('#ff3fa4', .45)]]);
  const R2 = rng(12); g.fillStyle = '#07041a'; for (let x = -10; x < W;) { const w = 40 + R2() * 100, h = 120 + R2() * 300; g.fillRect(x, H - h, w, h); if (R2() < .4) { g.fillStyle = '#ff6060'; g.fillRect(x + w / 2 - 2, H - h - 30, 4, 30); g.fillStyle = '#07041a'; } x += w; }
  const kk = Math.floor(lt * 12), flick = kk < 1 ? 0 : kk === 2 ? .3 : kk === 4 ? .6 : 1;
  const show = kk < 1 ? 0 : 1;
  if (show) {
    g.save(); g.textAlign = 'center'; g.font = '86px "Dela Gothic One"'; g.fillStyle = '#35e7ff'; g.fillText(IN.kicker, 540, 470);
    e.font = '86px "Dela Gothic One"'; e.textAlign = 'center'; e.fillStyle = rgba('#35e7ff', .75 * flick); e.fillText(IN.kicker, 540, 470); g.restore();
    chromeText(g, e, IN.title1, 540, 760, 300, flick, { max: 900 });
    chromeText(g, e, IN.title2, 540, 1010, 236, flick, { max: 900 });
    // the deadline in red LED, on a black glass plate
    const dh = 200, dw = ledWidth(IN.clock(0), dh);
    g.fillStyle = rgba('#0a0208', .85); g.beginPath(); g.roundRect(540 - dw / 2 - 50, 1110, dw + 100, dh + 90, 24); g.fill();
    g.strokeStyle = '#ff3fa4'; g.lineWidth = 4; g.stroke();
    led(g, e, IN.clock(0), 540 - dw / 2, 1155, dh, '#ff2a2a', { colon: (lt % 1) < .7 ? 1 : 0, glow: flick });
    { const sx = -300 + seg(lt, .15, 1.1) * 1700;
      if (sx > -260 && sx < 1340) { SWX.setTransform(1, 0, 0, 1, 0, 0); SWX.globalCompositeOperation = 'source-over'; SWX.clearRect(0, 0, W, H);
        chromeText(SWX, DUMMY, IN.title1, 540, 760, 300, 0, { max: 900 }); chromeText(SWX, DUMMY, IN.title2, 540, 1010, 236, 0, { max: 900 });
        SWX.globalCompositeOperation = 'source-in'; const sg = SWX.createLinearGradient(sx - 140, 0, sx + 140, 0); sg.addColorStop(0, rgba('#ffffff', 0)); sg.addColorStop(.5, rgba('#ffffff', .85)); sg.addColorStop(1, rgba('#ffffff', 0));
        SWX.fillStyle = sg; SWX.fillRect(0, 0, W, H); SWX.globalCompositeOperation = 'source-over';
        e.save(); e.globalCompositeOperation = 'lighter'; e.drawImage(SW, 0, 0); e.restore(); g.save(); g.globalAlpha = .35; g.globalCompositeOperation = 'lighter'; g.drawImage(SW, 0, 0); g.restore(); } }
    g.save(); g.font = '600 40px "Barlow SC"'; g.textAlign = 'center'; g.fillStyle = rgba('#f0e8ff', .9); g.letterSpacing = '10px'; g.fillText(IN.tagline, 540, 1480); g.letterSpacing = '0px'; g.restore();
  }
  g.restore(); e.restore();
  // star glint on the dot of the İ
  const ga = Math.sin(seg(lt, 1.0, 1.6) * Math.PI); if (ga > 0) flare(e, 786, 812, .6 * ga, '#bfe6ff', { ghosts: false, streak: 600 });
  if (lt < .07) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); }
  return { bloom: .95 };
}

// ——— keyboard + hand (the GÖNDER key) ———
// Chrome dropped the tail of long recorded draw lists on this canvas; reading one pixel commits what is recorded so far
export const flush = g => { if (g && g.getImageData) g.getImageData(0, 0, 1, 1); };
export function keycap(g, e, x, y, w, h, d, C, label, o = {}) {
  const top = new Path2D(); top.roundRect(x, y, w, h, 14);
  const side = poly([[x + 4, y + h - 10], [x + w - 4, y + h - 10], [x + w + 6, y + h + d], [x - 6, y + h + d]]);
  cel(g, side, { f: C.s, l: C.l, lw: 2.5 }); flush(g);
  cel(g, top, { f: C.f, s: mix(C.f, C.s, .5), so: [0, -h * .2], h: C.h, ho: [0, 5], l: C.l, lw: 2.5, rim: o.rim }); flush(g);
  if (label) { g.save(); g.font = label.font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; const lx = x + w / 2 - (label.arrow ? 44 : 0), ly = y + h * .5; g.strokeStyle = C.l; g.lineWidth = 7; g.strokeText(label.txt, lx, ly); g.fillStyle = label.col; g.fillText(label.txt, lx, ly);
    if (label.arrow) { const ax = x + w - 46, ay = ly; g.lineCap = 'round'; g.lineJoin = 'round'; for (const [col, lw] of [[C.l, 16], [label.col, 9]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(ax + 20, ay - 46); g.lineTo(ax + 20, ay + 14); g.lineTo(ax - 40, ay + 14); g.stroke(); g.beginPath(); g.moveTo(ax - 20, ay - 8); g.lineTo(ax - 42, ay + 14); g.lineTo(ax - 20, ay + 36); g.stroke(); } }
    g.restore(); flush(g); }
}
export function keyboard(g, e, press, glowK, onlyKey = false) {
  const C = PAL.screen.beige, K = PAL.screen.key;
  if (!onlyKey) {
  // tray
  cel(g, poly([[-80, 930], [1160, 930], [1160, 1920], [-80, 1920]]), { f: '#4a4250', l: '#120e18', lw: 4 });
  // rows of small keys receding up
  for (let r = 0; r < 6; r++) {
    const y = 960 + r * 150, kh = 110, kw = 130, off = (r % 2) * 60;
    for (let x = -100 + off; x < 1150; x += kw + 22) {
      if (y + kh > 1150 && y < 1470 && x + kw > 210 && x < 870) continue;
      keycap(g, e, x, y, kw, kh, 26, C, null, { rim: { c: '#9ff8ff', d: [0, 4] } }); flush(g);
    }
  }
  }
  // the big GÖNDER key; when pressed it sinks and light bleeds round its edges (透過光)
  const dy = press * 34, x = 240, y = 1190 + dy, w = 600, h = 230;
  if (glowK > 0 && e) { e.save(); e.fillStyle = rgba('#fff0c8', glowK); e.filter = 'blur(26px)'; e.fillRect(x - 40, y - 40, w + 80, h + 120); e.restore(); g.fillStyle = rgba('#fff4d8', Math.min(1, glowK * 1.2)); g.fillRect(x - 14, y - 14, w + 28, h + 50); }
  keycap(g, e, x, y, w, h, 40 - dy, K, { txt: IN.key, font: 'italic 900 112px Kanit', col: '#fff6ea', arrow: true }, { rim: { c: '#ffd0a0', d: [0, 6] } });
  if (e) { e.save(); e.font = 'italic 900 112px Kanit'; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillStyle = rgba('#ff8a5a', .08 + glowK * .5); e.fillText('GÖNDER', x + w / 2 - 30, y + h / 2); e.restore(); }
}
export function hand(g, Pp) {   // local: index fingertip at (0,0), hand above, sleeve to the upper right
  const S = Pp.skin, Hd = Pp.hoodie, st = { f: S.f, s: S.s, h: S.h, l: S.l, lw: 4 };
  cel(g, [[-140, -360], [120, -420], [520, -1300], [140, -1400]], { f: Hd.f, s: Hd.s, so: [-40, 10], h: Hd.h, l: Hd.l, lw: 5 });   // sleeve
  cel(g, [[-150, -380], [110, -440], [130, -380], [-130, -310]], { f: Hd.s, l: Hd.l, lw: 4 });   // cuff
  cel(g, [[-120, -330], [96, -380], [130, -250], [110, -150], [40, -120], [-60, -140], [-130, -220]], { ...st, so: [-14, 6] });   // back of hand
  for (let k = 0; k < 3; k++) cel(g, [[22 + k * 34, -150], [56 + k * 34, -150], [62 + k * 32, -96 + k * 8], [30 + k * 34, -84 + k * 6], [18 + k * 34, -110]], { ...st, so: [-8, 4] });   // curled fingers
  cel(g, [[-26, -150], [22, -152], [20, -70], [16, -12], [0, 4], [-18, -2], [-24, -70]], { ...st, so: [-9, 0] });   // index finger
  cel(g, [[-12, -38], [10, -38], [11, -10], [0, -2], [-11, -8]], { f: mix(S.f, '#ffffff', .4), l: S.l, lw: 2.5 });   // nail
  cel(g, [[-128, -230], [-96, -246], [-60, -160], [-50, -110], [-74, -100], [-100, -150]], { ...st, so: [-8, 4] });   // thumb
  line(g, [[-40, -200], [10, -230]], S.l, 2.5);
}
const CLK = {};
function bgClock(colon) { if (!CLK[colon]) { const [a, x] = cpuCanvas(380, 230); clockBox(x, null, 20, 20, 330, 180, '23:59', { colon }); const [c, y] = cpuCanvas(380, 230); y.filter = 'blur(8px)'; y.drawImage(a, 0, 0); y.filter = 'none'; CLK[colon] = c; } return CLK[colon]; }
export function key(S) {
  const { g, e, t, lt, u } = S, dur = S.dur;
  // background: the monitor's glow above, the clock (23:59) out of focus at the top right
  vgrad(g, 0, 0, W, 1100, [[0, '#1a2a5a'], [.6, '#2a1650'], [1, '#160a26']]);
  airbrush(g, 420, 300, 700, 380, '#5ff0ff', .35); airbrush(e, 420, 300, 600, 300, '#5ff0ff', .35);
  g.drawImage(bgClock((t % 1) < .7 ? 1 : 0), 670, 340);
  e.save(); e.filter = 'blur(10px)'; e.fillStyle = rgba('#ff2a2a', .7); e.fillRect(720, 410, 270, 90); e.restore();
  // performance: hover with a tremble (twos) → anticipation lift → strike
  const a = seg(lt, dur - .55, dur - .16), strike = ei(seg(lt, dur - .16, dur - .02));
  const lift = eo(a) * 120 * (1 - strike), lower = ss(seg(lt, 0, dur - .55)) * 90;
  const tr = (hash(f12(t)) - .5) * 6 * (1 - a);
  const fy0 = 960 + lower - lift, fy = fy0 + strike * (1215 - fy0), fx = 560 + tr;
  g.save(); e.save(); cam(S, 540, 1300, 1.04 + u * .06);
  keyboard(g, e, 0, 0); flush(g);
  celLayer(S, c => { c.translate(fx, fy); c.rotate(-.1); c.scale(1.55, 1.55); hand(c, PAL.screen);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; const gl = c.createLinearGradient(0, 400, 0, 1400); gl.addColorStop(0, rgba('#5ff0ff', .25)); gl.addColorStop(1, rgba('#ff8a5a', .18)); c.fillStyle = gl; c.fillRect(0, 0, W, H); });
  if (strike > 0) { g.save(); g.strokeStyle = rgba('#ffffff', .55 * strike); g.lineWidth = 5; for (let k = 0; k < 9; k++) { const x = fx - 240 + k * 60; g.beginPath(); g.moveTo(x, fy - 1000); g.lineTo(x, fy - 380); g.stroke(); } g.restore(); }
  g.restore(); e.restore();
}

// ——— 7 GÖNDER: impact frame → burst of light → the city again, a beam rising from her window ———
export function burst(S) {
  const { g, e, A, t, lt, u } = S;
  if (lt < .07) {
    g.fillStyle = '#0a0410'; g.fillRect(0, 0, W, H);
    speedLines(g, 5, { type: 'radial', cx: 540, cy: 1300, n: 120, col: '#ff2a3a', a: .95, r0: 100, seed: 63 });
    celLayer(S, c => { c.translate(540, 1300); c.scale(1.04, 1.04); c.translate(-540, -1300); keyboard(c, null, 1, 0, true); c.setTransform(1, 0, 0, 1, 0, 0); c.translate(560, 1232); c.rotate(-.1); c.scale(1.55, 1.55); hand(c, PAL.screen);
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }, { occlude: false });
    return { bloom: .3 };
  }
  const wb = 1 - ss(seg(lt, .12, .75));   // white burst fading to reveal the city
  // the city, wide: her window blazing, a beam of light climbing to the sky
  const yF = 0, yN = -760;   // moon kept below the top labels
  g.drawImage(A.far.c, 0, yF); e.drawImage(A.far.e, 0, yF);
  g.drawImage(A.near.c, 0, yN); e.drawImage(A.near.e, 0, yN);
  const wx = WIN.x, wy = WIN.y + yN;
  g.fillStyle = '#f4ffff'; g.fillRect(wx - WIN.w / 2, wy - WIN.h / 2, WIN.w, WIN.h);
  lamp(g, e, wx, wy, 90, '#9ff8ff', 1);
  const climb = eo(seg(lt, .15, .95)), tx = wx + (700 - wx) * climb, ty = wy + (600 - wy) * climb;
  e.save(); e.globalCompositeOperation = 'lighter'; e.lineCap = 'round';
  for (const [w, a] of [[46, .35], [18, .8], [6, 1]]) { const gr = e.createLinearGradient(wx, wy, tx, ty); gr.addColorStop(0, rgba('#9ff8ff', a * .4)); gr.addColorStop(1, rgba('#ffffff', a)); e.strokeStyle = gr; e.lineWidth = w; e.beginPath(); e.moveTo(wx, wy); e.lineTo(tx, ty); e.stroke(); }
  e.restore();
  g.save(); g.lineCap = 'round'; g.strokeStyle = rgba('#ffffff', .9); g.lineWidth = 5; g.beginPath(); g.moveTo(wx, wy); g.lineTo(tx, ty); g.stroke(); g.restore();
  flare(e, tx, ty, .45 + climb * .5 + .08 * Math.sin(lt * 14), '#dff8ff', { streak: 800, ghostA: .7 });
  // sparkles shed by the beam (on twos)
  const R = rng(300 + f12(t) % 4);
  for (let i = 0; i < 40; i++) { const k = R() * climb, x = wx + (tx - wx) * k + (R() - .5) * 80, y = wy + (ty - wy) * k + (R() - .5) * 80; g.fillStyle = rgba('#ffffff', .8); g.fillRect(x, y, 3, 3); e.fillStyle = rgba('#bff8ff', .6); e.fillRect(x - 2, y - 2, 7, 7); }
  if (wb > 0) {   // the burst: radial rays + white flood
    e.save(); e.globalCompositeOperation = 'lighter'; e.translate(540, 1000); e.rotate(lt * .6);
    for (let i = 0; i < 18; i++) { e.fillStyle = rgba('#fff6e0', .5 * wb); e.beginPath(); e.moveTo(0, 0); e.arc(0, 0, 2200, i * TAU / 18, i * TAU / 18 + .07); e.closePath(); e.fill(); }
    e.restore();
    g.fillStyle = rgba('#fffaf0', wb); g.fillRect(0, 0, W, H);
  }
  return { bloom: 1.0 + wb * .5, expo: 1.06 + wb * .3 };
}
