// Starts Reframer as a desktop app in development:
//   1. reuses a running dev server (REFRAMER_DEV_URL) or starts `next dev` on a free port,
//   2. opens it in Electron.
// Usage: npm run desktop

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";

const require = createRequire(import.meta.url);
const electron = require("electron");

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const isUp = async (url) => {
  try {
    const res = await fetch(`${url}/api/settings`);
    return res.status < 500;
  } catch {
    return false;
  }
};

let devServer = null;
let url = process.env.REFRAMER_DEV_URL;

if (!url || !(await isUp(url))) {
  const port = await freePort();
  url = `http://localhost:${port}`;
  console.log(`Starting next dev on ${url}…`);
  devServer = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "dev", "-p", String(port)], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const started = Date.now();
  while (!(await isUp(url))) {
    if (Date.now() - started > 120_000) {
      console.error("next dev didn't come up in 2 minutes");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

console.log(`Opening ${url} in Electron…`);
const app = spawn(electron, ["."], { stdio: "inherit", env: { ...process.env, REFRAMER_DEV_URL: url } });
app.on("exit", (code) => {
  devServer?.kill();
  process.exit(code ?? 0);
});
