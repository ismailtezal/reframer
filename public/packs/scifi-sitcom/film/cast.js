// cast.js — original cast and props for "Robot Ev Arkadaşı" (vertical 1080×1920)
// The boxy robot roommate (microwave chest, chef's toque, accordion arms), the deadpan human roommate
// (cloud hair, sleep mask pushed up, napkin bib), the rocket toaster, the toast, a one-eyed pot plant.
// Built on the scifi-toon engine from lemo-opuscar (toon.js / chars.js, MIT, LemoLab), loaded by absolute URL.
import { clamp, lerp, hash, TAU } from './core/lib.js';
import { INK, push, pop, translate, rotate, scale, shape, fillOnly, stroke, ell, arc, spline, rr, rect, noodle, quad, dot, text } from './demo/toon.js';
import { eye, mouth, hand } from './demo/chars.js';

export const PAL = {
  wall: '#f6e3b4', wallLine: '#e3ca92', wains: '#f0a35e', wainsS: '#d4834a', floor: '#4c7a8c',
  hull: '#aab4c4', hullS: '#808b9c', hullL: '#cfd6e2',
  counter: '#7cc6b4', counterS: '#5aa592', top: '#fff4dc', topS: '#e8d9b8',
  bot: '#e2513b', botS: '#b63a28', botL: '#f27d63', cream: '#fff1d0', creamS: '#e9d6aa',
  steel: '#a9b4c2', steelS: '#7f8a99', steelL: '#dbe2ea', glass: '#2c4a55', amber: '#ffcf6b',
  skin: '#c98a5e', skinS: '#a86b44', hair: '#3a2240', hairS: '#27162e', pj: '#2f9e9a', pjS: '#237a77', bib: '#ffffff', mask: '#ff8fb8', maskS: '#e46a98',
  toast: '#f2c27a', crust: '#b8722f', toastS: '#e0a050', glow: '#7ff6ff', glowW: '#effeff',
  chrome: '#c7d3df', chromeS: '#97a6b8', chromeL: '#eef4fa', red: '#ff5a4a', table: '#fff4dc', plant: '#9ccf6a', plantS: '#77ad4a',
  silver: '#dfe4ec',
};

// accordion ribs across a noodle limb
function ribs(a, b, bend, w, n, lw = 4) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const c = [(a[0] + b[0]) / 2 + nx * bend, (a[1] + b[1]) / 2 + ny * bend];
  for (let i = 1; i <= n; i++) {
    const u = i / (n + 1), v = 1 - u;
    const p = [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]];
    const tx_ = 2 * v * (c[0] - a[0]) + 2 * u * (b[0] - c[0]), ty_ = 2 * v * (c[1] - a[1]) + 2 * u * (b[1] - c[1]), l = Math.hypot(tx_, ty_) || 1;
    const px = -ty_ / l * w * .42, py = tx_ / l * w * .42;
    stroke([[p[0] - px, p[1] - py], [p[0] + px, p[1] + py]], lw);
  }
}
const sweat = (x, y, s = 1) => shape(spline([[x, y - 16 * s], [x + 9 * s, y + 4 * s], [x, y + 12 * s], [x - 9 * s, y + 4 * s]]), { fill: '#bfe9ff', lw: 5 });

