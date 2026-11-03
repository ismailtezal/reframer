import type React from "react";
import { useCurrentFrame } from "remotion";
import { fontStack, useFonts } from "../fonts";
import { clamp, ramp, useClipDuration, useKitUnit } from "./shared";

export type RevealTextProps = {
  /** Wrap words in *asterisks* to fill them with the accent. "\n" breaks lines. */
  text: string;
  /** px at 1080p. Headlines 90–140, subheads 40–56, captions ≥ 30. */
  size?: number;
  weight?: number;
  color?: string;
  /** Accent fill for *words*: a color or a CSS gradient. */
  accent?: string;
  font?: string;
  align?: "left" | "center" | "right";
  /** Frames into the clip when the first word starts. */
  start?: number;
  /** "words" (default): word by word out of a soft blur. "lines": whole lines the same way (calmer).
   * "mask": lines rise from behind a hard mask (keynote-style, best for short, big lines). */
  mode?: "words" | "lines" | "mask";
  /** Frames between words or lines (default 3 for words, 6 for lines). */
  stagger?: number;
  /** Frames each word/line takes to land (default 12: quick reveals leave few half-revealed frames). */
  speed?: number;
  /** Frames into the clip when the text starts leaving; omit to stay. */
  exitAt?: number;
  lineHeight?: number;
  letterSpacing?: number;
  /** Max width as a fraction of the clip box (default 0.86). */
  maxWidth?: number;
  style?: React.CSSProperties;
};

/** `glue`: no space before this word (punctuation right after an accent word, as in "*air*,"). */
export type AccentWord = { text: string; accent: boolean; glue?: boolean };

/** Lines (split on "\n") of words; *asterisks* mark accent words. */
export const parseAccentText = (text: string): AccentWord[][] =>
  text.split("\n").map((line) => {
    const out: AccentWord[] = [];
    let spaceBefore = true;
    for (const seg of line.split(/(\*[^*]+\*)/).filter(Boolean)) {
      const accent = seg.length > 2 && seg.startsWith("*") && seg.endsWith("*");
      const body = accent ? seg.slice(1, -1) : seg;
      body.split(/\s+/).forEach((w, i) => {
        if (w) out.push({ text: w, accent, glue: i === 0 && out.length > 0 && !spaceBefore && !/^\s/.test(body) });
      });
      spaceBefore = /\s$/.test(seg);
    }
    return out;
  });

/**
 * Keynote type: words rise out of a soft blur one by one, accent words carry a gradient, and the
 * line keeps settling (a slow 2% scale) so a held title never freezes. Sized for legibility.
 */
export const RevealText: React.FC<RevealTextProps> = ({
  text,
  size = 112,
  weight = 700,
  color = "#f5f5f7",
  accent = "linear-gradient(90deg, #ffb35c 0%, #ff6a3d 50%, #ff3d77 100%)",
  font = "Inter Tight",
  align = "center",
  start = 0,
  mode = "words",
  stagger,
  speed = 12,
  exitAt,
  lineHeight = 1.04,
  letterSpacing = -0.035,
  maxWidth = 0.86,
  style,
}) => {
  const frame = useCurrentFrame();
  const clip = useClipDuration();
  const u = useKitUnit();
  useFonts([{ family: font, weight }]);
  const lines = parseAccentText(text);
  const px = size * u;
  const settle = 1 + 0.02 * ramp(frame, start, Math.max(1, clip - start), "linear");
  const exit = exitAt !== undefined ? ramp(frame, exitAt, 14, "ease-in") : 0;
  const gradient = /gradient\(/.test(accent);
  const gap = stagger ?? (mode === "words" ? 3 : 6);
  let i = 0;
  return (
    <div
      style={{
        fontFamily: fontStack(font),
        fontWeight: weight,
        fontSize: px,
        lineHeight,
        letterSpacing: `${letterSpacing}em`,
        color,
        textAlign: align,
        maxWidth: `${maxWidth * 100}%`,
        margin: align === "center" ? "0 auto" : undefined,
        transform: `scale(${settle})`,
        transformOrigin: align === "left" ? "0% 50%" : align === "right" ? "100% 50%" : "50% 50%",
        opacity: 1 - exit,
        filter: exit > 0 ? `blur(${exit * px * 0.12}px)` : undefined,
        ...style,
      }}
    >
      {lines.map((line, li) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
        <div key={li} style={{ display: "block", whiteSpace: "nowrap" }}>
          {/* lines mode: each line rises from behind a mask that hugs the line (clips only below). */}
          <span
            style={{
              display: "inline-block",
              ...(mode === "mask" ? { clipPath: "inset(-40% -12% 0 -12%)", padding: "0 0.06em 0.32em", marginBottom: "-0.32em" } : {}),
            }}
          >
            {line.map((w, wi) => {
              // Masked lines rise fast (expo out) so few frames are caught half-revealed.
              const p =
                mode === "words"
                  ? ramp(frame, start + i++ * gap, speed, "ease-out")
                  : mode === "mask"
                    ? ramp(frame, start + li * gap, Math.round(speed * 0.8), "smooth")
                    : ramp(frame, start + li * gap, speed + 2, "ease-out");
              const k = clamp(p, 0, 1);
              return (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: words are positional
                  key={wi}
                  style={{
                    display: "inline-block",
                    marginRight: wi < line.length - 1 && !line[wi + 1].glue ? "0.24em" : 0,
                    opacity: mode === "mask" ? Math.min(1, k * 1.8) : k,
                    transform: `translateY(${(1 - k) * (mode === "mask" ? 1.15 : 0.3)}em)`,
                    filter: k < 1 && mode !== "mask" ? `blur(${(1 - k) * 0.1 * px}px)` : undefined,
                    ...(w.accent
                      ? gradient
                        ? { backgroundImage: accent, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }
                        : { color: accent }
                      : {}),
                  }}
                >
                  {w.text}
                </span>
              );
            })}
          </span>
        </div>
      ))}
    </div>
  );
};
