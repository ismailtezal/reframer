// electron-builder hook: copies the standalone server's dependencies into the
// packaged app. electron-builder never copies node_modules folders that sit
// inside extraResources, so we place them ourselves before installers are made.

const fs = require("node:fs/promises");
const path = require("node:path");

exports.default = async (context) => {
  const resources =
    context.electronPlatformName === "darwin"
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : path.join(context.appOutDir, "resources");
  const from = path.join(context.packager.projectDir, ".next", "standalone", "node_modules");
  const to = path.join(resources, "app-server", "node_modules");
  await fs.rm(to, { recursive: true, force: true });
  await fs.cp(from, to, { recursive: true, filter: (src) => !src.endsWith(".map") });
  console.log(`  • copied server dependencies → ${path.relative(context.appOutDir, to)}`);
};
