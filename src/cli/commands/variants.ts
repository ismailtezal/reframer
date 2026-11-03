import path from "node:path";
import { z } from "zod";
import { newId } from "@/core/ids";
import type { Clip, Project } from "@/core/schema";
import { getMotionComponent } from "@/remotion/components/registry";
import { RENDERS_DIR } from "@/server/paths";
import { writeProject } from "@/server/projects";
import type { Command } from "../command";
import { resolveProject } from "../context";
import { invalid, notFound, usage } from "../errors";
import { normalizeOps, readJsonArg, validateOps } from "../ops";
import { applyOps } from "./basic";
import { runChecks } from "./check";
import { RENDER_FLAGS, renderProject } from "./render";

/**
 * One video, many openings: each variant swaps the hook (the words on screen in the first seconds) and
 * may apply its own edit ops, for A/B tests such as Instagram trial reels. Variants live in memory
 * unless saved, and can be checked and rendered in the same run.
 */

const MAX_VARIANTS = 50;

const VariantSpec = z.union([
  z.string().min(1),
  z
    .object({
      name: z.string().optional(),
      text: z.string().optional(),
      target: z.string().optional(),
      ops: z.array(z.unknown()).optional(),
    })
    .refine((v) => v.text !== undefined || (v.ops?.length ?? 0) > 0, "A variant needs text or ops"),
]);
const HooksFile = z.union([z.array(VariantSpec), z.object({ target: z.string().optional(), variants: z.array(VariantSpec) })]);

/** Props that carry a component's main words, most likely first. */
const MAIN_TEXT_PROPS = ["text", "title", "headline", "quote", "message", "label", "subtitle"];

/** The prop that holds a component clip's main words, if it has one. */
const textPropOf = (project: Project, clip: Clip): string | undefined => {
  if (clip.type !== "component") return undefined;
  const isCode = clip.component.startsWith("code:");
  const schema = (isCode ? project.components?.[clip.component.slice(5)]?.propsSchema : getMotionComponent(clip.component)?.schema) as
    | Record<string, { type: string; default?: unknown }>
    | undefined;
  if (!schema) return undefined;
  const textual = Object.entries(schema).filter(([, f]) => f.type === "text" || f.type === "string");
  const shown = textual.filter(([k, f]) => typeof (clip.props[k] ?? f.default) === "string" && String(clip.props[k] ?? f.default).trim());
  return shown.sort(([a], [b]) => rank(a) - rank(b))[0]?.[0];
};
const rank = (key: string) => {
  const i = MAIN_TEXT_PROPS.indexOf(key);
  return i < 0 ? MAIN_TEXT_PROPS.length : i;
};

/** The hook: a clip named "hook", else the earliest words on screen in the first 3 seconds (top layer first). */
export const findHook = (project: Project, explicit?: string): Clip | undefined => {
  if (explicit) {
    const clip = project.clips[explicit];
    if (!clip) throw notFound(`Clip "${explicit}" isn't in ${project.name}`);
    return clip;
  }
  const fps = project.settings.fps;
  const layer = new Map(project.tracks.map((t, i) => [t.id, i]));
  const words = Object.values(project.clips).filter(
    (c) => !c.hidden && c.start < fps * 3 && (c.type === "text" || textPropOf(project, c) !== undefined),
  );
  const named = (c: Clip) => Number(/hook/i.test(c.name ?? ""));
  return words.sort((a, b) => named(b) - named(a) || a.start - b.start || (layer.get(a.trackId) ?? 0) - (layer.get(b.trackId) ?? 0))[0];
};

/** The ops that put `text` into the hook clip. */
const hookOps = (project: Project, clip: Clip, text: string) => {
  if (clip.type === "text") return [{ op: "update_clips", input: { updates: [{ id: clip.id, patch: { text } }] } }];
  const key = textPropOf(project, clip);
  if (!key)
    throw invalid(
      `The hook clip ${clip.id} (${clip.type}) has no text to replace`,
      undefined,
      "Pass --target with a text clip, or give the variant ops.",
    );
  return [{ op: "update_clips", input: { updates: [{ id: clip.id, patch: { props: { [key]: text } } }] } }];
};

const slug = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "variant";

type Planned = { index: number; name: string; hook?: string; hookClipId?: string; project: Project; ops: number };

