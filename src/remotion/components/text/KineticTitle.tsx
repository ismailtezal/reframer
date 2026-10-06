import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fontStack, useFonts } from "../../fonts";
import { lerp, progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  text: string;
  eyebrow: string;
  subtitle: string;
  fontFamily: string;
  fontWeight: number;
  color: string;
  accentColor: string;
  accentColor2: string;
  /** px at 1080p */
  fontSize: number;
  align: "left" | "center";
  animation: "rise-blur" | "mask-up" | "pop" | "slam" | "fade";
  stagger: number;
  letterSpacing: number;
  exit: boolean;
};

type Token = { text: string; accent: boolean; space: boolean };

/** Parses `*accent words*` markup (may span several words) into word tokens. */
export const tokenizeAccent = (text: string): Token[][] =>
  text.split("\n").map((line) =>
    line
      .split(/(\*[^*]+\*)/)
      .filter((seg) => seg.length > 0)
      .flatMap((seg) => {
        const accent = seg.length > 2 && seg.startsWith("*") && seg.endsWith("*");
        const body = accent ? seg.slice(1, -1) : seg;
        return body
          .split(/(\s+)/)
          .filter((t) => t.length > 0)
          .map((t) => ({ text: t, accent: accent && !/^\s+$/.test(t), space: /^\s+$/.test(t) }));
      }),
  );

const tokenize = tokenizeAccent;

