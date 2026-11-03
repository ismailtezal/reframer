"use client";

/**
 * Lightweight music analysis in the browser:
 * 1) onset strength from the energy of a low-passed signal (10 ms hops),
 * 2) tempo via autocorrelation over 60–190 BPM with a gentle prior near 120,
 * 3) phase that best lines the beat grid up with onsets,
 * 4) structure an editor cuts to: downbeats (4/4 bars), energy sections
 *    (intro → build → high → outro) and the strongest hits.
 */

const HOP = 0.01; // seconds
export const BEATS_VERSION = 2;

export type MusicSection = { start: number; end: number; energy: number; label: string };

/**
 * What an editor hears first in a track: how much of it is bass, how bright its top is, and how much
 * it moves. Calibrated on tracks a viewer judged: the one called "bass-heavy, really bad" under a
 * product film put 60% of its energy below ~150 Hz; well-liked score cues sat at 22–26%.
 */
export type MusicProfile = { bass: number; brightness: number; dynamicsDb: number; tags: string[] };

export type MusicAnalysis = {
  bpm: number;
  beats: number[];
  /** Bar starts (beat 1). */
  downbeats: number[];
  sections: MusicSection[];
  /** Strongest accents, in time order. */
  hits: number[];
  profile?: MusicProfile;
  /** 2: beats tracked on the onsets (older analyses used a fixed grid that drifted). */
  beatsVersion?: number;
  /** Seconds until the track first reaches half its full loudness (a long intro needs trimming or a later start). */
  introSec?: number;
};

export const profileOf = (x: Float32Array, sr: number): MusicProfile => {
  const lowPass = (input: Float32Array, fc: number) => {
    const a = Math.exp((-2 * Math.PI * fc) / sr);
    const y = new Float32Array(input.length);
    let s = 0;
    for (let i = 0; i < input.length; i++) {
      s = (1 - a) * input[i] + a * s;
      y[i] = s;
    }
    return y;
  };
  let total = 0;
  for (const v of x) total += v * v;
  total ||= 1;
  // Two one-pole stages at 150 Hz for the lows; what a one-pole at 4 kHz removes for the top.
  const low = lowPass(lowPass(x, 150), 150);
  const top = lowPass(x, 4000);
  let lowE = 0;
  let highE = 0;
  for (let i = 0; i < x.length; i++) {
    lowE += low[i] * low[i];
    const d = x[i] - top[i];
    highE += d * d;
  }
  // Loudness range over 400 ms windows, ignoring silence.
  const win = Math.round(sr * 0.4);
  const db: number[] = [];
  for (let i = 0; i + win <= x.length; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += x[j] * x[j];
    const v = 10 * Math.log10(s / win + 1e-12);
    if (v > -50) db.push(v);
  }
  const dynamicsDb = db.length ? percentile(db, 0.9) - percentile(db, 0.1) : 0;
  const bass = lowE / total;
  const brightness = highE / total;
  const tags: string[] = [];
  if (bass > 0.4)
    tags.push("bass-heavy (club, trailer or hip-hop low end: muddy under a voice, a calm explainer or a minimal product film)");
  else if (bass < 0.28) tags.push("light low end");
  if (brightness < 0.002) tags.push("dark, muffled top");
  else if (brightness > 0.006) tags.push("bright, airy top");
  if (dynamicsDb < 6) tags.push("flat dynamics (little build or release)");
  else if (dynamicsDb > 12) tags.push("dynamic (quiet passages and big lifts)");
  return {
    bass: Math.round(bass * 100) / 100,
    brightness: Math.round(brightness * 10000) / 10000,
    dynamicsDb: Math.round(dynamicsDb * 10) / 10,
    tags,
  };
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))] ?? 0;
};

export const detectBeats = async (src: string): Promise<MusicAnalysis> => {
  const res = await fetch(src);
  const buf = await res.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 22050);
  const audio = await ctx.decodeAudioData(buf);
  // Mono mix.
  const data = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < ch.length; i++) data[i] += ch[i] / audio.numberOfChannels;
  }
  return analyzeMusic(data, audio.sampleRate);
};

