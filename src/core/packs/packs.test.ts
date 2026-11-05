import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { filmSource } from "@/remotion/components/film/PageFilm";
import { filmUrl, PAGE_FILM_ENTRY, type PackManifest, PackManifestSchema, resolvePackInputs } from ".";

/** Packs are data contributors add by copying a folder: validate every one the way a host would load it. */

const PACKS_DIR = path.join(process.cwd(), "public", "packs");
const SKILLS_DIR = path.join(process.cwd(), "src", "agent", "skills");
const folders = existsSync(PACKS_DIR)
  ? readdirSync(PACKS_DIR).filter((f) => !f.startsWith("_") && !f.startsWith(".") && statSync(path.join(PACKS_DIR, f)).isDirectory())
  : [];

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );

const load = (folder: string): PackManifest =>
  PackManifestSchema.parse(JSON.parse(readFileSync(path.join(PACKS_DIR, folder, "pack.json"), "utf8")));

describe.each(folders)("style pack %s", (folder) => {
  const dir = path.join(PACKS_DIR, folder);

  it("has a valid manifest named after its folder", () => {
    const raw = JSON.parse(readFileSync(path.join(dir, "pack.json"), "utf8"));
    const parsed = PackManifestSchema.safeParse(raw);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 5))).toBe(true);
    expect(load(folder).id).toBe(folder);
  });

  it("ships the files its manifest names", () => {
    const m = load(folder);
    expect(existsSync(path.join(dir, m.guide)), `guide ${m.guide}`).toBe(true);
    for (const rel of [m.poster, m.preview]) if (rel && !/^https?:/.test(rel)) expect(existsSync(path.join(dir, rel)), rel).toBe(true);
  });

  it("defaults fit their own inputs", () => {
    const m = load(folder);
    expect(resolvePackInputs(m, Object.fromEntries(m.inputs.map((i) => [i.key, i.default]))).problems).toEqual([]);
  });

  it("does not shadow a built-in skill", () => {
    expect(existsSync(path.join(SKILLS_DIR, `${folder}.md`))).toBe(false);
  });

  it("plays as a page film: loads the bridge first and imports nothing by absolute path", () => {
    const m = load(folder);
    if (m.engine.kind !== "page") return;
    const entry = path.join(dir, PAGE_FILM_ENTRY);
    expect(existsSync(entry)).toBe(true);
    const html = readFileSync(entry, "utf8");
    const bridge = html.indexOf("_core/bridge.js");
    expect(bridge, "index.html loads ../../_core/bridge.js").toBeGreaterThan(-1);
    const firstModule = html.search(/<script[^>]*type=["']module["']/);
    if (firstModule > -1) expect(bridge).toBeLessThan(firstModule);
    // Absolute imports resolve against whatever serves the page (the app, the media server, another host).
    const absolute = filesUnder(path.dirname(entry))
      .filter((f) => /\.(m?js|html)$/.test(f))
      .flatMap((f) =>
        (readFileSync(f, "utf8").match(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']\/[^"']*["']/g) ?? []).map(
          (s) => `${path.basename(f)}: ${s}`,
        ),
      );
    expect(absolute).toEqual([]);
  });
});

describe("pack inputs", () => {
  const manifest = PackManifestSchema.parse({
    schemaVersion: 1,
    id: "test-pack",
    name: "Test",
    description: "A test pack",
    formats: ["9:16"],
    durationSec: { min: 5, typical: 10, max: 15 },
    engine: { kind: "page", size: { width: 1080, height: 1920 } },
    inputs: [
      { key: "title", type: "string", label: "Başlık", default: "MERHABA", maxLength: 8 },
      { key: "mood", type: "enum", label: "Ton", default: "warm", options: ["warm", "cold"] },
      { key: "items", type: "list", label: "Liste", default: ["a"], maxItems: 2, maxLength: 4 },
      { key: "count", type: "number", label: "Sayı", default: 3, min: 1, max: 5 },
      { key: "name", type: "string", label: "İsim", default: "", required: true },
      { key: "line", type: "text", label: "Satır", default: "Selam" },
    ],
    beats: [{ atSec: 1, label: "intro", say: "line" }],
  });

  it("fills defaults and keeps what fits", () => {
    const { values, problems } = resolvePackInputs(manifest, { title: "ŞİŞLİ", name: "Ayşe" });
    expect(problems).toEqual([]);
    expect(values).toMatchObject({ title: "ŞİŞLİ", mood: "warm", items: ["a"], count: 3, name: "Ayşe", line: "Selam" });
  });

  it("reports what doesn't fit and falls back to the default", () => {
    const { values, problems } = resolvePackInputs(manifest, {
      title: "ÇOK UZUN BAŞLIK",
      mood: "hot",
      items: ["a", "b", "c"],
      count: 9,
      typo: 1,
    });
    expect(problems.map((p) => p.key).sort()).toEqual(["count", "items", "mood", "name", "title", "typo"]);
    expect(values.title).toBe("MERHABA");
  });

  it("refuses beats that speak an input that doesn't exist", () => {
    const raw = { ...manifest, beats: [{ atSec: 0, label: "x", say: "nope" }] };
    expect(PackManifestSchema.safeParse(raw).success).toBe(false);
  });

  it("puts inputs in the film URL, Turkish letters intact", () => {
    const url = filmUrl("/packs/x/film/index.html", { title: "İğdır", skip: undefined });
    expect(url.startsWith("/packs/x/film/index.html?inputs=")).toBe(true);
    expect(JSON.parse(decodeURIComponent(url.split("inputs=")[1]))).toEqual({ title: "İğdır" });
    expect(filmUrl("/f.html", {})).toBe("/f.html");
  });
});

describe("page film source", () => {
  const resolve = (src: string) => `http://media${src}`;
  const base = { pack: "", inputs: "", src: "" };

  it("plays a pack's film from the media base, with its inputs", () => {
    const s = filmSource({ ...base, pack: "art-deco", inputs: '{"title":"GALA"}' }, resolve);
    expect(s.ok && s.href).toBe(`http://media/packs/art-deco/film/index.html?inputs=${encodeURIComponent('{"title":"GALA"}')}`);
  });

  it("refuses ids that could leave the packs folder and inputs that aren't an object", () => {
    expect(filmSource({ ...base, pack: "../secrets" }, resolve).ok).toBe(false);
    expect(filmSource({ ...base, pack: "art-deco", inputs: "[1,2]" }, resolve).ok).toBe(false);
    expect(filmSource({ ...base, pack: "art-deco", inputs: "{oops" }, resolve).ok).toBe(false);
    expect(filmSource({ ...base, src: "javascript:alert(1)" }, resolve).ok).toBe(false);
  });

  it("prefers an explicit film URL over the pack", () => {
    const s = filmSource({ ...base, pack: "art-deco", src: "/packs/_selftest/film/index.html" }, resolve);
    expect(s.ok && s.href).toBe("http://media/packs/_selftest/film/index.html");
  });
});
