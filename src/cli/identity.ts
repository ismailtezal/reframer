import type { Actor } from "@/core/ops";

/**
 * Who the edits come from. Agents that drive the CLI can name themselves (REFRAMER_AGENT="Claude
 * Code"), so the timeline credits their clips the way it credits MCP edits.
 */
export const CLI_NAME = process.env.REFRAMER_AGENT?.trim() || "Reframer CLI";

export const CLI_ACTOR: Actor = { kind: "agent", name: CLI_NAME };

export const CLI_META = { createdBy: "agent", agent: CLI_NAME } as const;
