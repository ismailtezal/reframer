// Encodes a folder of rendered frames (NNNN.png) into an MP4 for the Reframer timeline.
//   node encode.mjs <frames-dir> <out.mp4> [--fps 30] [--crf 12] [--hold 1]
// --hold 2 shows each frame for two (stop-motion rendered every 2nd frame: 15 drawings a second on a 30 fps clip).
// Frames may skip numbers (a sparse render): they play in order, each for `hold` frames.
// CRF 12 keeps grain and fine sand detail through Reframer's own export; the clip is H.264 yuv420p, +faststart.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findFfmpeg, parseArgs } from "./env.mjs";

const args = parseArgs(process.argv.slice(2));
const [dir, out] = args._.map((p) => path.resolve(p));
if (!dir || !out) {
  console.error("usage: node encode.mjs <frames-dir> <out.mp4> [--fps 30] [--crf 12] [--hold 1]");
  process.exit(2);
}
const fps = Number(args.fps ?? 30);
const hold = Math.max(1, Number(args.hold ?? 1));
const crf = Number(args.crf ?? 12);
const frames = fs
  .readdirSync(dir)
  .filter((f) => /^\d+\.png$/.test(f))
  .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
if (!frames.length) {
  console.error(`No NNNN.png frames in ${dir}`);
  process.exit(3);
}
const ff = findFfmpeg();
if (!ff) {
  console.error("ffmpeg not found (set FFMPEG)");
  process.exit(8);
}
// concat list with a duration per frame: works for any numbering and for held (stop-motion) frames
const dur = (hold / fps).toFixed(6);
const list = path.join(os.tmpdir(), `rf3d-encode-${process.pid}.txt`);
const esc = (p) => p.replace(/\\/g, "/").replace(/'/g, "'\\''");
const lines = frames.flatMap((f) => [`file '${esc(path.join(dir, f))}'`, `duration ${dur}`]);
lines.push(`file '${esc(path.join(dir, frames[frames.length - 1]))}'`); // the concat demuxer drops the last duration otherwise
fs.writeFileSync(list, lines.join("\n"));
fs.mkdirSync(path.dirname(out), { recursive: true });
const r = spawnSync(
  ff,
  ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-r", String(fps), "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
  { encoding: "utf8" },
);
fs.rmSync(list, { force: true });
if (r.status !== 0) {
  console.error(r.stderr || `ffmpeg exited ${r.status}`);
  process.exit(5);
}
console.log(JSON.stringify({ ok: true, out, frames: frames.length, seconds: Number(((frames.length * hold) / fps).toFixed(2)) }));
