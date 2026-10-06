import { lightLeak } from "@remotion/effects/light-leak";
import type React from "react";
import { Solid, useCurrentFrame, useVideoConfig } from "remotion";
import { type AnimContext, combineAnim, evaluateClipAnimations } from "../core/animation";
import { evaluateNumber } from "../core/keyframes";
import type { Clip, Transition } from "../core/schema";
import { useRenderContext } from "./context";
import { shakeOffset, toCanvasEffects, toCssFilter } from "./effects";
import { BackgroundContent } from "./layers/BackgroundContent";
import { CaptionsContent } from "./layers/CaptionsContent";
import { ComponentContent } from "./layers/ComponentContent";
import { ImageContent } from "./layers/ImageContent";
import { ShapeContent } from "./layers/ShapeContent";
import { TextContent } from "./layers/TextContent";
import { VideoContent } from "./layers/VideoContent";
import { transitionVisual } from "./transitions";

type Props = {
  clip: Clip;
  /** Frames this clip keeps rendering past its end for the next clip's transition. */
  tail: number;
  nextTransition?: Transition;
  trackMuted: boolean;
};

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

export const ClipLayer: React.FC<Props> = ({ clip, tail, nextTransition, trackMuted }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const { resolveLut } = useRenderContext();
  const unit = Math.min(W, H) / 1080;
  const absFrame = clip.start + frame;
  const inTail = frame >= clip.duration;
  // Keyframes and animations freeze on the last frame while the clip lingers in a transition tail.
  const f = Math.min(frame, clip.duration - 1);

  const kf = clip.keyframes;
  const t = clip.transform;
  const x = evaluateNumber(kf, "x", f, t.x);
  const y = evaluateNumber(kf, "y", f, t.y);
  const width = evaluateNumber(kf, "width", f, t.width);
  const height = evaluateNumber(kf, "height", f, t.height);
  const scale = evaluateNumber(kf, "scale", f, t.scale);
  const rotation = evaluateNumber(kf, "rotation", f, t.rotation);
  const opacity = evaluateNumber(kf, "opacity", f, t.opacity);
  const kfBlur = evaluateNumber(kf, "blur", f, 0);

  const ctx: AnimContext = { unit, canvasWidth: W, canvasHeight: H, seedFrame: absFrame };
  const animations = tail > 0 ? { ...clip.animations, out: undefined } : clip.animations;
  let state = evaluateClipAnimations(animations, f, clip.duration, ctx);

  let overlay: { color: string; opacity: number } | undefined;
  let leak: number | undefined;
  if (clip.transitionIn && frame < clip.transitionIn.duration) {
    const tv = transitionVisual(clip.transitionIn, "entering", frame / clip.transitionIn.duration, { width: W, height: H }, absFrame);
    tv.state.blur *= unit;
    state = combineAnim(state, tv.state);
    overlay = tv.overlay;
    leak = tv.lightLeak;
  }
  if (inTail && nextTransition && tail > 0) {
    const tv = transitionVisual(nextTransition, "exiting", (frame - clip.duration) / tail, { width: W, height: H }, absFrame);
    tv.state.blur *= unit;
    state = combineAnim(state, tv.state);
    overlay = tv.overlay ?? overlay;
  }
  const shake = shakeOffset(clip.effects, absFrame, fps, unit);

  const sx = scale * state.scale * state.scaleX * (t.flipX ? -1 : 1);
  const sy = scale * state.scale * state.scaleY * (t.flipY ? -1 : 1);
  const transforms = [
    "translate(-50%, -50%)",
    `translate(${state.dx + shake.x}px, ${state.dy + shake.y}px)`,
    state.rotateX || state.rotateY ? `perspective(${Math.round(1400 * unit)}px)` : "",
    rotation + state.rotate ? `rotate(${rotation + state.rotate}deg)` : "",
    state.rotateX ? `rotateX(${state.rotateX}deg)` : "",
    state.rotateY ? `rotateY(${state.rotateY}deg)` : "",
    state.skewX ? `skewX(${state.skewX}deg)` : "",
    `scale(${sx}, ${sy})`,
  ]
    .filter(Boolean)
    .join(" ");

  const crop = t.crop;
  const inset = state.inset;
  let clipPath: string | undefined;
  if (state.circle !== null) {
    clipPath = `circle(${(state.circle * 72).toFixed(3)}% at 50% 50%)`;
  } else if (crop || inset) {
    const top = Math.max(crop?.top ?? 0, inset?.top ?? 0);
    const right = Math.max(crop?.right ?? 0, inset?.right ?? 0);
    const bottom = Math.max(crop?.bottom ?? 0, inset?.bottom ?? 0);
    const left = Math.max(crop?.left ?? 0, inset?.left ?? 0);
    clipPath = `inset(${pct(top)} ${pct(right)} ${pct(bottom)} ${pct(left)}${t.radius ? ` round ${t.radius}px` : ""})`;
  }

  const isCanvas = clip.type === "video" || clip.type === "image";
  const cssFilter = isCanvas ? "" : toCssFilter(clip.effects, unit);
  const blurPx = state.blur + kfBlur * unit;
  const filter = [blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : "", cssFilter].filter(Boolean).join(" ");
  const finalOpacity = Math.max(0, Math.min(1, opacity * state.opacity));
  const autoHeight = clip.type === "text";

  const canvasEffects = isCanvas ? toCanvasEffects(clip.effects, unit, resolveLut) : [];

  const box = { width: Math.max(1, width), height: Math.max(1, height) };

  let content: React.ReactNode;
  switch (clip.type) {
    case "video":
      content = <VideoContent clip={clip} muted={trackMuted} effects={canvasEffects} />;
      break;
    case "image":
      content = <ImageContent clip={clip} effects={canvasEffects} box={box} />;
      break;
    case "text":
      content = <TextContent clip={clip} frame={f} />;
      break;
    case "shape":
      content = <ShapeContent clip={clip} frame={f} box={box} />;
      break;
    case "background":
      content = <BackgroundContent clip={clip} box={box} />;
      break;
    case "captions":
      content = <CaptionsContent clip={clip} frame={frame} />;
      break;
    case "component":
      content = <ComponentContent clip={clip} frame={f} box={box} />;
      break;
    case "audio":
      return null;
  }

  const hasInner = state.innerDx !== 0 || state.innerDy !== 0;

  return (
    <>
      <div
        data-clip-id={clip.id}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: box.width,
          height: autoHeight ? "auto" : box.height,
          minHeight: autoHeight ? undefined : box.height,
          transform: transforms,
          transformOrigin: "50% 50%",
          opacity: finalOpacity,
          filter: filter || undefined,
          mixBlendMode: clip.blendMode && clip.blendMode !== "normal" ? clip.blendMode : undefined,
          clipPath,
          borderRadius: t.radius,
          overflow: t.radius || inset || hasInner ? "hidden" : undefined,
        }}
      >
        {hasInner ? (
          <div
            style={{
              width: "100%",
              height: autoHeight ? "auto" : "100%",
              transform: `translate(${pct(state.innerDx)}, ${pct(state.innerDy)})`,
            }}
          >
            {content}
          </div>
        ) : (
          content
        )}
        {overlay && overlay.opacity > 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: overlay.color,
              opacity: overlay.opacity,
            }}
          />
        ) : null}
      </div>
      {leak !== undefined ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, pointerEvents: "none" }}>
          <Solid width={W} height={H} effects={[lightLeak({ progress: leak, seed: clip.start % 7, hueShift: 0 })]} />
        </div>
      ) : null}
    </>
  );
};
