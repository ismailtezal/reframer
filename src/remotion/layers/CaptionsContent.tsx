import type React from "react";
import { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { findPageAt, paginateCaptions } from "../../core/captions";
import { resolveEasing } from "../../core/easing";
import type { CaptionsClip, CaptionWord } from "../../core/schema";
import { useRenderContext } from "../context";
import { fontStack, useFonts } from "../fonts";

const popEase = resolveEasing("playful");
const outEase = resolveEasing("smooth");

/** Maps a clip-local frame to caption time (ms) — follows the source clip when linked. */
export const useCaptionTimeMs = (clip: CaptionsClip, localFrame: number): number => {
  const { project } = useRenderContext();
  const { fps } = useVideoConfig();
  if (clip.timeBase === "source" && clip.sourceClipId) {
    const src = project.clips[clip.sourceClipId];
    if (src && (src.type === "video" || src.type === "audio")) {
      const absFrame = clip.start + localFrame;
      const mediaFrame = src.trimStart + (absFrame - src.start) * src.speed;
      return (mediaFrame / fps) * 1000;
    }
  }
  return (localFrame / fps) * 1000;
};

export const CaptionsContent: React.FC<{ clip: CaptionsClip; frame: number }> = ({ clip, frame }) => {
  const { style } = clip;
  useFonts([{ family: style.fontFamily, weight: style.fontWeight }]);
  const pages = useMemo(
    () => paginateCaptions(clip.words, { combineMs: style.combineMs, maxWordsPerPage: style.maxWordsPerPage }),
    [clip.words, style.combineMs, style.maxWordsPerPage],
  );
  const t = useCaptionTimeMs(clip, frame);
  const page = findPageAt(pages, t);
  if (!page) return null;

  const sinceStart = t - page.startMs;
  const pageIn = Math.min(1, sinceStart / 140);
  let pageTransform = "";
  let pageOpacity = 1;
  switch (style.animation) {
    case "pop":
      pageTransform = `scale(${0.82 + 0.18 * popEase(pageIn)})`;
      break;
    case "slide-up":
      pageTransform = `translateY(${(1 - outEase(Math.min(1, sinceStart / 220))) * 0.4}em)`;
      pageOpacity = Math.min(1, sinceStart / 160);
      break;
    case "fade":
      pageOpacity = Math.min(1, sinceStart / 200);
      break;
    default:
      break;
  }

  const shadow = style.shadow ? `${style.shadow.x}px ${style.shadow.y}px ${style.shadow.blur}px ${style.shadow.color}` : undefined;
  const emoji = style.showEmoji ? page.words.find((w) => w.emoji)?.emoji : undefined;

  const renderWord = (w: CaptionWord, i: number) => {
    const active = t >= w.startMs && t < (page.words[i + 1]?.startMs ?? page.endMs);
    const spoken = t >= w.startMs;
    const base = w.emphasis && style.emphasisColor ? style.emphasisColor : style.color;
    let color = active ? style.activeColor : base;
    let transform: string | undefined;
    let background: string | undefined;
    let opacity = 1;
    let backgroundImage: string | undefined;
    let textDecoration: React.CSSProperties = {};

    switch (style.animation) {
      case "pop": {
        if (active) {
          // Spring overshoots briefly, then settles slightly enlarged.
          const p = Math.min(1, (t - w.startMs) / 160);
          transform = `scale(${(1 + 0.1 * popEase(p)).toFixed(4)})`;
        }
        break;
      }
      case "bounce": {
        const p = Math.min(1, Math.max(0, (t - w.startMs) / 180));
        opacity = spoken ? 1 : 0;
        transform = `translateY(${(1 - popEase(p)) * -0.35}em)`;
        break;
      }
      case "karaoke": {
        const dur = Math.max(1, w.endMs - w.startMs);
        const p = Math.min(1, Math.max(0, (t - w.startMs) / dur));
        color = "transparent";
        backgroundImage = `linear-gradient(90deg, ${style.activeColor} ${(p * 100).toFixed(1)}%, ${base} ${(p * 100).toFixed(1)}%)`;
        break;
      }
      case "highlight-box":
        if (active) {
          background = style.activeBackground ?? "#7C3AED";
          color = style.activeColor;
        } else color = base;
        break;
      case "underline":
        if (active)
          textDecoration = {
            textDecorationLine: "underline",
            textDecorationThickness: "0.12em",
            textUnderlineOffset: "0.16em",
            textDecorationColor: style.activeColor,
          };
        break;
      case "typewriter":
        opacity = spoken ? 1 : 0;
        color = base;
        break;
      default:
        break;
    }

    return (
      <span
        key={`${w.startMs}-${i}`}
        style={{
          display: "inline-block",
          whiteSpace: "pre",
          color,
          transform,
          opacity,
          backgroundColor: background,
          backgroundImage,
          WebkitBackgroundClip: backgroundImage ? "text" : undefined,
          backgroundClip: backgroundImage ? "text" : undefined,
          WebkitTextFillColor: backgroundImage ? "transparent" : undefined,
          borderRadius: background ? "0.18em" : undefined,
          padding: background ? "0 0.14em" : undefined,
          margin: background ? "0 -0.04em" : undefined,
          ...textDecoration,
        }}
      >
        {w.text.trim()}
      </span>
    );
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.15em",
      }}
    >
      {emoji ? <div style={{ fontSize: style.fontSize * 1.1, lineHeight: 1 }}>{emoji}</div> : null}
      <div
        style={{
          fontFamily: fontStack(style.fontFamily),
          fontWeight: style.fontWeight,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight ?? 1.1,
          letterSpacing: style.letterSpacing !== undefined ? `${style.letterSpacing}em` : undefined,
          textTransform: style.textTransform,
          textAlign: "center",
          WebkitTextStroke: style.stroke && style.stroke.width > 0 ? `${style.stroke.width}px ${style.stroke.color}` : undefined,
          paintOrder: "stroke fill",
          textShadow: shadow,
          transform: pageTransform || undefined,
          opacity: pageOpacity,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: "0.28em",
          rowGap: "0.05em",
          backgroundColor: style.background?.color,
          padding: style.background ? style.background.padding : undefined,
          borderRadius: style.background?.radius,
        }}
      >
        {page.words.map(renderWord)}
      </div>
    </div>
  );
};
