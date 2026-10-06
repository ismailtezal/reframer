import "server-only";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Native FFmpeg for media work (probing, thumbnails, waveforms, proxies, fast
 * encodes). We reuse the FFmpeg build that ships with Remotion's compositor,
 * so there's nothing extra to install. `REFRAMER_FFMPEG_DIR` overrides it.
 */

const COMPOSITOR: Record<string, string> = {
  "win32-x64": "@remotion/compositor-win32-x64-msvc",
  "darwin-arm64": "@remotion/compositor-darwin-arm64",
  "darwin-x64": "@remotion/compositor-darwin-x64",
  "linux-x64": "@remotion/compositor-linux-x64-gnu",
  "linux-arm64": "@remotion/compositor-linux-arm64-gnu",
};

let binDir: string | null | undefined;

const findBinDir = (): string | null => {
  if (binDir !== undefined) return binDir;
  const fromEnv = process.env.REFRAMER_FFMPEG_DIR;
  const pkg = COMPOSITOR[`${process.platform}-${process.arch}`];
  const candidates = [
    fromEnv,
    pkg ? path.join(/*turbopackIgnore: true*/ process.cwd(), "node_modules", pkg) : undefined,
    pkg && process.platform === "linux" ? path.join(process.cwd(), "node_modules", pkg.replace("-gnu", "-musl")) : undefined,
  ].filter((p): p is string => !!p);
  const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  binDir = candidates.find((dir) => existsSync(path.join(dir, exe))) ?? null;
  return binDir;
};

export const ffmpegPath = () => {
  const dir = findBinDir();
  if (!dir) throw new Error("FFmpeg isn't available on this system.");
  return path.join(dir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
};

export const ffprobePath = () => {
  const dir = findBinDir();
  if (!dir) throw new Error("FFprobe isn't available on this system.");
  return path.join(dir, process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
};

export const hasFfmpeg = () => !!findBinDir();

export type RunOptions = {
  signal?: AbortSignal;
  /** Receives stdout chunks (for piped raw audio/video). */
  onStdout?: (chunk: Buffer) => void;
  /** Receives stderr lines (progress and errors). */
  onStderrLine?: (line: string) => void;
  /** Runs outside the shared queue (for long renders that manage their own concurrency). */
  unqueued?: boolean;
};

// Media jobs share a small pool so imports never starve the editor or a render.
const MAX_PARALLEL = 3;
let running = 0;
const waiting: (() => void)[] = [];

const acquire = () =>
  new Promise<void>((resolve) => {
    if (running < MAX_PARALLEL) {
      running++;
      resolve();
    } else waiting.push(() => resolve());
  });

const release = () => {
  const next = waiting.shift();
  if (next) next();
  else running--;
};

const exec = (bin: string, args: string[], opts: RunOptions): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(bin, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      reject(err);
      return;
    }
    const out: Buffer[] = [];
    let err = "";
    let lineBuf = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      if (opts.onStdout) opts.onStdout(chunk);
      else out.push(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      err = (err + text).slice(-8000);
      if (opts.onStderrLine) {
        lineBuf += text;
        const lines = lineBuf.split(/\r?\n|\r/);
        lineBuf = lines.pop() ?? "";
        for (const l of lines) if (l) opts.onStderrLine(l);
      }
    });
    const abort = () => child.kill("SIGKILL");
    opts.signal?.addEventListener("abort", abort, { once: true });
    child.on("error", reject);
    child.on("close", (code) => {
      opts.signal?.removeEventListener("abort", abort);
      if (opts.signal?.aborted) reject(new Error("Cancelled"));
      else if (code === 0) resolve({ stdout: Buffer.concat(out).toString(), stderr: err });
      else reject(new Error(`${path.basename(bin)} exited with ${code}: ${err.trim().split(/\r?\n/).slice(-3).join(" | ")}`));
    });
  });

/** Runs FFmpeg with the given arguments (queued: at most a few at once). */
export const runFfmpeg = async (args: string[], opts: RunOptions = {}) => {
  if (opts.unqueued) return exec(ffmpegPath(), ["-hide_banner", "-nostdin", ...args], opts);
  await acquire();
  try {
    return await exec(ffmpegPath(), ["-hide_banner", "-nostdin", ...args], opts);
  } finally {
    release();
  }
};

export type ProbeResult = {
  durationSec: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  bitRate?: number;
  pixFmt?: string;
  rotation?: number;
};

const parseRate = (r?: string) => {
  if (!r) return undefined;
  const [n, d] = r.split("/").map(Number);
  const v = d ? n / d : n;
  return Number.isFinite(v) && v > 0 && v < 1000 ? Math.round(v * 1000) / 1000 : undefined;
};

export const probe = async (file: string, signal?: AbortSignal): Promise<ProbeResult> => {
  const { stdout } = await exec(ffprobePath(), ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { signal });
  const data = JSON.parse(stdout) as {
    format?: { duration?: string; bit_rate?: string };
    streams?: {
      codec_type: string;
      codec_name?: string;
      width?: number;
      height?: number;
      avg_frame_rate?: string;
      r_frame_rate?: string;
      duration?: string;
      pix_fmt?: string;
      tags?: { rotate?: string };
      side_data_list?: { rotation?: number }[];
      disposition?: { attached_pic?: number };
    }[];
  };
  const video = data.streams?.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  const audio = data.streams?.find((s) => s.codec_type === "audio");
  const rotation = Number(video?.tags?.rotate ?? video?.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? 0);
  const swap = Math.abs(rotation) % 180 === 90;
  return {
    durationSec: Number(data.format?.duration ?? video?.duration ?? audio?.duration ?? 0),
    width: swap ? video?.height : video?.width,
    height: swap ? video?.width : video?.height,
    fps: parseRate(video?.avg_frame_rate) ?? parseRate(video?.r_frame_rate),
    videoCodec: video?.codec_name,
    audioCodec: audio?.codec_name,
    hasVideo: !!video,
    hasAudio: !!audio,
    bitRate: data.format?.bit_rate ? Number(data.format.bit_rate) : undefined,
    pixFmt: video?.pix_fmt,
    rotation: rotation || undefined,
  };
};
