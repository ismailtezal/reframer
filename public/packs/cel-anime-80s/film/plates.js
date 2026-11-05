// Painted background plates for a vertical (1080 wide) crane-down: painted once at load as a colour + emissive pair, then only slid.
// Neon helpers adapted from lemo-opuscar styles/cel-anime-80s/demo/bg.js (MIT, LemoLab).
import { canvas, rng, rgba, mix, airbrush, vgrad, TAU } from './demo/cel.js';

export const NEON = ['#ff3fa4', '#35e7ff', '#ffd23f', '#ff5a3c', '#b36bff', '#4dff9a'];
export function neonText(g, e, txt, x, y, size, col, vertical = false, font = '"Dela Gothic One"', weight = '') {
  for (const [ctx, pass] of [[g, 0], [e, 1]]) {
    ctx.save(); ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const chars = vertical ? [...txt] : [txt];
    chars.forEach((ch, i) => {
      const yy = vertical ? y + (i - (chars.length - 1) / 2) * size * 1.05 : y;
      if (pass === 0) { ctx.strokeStyle = rgba(col, .9); ctx.lineWidth = size * .16; ctx.strokeText(ch, x, yy); ctx.strokeStyle = mix(col, '#ffffff', .75); ctx.lineWidth = size * .05; ctx.strokeText(ch, x, yy); }
      else { ctx.strokeStyle = col; ctx.lineWidth = size * .2; ctx.strokeText(ch, x, yy); ctx.strokeStyle = mix(col, '#ffffff', .5); ctx.lineWidth = size * .06; ctx.strokeText(ch, x, yy); }
    });
    ctx.restore();
  }
}
export function neonRect(g, e, x, y, w, h, col, r = 10) {
  for (const [ctx, pass] of [[g, 0], [e, 1]]) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    ctx.strokeStyle = pass ? col : rgba(col, .85); ctx.lineWidth = pass ? 8 : 6; ctx.stroke();
    ctx.strokeStyle = mix(col, '#ffffff', pass ? .4 : .75); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
}
function windows(g, e, R, x, y, w, h, o = {}) {
  const cw = o.cw || 54, rh = o.rh || 66, ww = o.ww || 30, wh = o.wh || 38, lit = o.lit ?? .3;
  for (let yy = y + 30; yy < y + h - 40; yy += rh) for (let xx = x + 16; xx + ww < x + w - 10; xx += cw) {
    const on = R() < lit, c = R() < .72 ? '#ffd28a' : '#9fe8ff';
    g.fillStyle = on ? c : mix(o.base || '#1c1432', '#000000', .35); g.fillRect(xx, yy, ww, wh);
    if (on) { e.fillStyle = rgba(c, .32); e.fillRect(xx, yy, ww, wh); g.fillStyle = rgba('#000000', .22); g.fillRect(xx, yy + wh * .62, ww, wh * .38); }
    g.fillStyle = rgba('#000000', .3); g.fillRect(xx, yy + wh, ww, 4);
  }
}

