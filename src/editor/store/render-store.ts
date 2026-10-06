"use client";

import { create } from "zustand";

/** Mirrors the server's RenderJob (src/server/render.ts). */
export type RenderJob = {
  id: string;
  projectId: string;
  projectName: string;
  presetName?: string;
  status: "queued" | "preparing" | "rendering" | "finishing" | "done" | "error" | "cancelled";
  progress: number;
  stage: string;
  fileName: string;
  outputPath: string;
  summary: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  sizeBytes?: number;
  totalFrames: number;
  renderedFrames: number;
  fps?: number;
  etaSec?: number;
  elapsedSec?: number;
  realtimeFactor?: number;
  engine?: { processes: number; tabs: number; encoder: string; gpu: string | null };
};

export type RenderCaps = { nvenc: { h264: boolean; h265: boolean }; cores: number; memoryGB: number };

type RenderStore = {
  /** This project's exports, newest first. */
  jobs: RenderJob[];
  /** The export the Export button reports on: the running one, else the next queued, else none. */
  job: RenderJob | null;
  caps: RenderCaps | null;
  add: (job: RenderJob) => void;
  /** Loads the project's queue and keeps polling while anything is running. */
  watch: (projectId: string) => void;
  loadCaps: () => void;
};

let timer: ReturnType<typeof setTimeout> | undefined;

export const isActive = (job: RenderJob | null | undefined) =>
  !!job && (job.status === "queued" || job.status === "preparing" || job.status === "rendering" || job.status === "finishing");

const current = (jobs: RenderJob[]) =>
  jobs.find((j) => j.status === "preparing" || j.status === "rendering" || j.status === "finishing") ??
  [...jobs].reverse().find((j) => j.status === "queued") ??
  null;

/** The export queue for this window, shared by the Export button and dialog. */
export const useRenderStore = create<RenderStore>()((set, get) => ({
  jobs: [],
  job: null,
  caps: null,
  add: (job) => {
    const jobs = [job, ...get().jobs.filter((j) => j.id !== job.id)];
    set({ jobs, job: current(jobs) });
  },
  watch: (projectId) => {
    clearTimeout(timer);
    const tick = async () => {
      try {
        const res = await fetch(`/api/render?projectId=${encodeURIComponent(projectId)}`);
        const { jobs } = (await res.json()) as { jobs: RenderJob[] };
        set({ jobs, job: current(jobs) });
        if (jobs.some(isActive)) timer = setTimeout(tick, 600);
      } catch {
        timer = setTimeout(tick, 2000);
      }
    };
    void tick();
  },
  loadCaps: () => {
    if (get().caps) return;
    fetch("/api/render/caps")
      .then((r) => r.json())
      .then((caps: RenderCaps) => set({ caps }))
      .catch(() => undefined);
  },
}));
