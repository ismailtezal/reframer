// clock.js — the grinning alarm clock: dial face, two bells for a hat, little legs and shoes.
// Extended from the clock in LemoLab's rubber-hose demo cast.js (MIT): squash/stretch and lean, brows, hammer swing,
// vibration lines while it rings, bigger face for a vertical frame.
import * as T from './demo/toon.js';
import { P, pieEye, brow, mouth, shoe, hose } from './demo/chars.js';
import { TAU } from './core/lib.js';
const { shape, stroke, ell, arc, push, pop, translate, rotate, scale, S } = T;

// o: { t (on twos), ring 0..1, sx, sy, lean, eyes:{type,lx,ly}, mouth, brows }
export function alarmClock(x, y, k, o = {}) {
  const t = o.t || 0, ring = o.ring || 0;
  push(); translate(x, y); rotate(o.lean || 0); scale(k * (o.sx || 1), k * (o.sy || 1));
  const jit = ring ? Math.sin(t * 120) * 5 * ring : 0;
  translate(jit, -Math.abs(Math.sin(t * 30)) * 14 * ring); rotate(jit * .012);
  shoe(-40, 0, -1, .62); shoe(40, 0, 1, .62);
  hose([-26, -26], [-40, -8], 3, 9); hose([26, -26], [40, -8], -3, 9);
  // bells + hammer
  for (const s of [-1, 1]) {
    push(); translate(s * 52, -146); rotate(s * (.5 + (ring ? Math.sin(t * 90 + s) * .2 : 0)));
    shape(arc(0, 10, 35, 35, Math.PI, TAU, 18), { fill: P.dmid, shade: () => shape(ell(-14, -6, 7, 14, 12), { fill: P.light, stroke: false, boil: 0 }) });
    shape(ell(0, -27, 6, 6), { fill: P.dark }); pop();
  }
  push(); translate(0, -152); rotate(ring ? Math.sin(t * 90) * .55 : 0); stroke([[0, 0], [0, -28]], S.lw * 1.3); shape(ell(0, -33, 8, 8), { fill: P.dark }); pop();
  if (ring > .3) {   // vibration lines around the bells, alternating every drawing
    const ph = Math.floor(t * 15 + 1e-6) % 2 ? .12 : -.12;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + s * (.45 + i * .42) + ph, r = 74 + i * 6;
      stroke(arc(s * 46, -150, r, r, a - .16, a + .16, 6), S.lw * .75);
    }
  }
  // body + dial
  shape(ell(0, -86, 74, 74, 48), { fill: P.dmid, shade: () => shape(ell(44, -80, 34, 80, 24), { fill: P.dark, stroke: false, boil: 0 }) });
  shape(ell(0, -86, 60, 60, 44), {
    fill: P.white, shade: () => {
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; stroke([[Math.cos(a) * 51, -86 + Math.sin(a) * 51], [Math.cos(a) * 57, -86 + Math.sin(a) * 57]], S.lw * (i % 3 ? .5 : .9), { boil: .3 }); }
      shape(ell(34, -80, 22, 52, 20), { fill: P.pale, stroke: false, boil: 0 });
    }
  });
  const E = o.eyes || {};
  pieEye(-18, -104, 13, 19, { lwk: .7, ...E, side: 1 }); pieEye(18, -104, 13, 19, { lwk: .7, ...E, side: -1 });
  if (o.brows) { brow(-18, -131, 20, o.brows, -1); brow(18, -131, 20, o.brows, 1); }
  // hands at seven o'clock make a moustache
  const hA = (7 / 12) * TAU - Math.PI / 2;
  stroke([[0, -80], [Math.cos(hA) * 30, -80 + Math.sin(hA) * 30]], S.lw * 1.1); stroke([[0, -80], [0, -80 - 42]], S.lw * .7);
  shape(ell(0, -80, 5, 5), { fill: P.ink });
  mouth(4, -58, 34, o.mouth || 'smile', { open: .7 });
  pop();
}
