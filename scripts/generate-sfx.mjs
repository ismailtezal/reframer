/**
 * Synthesizes Reframer's built-in sound-effects library into `public/sfx/<id>.wav`.
 *
 * Every sound is built from scratch in plain JavaScript (oscillators, filtered noise,
 * envelopes, one-pole and state-variable filters, waveshaping), so the repo ships no
 * recorded or third-party audio. Output is 16-bit PCM, mono, 48 kHz, peak-normalized to
 * -1 dBFS with 2 ms fades at both edges.
 *
 * License: the generated sounds are dedicated to the public domain under CC0 1.0
 * (https://creativecommons.org/publicdomain/zero/1.0/).
 *
 * Deterministic: all randomness comes from a PRNG seeded with the sound's id, so re-running
 * writes byte-identical files, and adding or editing one sound never changes another.
 *
 * Usage:
 *   node scripts/generate-sfx.mjs            # every sound
 *   node scripts/generate-sfx.mjs pop ding   # only these ids
 *
 * The catalog (names, tags, descriptions, measured durations) lives in `src/core/sfx.ts`.
 * If you change a sound's length here, update its `durationSec` there.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 48_000;
const TARGET_PEAK_DBFS = -1;
const EDGE_FADE_SEC = 0.002;
const OUT_DIR = fileURLToPath(new URL("../public/sfx/", import.meta.url));
const TAU = 2 * Math.PI;

// --- Math & units ------------------------------------------------------------

const clamp = (x, min = 0, max = 1) => Math.min(max, Math.max(min, x));
const lerp = (a, b, t) => a + (b - a) * t;
/** Progress (0..1, clamped) of `t` through the span [start, end]. */
const progress = (t, start, end) => clamp((t - start) / (end - start));
/** Ease-in-out S-curve on 0..1. */
const smoothstep = (x) => x * x * (3 - 2 * x);
/** Constant-ratio interpolation: the natural curve for pitch and cutoff sweeps. */
const glide = (from, to, t) => from * (to / from) ** clamp(t);
const dbToGain = (db) => 10 ** (db / 20);
const cents = (c) => 2 ** (c / 1200);
const semitones = (s) => 2 ** (s / 12);
/** Equal-tempered frequency of a MIDI note number (69 = A4 = 440 Hz). */
const midiHz = (note) => 440 * semitones(note - 69);
const sampleCount = (sec) => Math.round(sec * SAMPLE_RATE);

// --- Deterministic randomness ------------------------------------------------

/** FNV-1a hash: turns a sound id into a 32-bit seed. */
function seedFrom(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG plus helpers. Every random choice in this file goes through one. */
function createRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    range: (min, max) => lerp(min, max, next()),
    /** White-noise sample in [-1, 1). */
    noise: () => 2 * next() - 1,
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

// --- Buffers -----------------------------------------------------------------

const createBuffer = (sec) => new Float64Array(sampleCount(sec));

/** Renders `fn(t)` (t in seconds) into a new buffer, called once per sample, in order. */
function render(durationSec, fn) {
  const out = createBuffer(durationSec);
  for (let i = 0; i < out.length; i++) out[i] = fn(i / SAMPLE_RATE);
  return out;
}

/** Replaces each sample with `fn(sample, t)`, in place. */
function mapSamples(buffer, fn) {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = fn(buffer[i], i / SAMPLE_RATE);
  }
  return buffer;
}

const peakOf = (buffer) => buffer.reduce((peak, x) => Math.max(peak, Math.abs(x)), 0);

/** Scales `buffer` in place so its peak is `peak`; silent buffers are left alone. */
function normalize(buffer, peak = 1) {
  const current = peakOf(buffer);
  return current > 0 ? mapSamples(buffer, (x) => (x * peak) / current) : buffer;
}

/** Adds `source * gain` into `target` from `atSec`; anything past the end is dropped. */
function mixInto(target, source, atSec = 0, gain = 1) {
  const offset = sampleCount(atSec);
  const count = Math.min(source.length, target.length - offset);
  for (let i = 0; i < count; i++) target[offset + i] += source[i] * gain;
  return target;
}

/**
 * Mixes layers into a new buffer. Each layer is `[buffer, gainDb = 0, atSec = 0]` and is
 * peak-normalized first, so a gain reads as "this layer peaks N dB below the loudest".
 */
function mix(durationSec, ...layers) {
  const out = createBuffer(durationSec);
  for (const [buffer, gainDb = 0, atSec = 0] of layers) {
    mixInto(out, normalize(buffer), atSec, dbToGain(gainDb));
  }
  return out;
}

/** Raised-cosine fade-in and fade-out over `sec` at both edges, in place. */
function fadeEdges(buffer, sec) {
  const count = Math.min(sampleCount(sec), Math.floor(buffer.length / 2));
  for (let i = 0; i < count; i++) {
    const gain = 0.5 - 0.5 * Math.cos((Math.PI * i) / count);
    buffer[i] *= gain;
    buffer[buffer.length - 1 - i] *= gain;
  }
  return buffer;
}

// --- Envelopes (t in seconds) ------------------------------------------------

/** Exponential decay that is 60 dB down after `t60` seconds (how ringing is specified). */
const decay = (t, t60) => (t < 0 ? 0 : Math.exp((-6.907755 * t) / t60));

/** Raised-cosine rise from 0 to 1 over the first `sec` seconds. */
function attack(t, sec) {
  if (t <= 0) return 0;
  if (t >= sec) return 1;
  return 0.5 - 0.5 * Math.cos((Math.PI * t) / sec);
}

/** Raised-cosine fall from 1 to 0 over the last `sec` seconds before `end`. */
const release = (t, end, sec) => 1 - attack(t - (end - sec), sec);

/**
 * Smooth rise-and-fall over normalized time x in [0, 1], peaking at `peakAt`. A higher
 * `sharpness` narrows the peak. Zero slope at both ends, so it never clicks.
 */
function swell(x, peakAt, sharpness = 2) {
  if (x <= 0 || x >= 1) return 0;
  const warp = Math.log(0.5) / Math.log(peakAt); // moves the sine's crest to `peakAt`
  return Math.sin(Math.PI * x ** warp) ** sharpness;
}

// --- Oscillators & noise -----------------------------------------------------

