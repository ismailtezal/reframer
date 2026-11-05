// Robot Ev Arkadaşı — Sci-Fi Sitcom Toon style preview (1080×1920, 16 s)
// Page contract: window.render(t), window.DUR, window.READY. Engine: lemo-opuscar scifi-toon (MIT, LemoLab).
import { clamp, lerp, seg, ss, eo, ei, eio, back, hash, track, monotone, TAU } from './core/lib.js';
import { INK, init, frame, g, push, pop, translate, rotate, scale, reset, shape, fillOnly, stroke, ell, arc, spline, rr, rect, noodle, quad, dot, text, zoom } from './demo/toon.js';
import { eye } from './demo/chars.js';
import { PAL, robot, human, toaster, toast, thrust, plant, puff, plate, star4 } from './cast.js';
import { IN } from './inputs.js';

const SW = 1080, SH_ = 1920;
init(document.getElementById('c'));
const J = async f => { try { const r = await fetch(f); if (r.ok) return await r.json(); } catch (e) { } return null; };
const LIPS = (await J('lips.json')) || {};

// ———————————— timeline (single source of truth; the edit in Reframer uses the same numbers) ————————————
export const DUR = 16.0;
const q = t => Math.floor(t * 12 + 1e-6) / 12;          // characters on twos (12 fps); camera + effects on ones
const SHOTS = [[0, 3.0, 'A'], [3.0, 5.5, 'B'], [5.5, 6.7, 'C'], [6.7, 7.86, 'D'], [7.86, 9.71, 'L'], [9.71, 11.15, 'R'], [11.15, 12.55, 'K'], [12.55, 13.4, 'U'], [13.4, 14.45, 'V'], [14.45, DUR, 'U']];
const T = {
  title: [0.48, 3.0], showBread: 3.35, drop: 4.25, pat: 4.75, proud: 5.0,
  clicks: [5.62, 5.8, 5.98, 6.2], grab: 6.82, push: 7.02, rumble: [7.05, 7.86], launch: 7.86, hatch: 7.97,
  blink: 10.6, toCam: 10.05, ding: 11.08, lookUp: 12.72, roboUp: 12.85, back: 13.28, shrug: 13.6,
  pass: [14.5, 15.35], twinkle: 14.93, finalLook: 15.4,
};
const VO = { robotA: 11.25, robotB: 13.40 };
const talk = (id, t) => { const L = LIPS[id]; if (!L) return 0; const k = Math.floor((q(t) - VO[id]) * 24); return k >= 0 && k < L.length ? L[k] : 0; };

// ———————————— camera + screen helpers ————————————
function cam(cx, cy, z, shake = 0, t = 0) {
  reset(); translate(SW / 2, SH_ / 2);
  if (shake) { const f = Math.floor(t * 30); translate((hash(f) - .5) * shake * 2, (hash(f + 77) - .5) * shake * 2); }
  scale(z); translate(-cx, -cy);
}
function wash(col, a) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, SW, SH_); g.globalAlpha = 1; }

