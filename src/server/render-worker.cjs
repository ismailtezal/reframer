// Render worker: one Chrome + one Remotion pipeline in its own process.
//
// The server (src/server/render.ts) starts several of these and hands each a
// stream of frame ranges over IPC. Separate processes matter for speed: every
// Chrome instance gets its own GPU process and video decoder, which are the
// parts that stop a single browser from scaling past ~30 fps.
//
// Plain CommonJS on purpose: it runs under Node (dev) or Electron-as-Node
// (desktop) without going through the Next.js bundler.
"use strict";

const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

/** @type {import("@remotion/renderer")} */
const renderer = require("@remotion/renderer");

const send = (msg) => {
  if (process.connected) process.send(msg);
};

/**
 * Remotion only encodes while it renders when free RAM exceeds ~4 GB at 1080p
 * (an estimate of 1 GB per megapixel for FFmpeg, plus 2 GB headroom). With
 * several workers sharing a 16 GB machine that check fails and every frame is
 * written to disk and encoded afterwards, roughly doubling export time.
 * Measured usage is far lower, so relax the gate to a realistic margin.
 */
const relaxParallelEncodingGate = () => {
  try {
    const dir = path.dirname(require.resolve("@remotion/renderer"));
    const mod = require(path.join(dir, "prestitcher-memory-usage.js"));
    if (typeof mod.shouldUseParallelEncoding !== "function") return;
    mod.shouldUseParallelEncoding = ({ width, height }) => {
      const freeMemory = os.freemem();
      const estimatedUsage = width * height * 150;
      return { hasEnoughMemory: freeMemory - estimatedUsage > 600 * 1024 * 1024, freeMemory, estimatedUsage };
    };
  } catch {
    // Internal layout changed: keep Remotion's default behavior.
  }
};

/**
 * Turns off Chrome's hardware *video decoding* (GPU WebGL for effects stays on).
 * @remotion/media keeps ~0.2 s of decoded frames per clip; with a hardware
 * decoder's small surface pool that deadlocks when the source frame rate is
 * about twice the project's (60 fps footage in a 30 fps project): the next frame
 * never arrives and the export times out. Software decoding has no such limit
 * and is ~10% slower overall; codecs Chrome can only decode in hardware (HEVC)
 * fall back to Remotion's FFmpeg-based decoder. The server decides per export.
 */
const disableHardwareVideoDecode = () => {
  try {
    const dir = path.dirname(require.resolve("@remotion/renderer"));
    const launcher = require(path.join(dir, "browser", "Launcher.js"));
    const launch = launcher.launchChrome;
    if (typeof launch !== "function") return;
    launcher.launchChrome = (opts) => launch({ ...opts, args: [...(opts.args ?? []), "--disable-accelerated-video-decode"] });
  } catch {
    // Internal layout changed: keep Remotion's default behavior.
  }
};

/**
 * A port for Remotion's per-call HTTP server (bundle + media proxy). Left alone,
 * every process picks the first free port from 3000 with a check-then-bind race,
 * and a port held by another Remotion server is *reused*, so one worker can end
 * up rendering through another worker's server, which disappears when that
 * worker's segment ends (ERR_SOCKET_NOT_CONNECTED at localhost:3000). An
 * OS-assigned port per call keeps every worker on its own server.
 */
const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

/** Encoder flags Remotion doesn't expose, applied through its ffmpegOverride hook. */
const makeFfmpegOverride = (tune) => {
  if (!tune) return undefined;
  return ({ args }) => {
    const out = [...args];
    const codecAt = out.findIndex((a, i) => out[i - 1] === "-c:v" && a !== "copy");
    if (codecAt === -1) return out;
    const encoder = out[codecAt];
    const insert = (flags) => out.splice(codecAt + 1, 0, ...flags);
    if (tune.nvenc && /_nvenc$/.test(encoder)) {
      const bitrateAt = out.indexOf("-b:v");
      if (tune.nvenc.cq !== undefined && bitrateAt !== -1) out.splice(bitrateAt, 2);
      insert([
        "-preset",
        tune.nvenc.preset,
        "-tune",
        "hq",
        "-rc",
        "vbr",
        ...(tune.nvenc.cq !== undefined ? ["-cq", String(tune.nvenc.cq), "-b:v", "0"] : []),
        ...(tune.nvenc.maxrate ? ["-maxrate", tune.nvenc.maxrate, "-bufsize", tune.nvenc.bufsize] : []),
        "-spatial-aq",
        "1",
        "-temporal-aq",
        "1",
        "-rc-lookahead",
        "20",
      ]);
    } else if (tune.x265 && encoder === "libx265") {
      insert(["-preset", tune.x265.preset]);
    } else if (tune.vp9 && encoder === "libvpx-vp9") {
      insert(["-deadline", tune.vp9.deadline, "-cpu-used", String(tune.vp9.cpuUsed), ...(tune.vp9.constantQuality ? ["-b:v", "0"] : [])]);
    }
    return out;
  };
};

