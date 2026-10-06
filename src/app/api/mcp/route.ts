import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { TOOL_SCHEMAS } from "@/agent/tool-schemas";
import { callTool, reviewToContent } from "@/server/agent/tools";
import { type AgentIdentity, bridge } from "@/server/bridge";
import { resolveMcpToken } from "@/server/mcp-sessions";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

const INSTRUCTIONS = `Reframer is an AI-native video editor running on this machine. These tools edit the project open in the Reframer window; the user watches every change live and can edit alongside you.
- Call get_project first (times are seconds, x/y are box centers in px). Re-read after the user edits.
- For multi-step work call set_plan, then update_plan as you go.
- Prefer built-in components (list_components); use create_component only when none fits, exposing tweakable props.
- Respect locked clips and clips marked humanEdited (ask the user first).
- Match named styles with apply_style (list_styles / get_style). Load playbooks with load_skill (launch-video, apple-keynote, shorts-captions, footage-polish, motion-taste, self-review, ...).
- Check your work with review_frames before saying you're done.`;

type Extra = { projectId?: string; agent: AgentIdentity };

const handler = createMcpHandler(
  (server) => {
    for (const [name, def] of Object.entries(TOOL_SCHEMAS)) {
      server.registerTool(
        name,
        { title: name.replace(/_/g, " "), description: def.description, inputSchema: def.input },
        async (input: unknown, ctx: { http?: { authInfo?: { extra?: Record<string, unknown> } } }) => {
          const extra = (ctx.http?.authInfo?.extra ?? {}) as unknown as Extra;
          const agent: AgentIdentity = extra.agent ?? { name: "External agent", kind: "agent" };
          try {
            const result = await callTool(name, input, { projectId: extra.projectId, agent });
            if (name === "review_frames") {
              const { text, images } = reviewToContent(result);
              return {
                content: [
                  { type: "text" as const, text },
                  ...images.map((img) => ({ type: "image" as const, data: img.data, mimeType: img.mediaType })),
                ],
              };
            }
            return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { ok: true }) }] };
          } catch (err) {
            return {
              content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
              isError: true,
            };
          }
        },
      );
    }
    server.registerTool(
      "list_open_projects",
      {
        title: "list open projects",
        description: "Projects currently open in Reframer windows (tools act on the most recently focused one).",
        inputSchema: TOOL_SCHEMAS.get_errors.input,
      },
      async () => ({ content: [{ type: "text" as const, text: JSON.stringify(bridge.openProjects()) }] }),
    );
  },
  { serverInfo: { name: "reframer", version: "0.1.0" }, instructions: INSTRUCTIONS },
);

const authed = withMcpAuth(
  handler,
  async (req, token) => {
    const clientName = req.headers.get("x-mcp-client-name") ?? req.headers.get("user-agent")?.split("/")[0] ?? undefined;
    const session = await resolveMcpToken(token ?? null, clientName ?? undefined);
    if (!session || !token) return undefined;
    return {
      token,
      clientId: session.agent.name,
      scopes: [],
      extra: { projectId: session.projectId, agent: session.agent },
    };
  },
  { required: true },
);

export { authed as DELETE, authed as GET, authed as POST };
