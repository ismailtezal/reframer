// main.js — "Pazartesi Sabahı": a 1930s rubber-hose gag, 1080×1920, page contract (render(t), DUR, READY).
// Engine pieces (toon.js, chars.js, cast.js, ui.js, bg.js) come from LemoLab's lemo-opuscar rubber-hose demo (MIT).
import * as T from './demo/toon.js';
import { P, ribbon } from './demo/chars.js';
import * as C from './demo/cast.js';
import { fatTitle } from './demo/ui.js';
import { clamp, lerp, seg, ss, eio, eo, ei, TAU, hash } from './core/lib.js';
import { makeFilm, post, CX, CY, FW, FH, GATE } from './film.js';
import * as R from './room.js';
import { head, torso, armPath, hand, capInHand } from './hero.js';
import { alarmClock } from './clock.js';
import { IN } from './inputs.js';

const Q = new URLSearchParams(location.search);
const cv = document.getElementById('c'); cv.width = FW; cv.height = FH;
const F = makeFilm(cv); T.init(F.scene);
await document.fonts.ready;
for (const f of ['80px Shrikhand', '40px Limelight', '700 40px OldStd', '21px Limelight']) await document.fonts.load(f);
await window.packFonts?.();
const BG = R.paintRoom(); T.init(F.scene);
const sg = F.sg;

// ——— one timeline: the music's beat grid (measured from out/music.mp3 after the bar insert: 155 BPM) ———
const BEAT = 0.387, PH = 0.385;              // beat k sits at PH + k·BEAT; downbeats at k = 3, 7, 11, …
const B = k => PH + BEAT * k;
export const DUR = 16.0;
const q = t => Math.floor(t * 15 + 1e-6) / 15;   // characters on twos (15 drawings/s at 30 fps)
const beats = t => (t - PH) / BEAT;
const breath = t => Math.cos(beats(q(t)) * TAU);  // stretch on the beat, squash on the off-beat
const K = {
  roll: [B(6), B(7)], room: B(7),             // title card rolls up like a window shade, 2.71 → 3.09
  p3: 6.62,                                    // VO "Ama çalar saatin…" starts (clip at 6.50)
  push1: [B(15), B(22)],                       // slow push-in during the line
  crouch: B(21), ring: B(23),                  // clock winds up (8.51), holds, RINGS on the downbeat (9.29)
  wide2: B(25), reach1: B(26), smack1: B(27),  // eye opens 10.06 · arm shoots out 10.45 · SMACK 10.83
  hop1: [B(26.75), B(28)],                     // clock dodges up to the shelf
  wind2: B(28.5), reach2: B(29), smack2: B(30),// arm stretches up the wall · SMACK on the shelf 12.00
  hop2: [B(29.75), B(31)],                     // clock dodges onto the headboard, rings in his ear 12.38
  droop: [B(30.4), B(31.6)],
  sit: [B(32), B(33)], capOff: [B(33), B(34)], sigh: B(34.2),
  push2: [B(32), B(37)],
  iris: [B(35), B(37)], son: B(37),            // iris 13.93 → 14.70 (the band's button), SON card
};
const SHOTS = [[0, K.room, 'title'], [K.room, K.ring, 'wide'], [K.ring, K.wide2, 'cu'], [K.wide2, K.son, 'wide2'], [K.son, 99, 'son']];
const shotAt = t => SHOTS.find(s => t >= s[0] && t < s[1]);
const CUTS = [K.ring, K.wide2, K.son];

const pulse = (t, t0, k = 6) => t < t0 ? 0 : Math.exp(-(t - t0) * k);

