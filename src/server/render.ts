import "server-only";
import { type ChildProcess, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  describeSettings,
  EXTENSION,
  type ExportSettings,
  isAudioOnly,
  normalizeExportSettings,
  outputSize,
  supportsHardware,
} from "@/core/export";
import { getProjectDuration } from "@/core/project-utils";
import type { Project } from "@/core/schema";
import { runFfmpeg } from "./ffmpeg";
import { assertSafeId, CACHE_DIR, RENDERS_DIR } from "./paths";
import { getEncoderCaps, getGpuRenderer } from "./render-caps";
import { readSettings } from "./settings";

/**
 * Final renders run here, on the user's machine, with Remotion: the same React
 * composition the editor previews, drawn by headless Chrome and encoded with
 * FFmpeg. Full CSS support, frame-exact output.
 *
 * To be fast, an export is split across several worker processes
 * (render-worker.cjs). Each owns a Chrome instance with GPU WebGL and pulls
 * video segments from a shared queue; a separate worker renders the audio mix.
 * The segments are joined without re-encoding and muxed with the audio. One
 * Chrome tops out around 30 fps because its GPU process and video decoder are
 * shared by all its tabs; several of them scale with the machine.
 */

export type RenderJob = {
  id: string;
  projectId: string;
  projectName: string;
  presetName?: string;
  status: "queued" | "preparing" | "rendering" | "finishing" | "done" | "error" | "cancelled";
  progress: number;
  stage: string;
  fileName: string;
  outputPath: string;
  /** Short description of the output, e.g. "H.264 · 1920×1080 · CRF 18 · AAC 320 kbps". */
  summary: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  sizeBytes?: number;
  totalFrames: number;
  renderedFrames: number;
  /** Current render speed in frames per second. */
  fps?: number;
  etaSec?: number;
  elapsedSec?: number;
  /** Seconds of video produced per second of rendering. */
  realtimeFactor?: number;
  engine?: { processes: number; tabs: number; encoder: string; gpu: string | null };
};

type Internal = RenderJob & { cancel?: () => void; cancelled?: boolean };

type Options = {
  project: Project;
  origin: string;
  settings: ExportSettings;
  range?: [number, number];
  presetName?: string;
};

const g = globalThis as unknown as {
  __reframerRenders?: Map<string, Internal>;
  __reframerRenderQueue?: { pending: { job: Internal; opts: Options }[]; running: boolean };
  __reframerBundle?: { key: string; url: Promise<string> };
};
const jobs: Map<string, Internal> = g.__reframerRenders ?? new Map();
g.__reframerRenders = jobs;
g.__reframerRenderQueue ??= { pending: [], running: false };
const queue = g.__reframerRenderQueue;

const WORKER_FILE = path.join(/*turbopackIgnore: true*/ process.cwd(), "src/server/render-worker.cjs");
const SOURCE_DIRS = ["src/remotion", "src/core"];

/** Changes whenever the composition's source changes, so dev edits are picked up. */
const sourceKey = async (): Promise<string> => {
  const hash = createHash("sha1");
  const walk = async (dir: string) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else hash.update(`${full}:${(await fs.stat(full)).mtimeMs}`);
    }
  };
  for (const d of SOURCE_DIRS) await walk(path.join(/*turbopackIgnore: true*/ process.cwd(), d)).catch(() => undefined);
  return hash.digest("hex").slice(0, 12);
};

const getServeUrl = async (onProgress: (p: number) => void): Promise<string> => {
  // Packaged desktop builds ship a prebuilt bundle (scripts/bundle-remotion.mjs).
  const prebuilt = process.env.REFRAMER_REMOTION_BUNDLE;
  if (prebuilt) return prebuilt;
  const key = await sourceKey();
  if (g.__reframerBundle?.key !== key) {
    const url = (async () => {
      const { bundle } = await import("@remotion/bundler");
      return bundle({
        entryPoint: path.join(/*turbopackIgnore: true*/ process.cwd(), "src/remotion/index.ts"),
        onProgress,
        outDir: path.join(CACHE_DIR, `remotion-bundle-${key}`),
        webpackOverride: (config) => ({
          ...config,
          resolve: {
            ...config.resolve,
            alias: {
              ...(config.resolve?.alias as Record<string, string> | undefined),
              "@": path.join(/*turbopackIgnore: true*/ process.cwd(), "src"),
            },
          },
        }),
      });
    })();
    g.__reframerBundle = { key, url };
    url.catch(() => {
      if (g.__reframerBundle?.url === url) g.__reframerBundle = undefined;
    });
  }
  return (g.__reframerBundle as { url: Promise<string> }).url;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "video";

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const update = (job: Internal, patch: Partial<RenderJob>) => Object.assign(job, patch);

export const formatDuration = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};

