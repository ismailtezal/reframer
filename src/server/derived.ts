import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { type ProbeResult, probe, runFfmpeg } from "./ffmpeg";
import { assertSafeId, CACHE_DIR, mediaDir, safeFileName } from "./paths";

/**
 * Derived media, made once per file with native FFmpeg and cached on disk:
 * probe data, a poster frame, filmstrip thumbnails and waveform peaks. The
 * editor loads these as small files instead of decoding video in the page.
 */

export const DERIVED_VERSION = 1;
const THUMB_HEIGHT = 90;
const PEAKS_PER_SECOND = 100;
const PEAK_SAMPLE_RATE = 8000;

export type ThumbLayout = { version: number; interval: number; count: number; width: number; height: number };

const sourcePath = (projectId: string, file: string) => path.join(mediaDir(assertSafeId(projectId)), safeFileName(file));
const derivedDir = (projectId: string, file: string) =>
  path.join(CACHE_DIR, "derived", `v${DERIVED_VERSION}`, assertSafeId(projectId), safeFileName(file));

// One generation per artifact at a time; later callers share the result.
const inflight = new Map<string, Promise<unknown>>();
const once = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
};

const exists = (p: string) =>
  fs.access(p).then(
    () => true,
    () => false,
  );

/** Writes into a temp directory and swaps it in, so readers never see half-written output. */
const atomicDir = async (dir: string, build: (tmp: string) => Promise<void>) => {
  const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
  await fs.mkdir(tmp, { recursive: true });
  try {
    await build(tmp);
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rename(tmp, dir);
  } catch (err) {
    await fs.rm(tmp, { recursive: true, force: true });
    throw err;
  }
};

export const getProbe = (projectId: string, file: string): Promise<ProbeResult> =>
  once(`probe:${projectId}/${file}`, async () => {
    const out = path.join(derivedDir(projectId, file), "probe.json");
    try {
      return JSON.parse(await fs.readFile(out, "utf8")) as ProbeResult;
    } catch {
      // not cached yet
    }
    const result = await probe(sourcePath(projectId, file));
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, JSON.stringify(result));
    return result;
  });

/** Filmstrip frames: at most ~240 per file, 0.5–4 s apart, 90 px tall. */
export const getThumbs = (projectId: string, file: string): Promise<ThumbLayout> =>
  once(`thumbs:${projectId}/${file}`, async () => {
    const dir = path.join(derivedDir(projectId, file), "thumbs");
    try {
      return JSON.parse(await fs.readFile(path.join(dir, "layout.json"), "utf8")) as ThumbLayout;
    } catch {
      // not cached yet
    }
    const info = await getProbe(projectId, file);
    if (!info.hasVideo) throw new Error("No video stream");
    const duration = Math.max(0.1, info.durationSec || 1);
    const interval = Math.round(Math.max(0.5, Math.min(4, duration / 240)) * 1000) / 1000;
    const width = info.width && info.height ? Math.max(2, Math.round(((info.width / info.height) * THUMB_HEIGHT) / 2) * 2) : 160;
    let layout: ThumbLayout | null = null;
    await atomicDir(dir, async (tmp) => {
      await runFfmpeg([
        "-v",
        "error",
        "-threads",
        "0",
        "-i",
        sourcePath(projectId, file),
        "-map",
        "0:v:0",
        "-an",
        "-sn",
        "-dn",
        "-vf",
        `scale=${width}:${THUMB_HEIGHT}:flags=bilinear`,
        "-r",
        String(1 / interval),
        "-q:v",
        "5",
        "-start_number",
        "0",
        path.join(tmp, "t%05d.jpg"),
      ]);
      const count = (await fs.readdir(tmp)).filter((f) => f.endsWith(".jpg")).length;
      layout = { version: DERIVED_VERSION, interval, count, width, height: THUMB_HEIGHT };
      await fs.writeFile(path.join(tmp, "layout.json"), JSON.stringify(layout));
    });
    return layout as unknown as ThumbLayout;
  });

export const thumbPath = (projectId: string, file: string, index: number) =>
  path.join(derivedDir(projectId, file), "thumbs", `t${String(Math.max(0, Math.floor(index))).padStart(5, "0")}.jpg`);

