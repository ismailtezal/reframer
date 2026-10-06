// Renders the app icon (scripts/icon/entry.tsx) to electron/build/icon.png and src/app/icon.png.
import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const root = process.cwd();
const serveUrl = await bundle({ entryPoint: path.join(root, "scripts", "icon", "entry.tsx") });
const composition = await selectComposition({ serveUrl, id: "icon" });
const out = path.join(root, "electron", "build", "icon.png");
await renderStill({ composition, serveUrl, output: out, imageFormat: "png" });
await renderStill({ composition, serveUrl, output: path.join(root, "src", "app", "icon.png"), imageFormat: "png", scale: 0.25 });
console.log(`icon written: ${out}`);
await fs.rm(serveUrl, { recursive: true, force: true }).catch(() => undefined);
