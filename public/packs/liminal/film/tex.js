// Procedural textures (Canvas2D), deterministic. Adapted from lemo-opuscar styles/backrooms/demo/tex.js (MIT, LemoLab).
import * as THREE from 'three';
import { mulberry } from './core/lib.js';
import { IN } from './inputs.js';

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function tex(c, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function grain(x, w, h, n, a, R, cols) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = cols[Math.floor(R() * cols.length)]; x.globalAlpha = a * (0.3 + R() * 0.7);
    const s = 1 + R() * 2; x.fillRect(R() * w, R() * h, s, s);
  }
  x.globalAlpha = 1;
}

// Yellowed office wallpaper: one roll 0.53 m wide, faint double stripes, faded diamonds
export function wallpaper() {
  const S = 512, c = cv(S, S), x = c.getContext('2d'), R = mulberry(11);
  x.fillStyle = '#d2bd6c'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 2) { x.fillStyle = `rgba(120,100,40,${0.03 + 0.03 * Math.sin(i * 0.05) ** 2})`; x.fillRect(i, 0, 2, S); }
  const cols = 8, cw = S / cols;
  for (let k = 0; k < cols; k++) {
    const x0 = k * cw;
    if (k % 2) { x.fillStyle = 'rgba(150,120,40,.09)'; x.fillRect(x0, 0, cw, S); }
    x.fillStyle = 'rgba(140,112,40,.55)'; x.fillRect(x0 + 2, 0, 3, S); x.fillRect(x0 + 8, 0, 2, S);
    for (let j = 0; j < S / 32; j++) {
      const cx = x0 + cw * 0.6 + 0.8, cy = j * 32 + 16 + (k % 2) * 16;
      x.beginPath(); x.moveTo(cx, cy - 7); x.lineTo(cx + 5, cy); x.lineTo(cx, cy + 7); x.lineTo(cx - 5, cy); x.closePath();
      if ((j + k) % 2) { x.fillStyle = 'rgba(150,122,48,.45)'; x.fill(); } else { x.strokeStyle = 'rgba(150,122,48,.5)'; x.lineWidth = 1.8; x.stroke(); }
    }
  }
  grain(x, S, S, 26000, 0.08, R, ['#8a7433', '#f3e6ad', '#6b5a26']);
  x.fillStyle = 'rgba(255,245,200,.35)'; x.fillRect(0, 0, 2, S);
  x.fillStyle = 'rgba(90,70,20,.35)'; x.fillRect(2, 0, 1, S);
  return tex(c);
}

// Office carpet tiles (0.5 m), mustard-brown, mottled, faint tile seams
export function carpet() {
  const S = 512, c = cv(S, S), x = c.getContext('2d'), R = mulberry(23);
  x.fillStyle = '#8a7640'; x.fillRect(0, 0, S, S);
  grain(x, S, S, 90000, 0.22, R, ['#6d5b2e', '#a88f55', '#7d6a38', '#b59c60', '#5d4d26']);
  for (let j = 0; j < S; j += 3) { x.fillStyle = `rgba(60,48,20,${0.05 + R() * 0.05})`; x.fillRect(0, j, S, 1); }
  // tile seams (texture = 1 m: two tiles each way), alternate tiles slightly different shade (quarter-turned pile)
  x.fillStyle = 'rgba(40,30,10,.08)'; x.fillRect(0, 0, S / 2, S / 2); x.fillRect(S / 2, S / 2, S / 2, S / 2);
  x.fillStyle = 'rgba(40,32,14,.35)'; x.fillRect(0, 0, S, 2); x.fillRect(0, S / 2, S, 2); x.fillRect(0, 0, 2, S); x.fillRect(S / 2, 0, 2, S);
  return tex(c);
}

// Mineral-fibre ceiling tiles + T-bar grid (texture = 1.2 × 1.2 m)
export function ceiling() {
  const S = 512, c = cv(S, S), x = c.getContext('2d'), R = mulberry(31);
  x.fillStyle = '#d9d3b8'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) { x.fillStyle = `rgba(110,100,70,${0.18 + R() * 0.3})`; x.fillRect(R() * S, R() * S, 1 + R() * 2.5, 1 + R() * 1.2); }
  grain(x, S, S, 20000, 0.1, R, ['#a79f82', '#eee8d0']);
  x.fillStyle = '#e6e1cf';
  x.fillRect(0, 0, S, 5); x.fillRect(0, S - 5, S, 5); x.fillRect(0, 0, 5, S); x.fillRect(S - 5, 0, 5, S); x.fillRect(S / 2 - 5, 0, 10, S);
  x.fillStyle = 'rgba(70,60,40,.6)';
  x.fillRect(0, 5, S, 1); x.fillRect(0, S - 6, S, 1); x.fillRect(5, 0, 1, S); x.fillRect(S - 6, 0, 1, S); x.fillRect(S / 2 - 6, 0, 1, S); x.fillRect(S / 2 + 5, 0, 1, S);
  return tex(c);
}