// ——— camera ———
const CAM_A = { x: 612, y: 1012, z: 1.32 }, CAM_B = { x: 642, y: 944, z: 1.22 };
function camAt(t) {
  if (t < K.ring) { const u = eio(seg(t, K.push1[0], K.push1[1])); return { x: lerp(CAM_A.x, 728, u), y: lerp(CAM_A.y, 1022, u), z: lerp(CAM_A.z, 1.55, u) }; }
  if (t < K.wide2) return { x: 905, y: 975, z: 2.15 + .1 * seg(t, K.ring, K.wide2) };
  const u = eio(seg(t, K.push2[0], K.push2[1]));
  return { x: lerp(CAM_B.x, 604, u), y: lerp(CAM_B.y, 962, u), z: lerp(CAM_B.z, 1.56, u) };
}
function setCam(t, cam) { R.drawBG(sg, BG, cam); T.BASE.splice(0, 6, ...R.camBase(cam)); T.frame(t); T.S.boil = Math.floor(t * 10 + 1e-6) % 3; }
const toScreen = (cam, x, y) => [CX + (x - cam.x) * cam.z, CY + (y - cam.y) * cam.z];

// ——— the clock: where it is and what it does ———
const SPOT = { stand: [912, R.STAND.top + 2], shelf: [952, R.SHELF.y], head: [668, 790] };
const hopArc = (u, a, b, h) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - 4 * h * u * (1 - u)];
function clockState(tq) {
  const bt = beats(tq), ph = bt - Math.floor(bt), air = Math.sin(Math.PI * ph), land = Math.exp(-ph * 9);
  const s = { x: SPOT.stand[0], y: SPOT.stand[1], k: .86, sx: 1, sy: 1, lean: 0, ring: 0, eyes: { lx: -.7, ly: .25 }, mouth: 'smile', brows: null, t: tq };
  const bounce = (amp = 18) => { s.y -= air * amp; s.sy = 1 - land * .12 + air * .05; s.sx = 1 + land * .09 - air * .03; };
  if (tq < K.ring) {
    bounce();
    if (tq > K.p3) { s.eyes = { lx: .15, ly: 0 }; s.mouth = 'grin'; s.brows = 'angry'; }
    if (tq >= K.crouch) { const u = ss(seg(tq, K.crouch, K.crouch + .25)); s.y = SPOT.stand[1]; s.sy = lerp(s.sy, .76, u); s.sx = lerp(s.sx, 1.18, u); s.eyes = { lx: -.5, ly: .4 }; s.mouth = 'grin'; }
  } else if (tq < K.hop1[0]) {
    s.ring = 1; s.mouth = 'beam'; s.eyes = { type: 'wide', lx: tq > K.reach1 ? -.9 : 0 }; s.sy = 1 + pulse(tq, K.ring, 5) * .25; s.sx = 1 - pulse(tq, K.ring, 5) * .12;
  } else if (tq < K.hop1[1]) {
    const u = seg(tq, K.hop1[0], K.hop1[1]); [s.x, s.y] = hopArc(u, SPOT.stand, SPOT.shelf, 150);
    s.sy = 1.15 - u * .15; s.sx = .9 + u * .1; s.lean = Math.sin(u * Math.PI) * .25; s.mouth = 'o'; s.eyes = { type: 'wide', lx: -.6, ly: .6 };
  } else if (tq < K.hop2[0]) {
    [s.x, s.y] = SPOT.shelf; const l = pulse(tq, K.hop1[1], 8); s.sy = 1 - l * .22; s.sx = 1 + l * .14;
    s.ring = tq > K.hop1[1] + .12 ? 1 : 0; s.mouth = 'bleh'; s.eyes = { lx: -.7, ly: .8 };
  } else if (tq < K.hop2[1]) {
    const u = seg(tq, K.hop2[0], K.hop2[1]); [s.x, s.y] = hopArc(u, SPOT.shelf, SPOT.head, 90);
    s.sy = 1.12 - u * .12; s.sx = .92 + u * .08; s.lean = -Math.sin(u * Math.PI) * .35; s.mouth = 'o'; s.eyes = { type: 'wide', lx: -.5, ly: .7 };
  } else {
    [s.x, s.y] = SPOT.head; const l = pulse(tq, K.hop2[1], 8); s.sy = 1 - l * .22; s.sx = 1 + l * .14;
    if (tq < K.capOff[1]) { s.ring = 1; s.mouth = 'beam'; s.eyes = { type: 'wide', lx: -.4, ly: .8 }; }
    else { bounce(14); s.ring = .45; s.mouth = 'beam'; s.eyes = { type: 'happy' }; }
  }
  return s;
}

