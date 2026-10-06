import "server-only";
import { randomUUID } from "node:crypto";

/**
 * The bridge relays agent tool calls to the open editor window, where they run
 * against live editor state (so the user watches every edit happen), and
 * returns the results. Every agent — built-in, Claude Code, Codex, external
 * MCP clients — goes through here.
 */

export type AgentIdentity = {
  name: string;
  sessionId?: string;
  turnId?: string;
  kind: "ai" | "agent";
  /** Connected from outside the app over MCP (Claude Code, Codex, Cursor…). */
  external?: boolean;
};

export type BridgeEvent =
  | { type: "hello"; clientId: string }
  | { type: "tool_call"; requestId: string; tool: string; input: unknown; agent: AgentIdentity }
  | { type: "presence"; agent: string; status: "thinking" | "working" | "waiting" | "idle" | "error"; text?: string }
  | { type: "ping" };

type Client = {
  id: string;
  projectId: string;
  send: (e: BridgeEvent) => void;
  connectedAt: number;
  lastFocus: number;
};

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  clientId: string;
};

export class EditorNotConnectedError extends Error {
  constructor(projectId?: string) {
    super(
      projectId
        ? `No editor window is open for project ${projectId}. Open it in Reframer so edits can be applied (and watched) live.`
        : "No Reframer editor window is open. Open a project in Reframer first.",
    );
    this.name = "EditorNotConnectedError";
  }
}

/** Tools that may legitimately run for minutes. */
const LONG_TOOLS = new Set([
  "transcribe",
  "add_captions",
  "remove_silences",
  "remove_fillers",
  "detect_beats",
  "generate_image",
  "generate_voiceover",
  "import_media",
  "search_audio",
  "review_frames",
  "ask_user",
]);

class Bridge {
  private clients = new Map<string, Client>();
  private pending = new Map<string, Pending>();

  connect(projectId: string, send: (e: BridgeEvent) => void): string {
    const id = randomUUID();
    const now = Date.now();
    this.clients.set(id, { id, projectId, send, connectedAt: now, lastFocus: now });
    send({ type: "hello", clientId: id });
    return id;
  }

  disconnect(clientId: string) {
    this.clients.delete(clientId);
    for (const [requestId, p] of this.pending) {
      if (p.clientId === clientId) {
        clearTimeout(p.timer);
        p.reject(new Error("The editor window was closed before the edit finished."));
        this.pending.delete(requestId);
      }
    }
  }

  focus(clientId: string) {
    const c = this.clients.get(clientId);
    if (c) c.lastFocus = Date.now();
  }

  /** Editor window for a project, or the most recently focused one. */
  clientFor(projectId?: string): Client | undefined {
    const all = [...this.clients.values()].sort((a, b) => b.lastFocus - a.lastFocus);
    return projectId ? all.find((c) => c.projectId === projectId) : all[0];
  }

  openProjects(): { projectId: string; since: number }[] {
    const seen = new Map<string, number>();
    for (const c of this.clients.values()) seen.set(c.projectId, Math.min(seen.get(c.projectId) ?? c.connectedAt, c.connectedAt));
    return [...seen.entries()].map(([projectId, since]) => ({ projectId, since }));
  }

  call(projectId: string | undefined, tool: string, input: unknown, agent: AgentIdentity, timeoutMs?: number): Promise<unknown> {
    const client = this.clientFor(projectId);
    if (!client) return Promise.reject(new EditorNotConnectedError(projectId));
    const requestId = randomUUID();
    const timeout = timeoutMs ?? (LONG_TOOLS.has(tool) ? 30 * 60_000 : 90_000);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`The editor did not respond to "${tool}" in time.`));
      }, timeout);
      this.pending.set(requestId, { resolve, reject, timer, clientId: client.id });
      client.send({ type: "tool_call", requestId, tool, input, agent });
    });
  }

  resolve(requestId: string, outcome: { ok: true; result: unknown } | { ok: false; error: string }) {
    const p = this.pending.get(requestId);
    if (!p) return false;
    clearTimeout(p.timer);
    this.pending.delete(requestId);
    if (outcome.ok) p.resolve(outcome.result);
    else p.reject(new Error(outcome.error));
    return true;
  }

  presence(projectId: string | undefined, event: Extract<BridgeEvent, { type: "presence" }>) {
    const client = this.clientFor(projectId);
    client?.send(event);
  }

  ping() {
    for (const c of this.clients.values()) {
      try {
        c.send({ type: "ping" });
      } catch {
        this.disconnect(c.id);
      }
    }
  }
}

// One instance per server process (route bundles may load this module separately).
const g = globalThis as unknown as { __reframerBridge?: Bridge };
export const bridge: Bridge = g.__reframerBridge ?? new Bridge();
g.__reframerBridge = bridge;
