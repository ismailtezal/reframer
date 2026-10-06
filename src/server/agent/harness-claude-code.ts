import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage, type UIMessageStreamWriter } from "ai";
import { TOOL_SCHEMAS } from "@/agent/tool-schemas";
import { bridge } from "../bridge";
import { readSettings } from "../settings";
import { callTool, reviewToContent, type ToolContext } from "./tools";

/**
 * Claude Code harness: runs the user's own, unmodified Claude Code (via the
 * official Claude Agent SDK) on their machine with their own login. Reframer
 * never sees or stores their credentials. Editor tools are exposed as an
 * in-process MCP server ("mcp__reframer__*"); file/shell tools are disabled.
 */

const execFileAsync = promisify(execFile);

let detected: string | null | undefined;

/** Finds the user's installed `claude` binary (falls back to the SDK's bundled official binary). */
export const findClaudeExecutable = async (): Promise<string | undefined> => {
  const settings = await readSettings();
  if (settings.harnesses.claudeCode.executable) return settings.harnesses.claudeCode.executable;
  if (detected !== undefined) return detected ?? undefined;
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execFileAsync(cmd, ["claude"], { timeout: 4000 });
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

const toolName = (raw: string) => raw.replace(/^mcp__reframer__/, "");

type ContentBlock = { type: string; [k: string]: unknown };

export const runClaudeCodeTurn = async (args: {
  prompt: string;
  instructions: string;
  ctx: ToolContext;
  resumeSessionId?: string;
  cwd: string;
  model?: string;
  signal: AbortSignal;
  originalMessages: UIMessage[];
  onSession: (sessionId: string) => Promise<void>;
  onFinish: (messages: UIMessage[]) => Promise<void>;
}) => {
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  const tools = Object.entries(TOOL_SCHEMAS).map(([name, def]) =>
    sdk.tool(name, def.description, def.input.shape, async (input: unknown) => {
      try {
        const result = await callTool(name, input, args.ctx);
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
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }),
  );
  const server = sdk.createSdkMcpServer({ name: "reframer", version: "0.1.0", tools });
  const abort = new AbortController();
  args.signal.addEventListener("abort", () => abort.abort());
  const executable = await findClaudeExecutable();

  const q = sdk.query({
    prompt: args.prompt,
    options: {
      systemPrompt: args.instructions,
      mcpServers: { reframer: server },
      // Only web research built-ins; no file or shell access.
      tools: ["WebSearch", "WebFetch"],
      allowedTools: ["mcp__reframer", "WebSearch", "WebFetch"],
      canUseTool: async (name: string) =>
        name.startsWith("mcp__reframer") || name === "WebSearch" || name === "WebFetch"
          ? { behavior: "allow" as const, updatedInput: undefined as never }
          : { behavior: "deny" as const, message: "Not available inside Reframer." },
      permissionMode: "default",
      includePartialMessages: true,
      resume: args.resumeSessionId,
      cwd: args.cwd,
      model: args.model,
      settingSources: [],
      abortController: abort,
      pathToClaudeCodeExecutable: executable,
      env: { ...(process.env as Record<string, string>), CLAUDE_AGENT_SDK_CLIENT_APP: "reframer/0.1" },
    },
  });

  const stream = createUIMessageStream({
    originalMessages: args.originalMessages,
    onFinish: async ({ messages }) => {
      await args.onFinish(messages);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (/auth|login|credential|401/i.test(msg)) {
        return "Claude Code isn't signed in. Open a terminal, run `claude`, and sign in with your account — then try again.";
      }
      return msg;
    },
    execute: async ({ writer }) => {
      bridge.presence(args.ctx.projectId, { type: "presence", agent: args.ctx.agent.name, status: "thinking" });
      writer.write({ type: "start" });
      let messageId = "m";
      const openBlocks = new Map<number, { kind: "text" | "reasoning" | "tool"; id: string }>();
      try {
        for await (const msg of q) {
          if (msg.type === "system" && msg.subtype === "init") {
            await args.onSession(msg.session_id);
          } else if (msg.type === "stream_event") {
            handleStreamEvent(
              msg.event as unknown as StreamEvent,
              writer,
              openBlocks,
              () => messageId,
              (id) => {
                messageId = id;
              },
            );
          } else if (msg.type === "assistant") {
            for (const block of (msg.message.content ?? []) as unknown as ContentBlock[]) {
              if (block.type === "tool_use") {
                writer.write({
                  type: "tool-input-available",
                  toolCallId: String(block.id),
                  toolName: toolName(String(block.name)),
                  input: block.input,
                  dynamic: true,
                });
              }
            }
          } else if (msg.type === "user") {
            const content = msg.message.content;
            if (Array.isArray(content)) {
              for (const block of content as unknown as ContentBlock[]) {
                if (block.type !== "tool_result") continue;
                const raw = block.content;
                const text = Array.isArray(raw)
                  ? (raw as ContentBlock[])
                      .filter((c) => c.type === "text")
                      .map((c) => String(c.text))
                      .join("\n")
                  : String(raw ?? "");
                if (block.is_error) {
                  writer.write({ type: "tool-output-error", toolCallId: String(block.tool_use_id), errorText: text, dynamic: true });
                } else {
                  let output: unknown = text;
                  try {
                    output = JSON.parse(text);
                  } catch {
                    // plain text result
                  }
                  writer.write({ type: "tool-output-available", toolCallId: String(block.tool_use_id), output, dynamic: true });
                }
              }
            }
          } else if (msg.type === "result") {
            if (msg.subtype !== "success") {
              writer.write({ type: "error", errorText: `Claude Code stopped: ${msg.subtype}` });
            }
          }
        }
      } finally {
        for (const block of openBlocks.values()) {
          if (block.kind === "text") writer.write({ type: "text-end", id: block.id });
          if (block.kind === "reasoning") writer.write({ type: "reasoning-end", id: block.id });
        }
        bridge.presence(args.ctx.projectId, { type: "presence", agent: args.ctx.agent.name, status: "idle" });
      }
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
};

type StreamEvent =
  | { type: "message_start"; message: { id: string } }
  | { type: "content_block_start"; index: number; content_block: { type: string; id?: string; name?: string } }
  | { type: "content_block_delta"; index: number; delta: { type: string; text?: string; thinking?: string; partial_json?: string } }
  | { type: "content_block_stop"; index: number }
  | { type: string };

const handleStreamEvent = (
  event: StreamEvent,
  writer: UIMessageStreamWriter,
  open: Map<number, { kind: "text" | "reasoning" | "tool"; id: string }>,
  getMessageId: () => string,
  setMessageId: (id: string) => void,
) => {
  switch (event.type) {
    case "message_start": {
      const e = event as Extract<StreamEvent, { type: "message_start" }>;
      setMessageId(e.message.id);
      open.clear();
      break;
    }
    case "content_block_start": {
      const e = event as Extract<StreamEvent, { type: "content_block_start" }>;
      const id = `${getMessageId()}-${e.index}`;
      if (e.content_block.type === "text") {
        open.set(e.index, { kind: "text", id });
        writer.write({ type: "text-start", id });
      } else if (e.content_block.type === "thinking") {
        open.set(e.index, { kind: "reasoning", id });
        writer.write({ type: "reasoning-start", id });
      } else if (e.content_block.type === "tool_use" && e.content_block.id) {
        open.set(e.index, { kind: "tool", id: e.content_block.id });
        writer.write({
          type: "tool-input-start",
          toolCallId: e.content_block.id,
          toolName: toolName(e.content_block.name ?? "tool"),
          dynamic: true,
        });
      }
      break;
    }
    case "content_block_delta": {
      const e = event as Extract<StreamEvent, { type: "content_block_delta" }>;
      const block = open.get(e.index);
      if (!block) break;
      if (block.kind === "text" && e.delta.text) writer.write({ type: "text-delta", id: block.id, delta: e.delta.text });
      else if (block.kind === "reasoning" && e.delta.thinking)
        writer.write({ type: "reasoning-delta", id: block.id, delta: e.delta.thinking });
      else if (block.kind === "tool" && e.delta.partial_json) {
        writer.write({ type: "tool-input-delta", toolCallId: block.id, inputTextDelta: e.delta.partial_json });
      }
      break;
    }
    case "content_block_stop": {
      const e = event as Extract<StreamEvent, { type: "content_block_stop" }>;
      const block = open.get(e.index);
      if (!block) break;
      if (block.kind === "text") writer.write({ type: "text-end", id: block.id });
      if (block.kind === "reasoning") writer.write({ type: "reasoning-end", id: block.id });
      open.delete(e.index);
      break;
    }
  }
};
