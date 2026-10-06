"use client";

/**
 * Lightweight beat tracking in the browser:
 * 1) onset strength from the energy of a low-passed signal (10 ms hops),
 * 2) tempo via autocorrelation over 60–190 BPM with a gentle prior near 120,
 * 3) phase that best lines the beat grid up with onsets.
 */

const HOP = 0.01; // seconds

export const detectBeats = async (src: string): Promise<{ bpm: number; beats: number[] }> => {
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
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) {
      y = (1 - a) * data[i] + a * y;
      sum += y * y + data[i] * data[i] * 0.15;
    }
    energy[f] = Math.log1p((sum / hop) * 1000);
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
  const beats: number[] = [];
  for (let f = bestPhase; f < frames; f += bestLag) beats.push(Math.round(f * HOP * 1000) / 1000);
  const bpm = Math.round((60 / (bestLag * HOP)) * 10) / 10;
  return { bpm, beats };
};
