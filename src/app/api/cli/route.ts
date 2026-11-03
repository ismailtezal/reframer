import { callTool } from "@/server/agent/tools";
import { EditorNotConnectedError } from "@/server/bridge";
import { resolveMcpToken } from "@/server/mcp-sessions";

export const maxDuration = 3600;

type Body = { projectId?: string; tool?: string; input?: unknown; agent?: string };

/**
 * The `reframer` CLI's live path: one agent tool call on a project open in an editor window, so the
 * edit happens in front of the user and lands in that editor's undo history. Same token as MCP.
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!(await resolveMcpToken(token))) return Response.json({ error: "Not authorized: use the MCP token from Settings." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.projectId || !body.tool) return Response.json({ error: "projectId and tool are required" }, { status: 400 });
  try {
    const result = await callTool(body.tool, body.input ?? {}, {
      projectId: body.projectId,
      agent: { name: body.agent?.trim().slice(0, 60) || "Reframer CLI", kind: "agent", external: true },
    });
    const refused = result && typeof result === "object" && "error" in result && typeof result.error === "string";
    return refused ? Response.json({ error: result.error, result }, { status: 422 }) : Response.json({ result: result ?? { ok: true } });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: err instanceof EditorNotConnectedError ? 409 : 500 },
    );
  }
}
