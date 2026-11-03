import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { runFfmpeg } from "./ffmpeg";
import { CACHE_DIR } from "./paths";

/**
 * What this machine can accelerate, probed once per server process:
 * - NVENC: a one-frame test encode per codec (FFmpeg always ships the
 *   encoder, but it only works with an NVIDIA GPU and driver).
 * - GPU WebGL: the render browser reports its WebGL renderer through a tiny
 *   probe composition, launched exactly like a real render.
 */

export type RenderCaps = {
  /** `reason`: why NVENC can't be used, in words for the export dialog. */
  nvenc: { h264: boolean; h265: boolean; reason?: string };
  /** WebGL renderer of the render browser in GPU mode, or null when only software rendering works. */
  gpu: string | null;
};

const g = globalThis as unknown as {
  __reframerCaps?: { encoders?: Promise<RenderCaps["nvenc"]>; gpu?: Map<string, Promise<string | null>> };
};
g.__reframerCaps ??= {};
const cache = g.__reframerCaps;

const NO_GPU = "No NVIDIA GPU found";

/** Turns FFmpeg's NVENC failure into what the user can do about it. */
const nvencReason = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (/nvcuda\.dll|no (nvenc )?capable devices|no device available|CUDA_ERROR_NO_DEVICE/i.test(msg)) return NO_GPU;
  if (/nvenc api version|driver does not support|minimum required nvidia driver/i.test(msg)) {
    return "The NVIDIA driver is too old for hardware encoding (updating it turns the GPU encoder on)";
  }
  return `The NVIDIA encoder didn't start: ${msg.replace(/^ffmpeg(\.exe)? exited with -?\d+: /, "").slice(0, 160)}`;
};

/** null when the encoder works, otherwise why it doesn't. */
const probeEncoder = async (encoder: string, frame: string) => {
  try {
    await runFfmpeg(["-v", "error", "-i", frame, "-frames:v", "1", "-pix_fmt", "yuv420p", "-c:v", encoder, "-f", "null", "-"], {
      unqueued: true,
      signal: AbortSignal.timeout(15_000),
    });
    return null;
  } catch (err) {
    return nvencReason(err);
  }
};

export const getEncoderCaps = () => {
  if (cache.encoders) return cache.encoders;
  const pending = (async (): Promise<RenderCaps["nvenc"]> => {
    try {
      const frame = path.join(CACHE_DIR, "encoder-probe.jpg");
      await fs.mkdir(CACHE_DIR, { recursive: true });
      const sharp = (await import("sharp")).default;
      await sharp({ create: { width: 256, height: 144, channels: 3, background: { r: 16, g: 16, b: 16 } } })
        .jpeg()
        .toFile(frame);
      const [h264, h265] = await Promise.all([probeEncoder("h264_nvenc", frame), probeEncoder("hevc_nvenc", frame)]);
      const reason = h264 ?? h265 ?? undefined;
      return { h264: !h264, h265: !h265, ...(reason ? { reason } : {}) };
    } catch (err) {
      return { h264: false, h265: false, reason: `Couldn't check for a hardware encoder: ${err instanceof Error ? err.message : err}` };
    }
  })();
  cache.encoders = pending;
  // Only "it works" and "there's no NVIDIA GPU" are final; anything else is checked again next time.
  void pending.then((caps) => {
    if (caps.reason && caps.reason !== NO_GPU && cache.encoders === pending) cache.encoders = undefined;
  });
  return pending;
};

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/** Asks a render worker (in GPU mode) which WebGL renderer it got. */
export const getGpuRenderer = (serveUrl: string, workerFile: string) => {
  cache.gpu ??= new Map();
  let pending = cache.gpu.get(serveUrl);
  if (!pending) {
    pending = new Promise<string | null>((resolve) => {
      const child = spawn(process.execPath, [workerFile], { stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true });
      let settled = false;
      const done = (renderer: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (child.connected) child.send({ type: "exit" });
        resolve(renderer && !SOFTWARE.test(renderer) && renderer !== "none" ? renderer : null);
      };
      const timer = setTimeout(() => {
        child.kill();
        done(null);
      }, 45_000);
      child.on("message", (msg: { type: string; props?: { renderer?: string } }) => {
        if (msg.type === "ready") done(msg.props?.renderer ?? null);
        else if (msg.type === "fatal") done(null);
      });
      child.on("exit", () => done(null));
      child.send({
        type: "init",
        config: { serveUrl, compositionId: "gpu-probe", inputProps: {}, gl: "angle", concurrency: 1 },
      });
    });
    cache.gpu.set(serveUrl, pending);
  }
  return pending;
};
