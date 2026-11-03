import { isEditTool } from "@/agent/edits";
import { TOOL_SCHEMAS } from "@/agent/tool-schemas";
import { getSkill, listSkills } from "@/server/skills";
import type { Command } from "../command";
import { resolveProject, saveProject } from "../context";
import { CliError, notFound, usage } from "../errors";
import { callLive, isOpenInEditor } from "../live";
import { readJsonArg } from "../ops";
import { applyOps } from "./basic";

/** Editor tools with a headless command of their own. */
const CLI_EQUIVALENT: Record<string, string> = {
  get_project: "reframer show <project>",
  list_components: "reframer components",
  list_styles: "reframer styles",
  get_style: "reframer styles --id <style>",
  review_frames: "reframer still <project> --every 1 --sheet",
  critique_video: "reframer check <project> --brief …",
  import_media: "reframer import <project> <file | url>",
  load_skill: "reframer playbook <name>",
  undo: "reframer undo <project>",
};

export const toolCommand: Command = {
  name: "tool",
  summary: "Call any agent tool by name (the MCP tool set): live in the editor when the project is open, headless for edits otherwise",
  usage: "reframer tool <project> <tool> [input.json | - | '{...}']",
  flags: {
    headless: { type: "boolean", description: "Edit the file even when the project is open in an editor" },
  },
  examples: [
    `reframer tool proj_x transcribe '{"assetId":"asset_ab12"}'`,
    `reframer tool proj_x set_transition '{"clipId":"clip_x","type":"whip","durationSec":0.3}'`,
  ],
  run: async (ctx, { positionals, flags }) => {
    const project = await resolveProject(positionals[0]);
    const name = positionals[1];
    if (!name) throw usage("Name the tool to call", `Tools: ${Object.keys(TOOL_SCHEMAS).join(", ")}`);
    if (!(name in TOOL_SCHEMAS))
      throw new CliError("E_USAGE", `Unknown tool "${name}"`, undefined, `Tools: ${Object.keys(TOOL_SCHEMAS).join(", ")}`);
    const input = positionals[2] ? await readJsonArg(ctx, positionals[2], "input") : {};
    const live = flags.headless ? null : await isOpenInEditor(project.id);
    if (live) {
      ctx.log(`Calling ${name} in the editor at ${live.origin}…`);
      return { projectId: project.id, mode: "live", tool: name, result: await callLive(live, project.id, name, input) };
    }
    if (isEditTool(name)) {
      const parsed = TOOL_SCHEMAS[name].input.safeParse(input);
      if (!parsed.success)
        throw new CliError(
          "E_INVALID",
          `Invalid input for ${name}`,
          { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
          `See the fields with \`reframer schema ${name}\`.`,
        );
      const { project: next, results } = applyOps(project, [{ op: name, input: parsed.data }]);
      await saveProject(project, next, name);
      return { projectId: project.id, mode: "headless", tool: name, result: results[0]?.result, undo: `reframer undo ${project.id}` };
    }
    const instead = CLI_EQUIVALENT[name];
    throw new CliError(
      "E_CONFLICT",
      `${name} runs inside the editor (it needs the project open in Reframer)`,
      undefined,
      instead ? `Headless, use: ${instead}` : "Open the project in Reframer and call it again: it will run live there.",
    );
  },
};

export const playbookCommand: Command = {
  name: "playbook",
  summary: "The editor agent's expert playbooks (launch video, shorts captions, footage polish, sound design…): list them or read one",
  usage: "reframer playbook [name]",
  flags: {},
  examples: ["reframer playbook", "reframer playbook shorts-captions"],
  run: async (_ctx, { positionals }) => {
    if (!positionals[0]) {
      const skills = await listSkills();
      return { playbooks: skills.map((s) => ({ name: s.name, description: s.description, source: s.source })) };
    }
    const skill = await getSkill(positionals[0]);
    if (!skill) throw notFound(`No playbook named "${positionals[0]}"`, `Playbooks: ${(await listSkills()).map((s) => s.name).join(", ")}`);
    return { name: skill.name, description: skill.description, playbook: skill.body };
  },
};
