// Exports a short range in every format/codec combination and checks each file with ffprobe.
//   node scripts/perf/format-matrix.mjs <projectId> [--base=http://localhost:3000] [--seconds=4] [--only=name,name]
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  }),
);
const projectId = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "proj_perfbench60fps";
const BASE = args.base ?? "http://localhost:3000";
const seconds = Number(args.seconds ?? 4);
const ffprobe = path.join(path.dirname(require.resolve("@remotion/compositor-win32-x64-msvc/package.json")), "ffprobe.exe");

const CASES = {
  "mp4-h264-crf-cpu": { format: "mp4", videoCodec: "h264", hardware: "off" },
  "mp4-h264-bitrate-cpu": { format: "mp4", videoCodec: "h264", hardware: "off", rateControl: "bitrate", bitrateMbps: 8 },
  "mp4-h264-nvenc-quality": { format: "mp4", videoCodec: "h264", hardware: "on" },
  "mp4-h264-nvenc-bitrate": { format: "mp4", videoCodec: "h264", hardware: "on", rateControl: "bitrate", bitrateMbps: 8 },
  "mp4-h265-nvenc": { format: "mp4", videoCodec: "h265", hardware: "on" },
  "mp4-h265-cpu": { format: "mp4", videoCodec: "h265", hardware: "off", speed: "fastest" },
  "mp4-720-fastest": { format: "mp4", resolution: 720, speed: "fastest", crf: 26 },
  "mp4-4k": { format: "mp4", resolution: 2160, rateControl: "bitrate", bitrateMbps: 50 },
  "mp4-mp3-audio": { format: "mp4", audioCodec: "mp3", audioBitrateK: 192 },
  "mp4-no-audio": { format: "mp4", includeAudio: false },
  "mov-prores-proxy": { format: "mov", videoCodec: "prores", proresProfile: "proxy", audioCodec: "pcm" },
  "mov-prores-4444": { format: "mov", videoCodec: "prores", proresProfile: "4444", audioCodec: "pcm" },
  "mov-h264-aac": { format: "mov", videoCodec: "h264", audioCodec: "aac" },
  "webm-vp9": { format: "webm", videoCodec: "vp9", crf: 31, audioCodec: "opus", speed: "fastest" },
  "webm-vp9-bitrate": { format: "webm", videoCodec: "vp9", rateControl: "bitrate", bitrateMbps: 6, audioCodec: "opus", speed: "fastest" },
  gif: { format: "gif", videoCodec: "gif", resolution: 480, includeAudio: false },
  wav: { format: "wav", audioCodec: "pcm" },
  mp3: { format: "mp3", audioCodec: "mp3", audioBitrateK: 320 },
  m4a: { format: "m4a", audioCodec: "aac", audioBitrateK: 256 },
};
const only = args.only ? new Set(String(args.only).split(",")) : null;

const { project } = await (await fetch(`${BASE}/api/projects/${projectId}`)).json();
const fps = project.settings.fps;
const from = Math.round(Number(args.from ?? 30) * fps);
const range = [from, from + Math.round(seconds * fps) - 1];
const rows = [];
for (const [name, settings] of Object.entries(CASES)) {
  if (only && !only.has(name)) continue;
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, settings, range, presetName: name }),
  });
  const { job } = await res.json();
  let j = job;
  while (j && !["done", "error", "cancelled"].includes(j.status)) {
    await new Promise((r) => setTimeout(r, 700));
    j = (await (await fetch(`${BASE}/api/render?jobId=${job.id}`)).json()).job;
  }
  const row = { name, status: j?.status, sec: Math.round((Date.now() - t0) / 100) / 10, error: j?.error };
  if (j?.status === "done") {
    try {
      const info = JSON.parse(
        execFileSync(ffprobe, [
          "-v",
          "error",
          "-count_packets",
          "-show_entries",
          "stream=codec_type,codec_name,width,height,nb_read_packets,sample_rate,pix_fmt,profile:format=duration,size",
          "-of",
          "json",
          j.outputPath,
        ]).toString(),
      );
      const v = info.streams.find((s) => s.codec_type === "video");
      const a = info.streams.find((s) => s.codec_type === "audio");
      Object.assign(row, {
        video: v ? `${v.codec_name}${v.profile ? `/${v.profile}` : ""} ${v.width}x${v.height} ${v.pix_fmt} ${v.nb_read_packets}f` : "-",
        audio: a ? `${a.codec_name} ${a.sample_rate}` : "-",
        dur: Number(info.format.duration).toFixed(3),
        MB: (Number(info.format.size) / 1e6).toFixed(1),
      });
    } catch (e) {
      row.probe = String(e).slice(0, 120);
    }
  }
  rows.push(row);
  console.log(JSON.stringify(row));
}
