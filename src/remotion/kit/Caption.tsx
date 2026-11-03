import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fontStack, useFonts } from "../fonts";
import { type AccentWord, parseAccentText, RevealText } from "./RevealText";
import { clamp, ramp, rgba, useKitUnit } from "./shared";

export type CaptionVariant = "card" | "marker" | "outline" | "scrim";

export type CaptionProps = {
  /** One or two short lines; *asterisks* mark accent words, "\n" breaks lines. */
  text: string;
  /** Frames into the clip when it appears. */
  start?: number;
  /** Frames into the clip when it leaves; omit to stay. */
  exitAt?: number;
  /**
   * "card" (default): each line on a solid rounded card that wipes in (explainers, news, social).
   * "marker": text over the picture; accent words get a highlighter stroke drawn behind them.
   * "outline": heavy text with an outline (illustrated, cartoon and playful looks).
   * "scrim": plain lines over a soft dark gradient (documentary subtitles).
   */
  variant?: CaptionVariant;
  /** px at 1080p (default 46: readable on a phone). */
  size?: number;
  position?: "bottom" | "top" | "middle";
  align?: "center" | "left";
  /** Text color. */
  color?: string;
  /** Accent words; for "marker", the highlighter stroke. */
  accent?: string;
  /** The card fill ("card"), the outline ("outline"), or the text on the stroke ("marker"). */
  box?: string;
  font?: string;
  weight?: number;
  /** "scrim" only: how dark the gradient behind the text gets, 0–1 (default 0.45). */
  scrim?: number;
};

const DEFAULTS: Record<CaptionVariant, { color: string; accent: string; box: string }> = {
  card: { color: "#151a3d", accent: "#e2433b", box: "#fff4df" },
  marker: { color: "#ffffff", accent: "#ffc93c", box: "#151a3d" },
  outline: { color: "#ffffff", accent: "#ffc93c", box: "#151a3d" },
  scrim: { color: "#ffffff", accent: "#ffc93c", box: "#080818" },
};

/** Frames between lines. */
const STAGGER = 5;

/**
 * A caption designed like the rest of the film: whole lines that read in one glance (no
 * word-by-word ghosts), in the film's font and palette, inside the safe area (clear of platform UI
 * on vertical video). Pick the variant that matches the film's design language.
 */
