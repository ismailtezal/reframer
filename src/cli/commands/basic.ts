import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { produce } from "immer";
import { z } from "zod";
import { EDIT_TOOL_NAMES, isEditTool, runEdit } from "@/agent/edits";
import { summarizeProject } from "@/agent/summary";
import { TOOL_SCHEMAS } from "@/agent/tool-schemas";
import { ASPECT_PRESETS, type AspectPresetId, createProject } from "@/core/defaults";
import { EditError } from "@/core/ops";
import type { Project } from "@/core/schema";
import { getStylePreset, styleCatalog } from "@/core/styles";
import { MOTION_COMPONENTS } from "@/remotion/components/registry";
import { hasFfmpeg } from "@/server/ffmpeg";
import { PROJECTS_DIR } from "@/server/paths";
import { listProjects, writeProject } from "@/server/projects";
import type { Command } from "../command";
import { latestHistory, resolveProject } from "../context";
import { CliError, invalid, notFound, usage } from "../errors";
import { CLI_ACTOR, CLI_META } from "../identity";

const r2 = (n: number) => Math.round(n * 100) / 100;

export const projectsCommand: Command = {
  name: "projects",
  summary: "List projects, newest first",
  usage: "reframer projects [--limit <n>]",
  flags: { limit: { type: "number", description: "At most this many (default all)" } },
  run: async (_ctx, { flags }) => {
    const all = await listProjects();
    const limit = typeof flags.limit === "number" ? flags.limit : all.length;
    return {
      projects: all.slice(0, limit).map(({ thumbnail: _t, ...p }) => p),
      total: all.length,
    };
  },
};

export const showCommand: Command = {
  name: "show",
  summary: "Describe a project the way agents read it: canvas, tracks, clips (times in seconds), assets",
  usage: "reframer show <project> [--range <fromSec,toSec>] [--transcripts] [--raw]",
  flags: {
    range: { type: "list", description: "Only clips overlapping this range, in seconds: 10,20" },
    transcripts: { type: "boolean", description: "Include transcript text of assets" },
    raw: { type: "boolean", description: "The full project.json instead of the summary" },
  },
  run: async (_ctx, { positionals, flags }) => {
    const project = await resolveProject(positionals[0]);
    if (flags.raw) return { project };
    const range = flags.range as string[] | undefined;
    if (range && (range.length !== 2 || range.some((v) => !Number.isFinite(Number(v)))))
      throw usage("--range needs two numbers: --range 10,20");
    return {
      project: summarizeProject(project, {
        rangeSec: range ? [Number(range[0]), Number(range[1])] : undefined,
        includeTranscripts: Boolean(flags.transcripts),
      }),
    };
  },
};

export const newCommand: Command = {
  name: "new",
  summary: "Create a project (optionally in a style) and return its id",
  usage: "reframer new [--name <name>] [--format 9:16|16:9|1:1|4:5] [--fps 30] [--style <id>] [--brief <text>]",
  flags: {
    name: { type: "string", description: 'Project name (default "Untitled video")' },
    format: { type: "string", description: `Aspect preset: ${Object.keys(ASPECT_PRESETS).join(", ")} (default 16:9)` },
    width: { type: "number", description: "Canvas width in px (overrides --format)" },
    height: { type: "number", description: "Canvas height in px (overrides --format)" },
    fps: { type: "number", description: "Frames per second (default 30)" },
    background: { type: "string", description: "Canvas background color, e.g. #0b0b0f" },
    style: { type: "string", description: "A style preset id (see `reframer styles`)" },
    brief: { type: "string", description: "What the video is for; stored as the project brief for agents" },
  },
  examples: ["reframer new --name 'Daily recap' --format 9:16 --style apple-keynote"],
  run: async (ctx, { flags }) => {
    const format = flags.format as string | undefined;
    if (format && !(format in ASPECT_PRESETS))
      throw usage(`Unknown --format "${format}"`, `Use one of ${Object.keys(ASPECT_PRESETS).join(", ")}, or --width/--height.`);
    const preset = format ? ASPECT_PRESETS[format as AspectPresetId] : undefined;
    const width = (flags.width as number | undefined) ?? preset?.width;
    const height = (flags.height as number | undefined) ?? preset?.height;
    for (const [name, v] of [
      ["width", width],
      ["height", height],
    ] as const)
      if (v !== undefined && (!Number.isInteger(v) || v < 16 || v > 7680)) throw usage(`--${name} must be a whole number from 16 to 7680`);
    const fps = flags.fps as number | undefined;
    if (fps !== undefined && (!(fps >= 1) || fps > 120)) throw usage("--fps must be from 1 to 120");
    const styleId = flags.style as string | undefined;
    if (styleId && !getStylePreset(styleId)) throw notFound(`Unknown style "${styleId}"`, "List them with `reframer styles`.");
    let project: Project = createProject({
      name: flags.name as string | undefined,
      width,
      height,
      fps,
      backgroundColor: flags.background as string | undefined,
    });
    if (flags.brief) project.brief = { prompt: String(flags.brief) };
    let style: unknown;
    if (styleId) {
      project = produce(project, (d) => {
        style = runEdit(d, "apply_style", { styleId }, { actor: CLI_ACTOR, meta: CLI_META });
      });
    }
    await writeProject(project);
    ctx.log(`Created ${project.name} (${project.id})`);
    return {
      projectId: project.id,
      name: project.name,
      settings: project.settings,
      ...(styleId ? { style: { id: styleId, result: style } } : {}),
      path: path.join(PROJECTS_DIR, project.id, "project.json"),
    };
  },
};

