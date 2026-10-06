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

// Export workers (src/server/render-worker.cjs) run in their own Node process and load
// Remotion's CommonJS build. Next traces the server's ESM import, which bundles most of
// its dependencies, so copy the renderer's full dependency closure.
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
  await fs.cp(dir, path.join(standalone, path.relative(root, dir)), { recursive: true, force: true });
  const pkg = JSON.parse(await fs.readFile(pkgJson, "utf8"));
  for (const dep of Object.keys(pkg.dependencies ?? {})) await copyClosure(dep, dir);
};
await copyClosure("@remotion/renderer", root);
console.log(`copied ${copied.size} packages for export workers`);

// Never ship a developer's local data inside the app.
await fs.rm(path.join(standalone, ".reframer"), { recursive: true, force: true });
await fs.rm(path.join(standalone, ".env"), { force: true });
await fs.rm(path.join(standalone, ".env.local"), { force: true });
console.log("standalone server ready");
