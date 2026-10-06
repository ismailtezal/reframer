import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fontStack, useFonts } from "../../fonts";
import { progress } from "../helpers";
import { tokenizeAccent } from "../text/KineticTitle";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  text: string;
  fontFamily: string;
  fontWeight: number;
  /** px at 1080p */
  fontSize: number;
  color: string;
  highlightColor: string;
  highlightTextColor: string;
  /** 1 = full marker height, ~0.35 = low underline-style stroke. */
  barHeight: number;
  align: "left" | "center";
  letterSpacing: number;
  /** Frames between the text landing and the first sweep. */
  sweepDelay: number;
  /** Frames for a ~12 character phrase; longer phrases take proportionally longer. */
  sweepDuration: number;
  exit: boolean;
};

type Mark = { phrase: number; a: number; b: number };

const LINE_HEIGHT = 1.15;
/** Baseline height above the line box bottom (em) for Inter-like metrics at LINE_HEIGHT. */
const BASELINE = 0.21;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Runs of *accent* words become phrases; a..b are each word's character range within its phrase. */
const findMarks = (lines: ReturnType<typeof tokenizeAccent>) => {
  const marks = new Map<string, Mark>();
  const lengths: number[] = [];
  lines.forEach((line, li) => {
    let open = false;
    line.forEach((tok, ti) => {
      if (tok.space) return;
      if (!tok.accent) {
        open = false;
        return;
      }
      if (!open) lengths.push(0);
      open = true;
      const phrase = lengths.length - 1;
      const a = lengths[phrase] === 0 ? 0 : lengths[phrase] + 1;
      marks.set(`${li}-${ti}`, { phrase, a, b: a + tok.text.length });
      lengths[phrase] = a + tok.text.length;
    });
  });
  return { marks, lengths };
};

