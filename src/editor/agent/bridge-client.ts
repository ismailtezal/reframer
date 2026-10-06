"use client";

import { useEffect } from "react";
import type { BridgeEvent } from "@/server/bridge";
import { useAgentStore } from "../store/agent-store";
import { executeTool } from "./executors";

/** External agents don't announce when they're done, so presence fades after a quiet spell. */
const EXTERNAL_IDLE_MS = 8000;

const post = (body: unknown) =>
  fetch("/api/bridge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {
    // The server restarts in dev; the next event reconnects.
  });

/**
 * Connects this editor window to the server bridge. Agent tool calls (from the
 * built-in agent, Claude Code, Codex or any MCP client) arrive here, run
 * against the live editor state — so every edit is visible as it happens —
 * and their results go back to the agent.
 */
export const useBridge = (projectId: string | undefined) => {
  useEffect(() => {
    if (!projectId) return;
    let source: EventSource | null = null;
    let clientId = "";
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const focus = () => {
      if (clientId) void post({ type: "focus", clientId });
    };

    const markExternalActivity = (agent: string) => {
      clearTimeout(idleTimers.get(agent));
      idleTimers.set(
        agent,
        setTimeout(() => {
          const s = useAgentStore.getState();
          if (s.agentName === agent && s.status !== "waiting") {
            s.setStatus("idle", null, agent);
            s.setFrame(null);
          }
        }, EXTERNAL_IDLE_MS),
      );
    };

    const handle = async (event: BridgeEvent) => {
      const agentStore = useAgentStore.getState();
      switch (event.type) {
        case "hello":
          clientId = event.clientId;
          if (document.hasFocus()) focus();
          break;
        case "presence":
          if (event.status === "idle") {
            agentStore.setStatus("idle", null, event.agent);
            agentStore.setFrame(null);
          } else {
            agentStore.setStatus(event.status, event.text ?? null, event.agent);
          }
          break;
        case "tool_call": {
          if (event.agent.external) markExternalActivity(event.agent.name);
          try {
            const result = await executeTool(event.tool, event.input, event.agent);
            await post({ type: "result", requestId: event.requestId, ok: true, result: result ?? { ok: true } });
          } catch (err) {
            await post({ type: "result", requestId: event.requestId, ok: false, error: err instanceof Error ? err.message : String(err) });
          }
          if (event.agent.external) markExternalActivity(event.agent.name);
          break;
        }
        default:
          break;
      }
    };

    const connect = () => {
      source = new EventSource(`/api/bridge?projectId=${encodeURIComponent(projectId)}`);
      source.onmessage = (message) => {
        try {
          void handle(JSON.parse(message.data) as BridgeEvent);
        } catch (err) {
          console.warn("[reframer] bad bridge event", err);
        }
      };
      source.onerror = () => {
        source?.close();
        clientId = "";
        if (!closed) retry = setTimeout(connect, 1500);
      };
    };

    connect();
    window.addEventListener("focus", focus);
    return () => {
      closed = true;
      clearTimeout(retry);
      for (const t of idleTimers.values()) clearTimeout(t);
      source?.close();
      window.removeEventListener("focus", focus);
    };
  }, [projectId]);
};
