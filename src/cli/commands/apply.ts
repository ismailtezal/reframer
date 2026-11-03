import type { Command } from "../command";
import { resolveProject, saveProject } from "../context";
import { CliError } from "../errors";
import { callLive, isOpenInEditor } from "../live";
import { normalizeOps, readJsonArg, validateOps } from "../ops";
import { applyOps } from "./basic";

export const applyCommand: Command = {
  name: "apply",
  summary: "Validate and apply typed edit ops to a project, all or nothing",
  usage: "reframer apply <project> <ops.json | - | '[{...}]'> [--dry-run] [--headless]",
  flags: {
    "dry-run": { type: "boolean", description: "Validate and simulate the edits; save nothing" },
    headless: {
      type: "boolean",
      description: "Write the file even when the project is open in an editor (normally the edits go live through it)",
    },
  },
  examples: [
    `reframer apply proj_x ops.json`,
    `echo '[{"op":"add_clips","clips":[{"type":"text","text":"Hello","startSec":0,"durationSec":2}]}]' | reframer apply proj_x -`,
  ],
  run: async (ctx, { positionals, flags }) => {
    const project = await resolveProject(positionals[0]);
    const ops = validateOps(normalizeOps(await readJsonArg(ctx, positionals[1], "ops")));
    if (!ops.length) throw new CliError("E_USAGE", "The ops list is empty.");

    // An open editor holds the project in memory and saves over the file: edit it through the editor instead.
    const live = flags.dryRun || flags.headless ? null : await isOpenInEditor(project.id);
    if (live) {
      ctx.log(`${project.name} is open in an editor (${live.origin}): applying live.`);
      const results: { op: string; result: unknown }[] = [];
      for (const [i, { op, input }] of ops.entries()) {
        try {
          results.push({ op, result: await callLive(live, project.id, op, input) });
        } catch (err) {
          throw new CliError(
            "E_INVALID",
            `Op ${i + 1} (${op}) failed in the editor: ${err instanceof Error ? err.message : err}`,
            { applied: results },
            results.length ? "The earlier ops were applied; undo them in the editor if needed." : undefined,
          );
        }
      }
      return { projectId: project.id, mode: "live", applied: results.length, results };
    }

    const { project: next, results, durationSec } = applyOps(project, ops);
    if (flags.dryRun) return { projectId: project.id, mode: "dry-run", applied: 0, wouldApply: results.length, results, durationSec };
    const label = `${ops.length === 1 ? ops[0].op : `${ops.length} ops`}`;
    await saveProject(project, next, label);
    ctx.log(`Applied ${results.length} op${results.length > 1 ? "s" : ""} to ${project.name}.`);
    return { projectId: project.id, mode: "headless", applied: results.length, results, durationSec, undo: `reframer undo ${project.id}` };
  },
};
