import { Video } from "@remotion/media";
import type React from "react";
import type { EffectDescriptor } from "remotion";
import { evaluateNumber } from "../../core/keyframes";
import type { VideoClip } from "../../core/schema";
import { useRenderContext } from "../context";
import { MissingMedia } from "./MissingMedia";

/** Volume envelope shared by video and audio clips (fades × keyframes). */
export const mediaVolume = (
  clip: { volume: number; fadeIn?: number; fadeOut?: number; duration: number; keyframes?: VideoClip["keyframes"] },
  localFrame: number,
) => {
  const fadeIn = clip.fadeIn ? Math.min(1, localFrame / clip.fadeIn) : 1;
  const fadeOut = clip.fadeOut ? Math.min(1, Math.max(0, (clip.duration - localFrame) / clip.fadeOut)) : 1;
  const base = evaluateNumber(clip.keyframes, "volume", localFrame, clip.volume);
  return Math.max(0, base * fadeIn * fadeOut);
};

export const VideoContent: React.FC<{
  clip: VideoClip;
  muted: boolean;
  effects: EffectDescriptor<unknown>[];
}> = ({ clip, muted, effects }) => {
  const { project, resolveSrc } = useRenderContext();
  const asset = project.assets[clip.assetId];
  if (!asset) return <MissingMedia label={clip.name ?? "Missing video"} />;
  return (
    <Video
      src={resolveSrc(asset.src)}
      trimBefore={clip.trimStart}
      playbackRate={clip.speed}
      // Files probed without an audio track skip audio decoding entirely.
      muted={muted || clip.muted || clip.volume === 0 || asset.hasAudio === false}
      volume={(f) => mediaVolume(clip, f)}
      objectFit={clip.fit}
      effects={effects}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};
