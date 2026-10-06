"use client";

import type { Asset, CaptionWord } from "@/core/schema";
import { useAgentStore } from "../store/agent-store";

/**
 * Local transcription with Whisper on WebGPU (runs on the user's GPU, nothing
 * leaves the machine). The model downloads once and is cached by the browser.
 */

const MODEL = "small.en" as const;

export const transcribeLocally = async (asset: Asset): Promise<{ words: CaptionWord[]; language?: string }> => {
  const whisper = await import("@remotion/whisper-webgpu");
  const support = await whisper.canUseWhisperWebGpu();
  if (!support.supported) {
    throw new Error(
      `Local transcription needs WebGPU (${support.detailedReason ?? "not supported"}). Pick a cloud engine in Settings → Transcription.`,
    );
  }
  const status = (text: string) => useAgentStore.getState().setStatus("working", text);
  const res = await fetch(asset.src);
  if (!res.ok) throw new Error(`Could not read ${asset.name}`);
  const blob = await res.blob();
  status("Preparing audio…");
  const waveform = await whisper.resampleTo16Khz({ file: blob });
  await whisper.downloadWhisperModel({
    model: MODEL,
    onProgress: (p) => status(`Downloading speech model ${Math.round(p.progress * 100)}% (first time only)`),
  });
  status("Transcribing on your GPU…");
  const result = await whisper.transcribe({ channelWaveform: waveform, model: MODEL });
  const words: CaptionWord[] = result.words.map((w, i) => ({
    text: i === 0 ? w.text.trimStart() : w.text.startsWith(" ") ? w.text : ` ${w.text}`,
    startMs: Math.round(w.startInSeconds * 1000),
    endMs: Math.round(w.endInSeconds * 1000),
    timestampMs: Math.round(((w.startInSeconds + w.endInSeconds) / 2) * 1000),
    confidence: null,
  }));
  return { words, language: "en" };
};
