import type { UIMessage } from "ai";
import { buildInstructions } from "@/agent/prompt";
import { SFX_LIBRARY } from "@/core/sfx";
import { STYLE_PRESETS } from "@/core/styles";
import { runAiSdkTurn } from "@/server/agent/harness-ai-sdk";
import { runClaudeCodeTurn } from "@/server/agent/harness-claude-code";
import { runCodexTurn } from "@/server/agent/harness-codex";
import { listClaudeCodeModels } from "@/server/agent/harness-models";
import { getModelInfo } from "@/server/agent/models";
import { readThread, type ThreadRecord, textOf, writeThread } from "@/server/agent/threads";
import { withHistory } from "@/server/agent/transcript";
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
  // "harness:claude-code[:<model>]" / "harness:codex[:<model>]"; no model = the CLI's default.
  const harness = /^harness:(claude-code|codex)(?::(.+))?$/.exec(modelRef);
  const isClaudeCode = harness?.[1] === "claude-code";
  const isCodex = harness?.[1] === "codex";
  const harnessModel = harness?.[2];
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
  const persist = async (messages: UIMessage[], harness?: ThreadRecord["harness"]) => {
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
  const finish = async (messages: UIMessage[], harness: ThreadRecord["harness"] | undefined, info: { failed: boolean }) => {
    endTurn(projectId, threadId, turn);
    // A turn that was stopped (Stop, Esc, leaving the editor, a newer message) or failed is marked,
    // so a chat reopened later shows how it ended.
    const last = messages[messages.length - 1];
    const mark = signal.aborted ? { interrupted: true } : info.failed ? { failed: true } : null;
    await persist(
      mark && last?.role === "assistant"
        ? [...messages.slice(0, -1), { ...last, metadata: { ...(last.metadata as object), ...mark } }]
        : messages,
      harness,
    );
  };

  // Local CLIs keep their own session per chat. Catch a session up on messages it hasn't seen
  // (answered by another model), and have the full transcript ready in case it can't be resumed.
  const user = lastUserMessage(body.messages);
  const text = user ? textOf(user) : "Continue.";
  const earlier = user ? body.messages.slice(0, body.messages.lastIndexOf(user)) : body.messages;
  const harnessPrompt = (sessionId: string | undefined, seen: number | undefined) => {
    const unseen = sessionId ? earlier.slice(seen ?? earlier.length) : earlier;
    return unseen.length ? withHistory(unseen, text) : text;
  };
  // The session saw this turn only if the agent got to answer (not when the CLI failed to start).
  const answered = (messages: UIMessage[]) => {
    const last = messages[messages.length - 1];
    return last?.role === "assistant" && last.parts.some((p) => p.type === "text" || p.type === "reasoning" || p.type === "dynamic-tool");
  };

  try {
    if (isClaudeCode) {
      const sessionId = existing?.harness.claudeSessionId;
      return await runClaudeCodeTurn({
        prompt: harnessPrompt(sessionId, existing?.harness.claudeSeen),
        freshPrompt: withHistory(earlier, text),
        instructions,
        ctx: { ...ctx, agent: { ...ctx.agent, kind: "agent" } },
        resumeSessionId: sessionId,
        cwd: projectDir(projectId),
        model: harnessModel,
        effort: body.effort,
        showThinking:
          (await listClaudeCodeModels()).find((m) => m.id === (harnessModel ?? "default"))?.adaptive ?? !/haiku/i.test(harnessModel ?? ""),
        signal,
        originalMessages: body.messages,
        onSession: (claudeSessionId) => persist(body.messages, { claudeSessionId }),
        onFinish: (messages, info) => finish(messages, answered(messages) ? { claudeSeen: messages.length } : undefined, info),
      });
    }
    if (isCodex) {
      const codexThreadId = existing?.harness.codexThreadId;
      return await runCodexTurn({
        prompt: harnessPrompt(codexThreadId, existing?.harness.codexSeen),
        freshPrompt: withHistory(earlier, text),
        instructions,
        ctx: { ...ctx, agent: { ...ctx.agent, kind: "agent" } },
        projectId,
        threadId: codexThreadId,
        origin: new URL(request.url).origin,
        model: harnessModel,
        effort: body.effort,
        signal,
        originalMessages: body.messages,
        onThread: (id) => persist(body.messages, { codexThreadId: id }),
        onFinish: (messages, info) => finish(messages, answered(messages) ? { codexSeen: messages.length } : undefined, info),
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
      onFinish: (messages, info) => finish(messages, undefined, info),
    });
  } catch (err) {
    endTurn(projectId, threadId, turn);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
