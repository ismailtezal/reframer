// film.js — portrait 1930s print for a 1080×1920 frame: rounded film gate, gate weave, flicker, scratches, dust, hairs, vignette.
// Adapted from LemoLab's lemo-opuscar rubber-hose demo (styles/rubber-hose/demo/film.js, MIT): gate moved to a portrait
// window with black bands above (labels) and below (platform UI), faint sepia print, damage timed per 30 fps frame.
import { hash, vnoise } from './core/lib.js';
export const FW = 1080, FH = 1920;
export const GATE = { x: 30, y: 336, w: 1020, h: 1260, r: 30 };
export const CX = GATE.x + GATE.w / 2, CY = GATE.y + GATE.h / 2;   // 540, 966: the camera's frame centre

// film grain: 4 seeded noise tiles, one per frame at a random offset, laid over in "overlay" (page-drawn, as the bundled ffmpeg has no noise filter)
const GRAIN = [];
function grainTiles() {
  for (let k = 0; k < 4; k++) {
    const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), im = x.createImageData(256, 256);
    let s = 1234567 + k * 7919; const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
    for (let i = 0; i < 256 * 256; i++) { const v = 128 + (rnd() + rnd() + rnd() - 1.5) * 120; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); GRAIN.push(c);
  }
}
export function makeFilm(main) {
  if (!GRAIN.length) grainTiles();
  const g = main.getContext('2d');
  const scene = document.createElement('canvas'); scene.width = FW; scene.height = FH;
  return { g, scene, sg: scene.getContext('2d') };
}

export function post(F, t, o = {}) {
  const g = F.g, f = Math.floor(t * 30 + 1e-6), fq = Math.floor(t * 15 + 1e-6);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.fillStyle = '#000'; g.fillRect(0, 0, FW, FH);
  // gate weave: slow drift + a rare small jump, plus the jump on every cut
  const wx = (vnoise(t * 1.3) - .5) * 2.4 + (hash(fq * 7.1) > .985 ? (hash(fq) - .5) * 5 : 0);
  const wy = (vnoise(t * 1.1 + 40) - .5) * 2.6 + (hash(fq * 3.3) > .985 ? (hash(fq + 9) - .5) * 6 : 0) + (o.jump || 0);
  const { x, y, w, h, r } = GATE;
  g.save();
  g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
  g.filter = 'blur(0.5px) contrast(1.15) sepia(0.24)';
  g.drawImage(F.scene, wx, wy);
  g.filter = 'none';
  if (!o.clean) {
    // brightness flicker
    const fl = (hash(f * 1.618) - .5) * .08 + (vnoise(t * 3) - .5) * .04;
    g.fillStyle = fl > 0 ? `rgba(255,248,232,${fl})` : `rgba(0,0,0,${-fl})`; g.fillRect(x, y, w, h);
    // vertical scratches drifting over a few frames
    const sgm = Math.floor(t * 2.3);
    for (let i = 0; i < 3; i++) {
      if (hash(sgm * 13.7 + i * 3.1) < .45) continue;
      const sx = x + hash(sgm * 5.3 + i) * w + Math.sin(t * 7 + i) * 6, light = hash(sgm + i * 9) > .4;
      g.strokeStyle = light ? 'rgba(246,238,220,.5)' : 'rgba(16,13,9,.45)'; g.lineWidth = .8 + hash(sgm * 2 + i) * 1.4;
      g.beginPath(); const y0 = y + hash(sgm * 3 + i) * h * .5; g.moveTo(sx, y0); g.lineTo(sx + (hash(f + i) - .5) * 3, y0 + h * (.4 + hash(sgm + i * 5) * .6)); g.stroke();
    }
    // dust specks, new every frame
    const nd = 3 + Math.floor(hash(f * 2.7) * 6);
    for (let i = 0; i < nd; i++) {
      const dx = x + hash(f * 11.1 + i * 1.7) * w, dy = y + hash(f * 17.3 + i * 2.9) * h, rr = .8 + hash(f + i * 4.4) * 2.8, dark = hash(f * 1.3 + i) > .35;
      g.fillStyle = dark ? 'rgba(16,13,10,.75)' : 'rgba(250,244,230,.7)';
      g.beginPath(); g.ellipse(dx, dy, rr * (1 + hash(i + f) * 1.5), rr, hash(i * 3 + f) * 3, 0, 7); g.fill();
    }
    // an occasional hair
    if (hash(Math.floor(t * 1.5) * 9.9) > .8) {
      const s0 = Math.floor(t * 1.5), hx = x + hash(s0 * 2.2) * w, hy = y + hash(s0 * 4.4) * h;
      g.strokeStyle = 'rgba(18,15,11,.6)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(hx, hy);
      for (let i = 1; i <= 8; i++) g.lineTo(hx + i * 7 + Math.sin(i * 1.3 + s0) * 8, hy + Math.sin(i * .9 + s0 * 2) * 10 + i * 3);
      g.stroke();
    }
  }
  // grain, a new tile and offset every frame
  if (!o.clean) {
    const tile = GRAIN[f % 4], pat = g.createPattern(tile, "repeat"), ox = Math.floor(hash(f * 3.7) * 256), oy = Math.floor(hash(f * 5.1) * 256);
    pat.setTransform(new DOMMatrix([1.6, 0, 0, 1.6, ox, oy]));
    g.globalCompositeOperation = "overlay"; g.globalAlpha = .2; g.fillStyle = pat; g.fillRect(x, y, w, h);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  }
  // vignette (strong, into the rounded corners)
  const vg = g.createRadialGradient(CX, CY, h * .3, CX, CY, h * .66);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(.62, 'rgba(0,0,0,.16)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
  g.fillStyle = vg; g.fillRect(x, y, w, h);
  // soft inner shadow on the gate edge
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 14; g.filter = 'blur(6px)'; g.beginPath(); g.roundRect(x, y, w, h, r); g.stroke(); g.filter = 'none';
  g.restore();
}
