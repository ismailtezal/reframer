// Completes Next's standalone server for the desktop app: standalone output
// leaves out static assets, public files and our markdown skills.

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

// Never ship a developer's local data inside the app.
await fs.rm(path.join(standalone, ".reframer"), { recursive: true, force: true });
await fs.rm(path.join(standalone, ".env"), { force: true });
await fs.rm(path.join(standalone, ".env.local"), { force: true });
console.log("standalone server ready");
