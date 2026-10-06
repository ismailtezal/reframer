import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { withAlpha } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { progress } from "../helpers";
import { AssetMedia, useAssetSrc } from "../media";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  content: string;
  url: string;
  theme: "dark" | "light";
  dots: "color" | "mono";
  fit: "cover" | "contain";
  scroll: boolean;
  scrollStyle: "steps" | "smooth";
  /** seconds */
  scrollDelay: number;
  /** seconds */
  scrollDuration: number;
  entrance: "rise" | "tilt" | "none";
  /** resting X tilt, degrees */
  tilt: number;
  /** degrees the window turns (Y) across the clip */
  drift: number;
  radius: number;
  shadow: number;
  accentColor: string;
  exit: boolean;
};

const DOT_COLORS = ["#FF5F57", "#FEBC2E", "#28C840"];

/** Window-control dots shared by the browser, terminal and code windows. */
export const TrafficLights: React.FC<{ size: number; mono?: boolean; monoColor?: string }> = ({ size, mono, monoColor }) => (
  <div style={{ display: "flex", gap: size * 0.62, flexShrink: 0 }}>
    {DOT_COLORS.map((c) => (
      <div
        key={c}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: mono ? (monoColor ?? "rgba(255,255,255,0.18)") : c,
          boxShadow: mono ? undefined : `inset 0 0 0 ${Math.max(0.5, size * 0.06)}px rgba(0,0,0,0.18)`,
        }}
      />
    ))}
  </div>
);

type Theme = { bar: string; border: string; pill: string; text: string; page: string; ink: string };

const THEMES: Record<Props["theme"], Theme> = {
  dark: { bar: "#18181B", border: "rgba(255,255,255,0.09)", pill: "#232327", text: "#A1A1AA", page: "#0E0E11", ink: "255,255,255" },
  light: { bar: "#F4F4F5", border: "rgba(0,0,0,0.09)", pill: "#FFFFFF", text: "#52525B", page: "#FFFFFF", ink: "0,0,0" },
};

