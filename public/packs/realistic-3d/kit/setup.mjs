// Checks what the realistic-3d kit needs and, with --install, prepares it from zips already downloaded:
//   node setup.mjs              report: Blender, MPFB, MakeHuman packs, Poly Haven assets, ffmpeg, sharp
//   node setup.mjs --install    install MPFB into the kit's isolated Blender profile and load the MakeHuman packs
//   node setup.mjs --list       also list the skins, hair, clothes and eyebrows a character can use
// Missing downloads are named with their size; fetch them with fetch.mjs (only after the user agreed).
// Prints one JSON report on stdout, progress on stderr.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BLENDER_SCRIPTS, findBlender, findFfmpeg, HOME, loadSharp, MH, PH, PROFILE, parseArgs, runBlender } from "./env.mjs";

const args = parseArgs(process.argv.slice(2));
const MPFB_ZIP = /^add-on-mpfb-v[\d.]+\.zip$/;
const PACKS = ["makehuman_system_assets_cc0.zip", "faceunits01.zip"];
const zips = fs.existsSync(MH) ? fs.readdirSync(MH) : [];
const mpfbZip = zips.find((z) => MPFB_ZIP.test(z));
const mpfbDir = path.join(PROFILE, "extensions", "user_default", "mpfb");
const mpfbData = path.join(PROFILE, "extensions", ".user", "user_default", "mpfb", "data");
const packsLoaded = () => fs.existsSync(path.join(mpfbData, "skins")) && fs.existsSync(path.join(mpfbData, "clothes"));

const report = { home: HOME, blender: findBlender(), blenderVersion: null, mpfb: fs.existsSync(mpfbDir), makehuman: packsLoaded() };
if (report.blender) {
  const v = spawnSync(report.blender, ["--version"], { encoding: "utf8" });
  report.blenderVersion = (v.stdout?.match(/Blender (\d+\.\d+(?:\.\d+)?)/) ?? [])[1] ?? null;
}
report.ffmpeg = findFfmpeg();
try {
  loadSharp();
  report.sharp = true;
} catch {
  report.sharp = false;
}
report.polyhaven = fs.existsSync(PH) ? fs.readdirSync(PH).filter((d) => fs.statSync(path.join(PH, d)).isDirectory()) : [];

const missing = [];
if (!report.blender) missing.push("Blender 4.2+ (blender.org; or set BLENDER to its executable)");
const [major, minor] = (report.blenderVersion ?? "0.0").split(".").map(Number);
if (report.blender && (major < 4 || (major === 4 && minor < 2))) missing.push(`Blender 4.2+ (found ${report.blenderVersion})`);
if (!mpfbZip && !report.mpfb) missing.push("MPFB 2.0.18 add-on, 46 MB: node fetch.mjs makehuman");
for (const p of PACKS) if (!zips.includes(p) && !report.makehuman) missing.push(`${p}: node fetch.mjs makehuman`);
if (!report.ffmpeg) missing.push("ffmpeg (for encode.mjs)");
if (!report.sharp) missing.push("sharp in the app's node_modules (for textures and contact sheets)");

if (args.install) {
  if (!report.blender) throw new Error("Blender not found");
  fs.mkdirSync(PROFILE, { recursive: true });
  if (!report.mpfb) {
    if (!mpfbZip) throw new Error("No MPFB zip in " + MH + ": run `node fetch.mjs makehuman` first (after the user agreed)");
    console.error("installing MPFB", mpfbZip);
    const code = await runBlender(["--command", "extension", "install-file", "-r", "user_default", "-e", path.join(MH, mpfbZip)], {
      onLine: (l) => l.trim() && console.error("  " + l),
    });
    if (code !== 0) throw new Error(`MPFB install failed (exit ${code})`);
    report.mpfb = fs.existsSync(mpfbDir);
  }
  if (!packsLoaded()) {
    const have = PACKS.filter((p) => zips.includes(p)).map((p) => path.join(MH, p));
    if (have.length < PACKS.length) throw new Error("MakeHuman packs missing in " + MH + ": run `node fetch.mjs makehuman` first");
    console.error("loading MakeHuman packs (a few minutes for the 281 MB system assets)");
    const code = await runBlender(["-b", "--factory-startup", "--python", path.join(BLENDER_SCRIPTS, "rf3d_packs.py"), "--", ...have]);
    if (code !== 0) throw new Error(`loading the MakeHuman packs failed (exit ${code})`);
  }
  report.makehuman = packsLoaded();
}

if (args.list && report.mpfb) {
  report.assets = {};
  await runBlender(["-b", "--python", path.join(BLENDER_SCRIPTS, "rf3d_packs.py")], {
    onLine: (l) => {
      const m = l.match(/^LIST (\w+): (.*)$/);
      if (m) report.assets[m[1]] = m[2].split(" ").filter(Boolean);
    },
  });
}

report.ready = Boolean(report.blender && report.mpfb && report.makehuman && report.ffmpeg && report.sharp);
report.missing = missing.filter((m) => !(report.mpfb && m.startsWith("MPFB")) && !(report.makehuman && m.endsWith("fetch.mjs makehuman")));
console.log(JSON.stringify(report, null, 2));
