import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "@/server/paths";
import { readSettings } from "@/server/settings";
import { CliError } from "./errors";
import { CLI_NAME } from "./identity";

/**
 * A running Reframer app announces which projects are open in an editor (src/server/editor-presence.ts
 * writes `editors.json` in the data folder). An edit to an open project goes through that editor, live
 * and undoable there, instead of to the file the editor would overwrite on its next save.
 */

export type EditorPresence = { pid: number; origin: string; updatedAt: number; open: { projectId: string; since: number }[] };

export const PRESENCE_FILE = () => path.join(DATA_DIR, "editors.json");

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** The running app and its open projects, or null when no app is running. */
export const editorPresence = async (): Promise<EditorPresence | null> => {
  try {
    const p = JSON.parse(await fs.readFile(PRESENCE_FILE(), "utf8")) as EditorPresence;
    return p && typeof p.pid === "number" && alive(p.pid) ? p : null;
  } catch {
    return null;
  }
};

export const isOpenInEditor = async (projectId: string) => {
  const presence = await editorPresence();
  return presence?.open.some((o) => o.projectId === projectId) ? presence : null;
};

/** Calls an agent tool in the editor that has the project open (the same tools MCP clients use). */
export const callLive = async (presence: EditorPresence, projectId: string, tool: string, input: unknown): Promise<unknown> => {
  const { mcpToken } = await readSettings();
  let res: Response;
  try {
    res = await fetch(`${presence.origin}/api/cli`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${mcpToken}` },
      body: JSON.stringify({ projectId, tool, input, agent: CLI_NAME }),
      signal: AbortSignal.timeout(30 * 60_000),
    });
  } catch (err) {
    throw new CliError("E_CONFLICT", `The editor at ${presence.origin} didn't answer: ${err instanceof Error ? err.message : err}`);
  }
  const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok || body.error) throw new CliError("E_INVALID", body.error ?? `The editor answered ${res.status}`, { tool });
  return body.result;
};
