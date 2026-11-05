// HypeStudio Gala Gecesi · 1930 — four shots on one centre axis, 1080x1920.
// Drawing engine reused from lemo-opuscar styles/art-deco/demo (MIT, LemoLab): deco.js, type.js, cam.js, chars.js.
import * as D from './engine/deco.js';
import * as T from './engine/type.js';
import { makeCam } from './engine/cam.js';
import * as CH from './chars.js';
const { C } = D;

// ---- template inputs (window.PACK_INPUTS via the pack bridge); every on-screen word comes from here
const P = (k, d) => (typeof window.packInput === 'function' ? window.packInput(k, d) : d);
// upper case by the episode's language: Turkish turns i into İ, English must not
const LOCALE = (typeof window.packInput === 'function' ? window.packInput('lang', 'tr') : 'tr') === 'en' ? 'en-US' : 'tr-TR';
const UP = (s) => String(s).trim().toLocaleUpperCase(LOCALE);
export const IN = {
  brand: UP(P('brand', 'HYPESTUDIO')),
  title: UP(P('title', 'GALA')),
  subtitle: UP(P('subtitle', 'GECESİ')),
  year: String(P('year', '1930')).replace(/\D/g, '').padStart(4, '0').slice(-4),
  headline: UP(P('headline', 'DAVETLİSİNİZ')),
  date: UP(P('date', '31 ARALIK 1930')),
  details: UP(P('details', 'SAAT 21.00  ·  KAT 30')),
  salutation: UP(P('salutation', 'SAYIN DAVETLİMİZ')),
  monogram: UP(P('monogram', 'H')).slice(0, 2),
};
// Shrink a text until it fits its width (titles never run off the frame, whatever is typed).
const fit = (g, s, size, maxW, font, track = 0, weight = '') => Math.min(size, size * maxW / Math.max(1, T.measure(g, s, size, font, track, weight)));

export const W = 1080, H = 1920, CX = 540;
export const DUR = 16.0;

// ---- timeline (film seconds). Voice sentences are placed separately (see STYLE-NOTES.md):
//  A "Bu gece, şehrin en ışıltılı katında..." @0.35 · B "HypeStudio Gala Gecesi." @3.85 · C "Asansör sizi bekliyor." @7.70 · D "Davetiyeniz hazır." @10.62
export const TM = {
  lit0: .25, topFloor: 1.95, crown0: 2.45, crown1: 3.25, flare: 3.28, title: 3.75,
  hype: 3.87, gala: 4.55, badge: 5.45, split0: 7.25, split1: 7.8,
  needle0: 7.85, needle1: 9.62, ding: 9.8, doors0: 10.0, doors1: 10.68,
  rise0: 10.3, rise1: 11.25, seal: 12.0, flap0: 12.08, flap1: 12.5, slide0: 12.32, slide1: 12.95,
  card0: 12.9, card1: 13.6, bulbs0: 13.75,
};

