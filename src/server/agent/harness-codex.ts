import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ModelReasoningEffort } from "@openai/codex-sdk";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { bridge } from "../bridge";
import { createMcpSession, endMcpSession } from "../mcp-sessions";
import { projectDir } from "../paths";
import { readSettings } from "../settings";
import { codexBinaryFor, desktopCodexBinaries, newestCodexBinary, shimTarget } from "./cli-path";
import { codexPermissions } from "./codex-options";
import { CODEX_EFFORT_LEVELS } from "./harness-models";
import type { ToolContext } from "./tools";

/**
 * Codex harness: runs the user's own Codex CLI (official @openai/codex-sdk)
 * with their own sign-in (ChatGPT or API key). Reframer's editor tools are
 * provided through the local MCP endpoint with a per-session token. Codex runs
 * inside a per-project agent workspace, with the user's selected permission mode.
 */

const execFileAsync = promisify(execFile);
let detected: string | null | undefined;

/** The binary the SDK should spawn: npm's codex.cmd → its native codex.exe (undefined = the SDK's own). */
const codexBinary = async (file: string) => {
  const target = await shimTarget(file);
  return target ? codexBinaryFor(target) : undefined;
};

export const findCodexExecutable = async (): Promise<string | undefined> => {
  const settings = await readSettings();
  if (settings.harnesses.codex.executable) return codexBinary(settings.harnesses.codex.executable);
  if (detected !== undefined) return detected ?? undefined;
  const desktop =
    process.platform === "win32"
      ? await desktopCodexBinaries(
          path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "OpenAI", "Codex", "bin"),
        )
      : [];
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execFileAsync(cmd, process.platform === "win32" ? ["codex"] : ["-a", "codex"], {
      timeout: 4000,
      windowsHide: true,
    });
    const candidates = stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && (process.platform !== "win32" || /\.(exe|cmd)$/i.test(s)));
    detected = (await newestCodexBinary([...candidates, ...desktop])) ?? null;
  } catch {
    detected = (await newestCodexBinary(desktop)) ?? null;
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
  /** The prompt with the whole conversation, for when the saved thread can't be resumed. */
  freshPrompt?: string;
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
  /** `failed`: the turn ended on an error (stops are told apart by the caller). */
  onFinish: (messages: UIMessage[], info: { failed: boolean }) => Promise<void>;
}) => {
  const { Codex } = await import("@openai/codex-sdk");
  const permissions = codexPermissions((await readSettings()).harnesses.codex.permissions);
  const token = createMcpSession(args.projectId, args.ctx.agent, permissions.enabledTools);
  // Isolated workspace: instructions live in AGENTS.md (Codex reads it automatically).
  const workspace = path.join(projectDir(args.projectId), "agent");
  await fs.mkdir(workspace, { recursive: true });
  await fs.writeFile(path.join(workspace, "AGENTS.md"), args.instructions, "utf8");

  const codex = new Codex({
    codexPathOverride: await findCodexExecutable(),
    config: {
      // Stream readable reasoning summaries so the panel can show what Codex is thinking.
      model_reasoning_summary: "detailed",
      mcp_servers: {
        reframer: {
          url: `${args.origin}/api/mcp`,
          bearer_token_env_var: "REFRAMER_MCP_TOKEN",
          tool_timeout_sec: 1800,
          default_tools_approval_mode: "approve",
          enabled_tools: permissions.enabledTools,
          tools: permissions.toolPolicy,
        },
      },
    },
    env: { ...(process.env as Record<string, string>), REFRAMER_MCP_TOKEN: token },
  });
  const threadOptions = {
    workingDirectory: workspace,
    skipGitRepoCheck: true,
    ...permissions.threadOptions,
    model: args.model,
    modelReasoningEffort: args.effort && CODEX_EFFORT_LEVELS.has(args.effort) ? (args.effort as ModelReasoningEffort) : undefined,
    webSearchMode: "live" as const,
  };
  let thread = args.threadId ? codex.resumeThread(args.threadId, threadOptions) : codex.startThread(threadOptions);

  const stream = createUIMessageStream({
    originalMessages: args.originalMessages,
    onFinish: async ({ messages, outcome }) => {
      await args.onFinish(messages, { failed: outcome.status === "failed" });
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
      let resuming = !!args.threadId;
      let prompt = args.prompt;
      try {
        for (;;) {
          try {
            await consume();
            break;
          } catch (err) {
            if (!resuming || !/no rollout found|thread\/resume failed/i.test(String(err))) throw err;
            // Codex no longer has this chat's thread: start a new one that's given the conversation so far.
            resuming = false;
            thread = codex.startThread(threadOptions);
            prompt = args.freshPrompt ?? args.prompt;
          }
        }
      } finally {
        endMcpSession(token);
        bridge.presence(args.projectId, { type: "presence", agent: args.ctx.agent.name, status: "idle" });
      }
      writer.write({ type: "finish" });

      async function consume() {
        const { events } = await thread.runStreamed(prompt, { signal: args.signal });
        for await (const event of events) {
          if (event.type === "thread.started") {
            await args.onThread(event.thread_id);
            continue;
          }
          if (event.type === "turn.failed") {
            writer.write({ type: "error", errorText: event.error.message });
            writer.setOutcome({ status: "failed" });
            continue;
          }
          if (event.type === "error") {
            writer.write({ type: "error", errorText: event.message });
            writer.setOutcome({ status: "failed" });
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
            writer.setOutcome({ status: "failed" });
          }
        }
      }
    },
  });
  return createUIMessageStreamResponse({ stream });
};
