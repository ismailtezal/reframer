import type React from "react";
import { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { withAlpha } from "../../../core/color";
import { useRenderContext } from "../../context";
import { fontStack, useFonts } from "../../fonts";
import { lerp, progress, random01 } from "../helpers";
import { AssetMedia, useAssetSrc } from "../media";
import { bandStops, sweepBand, useImageAspect } from "../overlay/LightSweep";
import { type BoxProps, defineMotionComponent } from "../types";

type Style = "scale-blur" | "mask-wipe" | "shine" | "assemble";

type Props = {
  logo: string;
  wordmark: string;
  tagline: string;
  /** Letter(s) for the placeholder tile when no logo is set (defaults to the wordmark's initial). */
  monogram: string;
  style: Style;
  layout: "stacked" | "inline";
  /** logo height, px at 1080p */
  logoSize: number;
  fontFamily: string;
  fontWeight: number;
  wordmarkSize: number;
  textColor: string;
  accentColor: string;
  glow: number;
  sweep: boolean;
  exit: boolean;
};

/** Elegant placeholder mark: a dark glass tile with a crisp initial and a hint of accent light. */
export const MonogramTile: React.FC<{ letter: string; size: number; fontFamily: string; accent: string; unit: number }> = ({
  letter,
  size,
  fontFamily,
  accent,
  unit,
}) => (
  <div
    style={{
      position: "relative",
      width: size,
      height: size,
      borderRadius: size * 0.26,
      background: "linear-gradient(160deg, #2C2C32 0%, #151518 55%, #0D0D10 100%)",
      boxShadow: `inset 0 ${Math.max(1, unit)}px 0 rgba(255,255,255,0.16), inset 0 0 0 ${Math.max(1, unit)}px rgba(255,255,255,0.07), 0 ${size * 0.12}px ${size * 0.3}px rgba(0,0,0,0.45)`,
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(95% 70% at 50% 112%, ${withAlpha(accent, 0.42)} 0%, ${withAlpha(accent, 0)} 72%)`,
      }}
    />
    <span
      style={{
        position: "relative",
        fontFamily: fontStack(fontFamily),
        fontWeight: 700,
        fontSize: size * (letter.length > 1 ? 0.4 : 0.54),
        lineHeight: 1,
        letterSpacing: "-0.04em",
        backgroundImage: "linear-gradient(180deg, #FFFFFF 0%, #C8C8D0 100%)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        WebkitTextFillColor: "transparent",
      }}
    >
      {letter}
    </span>
  </div>
);

const LogoReveal: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { project } = useRenderContext();
  useFonts([
    { family: p.fontFamily, weight: p.fontWeight },
    { family: p.fontFamily, weight: 500 },
    { family: p.fontFamily, weight: 700 },
  ]);
  const font = fontStack(p.fontFamily);
  const media = useAssetSrc(p.logo);
  const isImage = media?.kind === "image";
  const style: Style = media?.kind === "video" && p.style === "assemble" ? "scale-blur" : p.style;
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const inline = p.layout === "inline";
  const f = (s: number) => Math.round(s * fps);

  // --- sizes ------------------------------------------------------------------
  const asset = project.assets[p.logo];
  // The mark box takes the logo's real aspect, so media and its sweep mask line up exactly.
  const measured = useImageAspect(isImage && media && !(asset?.width && asset?.height) ? media.src : null);
  const aspect = media ? (asset?.width && asset?.height ? asset.width / asset.height : (measured ?? (inline ? 1 : 2.4))) : 1;
  let markH = p.logoSize * unit;
  let markW = markH * aspect;
  const maxMarkW = w * (inline ? 0.4 : 0.8);
  const maxMarkH = h * (inline ? 0.7 : p.wordmark ? 0.5 : 0.8);
  const fit = Math.min(1, maxMarkW / markW, maxMarkH / markH);
  markW *= fit;
  markH *= fit;
  const chars = Array.from(p.wordmark);
  const letters = chars.map((c, k) => ({ c, k, id: `ch${k}` }));
  const wordFs = Math.min(p.wordmarkSize * unit, ((inline ? w - markW - markH * 0.3 : w) * 0.9) / Math.max(1, chars.length * 0.58));
  const tagFs = Math.max(28 * unit, Math.min(wordFs * 0.36, 48 * unit));
  const letter = (p.monogram || chars[0] || "R").slice(0, 2).toUpperCase();

  // --- timeline ------------------------------------------------------------------
  const revealDur = f(0.85);
  const lock = revealDur;
  const pre = progress(frame, lock - 6, 6, "ease-in");
  const post = progress(frame, lock, 10, "smooth");
  let markScale = 1 + 0.025 * (pre - post);
  let markOpacity = 1;
  let markBlur = 0;
  let markX = 0;
  let wipeMask: string | undefined;
  let edge: { s: number; strength: number } | null = null;
  const wipeAngle = 100;
  if (style === "scale-blur") {
    const e = progress(frame, 0, revealDur, "apple");
    markScale = lerp(1.16, 1, e);
    markBlur = (1 - e) * 12 * unit;
    markOpacity = Math.min(1, e * 1.6);
  } else if (style === "shine") {
    const e = progress(frame, 0, f(0.6), "smooth");
    markScale *= lerp(0.97, 1, e);
    markBlur = (1 - e) * 6 * unit;
    markOpacity = e;
  } else if (style === "mask-wipe") {
    const e = progress(frame, 2, revealDur, "ease-in-out");
    const feather = 22;
    const front = e * (100 + feather);
    wipeMask = `linear-gradient(${wipeAngle}deg, #000 0%, #000 ${(front - feather).toFixed(2)}%, transparent ${front.toFixed(2)}%)`;
    markX = (1 - e) * -0.04 * markW;
    // Light rides the wipe's feathered edge.
    const a = ((wipeAngle - 90) * Math.PI) / 180;
    const proj = [0, markW * Math.cos(a), markH * Math.sin(a), markW * Math.cos(a) + markH * Math.sin(a)];
    const lo = Math.min(...proj);
    const hi = Math.max(...proj);
    edge = { s: lo + ((front - feather / 2) / 100) * (hi - lo), strength: Math.sin(Math.PI * Math.min(1, e * 1.05)) };
  }

  const strips = style === "assemble" ? 9 : 0;
  const sweepStart = style === "shine" ? f(0.45) : lock - 4;
  const sweepDur = style === "shine" ? f(1.1) : f(0.9);
  const sweepT = progress(frame, sweepStart, sweepDur, "ease-in-out");
  const sweepOn = p.sweep && style !== "mask-wipe" && frame >= sweepStart && frame <= sweepStart + sweepDur;
  const sweepPeak = style === "shine" ? 0.8 : 0.5;
  const pulse = Math.sin(Math.PI * progress(frame, lock - 4, f(0.8), "ease-out"));
  const glowIn = progress(frame, 0, revealDur, "smooth");
  const glowAmt = p.glow * glowIn * (0.4 + 0.6 * pulse);
  const wordStart = f(0.42);
  const tagP = progress(frame, f(1.15), f(0.5), "smooth");
  const exitP = p.exit ? progress(frame, p.durationInFrames - 13, 12, "ease-in") : 0;

  const visual = (key: string) =>
    media ? (
      <AssetMedia key={key} value={p.logo} fit="contain" />
    ) : (
      <MonogramTile key={key} letter={letter} size={markH} fontFamily={p.fontFamily} accent={p.accentColor} unit={unit} />
    );

  const band = Math.max(markW, markH) * (style === "shine" ? 0.5 : 0.38);
  const bandVec = sweepBand(markW, markH, 20, sweepT, band, band * 2.2);
  const edgeW = Math.max(markW, markH) * 0.22;
  const edgeA = ((wipeAngle - 90) * Math.PI) / 180;
  const edgeVec = edge
    ? {
        x1: Math.cos(edgeA) * (edge.s - edgeW / 2),
        y1: Math.sin(edgeA) * (edge.s - edgeW / 2),
        x2: Math.cos(edgeA) * (edge.s + edgeW / 2),
        y2: Math.sin(edgeA) * (edge.s + edgeW / 2),
      }
    : null;
  const light = sweepOn
    ? { vec: bandVec, stops: bandStops(0.7, sweepPeak) }
    : edgeVec && edge && edge.strength > 0.01
      ? { vec: edgeVec, stops: bandStops(0.85, 0.75 * edge.strength) }
      : null;
  // Sheen: while the light passes, the mark dims a touch and a full-brightness copy shows
  // through a soft band — reads even on white logos, where an additive highlight can't.
  const sheenAmt = sweepOn ? (style === "shine" ? 0.26 : 0.16) * Math.sin(Math.PI * sweepT) : 0;
  let sheenMask: string | undefined;
  if (sheenAmt > 0.005) {
    const a = (20 * Math.PI) / 180;
    const proj = [0, markW * Math.cos(a), markH * Math.sin(a), markW * Math.cos(a) + markH * Math.sin(a)];
    const minP = Math.min(...proj);
    const span = Math.max(1, Math.max(...proj) - minP);
    const travel = band * 2.2;
    const centre = ((minP - travel / 2 + (span + travel) * sweepT - minP) / span) * 100;
    const half = ((band * 0.55) / span) * 100;
    sheenMask = `linear-gradient(110deg, transparent ${(centre - half).toFixed(2)}%, #000 ${centre.toFixed(2)}%, transparent ${(centre + half).toFixed(2)}%)`;
  }

  const mark = (
    <div style={{ position: "relative", width: markW, height: markH, flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          left: -markW * 0.75,
          top: -markH * 0.75,
          width: markW * 2.5,
          height: markH * 2.5,
          background: `radial-gradient(closest-side, ${withAlpha(p.accentColor, 0.5 * glowAmt)} 0%, ${withAlpha(p.accentColor, 0.16 * glowAmt)} 45%, ${withAlpha(p.accentColor, 0)} 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: markOpacity,
          transform: `translateX(${markX.toFixed(2)}px) scale(${markScale.toFixed(4)})`,
          filter: markBlur > 0.05 ? `blur(${markBlur.toFixed(2)}px)` : undefined,
          maskImage: wipeMask,
          WebkitMaskImage: wipeMask,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: sheenAmt > 0.005 ? `brightness(${(1 - sheenAmt).toFixed(3)})` : undefined,
          }}
        >
          {strips > 0 ? (
            Array.from({ length: strips }, (_, k) => {
              // Slices converge from the centre outwards, alternating sides, with a little motion blur.
              const fromCentre = Math.abs(k - (strips - 1) / 2);
              const e = progress(frame, 1 + fromCentre * 1.8, f(0.75), "smooth");
              const dir = k % 2 === 0 ? -1 : 1;
              const off = dir * (0.14 + 0.1 * random01(k * 7.7 + 3)) * markW * (1 - e);
              const top = (k / strips) * 100;
              const bottom = 100 - ((k + 1) / strips) * 100;
              const blur = (1 - e) * 7 * unit;
              return (
                <div
                  key={`strip-${top.toFixed(2)}`}
                  style={{
                    position: "absolute",
                    inset: 0,
                    clipPath: `inset(${Math.max(0, top - 0.2).toFixed(2)}% -30% ${Math.max(0, bottom - 0.2).toFixed(2)}% -30%)`,
                    transform: `translateX(${off.toFixed(2)}px)`,
                    opacity: Math.min(1, e * 1.8),
                    filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
                  }}
                >
                  {visual("v")}
                </div>
              );
            })
          ) : (
            <div style={{ position: "absolute", inset: 0 }}>{visual("v")}</div>
          )}
        </div>
        {sheenMask ? (
          <div style={{ position: "absolute", inset: 0, maskImage: sheenMask, WebkitMaskImage: sheenMask }}>{visual("sheen")}</div>
        ) : null}
        {light ? (
          <svg
            aria-hidden="true"
            width={markW}
            height={markH}
            viewBox={`0 0 ${markW} ${markH}`}
            style={{ position: "absolute", inset: 0, overflow: "hidden" }}
          >
            <defs>
              <linearGradient id={`sw${uid}`} gradientUnits="userSpaceOnUse" {...light.vec}>
                {light.stops.map(([o, a]) => (
                  <stop key={o} offset={o} stopColor="#FFFFFF" stopOpacity={a} />
                ))}
              </linearGradient>
              <mask id={`mk${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={markW} height={markH} style={{ maskType: "alpha" }}>
                {isImage && media ? (
                  <image href={media.src} x={0} y={0} width={markW} height={markH} preserveAspectRatio="none" />
                ) : (
                  <rect width={markW} height={markH} rx={media ? 0 : markH * 0.26} fill="#FFFFFF" />
                )}
              </mask>
            </defs>
            <rect width={markW} height={markH} fill={`url(#sw${uid})`} mask={`url(#mk${uid})`} />
          </svg>
        ) : null}
      </div>
    </div>
  );

  const text =
    p.wordmark || p.tagline ? (
      <div style={{ display: "flex", flexDirection: "column", alignItems: inline ? "flex-start" : "center", gap: tagFs * 0.55 }}>
        {p.wordmark ? (
          <div
            style={{
              fontFamily: font,
              fontWeight: p.fontWeight,
              fontSize: wordFs,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              color: p.textColor,
              whiteSpace: "pre",
            }}
          >
            {letters.map(({ c, k, id }) => {
              const q = progress(frame, wordStart + k * 1.5, f(0.6), "apple");
              return (
                <span
                  key={id}
                  style={{
                    display: "inline-block",
                    opacity: Math.min(1, q * 1.4),
                    transform: `translateY(${((1 - q) * 0.38 * wordFs).toFixed(2)}px)`,
                    filter: q < 1 ? `blur(${((1 - q) * 8 * unit).toFixed(2)}px)` : undefined,
                  }}
                >
                  {c}
                </span>
              );
            })}
          </div>
        ) : null}
        {p.tagline ? (
          <div
            style={{
              fontFamily: font,
              fontWeight: 500,
              fontSize: tagFs,
              lineHeight: 1.3,
              color: p.textColor,
              opacity: 0.64 * tagP,
              transform: `translateY(${((1 - tagP) * 12 * unit).toFixed(2)}px)`,
              textAlign: inline ? "left" : "center",
            }}
          >
            {p.tagline}
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: inline ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: inline ? markH * 0.3 : markH * 0.2,
        opacity: 1 - exitP,
        transform: `scale(${1 - 0.03 * exitP})`,
        filter: exitP > 0 ? `blur(${(exitP * 8 * unit).toFixed(2)}px)` : undefined,
      }}
    >
      {mark}
      {text}
    </div>
  );
};

export const logoReveal = defineMotionComponent<Props>({
  id: "logo-reveal",
  name: "Logo reveal",
  category: "brand",
  description:
    "A short, confident logo sting: the logo reveals (scale-blur, feathered mask-wipe with light on the edge, shine, or assemble-from-strips), locks with a tiny settle and accent glow, a specular sweep crosses its pixels, then the wordmark rises letter by letter and an optional tagline follows. Set `logo` to the real asset; with none it shows an elegant monogram tile. Use for intros, outros and brand moments (2-4 s).",
  schema: {
    logo: { type: "asset", label: "Logo", default: "", description: "Transparent PNG/SVG works best" },
    wordmark: { type: "string", label: "Wordmark", default: "Reframer" },
    tagline: { type: "string", label: "Tagline", default: "" },
    monogram: { type: "string", label: "Monogram", default: "", description: "Placeholder letter(s) when no logo is set" },
    style: { type: "enum", label: "Reveal", default: "scale-blur", options: ["scale-blur", "mask-wipe", "shine", "assemble"] },
    layout: { type: "enum", label: "Layout", default: "stacked", options: ["stacked", "inline"] },
    logoSize: { type: "number", label: "Logo size", default: 200, min: 40, max: 700, step: 1 },
    fontFamily: { type: "font", label: "Font", default: "Inter Tight" },
    fontWeight: { type: "number", label: "Weight", default: 600, min: 100, max: 900, step: 100 },
    wordmarkSize: { type: "number", label: "Wordmark size", default: 104, min: 24, max: 300, step: 1 },
    textColor: { type: "color", label: "Text color", default: "#F5F5F7" },
    accentColor: { type: "color", label: "Glow color", default: "#FFB224" },
    glow: { type: "number", label: "Glow", default: 0.4, min: 0, max: 1, step: 0.05 },
    sweep: { type: "boolean", label: "Light sweep", default: true },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    logo: "",
    wordmark: "Reframer",
    tagline: "",
    monogram: "",
    style: "scale-blur",
    layout: "stacked",
    logoSize: 200,
    fontFamily: "Inter Tight",
    fontWeight: 600,
    wordmarkSize: 104,
    textColor: "#F5F5F7",
    accentColor: "#FFB224",
    glow: 0.4,
    sweep: true,
    exit: true,
  },
  defaultDuration: 3.5,
  Component: LogoReveal,
  tags: ["brand", "logo", "intro", "outro", "sting", "reveal"],
});