// ---------------------------------------------------------------------------
// Worker processes
// ---------------------------------------------------------------------------

type WorkerConfig = {
  serveUrl: string;
  compositionId: string;
  inputPropsFile: string;
  gl: "angle" | null;
  concurrency: number;
  licenseKey?: string;
  mediaCacheSizeInBytes?: number;
  relaxParallelEncoding?: boolean;
  /** Let Chrome decode video on the GPU (see render-worker.cjs for when that's unsafe). */
  hardwareVideoDecode?: boolean;
};

type Task = { id: string; from: number; to: number; out: string; options: Record<string, unknown> };

type WorkerMessage =
  | { type: "ready" }
  | { type: "progress"; id: string; rendered: number; encoded: number }
  | { type: "done"; id: string }
  | { type: "failed"; id: string; error: string }
  | { type: "fatal"; error: string };

class RenderWorker {
  readonly ready: Promise<void>;
  private child: ChildProcess;
  private exited = false;
  private stderr = "";
  private pending = new Map<string, { resolve: () => void; reject: (e: Error) => void; onProgress: (r: number, e: number) => void }>();

  constructor(config: WorkerConfig) {
    this.child = spawn(process.execPath, [WORKER_FILE], { stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true });
    this.child.stderr?.on("data", (d: Buffer) => {
      this.stderr = (this.stderr + d.toString()).slice(-4000);
    });
    this.ready = new Promise<void>((resolve, reject) => {
      this.child.on("message", (msg: WorkerMessage) => {
        if (msg.type === "ready") resolve();
        else if (msg.type === "fatal") {
          const err = new Error(msg.error);
          reject(err);
          this.failAll(err);
        } else if (msg.type === "progress") this.pending.get(msg.id)?.onProgress(msg.rendered, msg.encoded);
        else if (msg.type === "done" || msg.type === "failed") {
          const p = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.type === "done") p?.resolve();
          else p?.reject(new Error(msg.error));
        }
      });
      const onGone = (detail: string) => {
        this.exited = true;
        const tail = this.stderr.trim().split(/\r?\n/).slice(-2).join(" ");
        const err = new Error(`A render process stopped unexpectedly (${detail})${tail ? `: ${tail}` : ""}`);
        reject(err);
        this.failAll(err);
      };
      this.child.on("exit", (code) => onGone(`exit code ${code}`));
      this.child.on("error", (e) => onGone(e.message));
    });
    this.ready.catch(() => undefined);
    this.child.send({ type: "init", config });
  }

  get alive() {
    return !this.exited;
  }

  run(task: Task, onProgress: (rendered: number, encoded: number) => void) {
    return new Promise<void>((resolve, reject) => {
      if (this.exited) return reject(new Error("Render process is gone"));
      this.pending.set(task.id, { resolve, reject, onProgress });
      this.child.send({ type: "task", task });
    });
  }

  /** Graceful stop: the worker closes its Chrome first. Force-kills if it hangs. */
  stop(kind: "exit" | "cancel") {
    if (this.exited) return;
    if (this.child.connected) this.child.send({ type: kind });
    setTimeout(() => {
      if (!this.exited) this.child.kill();
    }, 10_000).unref();
  }

  private failAll(err: Error) {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }
}

// ---------------------------------------------------------------------------
// Encoding settings → Remotion options
// ---------------------------------------------------------------------------

const X264_PRESET = { fastest: "superfast", fast: "veryfast", balanced: "faster", smallest: "slow" } as const;
const X265_PRESET = { fastest: "superfast", fast: "veryfast", balanced: "fast", smallest: "slow" } as const;
const NVENC_PRESET = { fastest: "p1", fast: "p4", balanced: "p5", smallest: "p7" } as const;
const VP9_SPEED = {
  fastest: { deadline: "realtime", cpuUsed: 8 },
  fast: { deadline: "good", cpuUsed: 5 },
  balanced: { deadline: "good", cpuUsed: 3 },
  smallest: { deadline: "good", cpuUsed: 1 },
} as const;