// ———————————— world: dollhouse cutaway of a space apartment on a tiny asteroid ————————————
// interior x -550..1650, ceiling y 150, floor y 1500; hull 150 thick around it; asteroid below
const SPACE = ['#1b1240', '#21164d', '#28195b', '#2f1e69', '#382377', '#422985'];
const WIN = [700, 560];   // porthole centre
function space(t) {
  const y0 = -3400, y1 = 3600, n = SPACE.length;
  for (let i = 0; i < n; i++) fillOnly(rect(-2600, lerp(y0, y1, i / n), 6000, (y1 - y0) / n + 4), SPACE[i], { boil: 0 });
  const z = zoom();
  for (let i = 0; i < 170; i++) {
    const x = -2000 + hash(i * 1.7) * 5200, y = -3300 + hash(i * 3.1 + 40) * 6600;
    if (x > -720 && x < 1820 && y > -30 && y < 1680) continue;
    const r = (2.2 + hash(i + 9) * 2.6) / z;
    if (i % 23 === 0) star4(x, y, (16 + 6 * Math.sin(t * 4 + i)) / z, '#fff3c4', 4);
    else dot(x, y, r, '#fff3c4');
  }
  // ringed planet far away
  push(); translate(1720, -1180);
  shape(ell(0, 0, 250, 250, 60), { fill: '#ffc94a', lw: 7, shade: () => { fillOnly(ell(90, 60, 240, 260, 40), '#e0a52c', { boil: .3 }); fillOnly(rect(-300, -60, 600, 26), '#f4b13c', { boil: .3 }); fillOnly(rect(-300, 40, 600, 20), '#f4b13c', { boil: .3 }); } });
  rotate(-.32); stroke(arc(0, 0, 420, 70, -.15, Math.PI + .15, 40), 18); stroke(arc(0, 0, 420, 70, -.15, Math.PI + .15, 40), 9, { line: '#ff8c5a' });
  pop();
}
function asteroid(t) {
  const pts = []; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; const k = 1 + .1 * (hash(i * 2.3) - .5) * 2; pts.push([550 + Math.cos(a) * 1450 * k, 2050 + Math.sin(a) * 520 * k]); }
  shape(spline(pts), {
    fill: '#a0644e', lw: 8, shade: () => {
      fillOnly(ell(980, 2200, 900, 380, 40), '#7c4a3a', { boil: .3 });
      for (const [cx, cy, r] of [[-500, 2050, 110], [150, 2250, 80], [1300, 2000, 130], [1700, 2250, 70], [-150, 1900, 60]]) shape(ell(cx, cy, r, r * .4, 24), { fill: '#7c4a3a', lw: 6 });
    }
  });
  for (const lx of [-300, 550, 1400]) shape(rr(lx - 40, 1600, 80, 220, 20), { fill: PAL.hullS, lw: 7 });   // stilts
}
function hull(t, o = {}) {
  shape(rr(-700, -10, 2500, 1680, 170), { fill: PAL.hull, lw: 9, shade: () => { fillOnly(rect(1640, -40, 300, 1800), PAL.hullS, { boil: .3 }); fillOnly(rect(-690, 1520, 2600, 200), PAL.hullS, { boil: .3 }); } });
  if (zoom() > .45) for (let x = -560; x < 1700; x += 140) { dot(x, 75, 6, PAL.hullS); dot(x, 1590, 6, '#636d7c'); }
  // roof props: satellite dish + mast
  push(); translate(-180, -10);
  shape(rr(-14, -120, 28, 120, 8), { fill: PAL.hullS, lw: 6 });
  push(); translate(0, -130); rotate(-.5); shape(arc(0, 0, 110, 60, 0, Math.PI, 20), { fill: PAL.hullL, lw: 7 }); stroke([[0, 0], [0, 70]], 5); dot(0, 76, 9, PAL.red); pop();
  pop();
  shape(rr(1480, -230, 20, 222, 6), { fill: PAL.hullS, lw: 6 });
  dot(1490, -244, 13, Math.floor(t * 2) % 2 ? '#ff6a5a' : '#7a3030');
  // ceiling hatch (x 860..1060): doors burst up through the roof on launch
  const op = o.hatch || 0;
  if (op > 0) {
    fillOnly(rect(866, -12, 188, 164), SPACE[1], { boil: .2 });
    for (const sx of [-1, 1]) {
      const hx = sx < 0 ? 866 : 1054, ang = -sx * (Math.PI * .62) * back(op, 1.4);
      push(); translate(hx, -6); rotate(ang); shape(rect(sx < 0 ? 0 : -94, -12, 94, 22), { fill: PAL.hullL, lw: 7 }); pop();
    }
    stroke([[866, -10], [866, 150]], 6); stroke([[1054, -10], [1054, 150]], 6);
  }
}
function interior(t, o = {}) {
  fillOnly(rect(-550, 150, 2200, 1350), PAL.wall, { boil: 0 });
  for (let x = -480; x < 1650; x += 230) stroke([[x, 150], [x, 1180]], 4, { line: PAL.wallLine });
  shape(rect(-550, 1180, 2200, 320), { fill: PAL.wains, lw: 6, shade: () => fillOnly(rect(-550, 1420, 2200, 80), PAL.wainsS, { boil: .3 }) });
  fillOnly(rect(-550, 1468, 2200, 34), PAL.floor, { boil: 0 }); stroke([[-550, 1468], [1650, 1468]], 5);
  shape(rect(-550, 120, 2200, 34), { fill: '#e9cf97', lw: 6 });                       // ceiling trim
  if (!o.hatch) { shape(rr(870, 128, 180, 24, 6), { fill: PAL.hullS, lw: 5 }); stroke([[960, 128], [960, 152]], 4); }
  // starburst wall clock (60s)
  push(); translate(40, 470);
  const sb = []; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; const r = i % 2 ? 54 : 92; sb.push([Math.cos(a) * r, Math.sin(a) * r]); }
  shape(sb, { fill: '#ffc94a', lw: 6 }); shape(ell(0, 0, 46, 46, 30), { fill: '#fff8e8', lw: 6 });
  stroke([[0, 0], [0, -32]], 6); stroke([[0, 0], [24, 8]], 5); dot(0, 0, 5);
  pop();
  // porthole window between the roommates, with space outside
  push(); translate(WIN[0], WIN[1]);
  shape(ell(0, 0, 208, 208, 64), { fill: PAL.hull, lw: 8 });
  shape(ell(0, 0, 170, 170, 60), {
    fill: SPACE[2], lw: 7, shade: () => {
      fillOnly(rect(-240, -240, 480, 150), SPACE[0], { boil: 0 }); fillOnly(rect(-240, 80, 480, 180), SPACE[4], { boil: 0 });
      for (let i = 0; i < 12; i++) dot(-150 + hash(i * 4.4) * 300, -150 + hash(i * 6.1) * 300, 3.2 + hash(i) * 2.5, '#fff3c4');
      shape(ell(96, 84, 60, 60, 30), { fill: '#ffc94a', lw: 6, shade: () => fillOnly(ell(122, 104, 60, 66, 24), '#e0a52c', { boil: .3 }) });
      if (o.inWindow) o.inWindow();
      fillOnly([[-150, -52], [-52, -150], [-18, -132], [-132, -18]], 'rgba(255,255,255,.12)', { boil: .2 });
    }
  });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .2; dot(Math.cos(a) * 189, Math.sin(a) * 189, 7, PAL.hullS); }
  pop();
  // upper cabinets
  shape(rr(1250, 260, 390, 270, 16), { fill: PAL.counter, lw: 7, shade: () => fillOnly(rect(1580, 250, 80, 300), PAL.counterS, { boil: .3 }) });
  stroke([[1445, 270], [1445, 520]], 5); shape(rr(1410, 380, 14, 50, 6), { fill: PAL.top, lw: 4 }); shape(rr(1466, 380, 14, 50, 6), { fill: PAL.top, lw: 4 });
  // sputnik lamp: swings after the launch (follow-through)
  const sw = t > T.launch ? .2 * Math.exp(-(t - T.launch) * .32) * Math.sin((t - T.launch) * 5.2) : 0;
  push(); translate(330, 152); rotate(sw);
  stroke([[0, 0], [0, 196]], 5);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; stroke([[0, 236], [Math.cos(a) * 92, 236 + Math.sin(a) * 92]], 4); dot(Math.cos(a) * 96, 236 + Math.sin(a) * 96, 9, '#ffc94a'); }
  shape(ell(0, 236, 46, 46, 28), { fill: '#fff8e8', lw: 7, shade: () => fillOnly(ell(18, 250, 30, 34, 16), '#eadfca', { boil: .3 }) });
  pop();
}
function counter() {
  shape(rect(760, 1120, 900, 380), { fill: PAL.counter, lw: 8, shade: () => fillOnly(rect(760, 1130, 900, 26), PAL.counterS, { boil: .3 }) });
  for (let x = 800; x < 1640; x += 210) { shape(rr(x, 1172, 180, 270, 12), { fill: PAL.counter, lw: 6 }); shape(rr(x + 70, 1190, 40, 12, 6), { fill: PAL.top, lw: 4 }); }
  shape(rr(740, 1098, 940, 36, 10), { fill: PAL.top, lw: 7, shade: () => fillOnly(rect(740, 1120, 940, 20), PAL.topS, { boil: .3 }) });
}
function table() {
  const c = HX + 90;
  shape(spline([[c, 1236], [c + 30, 1300], [c, 1460], [c + 80, 1500], [c - 80, 1500], [c, 1460], [c - 30, 1300]]), { fill: PAL.table, lw: 7 });
  shape(spline([[HX - 250, 1188], [HX, 1170], [HX + 250, 1182], [HX + 290, 1212], [HX + 250, 1238], [HX, 1228], [HX - 250, 1240], [HX - 280, 1214]]), { fill: PAL.table, lw: 8, shade: () => fillOnly(rect(HX - 320, 1222, 680, 30), PAL.wains, { boil: .3 }) });
}
function mug(x, y, t) {
  push(); translate(x, y);
  shape(spline([[30, -64], [62, -60], [64, -22], [30, -16]], false).concat([[30, -26], [50, -28], [50, -52], [30, -54]]), { fill: '#ff8fb8', lw: 6 });
  shape(rr(-38, -86, 76, 86, 14), { fill: '#ff8fb8', lw: 7, shade: () => fillOnly(rect(14, -90, 34, 96), '#e46a98', { boil: .3 }) });
  shape(ell(0, -86, 38, 9, 20), { fill: '#6b3e26', lw: 5 });
  for (let k = 0; k < 2; k++) { const ph = (t * 1.1 + k * .5) % 1, x0 = -12 + k * 24, y0 = -104 - ph * 40; stroke(quad([x0, y0], [x0 + 14, y0 - 20], [x0, y0 - 42], 8), 5, { line: `rgba(255,255,255,${.85 * (1 - ph)})` }); }
  pop();
}

