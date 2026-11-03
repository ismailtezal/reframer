import type { ThreadOptions } from "@openai/codex-sdk";
import { TOOL_SCHEMAS } from "@/agent/tool-schemas";
import { CODEX_READ_TOOLS, DEFAULT_CODEX_PERMISSION, isCodexPermission } from "@/core/codex-permissions";

export const codexPermissions = (value: unknown) => {
  const mode = isCodexPermission(value) ? value : DEFAULT_CODEX_PERMISSION;
  const enabledTools = mode === "read" ? [...CODEX_READ_TOOLS] : [...Object.keys(TOOL_SCHEMAS), "list_open_projects"];
  return {
    mode,
    enabledTools,
    // The exec SDK cannot answer interactive approval requests. Approve the app's own
    // project-bound tools explicitly instead of asking for approval and then auto-rejecting it.
    toolPolicy: Object.fromEntries(enabledTools.map((tool) => [tool, { approval_mode: "approve" }])),
    threadOptions: {
      sandboxMode: mode === "full" ? "danger-full-access" : "read-only",
      approvalPolicy: "never",
    } satisfies Pick<ThreadOptions, "sandboxMode" | "approvalPolicy">,
  };
};
