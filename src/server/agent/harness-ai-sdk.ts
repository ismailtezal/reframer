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
import { resolveLanguageModel, toReasoning } from "./models";
import { callTool, reviewToContent, type ToolContext } from "./tools";

/** Builds AI SDK tools that execute through the editor bridge. */
export const buildAiSdkTools = (ctx: ToolContext, opts: { vision: boolean }): ToolSet => {
  const tools: ToolSet = {};
  for (const [name, def] of Object.entries(TOOL_SCHEMAS)) {
    if (name === "review_frames") {
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

/** Strips heavy image payloads from older review_frames results before re-sending history. */
const slimHistory = (messages: UIMessage[]): UIMessage[] => {
  let lastReview = -1;
  messages.forEach((m, i) => {
    if (m.parts.some((p) => p.type === "tool-review_frames" || (p.type === "dynamic-tool" && p.toolName === "review_frames")))
      lastReview = i;
  });
  return messages.map((m, i) => {
    if (i === lastReview) return m;
    return {
      ...m,
      parts: m.parts.map((p) => {
        if (
          (p.type === "tool-review_frames" || (p.type === "dynamic-tool" && p.toolName === "review_frames")) &&
          "output" in p &&
          p.output
        ) {
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
  onFinish: (messages: UIMessage[]) => Promise<void>;
}) => {
  const model = await resolveLanguageModel(args.modelRef);
  const tools = buildAiSdkTools(args.ctx, { vision: args.vision });
  const history = slimHistory(args.messages);
  bridge.presence(args.ctx.projectId, { type: "presence", agent: args.ctx.agent.name, status: "thinking" });
  const result = streamText({
    model,
    instructions: args.instructions,
    messages: await convertToModelMessages(history, { tools }),
    tools,
    stopWhen: isStepCount(80),
    reasoning: toReasoning(args.effort),
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
      onFinish: async ({ messages }) => {
        await args.onFinish(messages);
      },
      onError: (error) => (error instanceof Error ? error.message : String(error)),
    }),
  });
};
