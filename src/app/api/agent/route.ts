import type { UIMessage } from "ai";
import { buildInstructions } from "@/agent/prompt";
import { SFX_LIBRARY } from "@/core/sfx";
import { STYLE_PRESETS } from "@/core/styles";
import { runAiSdkTurn } from "@/server/agent/harness-ai-sdk";
import { runClaudeCodeTurn } from "@/server/agent/harness-claude-code";
import { runCodexTurn } from "@/server/agent/harness-codex";
import { getModelInfo } from "@/server/agent/models";
import { readThread, textOf, writeThread } from "@/server/agent/threads";
import { beginTurn, endTurn } from "@/server/agent/turns";
import { assertSafeId, projectDir } from "@/server/paths";
import { listSkills } from "@/server/skills";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

type AgentRequest = {
  projectId: string;
  threadId: string;
  messages: UIMessage[];
  modelRef: string;
  effort?: string;
  mode?: "build" | "plan";
  context: {
    summary: Record<string, unknown>;
    components: { id: string; category: string; description: string }[];
    selection?: string[];
    playheadSec?: number;
  };
};

const lastUserMessage = (messages: UIMessage[]) => [...messages].reverse().find((m) => m.role === "user");

export async function POST(request: Request) {
  const body = (await request.json()) as AgentRequest;
  const projectId = assertSafeId(body.projectId);
  const threadId = assertSafeId(body.threadId);
  const modelRef = body.modelRef;
  const isClaudeCode = modelRef === "harness:claude-code";
  const isCodex = modelRef === "harness:codex";
  const info = isClaudeCode || isCodex ? undefined : await getModelInfo(modelRef);
  const agentName = isClaudeCode ? "Claude Code" : isCodex ? "Codex" : (info?.name ?? modelRef.split(":").pop() ?? "Agent");
  const vision = isClaudeCode || isCodex ? true : (info?.vision ?? false);

  const skills = await listSkills();
  const instructions = buildInstructions({
    agentName,
    project: {
      ...body.context.summary,
      ...(body.context.selection?.length ? { selection: body.context.selection } : {}),
      ...(body.context.playheadSec !== undefined ? { playheadSec: body.context.playheadSec } : {}),
    },
    skills: skills.map((s) => ({ name: s.name, description: s.description })),
    styles: STYLE_PRESETS.map((s) => ({ id: s.id, name: s.name, category: s.category })),
    components: body.context.components,
    sfx: SFX_LIBRARY.map((s) => ({ id: s.id, name: s.name })),
    vision,
    harness: isClaudeCode ? "claude-code" : isCodex ? "codex" : "ai-sdk",
    mode: body.mode,
  });

  const existing = await readThread(projectId, threadId);
  const now = Date.now();
  const persist = async (messages: UIMessage[], harness?: { claudeSessionId?: string; codexThreadId?: string }) => {
    const current = (await readThread(projectId, threadId)) ?? existing;
    await writeThread({
      id: threadId,
      projectId,
      title: current?.title || textOf(messages.find((m) => m.role === "user") ?? messages[0]).slice(0, 60) || "New chat",
      createdAt: current?.createdAt ?? now,
      updatedAt: Date.now(),
      modelRef,
      messages,
      harness: { ...current?.harness, ...harness },
    });
  };
  // Save the user's message right away so it survives a crash mid-turn.
  await persist(body.messages);

  // Edits from this turn share a turn id (the user message that started it), so they can be grouped and undone together.
  const turnId = lastUserMessage(body.messages)?.id;
  const ctx = { projectId, agent: { name: agentName, kind: "ai" as const, sessionId: threadId, turnId } };
  const turn = beginTurn(projectId, threadId, request.signal);
  const signal = turn.signal;
  const finish = async (messages: Parameters<typeof persist>[0], harness?: Parameters<typeof persist>[1]) => {
    endTurn(projectId, threadId, turn);
    await persist(messages, harness);
  };
  try {
    if (isClaudeCode) {
      const user = lastUserMessage(body.messages);
      return await runClaudeCodeTurn({
        prompt: user ? textOf(user) : "Continue.",
        instructions,
        ctx: { ...ctx, agent: { ...ctx.agent, kind: "agent" } },
        resumeSessionId: existing?.harness.claudeSessionId,
        cwd: projectDir(projectId),
        signal,
        originalMessages: body.messages,
        onSession: (claudeSessionId) => persist(body.messages, { claudeSessionId }),
        onFinish: (messages) => finish(messages),
      });
    }
    if (isCodex) {
      const user = lastUserMessage(body.messages);
      return await runCodexTurn({
        prompt: user ? textOf(user) : "Continue.",
        instructions,
        ctx: { ...ctx, agent: { ...ctx.agent, kind: "agent" } },
        projectId,
        threadId: existing?.harness.codexThreadId,
        origin: new URL(request.url).origin,
        effort: body.effort,
        signal,
        originalMessages: body.messages,
        onThread: (codexThreadId) => persist(body.messages, { codexThreadId }),
        onFinish: (messages) => finish(messages),
      });
    }
    return await runAiSdkTurn({
      modelRef,
      effort: body.effort,
      instructions,
      messages: body.messages,
      ctx,
      vision,
      signal,
      onFinish: (messages) => finish(messages),
    });
  } catch (err) {
    endTurn(projectId, threadId, turn);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
