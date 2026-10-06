"use client";

import { toast } from "sonner";
import type { Project } from "@/core/schema";
import { getProject, useProjectStore } from "../store/project-store";

/**
 * Restore points: the project as it was right before a message was sent to an
 * agent. Kept in memory for instant restores and on disk to survive reloads.
 */
const memory = new Map<string, Project>();

export const saveCheckpoint = (id: string) => {
  const project = getProject();
  memory.set(id, project);
  void fetch(`/api/projects/${project.id}/checkpoints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, project }),
  }).catch(() => {
    // Memory copy still works for this session.
  });
};

const loadCheckpoint = async (projectId: string, id: string): Promise<Project | null> => {
  const cached = memory.get(id);
  if (cached) return cached;
  const res = await fetch(`/api/projects/${projectId}/checkpoints?checkpointId=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { project: Project };
  memory.set(id, data.project);
  return data.project;
};

/** Rolls the project back to the restore point. The restore itself is one undo step. */
export const restoreCheckpoint = async (id: string) => {
  const current = getProject();
  const snapshot = await loadCheckpoint(current.id, id);
  if (!snapshot) {
    toast.error("That restore point is no longer available.");
    return false;
  }
  useProjectStore.getState().transact(
    "Restore to before this message",
    (draft) => {
      const target = structuredClone(snapshot) as Record<string, unknown>;
      const d = draft as unknown as Record<string, unknown>;
      for (const key of Object.keys(d)) if (!(key in target)) delete d[key];
      for (const [key, value] of Object.entries(target)) d[key] = value;
    },
    { source: "user" },
  );
  toast.success("Restored. Undo brings the agent's changes back.");
  return true;
};
