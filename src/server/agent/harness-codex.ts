import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { bridge } from "../bridge";
import { createMcpSession, endMcpSession } from "../mcp-sessions";
import { projectDir } from "../paths";
import { readSettings } from "../settings";
import type { ToolContext } from "./tools";

/**
 * Codex harness: runs the user's own Codex CLI (official @openai/codex-sdk)
 * with their own sign-in (ChatGPT or API key). Reframer's editor tools are
 * provided through the local MCP endpoint with a per-session token. Codex runs
 * in a read-only sandbox inside a per-project agent workspace.
 */

const execFileAsync = promisify(execFile);
let detected: string | null | undefined;

export const findCodexExecutable = async (): Promise<string | undefined> => {
  const settings = await readSettings();
  if (settings.harnesses.codex.executable) return settings.harnesses.codex.executable;
  if (detected !== undefined) return detected ?? undefined;
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execFileAsync(cmd, ["codex"], { timeout: 4000 });
    const first = stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s && (process.platform !== "win32" || /\.(exe|cmd)$/i.test(s)));
    detected = first ?? null;
  } catch {
    detected = null;
  }
  return detected ?? undefined;
};

type CodexItem =
  | { id: string; type: "agent_message"; text: string }
  | { id: string; type: "reasoning"; text: string }
  | {
      id: string;
      type: "mcp_tool_call";
      server: string;
      tool: string;
      arguments: unknown;
      status: string;
      result?: { content: { type: string; text?: string }[]; structured_content?: unknown };
      error?: { message: string };
    }
  | { id: string; type: "todo_list"; items: { text: string; completed: boolean }[] }
  | { id: string; type: "error"; message: string }
  | { id: string; type: string; [k: string]: unknown };

export const runCodexTurn = async (args: {
  prompt: string;
  instructions: string;
  ctx: ToolContext;
  projectId: string;
  threadId?: string;
  origin: string;
  model?: string;
  effort?: string;
  signal: AbortSignal;
  originalMessages: UIMessage[];
  onThread: (threadId: string) => Promise<void>;
  onFinish: (messages: UIMessage[]) => Promise<void>;
}) => {
  const { Codex } = await import("@openai/codex-sdk");
  const token = createMcpSession(args.projectId, args.ctx.agent);
  // Isolated workspace: instructions live in AGENTS.md (Codex reads it automatically).
  const workspace = path.join(projectDir(args.projectId), "agent");
  await fs.mkdir(workspace, { recursive: true });
  await fs.writeFile(path.join(workspace, "AGENTS.md"), args.instructions, "utf8");

  const codex = new Codex({
    codexPathOverride: await findCodexExecutable(),
    config: {
      mcp_servers: {
        reframer: {
          url: `${args.origin}/api/mcp`,
          bearer_token_env_var: "REFRAMER_MCP_TOKEN",
          tool_timeout_sec: 1800,
        },
      },
    },
    env: { ...(process.env as Record<string, string>), REFRAMER_MCP_TOKEN: token },
  });
  const threadOptions = {
    workingDirectory: workspace,
    skipGitRepoCheck: true,
    sandboxMode: "read-only" as const,
    approvalPolicy: "never" as const,
    model: args.model,
    modelReasoningEffort: args.effort as "low" | "medium" | "high" | undefined,
    webSearchMode: "live" as const,
  };
  const thread = args.threadId ? codex.resumeThread(args.threadId, threadOptions) : codex.startThread(threadOptions);

  const stream = createUIMessageStream({
    originalMessages: args.originalMessages,
    onFinish: async ({ messages }) => {
      await args.onFinish(messages);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (/login|auth|401|unauthorized/i.test(msg)) return "Codex isn't signed in. Run `codex login` in a terminal, then try again.";
      if (/ENOENT|not found/i.test(msg))
        return "Codex CLI not found. Install it (npm i -g @openai/codex) or set its path in Settings → Agents.";
      return msg;
    },
    execute: async ({ writer }) => {
      bridge.presence(args.projectId, { type: "presence", agent: args.ctx.agent.name, status: "thinking" });
      writer.write({ type: "start" });
      const textSoFar = new Map<string, string>();
      const startedTools = new Set<string>();
      try {
        const { events } = await thread.runStreamed(args.prompt, { signal: args.signal });
        for await (const event of events) {
          if (event.type === "thread.started") {
            await args.onThread(event.thread_id);
            continue;
          }
          if (event.type === "turn.failed") {
            writer.write({ type: "error", errorText: event.error.message });
            continue;
          }
          if (event.type === "error") {
            writer.write({ type: "error", errorText: event.message });
            continue;
          }
          if (event.type !== "item.started" && event.type !== "item.updated" && event.type !== "item.completed") continue;
          const item = event.item as CodexItem;
          const done = event.type === "item.completed";
          if (item.type === "agent_message" || item.type === "reasoning") {
            const kind = item.type === "agent_message" ? "text" : "reasoning";
            const full = String((item as { text: string }).text ?? "");
            const prev = textSoFar.get(item.id);
            if (prev === undefined) writer.write({ type: kind === "text" ? "text-start" : "reasoning-start", id: item.id });
            const delta = full.slice(prev?.length ?? 0);
            if (delta) writer.write({ type: kind === "text" ? "text-delta" : "reasoning-delta", id: item.id, delta });
            textSoFar.set(item.id, full);
            if (done) writer.write({ type: kind === "text" ? "text-end" : "reasoning-end", id: item.id });
          } else if (item.type === "mcp_tool_call") {
            const call = item as Extract<CodexItem, { type: "mcp_tool_call" }>;
            if (!startedTools.has(call.id)) {
              startedTools.add(call.id);
              writer.write({
                type: "tool-input-available",
                toolCallId: call.id,
                toolName: call.tool,
                input: call.arguments,
                dynamic: true,
              });
            }
            if (done || call.status === "completed" || call.status === "failed") {
              if (call.status === "failed" || call.error) {
                writer.write({
                  type: "tool-output-error",
                  toolCallId: call.id,
                  errorText: call.error?.message ?? "Tool failed",
                  dynamic: true,
                });
              } else {
                const text =
                  call.result?.content
                    ?.filter((c) => c.type === "text")
                    .map((c) => c.text)
                    .join("\n") ?? "";
                let output: unknown = call.result?.structured_content ?? text;
                if (typeof output === "string") {
                  try {
                    output = JSON.parse(output);
                  } catch {
                    // keep text
                  }
                }
                writer.write({ type: "tool-output-available", toolCallId: call.id, output, dynamic: true });
              }
            }
          } else if (item.type === "todo_list") {
            const todo = item as Extract<CodexItem, { type: "todo_list" }>;
            writer.write({
              type: "data-plan",
              id: `plan-${todo.id}`,
              data: { steps: todo.items.map((t) => ({ title: t.text, done: t.completed })) },
            });
          } else if (item.type === "error") {
            writer.write({ type: "error", errorText: String((item as { message: string }).message) });
          }
        }
      } finally {
        endMcpSession(token);
        bridge.presence(args.projectId, { type: "presence", agent: args.ctx.agent.name, status: "idle" });
      }
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
};
