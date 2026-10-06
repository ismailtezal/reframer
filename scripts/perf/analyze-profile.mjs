// Summarizes a .cpuprofile: where the main thread spent its time.
//   node scripts/perf/analyze-profile.mjs perf-results/playback-123.cpuprofile [--top=30]

import fs from "node:fs";

const file = process.argv[2];
const top = Number(process.argv.find((a) => a.startsWith("--top="))?.split("=")[1] ?? 30);
const profile = JSON.parse(fs.readFileSync(file, "utf8"));

const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const selfTime = new Map();
const deltas = profile.timeDeltas;
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i];
  selfTime.set(id, (selfTime.get(id) ?? 0) + (deltas[i] ?? 0));
}
const total = [...selfTime.values()].reduce((a, b) => a + b, 0);

const shortUrl = (url) => {
  if (!url) return "(native)";
  const m = url.match(/node_modules[/\\]((?:@[^/\\]+[/\\])?[^/\\]+)/);
  if (m) return m[1];
  const chunk = url.match(/_next\/static\/chunks\/(.+?)(\?|$)/);
  return chunk ? `chunk:${chunk[1].slice(0, 60)}` : url.replace(/^https?:\/\/[^/]+/, "").slice(0, 80);
};

const fnAgg = new Map();
const pkgAgg = new Map();
for (const [id, t] of selfTime) {
  const n = byId.get(id);
  const cf = n.callFrame;
  const key = `${cf.functionName || "(anonymous)"}  ${shortUrl(cf.url)}:${cf.lineNumber + 1}`;
  fnAgg.set(key, (fnAgg.get(key) ?? 0) + t);
  const pkg = cf.url ? shortUrl(cf.url) : cf.functionName || "(native)";
  pkgAgg.set(pkg, (pkgAgg.get(pkg) ?? 0) + t);
}

const ms = (us) => (us / 1000).toFixed(1).padStart(8);
const pct = (us) => `${((us / total) * 100).toFixed(1)}%`.padStart(6);
console.log(`total sampled: ${(total / 1000).toFixed(0)} ms\n\nTop functions (self time):`);
for (const [k, t] of [...fnAgg].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`${ms(t)} ms ${pct(t)}  ${k}`);
console.log("\nBy source:");
for (const [k, t] of [...pkgAgg].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`${ms(t)} ms ${pct(t)}  ${k}`);
