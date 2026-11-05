// SON TESLİM: 23:59 — shared kit for a 1080x1920 cel-anime-80s film.
// Effects adapted from lemo-opuscar styles/cel-anime-80s/demo/fx.js + shots.js (MIT, LemoLab), re-sized for vertical frames.
import { canvas, rng, rgba, mix, hex, TAU } from './demo/cel.js';

export const W = 1080, H = 1920;
// CPU-backed 2D canvases: the GPU canvas in headless Chrome silently dropped draw calls on busy frames
export function cpuCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; }
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const eo = t => 1 - Math.pow(1 - clamp(t), 3);
export const ei = t => Math.pow(clamp(t), 3);
export const f12 = t => Math.floor(t * 12 + 1e-6);   // drawings on twos
export const f8 = t => Math.floor(t * 8 + 1e-6);     // performance beats on threes
export const q12 = t => f12(t) / 12;
export const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

// ——— colour model (色指定): daytime base → per-lighting sets ———
export const BASE = {
  skin: { f: '#ffd9c4', s: '#e2a395', h: '#fff1e8', l: '#5a2e2e' },
  blush: '#ff9a9a',
  hair: { f: '#8a3a30', s: '#5a2026', h: '#d0785e', l: '#3a1220' },
  lash: '#1e0f1a',
  hoodie: { f: '#e0384e', s: '#a01e40', h: '#ff8a8a', l: '#4a0a1e' },
  white: { f: '#f3f6fc', s: '#a9b3cd', h: '#ffffff', l: '#39456a' },
  chrome: { f: '#dfe7f3', s: '#646f90', h: '#ffffff', l: '#2b3350' },
  phones: { f: '#2b2d40', s: '#181a26', h: '#5a5e80', l: '#08090f' },
  pad: { f: '#ff9a3c', s: '#c0602a', l: '#4a2008' },
  eye: { f: '#1f9e86', s: '#0f5a50', h: '#8ff5d8', l: '#08302a' },
  white_eye: '#fbf8ff',
  mouth: '#9a3b4a',
  beige: { f: '#d9cbb0', s: '#9e8c74', h: '#f4ead6', l: '#3e3020' },
  key: { f: '#ff6a3c', s: '#c23a2a', h: '#ffc0a0', l: '#4a1008' },
  plastic: { f: '#2a2a36', s: '#16161e', h: '#5a5a70', l: '#06060a' },
};
const mul = (c, m) => { const v = hex(c); return '#' + v.map((x, i) => Math.max(0, Math.min(255, Math.round(x * m[i]))).toString(16).padStart(2, '0')).join(''); };
const LIGHTS = {
  day: { lit: [1, 1, 1], shade: [1, 1, 1], line: [1, 1, 1] },
  screen: { lit: [.8, .9, 1.06], shade: [.46, .42, .78], line: [.7, .66, 1] },   // lit by the monitor, violet room
  sil: { lit: [.2, .16, .32], shade: [.14, .1, .24], line: [.3, .2, .5] },
};
function palette(name) {
  const L = LIGHTS[name], out = {};
  for (const [k, v] of Object.entries(BASE)) {
    if (typeof v === 'string') { out[k] = mul(v, L.lit); continue; }
    out[k] = {}; for (const [kk, c] of Object.entries(v)) out[k][kk] = mul(c, kk === 's' ? L.shade : kk === 'l' ? L.line : L.lit);
  }
  return out;
}
export const PAL = { day: palette('day'), screen: palette('screen'), sil: palette('sil') };
// skin gets its own colour under the screen light (multiplying turns faces grey-pink)
Object.assign(PAL.screen.skin, { f: '#f0dcdc', s: '#9a7cb6', h: '#ffffff', l: '#4a2a3e' });
PAL.screen.blush = '#ee8aa8';
PAL.screen.hoodie = { f: '#c8304c', s: '#6a1a48', h: '#ff7a8a', l: '#2a0820' };