// —— far plate: night sky, big moon, airbrushed clouds, distant skyline (1080 × 2600) ——
export function farPlate() {
  const Wd = 1080, Hh = 2600, [c, g] = canvas(Wd, Hh), [ec, e] = canvas(Wd, Hh), R = rng(41);
  e.fillStyle = '#000'; e.fillRect(0, 0, Wd, Hh);
  vgrad(g, 0, 0, Wd, Hh, [[0, '#03021a'], [.28, '#0e0b34'], [.52, '#24124e'], [.72, '#5a1f66'], [.86, '#a4306e'], [1, '#2a1238']]);
  for (let i = 0; i < 420; i++) { const x = R() * Wd, y = R() * 1500, r = R() < .08 ? 2.2 : 1; g.fillStyle = rgba('#efe6ff', .3 + R() * .6); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); if (r > 2) { e.fillStyle = rgba('#d8ccff', .35); e.beginPath(); e.arc(x, y, 4, 0, TAU); e.fill(); } }
  // big moon: flat pale disc with a hard-edged shadow side and a few painted maria, haloed
  const mx = 700, my = 560, mr = 168;
  airbrush(g, mx, my, 520, 520, '#8a6aff', .16); airbrush(g, mx, my, 280, 280, '#ffd6f0', .2);
  airbrush(e, mx, my, 420, 420, '#c9a8ff', .22); airbrush(e, mx, my, 230, 230, '#fff0f6', .22);
  const M = new Path2D(); M.arc(mx, my, mr, 0, TAU);
  g.fillStyle = '#f4e0e6'; g.fill(M); e.fillStyle = rgba('#fff4ec', .3); e.fill(M);
  g.save(); g.clip(M);
  g.fillStyle = '#f2d6e6'; g.beginPath(); g.arc(mx + 40, my + 34, mr, 0, TAU); g.arc(mx, my, mr + 4, 0, TAU); g.fill('evenodd');   // hard terminator crescent
  g.fillStyle = rgba('#d8b8d8', .55);
  for (const [dx, dy, r] of [[-50, -40, 38], [30, 20, 30], [-10, 70, 22], [60, -70, 18], [-80, 40, 16]]) { g.beginPath(); g.ellipse(mx + dx, my + dy, r, r * .8, .4, 0, TAU); g.fill(); }
  g.restore();
  // clouds: soft airbrushed bodies, undersides lit pink by the city
  g.save(); g.filter = 'blur(16px)';
  for (let i = 0; i < 22; i++) {
    const y = 820 + R() * 900, x = R() * 1300 - 110, w = 220 + R() * 380, h = 30 + R() * 60, low = (y - 820) / 900;
    g.fillStyle = rgba('#2e2264', .6); g.beginPath(); g.ellipse(x, y, w, h, 0, 0, TAU); g.fill();
    g.fillStyle = rgba('#d0508e', .22 + low * .3); g.beginPath(); g.ellipse(x + 20, y + h * .5, w * .8, h * .42, 0, 0, TAU); g.fill();
  }
  g.restore();
  // one hard cloud strip crossing the moon (cel-like, painted edge)
  g.fillStyle = rgba('#3a2a6e', .85); g.beginPath(); g.ellipse(640, 650, 300, 20, -.04, 0, TAU); g.fill();
  g.fillStyle = rgba('#ff9ad0', .5); g.beginPath(); g.ellipse(660, 664, 250, 6, -.04, 0, TAU); g.fill();
  // distant skyline: three layers, tiny windows, red aviation lights
  for (let layer = 0; layer < 3; layer++) {
    const col = ['#1a1238', '#22184a', '#2e1f56'][layer];
    for (let x = -40; x < Wd + 40;) {
      const w = 70 + R() * 150, top = 1700 + layer * 200 + R() * 360;
      vgrad(g, x, top, w, Hh - top, [[0, mix(col, '#7a5ad0', .25)], [.15, col], [1, mix(col, '#000', .3)]]);
      g.fillStyle = rgba('#a07aff', .22); g.fillRect(x, top, 3, Hh - top);
      if (R() < .45) { g.fillStyle = col; g.fillRect(x + w * .5 - 3, top - 80, 6, 80); g.fillStyle = '#ff6060'; g.beginPath(); g.arc(x + w * .5, top - 80, 3.5, 0, TAU); g.fill(); e.fillStyle = '#ff2a3a'; e.beginPath(); e.arc(x + w * .5, top - 80, 8, 0, TAU); e.fill(); }
      const cols = Math.floor(w / 16), lit = .1 + layer * .07;
      for (let yy = top + 16; yy < Hh; yy += 20) { if (R() < .3) continue; for (let i = 0; i < cols; i++) { if (R() > lit) continue; const cc = R() < .7 ? '#ffcf80' : '#8fdcff'; g.fillStyle = rgba(cc, .7); g.fillRect(x + 5 + i * 16, yy, 6, 8); e.fillStyle = rgba(cc, .22); e.fillRect(x + 5 + i * 16, yy, 6, 8); } }
      x += w + R() * 14;
    }
    vgrad(g, 0, 1800 + layer * 220, Wd, 800, [[0, rgba('#ff4fa8', 0)], [1, rgba('#ff4fa8', .12)]]);
  }
  return { c, e: ec, w: Wd, h: Hh };
}

