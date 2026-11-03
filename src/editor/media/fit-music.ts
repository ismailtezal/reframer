"use client";

import type { MusicAnalysis, MusicSection } from "./beats";

/**
 * Fits a music track to a length the way a music editor would. The track's own ending (its last hit
 * and ring-out) lands on the cut. When the track is too long or too short, one edit removes (or
 * repeats) whole bars at the point where the music matches itself best, judged beat by beat on
 * harmony (chroma) and timbre (band shape) for a bar on each side, with a short equal-power
 * crossfade that ends on the downbeat. The result is rendered to new audio, so the timeline holds one
 * clip and the export plays exactly what was previewed.
 */

const ANALYSIS_RATE = 22_050;
const RENDER_RATE = 44_100;
const FFT_SIZE = 4096;
/** Crossfade at an edit: short enough to keep the downbeat's attack, long enough not to click. */
const XFADE = 0.06;

export type MusicEdit = { atSec: number; fromSec: number; toSec: number; match: number; kind: "cut" | "repeat" };

export type FitPlan = {
  /** Where in the source the fitted music starts. */
  startAt: number;
  edits: MusicEdit[];
  /** Length of the fitted music. */
  lengthSec: number;
  /** When the track's last hit lands in the fitted music, and how much ring-out follows it. */
  finalHitSec: number;
  tailSec: number;
  /** Fade-out at the very end (when the ring-out had to be cut short, or for a fade ending). */
  fadeOutSec: number;
  /** "natural": the track's own ending lands on the cut; "fade": it fades out from a bar line. */
  ending: "natural" | "fade";
};

/** Above this jump cost a join is audible (good joins in real tracks measure 0.1–0.25). */
const ROUGH = 0.3;

// ---- Features ----

const fft = (re: Float64Array, im: Float64Array) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
};

type BeatFeature = { chroma: Float64Array; bands: Float64Array; db: number };

const BAND_EDGES = Array.from({ length: 13 }, (_, i) => 60 * (8000 / 60) ** (i / 12));

const normalizeVec = (v: Float64Array, center = false) => {
  if (center) {
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    for (let i = 0; i < v.length; i++) v[i] -= mean;
  }
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
};

