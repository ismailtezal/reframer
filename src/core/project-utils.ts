import type { Clip, Project, Track } from "./schema";

export const DEFAULT_EMPTY_DURATION_SECONDS = 5;

export const getClipEnd = (clip: Pick<Clip, "start" | "duration">): number => clip.start + clip.duration;

/** Composition length in frames (never 0). */
export const getProjectDuration = (project: Project): number => {
  if (project.settings.durationInFrames) return project.settings.durationInFrames;
  let end = 0;
  for (const clip of Object.values(project.clips)) {
    end = Math.max(end, getClipEnd(clip));
  }
  return Math.max(1, end || project.settings.fps * DEFAULT_EMPTY_DURATION_SECONDS);
};

export const getTrack = (project: Project, trackId: string): Track | undefined => project.tracks.find((t) => t.id === trackId);

export const getTrackIndex = (project: Project, trackId: string): number => project.tracks.findIndex((t) => t.id === trackId);

export const getTrackClips = (project: Project, trackId: string): Clip[] =>
  Object.values(project.clips)
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.start - b.start);

export const getClipsAtFrame = (project: Project, frame: number): Clip[] =>
  Object.values(project.clips).filter((c) => frame >= c.start && frame < getClipEnd(c));

export const getClipsInRange = (project: Project, start: number, end: number): Clip[] =>
  Object.values(project.clips).filter((c) => c.start < end && getClipEnd(c) > start);

/** The clip on the same track that ends exactly where `clip` starts. */
export const getPreviousAdjacentClip = (project: Project, clip: Clip): Clip | undefined => {
  let best: Clip | undefined;
  for (const other of Object.values(project.clips)) {
    if (other.id === clip.id || other.trackId !== clip.trackId) continue;
    const end = getClipEnd(other);
    if (Math.abs(end - clip.start) <= 1 && other.start < clip.start) {
      if (!best || other.start > best.start) best = other;
    }
  }
  return best;
};

/** The clip on the same track that starts exactly where `clip` ends. */
export const getNextAdjacentClip = (project: Project, clip: Clip): Clip | undefined => {
  const end = getClipEnd(clip);
  return Object.values(project.clips).find((o) => o.id !== clip.id && o.trackId === clip.trackId && Math.abs(o.start - end) <= 1);
};

/** Frames a clip borrows past its end because the next clip transitions over it. */
export const getTransitionTail = (project: Project, clip: Clip): number => {
  const next = getNextAdjacentClip(project, clip);
  return next?.transitionIn ? Math.min(next.transitionIn.duration, next.duration) : 0;
};

export const isTrackEditable = (project: Project, trackId: string): boolean => {
  const track = getTrack(project, trackId);
  return !!track && !track.locked;
};

/** Every frame where any clip starts or ends — used for snapping and "next edit". */
export const getEditPoints = (project: Project): number[] => {
  const points = new Set<number>([0]);
  for (const clip of Object.values(project.clips)) {
    points.add(clip.start);
    points.add(getClipEnd(clip));
  }
  return [...points].sort((a, b) => a - b);
};

export const getCanvasUnit = (project: Project): number => Math.min(project.settings.width, project.settings.height) / 1080;

/** Returns true if [start, end) on `trackId` is free (ignoring `ignoreIds`). */
export const isRangeFree = (
  project: Project,
  trackId: string,
  start: number,
  end: number,
  ignoreIds: ReadonlySet<string> = new Set(),
): boolean =>
  !Object.values(project.clips).some((c) => c.trackId === trackId && !ignoreIds.has(c.id) && c.start < end && getClipEnd(c) > start);

export const describeAspect = (width: number, height: number): string => {
  const ratio = width / height;
  const known: [number, string][] = [
    [16 / 9, "16:9"],
    [9 / 16, "9:16"],
    [1, "1:1"],
    [4 / 5, "4:5"],
    [5 / 4, "5:4"],
    [4 / 3, "4:3"],
    [21 / 9, "21:9"],
    [2.39, "2.39:1"],
  ];
  for (const [value, label] of known) {
    if (Math.abs(ratio - value) < 0.01) return label;
  }
  return `${width}×${height}`;
};
