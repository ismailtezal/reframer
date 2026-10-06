import "server-only";
import { randomBytes } from "node:crypto";
import type { AgentIdentity } from "./bridge";
import { readSettings } from "./settings";

/**
 * Bearer tokens for the MCP endpoint. Hosted harness sessions (e.g. Codex
 * started by Reframer) get a short-lived token bound to one project; external
 * agents use the long-lived token from Settings → Connect agent.
 */

export type McpSession = { token: string; projectId?: string; agent: AgentIdentity; createdAt: number };

const g = globalThis as unknown as { __reframerMcpSessions?: Map<string, McpSession> };
const sessions: Map<string, McpSession> = g.__reframerMcpSessions ?? new Map();
g.__reframerMcpSessions = sessions;

export const createMcpSession = (projectId: string | undefined, agent: AgentIdentity): string => {
  const token = `rfs_${randomBytes(24).toString("base64url")}`;
  sessions.set(token, { token, projectId, agent, createdAt: Date.now() });
  return token;
};

export const endMcpSession = (token: string) => {
  sessions.delete(token);
};

/** Resolves a bearer token to a session (hosted) or the external-agent identity. */
export const resolveMcpToken = async (
  token: string | null,
  clientName?: string,
): Promise<{ projectId?: string; agent: AgentIdentity } | null> => {
  if (!token) return null;
  const hosted = sessions.get(token);
  if (hosted) return { projectId: hosted.projectId, agent: hosted.agent };
  const settings = await readSettings();
  if (token === settings.mcpToken) {
    return { agent: { name: clientName || "External agent", kind: "agent", external: true } };
  }
  return null;
};
