import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The editor fills the window; errors still surface without the floating badge.
  devIndicators: false,
  // The video renderer bundles and drives Chrome itself; load it with plain Node require.
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer", "@remotion/compositor-win32-x64-msvc", "esbuild"],
  // The desktop app ships a self-contained server (see electron/ and scripts/prepare-standalone.mjs).
  output: "standalone",
  outputFileTracingIncludes: {
    // Next 16.3 doesn't trace its own route-handler runtime into standalone output.
    "/api/**": ["./node_modules/next/dist/compiled/next-server/app-route-turbo.runtime.prod.js"],
    // FFmpeg and the frame compositor are native binaries loaded by path, so tracing can't see them.
    "/api/render": ["./node_modules/@remotion/compositor-*/**/*"],
    "/api/agent": ["./src/agent/skills/**/*"],
  },
  outputFileTracingExcludes: {
    "/*": ["./.reframer/**/*", "./dist/**/*"],
  },
};

export default nextConfig;