export const Caption: React.FC<CaptionProps> = ({
  text,
  start = 0,
  exitAt,
  variant = "card",
  size = 46,
  position = "bottom",
  align = "center",
  color,
  accent,
  box,
  font = "Nunito",
  weight = 800,
  scrim = 0.45,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const u = useKitUnit();
  useFonts([{ family: font, weight }]);
  const px = size * u;
  const ink = color ?? DEFAULTS[variant].color;
  const hi = accent ?? DEFAULTS[variant].accent;
  const fill = box ?? DEFAULTS[variant].box;
  const exit = exitAt !== undefined ? ramp(frame, exitAt, 10, "ease-in") : 0;
  // Safe area: 7% from the sides; on vertical video the bottom stays clear of platform UI.
  const portrait = height > width;
  const edge = position === "bottom" ? (portrait ? height * 0.24 : 74 * u) : position === "top" ? (portrait ? height * 0.13 : 70 * u) : 0;
  const lines = parseAccentText(text);

  const word = (w: AccentWord, wi: number, line: AccentWord[], style: React.CSSProperties) => (
    <span key={wi} style={{ display: "inline-block", marginRight: wi < line.length - 1 && !line[wi + 1].glue ? "0.26em" : 0, ...style }}>
      {w.text}
    </span>
  );

  const renderLine = (line: AccentWord[], li: number) => {
    const t0 = start + li * STAGGER;
    if (variant === "card") {
      // The card wipes in from the left, the words settle into it, and it wipes out to the right.
      const k = ramp(frame, t0, 9, "smooth");
      const t = ramp(frame, t0 + 3, 9, "smooth");
      return (
        <div key={li} style={{ clipPath: `inset(-40% ${(1 - k) * 100}% -40% ${exit * 100}%)` }}>
          <span
            style={{
              background: fill,
              padding: `${0.1 * px}px ${0.42 * px}px ${0.14 * px}px`,
              borderRadius: 0.2 * px,
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
              boxShadow: `0 ${0.1 * px}px ${0.36 * px}px ${rgba("#000000", 0.22)}`,
            }}
          >
            {line.map((w, wi) =>
              word(w, wi, line, {
                color: w.accent ? hi : ink,
                opacity: t,
                transform: `translateY(${(1 - t) * 0.22}em)`,
              }),
            )}
          </span>
        </div>
      );
    }
    // marker and outline: the line rises out of a soft blur, then accent words get their treatment.
    const k = ramp(frame, t0, 12, variant === "outline" ? "overshoot" : "smooth");
    const kk = clamp(k, 0, 1);
    const outline =
      variant === "outline"
        ? [
            ...Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2;
              return `${(Math.cos(a) * 0.11 * px).toFixed(1)}px ${(Math.sin(a) * 0.11 * px).toFixed(1)}px 0 ${fill}`;
            }),
            `0 ${0.16 * px}px ${0.06 * px}px ${rgba("#000000", 0.4)}`,
          ].join(", ")
        : `0 ${0.06 * px}px ${0.4 * px}px ${rgba("#06061e", 0.75)}`;
    return (
      <div
        key={li}
        style={{
          opacity: Math.min(1, kk * 1.6) * (1 - exit),
          transform: `translateY(${(1 - k) * 0.35 + exit * 0.25}em) scale(${variant === "outline" ? 0.9 + 0.1 * k : 1})`,
          filter: kk < 1 ? `blur(${(1 - kk) * 0.08 * px}px)` : undefined,
          color: ink,
          textShadow: outline,
        }}
      >
        {line.map((w, wi) => {
          if (!w.accent) return word(w, wi, line, {});
          if (variant === "outline") return word(w, wi, line, { color: hi });
          // The highlighter is drawn behind the word just after the line lands.
          const m = ramp(frame, t0 + 8, 9, "smooth");
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: words are positional
              key={wi}
              style={{
                position: "relative",
                isolation: "isolate",
                display: "inline-block",
                marginRight: wi < line.length - 1 && !line[wi + 1].glue ? "0.26em" : 0,
                color: `color-mix(in srgb, ${fill} ${Math.round(m * 100)}%, ${ink})`,
                textShadow: m > 0.5 ? "none" : outline,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "-0.14em",
                  right: "-0.14em",
                  top: "0.1em",
                  bottom: "0.02em",
                  zIndex: -1,
                  background: hi,
                  borderRadius: "0.14em",
                  transform: `scaleX(${m}) rotate(-1.2deg)`,
                  transformOrigin: "0% 50%",
                }}
              />
              {w.text}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        justifyContent: position === "bottom" ? "flex-end" : position === "top" ? "flex-start" : "center",
        padding: `${position === "top" ? edge : 0}px 7% ${position === "bottom" ? edge : 0}px`,
      }}
    >
      {variant === "scrim" ? (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              [position === "top" ? "top" : "bottom"]: 0,
              height: "34%",
              opacity: 1 - exit,
              background: `linear-gradient(${position === "top" ? "180deg" : "0deg"}, ${rgba(fill, scrim)} 0%, ${rgba(fill, scrim * 0.45)} 45%, transparent 100%)`,
            }}
          />
          <div style={{ position: "relative" }}>
            <RevealText
              text={text}
              size={size}
              weight={weight}
              font={font}
              color={ink}
              accent={hi}
              align={align}
              mode="lines"
              start={start}
              exitAt={exitAt}
              stagger={STAGGER}
              speed={10}
              letterSpacing={-0.01}
              lineHeight={1.12}
              maxWidth={1}
              style={{ textShadow: `0 ${3 * u}px ${18 * u}px rgba(6,6,30,0.7)` }}
            />
          </div>
        </>
      ) : (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: align === "center" ? "center" : "flex-start",
            gap: variant === "card" ? 0.18 * px : 0,
            fontFamily: fontStack(font),
            fontWeight: weight,
            fontSize: px,
            lineHeight: variant === "card" ? 1.22 : 1.14,
            letterSpacing: "-0.01em",
            textAlign: align,
          }}
        >
          {lines.map(renderLine)}
        </div>
      )}
    </AbsoluteFill>
  );
};