/** Image poster via libvips (handles PNG/JPEG/WebP/AVIF/GIF/SVG and keeps transparency). */
const imagePoster = async (projectId: string, file: string): Promise<{ path: string; type: string }> => {
  const out = path.join(derivedDir(projectId, file), "poster.webp");
  if (await exists(out)) return { path: out, type: "image/webp" };
  const sharp = (await import("sharp")).default;
  await fs.mkdir(path.dirname(out), { recursive: true });
  const tmp = `${out}.${Date.now()}.webp`;
  await sharp(sourcePath(projectId, file), { animated: false, limitInputPixels: false })
    .resize(320, 320, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(tmp);
  await fs.rename(tmp, out);
  return { path: out, type: "image/webp" };
};

/** A 320 px poster: a frame a third of the way into a video, or the image scaled down. */
export const getPoster = (projectId: string, file: string): Promise<{ path: string; type: string }> =>
  once(`poster:${projectId}/${file}`, async () => {
    const out = path.join(derivedDir(projectId, file), "poster.jpg");
    if (await exists(out)) return { path: out, type: "image/jpeg" };
    const info = await getProbe(projectId, file).catch(() => null);
    // Images (and anything FFmpeg can't read) go through libvips.
    if (!info?.hasVideo || info.durationSec < 0.05 || ["png", "mjpeg", "gif", "webp"].includes(info.videoCodec ?? "")) {
      return imagePoster(projectId, file);
    }
    await fs.mkdir(path.dirname(out), { recursive: true });
    const tmp = `${out}.${Date.now()}.jpg`;
    const at = info.durationSec > 0.2 ? Math.min(1, info.durationSec / 3) : 0;
    await runFfmpeg([
      "-v",
      "error",
      ...(at > 0 ? ["-ss", String(at)] : []),
      "-i",
      sourcePath(projectId, file),
      "-map",
      "0:v:0",
      "-frames:v",
      "1",
      "-vf",
      "scale='min(320,iw)':-2:flags=bicubic",
      "-q:v",
      "4",
      tmp,
    ]);
    await fs.rename(tmp, out);
    return { path: out, type: "image/jpeg" };
  });

/** Waveform peaks: one byte (0–255) per 10 ms of audio, mono. */
export const getPeaks = (projectId: string, file: string): Promise<Buffer> =>
  once(`peaks:${projectId}/${file}`, async () => {
    const out = path.join(derivedDir(projectId, file), "peaks.bin");
    try {
      return await fs.readFile(out);
    } catch {
      // not cached yet
    }
    const info = await getProbe(projectId, file);
    if (!info.hasAudio) throw new Error("No audio stream");
    const bucket = PEAK_SAMPLE_RATE / PEAKS_PER_SECOND;
    const peaks: number[] = [];
    let header: Buffer | null = Buffer.alloc(0);
    let carry: Buffer = Buffer.alloc(0);
    let max = 0;
    let inBucket = 0;
    const consume = (pcm: Buffer) => {
      const data = carry.length ? Buffer.concat([carry, pcm]) : pcm;
      const usable = data.length - (data.length % 2);
      for (let i = 0; i < usable; i += 2) {
        const v = Math.abs(data.readInt16LE(i));
        if (v > max) max = v;
        if (++inBucket >= bucket) {
          peaks.push(max);
          max = 0;
          inBucket = 0;
        }
      }
      carry = data.subarray(usable);
    };
    await runFfmpeg(
      [
        "-v",
        "error",
        "-i",
        sourcePath(projectId, file),
        "-map",
        "0:a:0",
        "-vn",
        "-ac",
        "1",
        "-ar",
        String(PEAK_SAMPLE_RATE),
        "-c:a",
        "pcm_s16le",
        "-map_metadata",
        "-1",
        "-f",
        "wav",
        "pipe:1",
      ],
      {
        onStdout: (chunk) => {
          if (header) {
            // Skip the WAV header: PCM starts after the "data" chunk header.
            header = Buffer.concat([header, chunk]);
            const at = header.indexOf("data");
            if (at < 0 || header.length < at + 8) return;
            const pcm = header.subarray(at + 8);
            header = null;
            consume(pcm);
          } else consume(chunk);
        },
      },
    );
    if (inBucket > 0) peaks.push(max);
    let loudest = 1;
    for (const p of peaks) if (p > loudest) loudest = p;
    // Normalised per file so quiet tracks still show shape.
    const bytes = Buffer.from(peaks.map((p) => Math.round((p / loudest) * 255)));
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, bytes);
    return bytes;
  });

export const PEAKS_RATE = PEAKS_PER_SECOND;

/** Starts derived work for a freshly uploaded file without waiting for it. */
export const warmDerived = (projectId: string, file: string) => {
  void getProbe(projectId, file)
    .then((info) => {
      if (info.hasVideo) {
        void getPoster(projectId, file).catch(() => undefined);
        if (info.durationSec > 0.2) void getThumbs(projectId, file).catch(() => undefined);
      }
      if (info.hasAudio) void getPeaks(projectId, file).catch(() => undefined);
    })
    .catch(() => {
      // Not media FFmpeg understands: try it as an image.
      void getPoster(projectId, file).catch(() => undefined);
    });
};
