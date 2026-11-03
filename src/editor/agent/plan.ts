"use client";

import type { UIMessage } from "ai";
import type { PlanOutcome, PlanStep } from "../store/agent-store";

/**
 * The agent's plan as a pure function of its tool calls (set_plan, update_plan,
 * or Codex's own todo list), so a chat reopened later shows the plan it ended
 * with, and a turn that ends settles every step instead of leaving one spinning.
 */

type SetPlanInput = { steps?: { title: string; rangeSec?: [number, number] }[] };
type UpdatePlanInput = { index?: number; status?: PlanStep["status"] };
type CodexPlan = { steps?: { title: string; done: boolean }[] };

export const stepsFromSetPlan = (input: SetPlanInput, fps: number): PlanStep[] =>
  (input.steps ?? []).map((s, i) => ({
    id: `step-${i}`,
    title: s.title,
    status: i === 0 ? "running" : "pending",
    range: s.rangeSec ? [Math.max(0, Math.round(s.rangeSec[0] * fps)), Math.max(0, Math.round(s.rangeSec[1] * fps))] : undefined,
  }));

/** One update_plan call: a finished step hands "running" to the next pending one. */
export const applyStepUpdate = (plan: PlanStep[], index: number, status: PlanStep["status"]): PlanStep[] => {
  if (!plan[index]) return plan;
  const next = plan.map((s, i) => (i === index ? { ...s, status } : s));
  if (status === "done" && next[index + 1]?.status === "pending") next[index + 1] = { ...next[index + 1], status: "running" };
  return next;
};

export const stepsFromCodexPlan = (data: CodexPlan): PlanStep[] => {
  const steps = data.steps ?? [];
  const current = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({ id: `step-${i}`, title: s.title, status: s.done ? "done" : i === current ? "running" : "pending" }));
};

/** Every open step closes when the turn ends: done when it finished normally, otherwise left to pick up later. */
export const settleSteps = (plan: PlanStep[], outcome: Exclude<PlanOutcome, null>): PlanStep[] =>
  plan.map((s) => {
    if (s.status !== "running" && s.status !== "pending") return s;
    if (outcome === "done") return { ...s, status: "done" };
    if (outcome === "error" && s.status === "running") return { ...s, status: "failed" };
    return { ...s, status: "pending" };
  });

const toolOf = (part: UIMessage["parts"][number]) => {
  const p = part as { type: string; toolName?: string; input?: unknown; state?: string };
  const name = p.type === "dynamic-tool" ? p.toolName : p.type.startsWith("tool-") ? p.type.slice(5) : undefined;
  // Calls that failed or never finished streaming their input never changed the plan.
  return name && p.state !== "input-streaming" && p.state !== "output-error" ? { name, input: p.input } : null;
};

/** The plan from the last assistant message, if that message worked on one. */
export const planFromMessages = (messages: UIMessage[], fps: number): PlanStep[] => {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return [];
  let plan: PlanStep[] = [];
  let touched = false;
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    for (const part of m.parts) {
      if (part.type === "data-plan") {
        plan = stepsFromCodexPlan(part.data as CodexPlan);
        touched = m === lastAssistant;
        continue;
      }
      const tool = toolOf(part);
      if (tool?.name === "set_plan") {
        plan = stepsFromSetPlan((tool.input ?? {}) as SetPlanInput, fps);
        touched = m === lastAssistant;
      } else if (tool?.name === "update_plan") {
        const { index, status } = (tool.input ?? {}) as UpdatePlanInput;
        if (typeof index === "number" && status) plan = applyStepUpdate(plan, index, status);
        if (m === lastAssistant) touched = true;
      }
    }
  }
  return touched ? plan : [];
};
