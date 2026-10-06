import "server-only";
import { TOOL_SCHEMAS, type ToolName } from "@/agent/tool-schemas";
import { getStylePreset, searchStyles, styleCatalog } from "@/core/styles";
import { type AgentIdentity, bridge } from "../bridge";
import { getSkill, listSkills } from "../skills";

export type ToolContext = { projectId: string | undefined; agent: AgentIdentity };

/** Knowledge tools answered on the server (no editor state needed). */
const SERVER_HANDLERS: Partial<Record<ToolName, (input: Record<string, unknown>) => Promise<unknown>>> = {
  load_skill: async (input) => {
    const skill = await getSkill(String(input.name ?? ""));
    if (!skill) {
      const names = (await listSkills()).map((s) => s.name).join(", ");
      return { error: `No skill named "${input.name}". Available: ${names}` };
    }
    return { name: skill.name, playbook: skill.body };
  },
  list_styles: async (input) => {
    const q = typeof input.query === "string" ? input.query : "";
    return { styles: styleCatalog(q ? searchStyles(q) : undefined) };
  },
  get_style: async (input) => {
    const style = getStylePreset(String(input.styleId ?? ""));
    if (!style) return { error: `Unknown style "${input.styleId}". Use list_styles.` };
    return style;
  },
};

/** Runs a tool: on the server when possible, otherwise in the editor window via the bridge. */
export const callTool = async (name: string, input: unknown, ctx: ToolContext): Promise<unknown> => {
  const tool = name as ToolName;
  if (!(tool in TOOL_SCHEMAS)) throw new Error(`Unknown tool "${name}"`);
  const parsed = TOOL_SCHEMAS[tool].input.safeParse(input ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    return { error: `Invalid input for ${name}: ${issues.join("; ")}` };
  }
  const server = SERVER_HANDLERS[tool];
  if (server) return server(parsed.data as Record<string, unknown>);
  return bridge.call(ctx.projectId, tool, parsed.data, ctx.agent);
};

type ReviewOutput = { frames?: { timeSec: number; dataUrl: string }[]; lint?: unknown; summary?: string };

/** Splits review_frames output into text + inline images for vision models. */
export const reviewToContent = (output: unknown) => {
  const o = (output ?? {}) as ReviewOutput;
  const text = JSON.stringify({ summary: o.summary, lint: o.lint, frames: o.frames?.map((f) => f.timeSec) });
  const images = (o.frames ?? [])
    .map((f) => {
      const m = f.dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      return m ? { mediaType: m[1], data: m[2], timeSec: f.timeSec } : null;
    })
    .filter((x): x is { mediaType: string; data: string; timeSec: number } => !!x);
  return { text, images };
};