// ——— cel layer: draw a cel offscreen, paste it, stamp its silhouette black into the glow layer ———
const [LC, LG] = cpuCanvas(W, H), [MC, MG] = cpuCanvas(W, H);
export function celLayer(S, fn, o = {}) {
  LG.setTransform(1, 0, 0, 1, 0, 0); LG.globalCompositeOperation = 'source-over'; LG.clearRect(0, 0, W, H); LG.globalAlpha = 1; LG.filter = 'none';
  fn(LG);
  LG.setTransform(1, 0, 0, 1, 0, 0); LG.globalCompositeOperation = 'source-over';
  S.g.save(); if (o.alpha != null) S.g.globalAlpha = o.alpha; S.g.drawImage(LC, 0, 0); S.g.restore();
  if (o.occlude !== false) {
    MG.setTransform(1, 0, 0, 1, 0, 0); MG.globalCompositeOperation = 'source-over'; MG.clearRect(0, 0, W, H); MG.drawImage(LC, 0, 0);
    MG.globalCompositeOperation = 'source-in'; MG.fillStyle = o.occCol || '#000'; MG.fillRect(0, 0, W, H); MG.globalCompositeOperation = 'source-over';
    S.e.save(); S.e.globalAlpha = o.occA ?? 1; S.e.drawImage(MC, 0, 0); S.e.restore();
  }
  return LC;
}

// ——— speed lines (流線): radial or horizontal; stepped per drawing ———
export function speedLines(g, drawing, o) {
  const R = rng(3000 + drawing * 31 + (o.seed || 0)), col = o.col || '#ffffff';
  g.save();
  if (o.type === 'radial') {
    const n = o.n || 90;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, w = (.004 + R() * .018) * (o.wmul || 1), r0 = (o.r0 || 160) + R() * (o.rj ?? 260), r1 = 3000;
      g.fillStyle = rgba(col, (o.a || .8) * (.4 + R() * .6));
      g.beginPath(); g.moveTo(o.cx + Math.cos(a) * r0, o.cy + Math.sin(a) * r0);
      g.lineTo(o.cx + Math.cos(a - w) * r1, o.cy + Math.sin(a - w) * r1); g.lineTo(o.cx + Math.cos(a + w) * r1, o.cy + Math.sin(a + w) * r1); g.fill();
    }
  } else {
    const n = o.n || 70, y0 = o.y0 ?? 0, y1 = o.y1 ?? H;
    for (let i = 0; i < n; i++) {
      const y = y0 + R() * (y1 - y0), L = 300 + R() * 1100, x = R() * (W + L) - L, h = 1 + R() * (o.hmax || 7);
      const gr = g.createLinearGradient(x, 0, x + L, 0);
      gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.3, rgba(col, (o.a || .7) * (.4 + R() * .6))); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(x, y, L, h);
    }
  }
  g.restore();
}
// ——— lens flare: star burst + anamorphic streak + hexagonal ghosts through frame centre ———
export function flare(e, x, y, s = 1, col = '#bfe6ff', o = {}) {
  e.save(); e.globalCompositeOperation = 'lighter';
  const core = e.createRadialGradient(x, y, 0, x, y, 180 * s);
  core.addColorStop(0, rgba('#ffffff', .95)); core.addColorStop(.12, rgba(col, .6)); core.addColorStop(1, rgba(col, 0));
  e.fillStyle = core; e.beginPath(); e.arc(x, y, 180 * s, 0, TAU); e.fill();
  const L = (o.streak ?? 700) * s, hh = 5 * s;
  const gr = e.createLinearGradient(x - L, 0, x + L, 0);
  gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.5, rgba(mix(col, '#ffffff', .6), .9)); gr.addColorStop(1, rgba(col, 0));
  e.fillStyle = gr; e.fillRect(x - L, y - hh, L * 2, hh * 2);
  e.fillStyle = rgba('#ffffff', .8); e.fillRect(x - L * .3, y - 1.2 * s, L * .6, 2.4 * s);
  const spikes = o.spikes ?? 6, rot = o.rot ?? .3;
  for (let k = 0; k < spikes; k++) {
    const a = rot + k * TAU / spikes, len = (k % 2 ? 160 : 300) * s * (o.ray ?? 1);
    e.save(); e.translate(x, y); e.rotate(a);
    const sg = e.createLinearGradient(0, 0, len, 0); sg.addColorStop(0, rgba('#ffffff', .85)); sg.addColorStop(1, rgba(col, 0));
    e.fillStyle = sg; e.beginPath(); e.moveTo(0, -3 * s); e.lineTo(len, 0); e.lineTo(0, 3 * s); e.fill(); e.restore();
  }
  if (o.ghosts !== false) {
    const dx = W / 2 - x, dy = H / 2 - y;
    for (const [k, r, c, a] of [[.35, 40, '#7fffd4', .16], [.62, 22, '#ff9fe0', .22], [1.15, 70, '#8fb0ff', .1], [1.4, 30, '#ffe08a', .18], [1.75, 110, '#b08aff', .07]]) {
      const gx = x + dx * k * 2, gy = y + dy * k * 2;
      e.fillStyle = rgba(c, a * (o.ghostA ?? 1)); e.beginPath();
      for (let j = 0; j < 6; j++) { const aa = j * TAU / 6 + .3; e[j ? 'lineTo' : 'moveTo'](gx + Math.cos(aa) * r * s, gy + Math.sin(aa) * r * s); }
      e.fill();
    }
  }
  e.restore();
}
export function lamp(g, e, x, y, r, col, a = 1) {
  if (g) { g.fillStyle = mix(col, '#ffffff', .7); g.beginPath(); g.arc(x, y, r * .45, 0, TAU); g.fill(); }
  if (e) { const gr = e.createRadialGradient(x, y, 0, x, y, r * 3); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(.3, rgba(col, a * .5)); gr.addColorStop(1, rgba(col, 0)); e.fillStyle = gr; e.beginPath(); e.arc(x, y, r * 3, 0, TAU); e.fill(); }
}