// —— props ——
export function plate(x, y, s = 1, crumbs = true) {
  push(); translate(x, y); scale(s);
  shape(ell(0, 0, 130, 34, 36), { fill: '#fffaf0', lw: 7, shade: () => fillOnly(ell(0, 7, 90, 19, 30), '#ece4d4', { boil: .3 }) });
  if (crumbs) for (let i = 0; i < 6; i++) dot(-46 + hash(i * 3.3) * 92, -2 + hash(i * 5.1) * 14, 3.6, PAL.crust);
  pop();
}
// bread slice; o.st stretches it along its length (squash & stretch in flight)
export function toast(x, y, s = 1, a = 0, o = {}) {
  const st = o.st ?? 1;
  push(); translate(x, y); rotate(a); scale(s / st, s * st);
  shape(spline([[-62, 70], [62, 70], [66, -20], [80, -50], [66, -84], [30, -98], [-30, -98], [-66, -84], [-80, -50], [-66, -20]]), {
    fill: PAL.crust, lw: 7, shade: () => {
      fillOnly(spline([[-48, 56], [48, 56], [52, -22], [62, -48], [50, -72], [22, -82], [-22, -82], [-50, -72], [-62, -48], [-52, -22]]), PAL.toast, { boil: .3 });
      fillOnly(ell(0, -4, 32, 38, 18), PAL.toastS, { boil: .3 });
      for (let i = 0; i < 7; i++) dot(-34 + hash(i + 1) * 68, -56 + hash(i + 7) * 96, 2.6, '#b8722f');
    }
  });
  pop();
}
// the device's glow (only the rocket toaster uses this colour): a flame pointing along +y of the local frame
export function thrust(x, y, s, a, t, k = 1) {
  push(); translate(x, y); rotate(a); scale(s);
  const L = (130 + 34 * Math.sin(t * 61) + 18 * Math.sin(t * 37)) * k;
  fillOnly(ell(0, L * .5, 92 * k, L * .82, 24), 'rgba(127,246,255,.16)', { boil: .6 });
  fillOnly(ell(0, L * .42, 66 * k, L * .58, 24), 'rgba(127,246,255,.22)', { boil: .6 });
  shape(spline([[-38, 0], [38, 0], [22, L * .5], [0, L], [-22, L * .5]]), { fill: PAL.glow, lw: 6 });
  fillOnly(spline([[-17, 4], [17, 4], [9, L * .38], [0, L * .58], [-9, L * .38]]), PAL.glowW, { boil: .3 });
  pop();
}
export function puff(x, y, r, a = 1, seed = 0) {
  const pts = []; for (let i = 0; i < 9; i++) { const ang = i / 9 * TAU; const k = 1 + .18 * (hash(seed * 7 + i) - .5) * 2 + .12 * (i % 2); pts.push([x + Math.cos(ang) * r * k, y + Math.sin(ang) * r * k * .85]); }
  shape(spline(pts), { fill: '#efeaf6', lw: 5, alpha: a, shade: () => fillOnly(ell(x + r * .35, y + r * .3, r * .55, r * .4, 14), '#d6cfe4', { boil: .3 }) });
}
export function star4(x, y, r, col = '#ffe066', lw = 5) {
  shape([[x, y - r], [x + r * .26, y - r * .26], [x + r, y], [x + r * .26, y + r * .26], [x, y + r], [x - r * .26, y + r * .26], [x - r, y], [x - r * .26, y - r * .26]], { fill: col, lw });
}

// —— rocket toaster: y = counter top. o: {dial (rad), lever 0..1, jit [x,y], armed, glow 0..1, bread 0..1 (slice in slot), t}
export function toaster(x, y, o = {}) {
  const j = o.jit || [0, 0], t = o.t || 0;
  push(); translate(x + j[0], y + j[1]);
  if (o.glow > 0) {   // device glow building in the slot: flat translucent rings
    const gk = o.glow;
    fillOnly(ell(0, -205, 150 * gk + 30, 46 * gk + 10, 30), `rgba(127,246,255,${.24 * gk})`, { boil: .6 });
    fillOnly(ell(0, -205, 100 * gk + 20, 28 * gk + 6, 30), `rgba(127,246,255,${.42 * gk})`, { boil: .6 });
  }
  if (o.bread > 0) toast(0, -196 - 40 * o.bread, .8, 0);
  shape(rr(-110, -14, 50, 18, 6), { fill: INK, lw: 4 }); shape(rr(60, -14, 50, 18, 6), { fill: INK, lw: 4 });
  shape(rr(116, -160, 26, 128, 9), { fill: PAL.chromeS, lw: 6 });                                   // lever track
  shape(rr(-138, -196, 276, 188, 56), {
    fill: PAL.chrome, lw: 8, shade: () => {
      fillOnly(rect(62, -210, 110, 220), PAL.chromeS, { boil: .3 });
      fillOnly(rect(-112, -176, 20, 150), PAL.chromeL, { boil: .3 });
      fillOnly(rect(-150, -58, 300, 22), PAL.bot, { boil: .3 });
    }
  });
  stroke([[-92, -196], [92, -196]], 9, { line: '#3a2a30' });                                         // slot
  push(); translate(-50, -112);                                                                       // dial
  shape(ell(0, 0, 34, 34, 24), { fill: PAL.cream, lw: 6 });
  rotate(o.dial ?? -1.75); stroke([[0, 0], [0, -26]], 6, { line: PAL.red }); dot(0, 0, 5);
  pop();
  const blink = o.armed && Math.floor(t * 8) % 2 === 0;
  shape(ell(34, -116, 12, 12, 12), { fill: o.armed ? (blink ? '#ff8a7a' : PAL.red) : '#8a5050', lw: 5 });
  shape(rr(124, -150 + (o.lever || 0) * 92, 56, 30, 12), { fill: PAL.red, lw: 6 });                  // lever knob
  pop();
}

