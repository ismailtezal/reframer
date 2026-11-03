import type { UIMessage } from "ai";

/** Keep a live status between streamed items, even when the model shares no reasoning text. */
export const waitingForAgent = (messages: UIMessage[], busy: boolean) => {
  if (!busy) return false;
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return true;
  const part = last.parts.findLast((part) => part.type !== "step-start");
  if (!part) return true;
  if ((part.type === "text" || part.type === "reasoning") && part.state === "streaming") return false;
  if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
    const state = (part as { state?: string }).state;
    if (state === "input-streaming" || state === "input-available" || state === "approval-requested") return false;
  }
  return true;
};