const fill = (g, c) => { g.fillStyle = c; g.fillRect(0, 0, W, H); };
function plaquePts(cx, cy, w, h, step = .18) {   // stepped-end plaque (same shape as type.js titleBar)
  const hw = w / 2, hh = h / 2, s = h * step;
  return [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx + hw, cy - hh + s], [cx + hw + s, cy - hh + s], [cx + hw + s, cy - hh + 2 * s], [cx + hw + 2 * s, cy - hh + 2 * s],
  [cx + hw + 2 * s, cy + hh - 2 * s], [cx + hw + s, cy + hh - 2 * s], [cx + hw + s, cy + hh - s], [cx + hw, cy + hh - s], [cx + hw, cy + hh],
  [cx - hw, cy + hh], [cx - hw, cy + hh - s], [cx - hw - s, cy + hh - s], [cx - hw - s, cy + hh - 2 * s], [cx - hw - 2 * s, cy + hh - 2 * s],
  [cx - hw - 2 * s, cy - hh + 2 * s], [cx - hw - s, cy - hh + 2 * s], [cx - hw - s, cy - hh + s], [cx - hw, cy - hh + s], [cx - hw, cy - hh]];
}
// Left/right halves of a stepped round-crowned arch (stepArchPts geometry), each from its base up to the apex, plus the lunette rule.
function archHalves(cx, base, w, h, steps = 3) {
  const sw = w * .09, sh = h * .085, half = w / 2;
  let x = cx - half, y = base - (h - steps * sh - (half - steps * sw));
  const L = [[cx - half, base], [x, y]];
  for (let i = 0; i < steps; i++) { x += sw; L.push([x, y]); y -= sh; L.push([x, y]); }
  const r = cx - x; for (let i = 1; i <= 24; i++) { const a = Math.PI + Math.PI / 2 * i / 24; L.push([cx + Math.cos(a) * r, y + Math.sin(a) * r]); }
  return { left: L, right: L.map(([px, py]) => [2 * cx - px, py]), lunette: [[cx - r, y], [cx + r, y]] };
}
function text(g, s, x, y, { size = 30, font = 'Josefin', weight = 600, track = 0, color = C.ivory, alpha = 1, align = 'center' } = {}) {
  g.save(); g.globalAlpha *= alpha; g.font = `${weight} ${size}px ${font}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = `${track}px`;
  const w = g.measureText(s).width - track; g.fillStyle = color;
  g.fillText(s, align === 'center' ? x - w / 2 : x, y); g.restore(); return w;
}

// =====================================================================================================
// SHOT 1 · the tower. Low-angle crane + tilt up a stepped skyscraper; windows light floor by floor,
// the top floor ("en ışıltılı kat") ignites, its crown draws on in gold and bursts into the title's rays.
// =====================================================================================================
const TIERS = [
  { y0: 0, y1: 58, hw: 21, z: 70, cols: 12 },
  { y0: 58, y1: 88, hw: 17, z: 72.5, cols: 10 },
  { y0: 88, y1: 108, hw: 13.5, z: 74.5, cols: 8 },
  { y0: 108, y1: 117, hw: 11.5, z: 75.5, cols: 0, band: true },
  { y0: 117, y1: 132, hw: 10, z: 76.5, cols: 7, top: true },
];
const NEIGH = [
  { x: -26, hw: 8, z: 46, h: 190, cols: 4, seed: 3 }, { x: 27, hw: 8.5, z: 49, h: 210, cols: 4, seed: 7 },
  { x: -52, hw: 12, z: 105, h: 64, cols: 5, seed: 11 }, { x: 55, hw: 12, z: 110, h: 78, cols: 5, seed: 13 },
];
function towerCam(t) {
  const k = D.eio(D.seg(t, 0, 3.55));
  return makeCam({ x: 0, y: D.lerp(2, 96, k), z: D.lerp(0, 10, k), f: D.lerp(950, 1250, k), pitch: D.lerp(.30, .62, k), W, H });
}
function quad(cam, x0, x1, y0, y1, z) { return [cam.P(x0, y1, z), cam.P(x1, y1, z), cam.P(x1, y0, z), cam.P(x0, y0, z)]; }
function face(g, cam, x0, x1, y0, y1, z, { top = '#0b0907', bot = '#3a2a16', rim = 1 } = {}) {
  const q = quad(cam, x0, x1, y0, y1, z);
  const gr = g.createLinearGradient(0, q[3][1], 0, q[0][1]); gr.addColorStop(0, bot); gr.addColorStop(1, top);
  g.fillStyle = gr; g.fill(D.toPath(q, true));
  const sg = g.createLinearGradient(q[0][0], 0, q[1][0], 0); sg.addColorStop(0, 'rgba(255,214,140,.10)'); sg.addColorStop(.35, 'rgba(255,214,140,0)'); sg.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = sg; g.fill(D.toPath(q, true));
  if (rim) D.gline(g, [...q, q[0]], { w: 1.8 * rim, alpha: .9 });
  return q;
}
function windows(g, cam, tier, t, seed, litAll = 0) {
  const { y0, y1, hw, z, cols } = tier; if (!cols) return;
  const rows = Math.max(1, Math.round((y1 - y0) / 3.6)), cw = 2 * hw / cols, rh = (y1 - y0) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const h = D.hash(seed * 97 + i * 13.7 + j * 3.1), x0 = -hw + i * cw + cw * .26, x1 = x0 + cw * .48, yy0 = y0 + j * rh + rh * .28, yy1 = yy0 + rh * .46;
    const tOn = TM.lit0 + (yy0 / 132) * 1.55 + D.hash(seed + i * 5.3 + j * 7.9) * .35;
    let on = (h < .46 ? 1 : 0) * D.seg(t, tOn, tOn + .12);
    if (litAll) { const tt = TM.topFloor + i * .07; on = Math.max(on, D.seg(t, tt, tt + .1)); }
    const q = quad(cam, x0, x1, yy0, yy1, z - .05);
    if (on > 0) {
      const flash = 1 + .6 * Math.max(0, 1 - Math.abs((t - (litAll ? TM.topFloor + i * .07 : tOn)) - .12) / .12) * (on < 1 ? 1 : 0);
      g.fillStyle = D.rgba(litAll ? '#ffe7a8' : '#ffc96a', Math.min(1, .78 * on * flash)); g.fill(D.toPath(q, true));
    } else { g.fillStyle = 'rgba(26,20,12,.9)'; g.fill(D.toPath(q, true)); }
  }
  // gold piers between every other column
  for (let i = 0; i <= cols; i += 2) { const x = -hw + i * (2 * hw / cols); D.gline(g, [cam.P(x, y0, z - .06), cam.P(x, y1, z - .06)], { w: 1.1, alpha: .55 }); }
}
function crown(g, cam, t) {
  const z = 77, base = 132, part = D.ss(D.seg(t, TM.crown0, TM.crown1)), lit = D.seg(t, TM.crown0, TM.crown1 + .1);
  const c = cam.P(0, base, z), s = cam.scaleAt(0, base, z);
  // world-sized stepped arches projected around their base centre (the crown faces the camera, small enough for an affine fit)
  const a = cam.P(0, base + 30, z), up = (c[1] - a[1]) / 30;      // px per metre upward at the crown
  const sx = s;
  g.save(); g.translate(c[0], c[1]); g.scale(sx, up);
  // dark crown body
  const body = D.stepArchPts(0, 0, 20, 30, { steps: 3, crown: 'round' });
  g.fillStyle = '#0d0a07'; g.fill(D.toPath(body, true));
  g.save(); g.clip(D.toPath(body, true));
  const gl = g.createRadialGradient(0, -4, 0, 0, -4, 24); gl.addColorStop(0, `rgba(255,214,130,${.75 * lit})`); gl.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = gl; g.fillRect(-12, -32, 24, 34);
  g.restore();
  g.restore();
  // arch keylines + sunburst inside: drawn in screen space for crisp line widths
  const P = (x, y) => [c[0] + x * sx, c[1] - y * up];
  for (let i = 0; i < 3; i++) {
    const pts = D.stepArchPts(0, 0, 20 - i * 5, 30 - i * 6, { steps: 3, crown: 'round' }).map(([x, y]) => P(x, -y));
    D.gline(g, pts, { w: i ? 1.4 : 2.4, part, glow: .7 * lit });
  }
  if (part > 0) D.sunburst(g, c[0], c[1], { rays: 26, r0: 2 * sx, r1: 11 * sx * part, a0: Math.PI, a1: D.TAU, mode: 'lines', w: 1.4, alpha: .9 * lit });
  // spire
  const sp0 = P(0, 30), sp1 = P(0, 30 + 34 * part);
  if (part > 0) { D.gline(g, [sp0, sp1], { w: 3, glow: lit }); D.glow(g, c[0], c[1] - 14 * up, 160 * sx / 6, '#ffcf7a', .5 * lit); }
  return { c, tip: sp1, lit, sx };
}
function sky(g, cam, t) {
  const hz = cam.P(0, cam.y, 1e5)[1];
  const gr = g.createLinearGradient(0, hz - 2600, 0, hz); gr.addColorStop(0, '#050508'); gr.addColorStop(.62, '#0a0e16'); gr.addColorStop(.9, '#10231f'); gr.addColorStop(1, '#173a31');
  fill(g, gr);
  const R = D.mulberry(5);
  for (let i = 0; i < 70; i++) {          // stars fixed in world directions (they move with the tilt)
    const az = (R() - .5) * 1.3, el = .15 + R() * 1.25, p = cam.P(Math.sin(az) * 1e4, cam.y + Math.tan(el) * 1e4, Math.cos(az) * 1e4);
    const tw = .5 + .5 * Math.sin(t * 3 + i * 1.7), r = R() < .12 ? 10 : 2.2;
    if (r > 3) D.sparkle(g, p[0], p[1], r * (.7 + .3 * tw), { alpha: .7 }); else { g.fillStyle = `rgba(255,240,210,${.35 + .4 * tw})`; g.fillRect(p[0], p[1], r, r); }
  }
  if (hz < H + 400) {   // plaza below the horizon: lacquer ground, gold rays converging on the lit entrance, streetlight pools
    const gg = g.createLinearGradient(0, hz, 0, hz + 600); gg.addColorStop(0, '#1a130b'); gg.addColorStop(1, '#050403');
    g.fillStyle = gg; g.fillRect(0, hz, W, H - hz + 1);
    const ent = cam.P(0, 0, 69.5);
    D.glow(g, ent[0], ent[1] + 40, 700, '#ffcf7a', .28, .4);
    for (let k = -14; k <= 14; k++) { const n = cam.P(k * 5, 0, 2.2); D.gline(g, [ent, n], { w: k % 2 ? .9 : 1.6, alpha: .55 - Math.abs(k) * .02 }); }
    for (const z of [12, 22, 36, 54]) { const a = cam.P(-60, 0, z), b = cam.P(60, 0, z); D.gline(g, [a, b], { w: 1, alpha: .35 }); }
    for (let i = 0; i < 9; i++) { const z = 14 + i * 7, p = cam.P((i % 2 ? -1 : 1) * 16, 0, z); D.glow(g, p[0], p[1], 260 * 14 / z, '#ffc56a', .4, .3); }
  }
}
function beams(g, cam, t) {
  for (const [x, ph, sp] of [[-30, 0, .55], [34, 2.1, .47], [-8, 4.2, .38]]) {
    const ang = Math.sin(t * sp + ph) * .42, b = cam.P(x, 0, 90), tip = cam.P(x + Math.sin(ang) * 600, 600 * Math.cos(ang), 90 + 220);
    const a = Math.atan2(tip[1] - b[1], tip[0] - b[0]);
    D.beam(g, b[0], b[1], a, Math.hypot(tip[0] - b[0], tip[1] - b[1]) * 1.2, 520, .16, '#f6ecd0');
  }
}
export function towerShot(g, t) {
  const cam = towerCam(t);
  sky(g, cam, t);
  beams(g, cam, t);
  // far neighbours, then the hero tower (top tier first: setbacks hide behind the tier below), then near neighbours
  const nb = n => { face(g, cam, n.x - n.hw, n.x + n.hw, 0, n.h, n.z, { top: '#070605', bot: '#1d150c', rim: .6 }); windows(g, cam, { y0: 0, y1: n.h, hw: n.hw, z: n.z, cols: n.cols }, t, n.seed); };
  // windows() works in tier-local x around 0: shift neighbours with a translate in world x
  const nbAt = n => { const sh = { ...n }; face(g, cam, n.x - n.hw, n.x + n.hw, 0, n.h, n.z, { top: '#060504', bot: '#1d150c', rim: .55 });
    const cols = n.cols, rows = Math.round(n.h / 3.6), cw = 2 * n.hw / cols, rh = n.h / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const h = D.hash(n.seed * 31 + i * 7.1 + j * 2.3); if (h > .3) continue;
      const x0 = n.x - n.hw + i * cw + cw * .28, yy0 = j * rh + rh * .3, tOn = TM.lit0 + yy0 / 150 + D.hash(n.seed + i + j * 3) * .5, on = D.seg(t, tOn, tOn + .12);
      if (on <= 0) continue; g.fillStyle = `rgba(255,196,110,${.5 * on})`; g.fill(D.toPath(quad(cam, x0, x0 + cw * .44, yy0, yy0 + rh * .42, n.z - .05), true)); }
    for (let i = 0; i <= cols; i++) { const x = n.x - n.hw + i * cw; D.gline(g, [cam.P(x, 0, n.z - .06), cam.P(x, n.h, n.z - .06)], { w: .9, alpha: .35 }); } };
  nbAt(NEIGH[2]); nbAt(NEIGH[3]);
  // halo behind the tower top once it lights
  const top = cam.P(0, 140, 77), tl = D.seg(t, TM.topFloor, TM.crown1);
  D.glow(g, top[0], top[1], 900 * tl + 200, '#ffcf7a', .32 * tl);
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const tr = TIERS[i];
    face(g, cam, -tr.hw, tr.hw, tr.y0, tr.y1, tr.z, tr.top ? { top: '#2a1d0e', bot: '#5a3f1c', rim: 1.4 } : tr.band ? { top: '#16100a', bot: '#2c2012' } : {});
    if (tr.band) { // chevron band under the top floor
      const pts = []; for (let k = 0; k <= 12; k++) { const x = -tr.hw + k * tr.hw / 6; pts.push(cam.P(x, k % 2 ? tr.y0 + 2.5 : tr.y1 - 2.5, tr.z - .06)); }
      D.gline(g, pts, { w: 1.6, glow: .3 * tl });
    }
    windows(g, cam, tr, t, i + 1, tr.top ? 1 : 0);
    if (tr.top) { const q = quad(cam, -tr.hw, tr.hw, tr.y0, tr.y1, tr.z); D.gline(g, [...q, q[0]], { w: 2.4, glow: tl }); }
  }
  // entrance arch glowing at street level
  { const e = cam.P(0, 0, 69.9), s = cam.scaleAt(0, 0, 69.9); if (e[1] < H + 200) { D.glow(g, e[0], e[1] - 4 * s, 9 * s, '#ffcf7a', .6); D.gline(g, D.stepArchPts(e[0], e[1], 7 * s, 9 * s, { steps: 2 }), { w: 1.6, glow: .5 }); } }
  const cr = crown(g, cam, t);
  nbAt(NEIGH[0]); nbAt(NEIGH[1]);
  if (cr.lit > .95) D.sparkle(g, cr.tip[0], cr.tip[1], 60 * D.ss(D.seg(t, TM.crown1 - .05, TM.flare + .1)), { rot: t });
  // FLARE: the crown's rays explode and slide to the title's centre (match cut on the sunburst)
  const fk = D.seg(t, TM.flare, TM.title);
  if (fk > 0) {
    const cx = D.lerp(cr.c[0], CX, D.eio(fk)), cy = D.lerp(cr.c[1] - 10, 860, D.eio(fk));
    g.fillStyle = `rgba(5,4,3,${.85 * D.ss(D.seg(fk, .2, 1))})`; g.fillRect(0, 0, W, H);
    D.sunburst(g, cx, cy, { rays: 72, r0: 40, r1: 60 + D.eo(fk) * 2200, mode: 'lines', w: 2.2, alpha: .85, glow: .4 });
    D.glow(g, cx, cy, 300 + 900 * fk, '#ffe2a0', .55 * Math.sin(fk * Math.PI));
    D.sparkle(g, cx, cy, 90 * (1 - fk) + 20, { rot: t * 2 });
  }
  D.vignette(g, W, H, .5);
}

// =====================================================================================================
// SHOT 2 · golden sunburst title card (stacked for 9:16): HYPESTUDIO plaque → GALA / GECESİ bar → 1930 badge
// =====================================================================================================
function smallPlaque(g, label, cx, cy, p, { size = 34, track = 14 } = {}) {
  if (p <= 0) return;
  const tw = T.measure(g, label, size, 'Josefin', track, 600), Wp = tw + size * 1.6, Hp = size * 1.7;
  const line = D.ss(D.seg(p, 0, .35)), open = D.eio(D.seg(p, .25, .65)), txt = D.ss(D.seg(p, .5, 1));
  if (open < 1) D.gline(g, [[cx - Wp / 2 * line - 20, cy], [cx + Wp / 2 * line + 20, cy]], { w: 1.8, glow: .6 * (1 - open) });
  if (open > 0) {
    const pts = plaquePts(cx, cy, Wp, Hp * open, .16);
    g.fillStyle = 'rgba(6,5,4,.92)'; g.fill(D.toPath(pts, true));
    D.gline(g, pts, { w: 2, closed: true, bb: [cx - Wp / 2, cy - Hp, cx + Wp / 2, cy + Hp] });
  }
  if (txt > 0) { g.save(); g.beginPath(); g.rect(0, cy - Hp / 2 * open, W, Hp * open); g.clip();
    T.goldText(g, label, cx + track / 2, cy + size * .36 + (1 - txt) * size * .5, { size, font: 'Josefin', weight: 600, track, alpha: txt, shadow: false, sheen: .55 }); g.restore(); }
}
export function titleShot(g, t) {
  const t0 = TM.title, cx = CX, cy = 860;
  const push = 1 + .045 * D.seg(t, t0, TM.split1);
  fill(g, '#050403');
  g.save(); g.translate(cx, cy); g.scale(push, push); g.translate(-cx, -cy);
  D.sunburst(g, cx, cy, { rays: 72, r0: 30, r1: 2200, mode: 'wedges', colorA: 'rgba(201,162,75,.075)' });
  D.glow(g, cx, cy, 760, '#c9a24b', .22);
  const d = D.eo(D.seg(t, t0 - .05, t0 + .8));
  D.sunburst(g, cx, cy, { rays: 72, r0: 40, r1: 80 + d * 2100, mode: 'lines', w: 2, alpha: .62, sheen: .3 + d * .5 });
  if (t > TM.gala) D.sunburst(g, cx, cy, { rays: 72, r0: 40, r1: 2200, mode: 'wedges', colorA: `rgba(201,162,75,${.05 * D.eo(D.seg(t, TM.gala, TM.gala + .6))})` });
  for (let i = 0; i < 3; i++) {   // three tall stepped arches draw on symmetrically from both bases to the crown, outer first
    const p = D.ss(D.seg(t, t0 + .05 + i * .14, t0 + 1.0 + i * .14));
    const { left, right, lunette } = archHalves(cx, 1600, 1000 - i * 150, 1260 - i * 130, 3);
    for (const half of [left, right]) D.gline(g, half, { w: i ? 1.6 : 2.6, part: p, glow: .5 });
    if (p > .85) D.gline(g, lunette, { w: i ? 1.2 : 1.8, part: D.seg(p, .85, 1), alpha: .9 });
  }
  D.chevrons(g, 250, 830, 1395, { n: 10, h: 18, w: 1.4, rows: 2, gap: 10 });
  g.restore();
  smallPlaque(g, IN.brand, cx, 600, D.seg(t, TM.hype - .1, TM.hype + .55), { size: fit(g, IN.brand, 34, 640, 'Josefin', 14, 600) });
  D.glow(g, cx, 850, 620, '#ffcf7a', .16 * D.eo(D.seg(t, TM.gala, TM.gala + .8)));
  T.titleBar(g, IN.title, cx, 852, { p: D.seg(t, TM.gala - .12, TM.gala + .95), size: fit(g, IN.title, 168, 700, 'Limelight', 6), sub: IN.subtitle, subSize: fit(g, IN.subtitle, 56, 700, 'Josefin', 25, 600), wings: false, pad: 70,
    sheen: D.lerp(-.2, .7, D.eo(D.seg(t, TM.gala + .45, TM.gala + 2.0))) });
  T.yearBadge(g, IN.year, cx, 1180, 82, { p: D.seg(t, TM.badge, TM.badge + .75) });
  const sp = D.seg(t, TM.badge + .5, TM.badge + .95);
  if (sp > 0 && sp < 1) D.sparkle(g, cx + 70, 1100, 46 * Math.sin(sp * Math.PI), { rot: sp });
  D.vignette(g, W, H, .5);
}

// =====================================================================================================
// SHOT 3 · the elevator: floor dial sweeps L → 30, ding, bronze doors part onto the gala floor (shot 4 live behind them)
// =====================================================================================================
const DOOR = { x0: 215, x1: 865, y0: 1030, y1: 1920 };
function needle(t) {
  const k = D.seg(t, TM.needle0, TM.needle1);
  const e = D.eio(k), settle = t > TM.needle1 ? Math.sin((t - TM.needle1) * 26) * Math.exp(-(t - TM.needle1) * 9) * .025 : 0;
  return D.clamp(e + settle, 0, 1.02);
}
function bronzeLeaf(g, x0, w, y0, h, seamX) {
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  const lg = g.createLinearGradient(DOOR.x0, y0, DOOR.x1, y0 + h); lg.addColorStop(0, '#4a3515'); lg.addColorStop(.45, '#9c7a3c'); lg.addColorStop(.55, '#b8964f'); lg.addColorStop(1, '#3a2810');
  g.fillStyle = lg; g.fillRect(x0, y0, w, h);
  D.sunburst(g, seamX, y0 + h * .5, { rays: 30, r0: 40, r1: 420, a0: Math.PI, a1: D.TAU, mode: 'lines', w: 1.4, alpha: .85 });
  D.gline(g, D.arcPts(seamX, y0 + h * .5, 120, Math.PI, D.TAU, 30), { w: 1.6 });
  D.gline(g, D.arcPts(seamX, y0 + h * .5, 60, Math.PI, D.TAU, 30), { w: 1.1 });
  for (let k = 0; k < 3; k++) D.gline(g, [[x0, y0 + h * (.68 + k * .045)], [x0 + w, y0 + h * (.68 + k * .045)]], { w: 1, alpha: .85 });
  D.chevrons(g, seamX - 300, seamX + 300, y0 + 60, { n: 12, h: 16, w: 1.1, rows: 2, gap: 9 });
  g.restore();
}
export function elevatorShot(g, t) {
  const open = D.eio(D.seg(t, TM.doors0, TM.doors1 - .12));
  const kPush = D.eio(D.seg(t, TM.split0, TM.ding)), kIn = D.ei(D.seg(t, TM.doors0 + .1, TM.doors1));
  let s = D.lerp(1, 1.13, kPush), fx = CX, fy = D.lerp(1040, 960, kPush);
  if (kIn > 0) { s = D.lerp(s, 3.0, kIn); fy = D.lerp(fy, 1420, kIn); }
  if (open > 0) invitationShot(g, t, D.lerp(.86, 1, kIn));
  g.save();
  g.translate(CX, 960); g.scale(s, s); g.translate(-fx, -fy);
  const gap = (DOOR.x1 - DOOR.x0) * open;
  if (open > 0) { g.beginPath(); g.rect(-4000, -4000, 9000, 9000); g.rect(CX - gap / 2, DOOR.y0, gap, DOOR.y1 - DOOR.y0 + 400); g.clip('evenodd'); }
  // wall
  const wg = g.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, '#0b0907'); wg.addColorStop(.5, '#17110a'); wg.addColorStop(1, '#070605');
  g.fillStyle = wg; g.fillRect(-600, -600, W + 1200, H + 1200);
  for (const x of [70, 1010]) D.rules(g, x, -200, x, H + 200, 3, 9, 1.4);
  D.fishScale(g, -40, 120, 180, 1900, 26, { stroke: 'rgba(201,162,75,.35)' }); D.fishScale(g, W - 140, 120, 180, 1900, 26, { stroke: 'rgba(201,162,75,.35)' });
  // stepped arch frame around dial + doors
  D.archFrame(g, CX, 1950, 900, 1640, { rings: 3, gap: 16, steps: 3, fill: '#0a0806', burst: true, part: 1, glow: .2 });
  // dial
  const v = needle(t), lit = D.seg(t, TM.ding - .05, TM.ding + .15) * (1 - .4 * D.seg(t, TM.ding + .3, TM.doors1));
  D.glow(g, CX, 860, 420, '#ffcf7a', .12 + .3 * lit);
  T.dial(g, CX, 900, 285, v, { labels: ['L', '5', '10', '15', '20', '25', '30'], ticks: 30, lit });
  // arrival lantern: seven bulbs that ignite on the ding
  for (let i = 0; i < 7; i++) {
    const x = CX + (i - 3) * 46, y = 985, ti = TM.ding + Math.abs(i - 3) * .045, on = D.seg(t, ti, ti + .08);
    const fl = on > 0 ? 1 + .6 * Math.exp(-(t - ti) / .09) : 0;
    if (on > 0) D.glow(g, x, y, 42 * fl, '#ffd98a', .55 * on);
    g.beginPath(); g.arc(x, y, 9, 0, D.TAU); g.fillStyle = on > 0 ? D.mix('#5a4420', '#fffaf0', Math.min(1, on * fl * .8)) : '#3a2c16'; g.fill();
    D.gline(g, D.arcPts(x, y, 11, 0, D.TAU, 16), { w: 1 });
  }
  D.gline(g, [[CX - 190, 1012], [CX + 190, 1012]], { w: 1.6 });
  // doors: frame + two bronze leaves sliding apart from the seam
  const lw = (DOOR.x1 - DOOR.x0) / 2 * (1 - open), dh = DOOR.y1 - DOOR.y0;
  g.fillStyle = '#050403'; g.fillRect(DOOR.x0 - 14, DOOR.y0 - 14, DOOR.x1 - DOOR.x0 + 28, dh + 28);
  if (lw > 1) { bronzeLeaf(g, DOOR.x0, lw, DOOR.y0, dh, CX - gap / 2); bronzeLeaf(g, DOOR.x1 - lw, lw, DOOR.y0, dh, CX + gap / 2); }
  D.gline(g, D.rectPts(DOOR.x0 - 10, DOOR.y0 - 10, DOOR.x1 - DOOR.x0 + 20, dh + 20), { w: 2.6 });
  D.gline(g, D.rectPts(DOOR.x0 - 20, DOOR.y0 - 20, DOOR.x1 - DOOR.x0 + 40, dh + 40), { w: 1.1 });
  if (open > 0 && open < 1) D.gline(g, [[CX - gap / 2, DOOR.y0], [CX - gap / 2, DOOR.y1]], { w: 2.4, glow: .8 }), D.gline(g, [[CX + gap / 2, DOOR.y0], [CX + gap / 2, DOOR.y1]], { w: 2.4, glow: .8 });
  if (open <= 0) D.gline(g, [[CX, DOOR.y0], [CX, DOOR.y1]], { w: 1, alpha: .7 });
  g.restore();
  // light spilling through the parting seam
  if (open > 0 && open < 1) { const p = (CX - fx) * s + CX; D.glow(g, p, 960 + (1450 - fy) * s, 700 * s * (1 - open * .5), '#ffe0a0', .35 * (1 - open)); }
  D.vignette(g, W, H, .5);
}

// =====================================================================================================
// SHOT 4 · the invitation: a gloved hand (bellboy's burgundy sleeve — the one colour) presents a sealed envelope;
// the seal cracks, the flap opens, the card rises out and becomes the poster: DAVETLİSİNİZ
// =====================================================================================================
const ENV = { w: 580, h: 740 }, CARD = { w: 520, h: 680 };
function cardFace(g, t) {   // card in local coords, centred, CARD.w x CARD.h
  const { w, h } = CARD, x0 = -w / 2, y0 = -h / 2;
  const bg = g.createLinearGradient(0, y0, 0, y0 + h); bg.addColorStop(0, '#15100a'); bg.addColorStop(.5, '#070605'); bg.addColorStop(1, '#130e08');
  g.fillStyle = bg; g.fillRect(x0, y0, w, h);
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  D.sunburst(g, 0, y0 + h * .58, { rays: 48, r0: 30, r1: 700, mode: 'wedges', colorA: 'rgba(201,162,75,.07)' });
  g.restore();
  const sheen = D.lerp(-.2, .62, D.eo(D.seg(t, TM.card1 - .3, TM.card1 + 1.4)));
  D.gline(g, D.rectPts(x0 + 12, y0 + 12, w - 24, h - 24), { w: 2.4, sheen, bb: [x0, y0, x0 + w, y0 + h] });
  D.gline(g, D.rectPts(x0 + 21, y0 + 21, w - 42, h - 42), { w: 1, bb: [x0, y0, x0 + w, y0 + h] });
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // stepped corners
    const cx = sx * (w / 2 - 21), cy = sy * (h / 2 - 21);
    D.gline(g, [[cx, cy - sy * 46], [cx - sx * 14, cy - sy * 46], [cx - sx * 14, cy - sy * 30], [cx - sx * 30, cy - sy * 30], [cx - sx * 30, cy - sy * 14], [cx - sx * 46, cy - sy * 14], [cx - sx * 46, cy]], { w: 1.4 });
  }
  D.fan(g, 0, y0 + 108, 52, { a0: Math.PI, a1: D.TAU, ribs: 9, fill: C.emerald, ring: .3 });
  T.goldText(g, IN.brand, 3, y0 + 152, { size: fit(g, IN.brand, 19, 430, 'Josefin', 7, 600), font: 'Josefin', weight: 600, track: 7, shadow: false, sheen: .6 });
  T.goldText(g, `${IN.title} ${IN.subtitle}`, 2, y0 + 196, { size: fit(g, `${IN.title} ${IN.subtitle}`, 30, 430, 'Limelight', 3), font: 'Limelight', track: 3, sheen });
  D.gline(g, [[-150, y0 + 216], [150, y0 + 216]], { w: 1.4 }); D.gline(g, [[-110, y0 + 223], [110, y0 + 223]], { w: .8 });
  const fs = Math.min(62, 62 * 430 / Math.max(1, T.measure(g, IN.headline, 62, 'Limelight', 3)));
  T.goldText(g, IN.headline, 2, y0 + 300, { size: fs, font: 'Limelight', track: 3, sheen: sheen + .1 });
  T.yearBadge(g, IN.year, 0, y0 + 418, 58, { p: 1, sheen: .45 });
  text(g, IN.date, 3, y0 + 548, { size: fit(g, IN.date, 24, 430, 'Josefin', 5, 600), track: 5, color: C.ivory });
  text(g, IN.details, 2, y0 + 584, { size: fit(g, IN.details, 19, 430, 'Josefin', 4, 600), track: 4, color: C.gold2 });
  D.chevrons(g, -110, 110, y0 + 612, { n: 8, h: 10, w: 1, rows: 2, gap: 7 });
  // marquee bulbs around the border light one by one, then chase
  const N = 44, per = 2 * (w - 60) + 2 * (h - 60);
  for (let i = 0; i < N; i++) {
    let d = (i / N) * per, x, y; const iw = w - 60, ih = h - 60;
    if (d < iw) { x = -iw / 2 + d; y = -ih / 2; } else if ((d -= iw) < ih) { x = iw / 2; y = -ih / 2 + d; } else if ((d -= ih) < iw) { x = iw / 2 - d; y = ih / 2; } else { d -= iw; x = -iw / 2; y = ih / 2 - d; }
    const ord = Math.min(i, N - i), ti = TM.bulbs0 + ord * .05, on = D.seg(t, ti, ti + .06);
    const chase = t > TM.bulbs0 + 1.4 ? .55 + .45 * Math.cos((i / N * 6 - (t - TM.bulbs0) * 3.2) * D.TAU / 6 * 6) : 1;
    const k = on * (t > ti ? 1 + .6 * Math.exp(-(t - ti) / .09) : 1) * chase;
    if (k > .05) D.glow(g, x, y, 16 * Math.min(1.6, k), '#ffd98a', .7 * Math.min(1, k));
    g.beginPath(); g.arc(x, y, 3.6, 0, D.TAU); g.fillStyle = k > .05 ? D.mix('#6a5028', '#fffaf0', Math.min(1, k * .85)) : '#3a2c16'; g.fill();
  }
}
function envBack(g) {
  const { w, h } = ENV;
  const gr = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gr.addColorStop(0, '#e9dcc0'); gr.addColorStop(1, '#bfae8c');
  g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
}
function envPocket(g) {
  const { w, h } = ENV, y0 = -h / 2, notch = y0 + h * .34;
  const p = D.toPath([[-w / 2, y0], [0, notch], [w / 2, y0], [w / 2, h / 2], [-w / 2, h / 2]], true);
  const gr = g.createLinearGradient(-w / 2, y0, w / 2, h / 2); gr.addColorStop(0, '#fbf4e4'); gr.addColorStop(.6, '#efe3c8'); gr.addColorStop(1, '#d8c7a4');
  g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 10; g.shadowOffsetY = -2; g.fillStyle = gr; g.fill(p); g.restore();
  g.strokeStyle = 'rgba(140,110,70,.45)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-w / 2, h / 2); g.lineTo(-w * .08, notch + h * .2); g.moveTo(w / 2, h / 2); g.lineTo(w * .08, notch + h * .2); g.stroke();
  D.gline(g, D.rectPts(-w / 2 + 18, notch + 40, w - 36, h / 2 - notch - 58), { w: 1.6, alpha: .9 });
  D.gline(g, D.rectPts(-w / 2 + 26, notch + 48, w - 52, h / 2 - notch - 74), { w: .8, alpha: .9 });
  T.goldText(g, IN.salutation, 0, h / 2 - 90, { size: fit(g, IN.salutation, 26, 470, 'Poiret', 6), font: 'Poiret', track: 6, shadow: false, fill: '#5a4222' });
  D.fan(g, w / 2 - 62, h / 2 - 40, 30, { a0: Math.PI, a1: D.TAU, ribs: 6, fill: C.emerald });
}
function envFlap(g, ang) {   // ang 0 closed … PI open (folds about the top edge)
  const { w, h } = ENV, y0 = -h / 2, c = Math.cos(ang), fh = h * .42 * c;
  const p = D.toPath([[-w / 2, y0], [w / 2, y0], [0, y0 + fh]], true);
  const gr = g.createLinearGradient(0, y0, 0, y0 + fh); gr.addColorStop(0, c > 0 ? '#f6ecd6' : '#cdbb95'); gr.addColorStop(1, c > 0 ? '#e2d2b0' : '#e8dabb');
  g.save(); if (c > 0) { g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 12; g.shadowOffsetY = 4; } g.fillStyle = gr; g.fill(p); g.restore();
  if (Math.abs(c) > .05) D.gline(g, [[-w / 2 + 30, y0 + 8 * Math.sign(c)], [0, y0 + fh - 26 * Math.sign(c)], [w / 2 - 30, y0 + 8 * Math.sign(c)]], { w: 1.4, alpha: .9 * Math.abs(c) });
  return [0, y0 + fh];
}
function seal(g, x, y, t) {
  const k = D.seg(t, TM.seal, TM.seal + .45);
  for (const sd of k > 0 ? [-1, 1] : [0]) {
    g.save(); g.translate(x + sd * 40 * D.eo(k), y + 60 * k * k); g.rotate(sd * .5 * k); g.globalAlpha *= 1 - D.ss(D.seg(k, .5, 1));
    if (sd) { g.beginPath(); g.rect(sd < 0 ? -80 : 0, -80, 80, 160); g.clip(); }
    const r = 54;
    g.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * D.TAU, rr = r * (1 + .06 * Math.sin(i * 2.7)); g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = (() => { const gr = g.createRadialGradient(-16, -18, 4, 0, 0, r * 1.1); gr.addColorStop(0, C.burgL); gr.addColorStop(.5, C.burg); gr.addColorStop(1, C.burgD); return gr; })(); g.fill();
    g.beginPath(); g.arc(0, 0, r * .74, 0, D.TAU); g.strokeStyle = 'rgba(60,8,18,.7)'; g.lineWidth = 3; g.stroke();
    T.goldText(g, IN.monogram, 0, 20, { size: IN.monogram.length > 1 ? 40 : 54, font: 'Limelight', shadow: false, sheen: .5 });
    g.restore();
  }
  if (k > 0 && k < .7) D.sparkle(g, x, y, 70 * Math.sin(k / .7 * Math.PI), { rot: k });
}
export function invitationShot(g, t, zoom = 1) {
  fill(g, '#070605');
  g.save(); g.translate(CX, 900); g.scale(zoom, zoom); g.translate(-CX, -900);
  D.sunburst(g, CX, 900, { rays: 64, r0: 0, r1: 2000, mode: 'wedges', colorA: 'rgba(201,162,75,.09)', rot: t * .015 });
  D.glow(g, CX, 900, 980, '#d9a441', .3);
  D.sunburst(g, CX, 900, { rays: 64, r0: 260, r1: 2000, mode: 'lines', w: 1.4, alpha: .28, rot: t * .015 });
  const R = D.mulberry(21); for (let i = 0; i < 26; i++) { const x = R() * W, y = R() * H, r = 30 + R() * 80; D.glow(g, x + Math.sin(t * .4 + i) * 12, y, r, R() < .5 ? '#ffc36a' : '#f6e8c4', .1 + R() * .1); }
  const em = g.createRadialGradient(CX, 900, 500, CX, 900, 1300); em.addColorStop(0, 'rgba(12,58,47,0)'); em.addColorStop(1, 'rgba(12,58,47,.55)'); g.fillStyle = em; g.fillRect(-200, -200, W + 400, H + 400);
  D.archFrame(g, CX, 1980, 980, 1720, { rings: 2, gap: 18, steps: 3, burst: false, lw: 1.6 });
  g.restore();
  // poses
  const rise = D.back(D.seg(t, TM.rise0, TM.rise1), 1.15), drop = D.ei(D.seg(t, TM.card0, TM.card1));
  const ex = CX, ey = D.lerp(2500, 930, rise) + drop * 2700, er = D.lerp(-.16, -.035, rise) + Math.sin(t * 1.3) * .006;
  const slide = D.eio(D.seg(t, TM.slide0, TM.slide1)), cardK = D.eio(D.seg(t, TM.card0 - .05, TM.card1));
  const flapA = D.eio(D.seg(t, TM.flap0, TM.flap1)) * Math.PI;
  // card pose: inside envelope → centre of frame, bigger, upright; then a slow push
  const inX = ex + Math.sin(er) * (slide * 560), inY = ey - Math.cos(er) * (20 + slide * 560);
  const push = 1 + .035 * D.seg(t, TM.card1, DUR);
  const cxp = D.lerp(inX, CX, cardK), cyp = D.lerp(inY, 905, cardK), csc = D.lerp(1, 1.52, cardK) * push, crt = D.lerp(er, 0, cardK);
  const drawCard = () => { g.save(); g.translate(cxp, cyp); g.rotate(crt); g.scale(csc, csc);
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40; g.fillStyle = '#000'; g.fillRect(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h); g.shadowBlur = 0;
    cardFace(g, t); g.restore(); };
  if (cardK > 0) D.glow(g, CX, 905, 900 * cardK, '#ffd98a', .22 * cardK);
  if (ey < H + 1000) {
    // the bellboy's hand holds the envelope's lower edge: sleeve + glove behind the envelope, thumb in front (drawn after)
    const hx = ex + Math.sin(er) * -(ENV.h / 2) + 40, hy = ey + Math.cos(er) * (ENV.h / 2) + 52, ha = -.12 + er;
    g.save(); g.translate(hx, hy); g.rotate(ha);
    const sv = D.toPath([[-70, 70], [70, 70], [84, 1100], [-84, 1100]], true);
    D.airbrush(g, sv, { base: C.burg, light: C.burgL, dark: C.burgD, dir: -2.6, rim: 2.5, bbox: [-84, 70, 84, 700] });
    g.fillStyle = D.goldGrad(g, -72, 96, 72, 116, { sheen: .5 }); g.fillRect(-72, 98, 144, 16);
    for (const by of [160, 230]) { g.beginPath(); g.arc(-40, by, 9, 0, D.TAU); g.fillStyle = D.goldFlat(g, -40, by, 9); g.fill(); }
    g.restore();
    CH.gloveHand(g, hx, hy, 15, ha, 1, { sleeve: false });
    g.save(); g.translate(ex, ey); g.rotate(er);
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 50; g.fillStyle = '#000'; g.fillRect(-ENV.w / 2, -ENV.h / 2, ENV.w, ENV.h); g.shadowBlur = 0;
    if (flapA > Math.PI / 2) envFlap(g, flapA);
    envBack(g);
    g.restore();
    if (slide > 0 && cardK <= 0) drawCard();
    g.save(); g.translate(ex, ey); g.rotate(er);
    envPocket(g);
    let tip = null; if (flapA <= Math.PI / 2) tip = envFlap(g, flapA);
    if (t < TM.seal + .5) seal(g, 0, tip ? tip[1] : -ENV.h / 2 + ENV.h * .42, t);
    g.restore();
    // thumb pressing on the front of the envelope
    g.save(); g.translate(hx, hy); g.rotate(ha);
    const th = new Path2D(); th.ellipse(-50, -40, 16, 46, .05, 0, D.TAU);
    D.airbrush(g, th, { base: '#f4ecdc', light: '#ffffff', dark: '#a8977a', dir: -2.3, rim: 1.2, bbox: [-66, -86, -34, 6] });
    g.strokeStyle = 'rgba(120,100,70,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-60, -66); g.lineTo(-42, -62); g.stroke();
    g.restore();
  }
  if (cardK > 0) drawCard();
  D.vignette(g, W, H, .45);
}

// =====================================================================================================
// assembly + in-medium transitions
// =====================================================================================================
let off = null;
const offCtx = () => { if (!off) { off = document.createElement('canvas'); off.width = W; off.height = H; } const h = off.getContext('2d'); h.setTransform(1, 0, 0, 1, 0, 0); h.globalAlpha = 1; return h; };
function splitOpen(g, img, p) {   // the outgoing frame becomes two door leaves hinged at the outer edges, swinging open from the seam
  const e = D.eio(D.seg(p, .1, 1)), seamGlow = 1 - D.seg(p, 0, .35), hw = W / 2;
  for (const sd of [-1, 1]) {
    const w = hw * (1 - e); if (w < 1) continue;
    g.save(); g.beginPath(); g.rect(sd < 0 ? 0 : W - w, 0, w, H); g.clip();
    g.translate(sd < 0 ? 0 : W, 0); g.scale(1 - e, 1);
    g.drawImage(img, sd < 0 ? 0 : hw, 0, hw, H, sd < 0 ? 0 : -hw, 0, hw, H);
    g.restore();
    const ex = sd < 0 ? w : W - w;
    const sh = g.createLinearGradient(sd < 0 ? 0 : W, 0, ex, 0); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, `rgba(0,0,0,${.55 * e})`);
    g.fillStyle = sh; g.fillRect(sd < 0 ? 0 : ex, 0, w, H);
    D.gline(g, [[ex, 0], [ex, H]], { w: 3, glow: .8 });
  }
  if (seamGlow > 0) { D.glow(g, CX, 960, 800, '#ffd8a0', .45 * seamGlow, 2.4); D.gline(g, [[CX, 0], [CX, H]], { w: 3, glow: 1, alpha: seamGlow }); }
}
export function renderFilm(g, t) {
  if (t < TM.title) return towerShot(g, t);
  if (t < TM.split0) return titleShot(g, t);
  if (t < TM.split1) {
    elevatorShot(g, t);
    const h = offCtx(); titleShot(h, TM.split0);
    return splitOpen(g, off, (t - TM.split0) / (TM.split1 - TM.split0));
  }
  if (t < TM.doors1) return elevatorShot(g, t);
  return invitationShot(g, t);
}