// toast flight path: Bezier up through the hatch into a circular orbit around the asteroid home
const P0 = [960, 900], P1 = [960, -650], P2 = [550, -650], OC = [550, 850], OR = 1500;
const bez = u => { const v = 1 - u; return [v * v * P0[0] + 2 * v * u * P1[0] + u * u * P2[0], v * v * P0[1] + 2 * v * u * P1[1] + u * u * P2[1]]; };
const BZ = []; { let acc = 0, prev = P0; for (let i = 0; i <= 400; i++) { const p = bez(i / 400); acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]); BZ.push(acc); prev = p; } }
const LB = BZ[BZ.length - 1];
function pathAt(s) {
  if (s <= LB) {
    let i = 0; while (i < 400 && BZ[i + 1] < s) i++;
    const u = (i + clamp((s - BZ[i]) / ((BZ[i + 1] - BZ[i]) || 1))) / 400, p = bez(u), p2 = bez(Math.min(1, u + .003)), p1 = bez(Math.max(0, u - .003));
    return [p[0], p[1], Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) + Math.PI / 2];
  }
  const th = -(s - LB) / OR;
  return [OC[0] + OR * Math.sin(th), OC[1] - OR * Math.cos(th), Math.atan2(-OR * Math.sin(th), -OR * Math.cos(th)) + Math.PI / 2];
}
const sOf = monotone([[T.launch, 0], [7.97, .36 * LB], [8.3, .74 * LB], [8.75, LB], [DUR, LB + 1100 + (DUR - 9.71) * 900]]);
const camL = track([[7.86, [1060, 880, 1.32]], [7.95, [1060, 870, 1.3]], [8.32, [930, -330, .8]], [8.75, [760, -420, .6]], [9.71, [550, 820, .3]]]);

