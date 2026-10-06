import { Audio } from "@remotion/media";
import type React from "react";
import { useMemo } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { getNextAdjacentClip, getProjectDuration, getTransitionTail } from "../core/project-utils";
import type { AudioClip, Clip, Project, Transition } from "../core/schema";
import { ClipLayer } from "./ClipLayer";
import { RenderProvider, useRenderContext } from "./context";
import { mediaVolume } from "./layers/VideoContent";

export type ProjectCompositionProps = {
  project: Project;
  /** Absolute origin for `/api/media/...` asset paths (server renders). */
  mediaBaseUrl?: string;
  /** Editor preview mode: placeholders for missing media / errors. */
  editor?: boolean;
};

type Layer = { clip: Clip; tail: number; nextTransition?: Transition };

const useLayers = (project: Project) =>
  useMemo(() => {
    const visual: { trackId: string; muted: boolean; layers: Layer[] }[] = [];
    const audio: { clip: AudioClip; muted: boolean }[] = [];
    // Bottom track first so higher tracks paint on top (z-index is not used).
    for (const track of [...project.tracks].reverse()) {
      if (track.hidden) continue;
      const clips = Object.values(project.clips)
        .filter((c) => c.trackId === track.id && !c.hidden)
        .sort((a, b) => a.start - b.start);
      if (track.kind === "audio") {
        for (const c of clips) if (c.type === "audio") audio.push({ clip: c, muted: track.muted });
        continue;
      }
      visual.push({
        trackId: track.id,
        muted: track.muted,
        layers: clips.map((clip) => {
          const tail = getTransitionTail(project, clip);
          return { clip, tail, nextTransition: tail > 0 ? getNextAdjacentClip(project, clip)?.transitionIn : undefined };
        }),
      });
    }
    return { visual, audio };
  }, [project]);

const AudioLayer: React.FC<{ clip: AudioClip; muted: boolean }> = ({ clip, muted }) => {
  const { project, resolveSrc, duckAt } = useRenderContext();
  const asset = project.assets[clip.assetId];
  if (!asset) return null;
  return (
    <Audio
      src={resolveSrc(asset.src)}
      trimBefore={clip.trimStart}
      playbackRate={clip.speed}
      muted={muted || clip.muted || clip.volume === 0}
      volume={(f) => mediaVolume(clip, f) * (clip.duck ? duckAt(clip.start + f) : 1)}
    />
  );
};

const Layers: React.FC<{ project: Project }> = ({ project }) => {
  const { fps } = useVideoConfig();
  const { visual, audio } = useLayers(project);
  return (
    <AbsoluteFill style={{ backgroundColor: project.settings.backgroundColor, overflow: "hidden" }}>
      {visual.map((track) =>
        track.layers.map(({ clip, tail, nextTransition }) => (
          <Sequence key={clip.id} from={clip.start} durationInFrames={clip.duration + tail} premountFor={fps} name={clip.name ?? clip.type}>
            <ClipLayer clip={clip} tail={tail} nextTransition={nextTransition} trackMuted={track.muted} />
          </Sequence>
        )),
      )}
      {audio.map(({ clip, muted }) => (
        <Sequence key={clip.id} from={clip.start} durationInFrames={clip.duration} premountFor={fps} name={clip.name ?? "Audio"}>
          <AudioLayer clip={clip} muted={muted} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const ProjectComposition: React.FC<ProjectCompositionProps> = ({ project, mediaBaseUrl, editor = false }) => (
  <RenderProvider project={project} mediaBaseUrl={mediaBaseUrl} editor={editor}>
    <Layers project={project} />
  </RenderProvider>
);

/** Composition metadata derived from the project (used by the Player and the renderer). */
export const getCompositionMetadata = (project: Project) => ({
  width: project.settings.width,
  height: project.settings.height,
  fps: project.settings.fps,
  durationInFrames: getProjectDuration(project),
});
