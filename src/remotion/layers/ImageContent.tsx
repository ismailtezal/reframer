import type React from "react";
import { useEffect, useState } from "react";
import { AnimatedImage, CanvasImage, type EffectDescriptor, Img, useCurrentFrame, useDelayRender } from "remotion";
import type { ImageClip } from "../../core/schema";
import { useRenderContext } from "../context";
import { depthParallax } from "../depth-parallax";
import { MissingMedia } from "./MissingMedia";

const ANIMATED = /\.(gif|apng)$/i;

/** Loads a depth map once, holding the render until it's ready (null without one or on error). */
const useDepthImage = (src: string | undefined) => {
  const { delayRender, continueRender } = useDelayRender();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const handle = delayRender(`Loading depth map ${src}`);
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => {
      setImg(el);
      continueRender(handle);
    };
    // Without its depth map the photo still renders, just flat.
    el.onerror = () => continueRender(handle);
    el.src = src;
    return () => continueRender(handle);
  }, [src, delayRender, continueRender]);
  return src ? img : null;
};

export const ImageContent: React.FC<{
  clip: ImageClip;
  effects: EffectDescriptor<unknown>[];
  box: { width: number; height: number };
}> = ({ clip, effects, box }) => {
  const { project, resolveSrc } = useRenderContext();
  const frame = useCurrentFrame();
  const asset = project.assets[clip.assetId];
  const depthSrc = clip.parallax && asset?.analysis?.depth ? resolveSrc(asset.analysis.depth) : undefined;
  const depth = useDepthImage(depthSrc);
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
  // 2.5D parallax runs first in the canvas chain, so the clip's grade and LUT apply on top.
  const parallax =
    clip.parallax && depth && depthSrc
      ? [
          depthParallax({
            depth,
            depthKey: depthSrc,
            move: clip.parallax.move,
            amount: clip.parallax.amount,
            progress: clip.duration > 1 ? frame / (clip.duration - 1) : 0,
            imageAspect: (asset.width ?? depth.naturalWidth) / (asset.height ?? depth.naturalHeight),
            fit: clip.fit,
          }),
        ]
      : [];
  const all = [...parallax, ...effects];
  if (all.length > 0) {
    return (
      <CanvasImage src={src} width={Math.round(box.width)} height={Math.round(box.height)} fit={clip.fit} effects={all} style={fill} />
    );
  }
  return <Img src={src} style={{ ...fill, objectFit: clip.fit }} />;
};
