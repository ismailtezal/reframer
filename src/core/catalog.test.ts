import { describe, expect, it } from "vitest";
import { TOOL_SCHEMAS } from "@/agent/tool-schemas";
import { MOTION_COMPONENTS } from "@/remotion/components/registry";
import { makeProject, text } from "@/test/fixtures";
import { insertClip } from "./ops";
import { getSfx, SFX_LIBRARY } from "./sfx";
import { applyStyleDNA, STYLE_PRESETS, StyleDNASchema } from "./styles";

/** Catalog regression tests: contributors add presets, components and sounds as data, so validate the data. */

describe("style presets", () => {
  it.each(STYLE_PRESETS.map((s) => [s.id, s] as const))("%s matches the Style DNA schema", (_id, style) => {
    const result = StyleDNASchema.safeParse(style);
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues.slice(0, 3))).toBe(true);
  });

  it("ids are unique", () => {
    const ids = STYLE_PRESETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only reference sounds that exist", () => {
    const missing = STYLE_PRESETS.flatMap((s) => s.sound.sfx.filter((id) => !getSfx(id)).map((id) => `${s.id}: ${id}`));
    expect(missing).toEqual([]);
  });

  it("applying a style restyles text", () => {
    const p = makeProject();
    const id = insertClip(p, text(p, "Overlay", 0, 60));
    const mrbeast = STYLE_PRESETS.find((s) => s.id === "mrbeast");
    if (!mrbeast) throw new Error("mrbeast preset missing");
    applyStyleDNA(p, mrbeast, { parts: ["typography"] });
    const clip = p.clips[id];
    expect(clip.type === "text" && clip.style.fontFamily).toBe(mrbeast.typography.title.fontFamily);
  });
});

describe("sound effects", () => {
  it("have unique ids, real files and descriptions", () => {
    const ids = SFX_LIBRARY.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SFX_LIBRARY) {
      expect(s.src).toBe(`/sfx/${s.id}.wav`);
      expect(s.durationSec).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(20);
    }
  });
});

describe("motion components", () => {
  it("have unique kebab-case ids and complete metadata", () => {
    const ids = MOTION_COMPONENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of MOTION_COMPONENTS) {
      expect(c.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(20);
      expect(c.defaultDuration).toBeGreaterThan(0);
    }
  });

  it("never use prop names the clip box overwrites", () => {
    for (const c of MOTION_COMPONENTS) {
      for (const reserved of ["width", "height", "durationInFrames"]) expect(Object.keys(c.schema)).not.toContain(reserved);
    }
  });

  it("schema defaults match their declared types", () => {
    for (const c of MOTION_COMPONENTS) {
      for (const [key, field] of Object.entries(c.schema)) {
        const label = `${c.id}.${key}`;
        if (field.type === "number") expect(typeof field.default, label).toBe("number");
        if (field.type === "boolean") expect(typeof field.default, label).toBe("boolean");
        if (field.type === "enum") expect(field.options, label).toContain(field.default);
      }
    }
  });
});

describe("agent tools", () => {
  it("every tool explains itself and has an input schema", () => {
    for (const [name, def] of Object.entries(TOOL_SCHEMAS)) {
      expect(name).toMatch(/^[a-z_]+$/);
      expect(def.description.length, name).toBeGreaterThan(20);
      expect(typeof def.input.safeParse, name).toBe("function");
    }
  });
});
