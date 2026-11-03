import "server-only";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  type ToolSet,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { TOOL_SCHEMAS, type ToolName } from "@/agent/tool-schemas";
import { bridge } from "../bridge";
import { getModelInfo, resolveLanguageModel, toReasoning } from "./models";
import { callTool, IMAGE_TOOLS, reviewToContent, type ToolContext } from "./tools";

/** Builds AI SDK tools that execute through the editor bridge. */
export const buildAiSdkTools = (ctx: ToolContext, opts: { vision: boolean }): ToolSet => {
  const tools: ToolSet = {};
  for (const [name, def] of Object.entries(TOOL_SCHEMAS)) {
    if (IMAGE_TOOLS.has(name)) {
      tools[name] = tool({
        description: def.description,
        inputSchema: def.input,
        execute: async (input: unknown) => callTool(name, input, ctx),
        toModelOutput: ({ output }) => {
          const { text, images } = reviewToContent(output);
          if (!opts.vision || images.length === 0) return { type: "text", value: text };
          return {
            type: "content",
            value: [
              { type: "text", text },
              ...images.map((img) => ({
                type: "file" as const,
                mediaType: img.mediaType,
                filename: `frame-${img.timeSec}s.jpg`,
                data: { type: "data" as const, data: img.data },
              })),
            ],
          };
        },
      });
      continue;
    }
    tools[name] = tool({
      description: def.description,
      inputSchema: def.input,
      execute: async (input: unknown) => callTool(name as ToolName, input, ctx),
    });
  }
  return tools;
};

/** Strips heavy image payloads from older frame-tool results (review/critique) before re-sending history. */
const isFramePart = (p: UIMessage["parts"][number]) =>
  [...IMAGE_TOOLS].some((t) => p.type === `tool-${t}` || (p.type === "dynamic-tool" && p.toolName === t));

const slimHistory = (messages: UIMessage[]): UIMessage[] => {
  let lastReview = -1;
  messages.forEach((m, i) => {
    if (m.parts.some(isFramePart)) lastReview = i;
  });
  return messages.map((m, i) => {
    if (i === lastReview) return m;
    return {
      ...m,
      parts: m.parts.map((p) => {
        if (isFramePart(p) && "output" in p && p.output) {
          const o = p.output as { frames?: { timeSec: number }[] };
          return { ...p, output: { ...o, frames: o.frames?.map((f) => ({ timeSec: f.timeSec, dataUrl: "(image omitted)" })) } } as typeof p;
        }
        return p;
      }),
    };
  });
};

export const runAiSdkTurn = async (args: {
  modelRef: string;
  effort?: string;
  instructions: string;
  messages: UIMessage[];
  ctx: ToolContext;
  vision: boolean;
  signal: AbortSignal;
  /** `failed`: the turn ended on an error (stops are told apart by the caller). */
  onFinish: (messages: UIMessage[], info: { failed: boolean }) => Promise<void>;
}) => {
  const model = await resolveLanguageModel(args.modelRef);
  const info = await getModelInfo(args.modelRef);
  const thinks = !!info?.reasoning && args.effort !== "none";
  const provider = args.modelRef.split(":")[0];
  // Providers only return readable reasoning when asked (summaries / thought summaries / summarized thinking).
  const providerOptions = thinks
    ? {
        ...(provider === "openai" ? { openai: { reasoningSummary: "detailed" } } : {}),
        ...(provider === "google" ? { google: { thinkingConfig: { includeThoughts: true } } } : {}),
        ...(provider === "anthropic" && info && /claude-(opus|sonnet|fable)-(4-[6-9]|[5-9])/.test(info.id)
          ? { anthropic: { thinking: { type: "adaptive", display: "summarized" } } }
          : {}),
      }
    : undefined;
  const tools = buildAiSdkTools(args.ctx, { vision: args.vision });
  const history = slimHistory(args.messages);
  bridge.presence(args.ctx.projectId, { type: "presence", agent: args.ctx.agent.name, status: "thinking" });
  const result = streamText({
    model,
    instructions: args.instructions,
    // A turn that was stopped mid-tool-call leaves calls without results; providers reject those.
    messages: await convertToModelMessages(history, { tools, ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: isStepCount(80),
    reasoning: toReasoning(args.effort),
    ...(providerOptions && Object.keys(providerOptions).length ? { providerOptions } : {}),
    abortSignal: args.signal,
    onEnd: () => {
      bridge.presence(args.ctx.projectId, { type: "presence", agent: args.ctx.agent.name, status: "idle" });
    },
    onError: ({ error }) => {
      console.error("[reframer] agent error", error);
      bridge.presence(args.ctx.projectId, { type: "presence", agent: args.ctx.agent.name, status: "error", text: String(error) });
    },
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: args.messages,
      sendReasoning: true,
      onFinish: async ({ messages, outcome }) => {
        await args.onFinish(messages, { failed: outcome.status === "failed" });
      },
      onError: (error) => (error instanceof Error ? error.message : String(error)),
    }),
  });
};
