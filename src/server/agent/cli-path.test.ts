import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { desktopCodexBinaries, newestCodexBinary } from "./cli-path";

describe("Codex executable detection", () => {
  it("finds the newer desktop CLI when Windows does not put it on PATH", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "reframer-codex-"));
    try {
      const versionDir = path.join(directory, "desktop-build");
      await fs.mkdir(versionDir);
      const desktop = path.join(versionDir, "codex.exe");
      await fs.writeFile(desktop, "test binary");
      await fs.mkdir(path.join(directory, "incomplete-build"));
      const candidates = await desktopCodexBinaries(directory);
      expect(candidates).toEqual([desktop]);
      expect(
        await newestCodexBinary(["old-npm.exe", ...candidates], async (file) =>
          file === desktop ? "codex-cli 0.162.0-alpha.17.2" : "codex-cli 0.147.0",
        ),
      ).toBe(desktop);
      expect(await desktopCodexBinaries(path.join(directory, "not-installed"))).toEqual([]);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it("uses a newer desktop CLI even when an old npm CLI is first on PATH", async () => {
    const versionOf = vi.fn(async (file: string) => (file === "old-npm.exe" ? "codex-cli 0.147.0\n" : "codex-cli 0.162.0-alpha.17.2\n"));
    expect(await newestCodexBinary(["old-npm.exe", "desktop.exe"], versionOf)).toBe("desktop.exe");
  });

  it("compares version numbers numerically and prefers stable builds at the same version", async () => {
    const versions: Record<string, string> = {
      "old.exe": "codex-cli 0.99.0",
      "beta.exe": "codex-cli 0.160.1-beta.2",
      "stable.exe": "codex-cli 0.160.1",
    };
    expect(await newestCodexBinary(Object.keys(versions), async (file) => versions[file])).toBe("stable.exe");
  });

  it("prefers newer prerelease builds and preserves PATH order for equal versions", async () => {
    const versions: Record<string, string> = {
      "alpha2.exe": "codex-cli 0.162.0-alpha.2",
      "alpha10.exe": "codex-cli 0.162.0-alpha.10",
      "same.exe": "codex-cli 0.162.0-alpha.10",
    };
    expect(await newestCodexBinary(Object.keys(versions), async (file) => versions[file])).toBe("alpha10.exe");
  });

  it("skips broken or unrecognized installations and probes each binary only once", async () => {
    const versionOf = vi.fn(async (file: string) => {
      if (file === "broken.exe") throw new Error("ENOENT");
      return file === "unknown.exe" ? "another tool" : "codex-cli 0.162.0";
    });
    expect(await newestCodexBinary(["broken.exe", "unknown.exe", "working.exe", "working.exe"], versionOf)).toBe("working.exe");
    expect(versionOf).toHaveBeenCalledTimes(3);
    expect(await newestCodexBinary(["broken.exe", "unknown.exe"], versionOf)).toBeUndefined();
    expect(await newestCodexBinary([], versionOf)).toBeUndefined();
  });
});
