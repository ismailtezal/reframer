"use client";

import { ALL_FORMATS, AudioSampleSink, BlobSource, CanvasSink, Input, UrlSource } from "mediabunny";

/**
 * In-browser media analysis with Mediabunny (WebCodecs): metadata, poster
 * thumbnails, waveforms and filmstrips. No server-side ffmpeg required.
 */

export type MediaProbe = {
  kind: "video" | "audio" | "image";
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio?: boolean;
};

export const mediaKindOf = (file: File): MediaProbe["kind"] | "lut" | null => {
  if (file.name.toLowerCase().endsWith(".cube")) return "lut";
  if (file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|m4v)$/i.test(file.name)) return "video";
  if (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)) return "audio";
  if (file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.name)) return "image";
  return null;
};

const canvasToDataUrl = async (canvas: HTMLCanvasElement | OffscreenCanvas, quality = 0.72): Promise<string> => {
  if ("convertToBlob" in canvas) {
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  return canvas.toDataURL("image/jpeg", quality);
};

export const probeImage = async (file: Blob): Promise<{ probe: MediaProbe; thumbnail?: string }> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const thumbnail = await canvasToDataUrl(canvas);
  const probe: MediaProbe = { kind: "image", width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return { probe, thumbnail };
};

export const probeMedia = async (file: Blob): Promise<{ probe: MediaProbe; thumbnail?: string; waveform?: number[] }> => {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const durationSec = await input.computeDuration();
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    let thumbnail: string | undefined;
    let fps: number | undefined;
    if (video && (await video.canDecode())) {
      const stats = await video.computePacketStats(60).catch(() => null);
      fps = stats?.averagePacketRate ? Math.round(stats.averagePacketRate * 100) / 100 : undefined;
      const sink = new CanvasSink(video, { width: 320, fit: "contain" });
      const frame = await sink.getCanvas(Math.min(1, durationSec / 3));
      if (frame) thumbnail = await canvasToDataUrl(frame.canvas);
    }
    const waveform = audio ? await computeWaveform(input).catch(() => undefined) : undefined;
    return {
      probe: {
        kind: video ? "video" : "audio",
        durationSec,
        width: video?.displayWidth,
        height: video?.displayHeight,
        fps,
        hasAudio: !!audio,
      },
      thumbnail,
      waveform,
    };
  } finally {
    input.dispose();
  }
};

/** Peak amplitudes normalised to 0..1, at most ~50 points/s and 4000 points total. */
export const computeWaveform = async (input: Input): Promise<number[] | undefined> => {
  const track = await input.getPrimaryAudioTrack();
  if (!track || !(await track.canDecode())) return undefined;
  const duration = await input.computeDuration();
  const points = Math.max(32, Math.min(4000, Math.round(duration * 50)));
  const bucketSec = duration / points;
  const peaks = new Float32Array(points);
  const sink = new AudioSampleSink(track);
  for await (const sample of sink.samples()) {
    const frames = sample.numberOfFrames;
    const data = new Float32Array(frames);
    sample.copyTo(data, { planeIndex: 0, format: "f32-planar" });
    const start = sample.timestamp;
    const step = Math.max(1, Math.floor(frames / 64));
    for (let i = 0; i < frames; i += step) {
      const t = start + i / sample.sampleRate;
      const b = Math.min(points - 1, Math.max(0, Math.floor(t / bucketSec)));
      const v = Math.abs(data[i]);
      if (v > peaks[b]) peaks[b] = v;
    }
    sample.close();
  }
  let max = 0;
  for (const p of peaks) max = Math.max(max, p);
  const norm = max > 0 ? 1 / max : 1;
  return Array.from(peaks, (p) => Math.round(Math.min(1, p * norm) * 100) / 100);
};

const filmstripCache = new Map<string, Promise<string[]>>();

/** Small frames across a video for the timeline filmstrip. Cached per URL. */
export const getFilmstrip = (src: string, durationSec: number, count = 12): Promise<string[]> => {
  const key = `${src}|${count}`;
  const cached = filmstripCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(src) });
    try {
      const video = await input.getPrimaryVideoTrack();
      if (!video || !(await video.canDecode())) return [];
      const sink = new CanvasSink(video, { height: 72, fit: "contain" });
      const times = Array.from({ length: count }, (_, i) => (durationSec * (i + 0.5)) / count);
      const out: string[] = [];
      for await (const frame of sink.canvasesAtTimestamps(times)) {
        out.push(frame ? await canvasToDataUrl(frame.canvas, 0.6) : "");
      }
      return out;
    } finally {
      input.dispose();
    }
  })().catch(() => []);
  filmstripCache.set(key, promise);
  return promise;
};