// Prismatic troffer diffuser 0.6 × 1.2 m
export function troffer() {
  const W = 128, H = 256, c = cv(W, H), x = c.getContext('2d'), R = mulberry(41);
  x.fillStyle = '#9a9786'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#fbfaf0'; x.fillRect(7, 7, W - 14, H - 14);
  for (let i = 7; i < W - 7; i += 4) { x.fillStyle = 'rgba(180,180,160,.25)'; x.fillRect(i, 7, 1, H - 14); }
  for (let j = 7; j < H - 7; j += 4) { x.fillStyle = 'rgba(180,180,160,.25)'; x.fillRect(7, j, W - 14, 1); }
  const g1 = x.createLinearGradient(7, 0, W - 7, 0);
  g1.addColorStop(0, 'rgba(255,255,255,0)'); g1.addColorStop(.3, 'rgba(255,255,255,.5)'); g1.addColorStop(.36, 'rgba(255,255,255,0)');
  g1.addColorStop(.64, 'rgba(255,255,255,0)'); g1.addColorStop(.7, 'rgba(255,255,255,.5)'); g1.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g1; x.fillRect(7, 7, W - 14, H - 14);
  for (let i = 0; i < 3; i++) { x.fillStyle = 'rgba(60,55,40,.35)'; x.beginPath(); x.ellipse(15 + R() * (W - 30), 20 + R() * (H - 40), 2 + R() * 3, 1 + R() * 2, R() * 3, 0, 7); x.fill(); }
  return tex(c, { repeat: false });
}

// Divider fabric: olive-beige woven panel
export function fabric() {
  const S = 256, c = cv(S, S), x = c.getContext('2d'), R = mulberry(61);
  x.fillStyle = '#9b8d5c'; x.fillRect(0, 0, S, S);
  grain(x, S, S, 30000, 0.22, R, ['#7c6f45', '#b4a570', '#8a7c4e']);
  for (let j = 0; j < S; j += 2) { x.fillStyle = `rgba(50,44,20,${0.04 + R() * 0.04})`; x.fillRect(0, j, S, 1); }
  return tex(c);
}

// The sticky note: canary paper, adhesive band, marker handwriting (Caveat)
export function note() {
  const S = 768, c = cv(S, S), x = c.getContext('2d'), R = mulberry(7);
  x.fillStyle = '#f1df78'; x.fillRect(0, 0, S, S);
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(255,250,210,.35)'); g.addColorStop(.18, 'rgba(255,250,210,0)'); g.addColorStop(1, 'rgba(150,120,30,.22)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  grain(x, S, S, 9000, 0.05, R, ['#b49a3a', '#fff6c0']);
  x.fillStyle = 'rgba(120,95,20,.10)'; x.fillRect(0, 0, S, 120);           // adhesive band
  x.fillStyle = '#1c1a17'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.save(); x.translate(S / 2, 0); x.rotate(-0.035);
  x.font = "700 190px 'Hand'"; x.fillText(IN.note1, -4, 330);
  let fs = 160; x.font = `700 ${fs}px 'Hand'`;
  const l2 = IN.note2; let w2 = x.measureText(l2).width;
  if (w2 > 690) { fs = Math.floor(fs * 690 / w2); x.font = `700 ${fs}px 'Hand'`; w2 = x.measureText(l2).width; }
  const wy = x.measureText(IN.note2.split(' ')[0]).width, sx = -w2 / 2 + 6;
  x.textAlign = 'left'; x.fillText(l2, sx, 560);
  // double underline under "yarın"
  x.lineWidth = 9; x.lineCap = 'round'; x.strokeStyle = '#1c1a17';
  x.beginPath(); x.moveTo(sx - 6, 594); x.quadraticCurveTo(sx + wy * .5, 584, sx + wy + 8, 590); x.stroke();
  x.beginPath(); x.moveTo(sx + 4, 620); x.quadraticCurveTo(sx + wy * .5, 612, sx + wy - 2, 617); x.stroke();
  x.restore();
  // edge darkening + lifted bottom-right corner shadow
  x.strokeStyle = 'rgba(120,95,20,.35)'; x.lineWidth = 6; x.strokeRect(3, 3, S - 6, S - 6);
  const cg = x.createLinearGradient(S * .78, S * .78, S, S); cg.addColorStop(0, 'rgba(0,0,0,0)'); cg.addColorStop(1, 'rgba(90,70,10,.35)');
  x.fillStyle = cg; x.fillRect(0, 0, S, S);
  return tex(c, { repeat: false, aniso: 16 });
}

// CRT left on: saturated blue field, tube vignette, faint raster and a DOS-style status line
export function crtBlue() {
  const W = 512, H = 384, c = cv(W, H), x = c.getContext('2d');
  x.fillStyle = '#0e2bc4'; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .78);
  vg.addColorStop(0, 'rgba(70,110,255,.25)'); vg.addColorStop(1, 'rgba(0,0,30,.55)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
  for (let j = 0; j < H; j += 3) { x.fillStyle = 'rgba(0,0,40,.10)'; x.fillRect(0, j, W, 1); }
  return tex(c, { repeat: false });
}

// Dark CRT glass
export function crtDark() {
  const W = 256, H = 192, c = cv(W, H), x = c.getContext('2d');
  const g = x.createRadialGradient(W * .45, H * .4, 10, W / 2, H / 2, W * .7);
  g.addColorStop(0, '#2b302d'); g.addColorStop(1, '#0d0f0e');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  return tex(c, { repeat: false });
}