// —— the one-eyed pot plant (non-verbal creature) ——
export function plant(x, y, t, o = {}) {
  push(); translate(x, y);
  shape([[-50, -90], [50, -90], [38, 0], [-38, 0]], { fill: PAL.wains, lw: 6, shade: () => fillOnly(rect(15, -100, 50, 110), PAL.wainsS, { boil: .3 }) });
  shape(rr(-58, -104, 116, 24, 8), { fill: PAL.wains, lw: 6 });
  const sq = 1 + .035 * Math.sin(t * 3.3) + (o.jump || 0);
  push(); translate(0, -100); scale(1 / Math.sqrt(sq), sq);
  shape(noodle([30, -96], [70, -150], -12, 20, 8), { fill: PAL.plant, lw: 5 });
  shape(spline([[-48, 0], [-56, -60], [-30, -118], [10, -130], [46, -100], [54, -40], [44, 0]]), {
    fill: PAL.plant, lw: 6, shade: () => { fillOnly(ell(32, -60, 24, 60, 16), PAL.plantS, { boil: .3 }); dot(-22, -34, 4, PAL.plantS); dot(12, -20, 3, PAL.plantS); }
  });
  eye(-2, -74, 26, 29, { look: o.look || [0, 0], lid: o.lid ?? .12, pupil: 5, skin: PAL.plant, lw: 5 });
  shape(spline([[24, -22], [34, -22], [33, -8], [29, 6], [25, -8]]), { fill: '#e2f7c4', lw: 4 });
  pop(); pop();
}

