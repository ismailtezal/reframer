// Builds the Remotion bundle the way the app does (src/server/render.ts) and prints its directory.
import path from "node:path";
import { bundle } from "@remotion/bundler";

const out = path.resolve(process.argv[2] ?? ".reframer/cache/remotion-bundle-perf");
await bundle({
  entryPoint: path.resolve("src/remotion/index.ts"),
  outDir: out,
  webpackOverride: (config) => ({
    ...config,
    resolve: { ...config.resolve, alias: { ...config.resolve?.alias, "@": path.resolve("src") } },
  }),
});
console.log(out);