const HighlighterSweep: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([{ family: p.fontFamily, weight: p.fontWeight }]);
  // Timeline in 30 fps frames so the sweep speed is the same at any frame rate.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const lines = tokenizeAccent(p.text);
  const { marks, lengths } = findMarks(lines);
  const wordCount = lines.flat().filter((tok) => !tok.space).length;

  // Phrases sweep one after another once the text has landed.
  const durations = lengths.map((len) => p.sweepDuration * Math.min(2, Math.max(0.6, len / 12)));
  const starts: number[] = [];
  let cursor = Math.max(0, wordCount - 1) * 2 + 14 + p.sweepDelay;
  for (const d of durations) {
    starts.push(cursor);
    cursor += d + 6;
  }

  const bh = p.barHeight;
  const barBottom = BASELINE - (0.06 + 0.2 * bh);
  const barTall = 1.08 * bh;
  // Tall bars cover the glyphs, so the text flips to the ink color under the marker.
  const flip = bh >= 0.6;
  const e = p.exit ? progress(t, last - 12, 12, "ease-in") : 0;
  let wordIndex = 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: p.align === "center" ? "center" : "flex-start",
        textAlign: p.align,
        opacity: 1 - e,
        transform: `translateY(${-e * 16 * unit}px)`,
        filter: e > 0 ? `blur(${(e * 8 * unit).toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          fontFamily: fontStack(p.fontFamily),
          fontWeight: p.fontWeight,
          fontSize: p.fontSize * unit,
          lineHeight: LINE_HEIGHT,
          letterSpacing: `${p.letterSpacing}em`,
          color: p.color,
        }}
      >
        {lines.map((line, li) => (
          // `normal` white-space drops the space a wrapped line would otherwise start with.
          <div key={`line-${li}-${line.length}`} style={{ whiteSpace: "normal" }}>
            {line.map((tok, ti) => {
              const key = `${li}-${ti}`;
              if (tok.space) return <span key={key}>{tok.text}</span>;
              const q = progress(t, wordIndex++ * 2, 18, "apple");
              const blur = (1 - q) * 6 * unit;
              const enter: React.CSSProperties = {
                display: "inline-block",
                position: "relative",
                whiteSpace: "pre",
                opacity: Math.min(1, q * 1.4),
                transform: `translateY(${((1 - q) * 0.25).toFixed(4)}em)`,
                filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
              };
              const mark = marks.get(key);
              if (!mark)
                return (
                  <span key={key} style={enter}>
                    {tok.text}
                  </span>
                );
              const len = lengths[mark.phrase];
              const sweep = progress(t, starts[mark.phrase], durations[mark.phrase], "ease-in-out");
              const wq = clamp01((sweep * len - mark.a) / Math.max(1, mark.b - mark.a));
              // Bars reach a little past each word. Inside a phrase a bar spans the following space
              // (painted under the next word) and barely reaches left, so it never covers the previous
              // word's ink: every word is its own stacking context because of its transform.
              const extL = mark.a === 0 ? 0.09 : 0.04;
              const extR = mark.b === len ? 0.09 : 0.28;
              const right = `${((1 - wq) * 100).toFixed(3)}%`;
              // Only the phrase's outer ends are rounded, so joins between words stay seamless.
              const rl = mark.a === 0 ? "0.08em" : "0";
              const rr = mark.b === len ? "0.08em" : "0";
              const bar = (
                <span
                  style={{
                    position: "absolute",
                    left: `-${extL}em`,
                    right: `-${extR}em`,
                    bottom: `${barBottom}em`,
                    height: `${barTall}em`,
                    borderRadius: `${rl} ${rr} ${rr} ${rl}`,
                    backgroundColor: p.highlightColor,
                    clipPath: `inset(0% ${right} 0% 0%)`,
                  }}
                />
              );
              return (
                <span key={key} style={enter}>
                  {flip ? null : bar}
                  <span style={{ position: "relative" }}>{tok.text}</span>
                  {flip ? bar : null}
                  {flip ? (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: `-${extL}em`,
                        right: `-${extR}em`,
                        top: 0,
                        bottom: 0,
                        paddingLeft: `${extL}em`,
                        color: p.highlightTextColor,
                        clipPath: `inset(${(LINE_HEIGHT - barBottom - barTall).toFixed(4)}em ${right} ${barBottom.toFixed(4)}em 0%)`,
                      }}
                    >
                      {tok.text}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export const highlighterSweep = defineMotionComponent<Props>({
  id: "highlighter-sweep",
  name: "Highlighter sweep",
  category: "annotation",
  description:
    "Text that lands word by word, then a marker sweeps behind the *asterisked* words (Vox-style yellow by default) and flips their ink for contrast. Lower the bar height for an underline-style stroke. Use for key phrases, article quotes and claims.",
  schema: {
    text: {
      type: "text",
      label: "Text",
      default: "Most viewers decide in the *first three seconds* whether to keep watching.",
      description: "Wrap words to highlight in *asterisks*; newlines split lines",
    },
    fontFamily: { type: "font", label: "Font", default: "Inter Tight" },
    fontWeight: { type: "number", label: "Weight", default: 600, min: 100, max: 900, step: 100 },
    fontSize: { type: "number", label: "Size", default: 84, min: 24, max: 240, step: 1, description: "px at 1080p" },
    color: { type: "color", label: "Text color", default: "#F5F5F7" },
    highlightColor: { type: "color", label: "Marker", default: "#FFE14D" },
    highlightTextColor: { type: "color", label: "Text on marker", default: "#121212" },
    barHeight: { type: "number", label: "Marker height", default: 1, min: 0.2, max: 1.2, step: 0.05 },
    align: { type: "enum", label: "Align", default: "center", options: ["center", "left"] },
    letterSpacing: { type: "number", label: "Tracking (em)", default: -0.025, min: -0.1, max: 0.3, step: 0.005 },
    sweepDelay: { type: "number", label: "Sweep delay (frames)", default: 4, min: 0, max: 90, step: 1 },
    sweepDuration: { type: "number", label: "Sweep time (frames)", default: 16, min: 4, max: 60, step: 1 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    text: "Most viewers decide in the *first three seconds* whether to keep watching.",
    fontFamily: "Inter Tight",
    fontWeight: 600,
    fontSize: 84,
    color: "#F5F5F7",
    highlightColor: "#FFE14D",
    highlightTextColor: "#121212",
    barHeight: 1,
    align: "center",
    letterSpacing: -0.025,
    sweepDelay: 4,
    sweepDuration: 16,
    exit: true,
  },
  defaultDuration: 4,
  defaultBox: { x: 0.5, y: 0.5, width: 0.8, height: 0.4 },
  Component: HighlighterSweep,
  tags: ["highlight", "marker", "vox", "text", "annotation", "emphasis"],
});
