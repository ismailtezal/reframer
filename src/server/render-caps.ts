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
  nvenc: { h264: boolean; h265: boolean };
  /** WebGL renderer of the render browser in GPU mode, or null when only software rendering works. */
  gpu: string | null;
};

const g = globalThis as unknown as {
  __reframerCaps?: { encoders?: Promise<RenderCaps["nvenc"]>; gpu?: Map<string, Promise<string | null>> };
};
g.__reframerCaps ??= {};
const cache = g.__reframerCaps;

const probeEncoder = async (encoder: string, frame: string) => {
  try {
    await runFfmpeg(["-v", "error", "-i", frame, "-frames:v", "1", "-pix_fmt", "yuv420p", "-c:v", encoder, "-f", "null", "-"], {
      unqueued: true,
      signal: AbortSignal.timeout(15_000),
    });
    return true;
  } catch {
    return false;
  }
};

export const getEncoderCaps = () => {
  cache.encoders ??= (async () => {
    const frame = path.join(CACHE_DIR, "encoder-probe.jpg");
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const sharp = (await import("sharp")).default;
    await sharp({ create: { width: 256, height: 144, channels: 3, background: { r: 16, g: 16, b: 16 } } })
      .jpeg()
      .toFile(frame);
    const [h264, h265] = await Promise.all([probeEncoder("h264_nvenc", frame), probeEncoder("hevc_nvenc", frame)]);
    return { h264, h265 };
  })();
  return cache.encoders;
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
