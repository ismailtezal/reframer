// Editor performance benchmark.
//
// Opens a project in headless Chrome and measures what a person feels:
// load time, main-thread blocking, whether playback keeps up with the
// project's frame rate, and how long seeks, zooms, edits and selections take.
//
//   node scripts/perf/editor-bench.mjs [projectId] [--base=http://localhost:3000] [--profile=playback|load|zoom] [--headed]
//
// Results print as JSON; with --out=file.json they're also written to disk.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const projectId = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "proj_perfbench60fps";
const BASE = args.base ?? process.env.BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: !args.headed,
  args: ["--autoplay-policy=no-user-gesture-required", "--enable-precise-memory-info", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

let saves = 0;
let saveBytes = 0;
page.on("request", (req) => {
  if (req.method() === "PUT" && req.url().includes(`/api/projects/${projectId}`)) {
    saves++;
    saveBytes += req.postData()?.length ?? 0;
  }
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

await page.addInitScript(() => {
  const perf = { longTasks: [] };
  window.__perf = perf;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) perf.longTasks.push({ start: e.startTime, dur: e.duration });
  }).observe({ type: "longtask", buffered: true });
  /** rAF frame deltas over `ms` milliseconds. */
  perf.sampleFrames = (ms) =>
    new Promise((resolve) => {
      const deltas = [];
      let last = performance.now();
      const end = last + ms;
      const tick = (t) => {
        deltas.push(t - last);
        last = t;
        if (t < end) requestAnimationFrame(tick);
        else resolve(deltas);
      };
      requestAnimationFrame(tick);
    });
  perf.nextFrames = (n = 2) =>
    new Promise((resolve) => {
      let left = n;
      const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    });
  perf.blockedSince = (t0) => perf.longTasks.filter((l) => l.start >= t0).reduce((a, l) => a + l.dur, 0);
});

