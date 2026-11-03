import "server-only";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

/**
 * npm installs CLIs on Windows as .cmd shims ("%dp0%\node_modules\…\cli.js"), and Node can't
 * spawn a .cmd without a shell (EINVAL). These resolve a shim to the file it actually runs.
 */

/** The script a .cmd shim runs (other paths are returned as they are). */
export const shimTarget = async (file: string): Promise<string | undefined> => {
  if (!/\.(cmd|bat)$/i.test(file)) return file;
  try {
    const text = await fs.readFile(file, "utf8");
    return [...text.matchAll(/"%dp0%\\([^"]+)"/gi)]
      .map((m) => path.resolve(path.dirname(file), m[1]))
      .find((p) => !/\\node\.exe$/i.test(p) && existsSync(p));
  } catch {
    return undefined;
  }
};

/** Codex's launcher script starts a native binary from its platform package; the SDK needs that binary. */
export const codexBinaryFor = (launcher: string): string | undefined => {
  if (!launcher.endsWith(".js")) return launcher;
  const pkgRoot = path.resolve(launcher, "..", "..");
  const arm = process.arch === "arm64";
  const platform = `codex-${process.platform}-${arm ? "arm64" : "x64"}`;
  const triple =
    process.platform === "win32"
      ? `${arm ? "aarch64" : "x86_64"}-pc-windows-msvc`
      : process.platform === "darwin"
        ? `${arm ? "aarch64" : "x86_64"}-apple-darwin`
        : `${arm ? "aarch64" : "x86_64"}-unknown-linux-musl`;
  const binary = process.platform === "win32" ? "codex.exe" : "codex";
  // Nested under the launcher's package, or hoisted next to it.
  for (const base of [path.join(pkgRoot, "node_modules", "@openai", platform), path.join(path.dirname(pkgRoot), platform)]) {
    const exe = path.join(base, "vendor", triple, "bin", binary);
    if (existsSync(exe)) return exe;
  }
  return undefined;
};

const execFileAsync = promisify(execFile);

/** Windows desktop installs keep native CLI versions under OpenAI/Codex/bin, outside the user's PATH. */
export const desktopCodexBinaries = async (directory: string): Promise<string[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  return [
    path.join(directory, "codex.exe"),
    ...entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(directory, entry.name, "codex.exe")),
  ].filter((file) => existsSync(file));
};

const getCodexVersion = async (file: string) => {
  const { stdout } = await execFileAsync(file, ["--version"], { timeout: 4000, windowsHide: true });
  return stdout;
};

const parseCodexVersion = (output: string) => {
  const match = /codex-cli\s+(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?/.exec(output);
  return match ? { numbers: match.slice(1, 4).map(Number), prerelease: match[4] ?? "" } : undefined;
};

/**
 * PATH can contain an old npm install before a newer desktop CLI. Using the first one pairs
 * an old runtime with the desktop app's newer model cache, which Codex rejects by client version.
 * Resolve every launcher, probe the actual binaries, and use the newest working installation.
 */
export const newestCodexBinary = async (
  candidates: string[],
  versionOf: (file: string) => Promise<string> = getCodexVersion,
): Promise<string | undefined> => {
  const resolved = await Promise.all(
    candidates.map(async (file) => {
      const target = await shimTarget(file);
      return target ? codexBinaryFor(target) : undefined;
    }),
  );
  const binaries = [...new Set(resolved.filter((file): file is string => Boolean(file)))];
  const versions = await Promise.all(
    binaries.map(async (file) => {
      try {
        const version = parseCodexVersion(await versionOf(file));
        return version ? { file, ...version } : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  const working = versions.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  working.sort((a, b) => {
    for (let i = 0; i < 3; i++) {
      if (a.numbers[i] !== b.numbers[i]) return b.numbers[i] - a.numbers[i];
    }
    if (!a.prerelease !== !b.prerelease) return a.prerelease ? 1 : -1;
    return b.prerelease.localeCompare(a.prerelease, "en", { numeric: true });
  });
  return working[0]?.file;
};
