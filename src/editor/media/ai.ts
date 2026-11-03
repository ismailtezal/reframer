"use client";

import { transcriptText } from "@/core/captions";
import { updateAsset } from "@/core/ops";
import type { Asset, CaptionWord, Transcript } from "@/core/schema";
import { getProject, transact } from "../store/project-store";
import { BEATS_VERSION, detectBeats, type MusicAnalysis } from "./beats";
import { importFiles, importFromUrl } from "./import";
import { LOCAL_TTS_RATE, looksEnglish, speakLocally } from "./local-tts";

/**
 * Client side of AI media features. Heavy lifting either happens locally in
 * the browser (Whisper on WebGPU, beat detection) or through the local server
 * with the user's own provider keys.
 */

const json = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
};

const SPEECH_RATE = 16_000;
/** 10 minutes of 16 kHz mono 16-bit audio is ~19 MB, under the common 25 MB upload limit. */
const CHUNK_SECONDS = 600;

/** Decodes any audio or video file's sound to mono at the given sample rate. */
const decodeMono = async (src: string, sampleRate: number): Promise<Float32Array> => {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Could not read the media file");
  const ctx = new OfflineAudioContext(1, 1, sampleRate);
  const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
  const out = new Float32Array(decoded.length);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const ch = decoded.getChannelData(c);
    for (let i = 0; i < ch.length; i++) out[i] += ch[i] / decoded.numberOfChannels;
  }
  return out;
};

/** 16-bit PCM mono WAV. */
const encodeWav = (samples: Float32Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
};

const saveTranscript = (assetId: string, transcript: Transcript) => {
  transact("Store transcript", (d) => updateAsset(d, assetId, { transcript }), { silent: true });
};

/** Returns the asset's transcript, transcribing it first if needed. */
export const transcribeAsset = async (assetId: string): Promise<Transcript> => {
  const asset = getProject().assets[assetId];
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  if (asset.transcript) return asset.transcript;
  if (asset.type !== "video" && asset.type !== "audio") throw new Error("Only video or audio can be transcribed.");
  const settings = await json<{ transcription: string }>(await fetch("/api/settings"));
  let words: CaptionWord[];
  let language: string | undefined;
  let engine: string;
  if (settings.transcription === "local") {
    const { transcribeLocally } = await import("./whisper");
    const out = await transcribeLocally(asset);
    words = out.words;
    language = out.language;
    engine = "whisper-webgpu";
  } else {
    // Extract speech-quality audio here so uploads stay small (16 kHz mono ≈ 2 MB per minute),
    // then send it in chunks that fit provider limits.
    const samples = await decodeMono(asset.src, SPEECH_RATE);
    const chunk = SPEECH_RATE * CHUNK_SECONDS;
    words = [];
    engine = settings.transcription;
    for (let start = 0; start < samples.length; start += chunk) {
      const out = await json<{ words: CaptionWord[]; language?: string; engine: string }>(
        await fetch(`/api/ai/transcribe?offset=${start / SPEECH_RATE}`, {
          method: "POST",
          headers: { "content-type": "audio/wav" },
          body: encodeWav(samples.subarray(start, Math.min(samples.length, start + chunk)), SPEECH_RATE),
        }),
      );
      words.push(...out.words);
      language ??= out.language;
      engine = out.engine;
    }
    if (words[0]) words[0] = { ...words[0], text: words[0].text.trimStart() };
  }
  const transcript: Transcript = { words, language, text: transcriptText(words), engine };
  saveTranscript(assetId, transcript);
  return transcript;
};

export const detectBeatsForAsset = async (assetId: string): Promise<MusicAnalysis> => {
  const asset = getProject().assets[assetId];
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  const a = asset.analysis;
  if (a?.beats && a.bpm && a.downbeats && a.sections && a.hits && a.profile && (a.beatsVersion ?? 1) >= BEATS_VERSION) {
    return {
      bpm: a.bpm,
      beats: a.beats,
      downbeats: a.downbeats,
      sections: a.sections,
      hits: a.hits,
      profile: a.profile,
      beatsVersion: a.beatsVersion,
    };
  }
  const result = await detectBeats(asset.src);
  transact("Store beat analysis", (d) => updateAsset(d, assetId, { analysis: { ...asset.analysis, ...result } }), { silent: true });
  return result;
};

/** Downloads remote media through the local server (avoids CORS) and imports it. */
export const importMediaUrl = async (
  url: string,
  name?: string,
  credit?: { attribution?: string; license?: string; provider?: string },
): Promise<Asset> => {
  const proxied = `/api/fetch?url=${encodeURIComponent(url)}`;
  const fileName = name ?? decodeURIComponent(new URL(url).pathname.split("/").pop() || "media");
  return importFromUrl(proxied, fileName, { url, ...credit }, credit?.license ? "stock" : "url");
};

export type StockResult = {
  id: string;
  type: "video" | "photo";
  url: string;
  preview: string;
  /** Four moments across a video, for the contact sheet. */
  previews?: string[];
  title?: string;
  license?: string;
  licenseUrl?: string;
  width: number;
  height: number;
  durationSec?: number;
  author?: string;
  attribution?: string;
};

export type AudioSearchResult = {
  id: string;
  kind: "music" | "sfx";
  title: string;
  creator?: string;
  source: string;
  durationSec?: number;
  url: string;
  license: string;
  licenseUrl?: string;
  attribution?: string;
  tags: string[];
  genre?: string;
  bpm?: number;
  description?: string;
};