const cdp = await context.newCDPSession(page);
const startProfile = async () => {
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
};
const stopProfile = async (name) => {
  const { profile } = await cdp.send("Profiler.stop");
  const dir = path.resolve(args.profileDir ?? "perf-results");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${Date.now()}.cpuprofile`);
  fs.writeFileSync(file, JSON.stringify(profile));
  return file;
};

const result = { projectId, base: BASE, at: new Date().toISOString() };

// ---------------------------------------------------------------- load
if (args.profile === "load") await startProfile();
const t0 = Date.now();
await page.goto(`${BASE}/editor/${projectId}`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-timeline-clip]", { timeout: 180_000 });
result.loadMs = Date.now() - t0;
await page.waitForTimeout(3000);
if (args.profile === "load") result.loadProfile = await stopProfile("load");
Object.assign(
  result,
  await page.evaluate(() => {
    const p = window.__perf;
    const project = window.__reframer.useProjectStore.getState().project;
    return {
      clips: Object.keys(project.clips).length,
      fps: project.settings.fps,
      loadBlockedMs: Math.round(p.longTasks.reduce((a, l) => a + l.dur, 0)),
      loadLongestTaskMs: Math.round(Math.max(0, ...p.longTasks.map((l) => l.dur))),
      domNodes: document.getElementsByTagName("*").length,
      heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576),
    };
  }),
);

// ---------------------------------------------------------------- idle
result.idle = await page.evaluate(async () => {
  const p = window.__perf;
  const t = performance.now();
  const deltas = await p.sampleFrames(2000);
  return { blockedMs: Math.round(p.blockedSince(t)), worstFrameMs: Math.round(Math.max(...deltas)) };
});

// ---------------------------------------------------------------- playback
if (args.profile === "playback") await startProfile();
result.playback = await page.evaluate(async () => {
  const R = window.__reframer;
  const p = window.__perf;
  const fps = R.useProjectStore.getState().project.settings.fps;
  R.seek(Math.round(fps * 8));
  await new Promise((r) => setTimeout(r, 1500));
  const f0 = R.usePlaybackStore.getState().frame;
  const t0 = performance.now();
  R.play();
  const deltas = await p.sampleFrames(8000);
  R.pause();
  const t1 = performance.now();
  const f1 = R.usePlaybackStore.getState().frame;
  const expected = ((t1 - t0) / 1000) * fps;
  return {
    targetFps: fps,
    achievedFps: Math.round(((f1 - f0) / (t1 - t0)) * 1000 * 10) / 10,
    keptUpPct: Math.round(((f1 - f0) / expected) * 100),
    uiFps: Math.round((deltas.length / (t1 - t0)) * 1000),
    framesOver50ms: deltas.filter((d) => d > 50).length,
    worstFrameMs: Math.round(Math.max(...deltas)),
    blockedMs: Math.round(p.blockedSince(t0)),
  };
});
if (args.profile === "playback") result.playbackProfile = await stopProfile("playback");

// ---------------------------------------------------------------- seeks
result.seek = await page.evaluate(async () => {
  const R = window.__reframer;
  const p = window.__perf;
  const project = R.useProjectStore.getState().project;
  const total = Math.max(...Object.values(project.clips).map((c) => c.start + c.duration));
  const times = [];
  const t0 = performance.now();
  for (let i = 0; i < 15; i++) {
    const f = Math.round((((i * 7919) % 97) / 97) * total);
    const t = performance.now();
    R.seek(f);
    await p.nextFrames(2);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  return { medianMs: Math.round(times[7]), worstMs: Math.round(times[14]), blockedMs: Math.round(p.blockedSince(t0)) };
});

// ---------------------------------------------------------------- zoom
if (args.profile === "zoom") await startProfile();
result.zoom = await page.evaluate(async () => {
  const R = window.__reframer;
  const p = window.__perf;
  const out = {};
  for (const pps of [20, 90, 300, 1200, 90]) {
    const t = performance.now();
    R.useUIStore.getState().setPxPerSecond(pps);
    await p.nextFrames(2);
    out[pps] = Math.max(out[pps] ?? 0, Math.round(performance.now() - t));
  }
  out.domNodesAt90 = document.getElementsByTagName("*").length;
  return out;
});
if (args.profile === "zoom") result.zoomProfile = await stopProfile("zoom");

// ---------------------------------------------------------------- edit + select
if (args.profile === "select") await startProfile();
result.edit = await page.evaluate(async () => {
  const R = window.__reframer;
  const p = window.__perf;
  const store = R.useProjectStore.getState();
  const video = Object.values(store.project.clips).find((c) => c.type === "video");
  const t = performance.now();
  store.transact("bench move", (d) => {
    d.clips[video.id].start += 1;
  });
  await p.nextFrames(2);
  const moveMs = performance.now() - t;
  R.useProjectStore.getState().undo();
  await p.nextFrames(2);
  const t2 = performance.now();
  R.useUIStore.getState().select([video.id]);
  await p.nextFrames(2);
  const selectMs = performance.now() - t2;
  // Selecting a second clip (the inspector is already mounted).
  const other = Object.values(R.useProjectStore.getState().project.clips).find((c) => c.type === "text");
  const t3 = performance.now();
  if (other) R.useUIStore.getState().select([other.id]);
  await p.nextFrames(2);
  const reselectMs = performance.now() - t3;
  return { moveMs: Math.round(moveMs), selectMs: Math.round(selectMs), reselectMs: Math.round(reselectMs) };
});
if (args.profile === "select") result.selectProfile = await stopProfile("select");

await page.waitForTimeout(1500);
result.autosave = { requests: saves, kb: Math.round(saveBytes / 1024) };
result.heapMBEnd = await page.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576));
result.errors = errors.slice(0, 5);

await browser.close();
console.log(JSON.stringify(result, null, 2));
if (args.out) fs.writeFileSync(args.out, JSON.stringify(result, null, 2));
