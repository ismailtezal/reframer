// Pre-bundles the Remotion composition for the desktop app, so packaged builds
// render without running webpack on the user's machine.
// Output: dist/remotion-bundle (picked up through REFRAMER_REMOTION_BUNDLE).

import path from "node:path";
import { bundle } from "@remotion/bundler";

const root = process.cwd();
const outDir = path.join(root, "dist", "remotion-bundle");

const result = await bundle({
  entryPoint: path.join(root, "src", "remotion", "index.ts"),
  outDir,
  onProgress: (p) => process.stdout.write(`\rBundling composition… ${Math.round(p)}%`),
  webpackOverride: (config) => ({
    ...config,
    resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), "@": path.join(root, "src") } },
  }),
});
console.log(`\nRemotion bundle ready: ${result}`);
