import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { luminance, withAlpha } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { lerp, progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  name: string;
  title: string;
  variant: "bar" | "glass" | "minimal" | "news";
  align: "left" | "right";
  tag: string;
  fontFamily: string;
  /** Name size in px at 1080p; the whole layout scales with it. */
  size: number;
  color: string;
  secondaryColor: string;
  accentColor: string;
  panelColor: string;
  exit: boolean;
};

/** Shared values for the variants. `t` and `last` are in 30 fps frames so timing is fps-independent. */
type Ctx = { p: Props & BoxProps; k: number; t: number; last: number; font: string; right: boolean };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Exit progress starting `lead` frames before the clip's last frame. */
const out = (c: Ctx, lead: number, dur: number) => (c.p.exit ? progress(c.t, c.last - lead, dur, "ease-in") : 0);

const nameStyle = (c: Ctx): React.CSSProperties => ({
  fontFamily: c.font,
  fontWeight: 700,
  fontSize: 56 * c.k,
  lineHeight: 1.08,
  letterSpacing: "-0.025em",
  color: c.p.color,
});

const titleStyle = (c: Ctx): React.CSSProperties => ({
  fontFamily: c.font,
  fontWeight: 500,
  fontSize: 34 * c.k,
  lineHeight: 1.25,
  letterSpacing: "-0.005em",
  color: c.p.secondaryColor,
});

/** Soft shadow so text without a panel stays readable over footage. */
const legible = (k: number) => `0 ${1.5 * k}px ${12 * k}px rgba(0,0,0,0.42)`;