// —— near plate: neon towers + her apartment block with the one lit window (1080 × 3000, transparent sky) ——
export const WIN = { x: 565, y: 2325, w: 190, h: 150 };   // her window, plate coordinates (centre)
export function nearPlate() {
  const Wd = 1080, Hh = 3000, [c, g] = canvas(Wd, Hh), [ec, e] = canvas(Wd, Hh), R = rng(57);
  // left tower (tall) + right tower
  const towers = [[0, 300, 330, '#1c1434'], [770, 760, 310, '#20183c']];
  for (const [x, top, w, base] of towers) {
    vgrad(g, x, top, w, Hh - top, [[0, mix(base, '#000', .3)], [.5, base], [1, mix(base, '#ff4fa8', .12)]]);
    vgrad(e, x, top, w, Hh - top, [[0, '#000'], [1, '#000']]);
    g.fillStyle = rgba('#8a6ad0', .3); g.fillRect(x === 0 ? w - 4 : x, top, 4, Hh - top);   // lit edge facing the street
    g.fillStyle = mix(base, '#000', .55); g.fillRect(x - 6, top - 12, w + 12, 14);
    windows(g, e, R, x, top, w, Hh - top - 300, { base, lit: .28 });
  }
  // rooftop: antenna + red light on the left tower
  g.fillStyle = '#120c22'; g.fillRect(150, 140, 8, 170); g.fillRect(110, 220, 90, 6);
  g.fillStyle = '#ff6060'; g.beginPath(); g.arc(154, 140, 5, 0, TAU); g.fill(); e.fillStyle = '#ff2a3a'; e.beginPath(); e.arc(154, 140, 12, 0, TAU); e.fill();
  // big vertical signs hanging off the towers (katakana + Turkish)
  const vs = [[350, 700, 'ネオン', '#ff3fa4', 0], [350, 1260, 'KAFE', '#35e7ff', 1], [730, 1080, 'カラオケ', '#ffd23f', 0], [730, 1700, 'OTEL', '#b36bff', 1]];
  for (const [sx, sy, txt, col, latin] of vs) {
    const n = [...txt].length, step = latin ? 96 : 100, hh = n * step + 50;
    g.fillStyle = '#130b20'; g.fillRect(sx - 52, sy, 104, hh); g.fillStyle = rgba('#000', .4); g.fillRect(sx + 46, sy, 6, hh);
    neonText(g, e, txt, sx, sy + hh / 2, latin ? 84 : 80, col, true, latin ? 'Kanit' : '"Dela Gothic One"', latin ? '800' : '');
    neonRect(g, e, sx - 44, sy + 8, 88, hh - 16, col, 8);
    airbrush(g, sx, sy + hh / 2, 200, hh * .7, col, .16);
    g.fillStyle = '#0c0816'; g.fillRect(sx + (sx < 540 ? -90 : 52), sy + 30, 40, 8); g.fillRect(sx + (sx < 540 ? -90 : 52), sy + hh - 40, 40, 8);
  }
  // horizontal billboard on the right tower
  g.fillStyle = '#120b1e'; g.fillRect(800, 1300, 250, 110); neonText(g, e, '24 SAAT', 925, 1356, 64, '#4dff9a', false, 'Kanit', '800'); neonRect(g, e, 812, 1312, 226, 86, '#4dff9a', 8);
  // her apartment block: 80s concrete, balconies, a water tank on the roof
  const ax = 210, aw = 690, atop = 1620;
  g.fillStyle = '#0e0a1c'; g.fillRect(ax + 120, atop - 120, 140, 110); g.fillRect(ax + 150, atop - 160, 80, 40); g.fillRect(ax + 520, atop - 90, 10, 90);
  vgrad(g, ax, atop, aw, Hh - atop, [[0, '#3a2a5e'], [.4, '#2c2050'], [1, '#1c1434']]);
  g.fillStyle = rgba('#000', .3); g.fillRect(ax + aw - 18, atop, 18, Hh - atop);
  g.fillStyle = '#4a3a74'; g.fillRect(ax - 8, atop - 14, aw + 16, 16);
  const floors = []; for (let y = atop + 60; y < Hh - 260; y += 190) floors.push(y);
  for (const fy of floors) {
    for (let i = 0; i < 3; i++) {
      const wx = ax + 40 + i * 220, wy = fy, isHer = Math.abs(wx + 95 - WIN.x) < 60 && Math.abs(wy + 75 - WIN.y) < 100;
      if (isHer) continue;
      const on = R() < .3, cc = R() < .8 ? '#ffcf86' : '#a0d8ff';
      g.fillStyle = on ? cc : '#150f28'; g.fillRect(wx, wy, 190, 150);
      if (on) { e.fillStyle = rgba(cc, .3); e.fillRect(wx, wy, 190, 150); g.fillStyle = rgba('#3a2010', .45); g.fillRect(wx + 10, wy + 20, 70, 130); }   // curtain
      g.fillStyle = '#0c0818'; g.fillRect(wx + 92, wy, 6, 150);
    }
    g.fillStyle = '#4a3a70'; g.fillRect(ax + 20, fy + 150, aw - 40, 12);   // balcony slab
    g.fillStyle = rgba('#1a1230', .9); for (let x = ax + 24; x < ax + aw - 24; x += 22) g.fillRect(x, fy + 118, 5, 34);
    g.fillStyle = '#5a4a84'; g.fillRect(ax + 20, fy + 112, aw - 40, 7);
  }
  // HER window: monitor-lit cyan, silhouette of her at the desk, the glow spilling out
  const hx = WIN.x - WIN.w / 2, hy = WIN.y - WIN.h / 2;
  vgrad(g, hx, hy, WIN.w, WIN.h, [[0, '#7ff6ff'], [1, '#d8fbff']]);
  e.fillStyle = rgba('#5ff0ff', .95); e.fillRect(hx, hy, WIN.w, WIN.h);
  g.fillStyle = '#1a1438'; g.beginPath(); g.ellipse(WIN.x + 34, hy + 74, 22, 25, 0, 0, TAU); g.fill();   // her head
  g.beginPath(); g.moveTo(WIN.x - 4, hy + WIN.h); g.quadraticCurveTo(WIN.x + 34, hy + 86, WIN.x + 72, hy + WIN.h); g.fill();   // shoulders
  g.fillRect(hx + 18, hy + 96, 60, 54);   // monitor back
  g.fillStyle = '#0c0818'; g.fillRect(WIN.x - 3, hy, 6, WIN.h);
  airbrush(g, WIN.x, WIN.y, 260, 200, '#5ff0ff', .22);
  // street level: shopfronts + awning + BÜFE sign
  const sy = Hh - 250;
  g.fillStyle = '#0d0918'; g.fillRect(0, sy, Wd, 250);
  for (const [x, w, cc] of [[30, 260, '#ffcf7a'], [380, 330, '#ffe2a8'], [790, 260, '#9fdcff']]) { vgrad(g, x, sy + 70, w, 150, [[0, rgba(cc, .95)], [1, rgba(mix(cc, '#ff6a3c', .4), .8)]]); e.fillStyle = rgba(cc, .45); e.fillRect(x, sy + 70, w, 150); }
  for (let k = 0; k < 30; k++) { g.fillStyle = k % 2 ? '#c8306a' : '#e8d8ea'; g.fillRect(380 + k * 11, sy + 40, 11, 26); }
  g.fillStyle = '#120b1e'; g.fillRect(420, sy - 70, 250, 90); neonText(g, e, 'BÜFE', 545, sy - 25, 66, '#ff5a3c', false, 'Kanit', '800'); neonRect(g, e, 432, sy - 60, 226, 70, '#ff5a3c', 8);
  return { c, e: ec, w: Wd, h: Hh };
}