const KineticTitle: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const durationInFrames = p.durationInFrames;
  const unit = Math.min(W, H) / 1080;
  useFonts([
    { family: p.fontFamily, weight: p.fontWeight },
    { family: p.fontFamily, weight: 500 },
  ]);
  const lines = tokenize(p.text);
  const size = p.fontSize * unit;
  const exitP = p.exit ? progress(frame, durationInFrames - 12, 12, "ease-in") : 0;
  const eyebrowP = progress(frame, 0, 18, "smooth");
  let wordIndex = 0;
  const baseDelay = p.eyebrow ? 6 : 0;
  const totalWords = lines.flat().filter((t) => !t.space).length;
  const subtitleP = progress(frame, baseDelay + totalWords * p.stagger + 8, 20, "smooth");
  const gradient = `linear-gradient(100deg, ${p.accentColor}, ${p.accentColor2})`;

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
        padding: `0 ${Math.round(80 * unit)}px`,
        boxSizing: "border-box",
        opacity: 1 - exitP,
        transform: `translateY(${-exitP * 24 * unit}px)`,
        filter: exitP > 0 ? `blur(${exitP * 10 * unit}px)` : undefined,
      }}
    >
      {p.eyebrow ? (
        <div
          style={{
            fontFamily: fontStack(p.fontFamily),
            fontWeight: 500,
            fontSize: Math.max(22 * unit, size * 0.24),
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: p.accentColor,
            marginBottom: size * 0.28,
            opacity: eyebrowP,
            transform: `translateY(${(1 - eyebrowP) * 12 * unit}px)`,
          }}
        >
          {p.eyebrow}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: fontStack(p.fontFamily),
          fontWeight: p.fontWeight,
          fontSize: size,
          lineHeight: 1.04,
          letterSpacing: `${p.letterSpacing}em`,
          color: p.color,
        }}
      >
        {lines.map((line, li) => (
          <div key={`line-${li}-${line.length}`} style={{ display: "block", whiteSpace: "pre-wrap" }}>
            {line.map((tok, ti) => {
              const key = `${li}-${ti}`;
              if (tok.space) return <span key={key}>{tok.text}</span>;
              const i = wordIndex++;
              const delay = baseDelay + i * p.stagger;
              const accentStyle: React.CSSProperties = tok.accent
                ? {
                    backgroundImage: gradient,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    WebkitTextFillColor: "transparent",
                  }
                : {};
              if (p.animation === "mask-up") {
                const q = progress(frame, delay, 20, "smooth");
                return (
                  <span
                    key={key}
                    style={{
                      display: "inline-block",
                      overflow: "hidden",
                      verticalAlign: "top",
                      paddingBottom: "0.1em",
                      marginBottom: "-0.1em",
                    }}
                  >
                    <span style={{ display: "inline-block", transform: `translateY(${(1 - q) * 110}%)`, ...accentStyle }}>{tok.text}</span>
                  </span>
                );
              }
              let style: React.CSSProperties;
              switch (p.animation) {
                case "pop": {
                  const q = progress(frame, delay, 18, "playful");
                  style = { transform: `scale(${lerp(0.5, 1, q)})`, opacity: Math.min(1, q * 2.5) };
                  break;
                }
                case "slam": {
                  const q = progress(frame, delay, 10, "snappy");
                  style = {
                    transform: `scale(${lerp(2.4, 1, q)})`,
                    opacity: Math.min(1, q * 3),
                    filter: q < 1 ? `blur(${(1 - q) * 8 * unit}px)` : undefined,
                  };
                  break;
                }
                case "fade": {
                  const q = progress(frame, delay, 16, "ease-out");
                  style = { opacity: q };
                  break;
                }
                default: {
                  const q = progress(frame, delay, 22, "apple");
                  style = {
                    transform: `translateY(${(1 - q) * 0.32 * size}px)`,
                    opacity: Math.min(1, q * 1.3),
                    filter: q < 1 ? `blur(${((1 - q) * 14 * unit).toFixed(2)}px)` : undefined,
                  };
                }
              }
              return (
                <span key={key} style={{ display: "inline-block", whiteSpace: "pre", ...style, ...accentStyle }}>
                  {tok.text}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {p.subtitle ? (
        <div
          style={{
            fontFamily: fontStack(p.fontFamily),
            fontWeight: 500,
            fontSize: Math.max(30 * unit, size * 0.3),
            lineHeight: 1.35,
            color: p.color,
            opacity: subtitleP * 0.72,
            marginTop: size * 0.32,
            maxWidth: "80%",
            transform: `translateY(${(1 - subtitleP) * 14 * unit}px)`,
          }}
        >
          {p.subtitle}
        </div>
      ) : null}
    </div>
  );
};

export const kineticTitle = defineMotionComponent<Props>({
  id: "kinetic-title",
  name: "Kinetic title",
  category: "text",
  description:
    "Big headline that reveals word by word (Apple-style rise + blur by default). Wrap words in *asterisks* to paint them with the accent gradient. Optional eyebrow label and subtitle.",
  schema: {
    text: {
      type: "text",
      label: "Headline",
      default: "Make something *wonderful*",
      description: "Use *word* for accent words; newlines split lines",
    },
    eyebrow: { type: "string", label: "Eyebrow", default: "" },
    subtitle: { type: "string", label: "Subtitle", default: "" },
    fontFamily: { type: "font", label: "Font", default: "Inter Tight" },
    fontWeight: { type: "number", label: "Weight", default: 700, min: 100, max: 900, step: 100 },
    color: { type: "color", label: "Color", default: "#F5F5F7" },
    accentColor: { type: "color", label: "Accent", default: "#A78BFA" },
    accentColor2: { type: "color", label: "Accent 2", default: "#60A5FA" },
    fontSize: { type: "number", label: "Size", default: 120, min: 24, max: 400, step: 1 },
    align: { type: "enum", label: "Align", default: "center", options: ["center", "left"] },
    animation: { type: "enum", label: "Animation", default: "rise-blur", options: ["rise-blur", "mask-up", "pop", "slam", "fade"] },
    stagger: { type: "number", label: "Stagger (frames)", default: 3, min: 0, max: 20, step: 1 },
    letterSpacing: { type: "number", label: "Tracking (em)", default: -0.035, min: -0.1, max: 0.4, step: 0.005 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    text: "Make something *wonderful*",
    eyebrow: "",
    subtitle: "",
    fontFamily: "Inter Tight",
    fontWeight: 700,
    color: "#F5F5F7",
    accentColor: "#A78BFA",
    accentColor2: "#60A5FA",
    fontSize: 120,
    align: "center",
    animation: "rise-blur",
    stagger: 3,
    letterSpacing: -0.035,
    exit: true,
  },
  defaultDuration: 3.5,
  Component: KineticTitle,
  tags: ["headline", "apple", "launch", "intro"],
});