/**
 * Dynamic-programming beat tracking (Ellis 2007): each beat sits on a strong onset while the spacing
 * stays close to the tempo, so the beats follow the music instead of drifting off a fixed period
 * (a fixed grid was 100+ ms off two minutes into a track: cuts "on the beat" visibly missed it).
 */
const trackBeats = (onset: Float32Array, period: number, tightness = 100): number[] => {
  const n = onset.length;
  let mean = 0;
  for (const v of onset) mean += v;
  mean /= Math.max(1, n);
  let variance = 0;
  for (const v of onset) variance += (v - mean) ** 2;
  const std = Math.sqrt(variance / Math.max(1, n)) || 1;
  const o = Float64Array.from(onset, (v) => v / std);
  const score = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  for (let t = 0; t < n; t++) {
    let best = -Infinity;
    let arg = -1;
    const from = Math.max(0, Math.round(t - 2 * period));
    const to = Math.round(t - period / 2);
    for (let p = from; p <= to; p++) {
      const v = score[p] - tightness * Math.log((t - p) / period) ** 2;
      if (v > best) {
        best = v;
        arg = p;
      }
    }
    if (arg >= 0 && best > 0) {
      score[t] = o[t] + best;
      back[t] = arg;
    } else score[t] = o[t];
  }
  // The best-scoring beat in the last period, then back through the chain.
  let t = n - 1;
  for (let k = Math.max(0, Math.round(n - period)); k < n; k++) if (score[k] > score[t]) t = k;
  const beats: number[] = [];
  for (; t >= 0; t = back[t]) beats.push(t);
  beats.reverse();
  // Before the chain starts (a quiet intro), extend it backwards at the tempo.
  while (beats.length && beats[0] - period >= 0) beats.unshift(Math.round(beats[0] - period));
  return beats;
};

