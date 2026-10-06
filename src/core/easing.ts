import type { Easing, EasingPreset } from "./schema/primitives";

/**
 * Easing functions that work everywhere (browser, renderer, server) without
 * depending on `remotion`. Spring easings are normalised to the segment
 * length: t=0 is the start, t=1 is the moment the spring has settled.
 */

export type EasingFn = (t: number) => number;

// --- cubic bezier (same algorithm as WebKit/Remotion) ----------------------

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;
const SPLINE_TABLE_SIZE = 11;
const SAMPLE_STEP = 1 / (SPLINE_TABLE_SIZE - 1);

const A = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
const B = (a1: number, a2: number) => 3 * a2 - 6 * a1;
const C = (a1: number) => 3 * a1;
const calcBezier = (t: number, a1: number, a2: number) => ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
const getSlope = (t: number, a1: number, a2: number) => 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);

export const cubicBezier = (x1: number, y1: number, x2: number, y2: number): EasingFn => {
  if (x1 === y1 && x2 === y2) return (t) => t;
  const samples = new Float32Array(SPLINE_TABLE_SIZE);
  for (let i = 0; i < SPLINE_TABLE_SIZE; i++) samples[i] = calcBezier(i * SAMPLE_STEP, x1, x2);

  const getTForX = (x: number) => {
    let intervalStart = 0;
    let current = 1;
    const last = SPLINE_TABLE_SIZE - 1;
    for (; current !== last && samples[current] <= x; current++) intervalStart += SAMPLE_STEP;
    current--;
    const dist = (x - samples[current]) / (samples[current + 1] - samples[current]);
    let guess = intervalStart + dist * SAMPLE_STEP;
    const slope = getSlope(guess, x1, x2);
    if (slope >= NEWTON_MIN_SLOPE) {
      for (let i = 0; i < NEWTON_ITERATIONS; i++) {
        const s = getSlope(guess, x1, x2);
        if (s === 0) return guess;
        guess -= (calcBezier(guess, x1, x2) - x) / s;
      }
      return guess;
    }
    if (slope === 0) return guess;
    let a = intervalStart;
    let b = intervalStart + SAMPLE_STEP;
    let currentX: number;
    let currentT: number;
    let i = 0;
    do {
      currentT = a + (b - a) / 2;
      currentX = calcBezier(currentT, x1, x2) - x;
      if (currentX > 0) b = currentT;
      else a = currentT;
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
  };

  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return calcBezier(getTForX(t), y1, y2);
  };
};

// --- springs ----------------------------------------------------------------

export type SpringConfig = { damping: number; stiffness?: number; mass?: number };

/** Closed-form damped harmonic oscillator from 0 to 1, time in seconds. */
const springPosition = (t: number, damping: number, stiffness: number, mass: number) => {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) {
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - s);
  const r2 = -w0 * (zeta + s);
  return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2);
};

const springCache = new Map<string, EasingFn>();

export const springEasing = ({ damping, stiffness = 100, mass = 1 }: SpringConfig): EasingFn => {
  const key = `${damping}|${stiffness}|${mass}`;
  const cached = springCache.get(key);
  if (cached) return cached;
  // Find the settle time: the last moment the spring is noticeably away from 1.
  const dt = 1 / 240;
  const maxT = 20;
  let settle = maxT;
  let lastOff = 0;
  for (let t = 0; t <= maxT; t += dt) {
    if (Math.abs(1 - springPosition(t, damping, stiffness, mass)) > 0.002) lastOff = t;
    else if (t - lastOff > 0.25) {
      settle = lastOff + dt;
      break;
    }
  }
  const fn: EasingFn = (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return springPosition(t * settle, damping, stiffness, mass);
  };
  springCache.set(key, fn);
  return fn;
};

// --- presets -----------------------------------------------------------------

const PRESET_DEFS: Record<EasingPreset, Easing> = {
  linear: { type: "bezier", x1: 0, y1: 0, x2: 1, y2: 1 },
  ease: { type: "bezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  "ease-in": { type: "bezier", x1: 0.42, y1: 0, x2: 1, y2: 1 },
  "ease-out": { type: "bezier", x1: 0, y1: 0, x2: 0.58, y2: 1 },
  "ease-in-out": { type: "bezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  smooth: { type: "bezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
  snappy: { type: "spring", damping: 22, stiffness: 260, mass: 0.7 },
  gentle: { type: "spring", damping: 200, stiffness: 100, mass: 1 },
  bouncy: { type: "spring", damping: 8, stiffness: 120, mass: 1 },
  playful: { type: "spring", damping: 12, stiffness: 160, mass: 1 },
  heavy: { type: "spring", damping: 26, stiffness: 120, mass: 3 },
  apple: { type: "bezier", x1: 0.32, y1: 0.72, x2: 0, y2: 1 },
  anticipate: { type: "bezier", x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 },
  overshoot: { type: "bezier", x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
  hold: { type: "bezier", x1: 0, y1: 0, x2: 1, y2: 1 }, // handled specially
};

export const EASING_LABELS: Record<EasingPreset, string> = {
  linear: "Linear",
  ease: "Ease",
  "ease-in": "Ease in",
  "ease-out": "Ease out",
  "ease-in-out": "Ease in-out",
  smooth: "Smooth (expo out)",
  snappy: "Snappy spring",
  gentle: "Gentle spring",
  bouncy: "Bouncy spring",
  playful: "Playful spring",
  heavy: "Heavy spring",
  apple: "Apple",
  anticipate: "Anticipate",
  overshoot: "Overshoot",
  hold: "Hold",
};

const fnCache = new Map<string, EasingFn>();

export const resolveEasing = (easing: Easing | undefined, fallback: EasingPreset = "smooth"): EasingFn => {
  const value = easing ?? fallback;
  if (value === "hold") return (t) => (t >= 1 ? 1 : 0);
  if (value === "linear") return (t) => t;
  const key = typeof value === "string" ? value : JSON.stringify(value);
  const cached = fnCache.get(key);
  if (cached) return cached;
  const def = typeof value === "string" ? PRESET_DEFS[value] : value;
  const fn =
    def === undefined
      ? (t: number) => t
      : typeof def === "string"
        ? resolveEasing(def)
        : def.type === "bezier"
          ? cubicBezier(def.x1, def.y1, def.x2, def.y2)
          : springEasing(def);
  fnCache.set(key, fn);
  return fn;
};

/** Samples an easing for drawing curve previews in the UI. */
export const sampleEasing = (easing: Easing | undefined, samples = 48): number[] => {
  const fn = resolveEasing(easing);
  return Array.from({ length: samples + 1 }, (_, i) => fn(i / samples));
};
