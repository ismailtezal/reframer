import type React from "react";
import { AnimatedImage, CanvasImage, type EffectDescriptor, Img } from "remotion";
import type { ImageClip } from "../../core/schema";
import { useRenderContext } from "../context";
import { MissingMedia } from "./MissingMedia";

const ANIMATED = /\.(gif|apng)$/i;

export const ImageContent: React.FC<{
  clip: ImageClip;
  effects: EffectDescriptor<unknown>[];
  box: { width: number; height: number };
}> = ({ clip, effects, box }) => {
  const { project, resolveSrc } = useRenderContext();
  const asset = project.assets[clip.assetId];
  if (!asset) return <MissingMedia label={clip.name ?? "Missing image"} />;
  const src = resolveSrc(asset.src);
  const fill: React.CSSProperties = { width: "100%", height: "100%", display: "block" };

  if (asset.mimeType === "image/gif" || ANIMATED.test(asset.name)) {
    return (
      <AnimatedImage
        src={src}
        width={Math.round(box.width)}
        height={Math.round(box.height)}
        fit={clip.fit}
        effects={effects}
        style={fill}
      />
    );
  }
  if (effects.length > 0) {
    return (
      <CanvasImage src={src} width={Math.round(box.width)} height={Math.round(box.height)} fit={clip.fit} effects={effects} style={fill} />
    );
  }
  return <Img src={src} style={{ ...fill, objectFit: clip.fit }} />;
};
