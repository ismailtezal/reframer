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
  effort: string;
  refresh: () => Promise<void>;
  select: (ref: string) => void;
  setEffort: (effort: string) => void;
};

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      models: [],
      loaded: false,
      loading: false,
      harnesses: null,
      selected: null,
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
      setEffort: (effort) => set({ effort }),
    }),
    { name: "reframer-model", partialize: (s) => ({ selected: s.selected, effort: s.effort }) },
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