// ——— the hero ———
const fold0 = 1168, fold1 = 1238;
function heroPose(tq) {
  const sit = eio(seg(tq, K.sit[0], K.sit[1])), bt = beats(tq);
  const sigh = Math.sin(Math.PI * seg(tq, K.sigh, K.sigh + .7)) * 10;
  const h = { x: 540, y: lerp(1078, 992, sit) + breath(tq) * 3 + sigh, tq, sit, fold: lerp(fold0, fold1, sit), cap: 'on', flop: Math.sin(bt * Math.PI) * .6, bob: breath(tq) * 6, tilt: .05 * Math.sin(bt * Math.PI / 2) };
  if (tq < K.wide2) {   // fast asleep, snoring every two beats
    h.eyeL = h.eyeR = { type: 'shut' };
    const sn = Math.max(0, Math.sin(Math.PI * bt / 2));
    h.mouth = { type: 'o', open: .3 + .45 * sn, w: 46 };
  } else if (tq < K.smack1) {
    h.eyeL = { lid: .42, lx: .85, ly: .1 }; h.eyeR = { type: 'shut' }; h.browsL = 'angry'; h.mouth = { type: 'frown', w: 44 }; h.tilt = 0;
    h.shake = 2 * pulse(tq, K.wide2, 4);
  } else if (tq < K.hop2[1]) {
    const up = tq > K.smack1 + .1 ? -.85 : 0;
    h.eyeL = { lid: .3, lx: .55, ly: up }; h.eyeR = { lid: .3, lx: .55, ly: up }; h.brows = 'angry'; h.mouth = { type: tq > K.reach2 ? 'grin' : 'flat', w: 44 }; h.tilt = 0;
  } else if (tq < K.sit[0]) {
    h.eyeL = h.eyeR = { type: 'wide', lx: .3, ly: -.9 }; h.brows = 'up'; h.mouth = { type: 'wavy', w: 48 }; h.shake = 7 * pulse(tq, K.hop2[1], 3); h.tilt = 0; h.flop = 2.2 * pulse(tq, K.hop2[1], 4);
  } else {
    const glum = tq > K.capOff[1];
    h.eyeL = h.eyeR = { lid: glum ? .55 : .45, lx: glum ? -.1 : .2, ly: glum ? .5 : -.3 }; h.brows = 'sad'; h.mouth = { type: 'frown', w: 42 }; h.tilt = glum ? -.06 : 0;
    if (tq >= K.capOff[0] + .2) { h.cap = 'off'; h.hair = eo(seg(tq, K.capOff[0] + .2, K.capOff[0] + .6)); }
  }
  return h;
}
// right-arm key poses (6 control points each, the first = shoulder; filled per frame)
const ARM = {
  rest: [[612, 1170], [614, 1170], [616, 1170], [618, 1170], [620, 1170], [622, 1170]],
  wind: [[612, 1170], [612, 1175], [600, 1180], [590, 1183], [584, 1184], [580, 1185]],
  reach1: [[612, 1170], [680, 1120], [760, 1080], [830, 1060], [870, 1052], [904, 1050]],
  lift1: [[612, 1170], [690, 1110], [770, 1050], [840, 1010], [880, 990], [912, 984]],
  wind2: [[612, 1170], [680, 1150], [730, 1110], [740, 1060], [730, 1030], [716, 1022]],
  reach2: [[612, 1170], [720, 1140], [790, 1010], [820, 860], [880, 720], [942, 638]],
  droop: [[612, 1170], [700, 1160], [770, 1170], [800, 1220], [810, 1280], [812, 1330]],
  sit: [[606, 1100], [640, 1150], [650, 1190], [640, 1214], [622, 1222], [604, 1226]],
  cap: [[606, 1100], [676, 1060], [700, 990], [690, 940], [660, 912], [626, 904]],
  hold: [[606, 1100], [662, 1130], [676, 1156], [662, 1166], [640, 1162], [618, 1150]],
};
const mix = (A, Bp, u) => A.map((p, i) => [lerp(p[0], Bp[i][0], u), lerp(p[1], Bp[i][1], u)]);
function rightArm(tq, h) {
  let pts, type = 'open', k = 1.15, flip = true, rot = null;
  if (tq < K.wide2) { pts = ARM.rest; rot = Math.PI - .25; }
  else if (tq < K.reach1) { pts = mix(ARM.rest, ARM.wind, ss(seg(tq, K.wide2 + .1, K.reach1))); rot = Math.PI - .25; }
  else if (tq < K.smack1) { pts = mix(ARM.wind, ARM.reach1, eo(seg(tq, K.reach1, K.smack1 - .03))); }
  else if (tq < K.smack1 + .2) { pts = ARM.reach1; k = 1.15 + pulse(tq, K.smack1, 9) * .35; rot = .12; }
  else if (tq < K.wind2) { pts = mix(ARM.reach1, ARM.lift1, ss(seg(tq, K.smack1 + .2, K.hop1[1]))); rot = -.2; }
  else if (tq < K.reach2) { pts = mix(ARM.lift1, ARM.wind2, ss(seg(tq, K.wind2, K.reach2))); }
  else if (tq < K.smack2) { pts = mix(ARM.wind2, ARM.reach2, eo(seg(tq, K.reach2, K.smack2 - .03))); }
  else if (tq < K.droop[0]) { pts = ARM.reach2; k = 1.15 + pulse(tq, K.smack2, 9) * .35; rot = -.35; }
  else if (tq < K.sit[0]) { pts = mix(ARM.reach2, ARM.droop, ei(seg(tq, K.droop[0], K.droop[1]))); type = 'open'; }
  else if (tq < K.capOff[0]) { pts = mix(ARM.droop, ARM.sit, ss(seg(tq, K.sit[0], K.sit[1]))); }
  else if (tq < K.capOff[0] + .2) { pts = mix(ARM.sit, ARM.cap, eo(seg(tq, K.capOff[0], K.capOff[0] + .2))); type = 'grab'; }
  else { pts = mix(ARM.cap, ARM.hold, ss(seg(tq, K.capOff[0] + .2, K.capOff[1]))); type = 'grab'; }
  // shoulder follows the body as he sits up
  pts = pts.map((p, i) => i === 0 ? [606 + 6 * (1 - h.sit), lerp(1170, 1100, h.sit)] : p);
  return { pts, type, k, flip, rot };
}

