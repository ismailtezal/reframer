import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { waitingForAgent } from "./thinking";

const assistant = (parts: UIMessage["parts"]): UIMessage[] => [{ id: "test", role: "assistant", parts }];

describe("thinking status", () => {
  it("stays visible before the first item and between completed tools", () => {
    expect(waitingForAgent([], true)).toBe(true);
    expect(waitingForAgent(assistant([]), true)).toBe(true);
    expect(waitingForAgent(assistant([{ type: "text", text: "I'll check the timeline.", state: "done" }]), true)).toBe(true);
    expect(
      waitingForAgent(
        assistant([
          { type: "dynamic-tool", toolName: "get_project", toolCallId: "tool", state: "output-available", input: {}, output: {} },
        ]),
        true,
      ),
    ).toBe(true);
  });
  it("doesn't duplicate an active answer, reasoning row or tool spinner", () => {
    expect(waitingForAgent(assistant([{ type: "text", text: "Answer", state: "streaming" }]), true)).toBe(false);
    expect(waitingForAgent(assistant([{ type: "reasoning", text: "Summary", state: "streaming" }]), true)).toBe(false);
    expect(
      waitingForAgent(
        assistant([{ type: "dynamic-tool", toolName: "get_project", toolCallId: "tool", state: "input-available", input: {} }]),
        true,
      ),
    ).toBe(false);
  });
  it("disappears when stopped or finished and waits after a completed summary", () => {
    expect(waitingForAgent([], false)).toBe(false);
    expect(waitingForAgent(assistant([{ type: "reasoning", text: "", state: "done" }]), false)).toBe(false);
    expect(waitingForAgent(assistant([{ type: "reasoning", text: "Summary", state: "done" }]), true)).toBe(true);
  });
});
