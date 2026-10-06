// Spawns N render-direct workers on disjoint frame ranges and reports aggregate throughput + CPU.
//   node scripts/perf/parallel-bench.mjs <projectId> --workers=2 --frames=600 --bundle=<dir> --media=<origin> [--json='{...}']
import { spawn } from "node:child_process";
import os from "node:os";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  }),
);
const projectId = process.argv.slice(2).find((a) => !a.startsWith("--"));
const workers = Number(args.workers ?? 2);
const frames = Number(args.frames ?? 600);
const cpuTimes = () =>
  os.cpus().reduce((a, c) => ({ idle: a.idle + c.times.idle, total: a.total + Object.values(c.times).reduce((x, y) => x + y, 0) }), {
    idle: 0,
    total: 0,
  });
const c0 = cpuTimes();
const busyMs = (c) => c.total - c.idle;
const t0 = Date.now();
const per = Math.ceil(frames / workers);
const results = await Promise.all(
  Array.from({ length: workers }, (_, i) => {
    const from = i * per;
    const to = Math.min(frames, (i + 1) * per) - 1;
    const a = [
      "scripts/perf/render-direct.mjs",
      projectId,
      `--bundle=${args.bundle}`,
      `--media=${args.media}`,
      `--from=${from}`,
      `--to=${to}`,
      `--out=perf-results/par-${i}.mp4`,
    ];
    if (args.json) a.push(`--json=${args.json}`);
    if (args.only) a.push(`--only=${args.only}`);
    return new Promise((resolve) => {
      const p = spawn(process.execPath, a, { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let err = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (err += d));
      p.on("close", (code) => resolve(code === 0 ? JSON.parse(out.trim().split("\n").pop()) : { error: err.slice(-400) }));
    });
  }),
);
const sec = (Date.now() - t0) / 1000;
const c1 = cpuTimes();
console.log(
  JSON.stringify({
    workers,
    frames,
    wallSec: +sec.toFixed(1),
    aggregateFps: +(frames / sec).toFixed(1),
    cpu: Math.round(100 * (1 - (c1.idle - c0.idle) / (c1.total - c0.total))),
    cpuMsPerFrame: Math.round((busyMs(c1) - busyMs(c0)) / frames),
    results,
  }),
);
