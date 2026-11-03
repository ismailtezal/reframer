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

/** Rough width of a word in em for the caption font (bold sans averages ~0.56em a letter, caps ~0.68em). */
const wordEm = (text: string, upper: boolean, weight: number) => text.trim().length * (upper ? 0.68 : 0.56) * (weight >= 700 ? 1.06 : 1);

/**
 * Splits a page into lines like a typesetter: one line when it fits, otherwise two lines of nearly
 * equal width (never a long line over one stray word); longer pages wrap freely.
 */
const balanceLines = (words: CaptionWord[], maxEm: number, upper: boolean, weight: number): CaptionWord[][] => {
  const widths = words.map((w) => wordEm(w.text, upper, weight));
  const gap = 0.32;
  const span = (from: number, to: number) => widths.slice(from, to).reduce((a, b) => a + b, 0) + gap * Math.max(0, to - from - 1);
  if (words.length < 2 || span(0, words.length) <= maxEm) return [words];
  let best = 1;
  for (let k = 1; k < words.length; k++) {
    if (Math.max(span(0, k), span(k, words.length)) < Math.max(span(0, best), span(best, words.length))) best = k;
  }
  if (Math.max(span(0, best), span(best, words.length)) > maxEm) return [words];
  return [words.slice(0, best), words.slice(best)];
};

export const CaptionsContent: React.FC<{ clip: CaptionsClip; frame: number }> = ({ clip, frame }) => {
  const { style } = clip;
  const { width: videoWidth } = useVideoConfig();
  useFonts([
    { family: style.fontFamily, weight: style.fontWeight },
    { family: style.fontFamily, weight: Math.min(900, style.fontWeight + 100) },
  ]);
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
  // A page that leaves a pause behind it fades out instead of blinking off.
  const next = pages[pages.indexOf(page) + 1];
  if (!next || next.startMs - page.endMs > 60) pageOpacity = Math.min(1, Math.max(0, (page.endMs - t) / 110));
  switch (style.animation) {
    case "pop":
      pageTransform = `scale(${0.82 + 0.18 * popEase(pageIn)})`;
      break;
    case "slide-up":
      pageTransform = `translateY(${(1 - outEase(Math.min(1, sinceStart / 220))) * 0.4}em)`;
      pageOpacity *= Math.min(1, sinceStart / 160);
      break;
    case "fade":
      pageOpacity *= Math.min(1, sinceStart / 200);
      break;
    default:
      break;
  }

  const shadow = style.shadow ? `${style.shadow.x}px ${style.shadow.y}px ${style.shadow.blur}px ${style.shadow.color}` : undefined;
  const emoji = style.showEmoji ? page.words.find((w) => w.emoji)?.emoji : undefined;

  const renderWord = (w: CaptionWord, i: number) => {
    const active = t >= w.startMs && t < (page.words[i + 1]?.startMs ?? page.endMs);
    const spoken = t >= w.startMs;
    const emphasized = Boolean(w.emphasis && style.emphasisColor);
    const base = emphasized && style.emphasisColor ? style.emphasisColor : style.color;
    // A key word keeps its emphasis color while it's spoken too.
    let color = active && !emphasized ? style.activeColor : base;
    // The key word also stands a size and a weight above the rest: hierarchy, not just a color.
    const size = emphasized ? 1.12 : 1;
    let transform: string | undefined = emphasized ? `scale(${size})` : undefined;
    let background: string | undefined;
    let opacity = 1;
    let backgroundImage: string | undefined;
    let textDecoration: React.CSSProperties = {};

    switch (style.animation) {
      case "pop": {
        if (active) {
          // Spring overshoots briefly, then settles slightly enlarged (small enough not to eat the word gap).
          const p = Math.min(1, (t - w.startMs) / 160);
          transform = `scale(${(size * (1 + 0.07 * popEase(p))).toFixed(4)})`;
        }
        break;
      }
      case "rise": {
        // Words rise into place one after another (25 ms apart) as the page appears.
        const p = Math.min(1, Math.max(0, (sinceStart - i * 25) / 200));
        opacity = Math.min(1, p * 1.6);
        transform = `translateY(${((1 - popEase(p)) * 0.32).toFixed(3)}em) scale(${size})`;
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
          fontWeight: emphasized ? Math.min(900, style.fontWeight + 100) : undefined,
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

  // Lines balanced for the caption box (its width less the box padding).
  const boxEm = ((clip.transform?.width ?? videoWidth) * 0.94 - 2 * (style.background?.padding ?? 0)) / style.fontSize;
  const lines = balanceLines(page.words, boxEm, style.textTransform === "uppercase", style.fontWeight);

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
          flexDirection: "column",
          alignItems: "center",
          rowGap: "0.05em",
          backgroundColor: style.background?.color,
          padding: style.background ? style.background.padding : undefined,
          borderRadius: style.background?.radius,
        }}
      >
        {lines.map((line) => (
          <div
            key={line[0]?.startMs ?? 0}
            style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.32em", rowGap: "0.05em" }}
          >
            {line.map((w) => renderWord(w, page.words.indexOf(w)))}
          </div>
        ))}
      </div>
    </div>
  );
};