const mbps = (n: number) => `${Math.round(n * 1000)}k`;

const videoTaskOptions = (s: ExportSettings, hardware: boolean, scale: number, fps: number): Record<string, unknown> => {
  const base = {
    scale,
    muted: true,
    // Standard HD color: BT.709, limited range. (Remotion 4 otherwise tags the JPEG range as-is.)
    ...(s.videoCodec === "gif" ? {} : { colorSpace: "bt709" }),
    imageFormat: "jpeg",
    jpegQuality: s.speed === "fastest" ? 80 : s.videoCodec === "prores" || s.crf <= 12 ? 100 : 92,
  };
  const bitrate = s.rateControl === "bitrate";
  switch (s.videoCodec) {
    case "h264":
    case "h265": {
      if (hardware) {
        return {
          ...base,
          codec: s.videoCodec,
          hardwareAcceleration: "required",
          videoBitrate: mbps(bitrate ? s.bitrateMbps : 20),
          tune: {
            nvenc: bitrate
              ? { preset: NVENC_PRESET[s.speed], maxrate: mbps(s.bitrateMbps * 1.5), bufsize: mbps(s.bitrateMbps * 2) }
              : // NVENC needs a lower CQ than x264's CRF for comparable quality.
                { preset: NVENC_PRESET[s.speed], cq: Math.min(51, s.crf + 6) },
          },
        };
      }
      const speed = s.videoCodec === "h264" ? { x264Preset: X264_PRESET[s.speed] } : { tune: { x265: { preset: X265_PRESET[s.speed] } } };
      return bitrate
        ? {
            ...base,
            ...speed,
            codec: s.videoCodec,
            videoBitrate: mbps(s.bitrateMbps),
            encodingMaxRate: mbps(s.bitrateMbps * 1.5),
            encodingBufferSize: mbps(s.bitrateMbps * 2),
          }
        : { ...base, ...speed, codec: s.videoCodec, crf: s.crf };
    }
    case "vp9":
      return {
        ...base,
        codec: "vp9",
        ...(bitrate ? { videoBitrate: mbps(s.bitrateMbps) } : { crf: s.crf }),
        tune: { vp9: { ...VP9_SPEED[s.speed], constantQuality: !bitrate } },
      };
    case "prores":
      return {
        ...base,
        codec: "prores",
        proResProfile: s.proresProfile,
        ...(s.proresProfile === "4444" ? { pixelFormat: "yuv444p10le" } : {}),
      };
    case "gif":
      return { ...base, codec: "gif", everyNthFrame: fps >= 50 ? 4 : fps >= 24 ? 2 : 1, numberOfGifLoops: null };
  }
};

const audioArgs = (s: ExportSettings) => {
  const k = `${s.audioBitrateK}k`;
  switch (s.audioCodec) {
    case "pcm":
      return ["-c:a", "pcm_s16le"];
    case "mp3":
      return ["-c:a", "libmp3lame", "-b:a", k];
    case "opus":
      return ["-c:a", "libopus", "-b:a", k];
    default:
      return ["-c:a", "aac", "-b:a", k];
  }
};

/** How many Chrome processes and tabs to use. Measured on a 6-core/12-thread machine: 4 × 3 is ~2.3× one browser. */
const planEngine = (s: ExportSettings, frames: number, fps: number, size: { width: number; height: number }) => {
  const cores = os.availableParallelism?.() ?? os.cpus().length;
  if (s.format === "gif") return { processes: 1, tabs: clamp(Math.floor(cores / 2), 1, 6) };
  const megapixels = (size.width * size.height) / 1e6;
  // Measured at 1080p with a 384 MB media cache: ~0.9 GB for Chrome + FFmpeg and ~0.25 GB for the worker.
  const perProcess = (0.5 + 0.3 * megapixels) * 1024 ** 3;
  const byMemory = Math.max(1, Math.floor((os.freemem() - 0.75 * 1024 ** 3) / perProcess));
  const wanted = s.parallelism === "auto" ? clamp(Math.floor(cores / 3), 1, 6) : s.parallelism;
  // Each process costs ~2 s to start, so short exports use fewer.
  const byLength = Math.max(1, Math.floor(frames / (fps * 4)));
  const processes = Math.max(1, Math.min(wanted, byLength, s.parallelism === "auto" ? byMemory : wanted));
  return { processes, tabs: clamp(Math.floor(cores / processes), 2, 6) };
};