export const componentsCommand: Command = {
  name: "components",
  summary: "The motion component catalog with full prop schemas (and a project's own code components)",
  usage: "reframer components [--category <c>] [--project <project>] [--id <id>]",
  flags: {
    category: { type: "string", description: "Only this category (text, background, data, device, social, annotation, brand, overlay)" },
    project: { type: "string", description: "Also list this project's code components" },
    id: { type: "string", description: "Just this component" },
    json: { type: "boolean", description: "Accepted for compatibility (output is always JSON)" },
  },
  run: async (_ctx, { flags }) => {
    const builtIn = MOTION_COMPONENTS.filter((c) => !flags.category || c.category === flags.category)
      .filter((c) => !flags.id || c.id === flags.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        description: c.description,
        defaultDurationSec: c.defaultDuration,
        ...(c.defaultBox ? { defaultBox: c.defaultBox } : {}),
        ...(c.tags?.length ? { tags: c.tags } : {}),
        props: c.schema,
      }));
    const project = flags.project ? await resolveProject(String(flags.project)) : null;
    const code = project
      ? Object.values(project.components).map((c) => ({
          id: `code:${c.id}`,
          name: c.name,
          category: "custom",
          description: c.description ?? c.name,
          props: c.propsSchema,
        }))
      : [];
    if (flags.id && builtIn.length + code.length === 0) throw notFound(`No component "${flags.id}"`);
    return {
      components: [...builtIn, ...code],
      usage:
        'Place one with an add_clips op: { "type": "component", "component": "<id>", "props": { … }, "startSec": 0, "durationSec": 4 }',
    };
  },
};

export const stylesCommand: Command = {
  name: "styles",
  summary: "Style presets (creators, brands, genres) for `new --style` and apply_style",
  usage: "reframer styles [--id <id>]",
  flags: { id: { type: "string", description: "The full style definition of one preset" } },
  run: async (_ctx, { flags }) => {
    if (flags.id) {
      const style = getStylePreset(String(flags.id));
      if (!style) throw notFound(`Unknown style "${flags.id}"`);
      return { style };
    }
    return { styles: styleCatalog() };
  },
};

/** The ops an `apply` file may contain, with their JSON Schemas. */
export const schemaCommand: Command = {
  name: "schema",
  summary: "JSON Schemas of the edit ops `apply` accepts (all, or one), and of any agent tool `tool` calls",
  usage: "reframer schema [<op | tool>]",
  flags: {},
  run: async (_ctx, { positionals }) => {
    const name = positionals[0];
    const describe = (op: keyof typeof TOOL_SCHEMAS) => ({
      op,
      ...(isEditTool(op) ? {} : { editOp: false, call: `reframer tool <project> ${op} '<input json>'` }),
      description: TOOL_SCHEMAS[op].description,
      input: z.toJSONSchema(TOOL_SCHEMAS[op].input, { unrepresentable: "any", io: "input" }),
    });
    if (name) {
      if (!(name in TOOL_SCHEMAS)) throw notFound(`No op or tool "${name}"`, `Ops: ${EDIT_TOOL_NAMES.join(", ")}`);
      return describe(name as keyof typeof TOOL_SCHEMAS);
    }
    return {
      format:
        'An ops file is a JSON array (or { "ops": [...] }) of { "op": "<name>", ...input }. Times are seconds; x/y are box centers in px. All ops are validated first, then applied together: if one fails, nothing is saved.',
      ops: EDIT_TOOL_NAMES.map(describe),
      otherTools: Object.keys(TOOL_SCHEMAS).filter((t) => !isEditTool(t)),
    };
  },
};