/** A calm website skeleton (two viewports tall so scrolling works before real media is set). */
const PageSkeleton: React.FC<{ theme: Theme; accent: string; vw: number; vh: number }> = ({ theme, accent, vw, vh }) => {
  const s = Math.min(vw, vh);
  const ink = (a: number) => `rgba(${theme.ink},${a})`;
  const bar = (key: string, style: React.CSSProperties, a = 0.08) => (
    <div key={key} style={{ position: "absolute", borderRadius: s, background: ink(a), ...style }} />
  );
  const tiles = ["t1", "t2", "t3"].map((k, i) => (
    <div
      key={k}
      style={{
        position: "absolute",
        left: `${7 + i * 29.5}%`,
        top: vh * 1.12,
        width: "27%",
        height: vh * 0.36,
        borderRadius: s * 0.025,
        background: ink(0.035),
        border: `1px solid ${ink(0.06)}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "9%",
          top: "12%",
          width: s * 0.07,
          height: s * 0.07,
          borderRadius: s * 0.018,
          background: i === 0 ? accent : ink(0.1),
        }}
      />
      {bar(`${k}a`, { left: "9%", top: "52%", width: "60%", height: s * 0.024 }, 0.12)}
      {bar(`${k}b`, { left: "9%", top: "66%", width: "78%", height: s * 0.018 }, 0.06)}
      {bar(`${k}c`, { left: "9%", top: "76%", width: "52%", height: s * 0.018 }, 0.06)}
    </div>
  ));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: vh * 2, background: theme.page }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          height: vh * 0.9,
          background: `radial-gradient(70% 60% at 50% 0%, ${withAlpha(accent, 0.18)} 0%, ${withAlpha(accent, 0)} 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "5%",
          top: vh * 0.05,
          width: s * 0.045,
          height: s * 0.045,
          borderRadius: s * 0.012,
          background: accent,
        }}
      />
      {["n1", "n2", "n3"].map((k, i) => bar(k, { left: `${62 + i * 8}%`, top: vh * 0.062, width: "5.5%", height: s * 0.018 }, 0.1))}
      <div
        style={{
          position: "absolute",
          right: "5%",
          top: vh * 0.045,
          width: "8%",
          height: s * 0.05,
          borderRadius: s,
          background: ink(0.78),
        }}
      />
      {bar("h1", { left: "50%", transform: "translateX(-50%)", top: vh * 0.24, width: "56%", height: s * 0.07 }, 0.72)}
      {bar("h2", { left: "50%", transform: "translateX(-50%)", top: vh * 0.34, width: "40%", height: s * 0.07 }, 0.72)}
      {bar("h3", { left: "50%", transform: "translateX(-50%)", top: vh * 0.47, width: "46%", height: s * 0.022 }, 0.16)}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: vh * 0.56,
          transform: "translateX(-104%)",
          width: "12%",
          height: s * 0.065,
          borderRadius: s,
          background: accent,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: vh * 0.56,
          transform: "translateX(4%)",
          width: "12%",
          height: s * 0.065,
          borderRadius: s,
          background: ink(0.06),
          border: `1px solid ${ink(0.12)}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "12%",
          right: "12%",
          top: vh * 0.72,
          height: vh * 0.32,
          borderRadius: s * 0.03,
          background: `linear-gradient(180deg, ${ink(0.06)} 0%, ${ink(0.02)} 100%)`,
          border: `1px solid ${ink(0.08)}`,
          boxShadow: `0 ${s * 0.04}px ${s * 0.12}px rgba(0,0,0,0.25)`,
        }}
      />
      {tiles}
      {bar("f1", { left: "7%", top: vh * 1.62, width: "30%", height: s * 0.05 }, 0.7)}
      {bar("f2", { left: "7%", top: vh * 1.71, width: "48%", height: s * 0.02 }, 0.12)}
      {bar("f3", { left: "7%", top: vh * 1.76, width: "40%", height: s * 0.02 }, 0.12)}
    </div>
  );
};

const LockIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" style={{ display: "block", flexShrink: 0 }}>
    <rect x={3} y={7} width={10} height={7.5} rx={1.8} fill={color} />
    <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke={color} strokeWidth={1.6} />
  </svg>
);

const BrowserWindow: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([{ family: "Inter", weight: 500 }]);
  const media = useAssetSrc(p.content);
  const theme = THEMES[p.theme];
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const margin = Math.min(w, h) * 0.04;
  const winW = w - margin * 2;
  const winH = h - margin * 2;
  const barH = Math.max(44 * unit, Math.min(76 * unit, winH * 0.09));
  const dot = barH * 0.2;
  const urlFs = Math.max(22 * unit, barH * 0.37);
  const pillH = barH * 0.6;
  const pillW = Math.min(winW * 0.5, Math.max(winW * 0.26, p.url.length * urlFs * 0.58 + urlFs * 3.4));
  const radius = Math.min(p.radius * unit, winH * 0.1);
  const viewH = winH - barH;

  // --- motion --------------------------------------------------------------
  const enter = p.entrance === "none" ? 1 : progress(frame, 0, 22, "smooth");
  const driftP = progress(frame, 0, Math.max(1, p.durationInFrames), "ease-in-out");
  const exitP = p.exit ? progress(frame, p.durationInFrames - 13, 12, "ease-in") : 0;
  let rotX = p.tilt;
  const rotY = p.drift * (driftP - 0.5);
  let ty = 0;
  let scale = 1;
  if (p.entrance === "rise") {
    ty = (1 - enter) * 60 * unit;
    scale = 0.965 + 0.035 * enter;
  } else if (p.entrance === "tilt") {
    rotX += (1 - enter) * 16;
    ty = (1 - enter) * 80 * unit;
    scale = 0.92 + 0.08 * enter;
  }
  ty += exitP * 30 * unit;
  scale *= 1 - 0.02 * exitP;
  const opacity = Math.min(1, enter * 1.6) * (1 - exitP);

  // --- scroll (object-position for media, translate for the skeleton) ------
  let scrollT = 0;
  if (p.scroll) {
    const start = Math.round(p.scrollDelay * fps);
    const total = Math.max(1, Math.round(p.scrollDuration * fps));
    if (p.scrollStyle === "steps") {
      const stops = 3;
      const seg = total / stops;
      for (let k = 0; k < stops; k++) scrollT += progress(frame, start + k * seg, seg * 0.55, "smooth") / stops;
    } else {
      scrollT = progress(frame, start, total, "ease-in-out");
    }
  }

  const perspective = p.tilt !== 0 || p.drift !== 0 || p.entrance === "tilt";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        perspective: perspective ? `${Math.round(Math.max(w, h) * 2.6)}px` : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: margin,
          top: margin,
          width: winW,
          height: winH,
          borderRadius: radius,
          overflow: "hidden",
          background: theme.page,
          border: `${Math.max(1, unit)}px solid ${theme.border}`,
          boxShadow: `0 ${50 * unit}px ${120 * unit}px rgba(0,0,0,${(0.5 * p.shadow).toFixed(3)}), 0 ${12 * unit}px ${32 * unit}px rgba(0,0,0,${(0.3 * p.shadow).toFixed(3)})`,
          boxSizing: "border-box",
          opacity,
          transform: `translateY(${ty.toFixed(2)}px) rotateX(${rotX.toFixed(3)}deg) rotateY(${rotY.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            height: barH,
            background: theme.bar,
            borderBottom: `${Math.max(1, unit)}px solid ${theme.border}`,
            display: "flex",
            alignItems: "center",
            padding: `0 ${barH * 0.36}px`,
            boxSizing: "border-box",
          }}
        >
          <TrafficLights size={dot} mono={p.dots === "mono"} monoColor={`rgba(${theme.ink},0.16)`} />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: pillW,
              height: pillH,
              borderRadius: pillH / 2,
              background: theme.pill,
              border: `${Math.max(1, unit)}px solid ${theme.border}`,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: urlFs * 0.4,
              padding: `0 ${urlFs}px`,
              fontFamily: fontStack("Inter"),
              fontWeight: 500,
              fontSize: urlFs,
              color: theme.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            <LockIcon size={urlFs * 0.78} color={theme.text} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.url}</span>
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: barH, bottom: 0, overflow: "hidden", background: theme.page }}>
          {media ? (
            <AssetMedia
              value={p.content}
              fit={p.fit}
              style={p.fit === "cover" ? { objectPosition: `50% ${(scrollT * 100).toFixed(3)}%` } : undefined}
            />
          ) : (
            <div style={{ position: "absolute", inset: 0, transform: `translateY(${(-scrollT * viewH).toFixed(2)}px)` }}>
              <PageSkeleton theme={theme} accent={p.accentColor} vw={winW} vh={viewH} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const browserWindow = defineMotionComponent<Props>({
  id: "browser-window",
  name: "Browser window",
  category: "device",
  description:
    "Minimal browser chrome (window dots, URL pill with lock, light/dark theme) framing a website screenshot or screen recording, with a smooth rise-in and an optional scroll through a tall full-page screenshot (stepped or continuous). Use to show a real product or landing page; set `content` to the capture.",
  schema: {
    content: { type: "asset", label: "Page media", default: "", description: "Screenshot (tall for scrolling) or screen recording" },
    url: { type: "string", label: "URL", default: "reframer.app" },
    theme: { type: "enum", label: "Theme", default: "dark", options: ["dark", "light"] },
    dots: { type: "enum", label: "Window dots", default: "color", options: ["color", "mono"] },
    fit: { type: "enum", label: "Fit", default: "cover", options: ["cover", "contain"] },
    scroll: { type: "boolean", label: "Scroll page", default: false, description: "Scrolls a tall screenshot from top to bottom" },
    scrollStyle: { type: "enum", label: "Scroll style", default: "steps", options: ["steps", "smooth"] },
    scrollDelay: { type: "number", label: "Scroll delay (s)", default: 0.8, min: 0, max: 20, step: 0.05 },
    scrollDuration: { type: "number", label: "Scroll time (s)", default: 3, min: 0.3, max: 30, step: 0.1 },
    entrance: { type: "enum", label: "Entrance", default: "rise", options: ["rise", "tilt", "none"] },
    tilt: { type: "number", label: "Tilt X (deg)", default: 0, min: -20, max: 20, step: 0.5 },
    drift: { type: "number", label: "Turn across clip (deg)", default: 0, min: -30, max: 30, step: 0.5 },
    radius: { type: "number", label: "Corner radius", default: 20, min: 0, max: 60, step: 1 },
    shadow: { type: "number", label: "Shadow", default: 0.7, min: 0, max: 1, step: 0.05 },
    accentColor: { type: "color", label: "Placeholder tint", default: "#FFB224" },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    content: "",
    url: "reframer.app",
    theme: "dark",
    dots: "color",
    fit: "cover",
    scroll: false,
    scrollStyle: "steps",
    scrollDelay: 0.8,
    scrollDuration: 3,
    entrance: "rise",
    tilt: 0,
    drift: 0,
    radius: 20,
    shadow: 0.7,
    accentColor: "#FFB224",
    exit: true,
  },
  defaultDuration: 5,
  defaultBox: { x: 0.5, y: 0.5, width: 0.8, height: 0.82 },
  Component: BrowserWindow,
  tags: ["device", "browser", "website", "screenshot", "saas", "product", "mockup"],
});
