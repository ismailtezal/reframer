"use client";

import { createContext, useContext } from "react";
import { getClipEnd } from "@/core/project-utils";
import type { Project } from "@/core/schema";

export const HEADER_WIDTH = 152;
export const RULER_HEIGHT = 28;
export const TRACK_HEIGHT = { visual: 52, audio: 40 } as const;
/** Stacking inside the scroll area: clips < playhead < track headers < ruler. */
export const Z = {
  snap: 22,
  agentPlayhead: 24,
  playhead: 25,
  header: 28,
  ruler: 30,
  corner: 32,
} as const;
export const SNAP_THRESHOLD_PX = 8;

export type TimelineGeometry = {
  fps: number;
  /** pixels per frame */
  ppf: number;
  durationInFrames: number;
  contentWidth: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

export const TimelineContext = createContext<TimelineGeometry | null>(null);

export const useTimeline = () => {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error("TimelineContext missing");
  return ctx;
};

export const frameToX = (frame: number, ppf: number) => frame * ppf;
export const xToFrame = (x: number, ppf: number) => Math.max(0, Math.round(x / ppf));

/** Candidate frames clips snap to: playhead, other clip edges, markers, 0. */
export const snapPoints = (project: Project, playhead: number, ignore: ReadonlySet<string>): number[] => {
  const pts = new Set<number>([0, playhead]);
  for (const c of Object.values(project.clips)) {
    if (ignore.has(c.id)) continue;
    pts.add(c.start);
    pts.add(getClipEnd(c));
  }
  for (const m of project.markers) pts.add(m.frame);
  return [...pts];
};

/** Snaps any of `edges` to the nearest point within the pixel threshold. Returns the delta to apply. */
export const snapDelta = (edges: number[], points: number[], ppf: number): { delta: number; at: number | null } => {
  let best: { delta: number; at: number | null; dist: number } = {
    delta: 0,
    at: null,
    dist: Number.POSITIVE_INFINITY,
  };
  for (const e of edges) {
    for (const p of points) {
      const dist = Math.abs(p - e) * ppf;
      if (dist < SNAP_THRESHOLD_PX && dist < best.dist) best = { delta: p - e, at: p, dist };
    }
  }
  return { delta: best.delta, at: best.at };
};

/** Picks ruler tick spacing (in frames) that keeps labels ~80px apart, with 4–5 minor ticks between. */
export const rulerStep = (ppf: number, fps: number): { major: number; minor: number } => {
  const half = Math.round(fps / 2);
  const candidates = [1, 2, 5, 10, half, fps, fps * 2, fps * 5, fps * 10, fps * 15, fps * 30, fps * 60, fps * 120, fps * 300];
  const major = candidates.find((c) => c * ppf >= 80) ?? fps * 600;
  // Minor subdivisions (seconds) for each major step of one second or more.
  const SUBDIVIDE: Record<number, number> = {
    1: 1 / 6,
    2: 0.5,
    5: 1,
    10: 2,
    15: 5,
    30: 5,
    60: 10,
    120: 30,
    300: 60,
    600: 120,
  };
  let minor: number;
  if (major <= 2) minor = 1;
  else if (major < fps) minor = major === half ? half / 3 : major / 5;
  else minor = (SUBDIVIDE[major / fps] ?? major / fps / 5) * fps;
  return { major, minor: Math.max(1, Math.round(minor)) };
};
