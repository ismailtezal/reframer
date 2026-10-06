"use client";

import { create } from "zustand";

/** Mirrors the server's RenderJob (src/server/render.ts). */
export type RenderJob = {
  id: string;
  projectId: string;
  status: "preparing" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  stage: string;
  fileName: string;
  outputPath: string;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  sizeBytes?: number;
};

type RenderStore = {
  job: RenderJob | null;
  setJob: (job: RenderJob | null) => void;
  /** Polls the current job until it settles. */
  watch: (jobId: string) => void;
};

let timer: ReturnType<typeof setTimeout> | undefined;

export const isActive = (job: RenderJob | null) => !!job && (job.status === "preparing" || job.status === "rendering");

/** The current export for this window, shared by the Export button and dialog. */
export const useRenderStore = create<RenderStore>()((set, get) => ({
  job: null,
  setJob: (job) => set({ job }),
  watch: (jobId) => {
    clearTimeout(timer);
    const tick = async () => {
      try {
        const res = await fetch(`/api/render?jobId=${encodeURIComponent(jobId)}`);
        const { job } = (await res.json()) as { job: RenderJob | null };
        if (job && get().job?.id === jobId) set({ job });
        if (job && isActive(job)) timer = setTimeout(tick, 700);
      } catch {
        timer = setTimeout(tick, 2000);
      }
    };
    void tick();
  },
}));