// ——— 7-segment LED digits (the deadline clock) ———
//   segments a b c d e f g; unlit segments drawn faintly (real LED look); lit ones also go to the glow layer
const SEG = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' };
function segPath(s, x, y, w, h, t) {
  const sk = .12 * h;   // italic slant of the LED glass
  const P = (px, py) => [x + px + (h - py) / h * sk - sk / 2, y + py];
  const hx = (ax, ay, bx, by) => {   // hexagonal bar from a to b with thickness t
    const horiz = ay === by, q = t / 2, pts = horiz
      ? [[ax + q, ay], [ax + q * 2, ay - q], [bx - q * 2, by - q], [bx - q, by], [bx - q * 2, by + q], [ax + q * 2, ay + q]]
      : [[ax, ay + q], [ax + q, ay + q * 2], [bx + q, by - q * 2], [bx, by - q], [bx - q, by - q * 2], [ax - q, ay + q * 2]];
    return pts.map(([px, py]) => P(px, py));
  };
  const m = h / 2;
  const S = { a: hx(0, 0, w, 0), b: hx(w, 0, w, m), c: hx(w, m, w, h), d: hx(0, h, w, h), e: hx(0, m, 0, h), f: hx(0, 0, 0, m), g: hx(0, m, w, m) };
  return S[s];
}
export function led(g, e, txt, x, y, h, col = '#ff2a2a', o = {}) {
  const w = h * .52, t = h * .13, gap = h * .2, colonW = h * .28;
  let cx = x;
  const lit = mix(col, '#ffffff', .35), off = o.off ?? rgba(col, .09);
  for (const ch of txt) {
    if (ch === ':') {
      const on = o.colon ?? 1;
      for (const yy of [y + h * .3, y + h * .72]) {
        const sx = cx + colonW / 2 + (h - (yy - y)) / h * .12 * h - .06 * h;
        g.fillStyle = on ? lit : off; g.beginPath(); g.arc(sx, yy, t * .55, 0, TAU); g.fill();
        if (e && on) { e.fillStyle = rgba(col, .9 * (o.glow ?? 1)); e.beginPath(); e.arc(sx, yy, t * .9, 0, TAU); e.fill(); }
      }
      cx += colonW + gap * .4; continue;
    }
    const on = SEG[ch] || '';
    for (const s of 'abcdefg') {
      const pts = segPath(s, cx, y, w, h, t), isOn = on.includes(s);
      g.fillStyle = isOn ? lit : off; g.beginPath(); pts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0], p[1])); g.closePath(); g.fill();
      if (e && isOn) { e.save(); e.fillStyle = rgba(col, .95 * (o.glow ?? 1)); e.strokeStyle = rgba(col, .6 * (o.glow ?? 1)); e.lineWidth = t * .6; e.lineJoin = 'round'; e.beginPath(); pts.forEach((p, i) => e[i ? 'lineTo' : 'moveTo'](p[0], p[1])); e.closePath(); e.fill(); e.stroke(); e.restore(); }
    }
    cx += w + gap;
  }
  return cx - x;
}
export const ledWidth = (txt, h) => { let w = 0; for (const ch of txt) w += ch === ':' ? h * .28 + h * .2 * .4 : h * .52 + h * .2; return w; };