let browser = null;
let composition = null;
let config = null;
let inputProps = null;
let current = null;
let closing = false;

const closeBrowser = async () => {
  const b = browser;
  browser = null;
  if (b) await b.close({ silent: true }).catch(() => undefined);
};

const shutdown = async (code) => {
  if (closing) return;
  closing = true;
  try {
    current?.cancel();
  } catch {}
  await closeBrowser();
  process.exit(code);
};

const init = async (cfg) => {
  config = cfg;
  if (cfg.relaxParallelEncoding) relaxParallelEncodingGate();
  if (!cfg.hardwareVideoDecode) disableHardwareVideoDecode();
  inputProps = cfg.inputPropsFile ? JSON.parse(fs.readFileSync(cfg.inputPropsFile, "utf8")) : (cfg.inputProps ?? {});
  browser = await renderer.openBrowser("chrome", {
    chromiumOptions: { gl: cfg.gl ?? null },
    logLevel: "error",
  });
  composition = await renderer.selectComposition({
    serveUrl: cfg.serveUrl,
    id: cfg.compositionId,
    inputProps,
    puppeteerInstance: browser,
    port: await freePort(),
    logLevel: "error",
    ...(cfg.licenseKey ? { licenseKey: cfg.licenseKey } : {}),
  });
  send({
    type: "ready",
    composition: {
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames,
    },
    // The GPU probe composition reports its findings through its props.
    ...(cfg.compositionId === "gpu-probe" ? { props: composition.props } : {}),
  });
};

const runTask = async (task) => {
  const { cancelSignal, cancel } = renderer.makeCancelSignal();
  current = { id: task.id, cancel };
  let lastSent = 0;
  const { tune, ...options } = task.options;
  try {
    await renderer.renderMedia({
      composition,
      serveUrl: config.serveUrl,
      inputProps,
      puppeteerInstance: browser,
      port: await freePort(),
      outputLocation: task.out,
      frameRange: [task.from, task.to],
      concurrency: config.concurrency,
      cancelSignal,
      overwrite: true,
      logLevel: "error",
      chromiumOptions: { gl: config.gl ?? null },
      ...(config.licenseKey ? { licenseKey: config.licenseKey } : {}),
      ...(config.mediaCacheSizeInBytes ? { mediaCacheSizeInBytes: config.mediaCacheSizeInBytes } : {}),
      ...options,
      ffmpegOverride: makeFfmpegOverride(tune),
      onProgress: ({ renderedFrames, encodedFrames }) => {
        const now = Date.now();
        if (now - lastSent < 200) return;
        lastSent = now;
        send({ type: "progress", id: task.id, rendered: renderedFrames, encoded: encodedFrames });
      },
    });
    send({ type: "done", id: task.id });
  } catch (err) {
    send({ type: "failed", id: task.id, error: err instanceof Error ? err.message : String(err), cancelled: closing });
  } finally {
    current = null;
  }
};

process.on("message", (msg) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "init") {
    init(msg.config).catch((err) => {
      send({ type: "fatal", error: err instanceof Error ? err.message : String(err) });
      void shutdown(1);
    });
  } else if (msg.type === "task") {
    void runTask(msg.task);
  } else if (msg.type === "cancel" || msg.type === "exit") {
    void shutdown(0);
  }
});

// The server went away (closed, crashed or cancelled us): never leave Chrome behind.
process.on("disconnect", () => void shutdown(0));
process.on("uncaughtException", (err) => {
  send({ type: "fatal", error: err instanceof Error ? err.message : String(err) });
  void shutdown(1);
});