/** PolyBLEP correction: rounds off a waveform's jumps so saw and square don't alias. */
function polyBlep(phase, step) {
  if (phase < step) {
    const x = phase / step;
    return x + x - x * x - 1;
  }
  if (phase > 1 - step) {
    const x = (phase - 1) / step;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Waveforms over phase in [0, 1); `step` is the phase advance per sample. */
const WAVES = {
  sine: (p) => Math.sin(TAU * p),
  saw: (p, step) => 2 * p - 1 - polyBlep(p, step),
  square: (p, step) => (p < 0.5 ? 1 : -1) + polyBlep(p, step) - polyBlep((p + 0.5) % 1, step),
};

/**
 * Phase-accumulating oscillator: call it once per sample with the current frequency in
 * Hz. Integrating phase keeps glides and vibrato continuous, so pitch moves never click.
 */
function oscillator(wave = "sine", startPhase = 0) {
  const shape = WAVES[wave];
  let phase = startPhase;
  return (freq) => {
    const step = Math.abs(freq) / SAMPLE_RATE;
    const value = shape(phase, step);
    phase = (phase + step) % 1;
    return value;
  };
}

/** Slowly wandering random signal in [-1, 1]: cosine-interpolated values at `rateHz`. */
function smoothNoise(rng, rateHz) {
  let phase = 0;
  let from = rng.noise();
  let to = rng.noise();
  return () => {
    phase += rateHz / SAMPLE_RATE;
    if (phase >= 1) {
      phase -= 1;
      from = to;
      to = rng.noise();
    }
    return lerp(from, to, 0.5 - 0.5 * Math.cos(Math.PI * phase));
  };
}

// --- Filters -----------------------------------------------------------------

/** One-pole low-pass (6 dB/oct). Returns `(input, cutoffHz) => output`. */
function onePoleLowpass() {
  let y = 0;
  return (x, cutoff) => {
    y = x + Math.exp((-TAU * cutoff) / SAMPLE_RATE) * (y - x);
    return y;
  };
}

/** One-pole high-pass (6 dB/oct): the input minus its low-passed self. */
function onePoleHighpass() {
  const lowpass = onePoleLowpass();
  return (x, cutoff) => x - lowpass(x, cutoff);
}

/**
 * Two-pole state-variable filter (12 dB/oct, the same order as a biquad) in Simper's
 * trapezoidal form, which stays stable and zipper-free when the cutoff moves every
 * sample; the sweeps below depend on that. `mode` is "lowpass", "bandpass" (0 dB at the
 * center) or "highpass". Returns `(input, cutoffHz, q) => output`.
 */
function svf(mode) {
  let ic1 = 0;
  let ic2 = 0;
  return (x, cutoff, q = Math.SQRT1_2) => {
    const g = Math.tan((Math.PI * clamp(cutoff, 10, SAMPLE_RATE * 0.45)) / SAMPLE_RATE);
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    if (mode === "lowpass") return v2;
    if (mode === "bandpass") return k * v1;
    return x - k * v1 - v2;
  };
}

// --- Effects -----------------------------------------------------------------

/** tanh waveshaper: normalizes, then drives the peak into soft clipping (warmth, growl). */
function saturate(buffer, drive) {
  const ceiling = Math.tanh(drive);
  return mapSamples(normalize(buffer), (x) => Math.tanh(drive * x) / ceiling);
}

/** Rounds a sample to a `bits`-bit grid: the stair-step crunch of early digital audio. */
function bitcrush(x, bits) {
  const steps = 2 ** (bits - 1);
  return Math.round(x * steps) / steps;
}

/** Feedback echo with a low-pass in the loop, so each repeat is darker. Keeps the length. */
function echo(buffer, { delaySec, feedback, wet, dampHz = 6000 }) {
  const line = new Float64Array(sampleCount(delaySec));
  const damp = onePoleLowpass();
  let pos = 0;
  return buffer.map((dry) => {
    const delayed = line[pos];
    line[pos] = dry + feedback * damp(delayed, dampHz);
    pos = (pos + 1) % line.length;
    return dry + wet * delayed;
  });
}

// --- Building blocks shared by several sounds --------------------------------

/** A decaying burst of filtered noise: the snap or crack at the front of clicks and hits. */
function noiseBurst(rng, { durationSec, t60, cutoff, q = Math.SQRT1_2, mode = "bandpass" }) {
  const filter = svf(mode);
  const cutoffAt = typeof cutoff === "function" ? cutoff : () => cutoff;
  return render(durationSec, (t) => filter(rng.noise() * decay(t, t60), cutoffAt(t), q));
}

/**
 * Modal synthesis of a struck object: one exponentially decaying sine per resonant mode,
 * each `[frequencyHz, gain, t60]`. The sines start at zero, so onsets never click.
 */
function modes(durationSec, partials) {
  const audible = partials.filter(([freq]) => freq < SAMPLE_RATE * 0.45);
  return render(durationSec, (t) => {
    let sum = 0;
    for (const [freq, gain, t60] of audible) {
      sum += gain * decay(t, t60) * Math.sin(TAU * freq * t);
    }
    return sum;
  });
}

/** A mechanical click: a short noise snap plus the brief ringing of the part that was hit. */
function mechanicalClick(rng, options) {
  const { durationSec = 0.08, snapHz, snapQ = 1, snapT60 = 0.004, snapMode = "bandpass", partials, modesDb = -3 } = options;
  const snap = noiseBurst(rng, {
    durationSec,
    t60: snapT60,
    cutoff: snapHz,
    q: snapQ,
    mode: snapMode,
  });
  return mix(durationSec, [snap, 0], [modes(durationSec, partials), modesDb]);
}

/**
 * A struck bell, bar or chime at `freq`. Partials are `[ratio, gain, t60]`; each one is
 * paired with a twin detuned by `detuneCents`, so it beats slowly like a real (slightly
 * asymmetric) bell. A faint noise tick at `strikeHz` is the hammer or mallet.
 */
function bellTone(rng, freq, options) {
  const { durationSec, partials, detuneCents = 1.5, strikeDb = -20, strikeHz = 5000 } = options;
  const twin = cents(detuneCents);
  const ring = modes(
    durationSec,
    partials.flatMap(([ratio, gain, t60]) => [
      [freq * ratio, gain, t60],
      [freq * ratio * twin, gain * 0.5, t60],
    ]),
  );
  const strike = noiseBurst(rng, {
    durationSec: 0.03,
    t60: 0.006,
    cutoff: strikeHz,
  });
  return mix(durationSec, [ring, 0], [strike, strikeDb]);
}

/**
 * Moving air, shared by the whoosh family. Two noise bands, a low "body" and a high "air",
 * sweep from their `[start, peak, end]` Hz as the object approaches and passes: brightness
 * follows the loudness swell, and the band settles lower on the way out (Doppler-like).
 * The body runs through two band-pass stages so its sweep reads clearly; the air band is a
 * single, gentler stage. Slow random turbulence wobbles level and cutoff, so it reads as
 * moving air rather than static hiss.
 */
function whooshVoice(rng, options) {
  const { durationSec, peakAt, sharpness = 2, body, air, airDb = -8, q = 0.9, turbulence = 0.3 } = options;
  const bodyStage1 = svf("bandpass");
  const bodyStage2 = svf("bandpass");
  const airBand = svf("bandpass");
  const gust = smoothNoise(rng, 14);
  const airGain = dbToGain(airDb);
  const cutoff = ([start, peak, end], x, env) => glide(x < peakAt ? start : end, peak, env ** 0.8);
  return render(durationSec, (t) => {
    const x = t / durationSec;
    const env = swell(x, peakAt, sharpness);
    const wobble = gust();
    const drift = 1 + 0.4 * turbulence * wobble;
    const bodyHz = cutoff(body, x, env) * drift;
    const low = bodyStage2(bodyStage1(rng.noise(), bodyHz, q), bodyHz, q);
    const high = airBand(rng.noise(), cutoff(air, x, env) * drift, q * 0.8);
    return (low + airGain * high) * env * (1 + turbulence * wobble);
  });
}

/**
 * Tension build shared by the risers. Noise runs through a band-pass that sweeps from
 * 300 Hz to 7.5 kHz and grows more resonant; a detuned saw pair plus a sine glides up
 * `octaves` through a pitch-tracking low-pass, pulsed by a tremolo that speeds up.
 * Loudness climbs a steady 26 dB (linear in dB), then a 40 ms release: the peak lands at
 * the very end, so line the end up with the cut.
 */
function riserVoice(rng, { durationSec, startHz, octaves, tremoloHz: [tremoloFrom, tremoloTo] }) {
  const loudness = (x) => dbToGain(-26 * (1 - x));
  const band = svf("bandpass");
  const noise = render(durationSec, (t) => {
    const x = t / durationSec;
    return band(rng.noise(), glide(300, 7500, x ** 1.4), lerp(0.8, 2.5, x)) * loudness(x);
  });
  const sawLow = oscillator("saw", rng.next());
  const sawHigh = oscillator("saw", rng.next());
  const fundamental = oscillator("sine");
  const tremolo = oscillator("sine");
  const lowpass = svf("lowpass");
  const tone = render(durationSec, (t) => {
    const x = t / durationSec;
    const freq = startHz * 2 ** (octaves * x ** 1.6);
    const raw = sawLow(freq * cents(-9)) + sawHigh(freq * cents(9)) + 0.6 * fundamental(freq);
    const pulse = 1 - 0.4 * (0.5 + 0.5 * tremolo(glide(tremoloFrom, tremoloTo, x)));
    return lowpass(raw, 4 * freq, 1.2) * pulse * loudness(x) ** 0.8;
  });
  const build = mix(durationSec, [noise, 0], [tone, -3]);
  return mapSamples(build, (s, t) => s * release(t, durationSec, 0.04));
}

/** One raw fragment for the glitch recipe. */
function glitchFragment(rng, kind) {
  if (kind === "buzz") {
    // A bitcrushed square that jumps by a musical interval halfway through.
    const osc = oscillator("square");
    const freq = rng.range(110, 880);
    const jump = semitones(rng.pick([-12, -5, 7, 12]));
    const len = rng.range(0.02, 0.06);
    return render(len, (t) => bitcrush(0.8 * osc(t < len / 2 ? freq : freq * jump), 4));
  }
  if (kind === "crunch") {
    // Noise through sample-and-hold (crude down-sampling) and a 3-bit quantizer.
    const holdSamples = Math.round(SAMPLE_RATE / rng.range(1500, 6000));
    let held = 0;
    return render(rng.range(0.012, 0.04), (t) => {
      if (Math.round(t * SAMPLE_RATE) % holdSamples === 0) {
        held = bitcrush(rng.noise(), 3);
      }
      return held;
    });
  }
  if (kind === "chirp") {
    // A falling sine sweep crushed to 5 bits: a "data" blip.
    const osc = oscillator("sine");
    const from = rng.range(3000, 5000);
    const to = rng.range(200, 500);
    const len = rng.range(0.015, 0.03);
    return render(len, (t) => bitcrush(osc(glide(from, to, t / len)), 5));
  }
  // "stutter": one short FM grain repeated 3-6 times, each repeat a little quieter.
  const carrier = rng.range(500, 2500);
  const ratio = rng.pick([1.41, 2, 3.5]);
  const index = rng.range(1.5, 4);
  const grain = render(rng.range(0.005, 0.012), (t) => Math.sin(TAU * carrier * t + index * Math.sin(TAU * carrier * ratio * t)));
  fadeEdges(grain, 0.0003);
  const repeats = 3 + Math.floor(rng.next() * 4);
  const out = new Float64Array(grain.length * repeats);
  for (let r = 0; r < repeats; r++) {
    out.set(
      grain.map((x) => x * 0.85 ** r),
      r * grain.length,
    );
  }
  return out;
}

// --- The library -------------------------------------------------------------
// Each recipe receives its own seeded RNG and returns raw samples; `master()` handles
// DC removal, edge fades and normalization afterwards.

const SOUNDS = {
  // --- Transitions ---

  // whoosh: an airy pass-by. A body band (200 Hz -> 1.1 kHz -> 150 Hz) and an air band
  // (0.9 -> 5 -> 0.6 kHz) of noise swell to a peak 60% of the way in, with slow turbulence.
  whoosh: (rng) =>
    whooshVoice(rng, {
      durationSec: 0.7,
      peakAt: 0.6,
      body: [200, 1100, 150],
      air: [900, 5000, 600],
      airDb: -13,
      q: 0.8,
    }),

  // whoosh-fast: the same air movement squeezed into 0.35 s, with a higher, tighter sweep.
  "whoosh-fast": (rng) =>
    whooshVoice(rng, {
      durationSec: 0.35,
      peakAt: 0.55,
      sharpness: 2.5,
      body: [300, 1600, 220],
      air: [1300, 6500, 900],
      airDb: -12,
    }),

  // swoosh: bright and short. Narrower bands (Q 1.5) sit well above the whoosh, so the
  // sweep has a slightly tonal swish.
  swoosh: (rng) =>
    whooshVoice(rng, {
      durationSec: 0.4,
      peakAt: 0.42,
      sharpness: 2.5,
      body: [700, 2800, 500],
      air: [2600, 9500, 1800],
      airDb: -7,
      q: 1.5,
    }),

  // whip: a very fast whip-pan swish. A sharp, resonant (Q 2) sweep up to 3.6 / 10.5 kHz
  // and back that is audible for only about 0.1 s around its center.
  whip: (rng) =>
    whooshVoice(rng, {
      durationSec: 0.24,
      peakAt: 0.5,
      sharpness: 3.5,
      body: [550, 3600, 400],
      air: [2200, 10500, 1600],
      airDb: -8,
      q: 2,
      turbulence: 0.15,
    }),

  // glitch: a digital stutter. Back-to-back fragments in a fixed rotation (sample-and-hold
  // noise crunches, FM grains repeated 3-6 times like a buffer-repeat effect, bitcrushed
  // square buzzes, falling 5-bit chirps) with seeded random pitches, lengths, levels and
  // gaps. Every fragment gets 0.5 ms edge fades, so the chop sounds deliberate, not broken.
  glitch: (rng) => {
    const durationSec = 0.6;
    const rotation = ["crunch", "stutter", "buzz", "chirp", "stutter", "crunch", "buzz"];
    const out = createBuffer(durationSec);
    let at = 0;
    for (let n = 0; at < durationSec - 0.03; n++) {
      const fragment = glitchFragment(rng, rotation[n % rotation.length]);
      const piece = fragment.slice(0, sampleCount(durationSec - at));
      mixInto(out, normalize(fadeEdges(piece, 0.0005)), at, dbToGain(rng.range(-7, 0)));
      at += piece.length / SAMPLE_RATE + (rng.next() < 0.3 ? rng.range(0.006, 0.025) : 0);
    }
    const highpass = onePoleHighpass();
    return mapSamples(out, (x) => highpass(x, 120));
  },

  // static: a burst of TV snow. White noise band-limited to 250 Hz-8.5 kHz, with fast
  // random level flutter and sparse crackle pops; it snaps on in 4 ms with a brief
  // front-loaded burst, holds, and cuts out over 80 ms.
  static: (rng) => {
    const durationSec = 0.7;
    const highpass = svf("highpass");
    const lowpass = svf("lowpass");
    const flutter = smoothNoise(rng, 40);
    const drift = smoothNoise(rng, 6);
    const hiss = render(durationSec, () => lowpass(highpass(rng.noise(), 250), 8500) * (1 + 0.3 * flutter()) * (1 + 0.15 * drift()));
    const crackleBand = svf("bandpass");
    const crackle = render(durationSec, () => crackleBand(rng.next() < 60 / SAMPLE_RATE ? rng.noise() : 0, 2500, 0.7));
    return mapSamples(
      mix(durationSec, [hiss, 0], [crackle, -6]),
      (x, t) => x * attack(t, 0.004) * (1 + 0.5 * decay(t, 0.08)) * release(t, durationSec, 0.08),
    );
  },

  // --- Risers ---

  // riser: a 2 s build from G2. Noise sweep plus detuned saws gliding up 3 octaves, with
  // a tremolo accelerating from 4 to 20 Hz; it peaks on the final frame.
  riser: (rng) =>
    riserVoice(rng, {
      durationSec: 2,
      startHz: midiHz(43),
      octaves: 3,
      tremoloHz: [4, 20],
    }),

  // riser-short: a 1 s build from D3, up 2 octaves, tremolo 6 -> 24 Hz.
  "riser-short": (rng) =>
    riserVoice(rng, {
      durationSec: 1,
      startHz: midiHz(50),
      octaves: 2,
      tremoloHz: [6, 24],
    }),

  // --- UI ---

  // pop: a bubbly blip. A sine whose pitch falls from about 1.2 kHz to 290 Hz within
  // ~40 ms, with a soft 2nd harmonic for roundness, lightly saturated so it carries on
  // phone speakers, plus a tiny 3.5 kHz noise tick on the front.
  pop: (rng) => {
    const durationSec = 0.16;
    const tone = oscillator("sine");
    const overtone = oscillator("sine");
    const blip = render(durationSec, (t) => {
      const freq = 290 + 900 * Math.exp(-t / 0.012);
      return (tone(freq) + 0.18 * overtone(2 * freq)) * attack(t, 0.001) * decay(t, 0.13);
    });
    const tick = noiseBurst(rng, {
      durationSec: 0.02,
      t60: 0.004,
      cutoff: 3500,
      q: 0.9,
    });
    return mix(durationSec, [saturate(blip, 1.8), 0], [tick, -16]);
  },

  // click: a crisp UI click. A broad 4.5 kHz noise snap (about 4 ms) over short "plastic"
  // modes (an 820 Hz body; 2.35 / 3.9 / 6.1 kHz) that are gone within 40 ms.
  click: (rng) =>
    mechanicalClick(rng, {
      durationSec: 0.05,
      snapHz: 4500,
      snapQ: 0.8,
      partials: [
        [820, 0.5, 0.03],
        [2350, 0.8, 0.025],
        [3900, 0.5, 0.018],
        [6100, 0.3, 0.012],
      ],
      modesDb: -4,
    }),

  // tick: a soft clock tick. A gentle 2.8 kHz snap, a wooden case knock (620 Hz /
  // 1.25 kHz) and the escapement's small metallic ring (3.15 / 4.7 / 6.9 kHz, about
  // 45 ms), low-passed at 7 kHz to keep it soft.
  tick: (rng) => {
    const knock = mechanicalClick(rng, {
      durationSec: 0.07,
      snapHz: 2800,
      snapQ: 1.5,
      snapT60: 0.003,
      partials: [
        [620, 0.3, 0.03],
        [1250, 0.5, 0.025],
        [3150, 0.6, 0.045],
        [4700, 0.35, 0.03],
        [6900, 0.15, 0.018],
      ],
      modesDb: -2,
    });
    const soften = onePoleLowpass();
    return mapSamples(knock, (x) => soften(x, 7000));
  },

  // tap: a soft touch, like a fingertip on glass. A low-passed noise puff (1.4 kHz), a
  // 190 -> 150 Hz body thump that dies in about 50 ms and a faint 480 Hz knock, with a
  // rounded 2 ms attack and no high snap.
  tap: (rng) => {
    const durationSec = 0.09;
    const thump = oscillator("sine");
    const body = render(durationSec, (t) => thump(150 + 40 * Math.exp(-t / 0.01)) * decay(t, 0.05));
    const puff = noiseBurst(rng, {
      durationSec,
      t60: 0.02,
      cutoff: 1400,
      mode: "lowpass",
    });
    const knock = modes(durationSec, [[480, 1, 0.03]]);
    return mapSamples(mix(durationSec, [body, 0], [puff, -5], [knock, -12]), (x, t) => x * attack(t, 0.002));
  },

  // switch: a toggle. A light pre-click as the lever starts to move, then 18 ms later the
  // heavier snap over center: a 1.1 kHz body with a short 4.2 kHz spring ring.
  switch: (rng) => {
    const pre = mechanicalClick(rng, {
      durationSec: 0.05,
      snapHz: 4200,
      snapT60: 0.003,
      partials: [
        [2600, 1, 0.012],
        [5200, 0.5, 0.008],
      ],
      modesDb: -6,
    });
    const snap = mechanicalClick(rng, {
      snapHz: 3000,
      snapT60: 0.005,
      partials: [
        [1100, 0.8, 0.03],
        [2450, 0.6, 0.025],
        [4200, 0.5, 0.04],
        [6500, 0.2, 0.015],
      ],
    });
    return mix(0.1, [pre, -9], [snap, 0, 0.018]);
  },

  // ding: a clean bell on C6. Glockenspiel-like inharmonic partials (1, 2, 2.76, 5.40 and
  // 8.93 times the fundamental) where higher modes die faster; every partial beats slowly
  // against a detuned twin, and the fundamental has a long ring (T60 1.6 s).
  ding: (rng) =>
    bellTone(rng, midiHz(84), {
      durationSec: 1.45,
      partials: [
        [1, 1, 1.6],
        [2, 0.25, 1],
        [2.756, 0.3, 0.7],
        [5.404, 0.12, 0.35],
        [8.933, 0.05, 0.18],
      ],
      strikeDb: -18,
    }),

  // chime: a two-note notification. Soft-mallet bars on A5 then E6 (a rising fifth,
  // 120 ms apart) with mostly harmonic partials for a sweet tone, gentle beating and
  // about 1.1 s of ring.
  chime: (rng) => {
    const note = (midi) =>
      bellTone(rng, midiHz(midi), {
        durationSec: 1.3,
        partials: [
          [1, 1, 1.1],
          [2, 0.12, 0.6],
          [3, 0.05, 0.35],
          [4.2, 0.03, 0.2],
        ],
        detuneCents: 2,
        strikeDb: -24,
        strikeHz: 1500,
      });
    return mix(1.3, [note(81), -1.5], [note(88), 0, 0.12]);
  },

  // sparkle: a shimmering arpeggio. Seven quick bell notes up a C-major chord (C6 to C8,
  // about 45 ms apart), then four random high twinkles; each note beats against a twin
  // detuned 4 cents (the shimmer), and a damped 85 ms echo smears it into a glittery tail.
  sparkle: (rng) => {
    const partials = [
      [1, 1, 0.5],
      [2, 0.2, 0.3],
      [2.756, 0.12, 0.2],
      [5.404, 0.05, 0.1],
    ];
    const note = (midi) =>
      bellTone(rng, midiHz(midi), {
        durationSec: 0.6,
        partials,
        detuneCents: 4,
        strikeDb: -24,
        strikeHz: 8000,
      });
    const arpeggio = [84, 88, 91, 96, 100, 103, 108].map((midi, i) => [note(midi), -1.2 * i, 0.045 * i + rng.range(0, 0.008)]);
    const twinkles = Array.from({ length: 4 }, () => [note(rng.pick([96, 100, 103, 108])), rng.range(-16, -10), rng.range(0.32, 0.6)]);
    return echo(mix(1, ...arpeggio, ...twinkles), {
      delaySec: 0.085,
      feedback: 0.35,
      wet: 0.35,
      dampHz: 7000,
    });
  },

  // --- Impacts ---

  // impact: a cinematic hit in layers. A saturated sine dropping 120 -> 38 Hz (the
  // weight), a 250 -> 90 Hz sine punch (the chest), a noise crack whose low-pass falls
  // from 10.5 to 1.5 kHz plus a high-passed snap (the transient), a faint inharmonic metal
  // ring, and a low-passed noise tail that darkens as it decays (the space). Glued with
  // tanh saturation.
  impact: (rng) => {
    const durationSec = 1.4;
    const sine = oscillator("sine");
    const weight = render(durationSec, (t) => sine(38 + 82 * Math.exp(-t / 0.07)) * decay(t, 0.9));
    const chest = oscillator("sine");
    const punch = render(0.3, (t) => chest(90 + 160 * Math.exp(-t / 0.015)) * decay(t, 0.15));
    const crack = noiseBurst(rng, {
      durationSec: 0.3,
      t60: 0.09,
      cutoff: (t) => 1500 + 9000 * Math.exp(-t / 0.02),
      mode: "lowpass",
    });
    const snap = noiseBurst(rng, {
      durationSec: 0.05,
      t60: 0.015,
      cutoff: 3000,
      mode: "highpass",
    });
    const metal = modes(durationSec, [
      [148, 1, 0.5],
      [331, 0.8, 0.35],
      [587, 0.6, 0.25],
      [1012, 0.4, 0.18],
    ]);
    const darken = svf("lowpass");
    const rumble = smoothNoise(rng, 6);
    const tail = render(
      durationSec,
      (t) => darken(rng.noise(), 120 + 1700 * Math.exp(-t / 0.25), 0.8) * attack(t, 0.015) * decay(t, 1.3) * (1 + 0.15 * rumble()),
    );
    const hit = mix(durationSec, [saturate(weight, 2.2), 0], [punch, -4], [crack, -1], [snap, -6], [metal, -18], [tail, -6]);
    return saturate(hit, 1.6);
  },

  // boom: a deep, round boom. A slow sine fall from 72 to 30 Hz with a fading octave
  // overtone, a rumbling low-passed noise body (570 -> 70 Hz) that blooms over 25 ms and
  // dies away slowly (T60 1.5 s), and only a soft 2.2 kHz transient.
  boom: (rng) => {
    const durationSec = 1.45;
    const sine = oscillator("sine");
    const octave = oscillator("sine");
    const tone = render(durationSec, (t) => {
      const freq = 30 + 42 * Math.exp(-t / 0.16);
      const overtone = 0.4 * octave(2 * freq) * decay(t, 0.5);
      return (sine(freq) + overtone) * attack(t, 0.008) * decay(t, 1.4);
    });
    const lowpass = svf("lowpass");
    const flutter = smoothNoise(rng, 7);
    const rumble = render(
      durationSec,
      (t) => lowpass(rng.noise(), 70 + 500 * Math.exp(-t / 0.3), 0.8) * attack(t, 0.025) * decay(t, 1.5) * (1 + 0.35 * flutter()),
    );
    const thump = noiseBurst(rng, {
      durationSec: 0.15,
      t60: 0.04,
      cutoff: 2200,
      mode: "lowpass",
    });
    return saturate(mix(durationSec, [saturate(tone, 1.6), 0], [rumble, -3], [thump, -14]), 1.4);
  },

  // sub-drop: a sine gliding 70 -> 28 Hz over 1 s (fast at first, then settling) with a
  // 4 ms attack and a long fade; a faint 2nd harmonic keeps it audible on small speakers.
  "sub-drop": () => {
    const durationSec = 1.3;
    const sine = oscillator("sine");
    const second = oscillator("sine");
    const tone = render(durationSec, (t) => {
      const freq = glide(70, 28, 1 - (1 - progress(t, 0, 1)) ** 2);
      const envelope = attack(t, 0.004) * decay(t, 2.2) * release(t, durationSec, 0.35);
      return (sine(freq) + 0.12 * second(2 * freq)) * envelope;
    });
    return saturate(tone, 1.3);
  },

  // bass-hit: a punchy 808-style hit. A sine that snaps from about 165 Hz down to 55 Hz
  // in 25 ms and rings for about 0.7 s, driven into tanh saturation for growl, with a
  // short 3 kHz beater click on top.
  "bass-hit": (rng) => {
    const durationSec = 0.85;
    const sine = oscillator("sine");
    const body = render(durationSec, (t) => sine(55 + 110 * Math.exp(-t / 0.025)) * decay(t, 0.7));
    const beater = noiseBurst(rng, {
      durationSec: 0.02,
      t60: 0.003,
      cutoff: 3000,
      q: 0.8,
    });
    return mix(durationSec, [saturate(body, 2.6), 0], [beater, -12]);
  },

  // braam: a short, dark brass-like swell. Eight detuned saws on an A power chord (A1, E2,
  // A2) scoop up 40 cents into pitch like a horn section, through a low-pass that opens
  // with loudness (brass gets brighter as it gets louder: 150 Hz -> 2.35 kHz), then tanh
  // drive for growl, a band-pass "bite" around 1.1 kHz (the brass formant) and a quiet
  // 55 Hz sine for weight. 0.2 s swell, 0.25 s hold, about 1 s decay.
  braam: (rng) => {
    const durationSec = 1.45;
    const envelope = (t) => smoothstep(progress(t, 0, 0.2)) * (t < 0.45 ? 1 : decay(t - 0.45, 1.1));
    const voices = [
      [55, -11, 1],
      [55, -4, 1],
      [55, 4, 1],
      [55, 11, 1],
      [82.41, -6, 0.7],
      [82.41, 6, 0.7],
      [110, -7, 0.8],
      [110, 7, 0.8],
    ].map(([freq, detune, gain]) => ({
      osc: oscillator("saw", rng.next()),
      freq: freq * cents(detune),
      gain,
    }));
    const lowpass = svf("lowpass");
    const brass = render(durationSec, (t) => {
      const scoop = cents(-40 * (1 - smoothstep(progress(t, 0, 0.15))));
      let sum = 0;
      for (const voice of voices) {
        sum += voice.gain * voice.osc(voice.freq * scoop);
      }
      const level = envelope(t);
      return lowpass(sum, 150 + 2200 * level ** 1.5, 1.2) * level;
    });
    const tame = onePoleLowpass();
    const growl = mapSamples(saturate(brass, 3.5), (x) => tame(x, 4000));
    const formant = svf("bandpass");
    const bite = growl.map((x) => formant(x, 1100, 1.4));
    const subOsc = oscillator("sine");
    const sub = render(durationSec, (t) => subOsc(55) * envelope(t));
    return mix(durationSec, [growl, 0], [bite, -8], [sub, -12]);
  },

  // vine-boom: a meme-style emphasis boom, synthesized from scratch. A drum-like membrane
  // (modes at 1, 1.59, 2.14 and 2.30 times the fundamental, higher ones dying faster)
  // whose pitch drops fast from about 175 Hz to 52 Hz, lightly saturated so it still reads
  // on phone speakers, plus a low beater thump and a short, dark room tail: low-passed
  // noise that blooms 10 ms after the hit and darkens as it decays.
  "vine-boom": (rng) => {
    const durationSec = 1.3;
    const pitch = (t) => 52 + 125 * Math.exp(-t / 0.03);
    const membrane = [
      [1, 1, 1.1],
      [1.594, 0.35, 0.35],
      [2.136, 0.2, 0.22],
      [2.296, 0.12, 0.18],
    ].map(([ratio, gain, t60]) => ({
      ratio,
      gain,
      t60,
      osc: oscillator("sine"),
    }));
    const body = render(durationSec, (t) => {
      const f0 = pitch(t);
      let sum = 0;
      for (const mode of membrane) {
        sum += mode.gain * mode.osc(mode.ratio * f0) * decay(t, mode.t60);
      }
      return sum * attack(t, 0.001);
    });
    const thump = noiseBurst(rng, {
      durationSec: 0.1,
      t60: 0.03,
      cutoff: 1200,
      mode: "lowpass",
    });
    const darken = svf("lowpass");
    const flutter = smoothNoise(rng, 5);
    const room = render(
      durationSec,
      (t) => darken(rng.noise(), 160 + 600 * Math.exp(-t / 0.2), 0.7) * attack(t - 0.01, 0.03) * decay(t, 0.9) * (1 + 0.15 * flutter()),
    );
    return saturate(mix(durationSec, [saturate(body, 1.8), 0], [thump, -14], [room, -10]), 1.3);
  },

  // --- Foley ---

  // typewriter: a single key strike. A dull key-press thock (260 Hz plus low-passed
  // noise); 7 ms later the typebar slaps the platen (a sharp 3.2 kHz snap with bright
  // metal modes ringing up to 50 ms over a 420 Hz platen knock); at 50 ms the carriage
  // escapement ticks.
  typewriter: (rng) => {
    const press = mechanicalClick(rng, {
      durationSec: 0.06,
      snapHz: 1200,
      snapMode: "lowpass",
      snapT60: 0.018,
      partials: [[260, 1, 0.035]],
      modesDb: -2,
    });
    const strike = mechanicalClick(rng, {
      durationSec: 0.12,
      snapHz: 3200,
      snapQ: 0.9,
      partials: [
        [420, 0.9, 0.03],
        [1870, 0.6, 0.05],
        [2930, 0.45, 0.04],
        [4410, 0.3, 0.03],
        [6600, 0.15, 0.02],
      ],
    });
    const escapement = mechanicalClick(rng, {
      durationSec: 0.04,
      snapHz: 5000,
      snapT60: 0.002,
      partials: [
        [3700, 1, 0.02],
        [5200, 0.6, 0.015],
      ],
      modesDb: -4,
    });
    return mix(0.17, [press, -8], [strike, 0, 0.007], [escapement, -15, 0.05]);
  },

  // typing: seven keystrokes on a modern keyboard at an uneven human pace (75-135 ms
  // apart). Each key is a bright keycap click over a low thock as it bottoms out, then a
  // softer release click about 60 ms later; the fifth is a deeper spacebar with a
  // stabilizer rattle. Pitch and level vary a little from key to key.
  typing: (rng) => {
    const strikes = [0];
    for (let i = 1; i < 7; i++) {
      strikes.push(strikes[i - 1] + rng.range(0.075, 0.135));
    }
    const layers = strikes.flatMap((at, i) => {
      const spacebar = i === 4;
      const tone = rng.range(0.92, 1.08);
      const body = spacebar
        ? [
            [230 * tone, 1, 0.045],
            [610 * tone, 0.6, 0.03],
            [1500 * tone, 0.3, 0.02],
          ]
        : [
            [420 * tone, 1, 0.03],
            [1150 * tone, 0.6, 0.02],
            [2600 * tone, 0.3, 0.012],
          ];
      const press = mechanicalClick(rng, {
        durationSec: 0.07,
        snapHz: 3000 * tone,
        snapQ: 0.9,
        partials: body,
        modesDb: spacebar ? 0 : -2,
      });
      const lift = mechanicalClick(rng, {
        durationSec: 0.04,
        snapHz: 3600 * tone,
        snapT60: 0.003,
        partials: [[1900 * tone, 1, 0.01]],
        modesDb: -6,
      });
      const keyDb = rng.range(-3, 0);
      const key = [
        [press, keyDb, at],
        [lift, keyDb - rng.range(10, 14), at + rng.range(0.05, 0.075)],
      ];
      if (spacebar) {
        const rattle = mechanicalClick(rng, {
          durationSec: 0.04,
          snapHz: 2200,
          partials: [[900, 1, 0.015]],
          modesDb: -4,
        });
        key.push([rattle, keyDb - 9, at + 0.008]);
      }
      return key;
    });
    const durationSec = Math.ceil((strikes[strikes.length - 1] + 0.13) * 1000) / 1000;
    return mix(durationSec, ...layers);
  },

  // shutter: a DSLR "ka-chik". A thicker first click (mirror up and first curtain:
  // 780 Hz-5.2 kHz modes over a low thump), a faint curtain swish, then 85 ms later a
  // brighter second click (second curtain and mirror return) with a small bounce 12 ms
  // after it.
  shutter: (rng) => {
    const first = mechanicalClick(rng, {
      snapHz: 2200,
      snapQ: 0.8,
      snapT60: 0.006,
      partials: [
        [780, 1, 0.035],
        [1650, 0.8, 0.03],
        [3100, 0.6, 0.025],
        [5200, 0.3, 0.015],
      ],
      modesDb: -2,
    });
    const thump = noiseBurst(rng, {
      durationSec: 0.05,
      t60: 0.015,
      cutoff: 500,
      mode: "lowpass",
    });
    const swishBand = svf("bandpass");
    const swish = render(0.06, (t) => swishBand(rng.noise(), 4000, 0.7) * swell(t / 0.06, 0.4));
    const second = mechanicalClick(rng, {
      snapHz: 4000,
      partials: [
        [1250, 0.9, 0.03],
        [2700, 0.7, 0.025],
        [4600, 0.6, 0.02],
        [7300, 0.3, 0.012],
      ],
      modesDb: -2,
    });
    const bounce = mechanicalClick(rng, {
      durationSec: 0.04,
      snapHz: 4500,
      snapT60: 0.002,
      partials: [[2700, 1, 0.01]],
      modesDb: -6,
    });
    return mix(0.25, [first, -1], [thump, -9], [swish, -22, 0.012], [second, 0, 0.085], [bounce, -13, 0.097]);
  },

  // cash: a cash-register "ka-ching". Two quick mechanical clicks (the lever, then the
  // drawer latch), then a small bright bell (B6, inharmonic dome-bell partials) struck
  // twice as the clapper bounces, with a few faint coin pings scattered in the tail.
  cash: (rng) => {
    const lever = mechanicalClick(rng, {
      snapHz: 2500,
      partials: [
        [900, 1, 0.04],
        [2100, 0.7, 0.03],
        [3900, 0.4, 0.02],
      ],
    });
    const latch = mechanicalClick(rng, {
      snapHz: 3500,
      partials: [
        [1300, 1, 0.03],
        [3300, 0.6, 0.025],
      ],
    });
    const ring = () =>
      bellTone(rng, midiHz(95), {
        durationSec: 1.1,
        partials: [
          [1, 1, 1],
          [2.32, 0.5, 0.6],
          [4.25, 0.3, 0.35],
          [6.63, 0.15, 0.2],
        ],
        detuneCents: 3,
        strikeDb: -12,
        strikeHz: 6000,
      });
    const coins = Array.from({ length: 5 }, () => {
      const freq = rng.range(3500, 6500);
      const ping = modes(0.12, [
        [freq, 1, 0.08],
        [freq * 1.47, 0.5, 0.05],
        [freq * 2.61, 0.3, 0.03],
      ]);
      return [ping, rng.range(-22, -15), rng.range(0.1, 0.45)];
    });
    return mix(1.2, [lever, -5], [latch, -3, 0.03], [ring(), 0, 0.07], [ring(), -7, 0.115], ...coins);
  },

  // paper: a sheet of paper slid across a desk. Friction noise band-passed around
  // 2.2-3.6 kHz (brighter as the hand speeds up, rolled off above 8 kHz) with fast random
  // "grain" in its level (fibers catching) and a slower rustle wobble; sparse resonant
  // crinkles whose density and level follow the hand's speed; and a faint low "whump" of
  // air under the sheet. The motion swells to a peak 35% of the way through.
  paper: (rng) => {
    const durationSec = 0.42;
    const motion = (t) => swell(t / durationSec, 0.35, 1.6);
    const highpass = svf("highpass");
    const band = svf("bandpass");
    const rolloff = svf("lowpass");
    const grain = smoothNoise(rng, 180);
    const rustle = smoothNoise(rng, 18);
    const friction = render(durationSec, (t) => {
      const speed = motion(t);
      const texture = (0.4 + 0.6 * Math.abs(grain())) * (1 + 0.25 * rustle());
      const scrape = band(highpass(rng.noise(), 600), glide(2200, 3600, speed), 0.7);
      return rolloff(scrape, 8000) * speed * texture;
    });
    const crinkleBand = svf("bandpass");
    const crinkleTone = smoothNoise(rng, 9);
    const crinkles = render(durationSec, (t) => {
      const speed = motion(t);
      const impulse = rng.next() < (280 * speed) / SAMPLE_RATE ? rng.noise() * (0.3 + 0.7 * speed) : 0;
      return crinkleBand(impulse, 4000 + 1800 * crinkleTone(), 2.5);
    });
    const airLowpass = svf("lowpass");
    const air = render(durationSec, (t) => airLowpass(rng.noise(), 450) * motion(t));
    return mix(durationSec, [friction, 0], [crinkles, -6], [air, -15]);
  },

  // --- Cartoon ---

  // record-scratch: a DJ "wicka-wiip". A synthesized record (a saw chord plus hiss,
  // low-passed) is scrubbed forward fast, then pulled back, reading the groove at the
  // hand's speed: pitch and the filtered noise's brightness follow the speed, and so does
  // loudness, as with a real velocity-sensitive cartridge. A few vinyl crackles on top.
  "record-scratch": (rng) => {
    const durationSec = 0.44;
    // The groove: low-passed at 4.5 kHz so even 3x playback stays below Nyquist.
    const chord = [164.81, 196, 246.94].map((freq) => ({
      freq,
      osc: oscillator("saw", rng.next()),
    }));
    const lowpass = svf("lowpass");
    const groove = render(1.5, () => {
      let sum = 0.5 * rng.noise();
      for (const { freq, osc } of chord) sum += osc(freq);
      return lowpass(sum, 4500, 0.8);
    });
    // The hand: a fast push forward, a 10 ms turnaround, then a longer pull back.
    const speed = (t) => {
      if (t < 0.12) return 3 * Math.sin((Math.PI * t) / 0.12);
      if (t >= 0.13 && t < 0.38) {
        return -2.5 * Math.sin((Math.PI * (t - 0.13)) / 0.25);
      }
      return 0;
    };
    let head = 0.5 * SAMPLE_RATE; // read position in the groove, in samples
    const scratch = render(durationSec, (t) => {
      const v = speed(t);
      head += v;
      const i = Math.floor(head);
      return lerp(groove[i], groove[i + 1], head - i) * (Math.abs(v) / 3);
    });
    const crackleBand = svf("bandpass");
    const crackle = render(durationSec, () => crackleBand(rng.next() < 12 / SAMPLE_RATE ? rng.noise() : 0, 3000, 0.8));
    return mix(durationSec, [scratch, 0], [crackle, -18]);
  },

  // boing: a cartoon spring. A saw (plus a sine body) whose pitch wobbles +/-38% at about
  // 14 Hz, the wobble dying away like a settling spring while the pitch drifts up a little;
  // a resonant band-pass at 3x the pitch gives the nasal "oi", and a tiny pluck starts it.
  boing: (rng) => {
    const durationSec = 0.9;
    const saw = oscillator("saw");
    const sine = oscillator("sine");
    const wobble = oscillator("sine");
    const formant = svf("bandpass");
    const voice = render(durationSec, (t) => {
      const center = glide(180, 230, progress(t, 0, 0.6));
      const depth = 0.38 * Math.exp(-t / 0.22);
      const freq = center * (1 + depth * wobble(glide(14, 9, progress(t, 0, 0.8))));
      const tone = formant(saw(freq), 3 * freq, 3) + 0.2 * sine(freq);
      return tone * attack(t, 0.003) * decay(t, 0.85);
    });
    const pluck = noiseBurst(rng, {
      durationSec: 0.02,
      t60: 0.004,
      cutoff: 2000,
      q: 1,
    });
    return mix(durationSec, [saturate(voice, 1.5), 0], [pluck, -14]);
  },

  // slide-whistle-up: a short cartoon slide whistle. A breathy, nearly pure flute tone
  // (sine plus faint 2nd and 3rd harmonics) sliding from 520 Hz up to 1.76 kHz along a
  // smooth hand-motion curve, with a slight 6 Hz waver and pitched breath noise.
  "slide-whistle-up": (rng) => {
    const durationSec = 0.7;
    const waver = (t) => 1 + 0.008 * Math.sin(TAU * 6 * t);
    const freqAt = (t) => glide(520, 1760, smoothstep(progress(t, 0.02, 0.62))) * waver(t);
    const [h1, h2, h3] = [oscillator("sine"), oscillator("sine"), oscillator("sine")];
    const tone = render(durationSec, (t) => {
      const freq = freqAt(t);
      return h1(freq) + 0.12 * h2(2 * freq) + 0.04 * h3(3 * freq);
    });
    const breathBand = svf("bandpass");
    const breath = render(durationSec, (t) => breathBand(rng.noise(), freqAt(t), 6));
    const airBand = svf("highpass");
    const air = render(durationSec, () => airBand(rng.noise(), 2500));
    return mapSamples(
      mix(durationSec, [tone, 0], [breath, -10], [air, -26]),
      (x, t) => x * attack(t, 0.025) * lerp(0.8, 1, progress(t, 0, 0.6)) * release(t, durationSec, 0.06),
    );
  },
};

// --- Mastering & file output -------------------------------------------------

/**
 * Final polish for every sound: a 2 ms lead-in of silence (so the fade-in can never blunt
 * a transient that starts at t = 0), DC removal, 2 ms raised-cosine fades at both edges,
 * then peak normalization to -1 dBFS.
 */
function master(sound) {
  const leadIn = sampleCount(EDGE_FADE_SEC);
  const out = new Float64Array(leadIn + sound.length);
  out.set(sound, leadIn);
  const dcBlock = onePoleHighpass();
  mapSamples(out, (x) => dcBlock(x, 5));
  fadeEdges(out, EDGE_FADE_SEC);
  return normalize(out, dbToGain(TARGET_PEAK_DBFS));
}

/** Encodes samples in [-1, 1] as a mono 16-bit PCM WAV (canonical 44-byte header). */
function encodeWav(buffer) {
  const dataBytes = buffer.length * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16); // fmt chunk size
  wav.writeUInt16LE(1, 20); // integer PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  wav.writeUInt16LE(2, 32); // block align
  wav.writeUInt16LE(16, 34); // bits per sample
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < buffer.length; i++) {
    wav.writeInt16LE(Math.round(clamp(buffer[i], -1, 1) * 32767), 44 + 2 * i);
  }
  return wav;
}

function main() {
  const requested = process.argv.slice(2);
  const unknown = requested.filter((id) => !Object.hasOwn(SOUNDS, id));
  if (unknown.length > 0) {
    console.error(`Unknown sound id(s): ${unknown.join(", ")}`);
    console.error(`Available: ${Object.keys(SOUNDS).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  const ids = requested.length > 0 ? requested : Object.keys(SOUNDS);
  mkdirSync(OUT_DIR, { recursive: true });
  for (const id of ids) {
    const audio = master(SOUNDS[id](createRng(seedFrom(id))));
    writeFileSync(join(OUT_DIR, `${id}.wav`), encodeWav(audio));
    console.log(`${id.padEnd(18)} ${(audio.length / SAMPLE_RATE).toFixed(3)} s`);
  }
  console.log(`Wrote ${ids.length} sound(s) to ${OUT_DIR}`);
}

main();