// ——— little drawings ———
function zee(x, y, s) {   // outlined "Z" of a snore
  const g = T.g, pts = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(p => T.tx(x + p[0] * s, y + p[1] * s * 1.05)), zk = T.zoom();
  g.setTransform(1, 0, 0, 1, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.strokeStyle = P.ink; g.lineWidth = s * .62 * zk + 7; g.stroke(); g.strokeStyle = P.white; g.lineWidth = s * .62 * zk; g.stroke();
}
function star(x, y, r, rot = 0) { const pts = []; for (let i = 0; i < 8; i++) { const a = rot + i / 8 * TAU, rr_ = i % 2 ? r * .4 : r; pts.push([x + Math.cos(a) * rr_, y + Math.sin(a) * rr_]); } T.shape(pts, { fill: P.white, lw: T.S.lw * .6 }); }
function impact(x, y, t0, tq) {
  const u = seg(tq, t0, t0 + .45); if (u <= 0 || u >= 1) return;
  for (let i = 0; i < 6; i++) { const a = -Math.PI * (.1 + i * .16), r0 = 40 + u * 30, r1 = 70 + u * 50; T.stroke([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], T.S.lw * .9); }
  star(x - 50, y - 60 - u * 30, 18 * (1 - u * .5), u * 3); star(x + 40, y - 74 - u * 40, 14 * (1 - u * .5), -u * 3);
}

// ——— the bedroom shot ———
function room(t, cam) {
  const tq = q(t), b = breath(tq), bt = beats(tq);
  setCam(t, cam);
  C.windowCurtain(200, 806, 1, b);
  R.calendar(540, 444, -b);
  R.shelf(b, pulse(tq, K.smack2, 7) * Math.min(1, seg(tq, K.smack2 - .01, K.smack2 + .02) * 50));
  R.nightstand(-b, pulse(tq, K.smack1, 10));
  R.headboard(b);
  R.pillow(-b);
  const h = heroPose(tq), cs = clockState(tq);
  if (h.sit > .02) torso(h.x, h.y + 60, b);
  head(h);
  // snore Z's (two beats each, drifting up-left)
  if (tq < K.wide2 && tq > K.room - .5) for (let n = Math.floor(bt / 2) - 2; n <= Math.floor(bt / 2); n++) {
    const tb = B(n * 2), u = (tq - tb) / (BEAT * 3.2); if (u < 0 || u > 1) continue;
    zee(lerp(470, 352, u) + Math.sin(u * 7 + n) * 16, lerp(968, 730, u), lerp(16, 36, u));
  }
  R.blanket(b, h.fold);
  const A = rightArm(tq, h);
  const behindFold = h.sit < .5;
  let cArm = null;
  if (behindFold) { cArm = armPath(A.pts); }
  R.sheetFold(h.fold);
  if (!behindFold) cArm = armPath(A.pts);
  // left glove: folded on the blanket while asleep, limp on the lap when sitting
  if (h.sit < .5) { T.push(); const lc = [[470, 1172], [474, 1172], [478, 1172]]; hand(lc, 'open', 1.1, false, -.15 + b * .03); T.pop(); }
  else { const lp = armPath([[474, 1100], [440, 1150], [432, 1196], [446, 1222], [462, 1230]]); hand(lp, 'open', 1.1, false, .3); }
  const hd = hand(cArm, A.type, A.k, A.flip, A.rot);
  if (h.cap === 'off') capInHand(hd.x + 4, hd.y + 6, Math.sin(bt * Math.PI) * .5);
  R.toes(b, tq > K.sit[0] ? 0 : Math.sin(bt * Math.PI) * .6);
  // impacts
  impact(904, 1040, K.smack1, tq); impact(940, 630, K.smack2, tq);
  alarmClock(cs.x, cs.y, cs.k, cs);
  R.footboard(b);
}

// ——— title card (rolls up like a window shade) ———
function titleCard(t) {
  const u = eio(seg(t, K.roll[0], K.roll[1])); if (u >= 1) return;
  const g = sg, lift = u * 1320, bq = beats(q(t));
  g.save(); g.setTransform(1, 0, 0, 1, 0, -lift);
  g.beginPath(); g.rect(0, GATE.y - 20, FW, GATE.h + 40); g.clip();
  g.save(); g.translate(CX, CY); g.rotate(t * .22);
  for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#8A877F' : '#C4C1B8'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1500, i / 24 * TAU, (i + 1) / 24 * TAU); g.fill(); }
  g.restore();
  const bb = Math.cos(bq * TAU), pop0 = 1 + .12 * Math.exp(-t * 9) * Math.cos(t * 40);
  g.save(); g.translate(CX, CY); g.scale((1 - bb * .01) * pop0, (1 + bb * .014) * pop0); g.translate(-CX, -CY);
  g.fillStyle = '#F4F1EA'; g.strokeStyle = P.ink; g.lineWidth = 10; g.beginPath(); g.roundRect(96, 640, 888, 640, 64); g.fill(); g.stroke();
  g.lineWidth = 3.5; g.beginPath(); g.roundRect(122, 666, 836, 588, 46); g.stroke();
  const hopL = i => -(Math.max(0, Math.cos((bq - i * .12) * Math.PI)) ** 6) * 30;
  fatTitle(g, IN.title1, CX, 812, Math.round(134 * Math.min(1, 9 / Math.max(9, IN.title1.length))), { bounce: hopL });
  fatTitle(g, IN.title2, CX, 990, Math.round(150 * Math.min(1, 8 / Math.max(8, IN.title2.length))), { bounce: i => hopL(i + 9) });
  g.fillStyle = P.ink; g.font = '38px Limelight'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText(IN.tagline, CX, 1170);
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(CX + s * 300, 1196); g.lineTo(CX + s * 120, 1196); g.lineWidth = 3; g.stroke(); }
  g.restore(); g.restore();
  if (u > 0) { const y = GATE.y + GATE.h - lift; g.save(); g.fillStyle = '#4A4844'; g.strokeStyle = P.ink; g.lineWidth = 6; g.beginPath(); g.roundRect(14, y - 16, FW - 28, 60, 30); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,250,.35)'; g.fillRect(36, y - 3, FW - 72, 8); g.restore(); }
}

