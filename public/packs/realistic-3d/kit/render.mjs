// Renders shots of a Blender scene with a shot script, in parallel Blender workers, resuming where it stopped.
//   node render.mjs --blend scene.blend --script shots.py --out frames [--shots s1,s2] [--profile preview|draft|final]
//                   [--workers 2] [--scale 50] [--spp 32] [--range 1-60] [--priority low] [-- extra args for the script]
//
// The shot script contract (rf3d_common.shot_args reads it):
//   blender -b <blend> --python <script> -- <shot> <outdir> <start> <end> <step> <scale%> <samples> [extra...]
//   outdir is the shot's own folder (out/<shot>); write frames as NNNN.png (rf3d_common.render_frames).
//   end 0 = the shot's last frame; step 0 = preview (first, middle and last frame).
// shots.json beside the script maps each shot to its frame count ({"s1": 120, ...}); it lets render.mjs split work
// between workers and skip frames already on disk.
//
// Profiles (a profile's values can be overridden by --scale/--spp):
//   preview  50% size, 16 samples, first/middle/last frame per shot, no motion blur; writes out/preview-sheet.jpg
//   draft    67% size (720 x 1280 for 9:16), 24 samples, OptiX denoise, no motion blur: timing and acting checks
//   final    100%, 64 samples, OIDN on the GPU, motion blur: delivery
// Prints one JSON summary on stdout; progress (FRAME lines with seconds) on stderr.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BLENDER_SCRIPTS, findBlender, loadSharp, parseArgs, runBlender } from "./env.mjs";

const args = parseArgs(process.argv.slice(2));
const need = (k) => {
  if (!args[k] || args[k] === true) {
    console.error(`--${k} is required`);
    process.exit(2);
  }
  return path.resolve(String(args[k]));
};
const blend = need("blend");
const script = need("script");
const out = need("out");
const PROFILES = {
  preview: { scale: 50, spp: 16, step: 0, mblur: "0", denoise: "optix" },
  draft: { scale: 67, spp: 24, step: 1, mblur: "0", denoise: "optix" },
  final: { scale: 100, spp: 64, step: 1, mblur: "1", denoise: "oidn-gpu" },
};
const profileName = String(args.profile ?? "preview");
const profile = PROFILES[profileName];
if (!profile) {
  console.error(`unknown profile ${profileName}: preview, draft or final`);
  process.exit(2);
}
const scale = Number(args.scale ?? profile.scale);
const spp = Number(args.spp ?? profile.spp);
const step = args.step !== undefined ? Number(args.step) : profile.step;
const workers = Math.max(1, Number(args.workers ?? 1));
const extra = args["--"] ?? [];
const lengthsFile = path.join(path.dirname(script), "shots.json");
const lengths = fs.existsSync(lengthsFile) ? JSON.parse(fs.readFileSync(lengthsFile, "utf8")) : {};
const shots = args.shots ? String(args.shots).split(",").filter(Boolean) : Object.keys(lengths);
if (!shots.length) {
  console.error("No shots: pass --shots, or put shots.json (shot -> frame count) beside the script");
  process.exit(2);
}
if (!findBlender()) {
  console.error("Blender not found (set BLENDER)");
  process.exit(8);
}

const pad = (n) => String(n).padStart(4, "0");
const frameFile = (shot, f) => path.join(out, shot, `${pad(f)}.png`);

// Work units: a contiguous range of missing frames of one shot (preview: one unit per shot).
const units = [];
for (const shot of shots) {
  const n = lengths[shot];
  if (step === 0 || !n) {
    units.push({ shot, start: 1, end: 0, step });
    continue;
  }
  const [a, b] = args.range ? String(args.range).split("-").map(Number) : [1, n];
  const todo = [];
  for (let f = a; f <= Math.min(b, n); f += step) if (!fs.existsSync(frameFile(shot, f))) todo.push(f);
  if (!todo.length) continue;
  // split into about `workers` chunks per shot so workers share long shots
  const chunk = Math.max(step, Math.ceil(todo.length / workers) * step);
  for (let i = 0; i < todo.length; ) {
    const start = todo[i];
    let j = i;
    while (j + 1 < todo.length && todo[j + 1] === todo[j] + step && todo[j + 1] - start < chunk) j++;
    units.push({ shot, start, end: todo[j], step });
    i = j + 1;
  }
}

const started = Date.now();
const times = [];
let failed = 0;
const env = {
  RF3D_BLENDER: BLENDER_SCRIPTS,
  MBLUR: profile.mblur,
  DENOISE: process.env.DENOISE ?? profile.denoise,
};
const runUnit = async (u, w) => {
  fs.mkdirSync(path.join(out, u.shot), { recursive: true });
  const code = await runBlender(
    ["-b", blend, "--python", script, "--", u.shot, path.join(out, u.shot), String(u.start), String(u.end), String(u.step), String(scale), String(spp), ...extra],
    {
      env,
      onLine: (l) => {
        const m = l.match(/^FRAME \S* (\d+) ([\d.]+)s/);
        if (m) times.push(Number(m[2]));
        // (Cycles probes every GPU backend; the missing AMD HIP library on NVIDIA machines is noise)
        if (/^(FRAME|DONE|WARN)|Error|Traceback|rror:/.test(l) && !/HIPEW|HIP dynamic library/.test(l)) console.error(`[w${w}] ${l}`);
      },
    },
  );
  if (code !== 0) {
    failed++;
    console.error(`[w${w}] ${u.shot} ${u.start}-${u.end} exited ${code}`);
  }
};
if (String(args.priority) === "low") {
  // below-normal CPU priority for this process and the Blender workers it starts (keeps a game or call smooth)
  try {
    os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch {}
}
const queue = [...units];
await Promise.all(
  Array.from({ length: Math.min(workers, queue.length) }, async (_, w) => {
    while (queue.length) await runUnit(queue.shift(), w + 1);
  }),
);

let sheet;
if (step === 0 && !failed) {
  // contact sheet: every preview frame, one row per shot
  const sharp = loadSharp();
  const rows = [];
  for (const shot of shots) {
    const dir = path.join(out, shot);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{4}\.png$/.test(f)).sort() : [];
    if (files.length) rows.push(files.map((f) => path.join(dir, f)));
  }
  if (rows.length) {
    const meta = await sharp(rows[0][0]).metadata();
    const w = 320;
    const h = Math.round((meta.height / meta.width) * w);
    const cols = Math.max(...rows.map((r) => r.length));
    const tiles = [];
    for (const [ri, r] of rows.entries())
      for (const [ci, f] of r.entries()) tiles.push({ input: await sharp(f).resize(w, h).toBuffer(), left: ci * (w + 8), top: ri * (h + 8) });
    sheet = path.join(out, "preview-sheet.jpg");
    await sharp({ create: { width: cols * (w + 8) - 8, height: rows.length * (h + 8) - 8, channels: 3, background: "#111" } })
      .composite(tiles)
      .jpeg({ quality: 82 })
      .toFile(sheet);
  }
}

const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
console.log(
  JSON.stringify(
    {
      ok: failed === 0,
      profile: profileName,
      scale,
      samples: spp,
      shots,
      framesRendered: times.length,
      secondsPerFrame: Number(avg.toFixed(2)),
      wallSeconds: Math.round((Date.now() - started) / 1000),
      out,
      sheet,
      failedUnits: failed,
    },
    null,
    2,
  ),
);
process.exit(failed ? 5 : 0);
