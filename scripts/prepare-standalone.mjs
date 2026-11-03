// Completes Next's standalone server for the desktop app: standalone output
// leaves out static assets, public files and our markdown skills.

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

const copy = async (from, to) => {
  await fs.rm(to, { recursive: true, force: true });
  await fs.cp(from, to, { recursive: true });
  console.log(`copied ${path.relative(root, from)} → ${path.relative(root, to)}`);
};

await fs.access(path.join(standalone, "server.js")).catch(() => {
  console.error("No .next/standalone/server.js. Run `next build` first (output: standalone).");
  process.exit(1);
});

await copy(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
await copy(path.join(root, "public"), path.join(standalone, "public"));
await copy(path.join(root, "src", "agent", "skills"), path.join(standalone, "src", "agent", "skills"));

// Next's file tracing copies only the files it sees being required. That misses DLLs that native
// modules load (sharp's libvips) and React's development builds, whose absence leaves
// `react/jsx-runtime` with no named exports for ESM importers (Remotion's renderer). Packages the
// server or export workers load at runtime get their complete dependency closure instead, including
// installed optional and peer dependencies.
const findPackage = (name, fromDir) => {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", name, "package.json");
    if (existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
};
const copied = new Set();
const copyClosure = async (name, fromDir) => {
  const pkgJson = findPackage(name, fromDir);
  if (!pkgJson) return;
  const dir = path.dirname(pkgJson);
  if (copied.has(dir)) return;
  copied.add(dir);
  const to = path.join(standalone, path.relative(root, dir));
  await fs.rm(to, { recursive: true, force: true });
  await fs.cp(dir, to, { recursive: true });
  const pkg = JSON.parse(await fs.readFile(pkgJson, "utf8"));
  const deps = { ...pkg.peerDependencies, ...pkg.optionalDependencies, ...pkg.dependencies };
  for (const dep of Object.keys(deps)) await copyClosure(dep, dir);
};
// Export workers (src/server/render-worker.cjs) run in their own Node process and load Remotion's
// CommonJS build; the server imports its ESM build. sharp makes thumbnails and the encoder probe.
const RUNTIME = ["@remotion/renderer", "sharp"];
for (const name of RUNTIME) await copyClosure(name, root);
console.log(`copied ${copied.size} complete packages (${RUNTIME.join(", ")} and their dependencies)`);

// Server-only packages are loaded from .next/node_modules/<name>-<hash>, which Next writes as
// symlinks into this machine's node_modules. Installers copy what a link points to, but the
// unpacked app (and anything run inside the repo) would keep reaching into the dev folder, so a
// local test passes while the installed app breaks. Replace each link with a real copy.
const externals = path.join(standalone, ".next", "node_modules");
const links = [];
for (const entry of await fs.readdir(externals, { withFileTypes: true }).catch(() => [])) {
  const at = path.join(externals, entry.name);
  if (entry.isSymbolicLink()) links.push(at);
  else if (entry.isDirectory() && entry.name.startsWith("@")) {
    for (const scoped of await fs.readdir(at, { withFileTypes: true })) {
      if (scoped.isSymbolicLink()) links.push(path.join(at, scoped.name));
    }
  }
}
for (const link of links) {
  const target = await fs.realpath(link);
  await fs.unlink(link).catch(() => fs.rmdir(link));
  await fs.cp(target, link, { recursive: true });
  console.log(`resolved ${path.relative(standalone, link)} (was a link to ${path.relative(root, target)})`);
}

// Never ship a developer's local data inside the app.
await fs.rm(path.join(standalone, ".reframer"), { recursive: true, force: true });
await fs.rm(path.join(standalone, ".env"), { force: true });
await fs.rm(path.join(standalone, ".env.local"), { force: true });
console.log("standalone server ready");
