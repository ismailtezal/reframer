import { describe, expect, it } from "vitest";
import { CODEX_READ_TOOLS } from "@/core/codex-permissions";
import { createMcpSession, endMcpSession, resolveMcpToken } from "../mcp-sessions";
import { codexPermissions } from "./codex-options";

describe("Codex permissions", () => {
  it("approves Reframer tools without broadening the default file sandbox", () => {
    const policy = codexPermissions(undefined);
    expect(policy.mode).toBe("edit");
    expect(policy.threadOptions).toEqual({ sandboxMode: "read-only", approvalPolicy: "never" });
    expect(policy.enabledTools).toContain("add_clips");
    expect(policy.toolPolicy.get_project).toEqual({ approval_mode: "approve" });
    expect(policy.toolPolicy.load_skill).toEqual({ approval_mode: "approve" });
    expect(policy.toolPolicy.add_clips).toEqual({ approval_mode: "approve" });
  });
  it("restricts read-only mode and binds that restriction to the MCP session", async () => {
    const policy = codexPermissions("read");
    expect(policy.enabledTools).toEqual([...CODEX_READ_TOOLS]);
    expect(policy.enabledTools).not.toContain("update_clips");
    expect(policy.enabledTools).not.toContain("create_component");
    const token = createMcpSession("proj_test", { name: "Codex", kind: "agent" }, policy.enabledTools);
    try {
      const session = await resolveMcpToken(token);
      expect(session?.projectId).toBe("proj_test");
      expect(session?.allowedTools).toEqual(policy.enabledTools);
    } finally {
      endMcpSession(token);
    }
  });
  it("requires an explicit full-access setting and treats unknown values as editor access", () => {
    expect(codexPermissions("full").threadOptions.sandboxMode).toBe("danger-full-access");
    expect(codexPermissions("invalid").threadOptions.sandboxMode).toBe("read-only");
  });
});
