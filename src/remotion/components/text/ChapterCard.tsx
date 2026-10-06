import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fontStack, useFonts } from "../../fonts";
import { progress, splitWords } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  number: string;
  label: string;
  title: string;
  subtitle: string;
  fontFamily: string;
  /** Title size in px at 1080p; the number is 1.3x. */
  fontSize: number;
  color: string;
  numberColor: string;
  accentColor: string;
  align: "left" | "center";
  stagger: number;
  exit: boolean;
};

/** Overflow mask with a little extra room (in em of the masked text) for descenders and accents. */
const maskStyle: React.CSSProperties = {
  overflow: "hidden",
  verticalAlign: "top",
  padding: "0.06em 0 0.14em",
  margin: "-0.06em 0 -0.14em",
};

const Mask: React.FC<{ size: number; children: React.ReactNode }> = ({ size, children }) => (
  <div style={{ ...maskStyle, fontSize: size }}>{children}</div>
);

const WordMask: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ ...maskStyle, display: "inline-block" }}>{children}</span>
);

const ChapterCard: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([
    { family: p.fontFamily, weight: 200 },
    { family: p.fontFamily, weight: 500 },
    { family: p.fontFamily, weight: 600 },
    { family: p.fontFamily, weight: 700 },
  ]);
  // Timeline in 30 fps frames so the choreography feels the same at any frame rate.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const s = p.stagger;
  const size = p.fontSize * unit;
  const numberSize = size * 1.3;
  const labelSize = Math.max(28 * unit, size * 0.22);
  const center = p.align === "center";
  const font = fontStack(p.fontFamily);
  const words = splitWords(p.title);

  // Rows leave upward through their masks in reading order: number, label, rule, title, subtitle.
  const exitAt = (row: number) => (p.exit ? progress(t, last - 9 - (4 - row) * 1.25, 9, "ease-in") : 0);
  const slide = (delay: number, row: number) => {
    const q = progress(t, delay, 26, "apple");
    return `translateY(${((1 - q) * 112 - exitAt(row) * 112).toFixed(3)}%)`;
  };
  const ruleIn = progress(t, 2 * s, 28, "smooth");
  const ruleOut = exitAt(2);
  const titleDelay = 3 * s;
  const subtitleDelay = titleDelay + words.filter((w) => !/^\s+$/.test(w)).length * s + 4;
  let wordIndex = 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: `0 ${Math.min(120 * unit, p.width * 0.08)}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: center ? "center" : "flex-start",
        textAlign: center ? "center" : "left",
        fontFamily: font,
      }}
    >
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: center ? "center" : "flex-start", maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 0.16 * numberSize }}>
          {p.number ? (
            <Mask size={numberSize}>
              <div
                style={{
                  fontSize: numberSize,
                  fontWeight: 200,
                  lineHeight: 0.9,
                  letterSpacing: "-0.045em",
                  fontVariantNumeric: "tabular-nums",
                  color: p.numberColor,
                  transform: slide(0, 0),
                }}
              >
                {p.number}
              </div>
            </Mask>
          ) : null}
          {p.label ? (
            <div style={{ marginTop: Math.max(0, numberSize * 0.09 - labelSize * 0.24) }}>
              <Mask size={labelSize}>
                <div
                  style={{
                    fontSize: labelSize,
                    fontWeight: 600,
                    lineHeight: 1.2,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: p.accentColor,
                    transform: slide(s, 1),
                  }}
                >
                  {p.label}
                </div>
              </Mask>
            </div>
          ) : null}
        </div>
        <div
          style={{
            alignSelf: "stretch",
            height: Math.max(1, 2 * unit),
            margin: `${0.22 * size}px 0 ${0.3 * size}px`,
            backgroundColor: p.accentColor,
            opacity: 0.9,
            transformOrigin: ruleOut > 0 ? (center ? "50% 50%" : "100% 50%") : center ? "50% 50%" : "0% 50%",
            transform: `scaleX(${(ruleOut > 0 ? 1 - ruleOut : ruleIn).toFixed(4)})`,
          }}
        />
        <div
          style={{
            fontSize: size,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.035em",
            color: p.color,
            whiteSpace: "normal",
          }}
        >
          {words.map((w, i) => {
            const key = `${i}-${w}`;
            if (/^\s+$/.test(w)) return <span key={key}>{w}</span>;
            const delay = titleDelay + wordIndex++ * s;
            return (
              <WordMask key={key}>
                <span style={{ display: "inline-block", whiteSpace: "pre", transform: slide(delay, 3) }}>{w}</span>
              </WordMask>
            );
          })}
        </div>
        {p.subtitle ? (
          <div style={{ marginTop: 0.26 * size, maxWidth: "90%" }}>
            <Mask size={Math.max(36 * unit, size * 0.3)}>
              <div
                style={{
                  fontSize: Math.max(36 * unit, size * 0.3),
                  fontWeight: 500,
                  lineHeight: 1.3,
                  letterSpacing: "-0.01em",
                  color: p.color,
                  opacity: 0.62,
                  transform: slide(subtitleDelay, 4),
                }}
              >
                {p.subtitle}
              </div>
            </Mask>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const chapterCard = defineMotionComponent<Props>({
  id: "chapter-card",
  name: "Chapter card",
  category: "text",
  description:
    "Editorial section opener: thin oversized number, small label, a hairline that draws on and a big bold title, all revealed through masks (and masked out on exit). Use between sections of explainers, tutorials or documentaries.",
  schema: {
    number: { type: "string", label: "Number", default: "02" },
    label: { type: "string", label: "Label", default: "Chapter" },
    title: { type: "text", label: "Title", default: "The turning point" },
    subtitle: { type: "string", label: "Subtitle", default: "" },
    fontFamily: { type: "font", label: "Font", default: "Inter Tight" },
    fontSize: { type: "number", label: "Size", default: 128, min: 40, max: 300, step: 1, description: "Title size in px at 1080p" },
    color: { type: "color", label: "Title color", default: "#F5F5F7" },
    numberColor: { type: "color", label: "Number color", default: "#F5F5F7" },
    accentColor: { type: "color", label: "Accent", default: "#FF7A45" },
    align: { type: "enum", label: "Align", default: "left", options: ["left", "center"] },
    stagger: { type: "number", label: "Stagger (frames)", default: 3, min: 0, max: 12, step: 1 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    number: "02",
    label: "Chapter",
    title: "The turning point",
    subtitle: "",
    fontFamily: "Inter Tight",
    fontSize: 128,
    color: "#F5F5F7",
    numberColor: "#F5F5F7",
    accentColor: "#FF7A45",
    align: "left",
    stagger: 3,
    exit: true,
  },
  defaultDuration: 3.5,
  Component: ChapterCard,
  tags: ["chapter", "section", "title card", "editorial", "documentary"],
});
