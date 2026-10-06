// Export benchmark: renders a project through the app's /api/render and reports speed.
//   node scripts/perf/render-bench.mjs <projectId> [--base=http://localhost:3000] [--json='{"format":"mp4","quality":"high"}'] [--seconds=20]
// --seconds limits the render to the first N seconds (via the range option) for quick comparisons.
// --only=video,text keeps just those clip types, --nofx strips effects (bottleneck hunting).
// CPU and GPU (nvidia-smi, when present) utilisation are sampled once a second while the render runs.
import { spawn } from "node:child_process";
import os from "node:os";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  }),
);
const projectId = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "proj_perfbench60fps";
const BASE = args.base ?? "http://localhost:3000";
const options = args.json ? JSON.parse(args.json) : {};

const { project } = await (await fetch(`${BASE}/api/projects/${projectId}`)).json();
if (args.only) {
  const keep = new Set(String(args.only).split(","));
  for (const [id, c] of Object.entries(project.clips)) if (!keep.has(c.type)) delete project.clips[id];
}
if (args.nofx) for (const c of Object.values(project.clips)) delete c.effects;
const fps = project.settings.fps;
const ends = Object.values(project.clips).map((c) => c.start + c.duration);
const total = ends.length ? Math.max(...ends) : fps * 10;
const frames = args.seconds ? Math.min(total, Math.round(Number(args.seconds) * fps)) : total;
const body = { project, format: "mp4", quality: "high", scale: 1, ...options, ...(args.seconds ? { range: [0, frames - 1] } : {}) };

// Utilisation sampling.
const cpuTimes = () =>
  os.cpus().reduce((a, c) => ({ idle: a.idle + c.times.idle, total: a.total + Object.values(c.times).reduce((x, y) => x + y, 0) }), {
    idle: 0,
    total: 0,
  });
const cpu = [];
let prev = cpuTimes();
const cpuTimer = setInterval(() => {
  const now = cpuTimes();
  cpu.push(100 * (1 - (now.idle - prev.idle) / (now.total - prev.total)));
  prev = now;
}, 1000);
const gpu = [];
let smi;
try {
  smi = spawn("nvidia-smi", ["--query-gpu=utilization.gpu,utilization.encoder", "--format=csv,noheader,nounits", "-l", "1"], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  smi.stdout.on("data", (d) => {
    for (const line of String(d).trim().split("\n")) {
      const [g, e] = line.split(",").map(Number);
      if (Number.isFinite(g)) gpu.push({ g, e });
    }
  });
  smi.on("error", () => undefined);
} catch {}
const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

const busy = () => os.cpus().reduce((a, c) => a + Object.values(c.times).reduce((x, y) => x + y, 0) - c.times.idle, 0);
const busy0 = busy();
const t0 = Date.now();
const res = await fetch(`${BASE}/api/render`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const { job, error } = await res.json();
if (!job) throw new Error(error ?? "render did not start");
let last = "";
let firstFrameAt = 0;
let cpuFrom = 0;
for (;;) {
  await new Promise((r) => setTimeout(r, 1000));
  const { job: j } = await (await fetch(`${BASE}/api/render?jobId=${job.id}`)).json();
  if (!firstFrameAt && j.progress > 0) {
    firstFrameAt = Date.now();
    cpuFrom = cpu.length;
  }
  if (j.stage !== last && process.stdout.isTTY) process.stdout.write(`\r${j.stage.padEnd(60)}`);
  last = j.stage;
  if (j.status === "done" || j.status === "error" || j.status === "cancelled") {
    clearInterval(cpuTimer);
    smi?.kill();
    const seconds = (Date.now() - t0) / 1000;
    const busyNow = busy();
    const busySamples = cpu.slice(cpuFrom);
    const result = {
      projectId,
      options: { ...options, seconds: args.seconds, only: args.only, nofx: args.nofx },
      status: j.status,
      error: j.error,
      frames,
      wallSec: Math.round(seconds * 10) / 10,
      startupSec: firstFrameAt ? Math.round(((firstFrameAt - t0) / 1000) * 10) / 10 : null,
      renderFps: Math.round((frames / seconds) * 10) / 10,
      steadyFps: firstFrameAt ? Math.round((frames / ((Date.now() - firstFrameAt) / 1000)) * 10) / 10 : null,
      realtimeX: Math.round((frames / fps / seconds) * 100) / 100,
      cpuAvg: avg(busySamples),
      cpuMsPerFrame: Math.round((busyNow - busy0) / frames),
      cpuMax: busySamples.length ? Math.round(Math.max(...busySamples)) : null,
      gpuAvg: avg(gpu.map((s) => s.g)),
      nvencAvg: avg(gpu.map((s) => s.e)),
      sizeMB: j.sizeBytes ? Math.round((j.sizeBytes / 1048576) * 10) / 10 : null,
      engine: j.engine,
      serverFps: j.fps,
      warning: j.status === "done" ? j.error : undefined,
      file: j.outputPath,
    };
    console.log(`\n${JSON.stringify(result)}`);
    break;
  }
}