// ———————————— poses ————————————
const RX = 1180, FLOOR = 1500, HX = 330, SEAT = 1310;
function R(t, o = {}) {
  const tq = q(t), m = Math.max(talk('robotA', t), talk('robotB', t));
  return { x: RX, y: FLOOR, t, sq: 1 + .01 * Math.sin(tq * 2.6), look: [-.2, .1], lid: .1, mouth: { o: m, w: .9 + .25 * m, sm: .5 }, antW: Math.sin(tq * 3.1) * 7, ...o };
}
function Hm(t, o = {}) {
  const tq = q(t);
  return { x: HX, y: SEAT, t, sq: 1 + .008 * Math.sin(tq * 2.2), look: [.55, 0], lid: .56, ...o };
}
function room(t, o = {}) {
  space(t); asteroid(t); hull(t, o); interior(t, o);
  if (o.robot) robot(o.robot);
  counter();
  toaster(960, 1120, o.toaster || { dial: -1.75, t });
  plant(1520, 1120, t, o.plant || { look: [-.4, .1] });
  if (o.human) human(o.human);
  table(); mug(HX + 200, 1186, t);
  if (o.front) o.front();
}

// ———————————— shots ————————————
const SHOT = {};
SHOT.A = (t, tq) => {   // wide dollhouse + sitcom title
  cam(760, 690, lerp(.78, .82, ss(seg(t, 0, 3))));
  const wave = seg(tq, .9, 1.9);
  room(t, {
    robot: R(t, { look: [-.5, .2], happy: tq > 1.0 && tq < 2.2, armR: { h: [90, -40 - Math.sin(wave * Math.PI * 4) * 40], bend: -30 }, antW: Math.sin(tq * 6) * 12 }),
    human: Hm(t, { look: [.7, -.05] }),
    toaster: { dial: -1.75, t, bread: 0 },
  });
};
SHOT.B = (t, tq) => {   // robot medium: shows the bread, drops it in, pats the toaster, proud
  cam(lerp(1120, 1100, seg(t, 3, 5.5)), 860, lerp(1.12, 1.2, ss(seg(t, 3, 5.5))));
  const show = ss(seg(tq, T.showBread, T.showBread + .35)), drop = ss(seg(tq, T.drop - .15, T.drop + .1));
  const pat = seg(tq, T.pat, T.pat + .4), proud = tq >= T.proud;
  let armL;
  if (tq < T.drop - .15) armL = { h: [lerp(-30, -34, show), lerp(226, -154, show)], bend: lerp(-20, -60, show) };
  else if (tq < T.drop + .2) armL = { h: [lerp(-34, -60, drop), lerp(-154, 60, drop)], bend: lerp(-60, -40, drop) };
  else if (tq < T.pat + .4) armL = { h: [-40, 40 - Math.abs(Math.sin(pat * Math.PI * 3)) * 34], bend: -40, fist: false };
  else armL = { h: [-30, 226], bend: -20 };
  const holding = tq < T.drop + .02;
  room(t, {
    robot: R(t, { look: holding ? [-.6, -.3] : (proud ? [0, 0] : [-.6, .5]), happy: proud, holdL: holding ? 'bread' : null, armL: { ...armL, ba: -.2 }, headTilt: proud ? -.08 : -.02, brow: proud ? .6 : .2, antW: Math.sin(tq * 7) * 10, armR: proud ? { h: [10, 160], bend: 60 } : undefined }),
    human: Hm(t), toaster: { dial: -1.75, t, bread: tq >= T.drop + .05 ? 1 - seg(tq, T.drop + .05, T.drop + .2) * .7 : 0 },
    plant: { look: holding ? [-.5, -.5] : [-.7, .3] },
  });
};
const DIAL = [-1.75, -.79, .17, 1.13];
const LABELS = [[IN.dial[0], -1.75], [IN.dial[1], -.79], [IN.dial[2], .17], [IN.dial[3], 1.13]];
function dialAngle(t) {
  let a = DIAL[0];
  for (let i = 1; i < 4; i++) { const u = seg(q(t), T.clicks[i - 1] + .04, T.clicks[i - 1] + .14); if (u > 0) a = lerp(DIAL[i - 1], DIAL[i], i === 3 ? back(u, 2.4) : eo(u)); }
  return a;
}
SHOT.C = (t, tq) => {   // insert: the robot's mitt turns the toaster dial to YÖRÜNGE
  reset(); translate(520, 900); scale(lerp(1.26, 1.32, seg(t, 5.5, 6.7)));
  shape(rect(-800, -1200, 1600, 2400), { fill: PAL.chrome, boil: 0, stroke: false });
  fillOnly([[-800, -500], [800, -1000], [800, -830], [-800, -330]], PAL.chromeL, { boil: .3 });
  fillOnly([[-800, 650], [800, 150], [800, 260], [-800, 760]], PAL.chromeL, { boil: .3 });
  shape(rect(-800, 560, 1600, 120), { fill: PAL.bot, lw: 8 });
  const ang = dialAngle(t), armed = q(t) >= T.clicks[3] + .1;
  shape(ell(0, 0, 372, 372, 90), { fill: PAL.cream, lw: 9, shade: () => fillOnly(ell(120, 130, 300, 300, 60), PAL.creamS, { boil: .3 }) });
  for (const [lab, a] of LABELS) {
    const big = lab === IN.dial[3], r = big ? 252 : 246, x = Math.sin(a) * r, y = -Math.cos(a) * r;
    stroke([[Math.sin(a) * 330, -Math.cos(a) * 330], [Math.sin(a) * 364, -Math.cos(a) * 364]], 8);
    text(lab, x, y, { font: `800 ${big ? 58 : 52}px Baloo`, fill: big ? '#e2513b' : INK });
    if (big) {   // small rocket icon under the label
      push(); translate(x, y + 58); rotate(.5);
      shape(spline([[0, -34], [14, -10], [12, 22], [-12, 22], [-14, -10]]), { fill: '#fffaf0', lw: 5 }); shape([[-12, 8], [-24, 26], [-10, 22]], { fill: '#e2513b', lw: 4 }); shape([[12, 8], [24, 26], [10, 22]], { fill: '#e2513b', lw: 4 }); dot(0, -6, 5, '#7ff6ff');
      pop();
    }
  }
  shape(ell(0, 270, 22, 22, 18), { fill: armed ? (Math.floor(t * 8) % 2 ? '#ff8a7a' : PAL.red) : '#8a5050', lw: 6 });
  push(); rotate(ang);
  shape(ell(0, 0, 112, 112, 60), { fill: '#3a2a30', lw: 8, shade: () => fillOnly(ell(30, 30, 100, 100, 40), '#2a1d22', { boil: .3 }) });
  shape(rr(-20, -104, 40, 150, 18), { fill: '#5b4650', lw: 6 });
  shape([[0, -170], [26, -122], [-26, -122]], { fill: PAL.red, lw: 6 });
  pop();
  // the robot's mitt grips the knob from the lower right and turns with it
  const ga = ang + 1.9, gx = Math.sin(ga) * 104, gy = -Math.cos(ga) * 104;
  shape(noodle([620, 760], [gx + 40, gy + 30], 60, 92, 80), { fill: PAL.steel, lw: 8 });
  for (let i = 1; i <= 4; i++) { const u = i / 5, px = lerp(620, gx + 40, u), py = lerp(760, gy + 30, u); stroke([[px - 36, py + 30], [px + 36, py - 30]], 5); }
  push(); translate(gx, gy); rotate(ga + Math.PI);
  shape(spline([[-60, -50], [40, -62], [86, -20], [80, 40], [20, 64], [-60, 50], [-80, 0]]), { fill: PAL.steelL, lw: 8 });
  stroke([[0, -20], [50, -30]], 5); stroke([[0, 10], [56, 6]], 5);
  pop();
};
SHOT.D = (t, tq) => {   // robot grabs the lever, pushes it down, the toaster arms and rumbles
  const rum = seg(t, T.rumble[0], T.rumble[1]);
  cam(1060, 880, lerp(1.24, 1.32, ss(seg(t, 6.7, 7.86))), rum * 3, t);
  const reach = ss(seg(tq, 6.75, T.grab)), down = ss(seg(tq, T.push - .05, T.push + .12));
  let armL = { h: [lerp(-30, -60, reach), lerp(226, 60, reach) + down * 92], bend: -50, fist: true };
  if (tq > T.push + .45) { const off = ss(seg(tq, T.push + .45, T.push + .75)); armL = { h: [lerp(-60, 60, off), lerp(152, 150, off)], bend: lerp(-50, 60, off) }; }
  const f = Math.floor(t * 30), A = 7 * rum * rum;
  const jit = rum > 0 ? [(hash(f) - .5) * 2 * A, (hash(f + 9) - .5) * 2 * A] : [0, 0];
  room(t, {
    robot: R(t, { look: tq > T.push + .3 ? [-.7, .55] : [-.6, .4], lid: 0, happy: tq > T.push + .1 && tq < T.push + .45, brow: .8, armL, armR: tq > T.push + .45 ? { h: [-60, 150], bend: -60 } : undefined, antW: Math.sin(tq * 9) * 10 + rum * Math.sin(t * 50) * 6, mouth: { o: 0, sm: .9 } }),
    human: Hm(t, { look: [.9, -.1] }),
    toaster: { dial: DIAL[3], lever: down, jit, armed: true, glow: rum, bread: .3, t },
    plant: { look: [-.9, -.2], lid: 0, jump: rum * .06 * Math.sin(t * 40) },
  });
};
SHOT.L = (t, tq) => {   // LAUNCH: toast blasts up through the hatch; crane up + zoom out to the orbit
  const [cx, cy, z] = camL(t), sh = 14 * Math.max(0, 1 - (t - T.launch) / .35);
  cam(cx, cy, z, sh, t);
  const s = sOf(t), [x, y, a] = pathAt(s), hatch = seg(t, T.hatch - .02, T.hatch + .22);
  const recoil = seg(tq, T.launch, T.launch + .5);
  room(t, {
    hatch,
    robot: R(t, { look: [-.5, -.9], lid: 0, pupil: 4.5, lean: -.06 * Math.sin(recoil * Math.PI), sq: 1 - .05 * Math.sin(recoil * Math.PI), happy: false, brow: 1, antW: 26 * Math.exp(-(t - T.launch) * 4) * Math.sin(t * 40), mouth: { o: .5, w: .7, sm: .4 } }),
    human: Hm(t, { look: [.6, -.7] }),
    toaster: { dial: DIAL[3], lever: 1, armed: false, t },
    plant: { look: [-.6, -1], lid: 0 },
    front: () => {
      // smoke from the slot and the hatch, then the toast with its thrust flame
      const k = t - T.launch;
      for (let i = 0; i < 3; i++) puff(960 + (i - 1) * 50, 900 - k * 120 - i * 40, 38 + k * 30, clamp(1 - k * .6), i);
      if (hatch > 0) for (let i = 0; i < 3; i++) puff(900 + i * 60, -40 - k * 160 - i * 30, 46 + k * 30, clamp(1 - (t - T.hatch) * .5), i + 5);
      const z_ = zoom(), sc = Math.max(1, .55 / z_);     // cheat the toast larger when the camera is far
      const sp = s - sOf(t - 1 / 30), stc = 1 + clamp(sp / 60) * .5;
      for (let i = 1; i <= 3; i++) { const [px, py] = pathAt(Math.max(0, s - i * 70 * sc)); dot(px, py, (10 - i * 2) * sc, i === 1 ? PAL.glowW : PAL.glow); }
      thrust(x - Math.sin(a) * 60 * sc, y + Math.cos(a) * 60 * sc, sc * .9, a, t, stc);
      toast(x, y, sc, a, { st: stc });
      // dashed orbit hint once we are far enough
      if (z_ < .5) { const al = clamp((.5 - z_) / .12); g.globalAlpha = al; for (let i = 0; i < 40; i++) { if (i % 2) continue; const a0 = i / 40 * TAU, a1 = (i + 1) / 40 * TAU; stroke(arc(OC[0], OC[1], OR, OR, a0, a1, 6), 5, { line: '#fff3c4', boil: .3 }); } g.globalAlpha = 1; }
    },
  });
  const fl = 1 - seg(t, T.launch, T.launch + .22); if (fl > 0) wash('#7ff6ff', .26 * fl);
};
SHOT.R = (t, tq) => {   // reaction close-up: deadpan, nothing moves but the boil
  cam(HX + 6, 922, lerp(2.0, 2.14, seg(t, 9.71, 11.15)));
  const toCam = tq >= T.toCam, bl = tq >= T.blink && tq < T.blink + .17;
  room(t, { hatch: 1, robot: R(t), human: Hm(t, { look: toCam ? [0, .05] : [.55, -.6], lid: .6, blink: bl, brow: -.1, mouth: { o: 0, sm: -.2 } }), toaster: { dial: DIAL[3], lever: 1, t } });
};
SHOT.K = (t, tq) => {   // robot close-up: microwave DING, proudly presents the (empty) plate
  cam(1150, 700, lerp(1.7, 1.78, seg(t, 11.15, 12.55)));
  const flash = Math.floor((t - T.ding) * 4) % 2 === 0, m = talk('robotA', t), pre = tq < VO.robotA + .1;
  room(t, {
    hatch: 1,
    robot: R(t, { happy: pre, look: [0, .05], lid: 0, brow: .9, disp: 'HAZIR!', dispOn: flash || t > 12.2, lit: true, bulb: flash, plate: [-40, -560], armL: { h: [-56, 84], bend: 30, front: true }, armR: { h: [-20, 84], bend: -30, front: true }, headTilt: -.04 + m * .03, antW: Math.sin(tq * 8) * 12 }),
    human: Hm(t), toaster: { dial: DIAL[3], lever: 1, t },
  });
};
SHOT.U = (t, tq) => {   // one long two-shot: look up at the hole, "...Yörüngede.", the toast passes the window, button
  if (t < 13.4) cam(760, lerp(640, 660, seg(t, 12.55, 13.4)), lerp(.84, .87, seg(t, 12.55, 13.4)));
  else cam(lerp(760, 750, seg(t, 14.45, DUR)), 700, lerp(.82, .88, ss(seg(t, 14.45, DUR))));
  const up = ss(seg(tq, T.lookUp, T.lookUp + .3)), rUp = ss(seg(tq, T.roboUp, T.roboUp + .25)), rBack = ss(seg(tq, T.back, T.back + .2));
  const pass = seg(t, T.pass[0], T.pass[1]), watching = tq >= T.pass[0] - .15 && tq < T.finalLook;
  const fin = tq >= T.finalLook, shrug = ss(seg(tq, T.shrug, T.shrug + .2)) * (1 - ss(seg(tq, 14.3, 14.5)));
  // robot: up at the hole, back to her (sheepish), watches the window, then proud again
  let rl = [-.2, .1], rh = false, rlid = .1, rbt = 0, rbr = .4, rsm = .5, rskew = 0, sweatV = null;
  if (rUp > 0) { rl = [lerp(-.2, -.4, rUp), lerp(.1, -.95, rUp)]; rlid = 0; }
  if (rBack > 0) { rl = [lerp(-.4, -.85, rBack), lerp(-.95, .25, rBack)]; rlid = .38; rbt = -.25; rbr = .1; rsm = .15; rskew = .5; sweatV = t * 1.2; }
  if (watching) { rl = [lerp(-1, -.45, pass), -.25]; rlid = 0; rbt = 0; rbr = .8; rsm = .4; rskew = 0; sweatV = null; }
  if (fin) { rh = true; rbr = .9; rsm = .9; }
  let hl = [.55, 0], hlid = .58, htilt = 0;
  if (up > 0) { hl = [lerp(.55, .75, up), lerp(0, -.95, up)]; htilt = -.06 * up; }
  if (tq >= T.back + .35) { hl = [.85, -.05]; htilt = 0; }
  if (watching) hl = [lerp(.35, 1, pass), -.4];
  if (fin) { hl = [0, .05]; hlid = .62; }
  const hatchSmoke = () => { for (let i = 0; i < 3; i++) { const ph = (t * .35 + i / 3) % 1; puff(960 + Math.sin(ph * 6 + i) * 30, 120 - ph * 260, 30 + ph * 26, .9 * (1 - ph), i + 11); } };
  room(t, {
    hatch: 1,
    robot: R(t, { look: rl, lid: rlid, happy: rh, browTilt: rbt, brow: rbr, headTilt: -.12 * rUp * (1 - rBack), mouth: { o: Math.max(talk('robotB', t), 0), w: 1, sm: rsm, skew: rskew }, sweat: sweatV,
      plate: [-40 + shrug * 0, -500 - shrug * 30], armL: { h: [-56, 144 - shrug * 30], bend: 30 + shrug * 30, front: true }, armR: { h: [-20, 144 - shrug * 30], bend: -30 - shrug * 30, front: true } }),
    human: Hm(t, { look: hl, lid: hlid, headTilt: htilt, mouth: { o: 0, sm: -.2 } }),
    toaster: { dial: DIAL[3], lever: 1, t },
    plant: { look: watching ? [lerp(-1, -.6, pass), -.6] : [-.5, -.8] },
    inWindow: () => {
      if (t < T.pass[0] || t > T.pass[1] + .1) return;
      const x = lerp(-250, 250, pass), y = lerp(36, -26, pass) + Math.sin(pass * 6) * 6;   // window-local
      for (let i = 1; i <= 3; i++) dot(x - i * 34, y + i * 3, 9 - i * 2, i === 1 ? PAL.glowW : PAL.glow);
      thrust(x - 54, y + 4, .5, Math.PI / 2 + .08, t, 1);
      toast(x, y, .56, Math.PI / 2 + .08);
      if (t > T.twinkle && t < T.twinkle + .35) star4(x + 40, y - 54, 30 * Math.sin(seg(t, T.twinkle, T.twinkle + .35) * Math.PI) + 4, '#fff3c4', 5);
    },
    front: () => { hatchSmoke(); },
  });
};