// —— ROBOT ROOMMATE ——  origin at the feet, y up is negative. Frontal, boxy.
// P: {x,y,s,sq,bob,lean, look,lid,blink,happy,brow,browTilt,pupil, mouth:{o,w,sm,skew}, headTilt, hatTilt, antW, bulb,
//     armL/armR: {h:[dx,dy], bend, front, fist}, holdL:'bread', plate:{x,y} (local, held with both hands), disp, dispOn, lit, sweat, t}
export function robot(P) {
  const t = P.t || 0;
  push(); translate(P.x, P.y + (P.bob || 0)); scale(P.s ?? 1, (P.s ?? 1) * (P.sq ?? 1)); rotate(P.lean || 0);
  for (const sx of [-1, 1]) {                                            // legs + boots (mostly behind the counter)
    const a = [sx * 64, -340], b = [sx * 70, -70];
    shape(noodle(a, b, 0, 58, 52), { fill: PAL.steel, lw: 7 }); ribs(a, b, 0, 58, 4);
    shape(rr(sx * 70 - 64, -76, 128, 76, 28), { fill: PAL.steelS, lw: 7 });
  }
  const SHY = -646;
  const arm = (sx, A, hold) => {
    const sh = [sx * 146, SHY], hp = [sh[0] + A.h[0], sh[1] + A.h[1]];
    shape(noodle(sh, hp, A.bend ?? 0, 42, 36), { fill: PAL.steel, lw: 7 }); ribs(sh, hp, A.bend ?? 0, 42, 4);
    const ang = Math.atan2(hp[1] - sh[1], hp[0] - sh[0]);
    if (hold === 'bread') toast(hp[0] + Math.cos(ang) * 30, hp[1] - 66, .62, (A.ba || 0));
    hand(hp[0], hp[1], ang, 27, PAL.steelL, { fist: !!(A.fist || hold), lw: 6 });
  };
  const armL = P.armL || { h: [-30, 226], bend: -20 }, armR = P.armR || { h: [30, 226], bend: 20 };
  if (!armL.front) arm(-1, armL, P.holdL);
  if (!armR.front) arm(1, armR, P.holdR);
  // torso = a microwave oven
  shape(rr(-152, -700, 304, 370, 36), {
    fill: PAL.bot, lw: 8, shade: () => {
      fillOnly(rect(84, -720, 120, 420), PAL.botS, { boil: .3 });
      fillOnly(rect(-134, -676, 16, 300), PAL.botL, { boil: .3 });
    }
  });
  shape(rr(-114, -684, 228, 54, 12), {                                  // display strip
    fill: PAL.glass, lw: 6, shade: () => {
      const on = P.dispOn ?? true;
      if (on) text(P.disp || '07:30', 0, -655, { font: '400 50px VT323', fill: P.dispCol || PAL.amber });
    }
  });
  shape(rr(-122, -612, 170, 222, 18), { fill: PAL.cream, lw: 7, shade: () => fillOnly(rect(22, -620, 40, 240), PAL.creamS, { boil: .3 }) });
  shape(rr(-106, -596, 138, 152, 14), {
    fill: P.lit ? '#ffe39a' : PAL.glass, lw: 6, shade: () => {
      fillOnly([[-112, -500], [-62, -600], [-34, -600], [-84, -500]], P.lit ? '#fff4cf' : '#41636f', { boil: .3 });
      shape(ell(-37, -462, 52, 11, 22), { fill: PAL.cream, lw: 5 });
    }
  });
  shape(rr(50, -588, 14, 150, 6), { fill: PAL.steelL, lw: 5 });          // door handle
  for (const [ky, a] of [[-574, P.knob ?? .5], [-504, 1.3]]) { push(); translate(106, ky); rotate(a); shape(ell(0, 0, 24, 24, 20), { fill: PAL.steelL, lw: 6 }); stroke([[0, 0], [0, -17]], 5); pop(); }
  for (let k = 0; k < 3; k++) stroke([[82, -440 + k * 16], [130, -440 + k * 16]], 4);
  for (let k = 0; k < 3; k++) shape(ell(0, -712 - k * 15, 50 - k * 4, 12, 20), { fill: PAL.steelS, lw: 6 });   // accordion neck
  // head
  push(); translate(0, -860); rotate(P.headTilt || 0);
  for (const sx of [-1, 1]) shape(ell(sx * 140, 4, 19, 36, 18), { fill: PAL.steel, lw: 6, shade: () => fillOnly(ell(sx * 140 + 8, 10, 8, 22, 12), PAL.steelS, { boil: .3 }) });
  shape(rr(-132, -116, 264, 232, 40), {
    fill: PAL.bot, lw: 8, shade: () => {
      fillOnly(rect(74, -140, 100, 290), PAL.botS, { boil: .3 });
      fillOnly(ell(-88, 52, 22, 13, 14), '#f58c74', { boil: .3 }); fillOnly(ell(76, 52, 20, 12, 14), '#cf5a44', { boil: .3 });
    }
  });
  for (const [rx, ry] of [[-110, -94], [110, -94], [-110, 94], [110, 94]]) dot(rx, ry, 5);
  const lk = P.look || [0, 0], lid = P.blink ? 1 : (P.lid ?? .1);
  if (P.happy) for (const ex of [-46, 46]) stroke(arc(ex, -6, 34, 26, Math.PI * 1.1, Math.PI * 1.9, 12), 8);
  else for (const ex of [-46, 46]) eye(ex, -14, 46, 54, { lid, look: lk, pupil: P.pupil ?? 6.5, skin: PAL.bot, lw: 7, lower: P.lower || 0 });
  const br = P.brow ?? 0, bt = P.browTilt ?? 0;
  for (const sx of [-1, 1]) { push(); translate(sx * 48, -86 - br * 10); rotate(sx * bt); shape(rr(-30, -8, 60, 16, 7), { fill: PAL.steelS, lw: 5 }); pop(); }
  const m = P.mouth || {};
  mouth(0, 70, 96, { o: m.o || 0, w: m.w ?? 1, sm: m.sm ?? .5, skew: m.skew || 0, lw: 7, teeth: true, tongue: false });
  push(); translate(-22, -112); rotate(P.hatTilt ?? -.1);                                   // chef's toque
  shape(spline([[-92, 4], [-122, -42], [-100, -102], [-50, -124], [0, -130], [52, -116], [94, -80], [98, -30], [80, 4]]), { fill: '#fffaf0', lw: 7, shade: () => fillOnly(ell(74, -60, 46, 80, 20), '#eadfca', { boil: .3 }) });
  stroke([[-40, -36], [-32, -88]], 4); stroke([[22, -36], [28, -94]], 4);
  shape(rr(-90, -12, 174, 46, 10), { fill: '#fffaf0', lw: 7, shade: () => fillOnly(rect(52, -20, 60, 70), '#eadfca', { boil: .3 }) });
  pop();
  const aw = P.antW || 0;                                                                    // antenna poking through the hat
  stroke(quad([24, -236], [24 + aw * .3, -276], [24 + aw, -318], 10), 6);
  shape(ell(24 + aw, -330, 15, 15, 14), { fill: P.bulb ? '#ff6a5a' : PAL.amber, lw: 5 });
  pop();
  if (P.plate) {   // both hands hold the plate's rim, the plate sits between the palms
    const [px, py] = P.plate;
    if (armL.front) { const sh = [-146, SHY], hp = [sh[0] + armL.h[0], sh[1] + armL.h[1]]; shape(noodle(sh, hp, armL.bend ?? 0, 42, 36), { fill: PAL.steel, lw: 7 }); ribs(sh, hp, armL.bend ?? 0, 42, 4); }
    if (armR.front) { const sh = [146, SHY], hp = [sh[0] + armR.h[0], sh[1] + armR.h[1]]; shape(noodle(sh, hp, armR.bend ?? 0, 42, 36), { fill: PAL.steel, lw: 7 }); ribs(sh, hp, armR.bend ?? 0, 42, 4); }
    plate(px, py, 1.05, true);
    if (armL.front) { const hp = [-146 + armL.h[0], SHY + armL.h[1]]; hand(hp[0], hp[1], -.3, 27, PAL.steelL, { fist: true, lw: 6 }); }
    if (armR.front) { const hp = [146 + armR.h[0], SHY + armR.h[1]]; push(); scale(-1, 1); hand(-hp[0], hp[1], -.3, 27, PAL.steelL, { fist: true, lw: 6 }); pop(); }
  } else {
    if (armL.front) arm(-1, armL, P.holdL);
    if (armR.front) arm(1, armR, P.holdR);
  }
  if (P.sweat != null) sweat(150, -1040 + (P.sweat % 1) * 30, 1.3);
  pop();
}