export const undoCommand: Command = {
  name: "undo",
  summary: "Restore the project as it was before the last CLI change",
  usage: "reframer undo <project>",
  flags: {},
  run: async (ctx, { positionals }) => {
    const project = await resolveProject(positionals[0]);
    const step = await latestHistory(project.id);
    if (!step) throw new CliError("E_NOT_FOUND", "Nothing to undo: no CLI change recorded for this project.");
    await writeProject({ ...step.project, updatedAt: Date.now() });
    await fs.rm(step.file, { force: true });
    ctx.log(`Restored ${project.name} to before "${step.label}"`);
    return { projectId: project.id, undid: step.label, at: new Date(step.at).toISOString(), stepsLeft: step.remaining };
  },
};

export const doctorCommand: Command = {
  name: "doctor",
  summary: "Check the environment: data folder, projects, FFmpeg, renderer, a running editor",
  usage: "reframer doctor",
  flags: {},
  run: async (ctx) => {
    const projects = existsSync(PROJECTS_DIR) ? (await fs.readdir(PROJECTS_DIR)).length : 0;
    const { editorPresence } = await import("../live");
    const presence = await editorPresence();
    return {
      appRoot: ctx.appRoot,
      dataDir: ctx.dataDir,
      projects,
      node: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      ffmpeg: hasFfmpeg(),
      // Remotion's headless Chrome downloads itself on the first render or still.
      renderBrowser: existsSync(path.join(ctx.appRoot, "node_modules", ".remotion", "chrome-headless-shell"))
        ? "installed"
        : "downloads on first render",
      prebuiltBundle: process.env.REFRAMER_REMOTION_BUNDLE ?? null,
      editor: presence ? { origin: presence.origin, openProjects: presence.open.map((o) => o.projectId) } : null,
    };
  },
};

/** Applies edit ops with the CLI's identity (used by `new --style`, `apply` and `variants`). */
export const applyOps = (project: Project, ops: { op: string; input: unknown }[]) => {
  const results: { op: string; result: unknown }[] = [];
  const next = produce(project, (d) => {
    for (const [i, { op, input }] of ops.entries()) {
      if (!isEditTool(op)) throw invalid(`Op ${i + 1}: "${op}" is not an edit op`);
      let result: unknown;
      try {
        result = runEdit(d, op, input, { actor: CLI_ACTOR, meta: CLI_META });
      } catch (err) {
        // A refused edit (missing clip, occupied range, locked track, unknown component or asset) is
        // the op's fault, not the CLI's; a TypeError and the like stay internal errors.
        if (err instanceof EditError)
          throw invalid(`Op ${i + 1} (${op}) failed: ${err.message}`, { op: i + 1, tool: op, reason: err.code });
        if (err instanceof Error && err.constructor === Error)
          throw invalid(`Op ${i + 1} (${op}) failed: ${err.message}`, { op: i + 1, tool: op });
        throw err;
      }
      const failure = failureOf(result);
      if (failure) throw invalid(`Op ${i + 1} (${op}) failed: ${failure}`, { op: i + 1, tool: op, result });
      results.push({ op, result });
    }
  });
  return { project: next, results, durationSec: r2(durationOf(next)) };
};

/** A recipe result that reports a refused or partly failed edit. */
const failureOf = (result: unknown): string | null => {
  if (!result || typeof result !== "object") return null;
  const r = result as { error?: unknown; ok?: unknown; results?: { ok: boolean; id: string; error?: string }[] };
  if (typeof r.error === "string") return r.error;
  if (r.ok === false) return "the edit was refused";
  const bad = r.results?.find((x) => x.ok === false);
  return bad ? `${bad.id}: ${bad.error ?? "failed"}` : null;
};

const durationOf = (p: Project) => {
  let end = 0;
  for (const c of Object.values(p.clips)) end = Math.max(end, c.start + c.duration);
  return (p.settings.durationInFrames ?? end) / p.settings.fps;
};