SHOT.V = (t, tq) => {   // "...Yörüngede." — sheepish robot medium close-up
  cam(1150, 690, lerp(1.5, 1.6, seg(t, 13.4, 14.45)));
  const shrug = ss(seg(tq, T.shrug, T.shrug + .2)) * (1 - ss(seg(tq, 14.25, 14.45))), m = talk('robotB', t);
  room(t, {
    hatch: 1,
    robot: R(t, { look: [-.85, .15], lid: .4, browTilt: -.28, brow: .15, headTilt: .05 + shrug * .04, mouth: { o: m, w: .9 + .2 * m, sm: .12, skew: .5 }, sweat: t * 1.1, antW: -10 + Math.sin(tq * 5) * 4,
      plate: [-40, -520 - shrug * 46], armL: { h: [-56, 124 - shrug * 46], bend: 30 + shrug * 40, front: true }, armR: { h: [-20, 124 - shrug * 46], bend: -30 - shrug * 40, front: true } }),
    human: Hm(t, { look: [.85, -.05] }), toaster: { dial: DIAL[3], lever: 1, t },
    front: () => { for (let i = 0; i < 3; i++) { const ph = (t * .35 + i / 3) % 1; puff(960 + Math.sin(ph * 6 + i) * 30, 120 - ph * 260, 30 + ph * 26, .9 * (1 - ph), i + 11); } },
  });
};

