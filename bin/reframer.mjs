#!/usr/bin/env node
// `reframer`: the Reframer CLI. Runs from this app checkout: rebuilds the bundle when the sources
// changed, picks the data folder, then hands over to src/cli/main.ts.

import { existsSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const userCwd = process.cwd();

/** Newest modification time under a folder (the CLI shares most of src/ with the app). */
const newest = (dir) => {
  let t = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    t = Math.max(t, entry.isDirectory() ? newest(full) : statSync(full).mtimeMs);
  }
  return t;
};

const bundle = path.join(appRoot, "dist", "cli", "reframer.mjs");
const src = path.join(appRoot, "src");
if (!existsSync(bundle) || (existsSync(src) && newest(src) > statSync(bundle).mtimeMs)) {
  if (!argv.includes("--quiet") && !argv.includes("-q")) process.stderr.write("reframer: building the CLI…\n");
  const { buildCli } = await import(pathToFileURL(path.join(appRoot, "scripts", "build-cli.mjs")).href);
  await buildCli(appRoot);
}

// The data folder is read when the app's modules load, so it is settled before importing them.
const flagValue = (name) => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  return argv[i].includes("=") ? argv[i].slice(argv[i].indexOf("=") + 1) : argv[i + 1];
};
const desktopDataDir = () => {
  const home = os.homedir();
  const base =
    process.platform === "win32"
      ? (process.env.APPDATA ?? path.join(home, "AppData", "Roaming"))
      : process.platform === "darwin"
        ? path.join(home, "Library", "Application Support")
        : (process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"));
  return path.join(base, "Reframer", "data");
};
const dataDir = flagValue("data-dir");
if (dataDir) process.env.REFRAMER_DATA_DIR = path.resolve(userCwd, dataDir);
else if (argv.includes("--desktop")) process.env.REFRAMER_DATA_DIR = desktopDataDir();

// Renders and the app's paths resolve from the app root (render workers, the composition source).
process.chdir(appRoot);
const { main } = await import(pathToFileURL(bundle).href);
process.exitCode = await main(argv, { cwd: userCwd, appRoot });
