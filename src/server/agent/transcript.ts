import "server-only";
import type { UIMessage } from "ai";
import { textOf } from "./threads";

/**
 * A compact transcript of earlier messages, for an agent session that starts without them:
 * its saved session is gone (Claude Code / Codex prune old ones), or the chat moved to it from
 * another model. Newest messages win when it's too long; the project itself is always sent fresh.
 */

const MAX_CHARS = 16_000;

const toolsOf = (m: UIMessage) => {
  const counts = new Map<string, { n: number; failed: number }>();
  for (const part of m.parts) {
    const p = part as { type: string; toolName?: string; state?: string };
    const name = p.type === "dynamic-tool" ? p.toolName : p.type.startsWith("tool-") ? p.type.slice(5) : undefined;
    if (!name) continue;
    const c = counts.get(name) ?? { n: 0, failed: 0 };
    c.n++;
    if (p.state === "output-error") c.failed++;
    counts.set(name, c);
  }
  return [...counts].map(([name, c]) => `${name}${c.n > 1 ? ` ×${c.n}` : ""}${c.failed ? ` (${c.failed} failed)` : ""}`).join(", ");
};

export const transcriptOf = (messages: UIMessage[]) => {
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      const text = textOf(m);
      if (text) lines.push(`User: ${text}`);
    } else if (m.role === "assistant") {
      const tools = toolsOf(m);
      const text = textOf(m);
      if (tools) lines.push(`You used: ${tools}`);
      if (text) lines.push(`You: ${text}`);
      const ended = m.metadata as { interrupted?: boolean; failed?: boolean } | undefined;
      if (ended?.interrupted) lines.push("(That turn was stopped before it finished.)");
      else if (ended?.failed) lines.push("(That turn ended with an error.)");
    }
  }
  let out = lines.join("\n\n");
  if (out.length > MAX_CHARS) out = `…\n${out.slice(out.length - MAX_CHARS)}`;
  return out;
};

/** The prompt for a session that hasn't seen `earlier`: the conversation so far, then the new message. */
export const withHistory = (earlier: UIMessage[], prompt: string) => {
  const transcript = transcriptOf(earlier);
  if (!transcript) return prompt;
  return [
    "<earlier_conversation>",
    "This chat started before this session, so here is what was said and done so far (the timeline in the system prompt is current):",
    transcript,
    "</earlier_conversation>",
    "",
    prompt,
  ].join("\n");
};
