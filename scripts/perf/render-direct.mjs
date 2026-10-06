// Renders a frame range of a project with @remotion/renderer in this process (no app server in the loop).
// Used to test parallel render workers:
//   node scripts/perf/render-direct.mjs <projectId> --bundle=<dir> --media=http://localhost:3000 --from=0 --to=599 --out=x.mp4 [--json='{...renderMedia options}']
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// The CommonJS build: its internals are looked up per call, so experiments can patch them.
const { openBrowser, renderMedia, selectComposition } = createRequire(import.meta.url)("@remotion/renderer");
// RF_CHROME_FLAGS="--a --b": extra Chrome switches (experiments), appended where Remotion launches Chrome.
if (process.env.RF_CHROME_FLAGS) {
  const req = createRequire(import.meta.url);
  const launcher = req(path.join(path.dirname(req.resolve("@remotion/renderer")), "browser", "Launcher.js"));
  const launch = launcher.launchChrome;
  launcher.launchChrome = (opts) => launch({ ...opts, args: [...opts.args, ...process.env.RF_CHROME_FLAGS.split(" ")] });
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  }),
);
const projectId = process.argv.slice(2).find((a) => !a.startsWith("--"));
const project = JSON.parse(fs.readFileSync(path.join(".reframer/projects", projectId, "project.json"), "utf8"));
if (args.only) {
  const keep = new Set(String(args.only).split(","));
  for (const [id, c] of Object.entries(project.clips)) if (!keep.has(c.type)) delete project.clips[id];
}
const serveUrl = path.resolve(args.bundle);
const inputProps = { project, editor: false, mediaBaseUrl: args.media };
const extra = args.json ? JSON.parse(args.json) : {};
const t0 = Date.now();
const browser = await openBrowser("chrome", { chromiumOptions: { gl: "angle" }, ...(extra.browserOptions ?? {}) });
delete extra.browserOptions;
try {
  const composition = await selectComposition({ serveUrl, id: "reframer", inputProps, puppeteerInstance: browser });
  const from = Number(args.from ?? 0);
  const to = Number(args.to ?? composition.durationInFrames - 1);
  let firstAt = 0;
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    puppeteerInstance: browser,
    outputLocation: path.resolve(args.out ?? `perf-results/direct-${from}-${to}.mp4`),
    codec: "h264",
    crf: 18,
    imageFormat: "jpeg",
    jpegQuality: 95,
    x264Preset: "veryfast",
    frameRange: [from, to],
    overwrite: true,
    chromiumOptions: { gl: "angle" },
    ...extra,
    onProgress: ({ renderedFrames }) => {
      if (!firstAt && renderedFrames > 0) firstAt = Date.now();
    },
  });
  const sec = (Date.now() - t0) / 1000;
  const frames = to - from + 1;
  const caps = globalThis.__rfCap ?? [];
  const capAvg = caps.length ? Math.round(caps.reduce((a, b) => a + b, 0) / caps.length) : null;
  console.log(
    JSON.stringify({
      capAvg,
      from,
      to,
      frames,
      wallSec: +sec.toFixed(1),
      fps: +(frames / sec).toFixed(1),
      steadyFps: +(frames / ((Date.now() - firstAt) / 1000)).toFixed(1),
    }),
  );
} finally {
  await browser.close({ silent: true });
}
