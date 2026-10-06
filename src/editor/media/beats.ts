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

export type MusicSection = { start: number; end: number; energy: number; label: string };

export type MusicAnalysis = {
  bpm: number;
  beats: number[];
  /** Bar starts (beat 1). */
  downbeats: number[];
  sections: MusicSection[];
  /** Strongest accents, in time order. */
  hits: number[];
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
  const sr = audio.sampleRate;
  // Mono mix.
  const data = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < ch.length; i++) data[i] += ch[i] / audio.numberOfChannels;
  }
  // One-pole low-pass (~150 Hz) emphasises kicks and bass.
  const a = Math.exp((-2 * Math.PI * 150) / sr);
  let y = 0;
  const hop = Math.round(sr * HOP);
  const frames = Math.floor(data.length / hop);
  const energy = new Float32Array(frames);
  /** Broadband loudness per hop (linear RMS), for sections and hits. */
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    let broad = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) {
      y = (1 - a) * data[i] + a * y;
      sum += y * y + data[i] * data[i] * 0.15;
      broad += data[i] * data[i];
    }
    energy[f] = Math.log1p((sum / hop) * 1000);
    rms[f] = Math.sqrt(broad / hop);
  }
  // Onset envelope = positive energy flux, mean-normalised.
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, energy[f] - energy[f - 1]);
  let mean = 0;
  for (const v of onset) mean += v;
  mean /= Math.max(1, frames);
  for (let f = 0; f < frames; f++) onset[f] = Math.max(0, onset[f] - mean);

  // Tempo by autocorrelation.
  const minLag = Math.round(60 / 190 / HOP);
  const maxLag = Math.round(60 / 60 / HOP);
  let bestLag = Math.round(0.5 / HOP);
  let bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = lag; f < frames; f++) s += onset[f] * onset[f - lag];
    const bpm = 60 / (lag * HOP);
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
    const score = s * prior;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  // Phase: offset whose grid collects the most onset energy.
  let bestPhase = 0;
  let bestPhaseScore = -1;
  for (let p = 0; p < bestLag; p++) {
    let s = 0;
    for (let f = p; f < frames; f += bestLag) s += onset[f] + 0.5 * (onset[f - 1] ?? 0) + 0.5 * (onset[f + 1] ?? 0);
    if (s > bestPhaseScore) {
      bestPhaseScore = s;
      bestPhase = p;
    }
  }
  const beatFrames: number[] = [];
  for (let f = bestPhase; f < frames; f += bestLag) beatFrames.push(f);
  const beats = beatFrames.map((f) => r3(f * HOP));
  const bpm = Math.round((60 / (bestLag * HOP)) * 10) / 10;

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
  const downbeats = barStarts.map((f) => r3(f * HOP));

  // Sections: loudness per 4-bar phrase, merged where it barely changes, labelled by energy.
  const duration = frames * HOP;
  const phraseBars = 4;
  const phrases: { start: number; end: number; level: number }[] = [];
  for (let i = 0; i < barStarts.length; i += phraseBars) {
    const from = i === 0 ? 0 : barStarts[i];
    const to = barStarts[i + phraseBars] ?? frames;
    let s = 0;
    for (let f = from; f < to; f++) s += rms[f];
    phrases.push({ start: from * HOP, end: to * HOP, level: s / Math.max(1, to - from) });
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
  const barSec = bestLag * HOP * 4;
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
    if (picked.every((g) => Math.abs(g - f) * HOP >= 0.5)) picked.push(f);
  }
  const hits = picked.sort((p, q) => p - q).map((f) => r3(f * HOP));

  return { bpm, beats, downbeats, sections, hits };
};