// —— HUMAN ROOMMATE (seated) ——  origin at the hips, y up is negative.
// P: {x,y,s,sq, look,lid,blink,brow, mouth, headTilt, armL, armR, t}
function utensil(kind) {
  if (kind === 'fork') {
    shape(rr(-8, -40, 16, 122, 7), { fill: PAL.silver, lw: 5 });
    shape(spline([[-24, -38], [24, -38], [26, -78], [-26, -78]]), { fill: PAL.silver, lw: 5 });
    for (const fx of [-20, -7, 7, 20]) shape(rr(fx - 4, -142, 8, 70, 4), { fill: PAL.silver, lw: 4 });
  } else {
    shape(rr(-9, -30, 18, 112, 7), { fill: PAL.silver, lw: 5 });
    shape(spline([[-12, -28], [-12, -150], [6, -176], [16, -150], [14, -28]]), { fill: PAL.silver, lw: 5, shade: () => fillOnly(rect(4, -190, 20, 170), '#c3cbd6', { boil: .3 }) });
  }
}
export function human(P) {
  push(); translate(P.x, P.y); scale(P.s ?? 1, (P.s ?? 1) * (P.sq ?? 1));
  const HT = P.headTilt || 0;
  push(); translate(0, -400); rotate(HT);                                              // hair cloud (behind)
  const hc = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; const r = 168 + (i % 2 ? 16 : -6); hc.push([Math.cos(a) * r * 1.04, -66 + Math.sin(a) * r * .93]); }
  shape(spline(hc), { fill: PAL.hair, lw: 7, shade: () => fillOnly(ell(86, -40, 96, 150, 24), PAL.hairS, { boil: .3 }) });
  pop();
  shape(spline([[-126, 60], [-132, -140], [-114, -238], [-56, -270], [56, -270], [114, -238], [132, -140], [126, 60]]), {
    fill: PAL.pj, lw: 7, shade: () => fillOnly(spline([[60, -284], [146, -240], [154, 70], [74, 70], [92, -150]]), PAL.pjS, { boil: .3 })
  });
  shape(noodle([0, -240], [0, -312], 0, 54, 52), { fill: PAL.skin, lw: 6 });
  shape([[-60, -268], [-8, -252], [-30, -214], [-82, -236]], { fill: PAL.pjS, lw: 6 });   // 60s collar
  shape([[60, -268], [8, -252], [30, -214], [82, -236]], { fill: PAL.pjS, lw: 6 });
  shape(spline([[-46, -254], [46, -254], [96, -104], [0, -78], [-96, -104]]), {           // napkin bib
    fill: PAL.bib, lw: 6, shade: () => { for (let k = 0; k < 3; k++) fillOnly(rect(-130, -196 + k * 38, 260, 9), '#ff9ab5', { boil: .3 }); }
  });
  shape([[-6, -258], [-44, -292], [-30, -246]], { fill: PAL.bib, lw: 5 }); shape([[6, -258], [44, -292], [30, -246]], { fill: PAL.bib, lw: 5 });
  push(); translate(0, -400); rotate(HT);                                              // head
  for (const sx of [-1, 1]) { shape(ell(sx * 97, 2, 15, 22, 14), { fill: PAL.skin, lw: 6 }); shape(ell(sx * 99, 38, 11, 14, 16), { lw: 4, line: '#d99a1c' }); }
  shape(spline([[0, -112], [70, -100], [98, -40], [96, 30], [72, 92], [26, 120], [-26, 120], [-72, 92], [-96, 30], [-98, -40], [-70, -100]]), {
    fill: PAL.skin, lw: 7, shade: () => fillOnly(spline([[40, -130], [124, -60], [124, 150], [30, 150], [72, 20]]), PAL.skinS, { boil: .3 })
  });
  const lk = P.look || [0, 0], lid = P.blink ? 1 : (P.lid ?? .56);
  for (const ex of [-37, 37]) eye(ex, -8, 37, 43, { lid, look: lk, pupil: P.pupil ?? 5, skin: PAL.skin, lw: 6 });
  for (const ex of [-37, 37]) { stroke(arc(ex, 40, 27, 9, Math.PI * .15, Math.PI * .85, 10), 4); stroke(arc(ex + 2, 49, 18, 7, Math.PI * .25, Math.PI * .75, 8), 3.5); }
  const br = P.brow ?? 0;
  stroke([[-70, -66 - br * 6], [-14, -64 - br * 9]], 10, { line: PAL.hair }); stroke([[14, -64 - br * 9], [70, -66 - br * 6]], 10, { line: PAL.hair });
  stroke(quad([6, 10], [22, 40], [2, 52], 8), 5);
  const m = P.mouth || {};
  mouth(0, 82, 54, { o: m.o || 0, w: m.w ?? 1, sm: m.sm ?? -.12, skew: m.skew || 0, lw: 6, teeth: false });
  shape(spline([[-106, -36], [-102, -108], [-44, -150], [40, -152], [100, -112], [106, -36], [74, -86], [22, -104], [-30, -100], [-82, -72]]), { fill: PAL.hair, lw: 7 });
  push(); translate(0, -132); rotate(-.06);                                            // sleep mask pushed up into the hair
  shape(rr(-106, -27, 212, 54, 24), { fill: PAL.mask, lw: 6, shade: () => fillOnly(rect(46, -40, 80, 80), PAL.maskS, { boil: .3 }) });
  for (const ex of [-46, 46]) { stroke(arc(ex, -6, 24, 13, Math.PI * .1, Math.PI * .9, 10), 4); for (let k = -1; k <= 1; k++) stroke([[ex + k * 12, 8], [ex + k * 15, 17]], 3); }
  pop();
  pop();
  const arm = (sx, A, tool) => {
    const sh = [sx * 112, -234], hp = [sh[0] + A.h[0], sh[1] + A.h[1]];
    shape(noodle(sh, hp, A.bend ?? 0, 48, 40), { fill: PAL.pj, lw: 7 });
    if (tool) { push(); translate(hp[0], hp[1] - 6); rotate(A.ta || 0); utensil(tool); pop(); }
    hand(hp[0], hp[1], -Math.PI / 2 + (A.ta || 0), 22, PAL.skin, { fist: true, lw: 6 });
  };
  arm(-1, P.armL || { h: [10, 100], bend: -34 }, 'fork');
  arm(1, P.armR || { h: [-10, 100], bend: 34 }, 'knife');
  pop();
}
