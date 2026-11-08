// Shared by the realistic-3d kit's scripts: where its Blender profile and downloaded assets live, which Blender
// runs, the ffmpeg to encode with, and a runner that gives Blender the kit's isolated profile.
//
// Everything heavy stays outside the app: REFRAMER_REAL3D_HOME (default ~/.reframer/real3d) holds
//   blender-user/   an isolated Blender profile (MPFB and the MakeHuman packs install here, never into the
//                   user's own Blender settings)
//   assets/mh/      MPFB and MakeHuman zips (fetch.mjs makehuman)
//   assets/ph/      Poly Haven assets, one folder per asset id (fetch.mjs polyhaven ...)
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const KIT = path.dirname(fileURLToPath(import.meta.url));
export const BLENDER_SCRIPTS = path.join(KIT, "blender");
/** The Reframer app folder (public/packs/realistic-3d/kit → four levels up). */
export const APP_ROOT = path.resolve(KIT, "..", "..", "..", "..");
export const HOME = path.resolve(process.env.REFRAMER_REAL3D_HOME || path.join(os.homedir(), ".reframer", "real3d"));
export const PROFILE = path.join(HOME, "blender-user");
export const MH = path.join(HOME, "assets", "mh");
export const PH = path.join(HOME, "assets", "ph");

const versionOf = (name) => (name.match(/(\d+)\.(\d+)/) ?? [0, 0, 0]).slice(1).map(Number);
const newestFirst = (a, b) => {
  const [x, y] = [versionOf(a), versionOf(b)];
  return y[0] - x[0] || y[1] - x[1];
};

/** The Blender to run: $BLENDER, else the newest standard install, else `blender` on PATH; null if none. */
export const findBlender = () => {
  if (process.env.BLENDER) return fs.existsSync(process.env.BLENDER) ? process.env.BLENDER : null;
  const found = [];
  if (process.platform === "win32") {
    for (const root of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean)) {
      const dir = path.join(root, "Blender Foundation");
      if (!fs.existsSync(dir)) continue;
      for (const d of fs.readdirSync(dir).filter((n) => /^Blender \d/.test(n)).sort(newestFirst)) found.push(path.join(dir, d, "blender.exe"));
    }
  } else if (process.platform === "darwin") {
    found.push("/Applications/Blender.app/Contents/MacOS/Blender");
  } else {
    found.push("/usr/bin/blender", "/usr/local/bin/blender", "/snap/bin/blender");
  }
  const exe = found.find((f) => fs.existsSync(f));
  if (exe) return exe;
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["blender"], { encoding: "utf8" });
  return which.status === 0 ? which.stdout.split(/\r?\n/)[0].trim() || null : null;
};

/** Environment for Blender: the kit's own profile, so MPFB and its assets never touch the user's settings. */
// (no __pycache__ beside the kit's scripts: the app folder may be read-only, and it is source)
export const blenderEnv = (extra = {}) => ({ ...process.env, BLENDER_USER_RESOURCES: PROFILE, PYTHONDONTWRITEBYTECODE: "1", ...extra });

/**
 * Runs Blender and resolves with its exit code. Every output line goes to `onLine` (default: lines that matter —
 * progress the kit's scripts print, errors and tracebacks).
 */
export const runBlender = (args, { env = {}, onLine, quiet = false } = {}) =>
  new Promise((resolve, reject) => {
    const exe = findBlender();
    if (!exe) return reject(new Error("Blender not found: install Blender 4.2 or newer, or set BLENDER to its executable"));
    const child = spawn(exe, args, { env: blenderEnv(env), windowsHide: true });
    const show =
      onLine ??
      ((l) => {
        if (!quiet && /^(FRAME|DONE|SAVED|BUILT|READY|LEN|INFO|WARN)|Error|Traceback|rror:|line \d+/.test(l)) console.error(l);
      });
    let buf = "";
    const feed = (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const l of lines) show(l);
    };
    child.stdout.on("data", feed);
    child.stderr.on("data", feed);
    child.on("error", reject);
    child.on("close", (code) => {
      if (buf) show(buf);
      resolve(code ?? 1);
    });
  });

/** ffmpeg: $FFMPEG, else one on PATH, else the one Remotion ships with the app. */
export const findFfmpeg = () => {
  if (process.env.FFMPEG && fs.existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  const onPath = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (onPath.status === 0) return "ffmpeg";
  const remotion = path.join(APP_ROOT, "node_modules", "@remotion");
  if (fs.existsSync(remotion)) {
    for (const d of fs.readdirSync(remotion).filter((n) => n.startsWith("compositor-"))) {
      const exe = path.join(remotion, d, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
};

/** sharp (images), from the app's own node_modules. */
export const loadSharp = () => {
  try {
    return createRequire(path.join(APP_ROOT, "package.json"))("sharp");
  } catch {
    throw new Error(`sharp is not installed in ${APP_ROOT}: run \`npm i sharp\` there`);
  }
};

/** `--name value` / `--flag` arguments into an object, the rest positional. */
export const parseArgs = (argv) => {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      out["--"] = argv.slice(i + 1);
      break;
    }
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
};