/** Accent bar, text slides out from behind it. */
const Bar: React.FC<{ c: Ctx }> = ({ c }) => {
  const { p, k, t, right } = c;
  const barScale = progress(t, 0, 16, "smooth") * (1 - out(c, 7, 7));
  const textOut = out(c, 13, 10);
  const hidden = (delay: number) => clamp01(1 - progress(t, delay, 22, "smooth") + textOut);
  const pad = 40 * k;
  const gap = 22 * k;
  // Clip only at the bar's edge, so the text slides out of the bar and shadows are never cut.
  const mask = right ? `inset(-${pad}px -${gap}px -${pad}px -${pad}px)` : `inset(-${pad}px -${pad}px -${pad}px -${gap}px)`;
  const sign = right ? 1 : -1;
  // Hidden text parks past the clip edge by its shadow's reach as well.
  const slide = (h: number) => `translateX(${sign * h * 100}%) translateX(${sign * h * (gap + 16 * k)}px)`;
  return (
    <div style={{ display: "flex", flexDirection: right ? "row-reverse" : "row", alignItems: "stretch", gap }}>
      <div
        style={{
          width: 7 * k,
          flexShrink: 0,
          borderRadius: 4 * k,
          backgroundColor: p.accentColor,
          transform: `scaleY(${barScale})`,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: right ? "flex-end" : "flex-start",
          textAlign: right ? "right" : "left",
          gap: 6 * k,
          padding: `${4 * k}px 0`,
        }}
      >
        <div style={{ clipPath: mask }}>
          <div style={{ ...nameStyle(c), textShadow: legible(k), transform: slide(hidden(5)) }}>{p.name}</div>
        </div>
        {p.title ? (
          <div style={{ clipPath: mask }}>
            <div style={{ ...titleStyle(c), textShadow: legible(k), transform: slide(hidden(9)) }}>{p.title}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** Frosted card: translucent fill, 1px light edge, soft shadow (no backdrop-filter). */
const Glass: React.FC<{ c: Ctx }> = ({ c }) => {
  const { p, k, t, right } = c;
  const q = progress(t, 0, 24, "apple");
  const e = out(c, 12, 12);
  const blur = (1 - q) * 10 * k + e * 8 * k;
  const item = (delay: number): React.CSSProperties => {
    const v = progress(t, delay, 20, "apple");
    return { opacity: v, transform: `translateY(${(1 - v) * 14 * k}px)` };
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: right ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: 22 * k,
        padding: `${22 * k}px ${36 * k}px ${24 * k}px`,
        borderRadius: 28 * k,
        backgroundColor: withAlpha(p.panelColor, 0.55),
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 100%)",
        border: `${Math.max(1, k)}px solid rgba(255,255,255,0.2)`,
        boxShadow: `0 ${18 * k}px ${48 * k}px rgba(0,0,0,0.32)`,
        transformOrigin: right ? "100% 50%" : "0% 50%",
        opacity: Math.min(1, q * 1.5) * (1 - e),
        transform: `translateY(${(1 - q) * 24 * k + e * 12 * k}px) scale(${lerp(0.96, 1, q) - e * 0.02})`,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          width: 14 * k,
          height: 14 * k,
          flexShrink: 0,
          // Centred on the name's first line.
          marginTop: (56 * 1.08 - 14) * 0.5 * k,
          borderRadius: "50%",
          backgroundColor: p.accentColor,
          boxShadow: `0 0 ${12 * k}px ${withAlpha(p.accentColor, 0.65)}`,
          transform: `scale(${progress(t, 9, 16, "snappy")})`,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 * k, textAlign: right ? "right" : "left" }}>
        <div style={{ ...nameStyle(c), ...item(5) }}>{p.name}</div>
        {p.title ? <div style={{ ...titleStyle(c), ...item(9) }}>{p.title}</div> : null}
      </div>
    </div>
  );
};

/** Hairline draws on; the name rises out of it and the title drops out of it. */
const Minimal: React.FC<{ c: Ctx }> = ({ c }) => {
  const { p, k, t, right } = c;
  const lineOut = out(c, 8, 8);
  const lineScale = lineOut > 0 ? 1 - lineOut : progress(t, 0, 22, "smooth");
  // Draws from the text side, retracts toward the far side.
  const lineOrigin = right !== lineOut > 0 ? "100% 50%" : "0% 50%";
  const textOut = out(c, 14, 10);
  const nameHidden = clamp01(1 - progress(t, 6, 22, "smooth") + textOut);
  const titleHidden = clamp01(1 - progress(t, 9, 22, "smooth") + textOut);
  const pad = 40 * k;
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: right ? "flex-end" : "flex-start",
        textAlign: right ? "right" : "left",
      }}
    >
      <div style={{ clipPath: `inset(-${pad}px -${pad}px 0px -${pad}px)` }}>
        <div
          style={{
            ...nameStyle(c),
            paddingBottom: 14 * k,
            textShadow: legible(k),
            // Parks past the line by the shadow's reach too, so nothing bleeds while hidden.
            transform: `translateY(${nameHidden * 100}%) translateY(${nameHidden * 16 * k}px)`,
          }}
        >
          {p.name}
        </div>
      </div>
      <div
        style={{
          alignSelf: "stretch",
          height: Math.max(1, 2.5 * k),
          borderRadius: k,
          backgroundColor: p.accentColor,
          transformOrigin: lineOrigin,
          transform: `scaleX(${lineScale})`,
        }}
      />
      {p.title ? (
        <div style={{ clipPath: `inset(0px -${pad}px -${pad}px -${pad}px)` }}>
          <div
            style={{
              ...titleStyle(c),
              paddingTop: 14 * k,
              textShadow: legible(k),
              transform: `translateY(${-titleHidden * 100}%) translateY(${-titleHidden * 16 * k}px)`,
            }}
          >
            {p.title}
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** Broadcast band: accent tag + name band, title strip underneath; wipes in left to right. */
const News: React.FC<{ c: Ctx }> = ({ c }) => {
  const { p, k, t } = c;
  const wipe = (inP: number, outP: number) => `inset(0px ${((1 - inP) * 100).toFixed(3)}% 0px ${(outP * 100).toFixed(3)}%)`;
  const textIn = (delay: number): React.CSSProperties => {
    const v = progress(t, delay, 18, "smooth");
    return { opacity: v, transform: `translateX(${(1 - v) * -36 * k}px)` };
  };
  const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos((t / 30) * Math.PI * 2));
  const tagInk = luminance(p.accentColor) > 0.45 ? "#0B0B0F" : "#FFFFFF";
  const stripInk = luminance(p.panelColor) < 0.4 ? p.panelColor : "#111114";
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div style={{ display: "flex", width: "100%", height: 96 * k }}>
        {p.tag ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12 * k,
              padding: `0 ${28 * k}px`,
              backgroundColor: p.accentColor,
              color: tagInk,
              fontFamily: c.font,
              fontWeight: 800,
              fontSize: 30 * k,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              clipPath: wipe(progress(t, 0, 12, "smooth"), out(c, 9, 9)),
            }}
          >
            <div style={{ width: 12 * k, height: 12 * k, borderRadius: "50%", backgroundColor: tagInk, opacity: pulse }} />
            {p.tag}
          </div>
        ) : null}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            padding: `0 ${32 * k}px`,
            overflow: "hidden",
            backgroundColor: withAlpha(p.panelColor, 0.94),
            clipPath: wipe(progress(t, 4, 16, "smooth"), out(c, 11, 9)),
          }}
        >
          <div style={{ ...nameStyle(c), fontSize: 50 * k, whiteSpace: "nowrap", ...textIn(9) }}>{p.name}</div>
        </div>
      </div>
      {p.title ? (
        <div
          style={{
            padding: `${12 * k}px ${32 * k}px`,
            backgroundColor: "rgba(255,255,255,0.96)",
            clipPath: wipe(progress(t, 9, 16, "smooth"), out(c, 13, 9)),
          }}
        >
          <div style={{ ...titleStyle(c), fontWeight: 600, color: stripInk, ...textIn(14) }}>{p.title}</div>
        </div>
      ) : null}
    </div>
  );
};