export const planVariants = (base: Project, raw: unknown, explicitTarget?: string): Planned[] => {
  const parsed = HooksFile.safeParse(raw);
  if (!parsed.success)
    throw invalid(
      "The hooks file isn't a list of variants",
      { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      'Use ["hook one", "hook two"] or [{ "name": "stat", "text": "…", "ops": [...] }].',
    );
  const list = Array.isArray(parsed.data) ? parsed.data : parsed.data.variants;
  const fileTarget = Array.isArray(parsed.data) ? undefined : parsed.data.target;
  if (!list.length) throw usage("The hooks file lists no variants");
  if (list.length > MAX_VARIANTS) throw usage(`${list.length} variants is too many; make at most ${MAX_VARIANTS} per run`);
  const problems: { variant: number; message: string }[] = [];
  const planned: Planned[] = [];
  for (const [i, v] of list.entries()) {
    const spec = typeof v === "string" ? { text: v } : v;
    try {
      const ops = [] as { op: string; input: unknown }[];
      let hookClipId: string | undefined;
      if (spec.text !== undefined) {
        const clip = findHook(base, spec.target ?? explicitTarget ?? fileTarget);
        if (!clip)
          throw invalid(
            "No words on screen in the first 3 seconds to swap",
            undefined,
            "Name the hook clip (--target <clipId>), or give each variant ops.",
          );
        ops.push(...hookOps(base, clip, spec.text));
        hookClipId = clip.id;
      }
      if (spec.ops) ops.push(...validateOps(normalizeOps(spec.ops)));
      const { project } = applyOps(base, ops);
      const name = spec.name ?? spec.text ?? `variant ${i + 1}`;
      planned.push({
        index: i + 1,
        name,
        ...(spec.text !== undefined ? { hook: spec.text, hookClipId } : {}),
        project: {
          ...project,
          id: newId("proj"),
          name: `${base.name} · ${name}`.slice(0, 120),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        ops: ops.length,
      });
    } catch (err) {
      problems.push({ variant: i + 1, message: err instanceof Error ? err.message : String(err) });
    }
  }
  if (problems.length) throw invalid(`${problems.length} of ${list.length} variants can't be made`, { problems });
  return planned;
};

export const variantsCommand: Command = {
  name: "variants",
  summary: "Make hook variants of one video (A/B tests, trial reels): swap the opening words, apply per-variant ops, check and render each",
  usage: "reframer variants <project> --hooks hooks.json [--target <clipId>] [--check] [--render --out dir] [--save]",
  flags: {
    hooks: { type: "string", description: 'Variants: a file, - for stdin, or inline JSON: ["hook 1", …] or [{ "name", "text", "ops" }]' },
    target: {
      type: "string",
      description: "The clip whose words are the hook (default: a clip named hook, else the first words on screen)",
    },
    check: { type: "boolean", description: "Check every variant (timeline and frames of the first seconds)" },
    render: { type: "boolean", description: "Render every variant to --out" },
    save: { type: "boolean", description: "Also save each variant as a project (they share the base project's media)" },
    "check-seconds": {
      type: "number",
      description: "With --check: how many opening seconds to measure frame by frame (default 4; 0 = whole video)",
    },
    ...RENDER_FLAGS,
    out: { type: "string", alias: "o", description: "Folder for the rendered variants (default: the project's renders/variants folder)" },
  },
  examples: [
    `reframer variants proj_x --hooks '["Bunu kimse söylemiyor", "3 saniyede öğren"]' --check`,
    "reframer variants proj_x --hooks hooks.json --render --out ./reels --priority low",
  ],
  run: async (ctx, { positionals, flags }) => {
    const base = await resolveProject(positionals[0]);
    if (!flags.hooks) throw usage("Give the variants with --hooks <file | - | json>");
    const variants = planVariants(base, await readJsonArg(ctx, String(flags.hooks), "hooks"), flags.target as string | undefined);
    ctx.log(`${variants.length} variant${variants.length > 1 ? "s" : ""} of ${base.name}.`);
    const outDir = flags.out ? ctx.resolvePath(String(flags.out)) : path.join(RENDERS_DIR, base.id, "variants");
    const results: Record<string, unknown>[] = [];
    for (const v of variants) {
      const row: Record<string, unknown> = { index: v.index, name: v.name, ...(v.hook !== undefined ? { hook: v.hook } : {}), ops: v.ops };
      if (flags.save) {
        await writeProject(v.project);
        row.projectId = v.project.id;
      }
      if (flags.check) {
        // What differs between variants is the opening: its words on screen, measured frame by frame.
        // (The rest is shared: check the base project once.)
        const seconds = (flags.checkSeconds as number | undefined) ?? 4;
        const checked = await runChecks(ctx, seconds > 0 ? opening(v.project, seconds) : v.project);
        const own = checked.findings.filter(
          (f) => f.check.startsWith("layout.") || f.check.startsWith("text.") || (v.hookClipId !== undefined && f.clipId === v.hookClipId),
        );
        row.check = {
          passed: !own.some((f) => f.severity === "error"),
          errors: own.filter((f) => f.severity === "error").length,
          findings: own,
        };
      }
      if (flags.render) {
        ctx.log(`Rendering ${v.index}/${variants.length}: ${v.name}`);
        const file = path.join(outDir, `${String(v.index).padStart(2, "0")}-${slug(v.name)}.${String(flags.format ?? "mp4")}`);
        const rendered = await renderProject(ctx, v.project, { ...flags, out: file });
        row.path = rendered.path;
        row.sizeBytes = rendered.sizeBytes;
      }
      results.push(row);
    }
    return {
      projectId: base.id,
      variants: results,
      ...(flags.check ? { allPassed: results.every((r) => (r.check as { passed: boolean }).passed) } : {}),
      ...(flags.render ? { outDir } : {}),
    };
  },
};

/** The first seconds of a project (the hook is what differs between variants; the rest is shared). */
const opening = (project: Project, seconds: number): Project => ({
  ...project,
  settings: { ...project.settings, durationInFrames: Math.max(1, Math.round(seconds * project.settings.fps)) },
});