// ——— iris out ———
function iris(t, cam) {
  if (t < K.iris[0]) return;
  const [cx, cy] = toScreen(cam, 600, 862);
  let r;
  if (t < K.iris[0] + .5) r = lerp(1150, 410, eio(seg(t, K.iris[0], K.iris[0] + .5)));
  else r = 410 * (1 - ei(seg(t, K.iris[1] - .28, K.iris[1])));
  sg.save(); sg.setTransform(1, 0, 0, 1, 0, 0); sg.fillStyle = '#050505'; sg.beginPath(); sg.rect(0, 0, FW, FH); sg.arc(cx, cy, Math.max(0, r), 0, TAU, true); sg.fill('evenodd'); sg.restore();
}

// ——— SON card ———
function sonCard(t) {
  const g = sg, bq = beats(q(t)), u = t - K.son;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, FW, FH);
  g.translate(CX, CY); g.rotate(-t * .2);
  for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#8A877F' : '#C4C1B8'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1500, i / 24 * TAU, (i + 1) / 24 * TAU); g.fill(); }
  g.restore();
  const s = u < 0 ? 0 : 1 - Math.exp(-u * 7) * Math.cos(u * 22) * .9, bb = Math.cos(bq * TAU);
  g.save(); g.translate(CX, CY); g.scale(s * (1 - bb * .01), s * (1 + bb * .014)); g.translate(-CX, -CY);
  g.fillStyle = '#F4F1EA'; g.strokeStyle = P.ink; g.lineWidth = 11; g.beginPath(); g.arc(CX, CY - 20, 330, 0, TAU); g.fill(); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(CX, CY - 20, 300, 0, TAU); g.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.fillStyle = P.ink; g.beginPath(); g.arc(CX + Math.cos(a) * 315, CY - 20 + Math.sin(a) * 315, 4, 0, TAU); g.fill(); }
  const hopL = i => -(Math.max(0, Math.cos((bq - i * .15) * Math.PI)) ** 6) * 26;
  fatTitle(g, IN.end, CX, CY - 60, Math.round(230 * Math.min(1, 4 / Math.max(4, IN.end.length))), { bounce: hopL });
  // ribbon banner
  g.fillStyle = '#3B3A37'; g.strokeStyle = P.ink; g.lineWidth = 6;
  g.beginPath(); g.moveTo(CX - 380, CY + 120); g.lineTo(CX + 380, CY + 120); g.lineTo(CX + 350, CY + 168); g.lineTo(CX + 380, CY + 216); g.lineTo(CX - 380, CY + 216); g.lineTo(CX - 350, CY + 168); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#F4F1EA'; g.font = '40px Limelight'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${IN.title1}  ${IN.title2}`.toLocaleUpperCase(IN.locale), CX, CY + 170);
  g.restore();
}

function render(t) {
  t = clamp(t, 0, DUR - 1e-4);
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalAlpha = 1; sg.fillStyle = '#000'; sg.fillRect(0, 0, FW, FH);
  const sh = shotAt(t)[2];
  if (sh === 'son') sonCard(t);
  else {
    const cam = sh === 'title' ? CAM_A : camAt(t);
    room(t, cam);
    if (sh === 'title') titleCard(t);
    iris(t, cam);
  }
  const f = Math.round(t * 30), jump = CUTS.some(c => Math.round(c * 30) === f) ? 3 : 0;
  post(F, t, { jump, clean: Q.get('clean') === '1' });
}

window.DUR = DUR;
window.render = render;
window.READY = true;
