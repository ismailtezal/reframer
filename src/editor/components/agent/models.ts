"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Mirrors the server's ModelInfo (src/server/agent/models.ts). */
export type ModelOption = {
  ref: string;
  provider: string;
  providerName: string;
  id: string;
  name: string;
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
  efforts?: string[];
  defaultEffort?: string;
  description?: string;
  context?: number;
  kind: "api" | "custom" | "harness";
};

type HarnessInfo = { enabled: boolean; executable?: string; detected: string | null };

type ModelsResponse = {
  models: ModelOption[];
  defaultModel?: string;
  favorites: string[];
  harnesses: { claudeCode: HarnessInfo; codex: HarnessInfo };
};

type ModelStore = {
  models: ModelOption[];
  loaded: boolean;
  loading: boolean;
  harnesses: ModelsResponse["harnesses"] | null;
  /** The model the user picked (persisted per machine). */
  selected: string | null;
  /** Thinking effort picked per model ref (persisted), like the Claude Code and Codex apps. */
  efforts: Record<string, string>;
  /** Last effort picked before per-model efforts existed; used as a fallback. */
  effort: string;
  refresh: () => Promise<void>;
  select: (ref: string) => void;
  /** Sets the effort for the selected model. */
  setEffort: (effort: string) => void;
};

/** Effort levels a model offers (or a sensible default set). */
export const effortLevels = (model: ModelOption) => (model.efforts?.length ? model.efforts : ["low", "medium", "high"]);

/** The effort that applies to a model: the user's pick for it, else the model's default. */
export const effortFor = (state: Pick<ModelStore, "efforts" | "effort">, model: ModelOption) => {
  const levels = effortLevels(model);
  const picked = state.efforts[model.ref];
  if (picked && levels.includes(picked)) return picked;
  if (model.defaultEffort && levels.includes(model.defaultEffort)) return model.defaultEffort;
  if (levels.includes(state.effort)) return state.effort;
  return levels.includes("medium") ? "medium" : levels[0];
};

export const EFFORT_LABELS: Record<string, string> = {
  none: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
  ultra: "Ultra",
};

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      models: [],
      loaded: false,
      loading: false,
      harnesses: null,
      selected: null,
      efforts: {},
      effort: "medium",
      refresh: async () => {
        if (get().loading) return;
        set({ loading: true });
        try {
          const res = await fetch("/api/models");
          const data = (await res.json()) as ModelsResponse;
          const selected = get().selected;
          const stillThere = selected && data.models.some((m) => m.ref === selected);
          set({
            models: data.models,
            harnesses: data.harnesses,
            loaded: true,
            selected: stillThere
              ? selected
              : data.defaultModel && data.models.some((m) => m.ref === data.defaultModel)
                ? data.defaultModel
                : (data.models[0]?.ref ?? null),
          });
        } catch {
          set({ loaded: true });
        } finally {
          set({ loading: false });
        }
      },
      select: (ref) => {
        set({ selected: ref });
        void fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultModel: ref }),
        });
      },
      setEffort: (effort) => {
        const ref = get().selected;
        set((s) => ({ effort, efforts: ref ? { ...s.efforts, [ref]: effort } : s.efforts }));
      },
    }),
    { name: "reframer-model", partialize: (s) => ({ selected: s.selected, efforts: s.efforts, effort: s.effort }) },
  ),
);

/** Loads the model list once per editor session. */
export const useModels = () => {
  const loaded = useModelStore((s) => s.loaded);
  useEffect(() => {
    if (!loaded) void useModelStore.getState().refresh();
  }, [loaded]);
  return useModelStore();
};

export const selectedModel = () => {
  const { models, selected } = useModelStore.getState();
  return models.find((m) => m.ref === selected) ?? null;
};
