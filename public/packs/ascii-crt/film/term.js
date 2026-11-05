// Character-grid engine, adapted from lemo-opuscar styles/ascii-crt/demo/term.js (MIT, LemoLab).
// Changes: vertical 1080x1920 frame, VT323 (alias 'Term') with the Turkish letters in the atlas, glyph tops not clipped (İ Ğ Ş dots/breves).
// Convention: the scene canvas is drawn additively; R = phosphor (green) intensity, G = the one warm second colour (crt.js colours them).
// Cell: width cw, height ch = 2cw (VT323 advance = 0.4em, cell 0.8em tall), font size fs = cw / 0.4.
export const W = 1080, H = 1920;
export const FONT = 'Term';
const GS = 160;                                   // atlas font size
const GW = GS * .4, GH = GS * .8, BASE = GS * .64;
const PAD = 6;
const CHARS = [];
for (let c = 32; c < 127; c++) CHARS.push(String.fromCharCode(c));
for (const c of 'ÇçĞğİıÖöŞşÜü') CHARS.push(c);
export const COLS_ATLAS = 16;
export let ATLAS = null;

export async function initTerm() {
  await document.fonts.load(`${GS}px ${FONT}`);
  await document.fonts.load(`${GS}px ${FONT}`, 'ÇĞİıÖŞÜçğöşü');
  const rows = Math.ceil(CHARS.length / COLS_ATLAS);
  const aw = COLS_ATLAS * (GW + PAD * 2), ah = rows * (GH + PAD * 2);
  const white = document.createElement('canvas'); white.width = aw; white.height = ah;
  const g = white.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.font = `${GS}px ${FONT}`; g.textBaseline = 'alphabetic';
  g.lineJoin = 'round'; g.lineWidth = 2.2;       // electron-beam spread: slightly fatter, rounder strokes
  const pos = {};
  CHARS.forEach((ch, i) => {
    const x = (i % COLS_ATLAS) * (GW + PAD * 2) + PAD, y = Math.floor(i / COLS_ATLAS) * (GH + PAD * 2) + PAD;
    pos[ch] = [x, y];
    g.save(); g.beginPath(); g.rect(x - 2, y - PAD, GW + 4, GH + PAD); g.clip();
    g.fillText(ch, x, y + BASE); g.strokeText(ch, x, y + BASE);
    g.restore();
  });
  const cov = {};
  const d = g.getImageData(0, 0, aw, ah).data;
  for (const ch of CHARS) {
    const [x, y] = pos[ch]; let s = 0;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) s += d[((y + j) * aw + x + i) * 4 + 3];
    cov[ch] = s / 255 / (GW * GH);
  }
  const tint = col => { const c = document.createElement('canvas'); c.width = aw; c.height = ah; const x = c.getContext('2d');
    x.drawImage(white, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, aw, ah); return c; };
  ATLAS = { red: tint('#ff0000'), green: tint('#00ff00'), black: tint('#000000'), white, pos, cov, GW, GH };
  return ATLAS;
}
// Stamp one glyph: top-left (x,y), cell width cw; a = brightness 0..2; chan 0 = phosphor, 1 = warm
export function glyph(g, ch, x, y, cw, a = 1, chan = 0) {
  if (ch === ' ' || a <= 0.004) return;
  const p = ATLAS.pos[ch]; if (!p) return;
  const src = chan ? ATLAS.green : ATLAS.red, k = cw / GW;
  g.globalAlpha = Math.min(1, a);
  g.drawImage(src, p[0], p[1] - PAD, GW, GH + PAD, x, y - PAD * k, cw, (GH + PAD) * k);
  if (a > 1) { g.globalAlpha = Math.min(1, a - 1); g.drawImage(src, p[0], p[1] - PAD, GW, GH + PAD, x, y - PAD * k, cw, (GH + PAD) * k); }
}
// One line of text at (col,row) of view = {ox, oy, cw}
export function text(g, str, col, row, view, a = 1, chan = 0) {
  const { ox, oy, cw } = view;
  for (let i = 0; i < str.length; i++) glyph(g, str[i], ox + (col + i) * cw, oy + row * cw * 2, cw, a, chan);
}
// Inverse video: solid block, glyphs knocked out in black (the scene canvas is opaque black)
export function inverse(g, str, col, row, view, a = 1, chan = 0) {
  const { ox, oy, cw } = view;
  const x = ox + col * cw, y = oy + row * cw * 2;
  g.globalAlpha = Math.min(1, a); g.fillStyle = chan ? '#00ff00' : '#ff0000';
  g.fillRect(x, y - cw * .12, str.length * cw, cw * 2.02);   // taller than the demo's block so the dot of İ and the breve of Ğ stay inside
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const k = cw / GW;
  for (let i = 0; i < str.length; i++) { const p = ATLAS.pos[str[i]]; if (p && str[i] !== ' ') g.drawImage(ATLAS.black, p[0], p[1] - PAD, GW, GH + PAD, x + i * cw, y - PAD * k, cw, (GH + PAD) * k); }
  g.globalCompositeOperation = 'lighter';
}
export function cursor(g, col, row, view, a = 1, chan = 0) {
  const { ox, oy, cw } = view;
  g.globalAlpha = Math.min(1, a); g.fillStyle = chan ? '#00ff00' : '#ff0000';
  g.fillRect(ox + col * cw + cw * .06, oy + row * cw * 2 + cw * .22, cw * .88, cw * 1.56);
}
// Density table: characters sorted by measured ink coverage × attribute (dim / normal / bold)
export function makeRamp(chars, attrs = [.42, .7, 1]) {
  const set = [...new Set(chars.split(''))].filter(c => c !== ' ');
  const mx = Math.max(...set.map(c => ATLAS.cov[c]));
  const lv = [{ ch: ' ', a: 0, v: 0 }];
  for (const c of set) for (const a of attrs) lv.push({ ch: c, a, v: ATLAS.cov[c] / mx * a });
  lv.sort((p, q) => p.v - q.v);
  const out = [lv[0]];
  for (const l of lv.slice(1)) { if (l.v - out[out.length - 1].v > .018) out.push(l); else if (l.a > out[out.length - 1].a) out[out.length - 1] = l; }
  return out;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16 - .5);
export function pick(ramp, L, i, j, dither = .6) {
  const n = ramp.length - 1;
  let hsh = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; hsh -= Math.floor(hsh);
  const x = L * n + (BAYER[(j & 3) * 4 + (i & 3)] * .5 + (hsh - .5) * .5) * dither * 1.6;
  return ramp[Math.max(0, Math.min(n, Math.round(x)))];
}
