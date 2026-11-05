// SON TESLİM: 23:59 — an 80s cel-anime opening (1080x1920). Page contract: window.render(t), window.DUR, window.READY.
// Built on lemo-opuscar's cel-anime-80s engine (MIT, LemoLab): cel.js + post.js (videotape/CRT pass) used as-is, head adapted in dev80.js.
import { canvas } from './demo/cel.js';
import { makePost } from './demo/post.js';
import { W, H, cpuCanvas } from './kit.js';
import { farPlate, nearPlate } from './plates.js';
import * as S from './shots.js';

// timeline, locked to the score (≈129 BPM, beat 0.4655 s): cuts on beats, title on the big hit, GÖNDER on the final hit
export const VO_AT = 2.17;   // the voice clip starts here in the edit
export const SHOTS = [
  [0, 2.57, 'sky'], [2.57, 3.97, 'desk'], [3.97, 4.91, 'clock'], [4.91, 6.32, 'bust'],
  [6.32, 9.60, 'eyes'], [9.60, 12.89, 'title'], [12.89, 14.76, 'key'], [14.76, 16.0, 'burst'],
];
const DUR = 16.0;
const qs = new URLSearchParams(location.search);
await Promise.all(['italic 900 120px Kanit', '800 60px Kanit', '900 60px Kanit', '60px "Dela Gothic One"', '600 40px "Barlow SC"', '700 40px "Barlow SC"']
  .map(f => document.fonts.load(f, 'SONTESLİMGÖNDERÜBÜFEKAFEOTEL24SAATDESTANIdeadlineデッドラインネオンカラオケ' + Object.values(window.PACK_INPUTS || {}).join(''))));
await window.packFonts?.();
const [sc, g] = cpuCanvas(W, H), [gc, e] = cpuCanvas(W, H);
const post = makePost(document.getElementById('gl'));
const A = { far: farPlate(), near: nearPlate() };
const RAW = { bloom: 0, halo: 0, soft: 0, flick: 0, lift: 0, contrast: 0, fade: 0, sat: 1, tint: [1, 1, 1], scan: 0, grille: 0, bleed: 1, rshift: 0, glow: 0, corner: 0, noiseA: 0, power: 1, track: 0, expo: 1 };

function render(t) {
  for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; }
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const sh = SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const fn = S[qs.get('shot') || sh[2]];
  const over = fn({ t, lt: t - sh[0], u: (t - sh[0]) / (sh[1] - sh[0]), dur: sh[1] - sh[0], g, e, A }) || {};
  // tape accents: power-on at the head; a few frames of tracking noise on the cut into the title
  const track = t >= 9.6 - .05 && t < 9.6 + .1 ? .8 : 0;
  post.render(sc, gc, Math.round(t * 30), null, qs.get('raw') ? RAW : { power: Math.min(1, t / .45), track, ...over });
}
window.render = render; window.DUR = DUR;
render(parseFloat(qs.get('t') ?? '1'));
window.READY = true;