const VARIANTS = { bar: Bar, glass: Glass, minimal: Minimal, news: News } as const;

const LowerThird: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const weights = p.variant === "news" ? [600, 700, 800] : [500, 700];
  useFonts(weights.map((weight) => ({ family: p.fontFamily, weight })));
  const right = p.align === "right" && p.variant !== "news";
  const c: Ctx = {
    p,
    k: (p.size / 56) * unit,
    t: (frame * 30) / fps,
    last: ((p.durationInFrames - 1) * 30) / fps,
    font: fontStack(p.fontFamily),
    right,
  };
  const Variant = VARIANTS[p.variant] ?? Bar;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: right ? "flex-end" : "flex-start",
      }}
    >
      <Variant c={c} />
    </div>
  );
};

export const lowerThird = defineMotionComponent<Props>({
  id: "lower-third",
  name: "Lower third",
  category: "text",
  description:
    "Name + title caption for introducing a speaker or place. Variants: bar (accent bar, text slides out of it), glass (frosted card), minimal (hairline the text splits from), news (broadcast band with a LIVE-style tag; widen the box to the frame for a full-width band).",
  schema: {
    name: { type: "string", label: "Name", default: "Maya Chen" },
    title: { type: "string", label: "Title", default: "Founder & CEO, Lumen Labs" },
    variant: { type: "enum", label: "Style", default: "bar", options: ["bar", "glass", "minimal", "news"] },
    align: { type: "enum", label: "Align", default: "left", options: ["left", "right"] },
    tag: {
      type: "string",
      label: "Tag (news)",
      default: "Live",
      description: "Label in the accent block of the news style; empty hides it",
    },
    fontFamily: { type: "font", label: "Font", default: "Inter Tight" },
    size: { type: "number", label: "Size", default: 56, min: 24, max: 140, step: 1, description: "Name size in px at 1080p" },
    color: { type: "color", label: "Name color", default: "#FFFFFF" },
    secondaryColor: { type: "color", label: "Title color", default: "#D1D1D6" },
    accentColor: { type: "color", label: "Accent", default: "#0A84FF" },
    panelColor: { type: "color", label: "Panel", default: "#111115", description: "Card tint (glass) and band color (news)" },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    name: "Maya Chen",
    title: "Founder & CEO, Lumen Labs",
    variant: "bar",
    align: "left",
    tag: "Live",
    fontFamily: "Inter Tight",
    size: 56,
    color: "#FFFFFF",
    secondaryColor: "#D1D1D6",
    accentColor: "#0A84FF",
    panelColor: "#111115",
    exit: true,
  },
  defaultDuration: 5,
  defaultBox: { x: 0.3, y: 0.82, width: 0.5, height: 0.16 },
  Component: LowerThird,
  tags: ["lower third", "name", "speaker", "caption", "interview", "news"],
});