/** Beats, bars, sections and hits of a mono signal. Pure, so it runs (and is tested) outside a browser. */
export const analyzeMusic = (data: Float32Array, sr: number): MusicAnalysis => {
  // One-pole low-pass (~150 Hz) emphasises kicks and bass.
  const a = Math.exp((-2 * Math.PI * 150) / sr);
  let y = 0;
  const hop = Math.round(sr * HOP);
  // The real hop length (221 samples at 22.05 kHz is 10.023 ms, not 10): frame times use it, or every
  // beat drifts 0.23% late, 136 ms by the one-minute mark.
  const hopSec = hop / sr;
  const frames = Math.floor(data.length / hop);
  const energy = new Float32Array(frames);
  /** Energy above ~2 kHz per hop (snares, claps, hats), so backbeats count as beats too. */
  const treble = new Float32Array(frames);
  const b = Math.exp((-2 * Math.PI * 2000) / sr);
  let z = 0;
  /** Broadband loudness per hop (linear RMS), for sections and hits. */
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    let high = 0;
    let broad = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) {
      y = (1 - a) * data[i] + a * y;
      z = (1 - b) * data[i] + b * z;
      sum += y * y + data[i] * data[i] * 0.15;
      high += (data[i] - z) ** 2;
      broad += data[i] * data[i];
    }
    energy[f] = Math.log1p((sum / hop) * 1000);
    treble[f] = Math.log1p((high / hop) * 1000);
    rms[f] = Math.sqrt(broad / hop);
  }
  // Onset envelope = positive energy flux of the lows (kicks, bass) plus the highs (snares, hats),
  // the highs weighted to about half the lows' total so a drum-free track isn't steered by hiss.
  const onset = new Float32Array(frames);
  const highFlux = new Float32Array(frames);
  let lowTotal = 0;
  let highTotal = 0;
  for (let f = 1; f < frames; f++) {
    onset[f] = Math.max(0, energy[f] - energy[f - 1]);
    highFlux[f] = Math.max(0, treble[f] - treble[f - 1]);
    lowTotal += onset[f];
    highTotal += highFlux[f];
  }
  const highWeight = highTotal > 0 ? (0.5 * lowTotal) / highTotal : 0;
  for (let f = 1; f < frames; f++) onset[f] += highWeight * highFlux[f];
  let mean = 0;
  for (const v of onset) mean += v;
  mean /= Math.max(1, frames);
  for (let f = 0; f < frames; f++) onset[f] = Math.max(0, onset[f] - mean);

  // Tempo by autocorrelation.
  const minLag = Math.round(60 / 190 / hopSec);
  const maxLag = Math.round(60 / 60 / hopSec);
  let bestLag = Math.round(0.5 / hopSec);
  let bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = lag; f < frames; f++) s += onset[f] * onset[f - lag];
    const bpm = 60 / (lag * hopSec);
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
    const score = s * prior;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  // Octave check: a kick-snare pattern repeats every two beats, so the autocorrelation can prefer half
  // the tempo. When the points halfway between those beats hit nearly as hard as the beats, the beat is
  // twice as fast (a ballad's off-beat hi-hats stay well below that).
  const half = bestLag / 2;
  if (60 / (half * hopSec) <= 190) {
    const peak = (f: number) => Math.max(onset[f] ?? 0, onset[f - 1] ?? 0, onset[f + 1] ?? 0);
    let on = -1;
    let phase = 0;
    for (let p = 0; p < bestLag; p++) {
      let s = 0;
      for (let f = p; f < frames; f += bestLag) s += peak(f);
      if (s > on) {
        on = s;
        phase = p;
      }
    }
    let mid = 0;
    for (let f = phase + half; f < frames; f += bestLag) mid += peak(Math.round(f));
    const ratio = mid / Math.max(1e-9, on);
    // Weighed by how likely each tempo is (130 is common, 180 rare): a 90 BPM strum with busy eighths stays at 90.
    const tempoPrior = (lag: number) => Math.exp(-0.5 * (Math.log2(60 / (lag * hopSec) / 120) / 0.9) ** 2);
    if (ratio >= 0.6 && ratio * tempoPrior(half) >= tempoPrior(bestLag)) bestLag = Math.round(half);
  }
  // A fractional period from the autocorrelation peak (parabolic fit), then beats tracked on the onsets.
  const autocorr = (lag: number) => {
    let s = 0;
    for (let f = lag; f < frames; f++) s += onset[f] * onset[f - lag];
    return s;
  };
  const y0 = autocorr(bestLag - 1);
  const y1 = autocorr(bestLag);
  const y2 = autocorr(bestLag + 1);
  const curvature = y0 - 2 * y1 + y2;
  const period = bestLag + (curvature < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / curvature)) : 0);
  const beatFrames = trackBeats(onset, period);
  const beats = beatFrames.map((f) => r3(f * hopSec));
  const span = beatFrames.length > 1 ? (beatFrames[beatFrames.length - 1] - beatFrames[0]) / (beatFrames.length - 1) : period;
  const bpm = Math.round((60 / (span * hopSec)) * 10) / 10;

  // Downbeats: in 4/4 the kick usually lands hardest on beat 1, so pick the bar phase with the most low-end accent.
  const accent = (f: number) => energy[f] + 2 * Math.max(onset[f] ?? 0, onset[f + 1] ?? 0, onset[f - 1] ?? 0);
  let barPhase = 0;
  let barScore = -1;
  for (let p = 0; p < 4; p++) {
    let s = 0;
    for (let i = p; i < beatFrames.length; i += 4) s += accent(beatFrames[i]);
    if (s > barScore) {
      barScore = s;
      barPhase = p;
    }
  }
  const barStarts: number[] = [];
  for (let i = barPhase; i < beatFrames.length; i += 4) barStarts.push(beatFrames[i]);
  const downbeats = barStarts.map((f) => r3(f * hopSec));

  // Sections: loudness per 4-bar phrase, merged where it barely changes, labelled by energy.
  const duration = frames * hopSec;
  const phraseBars = 4;
  const phrases: { start: number; end: number; level: number }[] = [];
  for (let i = 0; i < barStarts.length; i += phraseBars) {
    const from = i === 0 ? 0 : barStarts[i];
    const to = barStarts[i + phraseBars] ?? frames;
    let s = 0;
    for (let f = from; f < to; f++) s += rms[f];
    phrases.push({ start: from * hopSec, end: to * hopSec, level: s / Math.max(1, to - from) });
  }
  const lo = percentile(
    phrases.map((p) => p.level),
    0.05,
  );
  const hi = percentile(
    phrases.map((p) => p.level),
    0.95,
  );
  const norm = (v: number) => (hi > lo ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : 0.5);
  const barSec = span * hopSec * 4;
  const merged: { start: number; end: number; energy: number; n: number }[] = [];
  for (const p of phrases) {
    const e = norm(p.level);
    const last = merged[merged.length - 1];
    if (last && p.end - p.start < barSec) {
      // A sliver shorter than a bar (the track's tail) belongs to the section before it.
      last.end = p.end;
    } else if (last && Math.abs(last.energy - e) < 0.18) {
      last.energy = (last.energy * last.n + e) / (last.n + 1);
      last.n += 1;
      last.end = p.end;
    } else merged.push({ start: p.start, end: p.end, energy: e, n: 1 });
  }
  const sections: MusicSection[] = merged.map((m, i) => {
    const prev = merged[i - 1];
    let label = m.energy >= 0.66 ? "high" : m.energy >= 0.33 ? "mid" : "low";
    if (prev && m.energy - prev.energy >= 0.3) label = m.energy >= 0.66 ? "drop" : "build";
    if (i === 0 && m.energy < 0.66) label = "intro";
    if (i === merged.length - 1 && i > 0 && m.energy < prev.energy) label = "outro";
    return { start: r3(m.start), end: r3(Math.min(duration, m.end)), energy: Math.round(m.energy * 100) / 100, label };
  });

  // Hits: the strongest broadband onsets, at least half a second apart.
  const flux = new Float32Array(frames);
  for (let f = 1; f < frames; f++) flux[f] = Math.max(0, rms[f] - rms[f - 1]);
  const candidates: number[] = [];
  for (let f = 2; f < frames - 2; f++) {
    if (flux[f] > 0 && flux[f] >= flux[f - 1] && flux[f] >= flux[f + 1] && flux[f] >= flux[f - 2] && flux[f] >= flux[f + 2])
      candidates.push(f);
  }
  candidates.sort((p, q) => flux[q] - flux[p]);
  const picked: number[] = [];
  for (const f of candidates) {
    if (picked.length >= 24) break;
    if (picked.every((g) => Math.abs(g - f) * hopSec >= 0.5)) picked.push(f);
  }
  const hits = picked.sort((p, q) => p - q).map((f) => r3(f * hopSec));

  // Intro: the first second-long stretch at half the track's full (90th percentile) loudness.
  const perSec = Math.max(1, Math.round(1 / hopSec));
  const loud: number[] = [];
  for (let f = 0; f + perSec <= frames; f += perSec) {
    let sum = 0;
    for (let k = f; k < f + perSec; k++) sum += rms[k];
    loud.push(sum / perSec);
  }
  const full = percentile(loud, 0.9);
  const firstLoud = loud.findIndex((v) => v >= 0.5 * full);
  const introSec = Math.max(0, firstLoud) * perSec * hopSec;
  return {
    bpm,
    beats,
    downbeats,
    sections,
    hits,
    profile: profileOf(data, sr),
    beatsVersion: BEATS_VERSION,
    introSec: Math.round(introSec),
  };
};

/**
 * A track's profile straight from its URL (through the app's media proxy), from its first 90 s:
 * lets a search show how candidates actually sound before one is imported. Null when it can't be read.
 */
export const profileFromUrl = async (
  url: string,
  timeoutMs = 20_000,
): Promise<(MusicProfile & { bpm: number; introSec: number }) | null> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const ctx = new OfflineAudioContext(1, 1, 22050);
    const audio = await ctx.decodeAudioData(await res.arrayBuffer());
    const n = Math.min(audio.length, Math.round(audio.sampleRate * 90));
    const data = new Float32Array(n);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c);
      for (let i = 0; i < n; i++) data[i] += ch[i] / audio.numberOfChannels;
    }
    // Tempo and intro from the same 90 s (the beat map of the whole track comes with detect_beats).
    const rhythm = analyzeMusic(data, audio.sampleRate);
    return { ...(rhythm.profile ?? profileOf(data, audio.sampleRate)), bpm: rhythm.bpm, introSec: rhythm.introSec ?? 0 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
