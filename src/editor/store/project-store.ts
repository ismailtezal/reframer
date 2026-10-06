"use client";

import { applyPatches, enablePatches, type Patch, produceWithPatches, setAutoFreeze } from "immer";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Actor } from "@/core/ops";
import type { Project } from "@/core/schema";

enablePatches();
// The Remotion Player and agents read the project frequently; freezing every
// produced object costs more than it protects.
setAutoFreeze(false);

export type HistorySource = "user" | "ai" | "agent" | "system";

export type HistoryEntry = {
  id: number;
  label: string;
  source: HistorySource;
  /** Agent display name for agent/ai edits. */
  agent?: string;
  turnId?: string;
  patches: Patch[];
  inverse: Patch[];
  at: number;
  mergeKey?: string;
  /** Clip ids touched by this entry (for highlighting & "jump to change"). */
  clipIds: string[];
};

export type TransactOptions = {
  source?: HistorySource;
  actor?: Actor;
  turnId?: string;
  /** Consecutive edits with the same key within 1.2s merge into one undo step. */
  mergeKey?: string;
  /** Skip history entirely (e.g. loading). */
  silent?: boolean;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type ProjectStore = {
  project: Project | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  saveState: SaveState;
  lastSavedAt: number | null;
  /** Increments on every change — cheap dependency for effects. */
  revision: number;

  load: (project: Project) => void;
  transact: <T>(label: string, recipe: (draft: Project) => T, opts?: TransactOptions) => T;
  undo: () => void;
  redo: () => void;
  setSaveState: (s: SaveState, at?: number) => void;
};

let entryId = 0;

const clipIdsFromPatches = (patches: Patch[]): string[] => {
  const ids = new Set<string>();
  for (const p of patches) {
    if (p.path[0] === "clips" && typeof p.path[1] === "string") ids.add(p.path[1]);
  }
  return [...ids];
};

export const useProjectStore = create<ProjectStore>()(
  subscribeWithSelector((set, get) => ({
    project: null,
    past: [],
    future: [],
    saveState: "idle",
    lastSavedAt: null,
    revision: 0,

    load: (project) => set({ project, past: [], future: [], saveState: "saved", revision: get().revision + 1 }),

    transact: (label, recipe, opts = {}) => {
      const { project, past } = get();
      if (!project) throw new Error("No project loaded");
      let result: ReturnType<typeof recipe> | undefined;
      const [next, patches, inverse] = produceWithPatches(project, (draft) => {
        result = recipe(draft as Project);
      });
      if (patches.length === 0) return result as ReturnType<typeof recipe>;
      if (opts.silent) {
        set({ project: next, revision: get().revision + 1, saveState: "dirty" });
        return result as ReturnType<typeof recipe>;
      }
      const source: HistorySource = opts.source ?? (opts.actor ? (opts.actor.kind === "user" ? "user" : opts.actor.kind) : "user");
      const now = Date.now();
      const last = past[past.length - 1];
      const entry: HistoryEntry = {
        id: ++entryId,
        label,
        source,
        agent: opts.actor?.name,
        turnId: opts.turnId ?? opts.actor?.turnId,
        patches,
        inverse,
        at: now,
        mergeKey: opts.mergeKey,
        clipIds: clipIdsFromPatches(patches),
      };
      let nextPast: HistoryEntry[];
      if (last && opts.mergeKey && last.mergeKey === opts.mergeKey && now - last.at < 1200) {
        nextPast = [
          ...past.slice(0, -1),
          {
            ...last,
            patches: [...last.patches, ...patches],
            inverse: [...inverse, ...last.inverse],
            at: now,
            clipIds: [...new Set([...last.clipIds, ...entry.clipIds])],
          },
        ];
      } else {
        nextPast = [...past, entry].slice(-300);
      }
      set({ project: next, past: nextPast, future: [], revision: get().revision + 1, saveState: "dirty" });
      return result as ReturnType<typeof recipe>;
    },

    undo: () => {
      const { project, past, future } = get();
      const entry = past[past.length - 1];
      if (!project || !entry) return;
      set({
        project: applyPatches(project, entry.inverse),
        past: past.slice(0, -1),
        future: [entry, ...future],
        revision: get().revision + 1,
        saveState: "dirty",
      });
    },

    redo: () => {
      const { project, past, future } = get();
      const entry = future[0];
      if (!project || !entry) return;
      set({
        project: applyPatches(project, entry.patches),
        past: [...past, entry],
        future: future.slice(1),
        revision: get().revision + 1,
        saveState: "dirty",
      });
    },

    setSaveState: (s, at) => set({ saveState: s, lastSavedAt: at ?? get().lastSavedAt }),
  })),
);

/** Non-hook accessors for event handlers and tool executors. */
export const getProject = (): Project => {
  const p = useProjectStore.getState().project;
  if (!p) throw new Error("No project loaded");
  return p;
};

export const transact = <T>(label: string, recipe: (draft: Project) => T, opts?: TransactOptions): T =>
  useProjectStore.getState().transact(label, recipe, opts);