/** Harmony, timbre and loudness of each beat (from up to three windows inside it). */
export const beatFeatures = (x: Float32Array, beats: number[]): BeatFeature[] => {
  const window = Float64Array.from({ length: FFT_SIZE }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
  const binHz = ANALYSIS_RATE / FFT_SIZE;
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  return beats.map((b, k) => {
    const from = Math.round(b * ANALYSIS_RATE);
    const to = Math.round((beats[k + 1] ?? b + 0.5) * ANALYSIS_RATE);
    const chroma = new Float64Array(12);
    const bands = new Float64Array(12);
    let energy = 0;
    let count = 0;
    const span = Math.max(1, to - from - FFT_SIZE);
    for (let w = 0; w < 3; w++) {
      const start = from + Math.round((span * w) / 2);
      if (start + FFT_SIZE > x.length) break;
      for (let i = 0; i < FFT_SIZE; i++) {
        re[i] = x[start + i] * window[i];
        im[i] = 0;
      }
      fft(re, im);
      for (let i = 1; i < FFT_SIZE / 2; i++) {
        const f = i * binHz;
        const mag = Math.hypot(re[i], im[i]);
        if (f >= 65 && f <= 2100) chroma[(((Math.round(12 * Math.log2(f / 440)) + 9) % 12) + 12) % 12] += mag;
        for (let band = 0; band < 12; band++) {
          if (f >= BAND_EDGES[band] && f < BAND_EDGES[band + 1]) {
            bands[band] += mag * mag;
            break;
          }
        }
      }
      count++;
    }
    for (let i = from; i < Math.min(to, x.length); i++) energy += x[i] * x[i];
    for (let band = 0; band < 12; band++) bands[band] = Math.log1p(bands[band] / Math.max(1, count));
    return {
      chroma: normalizeVec(chroma),
      bands: normalizeVec(bands, true),
      db: 10 * Math.log10(energy / Math.max(1, to - from) + 1e-10),
    };
  });
};

const dot = (a: Float64Array, b: Float64Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

/** 0 (identical) … ~1 (unrelated): how different two beats sound. */
const beatDistance = (a: BeatFeature, b: BeatFeature) =>
  Math.min(1, 0.5 * (1 - dot(a.chroma, b.chroma)) + 0.5 * (1 - dot(a.bands, b.bands)) + Math.abs(a.db - b.db) / 30);

/** How audible a jump from beat i to beat j is: a bar of context on each side, compared beat by beat. */
export const jumpCost = (f: BeatFeature[], i: number, j: number) => {
  let sum = 0;
  let n = 0;
  for (let m = -4; m < 4; m++) {
    const a = f[i + m];
    const b = f[j + m];
    if (!a || !b) continue;
    sum += beatDistance(a, b);
    n++;
  }
  return n ? sum / n : 1;
};

// ---- Planning ----

/** The end of the audible audio (last sample above -50 dBFS), in seconds. */
const audibleEnd = (x: Float32Array, rate: number) => {
  const threshold = 10 ** (-50 / 20);
  for (let i = x.length - 1; i >= 0; i--) if (Math.abs(x[i]) > threshold) return (i + 1) / rate;
  return x.length / rate;
};

/** The last strong accent of the track: the final hit its ending is built on. */
const finalHit = (analysis: MusicAnalysis, end: number) => {
  const late = analysis.hits.filter((h) => h < end - 0.3);
  const lastDownbeat = [...analysis.downbeats].reverse().find((d) => d < end - 0.3) ?? end;
  const lastHit = late[late.length - 1];
  // Prefer a hit near the last downbeats (a held final chord); otherwise the last downbeat itself.
  return lastHit !== undefined && lastHit > lastDownbeat - 4 * (60 / analysis.bpm) ? lastHit : lastDownbeat;
};

export const planFit = (
  x: Float32Array,
  analysis: MusicAnalysis,
  opts: { lengthSec: number; startAt?: number; ending?: "natural" | "fade" | "auto" },
): FitPlan => {
  const L = opts.lengthSec;
  const end = audibleEnd(x, ANALYSIS_RATE);
  const H = finalHit(analysis, end);
  const ring = Math.max(0, end - H);
  const beat = 60 / analysis.bpm;
  const bar = 4 * beat;
  const beats = analysis.beats;
  const want = Math.max(0, opts.startAt ?? 0);
  // Where the last hit may land: at least 0.6 s of ring-out before the cut (or what there is), and the
  // music may end up to 0.8 s before the cut (a short hold in silence reads as intended).
  const minTail = Math.min(0.6, ring);
  const idealTail = Math.min(ring, 2.5);
  const lo = L - ring - 0.8;
  const hi = L - minTail;
  const fits = (land: number) => land >= lo && land <= hi;

  // Start points near the requested one: downbeats first, other beats as pickups (and the very start).
  const starts = [
    ...(want < bar ? [{ s: 0, penalty: 0 }] : []),
    ...beats
      .map((b, k) => ({ s: b, k }))
      .filter(({ s }) => Math.abs(s - want) <= 2 * bar)
      .map(({ s }) => ({ s, penalty: analysis.downbeats.some((d) => Math.abs(d - s) < 0.02) ? 0.01 : 0.05 })),
  ].map((c) => ({ ...c, penalty: c.penalty + (0.04 * Math.abs(c.s - want)) / bar }));

  const tailCost = (land: number) => (0.05 * Math.abs(L - land - idealTail)) / bar;
  const finish = (startAt: number, land: number, edits: MusicEdit[]): FitPlan => {
    const tail = Math.max(0, Math.min(ring, L - land));
    const fadeOut = tail < ring - 0.05 ? Math.min(1.5, Math.max(0.3, tail * 0.6)) : 0;
    return { startAt, edits, lengthSec: L, finalHitSec: land, tailSec: tail, fadeOutSec: fadeOut, ending: "natural" };
  };

  // The music runs from the start point and fades out over the last bar or two before the cut.
  const fadePlan = (): FitPlan | null => {
    const s = starts.length ? starts.reduce((b, c) => (c.penalty < b.penalty ? c : b)).s : want;
    if (end - s < L) return null; // the track runs out before the cut
    const bars = analysis.downbeats.map((d) => d - s).filter((d) => d > L - 4.5 && d <= L - 1.5);
    const fadeStart = bars.length ? bars[bars.length - 1] : L - 2.5;
    return { startAt: s, edits: [], lengthSec: L, finalHitSec: fadeStart, tailSec: 0, fadeOutSec: L - fadeStart, ending: "fade" };
  };
  if (opts.ending === "fade") {
    const fade = fadePlan();
    if (fade) return fade;
  }

  // The track may already fit from one of the start points.
  let bestPlain: { s: number; cost: number } | null = null;
  for (const { s, penalty } of starts) {
    const land = H - s;
    if (!fits(land)) continue;
    const cost = penalty + tailCost(land);
    if (!bestPlain || cost < bestPlain.cost) bestPlain = { s, cost };
  }
  if (bestPlain && bestPlain.cost < 0.08) return finish(bestPlain.s, H - bestPlain.s, []);

  // One edit between downbeats: forward to remove bars, backward to repeat them.
  const beatIndex = (t: number) => {
    let best = 0;
    for (let k = 1; k < beats.length; k++) if (Math.abs(beats[k] - t) < Math.abs(beats[best] - t)) best = k;
    return best;
  };
  const downIdx = analysis.downbeats.map(beatIndex);
  const features = beatFeatures(x, beats);
  const sectionStarts = new Set(analysis.sections.map((s) => beatIndex(s.start)));
  const pairCost = new Map<string, number>();
  let best: { s: number; i: number; j: number; cost: number; land: number; jump: number } | null = null;
  for (const { s, penalty } of starts) {
    const natural = H - s;
    for (const i of downIdx) {
      const ti = beats[i];
      // Never in the first two bars of the music.
      if (ti - s < (L >= 30 ? 4 : 2) * bar) continue;
      for (const j of downIdx) {
        if (j === i) continue;
        const tj = beats[j];
        const cut = tj > ti;
        if (cut && tj > H - bar) continue;
        if (!cut && tj < s) continue;
        const land = natural - (tj - ti);
        if (!fits(land)) continue;
        // The edit sits at least two bars before the last hit in the fitted music.
        if (land - (ti - s) < 2 * bar) continue;
        const key = `${i}:${j}`;
        let jump = pairCost.get(key);
        if (jump === undefined) {
          jump = jumpCost(features, i, j);
          const barI = Math.round((ti - analysis.downbeats[0]) / bar);
          const barJ = Math.round((tj - analysis.downbeats[0]) / bar);
          if ((barI - barJ) % 4 === 0) jump -= 0.03; // same place in a four-bar phrase
          if (sectionStarts.has(i) && sectionStarts.has(j)) jump -= 0.03; // section to section
          pairCost.set(key, jump);
        }
        // An edit in the first fifth of the music sounds like a false start.
        const early = Math.max(0, 0.2 - (ti - s) / L) / 0.2;
        const cost = jump + penalty + tailCost(land) + 0.06 * early;
        if (!best || cost < best.cost) best = { s, i, j, cost, land, jump };
      }
    }
  }
  // A plain fit that needs a less ideal start still beats an audible edit.
  if (bestPlain && (!best || bestPlain.cost <= best.cost + 0.1)) return finish(bestPlain.s, H - bestPlain.s, []);
  // No clean edit (a join between unlike passages, e.g. a big chorus into a quiet outro): an editor
  // would rather fade from a phrase end than make an audible splice.
  const fade = fadePlan();
  if (fade && (opts.ending === "fade" || (opts.ending !== "natural" && (!best || best.jump > ROUGH)))) return fade;
  if (!best) {
    // Nothing bar-aligned fits: keep the ending and start wherever it must (with a soft entry).
    const s = Math.max(0, H - (L - idealTail));
    return finish(s, H - s, []);
  }
  const ti = beats[best.i];
  const tj = beats[best.j];
  return finish(best.s, best.land, [
    {
      atSec: ti - best.s,
      fromSec: ti,
      toSec: tj,
      match: Math.round(Math.max(0, Math.min(1, 1 - best.jump)) * 100) / 100,
      kind: tj > ti ? "cut" : "repeat",
    },
  ]);
};

// ---- Rendering ----

/** Source time → fitted time (null when that moment was cut out). */
export const mapTime = (plan: FitPlan, t: number): number | null => {
  const edit = plan.edits[0];
  if (!edit) return t >= plan.startAt ? t - plan.startAt : null;
  if (edit.kind === "cut") {
    if (t >= plan.startAt && t < edit.fromSec) return t - plan.startAt;
    if (t >= edit.toSec) return edit.atSec + (t - edit.toSec);
    return null;
  }
  // A repeat plays [start, from) and then [to, end): times after `to` appear once, in the second part.
  if (t >= edit.toSec) return edit.atSec + (t - edit.toSec);
  if (t >= plan.startAt && t < edit.fromSec) return t - plan.startAt;
  return null;
};

/** The track's beat map moved onto the fitted music, so cuts can follow it. */
export const mapAnalysis = (plan: FitPlan, a: MusicAnalysis): MusicAnalysis => {
  const within = (t: number | null): t is number => t !== null && t >= 0 && t <= plan.lengthSec;
  const map = (list: number[]) =>
    list
      .flatMap((t) => {
        const out: number[] = [];
        const edit = plan.edits[0];
        // Repeated bars play twice.
        if (edit?.kind === "repeat" && t >= edit.toSec && t < edit.fromSec) out.push(t - plan.startAt);
        const m = mapTime(plan, t);
        if (within(m)) out.push(m);
        return out;
      })
      .filter((t) => t >= 0 && t <= plan.lengthSec)
      .sort((x, y) => x - y)
      .map((t) => Math.round(t * 1000) / 1000);
  // The source ranges that play, and where each lands in the fitted music; a section is cut into the
  // parts of it that play.
  const edit = plan.edits[0];
  const ranges = edit
    ? [
        { from: plan.startAt, to: edit.fromSec, at: 0 },
        { from: edit.toSec, to: edit.toSec + (plan.lengthSec - edit.atSec), at: edit.atSec },
      ]
    : [{ from: plan.startAt, to: plan.startAt + plan.lengthSec, at: 0 }];
  const sections: MusicSection[] = [];
  for (const r of ranges) {
    for (const s of a.sections) {
      const from = Math.max(s.start, r.from);
      const to = Math.min(s.end, r.to);
      if (to - from > 0.2)
        sections.push({
          ...s,
          start: Math.round((r.at + from - r.from) * 1000) / 1000,
          end: Math.round((r.at + to - r.from) * 1000) / 1000,
        });
    }
  }
  return {
    bpm: a.bpm,
    beats: map(a.beats),
    downbeats: map(a.downbeats),
    sections: sections.filter((s) => s.end - s.start > 0.2).sort((x, y) => x.start - y.start),
    hits: map(a.hits),
    profile: a.profile,
    beatsVersion: a.beatsVersion,
  };
};

const equalPower = (n: number, rising: boolean) =>
  Float32Array.from({ length: n }, (_, i) => {
    const p = i / (n - 1);
    return rising ? Math.sin((p * Math.PI) / 2) : Math.cos((p * Math.PI) / 2);
  });

/** Renders the plan from the decoded track (stereo when the track is). */
export const renderFit = async (track: AudioBuffer, plan: FitPlan): Promise<AudioBuffer> => {
  const ctx = new OfflineAudioContext(Math.min(2, track.numberOfChannels), Math.ceil(plan.lengthSec * RENDER_RATE), RENDER_RATE);
  const play = (offset: number, at: number, duration: number) => {
    const src = ctx.createBufferSource();
    src.buffer = track;
    const gain = ctx.createGain();
    src.connect(gain).connect(ctx.destination);
    src.start(Math.max(0, at), offset, duration);
    return gain.gain;
  };
  const curve = Math.max(16, Math.round(XFADE * 200));
  const edit = plan.edits[0];
  const firstLen = edit ? edit.atSec : plan.lengthSec;
  // First part: from the start point up to the edit (or to the end).
  const g1 = play(plan.startAt, 0, firstLen + (edit ? 0.001 : 0));
  // A soft entry when the music starts mid-track, a click-free one otherwise.
  const entry = plan.startAt > 0 ? 0.03 : 0.005;
  g1.setValueAtTime(0, 0);
  g1.linearRampToValueAtTime(1, entry);
  if (edit) {
    // The crossfade ends exactly on the downbeat, so the new bar starts with its own attack.
    const x0 = Math.max(entry + 0.01, edit.atSec - XFADE);
    g1.setValueCurveAtTime(equalPower(curve, false), x0, edit.atSec - x0);
    const g2 = play(Math.max(0, edit.toSec - (edit.atSec - x0)), x0, plan.lengthSec - x0);
    g2.setValueCurveAtTime(equalPower(curve, true), x0, edit.atSec - x0);
    if (plan.fadeOutSec > 0) {
      g2.setValueAtTime(1, plan.lengthSec - plan.fadeOutSec);
      g2.linearRampToValueAtTime(0, plan.lengthSec);
    }
  } else if (plan.fadeOutSec > 0) {
    g1.setValueAtTime(1, plan.lengthSec - plan.fadeOutSec);
    g1.linearRampToValueAtTime(0, plan.lengthSec);
  }
  return ctx.startRendering();
};

/** Decodes a track twice: mono at the analysis rate, and full quality for the render. */
export const decodeTrack = async (src: string) => {
  const bytes = await (await fetch(src)).arrayBuffer();
  const full = await new OfflineAudioContext(2, 1, RENDER_RATE).decodeAudioData(bytes.slice(0));
  const mono = await new OfflineAudioContext(1, 1, ANALYSIS_RATE).decodeAudioData(bytes);
  const x = new Float32Array(mono.length);
  for (let c = 0; c < mono.numberOfChannels; c++) {
    const ch = mono.getChannelData(c);
    for (let i = 0; i < ch.length; i++) x[i] += ch[i] / mono.numberOfChannels;
  }
  return { full, mono: x };
};

/** 16-bit PCM WAV of an AudioBuffer (interleaved). */
export const audioBufferToWav = (buf: AudioBuffer): Blob => {
  const channels = buf.numberOfChannels;
  const frames = buf.length;
  const data = new DataView(new ArrayBuffer(44 + frames * channels * 2));
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  data.setUint32(4, 36 + frames * channels * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, channels, true);
  data.setUint32(24, buf.sampleRate, true);
  data.setUint32(28, buf.sampleRate * channels * 2, true);
  data.setUint16(32, channels * 2, true);
  data.setUint16(34, 16, true);
  write(36, "data");
  data.setUint32(40, frames * channels * 2, true);
  const chans = Array.from({ length: channels }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([data.buffer], { type: "audio/wav" });
};
