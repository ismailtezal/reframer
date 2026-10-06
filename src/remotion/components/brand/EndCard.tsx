import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { luminance, withAlpha } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { progress, random01 } from "../helpers";
import { AssetMedia, useAssetSrc } from "../media";
import { tokenizeAccent } from "../text/KineticTitle";
import { type BoxProps, defineMotionComponent } from "../types";
import { MonogramTile } from "./LogoReveal";

type Props = {
  logo: string;
  brand: string;
  headline: string;
  subtitle: string;
  url: string;
  /** Decorative, QR-like dot block (not scannable). */
  showQr: boolean;
  layout: "center" | "left";
  accentColor: string;
  accentColor2: string;
  textColor: string;
  mutedColor: string;
  fontFamily: string;
  headlineSize: number;
  urlSize: number;
  exit: boolean;
};

const QR_N = 25;

const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h % 100000;
};

const inFinder = (i: number, j: number) => (i < 8 && j < 8) || (i >= QR_N - 8 && j < 8) || (i < 8 && j >= QR_N - 8);
const inCenter = (i: number, j: number) => Math.abs(i - (QR_N - 1) / 2) <= 3.5 && Math.abs(j - (QR_N - 1) / 2) <= 3.5;

/** Decorative dot matrix with finder-style corners; dots grow in on a diagonal wave. */
const QrBlock: React.FC<{
  size: number;
  seed: number;
  frame: number;
  start: number;
  color: string;
  center: React.ReactNode;
}> = ({ size, seed, frame, start, color, center }) => {
  const m = size / QR_N;
  let dots = "";
  for (let i = 0; i < QR_N; i++) {
    for (let j = 0; j < QR_N; j++) {
      if (inFinder(i, j) || inCenter(i, j)) continue;
      if (random01(seed + i * 31.7 + j * 17.3) > 0.48) continue;
      const g = progress(frame, start + (i + j) * 0.45, 10, "smooth");
      if (g <= 0) continue;
      const r = m * 0.4 * g;
      const cx = (i + 0.5) * m;
      const cy = (j + 0.5) * m;
      dots += `M${(cx - r).toFixed(2)} ${cy.toFixed(2)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0Z`;
    }
  }
  const finders = [
    { id: "f1", i: 0, j: 0 },
    { id: "f2", i: QR_N - 7, j: 0 },
    { id: "f3", i: 0, j: QR_N - 7 },
  ];
  const centerP = progress(frame, start + (QR_N - 1) * 0.45, 16, "smooth");
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        {finders.map((fp) => {
          const g = progress(frame, start + (fp.i + fp.j) * 0.45, 14, "smooth");
          const x = fp.i * m;
          const y = fp.j * m;
          const c = 3.5 * m;
          return (
            <g key={fp.id} opacity={g} transform={`translate(${x + c} ${y + c}) scale(${0.6 + 0.4 * g}) translate(${-c} ${-c})`}>
              <rect x={m / 2} y={m / 2} width={6 * m} height={6 * m} rx={m * 1.6} fill="none" stroke={color} strokeWidth={m} />
              <rect x={2 * m} y={2 * m} width={3 * m} height={3 * m} rx={m * 0.9} fill={color} />
            </g>
          );
        })}
        <path d={dots} fill={color} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * centerP})`,
          opacity: centerP,
        }}
      >
        {center}
      </div>
    </div>
  );
};

const ArrowIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" style={{ display: "block" }}>
    <path d="M3 8h9.2M8.6 3.8 12.8 8l-4.2 4.2" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EndCard: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([
    { family: p.fontFamily, weight: 500 },
    { family: p.fontFamily, weight: 600 },
    { family: p.fontFamily, weight: 700 },
  ]);
  const font = fontStack(p.fontFamily);
  const media = useAssetSrc(p.logo);
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const portrait = w / h < 1;
  const sideQr = p.showQr && !portrait;
  const center = p.layout === "center";
  const align = center ? "center" : "flex-start";

  const qrSize = p.showQr ? Math.min(h * (portrait ? 0.24 : 0.46), w * (portrait ? 0.42 : 0.28)) : 0;
  const textW = sideQr ? w * 0.62 : w * 0.92;
  const lines = tokenizeAccent(p.headline);
  const longest = Math.max(1, ...p.headline.split("\n").map((l) => l.replace(/\*/g, "").length));
  const headFs = Math.min(p.headlineSize * unit, (textW * 0.98) / (longest * 0.52));
  const subFs = Math.max(30 * unit, Math.min(headFs * 0.4, 46 * unit));
  const urlFs = Math.max(28 * unit, Math.min(p.urlSize * unit, (textW * 0.8) / Math.max(1, p.url.length * 0.58 + 3)));
  const logoH = Math.max(56 * unit, Math.min(110 * unit, headFs * 0.95));
  const brandFs = logoH * 0.46;
  const words = lines.flat().filter((t) => !t.space).length;

  // --- timeline -------------------------------------------------------------
  const logoP = progress(frame, 0, 18, "smooth");
  const headStart = 6;
  const subStart = headStart + words * 3 + 6;
  const subP = progress(frame, subStart, 18, "smooth");
  const pillStart = subStart + (p.subtitle ? 6 : 0);
  const pillP = progress(frame, pillStart, 20, "smooth");
  const nudge = Math.sin(Math.PI * progress(frame, pillStart + 20, 18, "ease-in-out")) * 6 * unit;
  const exitP = p.exit ? progress(frame, p.durationInFrames - 13, 12, "ease-in") : 0;
  const gradient = `linear-gradient(100deg, ${p.accentColor}, ${p.accentColor2})`;
  const onAccent = luminance(p.accentColor) > 0.42 ? "#0B0B0F" : "#FFFFFF";
  const letter = (p.brand.trim()[0] ?? "R").toUpperCase();

  let wordIndex = 0;
  const headline = (
    <div
      style={{
        fontFamily: font,
        fontWeight: 700,
        fontSize: headFs,
        lineHeight: 1.03,
        letterSpacing: "-0.035em",
        color: p.textColor,
        textAlign: center ? "center" : "left",
      }}
    >
      {lines.map((line, li) => (
        <div key={`hl${li.toString()}`} style={{ whiteSpace: "pre-wrap" }}>
          {line.map((tok, ti) => {
            const key = `${li}-${ti}`;
            if (tok.space) return <span key={key}>{tok.text}</span>;
            const q = progress(frame, headStart + wordIndex++ * 3, 22, "apple");
            return (
              <span
                key={key}
                style={{
                  display: "inline-block",
                  whiteSpace: "pre",
                  opacity: Math.min(1, q * 1.3),
                  transform: `translateY(${((1 - q) * 0.3 * headFs).toFixed(2)}px)`,
                  filter: q < 1 ? `blur(${((1 - q) * 10 * unit).toFixed(2)}px)` : undefined,
                  ...(tok.accent
                    ? {
                        backgroundImage: gradient,
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                        WebkitTextFillColor: "transparent",
                      }
                    : {}),
                }}
              >
                {tok.text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );

  const logo = media ? (
    <div style={{ height: logoH, width: Math.min(textW * 0.5, logoH * 3) }}>
      <AssetMedia value={p.logo} fit="contain" style={{ objectPosition: center ? "50% 50%" : "0% 50%" }} />
    </div>
  ) : (
    <div style={{ display: "flex", alignItems: "center", gap: logoH * 0.28 }}>
      <MonogramTile letter={letter} size={logoH} fontFamily={p.fontFamily} accent={p.accentColor} unit={unit} />
      {p.brand ? (
        <span style={{ fontFamily: font, fontWeight: 600, fontSize: brandFs, letterSpacing: "-0.02em", color: p.textColor }}>
          {p.brand}
        </span>
      ) : null}
    </div>
  );

  const pill = p.url ? (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: urlFs * 0.55,
        padding: `${urlFs * 0.34}px ${urlFs * 0.34}px ${urlFs * 0.34}px ${urlFs * 0.8}px`,
        borderRadius: urlFs * 2,
        background: "linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)",
        border: `${Math.max(1, unit)}px solid rgba(255,255,255,0.14)`,
        boxShadow: `inset 0 ${Math.max(1, unit)}px 0 rgba(255,255,255,0.08), 0 ${18 * unit}px ${44 * unit}px rgba(0,0,0,0.35)`,
        opacity: pillP,
        transform: `translateY(${((1 - pillP) * 18 * unit).toFixed(2)}px) scale(${(0.96 + 0.04 * pillP).toFixed(4)})`,
      }}
    >
      <span
        style={{
          fontFamily: font,
          fontWeight: 600,
          fontSize: urlFs,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          color: p.textColor,
          whiteSpace: "nowrap",
        }}
      >
        {p.url}
      </span>
      <div
        style={{
          width: urlFs * 1.5,
          height: urlFs * 1.5,
          borderRadius: "50%",
          background: gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 ${6 * unit}px ${18 * unit}px ${withAlpha(p.accentColor, 0.35)}`,
        }}
      >
        <div style={{ transform: `translateX(${nudge.toFixed(2)}px)` }}>
          <ArrowIcon size={urlFs * 0.85} color={onAccent} />
        </div>
      </div>
    </div>
  ) : null;

  const qr = p.showQr ? (
    <div
      style={{
        padding: qrSize * 0.08,
        borderRadius: qrSize * 0.12,
        background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
        border: `${Math.max(1, unit)}px solid rgba(255,255,255,0.12)`,
        boxShadow: `inset 0 ${Math.max(1, unit)}px 0 rgba(255,255,255,0.08), 0 ${24 * unit}px ${60 * unit}px rgba(0,0,0,0.35)`,
        opacity: progress(frame, 6, 16, "smooth"),
        transform: `translateY(${((1 - progress(frame, 6, 20, "smooth")) * 24 * unit).toFixed(2)}px)`,
        flexShrink: 0,
      }}
    >
      <QrBlock
        size={qrSize}
        seed={hashString(p.url || p.brand)}
        frame={frame}
        start={12}
        color={withAlpha(p.textColor, 0.92)}
        center={<MonogramTile letter={letter} size={(qrSize / QR_N) * 6} fontFamily={p.fontFamily} accent={p.accentColor} unit={unit} />}
      />
    </div>
  ) : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: sideQr ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: sideQr ? w * 0.06 : headFs * 0.6,
        opacity: 1 - exitP,
        transform: `scale(${1 - 0.03 * exitP})`,
        filter: exitP > 0 ? `blur(${(exitP * 8 * unit).toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: sideQr ? "flex-start" : align, maxWidth: textW, gap: headFs * 0.34 }}
      >
        <div
          style={{
            opacity: logoP,
            transform: `scale(${(0.92 + 0.08 * logoP).toFixed(4)})`,
            transformOrigin: center && !sideQr ? "50% 50%" : "0% 50%",
            filter: logoP < 1 ? `blur(${((1 - logoP) * 6 * unit).toFixed(2)}px)` : undefined,
            marginBottom: headFs * 0.12,
          }}
        >
          {logo}
        </div>
        {sideQr ? <div style={{ textAlign: "left" }}>{headline}</div> : headline}
        {p.subtitle ? (
          <div
            style={{
              fontFamily: font,
              fontWeight: 500,
              fontSize: subFs,
              lineHeight: 1.35,
              color: p.mutedColor,
              textAlign: center && !sideQr ? "center" : "left",
              opacity: subP,
              transform: `translateY(${((1 - subP) * 12 * unit).toFixed(2)}px)`,
            }}
          >
            {p.subtitle}
          </div>
        ) : null}
        <div style={{ marginTop: headFs * 0.22 }}>{pill}</div>
      </div>
      {qr}
    </div>
  );
};

export const endCard = defineMotionComponent<Props>({
  id: "end-card",
  name: "End card",
  category: "brand",
  description:
    "Closing CTA card: logo (or monogram + brand name), a big headline (wrap words in *asterisks* for the accent gradient), a supporting line and a glass URL pill with an accent arrow, entering in a quick stagger; optional decorative QR-style dot block (not scannable — never present it as a real code). Use as the last 2-5 s of launches, ads and explainers; hold the URL on screen ≥ 2 s.",
  schema: {
    logo: { type: "asset", label: "Logo", default: "" },
    brand: { type: "string", label: "Brand name", default: "Reframer" },
    headline: { type: "text", label: "Headline", default: "Start creating *today*", description: "Use *word* for the accent gradient" },
    subtitle: { type: "string", label: "Subtitle", default: "Open source. Bring any AI." },
    url: { type: "string", label: "URL", default: "reframer.app" },
    showQr: { type: "boolean", label: "QR-style block", default: false, description: "Decorative only, not a scannable code" },
    layout: { type: "enum", label: "Layout", default: "center", options: ["center", "left"] },
    accentColor: { type: "color", label: "Accent", default: "#FFB224" },
    accentColor2: { type: "color", label: "Accent 2", default: "#FF6A3D" },
    textColor: { type: "color", label: "Text", default: "#F5F5F7" },
    mutedColor: { type: "color", label: "Muted text", default: "#A1A1AA" },
    fontFamily: { type: "font", label: "Font", default: "Inter Tight" },
    headlineSize: { type: "number", label: "Headline size", default: 112, min: 40, max: 260, step: 1 },
    urlSize: { type: "number", label: "URL size", default: 56, min: 28, max: 120, step: 1 },
    exit: { type: "boolean", label: "Animate out", default: false },
  },
  defaults: {
    logo: "",
    brand: "Reframer",
    headline: "Start creating *today*",
    subtitle: "Open source. Bring any AI.",
    url: "reframer.app",
    showQr: false,
    layout: "center",
    accentColor: "#FFB224",
    accentColor2: "#FF6A3D",
    textColor: "#F5F5F7",
    mutedColor: "#A1A1AA",
    fontFamily: "Inter Tight",
    headlineSize: 112,
    urlSize: 56,
    exit: false,
  },
  defaultDuration: 5,
  Component: EndCard,
  tags: ["brand", "cta", "outro", "end card", "url", "logo"],
});
