// Bundles the `reframer` CLI (src/cli/main.ts and the app code it shares with the editor) into
// dist/cli/reframer.mjs. Dependencies stay external and load from node_modules. bin/reframer.mjs runs
// this automatically when the sources are newer than the bundle.

import path from "node:path";
import { fileURLToPath } from "node:url";

export const CLI_BUNDLE = (root) => path.join(root, "dist", "cli", "reframer.mjs");

export const buildCli = async (root) => {
  const { build } = await import("esbuild");
  await build({
    entryPoints: [path.join(root, "src", "cli", "main.ts")],
    outfile: CLI_BUNDLE(root),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    // node_modules load as they are (native modules, Remotion's renderer); only the app's own code is bundled.
    packages: "external",
    tsconfig: path.join(root, "tsconfig.json"),
    // The Next "server-only" guard throws outside a React server build.
    alias: { "server-only": path.join(root, "src", "test", "server-only.ts") },
    jsx: "automatic",
    logLevel: "error",
    // Some dependencies are CommonJS and call require().
    banner: { js: "import { createRequire as __reframerRequire } from 'node:module'; const require = __reframerRequire(import.meta.url);" },
  });
  return CLI_BUNDLE(root);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const out = await buildCli(root);
  console.log(`CLI bundle ready: ${path.relative(root, out)}`);
}
