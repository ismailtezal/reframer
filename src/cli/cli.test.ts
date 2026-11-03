import { describe, expect, it } from "vitest";
import { runEdit } from "@/agent/edits";
import { createProject } from "@/core/defaults";
import type { Project } from "@/core/schema";
import { parseArgs, parseNumberList } from "./args";
import { applyOps } from "./commands/basic";
import { findHook, planVariants } from "./commands/variants";
import { CliError } from "./errors";
import { CLI_ACTOR, CLI_META } from "./identity";
import { normalizeOps, validateOps } from "./ops";

const reel = (): Project => {
  const p = createProject({ name: "Reel", width: 1080, height: 1920, fps: 30 });
  runEdit(
    p,
    "add_clips",
    {
      clips: [
        { type: "background", fill: "#000000", startSec: 0, durationSec: 6 },
        { type: "text", text: "Subtitle", startSec: 0.5, durationSec: 2 },
        { type: "text", name: "Hook", text: "Bunu kimse söylemiyor", startSec: 1, durationSec: 2 },
      ],
    } as never,
    { actor: CLI_ACTOR, meta: CLI_META },
  );
  return p;
};

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return err instanceof CliError ? err.code : "other";
  }
  return "none";
};

describe("parseArgs", () => {
  const spec = {
    out: { type: "string", alias: "o", description: "" },
    frames: { type: "list", description: "" },
    sheet: { type: "boolean", description: "" },
    "dry-run": { type: "boolean", description: "" },
    scale: { type: "number", description: "" },
  } as const;

  it("reads values, aliases, lists, negations and camelCases names", () => {
    const { positionals, flags } = parseArgs(
      ["proj_x", "-o", "a.mp4", "--frames=0,30", "--frames", "90", "--no-sheet", "--dry-run", "--scale", "0.5"],
      spec,
    );
    expect(positionals).toEqual(["proj_x"]);
    expect(flags).toMatchObject({ out: "a.mp4", frames: ["0", "30", "90"], sheet: false, dryRun: true, scale: 0.5 });
  });

  it("refuses unknown flags and bad numbers as usage errors", () => {
    expect(code(() => parseArgs(["--nope"], spec))).toBe("E_USAGE");
    expect(code(() => parseArgs(["--scale", "big"], spec))).toBe("E_USAGE");
  });

  it("expands ranges", () => {
    expect(parseNumberList("0-90:30,120", "frames")).toEqual([0, 30, 60, 90, 120]);
  });
});

describe("ops", () => {
  it("accepts the op shapes agents write", () => {
    expect(normalizeOps([{ op: "add_markers", markers: [] }]).map((o) => o.op)).toEqual(["add_markers"]);
    expect(normalizeOps({ ops: [{ tool: "delete_clips", input: { ids: ["a"] } }] })[0]).toEqual({
      op: "delete_clips",
      input: { ids: ["a"] },
    });
  });

  it("validates every op before anything runs and names each problem", () => {
    let err: unknown;
    try {
      validateOps(normalizeOps([{ op: "add_markers", markers: "nope" }, { op: "teleport" }]));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    const problems = ((err as CliError).details as { problems: unknown[] }).problems;
    expect(problems).toHaveLength(2);
  });

  it("applies all or nothing", () => {
    const p = reel();
    const before = Object.keys(p.clips).length;
    const ops = normalizeOps([
      { op: "add_clips", clips: [{ type: "text", text: "New", startSec: 3, durationSec: 1 }] },
      { op: "delete_clips", ids: ["clip_missing"] },
    ]);
    expect(code(() => applyOps(p, ops))).toBe("E_INVALID");
    expect(Object.keys(p.clips)).toHaveLength(before);
  });

  it("reports an unknown component as the op's fault", () => {
    const ops = normalizeOps([{ op: "add_clips", clips: [{ type: "component", component: "warp-drive", startSec: 0, durationSec: 1 }] }]);
    expect(code(() => applyOps(reel(), ops))).toBe("E_INVALID");
  });
});

describe("variants", () => {
  it("finds the clip named hook first", () => {
    const p = reel();
    expect(findHook(p)?.name).toBe("Hook");
  });

  it("makes one project per hook, each with its own words, leaving the base alone", () => {
    const base = reel();
    const variants = planVariants(base, ["Birinci", { name: "soru", text: "İkinci mi?" }]);
    expect(variants.map((v) => v.name)).toEqual(["Birinci", "soru"]);
    const hookId = findHook(base)?.id as string;
    expect(variants.map((v) => (v.project.clips[hookId] as { text: string }).text)).toEqual(["Birinci", "İkinci mi?"]);
    expect((base.clips[hookId] as { text: string }).text).toBe("Bunu kimse söylemiyor");
    expect(new Set(variants.map((v) => v.project.id)).size).toBe(2);
  });

  it("refuses variants that can't be made, before making any", () => {
    expect(code(() => planVariants(reel(), [{ name: "broken", ops: [{ op: "delete_clips", ids: ["clip_missing"] }] }]))).toBe("E_INVALID");
    expect(code(() => planVariants(reel(), { variants: [] }))).toBe("E_USAGE");
  });
});