// ———————————— title card: 60s space-age sitcom card (googie starbursts + ribbon), popped on 12 fps steps on beats ————————————
function starburst(r0, r1, n, col, lw = 8) { const p = []; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU - Math.PI / 2; const r = i % 2 ? r1 : r0; p.push([Math.cos(a) * r, Math.sin(a) * r]); } shape(p, { fill: col, lw }); }
function boomerang(x, y, s, a, col) { push(); translate(x, y); rotate(a); scale(s); shape(spline([[-70, 10], [0, -34], [70, 10], [60, 22], [0, -8], [-60, 22]]), { fill: col, lw: 6 }); pop(); }
function titleCard(t) {
  const [a, b] = T.title; if (t < a || t >= b) return;
  const tq = q(t), out = 1 - ei(seg(t, b - .2, b));
  const s1 = back(seg(tq, a, a + .25), 2.2), s2 = back(seg(tq, .94, .94 + .25), 2.2), s3 = back(seg(tq, 1.4, 1.65), 2.4);
  reset(); translate(540, 570); scale(out * .84);
  push(); scale(s1); rotate(t * .22); starburst(330, 236, 14, PAL.wains); pop();
  push(); scale(s1 * .86); rotate(-t * .3 + .12); starburst(300, 214, 14, '#ffc94a'); pop();
  if (s1 > 0) {
    push(); scale(s1); rotate(-.06);
    text(IN.title, 14, 16, { font: `400 ${Math.round(196 * Math.min(1, 5 / Math.max(5, IN.title.length)))}px Righteous`, fill: '#e2513b', outlineW: 22, outlineCol: INK });
    text(IN.title, 0, 0, { font: `400 ${Math.round(196 * Math.min(1, 5 / Math.max(5, IN.title.length)))}px Righteous`, fill: '#fff4dc', outlineW: 22, outlineCol: INK });
    pop();
  }
  if (s2 > 0) {
    push(); translate(0, 196); scale(s2); rotate(.03);
    shape([[-390, -40], [-330, -40], [-330, 70], [-390, 70], [-360, 15]], { fill: PAL.pjS, lw: 7 });
    shape([[390, -40], [330, -40], [330, 70], [390, 70], [360, 15]], { fill: PAL.pjS, lw: 7 });
    shape([[-350, -62], [350, -62], [350, 52], [-350, 52]], { fill: PAL.pj, lw: 8 });
    text(IN.subtitle, 0, -4, { font: `400 ${Math.round(92 * Math.min(1, 11 / Math.max(11, IN.subtitle.length)))}px Righteous`, fill: '#fff4dc', outlineW: 14, outlineCol: INK });
    pop();
  }
  if (s3 > 0) {
    push(); scale(s3);
    boomerang(-390, -170, 1, -.4, '#fff4dc'); boomerang(400, 120, .9, .5, '#fff4dc');
    for (const [x, y, r, ph] of [[-330, -260, 30, 0], [360, -240, 24, 1.7], [-420, 60, 20, 3.1], [300, 330, 22, 4.4]]) star4(x, y, r + 7 * Math.sin(t * 6 + ph), '#ffe066', 5);
    pop();
  }
}

function render(t) {
  frame(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = SPACE[2]; g.fillRect(0, 0, SW, SH_);
  const sh = SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  SHOT[sh[2]](t, q(t));
  titleCard(t);
}

window.render = render; window.DUR = DUR; window.SHOTS = SHOTS; window.T = T; window.VO = VO;
for (const f of ['800 50px Baloo', '400 60px Righteous', '400 40px VT323']) await document.fonts.load(f);
await window.packFonts?.();
render(parseFloat(new URLSearchParams(location.search).get('t') ?? '1.5'));
window.READY = true;