// ---------------------------------------------------------------------------
// Job runner
// ---------------------------------------------------------------------------

const run = async (job: Internal, opts: Options) => {
  const { ensureBrowser } = await import("@remotion/renderer");
  const s = opts.settings;
  const project = opts.project;
  const fps = project.settings.fps;
  const audioOnly = isAudioOnly(s.format);
  const size = outputSize(project.settings, s.resolution);
  const appSettings = await readSettings();
  const t0 = Date.now();
  update(job, { status: "preparing", startedAt: t0, stage: "Preparing…" });

  const tmp = path.join(CACHE_DIR, "render-tmp", job.id);
  const workers: RenderWorker[] = [];
  const abort = new AbortController();
  job.cancel = () => {
    abort.abort();
    for (const w of workers) w.stop("cancel");
  };

  try {
    await fs.mkdir(tmp, { recursive: true });
    await fs.mkdir(path.dirname(job.outputPath), { recursive: true });

    const serveUrl = await getServeUrl((p) => update(job, { stage: `Preparing the renderer… ${Math.round(p)}%` }));
    if (job.cancelled) return;
    update(job, { stage: "Starting Chrome…" });
    await ensureBrowser({
      onBrowserDownload: () => ({
        version: null,
        onProgress: ({ percent }) =>
          update(job, { stage: `Downloading Chrome for rendering (first time only)… ${Math.round(percent * 100)}%` }),
      }),
    });
    if (job.cancelled) return;

    update(job, { stage: "Checking hardware acceleration…" });
    const wantHardware = !audioOnly && supportsHardware(s.videoCodec) && s.hardware !== "off";
    const [encoders, gpu] = await Promise.all([
      wantHardware ? getEncoderCaps() : null,
      s.gpu === "off" || audioOnly ? null : getGpuRenderer(serveUrl, WORKER_FILE),
    ]);
    const hardware = !!encoders && encoders[s.videoCodec as "h264" | "h265"];
    if (s.hardware === "on" && wantHardware && !hardware) {
      throw new Error("Hardware encoding needs an NVIDIA GPU, which wasn't found. Set Hardware encoding to Auto or Off.");
    }
    if (job.cancelled) return;

    const inputPropsFile = path.join(tmp, "input-props.json");
    const audioPropsFile = path.join(tmp, "audio-props.json");
    // Video segments are silent: the audio worker renders the whole mix once.
    await fs.writeFile(inputPropsFile, JSON.stringify({ project, editor: false, mediaBaseUrl: opts.origin, silent: true }));
    await fs.writeFile(audioPropsFile, JSON.stringify({ project, editor: false, mediaBaseUrl: opts.origin, audioOnly: true }));

    // Frames to render (inclusive range).
    const duration = getProjectDuration(project);
    const from = clamp(opts.range?.[0] ?? 0, 0, duration - 1);
    const to = clamp(opts.range?.[1] ?? duration - 1, from, duration - 1);
    const frames = to - from + 1;
    const plan = audioOnly ? { processes: 0, tabs: 1 } : planEngine(s, frames, fps, size);
    const encoder = audioOnly
      ? "—"
      : hardware
        ? `NVIDIA NVENC (${s.videoCodec === "h264" ? "H.264" : "HEVC"})`
        : { h264: "x264", h265: "x265", vp9: "libvpx VP9", prores: "ProRes", gif: "GIF" }[s.videoCodec];
    update(job, {
      totalFrames: frames,
      engine: { processes: plan.processes, tabs: plan.tabs, encoder, gpu: gpu ?? null },
      stage: plan.processes > 1 ? `Starting ${plan.processes} render processes…` : "Starting the renderer…",
    });

    const baseConfig = {
      serveUrl,
      compositionId: "reframer",
      inputPropsFile,
      licenseKey: appSettings.remotionLicenseKey || undefined,
      relaxParallelEncoding: true,
    };
    // Hardware decoding is ~10% faster but deadlocks in @remotion/media when footage runs at
    // ~2× the project frame rate, so it's used only when every clip's rate is close to it.
    const videoAssets = Object.values(project.clips).flatMap((c) => (c.type === "video" ? [project.assets[c.assetId]] : []));
    const hardwareVideoDecode = !!gpu && videoAssets.every((a) => !a || (!!a.fps && a.fps <= fps * 1.5));
    const videoConfig: WorkerConfig = {
      ...baseConfig,
      hardwareVideoDecode,
      gl: gpu ? "angle" : null,
      concurrency: plan.tabs,
      // Remotion's default media cache is half of free RAM per process; frames are rendered in order, so a small one suffices.
      mediaCacheSizeInBytes: 384 * 1024 ** 2,
    };

    // --- Video segments --------------------------------------------------
    const isGif = s.format === "gif";
    const segmentLength = isGif ? frames : clamp(Math.ceil(frames / (plan.processes * 3)), fps * 3, fps * 30);
    const segments: Task[] = [];
    if (!audioOnly) {
      const options = videoTaskOptions(s, hardware, size.scale, fps);
      const ext = s.videoCodec === "prores" ? "mov" : s.videoCodec === "vp9" ? "webm" : isGif ? "gif" : "mp4";
      for (let a = from, i = 0; a <= to; a += segmentLength, i++) {
        const b = Math.min(to, a + segmentLength - 1);
        segments.push({
          id: `v${i}`,
          from: a,
          to: b,
          out: isGif ? job.outputPath : path.join(tmp, `segment-${String(i).padStart(4, "0")}.${ext}`),
          options,
        });
      }
    }

    // --- Progress ----------------------------------------------------------
    const partial = new Map<string, number>();
    let completed = 0;
    let audioDone = !s.includeAudio;
    const samples: { t: number; f: number }[] = [];
    const report = () => {
      let inFlight = 0;
      for (const v of partial.values()) inFlight += v;
      const rendered = Math.min(frames, completed + inFlight);
      const now = Date.now();
      samples.push({ t: now, f: rendered });
      while (samples.length > 2 && now - samples[0].t > 5000) samples.shift();
      const first = samples[0];
      const speed = now - first.t > 800 ? ((rendered - first.f) * 1000) / (now - first.t) : undefined;
      const eta = speed && speed > 0 ? (frames - rendered) / speed : undefined;
      update(job, {
        status: "rendering",
        renderedFrames: Math.round(rendered),
        progress: audioOnly ? job.progress : 0.97 * (rendered / frames),
        fps: speed ? Math.round(speed * 10) / 10 : job.fps,
        etaSec: eta === undefined ? job.etaSec : Math.round(eta),
        stage: `Rendering frame ${Math.round(rendered).toLocaleString("en-US")} of ${frames.toLocaleString("en-US")}`,
      });
    };

    // --- Audio (separate worker, runs alongside video) ----------------------
    const audioFile = path.join(tmp, "audio.wav");
    const audioTask: Promise<boolean> = s.includeAudio
      ? (async () => {
          // Same GPU mode as the video: in software mode, WebGL layers would be drawn on the CPU for every frame.
          const worker = new RenderWorker({
            ...baseConfig,
            inputPropsFile: audioPropsFile,
            gl: gpu ? "angle" : null,
            concurrency: audioOnly ? 4 : 2,
            mediaCacheSizeInBytes: 256 * 1024 ** 2,
          });
          workers.push(worker);
          await worker.ready;
          await worker.run({ id: "audio", from, to, out: audioFile, options: { codec: "wav", enforceAudioTrack: true } }, (rendered) => {
            if (audioOnly) update(job, { status: "rendering", progress: 0.9 * (rendered / frames), stage: "Mixing audio…" });
          });
          worker.stop("exit");
          audioDone = true;
          return true;
        })()
      : Promise.resolve(false);
    // Awaited after the video; keep an early failure from surfacing as unhandled.
    audioTask.catch(() => undefined);

    // --- Video workers pull segments until none are left ---------------------
    const queueOfSegments = [...segments];
    const attempts = new Map<string, number>();
    // Chrome in GPU mode slowly leaks memory, so long exports get a fresh browser now and then.
    const RECYCLE_AFTER_FRAMES = 4000;
    let fatal: unknown = null;
    let startError: unknown = null;
    const videoWork = Array.from({ length: plan.processes }, async () => {
      let workerDecodesInHardware = videoConfig.hardwareVideoDecode;
      let worker = new RenderWorker(videoConfig);
      workers.push(worker);
      try {
        await worker.ready;
      } catch (err) {
        // The other processes can still finish the queue.
        startError ??= err;
        return;
      }
      let framesOnWorker = 0;
      for (let task = queueOfSegments.shift(); task; task = queueOfSegments.shift()) {
        if (job.cancelled || fatal) break;
        const t = task;
        const span = t.to - t.from + 1;
        const staleMode = workerDecodesInHardware !== videoConfig.hardwareVideoDecode;
        if (!worker.alive || staleMode || (framesOnWorker >= RECYCLE_AFTER_FRAMES && span > fps)) {
          worker.stop("exit");
          workerDecodesInHardware = videoConfig.hardwareVideoDecode;
          worker = new RenderWorker(videoConfig);
          workers.push(worker);
          await worker.ready;
          framesOnWorker = 0;
        }
        try {
          await worker.run(t, (rendered, encoded) => {
            // Encoding trails rendering for codecs encoded after capture (VP9, ProRes, GIF).
            partial.set(t.id, Math.min(span, (rendered + encoded) / 2));
            report();
          });
          partial.delete(t.id);
          completed += span;
          framesOnWorker += span;
          report();
        } catch (err) {
          partial.delete(t.id);
          if (job.cancelled) throw err;
          const n = (attempts.get(t.id) ?? 0) + 1;
          attempts.set(t.id, n);
          if (n >= 2) {
            fatal = new Error(`Frames ${t.from}–${t.to}: ${err instanceof Error ? err.message : String(err)}`);
            throw fatal;
          }
          if (videoConfig.hardwareVideoDecode && /extracting frame/i.test(String(err))) {
            // A stalled hardware decoder: finish this export with software decoding.
            videoConfig.hardwareVideoDecode = false;
            worker.stop("exit");
          }
          // Retry once, on a fresh browser if this one crashed or switched modes.
          queueOfSegments.unshift(t);
        }
      }
      worker.stop("exit");
    });

    const results = await Promise.allSettled(videoWork);
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (job.cancelled) return;
    if (failed) throw failed.reason;
    if (queueOfSegments.length) throw startError ?? new Error("Rendering stopped before all frames were done");

    if (!audioDone) update(job, { status: "finishing", stage: "Mixing audio…" });
    const hasAudio = await audioTask.catch((err: unknown) => {
      if (audioOnly) throw err;
      // A video export still succeeds without its audio track; say so.
      update(job, { error: `Audio couldn't be mixed: ${err instanceof Error ? err.message : String(err)}` });
      return false;
    });
    if (job.cancelled) return;

    // --- Assemble ----------------------------------------------------------
    if (!isGif) {
      update(job, { status: "finishing", stage: "Writing the file…", progress: 0.98 });
      const args = ["-y", "-v", "error"];
      if (!audioOnly) {
        const list = path.join(tmp, "segments.txt");
        const quote = (f: string) => `file '${f.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
        await fs.writeFile(list, segments.map((t) => quote(t.out)).join("\n"));
        args.push("-f", "concat", "-safe", "0", "-i", list);
      }
      if (hasAudio) args.push("-i", audioFile);
      if (!audioOnly) args.push("-map", "0:v:0", "-c:v", "copy");
      if (hasAudio) args.push("-map", `${audioOnly ? 0 : 1}:a:0`, ...audioArgs(s));
      if (s.videoCodec === "h265" && (s.format === "mp4" || s.format === "mov")) args.push("-tag:v", "hvc1");
      if (s.format === "mp4" || s.format === "mov" || s.format === "m4a") args.push("-movflags", "+faststart");
      // The bundled FFmpeg has no "ipod" muxer, which .m4a would pick; M4A is MP4 audio anyway.
      if (s.format === "m4a") args.push("-f", "mp4");
      args.push(job.outputPath);
      await runFfmpeg(args, { unqueued: true, signal: abort.signal });
    }

    const stat = await fs.stat(job.outputPath);
    const elapsed = (Date.now() - t0) / 1000;
    update(job, {
      status: "done",
      progress: 1,
      renderedFrames: frames,
      etaSec: 0,
      elapsedSec: Math.round(elapsed * 10) / 10,
      fps: Math.round((frames / elapsed) * 10) / 10,
      realtimeFactor: Math.round((frames / fps / elapsed) * 100) / 100,
      stage: `Done in ${formatDuration(elapsed)}`,
      finishedAt: Date.now(),
      sizeBytes: stat.size,
    });
  } finally {
    for (const w of workers) w.stop(job.cancelled ? "cancel" : "exit");
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
};

const pump = () => {
  if (queue.running) return;
  const next = queue.pending.shift();
  if (!next) return;
  queue.running = true;
  const { job, opts } = next;
  run(job, opts)
    .catch((err: unknown) => {
      if (!job.cancelled) {
        update(job, { status: "error", error: err instanceof Error ? err.message : String(err), stage: "Failed", finishedAt: Date.now() });
      }
    })
    .finally(() => {
      if (job.cancelled) update(job, { status: "cancelled", stage: "Cancelled", finishedAt: job.finishedAt ?? Date.now() });
      queue.running = false;
      pump();
    });
};

/**
 * Gets the slow one-time work out of the way while the user is still picking
 * settings: building the composition bundle (dev only) and probing the GPU.
 */
export const prewarmRenderer = () => {
  if (queue.running) return;
  getServeUrl(() => undefined)
    .then((serveUrl) => getGpuRenderer(serveUrl, WORKER_FILE))
    .catch(() => undefined);
};

/** Queues an export. Exports run one at a time, each using the whole machine. */
export const startRender = (opts: {
  project: Project;
  origin: string;
  settings?: Partial<ExportSettings>;
  range?: [number, number];
  presetName?: string;
}): RenderJob => {
  const projectId = assertSafeId(opts.project.id);
  const settings = normalizeExportSettings(opts.settings);
  const fileName = `${slug(opts.project.name)}-${stamp()}.${EXTENSION[settings.format]}`;
  const duration = getProjectDuration(opts.project);
  const job: Internal = {
    id: randomUUID(),
    projectId,
    projectName: opts.project.name,
    presetName: opts.presetName,
    status: "queued",
    progress: 0,
    stage: "Waiting in queue…",
    fileName,
    outputPath: path.join(RENDERS_DIR, projectId, fileName),
    summary: describeSettings(settings, opts.project.settings),
    createdAt: Date.now(),
    totalFrames: opts.range ? opts.range[1] - opts.range[0] + 1 : duration,
    renderedFrames: 0,
  };
  jobs.set(job.id, job);
  queue.pending.push({ job, opts: { ...opts, settings } });
  pump();
  return publicJob(job);
};

export const publicJob = (job: Internal): RenderJob => {
  const { cancel: _cancel, cancelled: _cancelled, ...rest } = job;
  return rest;
};

export const getJob = (id: string): RenderJob | undefined => {
  const job = jobs.get(id);
  return job ? publicJob(job) : undefined;
};

export const listJobs = (projectId?: string): RenderJob[] =>
  [...jobs.values()]
    .filter((j) => !projectId || j.projectId === projectId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(publicJob);

export const latestJobFor = (projectId: string): RenderJob | undefined => listJobs(projectId)[0];

export const cancelRender = (id: string) => {
  const job = jobs.get(id);
  if (!job || job.status === "done" || job.status === "error" || job.status === "cancelled") return false;
  job.cancelled = true;
  const waiting = queue.pending.findIndex((p) => p.job.id === id);
  if (waiting !== -1) queue.pending.splice(waiting, 1);
  job.cancel?.();
  update(job, { status: "cancelled", stage: "Cancelled", finishedAt: Date.now() });
  return true;
};

/** Forgets finished jobs (the files stay on disk). */
export const clearFinished = (projectId?: string) => {
  for (const [id, j] of jobs) {
    if ((!projectId || j.projectId === projectId) && (j.status === "done" || j.status === "error" || j.status === "cancelled"))
      jobs.delete(id);
  }
};