/** Free-to-use music and recorded sound effects (see src/server/audio-library.ts). */
export const searchAudioLibrary = async (input: {
  kind: "music" | "sfx";
  query: string;
  minSec?: number;
  maxSec?: number;
  limit?: number;
}) => {
  const params = new URLSearchParams({ kind: input.kind, q: input.query });
  if (input.minSec !== undefined) params.set("minSec", String(input.minSec));
  if (input.maxSec !== undefined) params.set("maxSec", String(input.maxSec));
  if (input.limit !== undefined) params.set("limit", String(input.limit));
  return json<{ results: AudioSearchResult[] }>(await fetch(`/api/audio/search?${params}`));
};

export const searchStock = async (query: string, type: "video" | "photo", orientation?: string) =>
  json<{ results: StockResult[]; note?: string }>(
    await fetch(`/api/stock?query=${encodeURIComponent(query)}&type=${type}${orientation ? `&orientation=${orientation}` : ""}`),
  );

export const generateImageAsset = async (prompt: string, aspect: string): Promise<Asset> => {
  const res = await fetch("/api/ai/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, aspect }),
  });
  if (!res.ok) await json(res);
  const blob = await res.blob();
  const model = res.headers.get("x-model") ?? undefined;
  const file = new File([blob], `${prompt.slice(0, 40).replace(/[^\w-]+/g, "-")}.png`, { type: blob.type || "image/png" });
  const [asset] = await importFiles([file]);
  if (!asset) throw new Error("Could not import the generated image");
  transact("Tag generated image", (d) => updateAsset(d, asset.id, { source: "generated", origin: { prompt, model } }), { silent: true });
  return getProject().assets[asset.id] ?? asset;
};

export type MusicRequest = {
  styles: string[];
  avoid?: string[];
  sections?: { name?: string; durationSec: number; styles?: string[]; avoid?: string[] }[];
  durationSec?: number;
  instrumental?: boolean;
};

/** Composes music for the edit (ElevenLabs Music with the user's key) and imports it as an asset. */
export const generateMusicAsset = async (req: MusicRequest): Promise<Asset> => {
  const res = await fetch("/api/ai/music", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) await json(res);
  const blob = await res.blob();
  const model = res.headers.get("x-model") ?? undefined;
  const file = new File([blob], `music-${Date.now()}.mp3`, { type: blob.type || "audio/mpeg" });
  const [asset] = await importFiles([file]);
  if (!asset) throw new Error("Could not import the music");
  const prompt = [
    req.styles.join(", "),
    ...(req.sections ?? []).map((s) => `${s.name ?? "part"} (${s.durationSec}s): ${(s.styles ?? []).join(", ")}`),
  ].join(" | ");
  transact("Tag music", (d) => updateAsset(d, asset.id, { source: "generated", origin: { prompt, model } }), { silent: true });
  return getProject().assets[asset.id] ?? asset;
};

/** Why the last voiceover used the local voice instead of the cloud one (null when it didn't). */
export let lastVoiceoverFallback: string | null = null;

/** The free voice on this computer (English): the cloud has no key, no credits, or refused. */
const localVoiceoverAsset = async (text: string, voice: string | undefined, onProgress?: (text: string) => void): Promise<Asset> => {
  const { samples, words, voice: id } = await speakLocally(text, { voice, onProgress });
  const file = new File([encodeWav(samples, LOCAL_TTS_RATE)], `voiceover-${Date.now()}.wav`, { type: "audio/wav" });
  const [asset] = await importFiles([file]);
  if (!asset) throw new Error("Could not import the voiceover");
  const model = `local:kokoro-82m:${id}`;
  transact("Tag voiceover", (d) => updateAsset(d, asset.id, { source: "generated", origin: { prompt: text, model } }), { silent: true });
  if (words.length) saveTranscript(asset.id, { words, text: transcriptText(words), engine: model });
  return getProject().assets[asset.id] ?? asset;
};

export const generateVoiceoverAsset = async (text: string, voice?: string, onProgress?: (text: string) => void): Promise<Asset> => {
  lastVoiceoverFallback = null;
  const res = await fetch("/api/ai/speech", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, voice, timestamps: true }),
  }).catch(() => null);
  if (!res?.ok) {
    const reason = res
      ? (((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${res.status}`)
      : "no connection";
    if (!looksEnglish(text)) throw new Error(`${reason} (the free local voice only speaks English)`);
    lastVoiceoverFallback = reason;
    return localVoiceoverAsset(text, voice, onProgress);
  }
  // ElevenLabs answers with JSON (audio + word timing); OpenAI with the mp3 itself.
  let blob: Blob;
  let model: string | undefined;
  let words: CaptionWord[] = [];
  if (res.headers.get("content-type")?.includes("application/json")) {
    const data = (await res.json()) as { audio: string; mimeType: string; model?: string; words?: CaptionWord[] };
    blob = new Blob([Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))], { type: data.mimeType });
    model = data.model;
    words = data.words ?? [];
  } else {
    blob = await res.blob();
    model = res.headers.get("x-model") ?? undefined;
  }
  const file = new File([blob], `voiceover-${Date.now()}.mp3`, { type: blob.type || "audio/mpeg" });
  const [asset] = await importFiles([file]);
  if (!asset) throw new Error("Could not import the voiceover");
  transact("Tag voiceover", (d) => updateAsset(d, asset.id, { source: "generated", origin: { prompt: text, model } }), { silent: true });
  // The script and its timing are known exactly, so captions and cuts need no transcription.
  if (words.length) saveTranscript(asset.id, { words, text: transcriptText(words), engine: model ?? "tts" });
  return getProject().assets[asset.id] ?? asset;
};
