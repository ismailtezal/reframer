"use client";

import { create } from "zustand";

/**
 * Live "agent presence": what the AI is doing right now, where on the
 * timeline, and which clips it just touched. Drives the violet agent playhead,
 * clip shimmer, status chip and "follow agent" behaviour.
 */

export type PlanStep = {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  /** Optional time range the step works on (frames). */
  range?: [number, number];
};

export type ActivityItem = {
  id: string;
  /** Human-readable action, e.g. "Added title “Ship faster” at 0:02" */
  label: string;
  tool: string;
  at: number;
  clipIds: string[];
  frame?: number;
  ok: boolean;
  error?: string;
  agent: string;
};

type AgentPresence = {
  /** Who is driving: built-in agent or an external MCP agent ("Claude Code", "Codex"). */
  agentName: string | null;
  status: "idle" | "thinking" | "working" | "waiting" | "error";
  statusText: string | null;
  /** Timeline frame where the agent is currently working. */
  frame: number | null;
  /** clipId → timestamp of the last agent change (for fading highlights). */
  touched: Record<string, number>;
  plan: PlanStep[];
  activity: ActivityItem[];
  /** External MCP agents currently connected (name → last seen). */
  connected: Record<string, number>;

  setStatus: (status: AgentPresence["status"], text?: string | null, agentName?: string | null) => void;
  setFrame: (frame: number | null) => void;
  touch: (clipIds: string[]) => void;
  setPlan: (plan: PlanStep[]) => void;
  updateStep: (id: string, patch: Partial<PlanStep>) => void;
  log: (item: ActivityItem) => void;
  heartbeat: (agent: string) => void;
  reset: () => void;
};

export const useAgentStore = create<AgentPresence>()((set, get) => ({
  agentName: null,
  status: "idle",
  statusText: null,
  frame: null,
  touched: {},
  plan: [],
  activity: [],
  connected: {},

  setStatus: (status, text = null, agentName) =>
    set({ status, statusText: text, agentName: agentName === undefined ? get().agentName : agentName }),
  setFrame: (frame) => set({ frame }),
  touch: (clipIds) => {
    if (clipIds.length === 0) return;
    const now = Date.now();
    const touched = { ...get().touched };
    for (const id of clipIds) touched[id] = now;
    // Forget entries older than a minute.
    for (const [id, at] of Object.entries(touched)) if (now - at > 60_000) delete touched[id];
    set({ touched });
  },
  setPlan: (plan) => set({ plan }),
  updateStep: (id, patch) => set({ plan: get().plan.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
  log: (item) => set({ activity: [...get().activity, item].slice(-200) }),
  heartbeat: (agent) => set({ connected: { ...get().connected, [agent]: Date.now() } }),
  reset: () => set({ status: "idle", statusText: null, frame: null, plan: [] }),
}));

/** How long touched clips keep their agent glow. */
export const AGENT_GLOW_MS = 3500;
