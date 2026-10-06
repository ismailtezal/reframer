import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { withAlpha } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { lerp, progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";
import { tokenizeAccent } from "./KineticTitle";

type Props = {
  quote: string;
  author: string;
  role: string;
  serif: boolean;
  serifFont: string;
  sansFont: string;
  /** Quote size in px at 1080p (serif); sans is set slightly smaller to match optically. */
  fontSize: number;
  color: string;
  accentColor: string;
  align: "left" | "center";
  card: boolean;
  cardColor: string;
  cardOpacity: number;
  stagger: number;
  exit: boolean;
};

const QuoteCard: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const quoteFamily = p.serif ? p.serifFont : p.sansFont;
  const quoteWeight = p.serif ? 400 : 500;
  useFonts([
    // The quote mark is always set in the serif: curly marks read better than straight sans ones.
    { family: p.serifFont, weight: 400 },
    ...(p.serif ? [{ family: p.serifFont, weight: 400, italic: true }] : [{ family: p.sansFont, weight: 500 }]),
    { family: p.sansFont, weight: 400 },
    { family: p.sansFont, weight: 600 },
  ]);
  // Timeline in 30 fps frames so the choreography feels the same at any frame rate.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const size = p.fontSize * unit * (p.serif ? 1 : 0.86);
  const center = p.align === "center";
  const lines = tokenizeAccent(p.quote);
  const wordCount = lines.flat().filter((tok) => !tok.space).length;

  const cardIn = progress(t, 0, 26, "apple");
  const markIn = progress(t, 4, 22, "apple");
  const firstWord = 9;
  const authorDelay = firstWord + wordCount * p.stagger + 8;
  const ruleIn = progress(t, authorDelay, 22, "smooth");
  const rise = (delay: number): React.CSSProperties => {
    const q = progress(t, delay, 20, "apple");
    return { opacity: q, transform: `translateY(${(1 - q) * 14 * unit}px)` };
  };
  const e = p.exit ? progress(t, last - 12, 12, "ease-in") : 0;
  let wordIndex = 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: center ? "center" : "flex-start",
          textAlign: center ? "center" : "left",
          padding: p.card ? `${76 * unit}px ${84 * unit}px ${72 * unit}px` : 0,
          borderRadius: 44 * unit,
          backgroundColor: p.card ? withAlpha(p.cardColor, p.cardOpacity) : undefined,
          backgroundImage: p.card ? "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%)" : undefined,
          border: p.card ? `${Math.max(1, unit)}px solid rgba(255,255,255,0.09)` : undefined,
          boxShadow: p.card ? `0 ${36 * unit}px ${90 * unit}px rgba(0,0,0,0.35)` : undefined,
          opacity: Math.min(1, cardIn * 1.4) * (1 - e),
          transform: `translateY(${((1 - cardIn) * 30 + e * 14) * unit}px) scale(${lerp(0.975, 1, cardIn) - e * 0.02})`,
        }}
      >
        <div
          style={{
            fontFamily: fontStack(p.serifFont),
            fontWeight: 400,
            fontSize: p.fontSize * unit * 3,
            lineHeight: 1,
            height: p.fontSize * unit * 1.15,
            color: p.accentColor,
            opacity: markIn,
            transformOrigin: center ? "50% 30%" : "0% 30%",
            transform: `translateY(${(1 - markIn) * 18 * unit}px) scale(${lerp(0.7, 1, markIn)})`,
          }}
        >
          {"“"}
        </div>
        <div
          style={{
            fontFamily: fontStack(quoteFamily),
            fontWeight: quoteWeight,
            fontSize: size,
            lineHeight: p.serif ? 1.12 : 1.2,
            letterSpacing: p.serif ? "-0.012em" : "-0.025em",
            color: p.color,
            maxWidth: "26em",
            textWrap: "pretty",
          }}
        >
          {lines.map((line, li) => (
            // `normal` white-space drops the space a wrapped line would otherwise start with.
            <div key={`line-${li}-${line.length}`} style={{ whiteSpace: "normal" }}>
              {line.map((tok, ti) => {
                const key = `${li}-${ti}`;
                if (tok.space) return <span key={key}>{tok.text}</span>;
                const q = progress(t, firstWord + wordIndex++ * p.stagger, 22, "apple");
                const blur = (1 - q) * 7 * unit;
                return (
                  <span
                    key={key}
                    style={{
                      display: "inline-block",
                      whiteSpace: "pre",
                      opacity: Math.min(1, q * 1.4),
                      transform: `translateY(${((1 - q) * 0.3).toFixed(4)}em)`,
                      filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
                      ...(tok.accent ? { color: p.accentColor, fontStyle: p.serif ? "italic" : undefined } : null),
                    }}
                  >
                    {tok.text}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        {p.author || p.role ? (
          <div
            style={{
              marginTop: 52 * unit,
              display: "flex",
              flexDirection: "column",
              alignItems: center ? "center" : "flex-start",
              fontFamily: fontStack(p.sansFont),
            }}
          >
            <div
              style={{
                width: 48 * unit,
                height: Math.max(1, 2 * unit),
                marginBottom: 26 * unit,
                backgroundColor: p.accentColor,
                transformOrigin: center ? "50% 50%" : "0% 50%",
                transform: `scaleX(${ruleIn})`,
              }}
            />
            {p.author ? (
              <div style={{ fontSize: 32 * unit, fontWeight: 600, letterSpacing: "-0.01em", color: p.color, ...rise(authorDelay + 4) }}>
                {p.author}
              </div>
            ) : null}
            {p.role ? (
              <div
                style={{
                  marginTop: 6 * unit,
                  fontSize: 28 * unit,
                  fontWeight: 400,
                  color: withAlpha(p.color, 0.6),
                  ...rise(authorDelay + 7),
                }}
              >
                {p.role}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const quoteCard = defineMotionComponent<Props>({
  id: "quote-card",
  name: "Quote card",
  category: "text",
  description:
    "Pull quote with a large accent quote mark, word-by-word reveal and author line, on an optional dark card. Serif (editorial) or sans. Wrap words in *asterisks* to set them in the accent color (italic in serif). Use for testimonials, interview soundbites and famous lines.",
  schema: {
    quote: {
      type: "text",
      label: "Quote",
      default: "The best tools disappear. You stop thinking about the software and start thinking about the *story*.",
      description: "Use *word* for accent words; newlines split lines",
    },
    author: { type: "string", label: "Author", default: "Maya Chen" },
    role: { type: "string", label: "Role", default: "Creative Director, Lumen Labs" },
    serif: { type: "boolean", label: "Serif", default: true },
    serifFont: { type: "font", label: "Serif font", default: "Instrument Serif" },
    sansFont: { type: "font", label: "Sans font", default: "Inter Tight" },
    fontSize: { type: "number", label: "Size", default: 84, min: 32, max: 180, step: 1, description: "Quote size in px at 1080p" },
    color: { type: "color", label: "Text color", default: "#F5F5F7" },
    accentColor: { type: "color", label: "Accent", default: "#F2B66D" },
    align: { type: "enum", label: "Align", default: "left", options: ["left", "center"] },
    card: { type: "boolean", label: "Card", default: true },
    cardColor: { type: "color", label: "Card color", default: "#141417" },
    cardOpacity: { type: "number", label: "Card opacity", default: 0.78, min: 0, max: 1, step: 0.01 },
    stagger: { type: "number", label: "Stagger (frames)", default: 2, min: 0, max: 10, step: 1 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    quote: "The best tools disappear. You stop thinking about the software and start thinking about the *story*.",
    author: "Maya Chen",
    role: "Creative Director, Lumen Labs",
    serif: true,
    serifFont: "Instrument Serif",
    sansFont: "Inter Tight",
    fontSize: 84,
    color: "#F5F5F7",
    accentColor: "#F2B66D",
    align: "left",
    card: true,
    cardColor: "#141417",
    cardOpacity: 0.78,
    stagger: 2,
    exit: true,
  },
  defaultDuration: 6,
  defaultBox: { x: 0.5, y: 0.5, width: 0.72, height: 0.66 },
  Component: QuoteCard,
  tags: ["quote", "testimonial", "serif", "editorial", "interview"],
});
