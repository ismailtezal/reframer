// Timeline: the single source of truth for camera, focus, lights, tape events and the VO placement (film seconds).
// Coordinates in metres: x east, z south; yaw 0 = facing north (−z), +π/2 = west, −π/2 = east.
import { track, monotone } from './core/lib.js';
import { IN } from './inputs.js';

const PI = Math.PI;
export const DUR = 15.0;
export const T = {
  vcrBlue: 0.45,              // VCR blue screen until the tape picture rolls in
  rollIn: 0.45,
  play: [0.0, 2.8],           // VCR "PLAY ▶" OSD
  title: [0.85, 3.9],         // camcorder title generator
  vo: [3.3, 5.55, 10.14],     // where the three VO segments start (see audio/build_vo.mjs)
  ding: 7.25, hush: [7.25, 7.65], whip: [7.65, 7.95],
  approach: [8.05, 9.75], zoom: [8.95, 10.0], lock: 10.0,
  flick: [12.85, 13.15, 13.45], dark: 13.55,
  tear: [13.9, 14.15], snow: 14.05,
};

export const POS = track([
  [0, [0.36, 1.32]], [2.4, [0.32, 1.22]], [3.9, [0.30, 1.15]], [4.4, [0.29, 0.95]],
  [7.05, [0.25, -2.45]], [7.3, [0.25, -2.58]], [8.05, [0.25, -2.6]],
  [8.9, [0.62, -3.97]], [9.75, [1.08, -5.2]], [10.3, [1.14, -5.28]], [15, [1.2, -5.28]],
]);
export const YAW = monotone([
  [0, -2.24], [2.5, -2.2], [3.3, -1.75], [3.9, -1.45], [4.3, -1.2], [5.0, -0.08], [7.25, 0.0], [7.65, 0.0],
  [7.88, -0.86], [8.05, -0.74], [8.9, -1.05], [9.75, -PI / 2], [15, -PI / 2],
]);
export const PITCH = monotone([
  [0, -0.2], [2.5, -0.18], [3.6, -0.05], [5.0, 0.03], [7.25, 0.01], [7.9, -0.04], [9.0, -0.1], [9.75, -0.01], [15, -0.01],
]);
export const CAMH = monotone([[0, 0], [8.6, 0], [9.75, -0.48], [15, -0.48]]);       // crouch: lens level with the screen
export const VFOV = monotone([[0, 64], [8.95, 64], [10.0, 17.5], [15, 17.5]]);     // vertical field of view (degrees)
export const FOCUS = monotone([
  [0, 0.3], [0.55, 0.35], [0.95, 3.2], [1.15, 1.6], [1.3, 2.0], [2.5, 1.95], [3.6, 4.5], [5.0, 7.0], [7.25, 7.0],
  [7.95, 3.2], [8.3, 3.0], [9.1, 2.0], [9.45, 0.45], [9.7, 4.5], [9.85, 1.2], [10.0, 1.45], [10.12, 1.15], [10.3, 1.45], [15, 1.45],
]);
export const APER = monotone([[0, 3.0], [8.95, 3.0], [10.0, 9.0], [15, 9.0]]);
export const FEAR = monotone([[0, .15], [7.2, .2], [7.3, .8], [8.0, .55], [10.0, .4], [12.8, .5], [13.0, 1.0], [15, 1.0]]);
// the empty chair still turning by itself, slowing down
export const swivel = t => 0.55 + 1.35 * (1 - Math.exp(-(t + 0.6) / 2.2));
// camcorder clock: 03:14:07 at roll-in, ticking
export function clock(t) { const s = 7 + Math.max(0, Math.floor(t - T.rollIn)); return `${IN.clock}:${String(s).padStart(2, '0')}`; }
