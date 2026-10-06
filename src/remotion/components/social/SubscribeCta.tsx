import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mixColors } from "../../../core/color";
import { resolveEasing } from "../../../core/easing";
import { fontStack, useFonts } from "../../fonts";
import { CursorArrow } from "../annotation/CursorClick";
import { lerp, progress } from "../helpers";
import { AssetMedia, useAssetSrc } from "../media";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  channel: string;
  subscribers: string;
  avatar: string;
  theme: "dark" | "light";
  buttonColor: string;
  /** Seconds into the clip when the button gets clicked. */
  clickAt: number;
  cursor: boolean;
  bell: boolean;
  fontFamily: string;
  scale: number;
  exit: boolean;
};

// Fixed design canvas (px at scale 1); positions are known so the cursor can hit the buttons.
const PILL_W = 900;
const PILL_H = 136;
const BUTTON = { x: 510, w: 264, h: 84 };
const BELL = { x: 790, size: 84 };

const THEMES = {
  dark: {
    bg: "rgba(18,18,20,0.94)",
    edge: "rgba(255,255,255,0.09)",
    shadow: "rgba(0,0,0,0.45)",
    text: "#F1F1F1",
    sub: "#AAAAAA",
    chip: "#2A2A2D",
  },
  light: { bg: "#FFFFFF", edge: "rgba(0,0,0,0.06)", shadow: "rgba(0,0,0,0.22)", text: "#0F0F0F", sub: "#606060", chip: "#F0F0F0" },
} as const;

const glide = resolveEasing({ type: "bezier", x1: 0.55, y1: 0, x2: 0.15, y2: 1 });

const BELL_PATH = "M12 3.6a5.4 5.4 0 0 0-5.4 5.4v3.5l-1.6 2.8a.8.8 0 0 0 .7 1.2h12.6a.8.8 0 0 0 .7-1.2l-1.6-2.8V9A5.4 5.4 0 0 0 12 3.6z";

const SubscribeCta: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([
    { family: p.fontFamily, weight: 500 },
    { family: p.fontFamily, weight: 600 },
    { family: p.fontFamily, weight: 700 },
  ]);
  const hasAvatar = useAssetSrc(p.avatar) !== null;
  // Timeline in 30 fps frames.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const s = Math.min(unit * p.scale, p.width / PILL_W, p.height / PILL_H);
  const d = (v: number) => v * s;
  const th = THEMES[p.theme] ?? THEMES.dark;

  // Choreography: pill in, items stagger, cursor clicks Subscribe, then the bell.
  const pill = progress(t, 0, 18, "snappy");
  const item = (delay: number): React.CSSProperties => {
    const q = progress(t, delay, 16, "smooth");
    return { opacity: q, transform: `translateX(${(1 - q) * 12 * s}px)` };
  };
  const click = p.clickAt * 30;
  const ring = click + 24;
  const pressAt = (at: number) => progress(t, at, 3, "ease-out") * (1 - progress(t, at + 3, 8, "smooth"));
  const subscribed = progress(t, click + 1, 8, "smooth");
  const bellOn = p.bell ? progress(t, ring + 1, 6, "smooth") : 0;
  const swing = p.bell && t > ring ? 18 * Math.exp(-(t - ring) / 9) * Math.sin((t - ring) * 0.85) : 0;
  const e = p.exit ? progress(t, last - 12, 12, "ease-in") : 0;

  // Cursor path in pill coordinates.
  const btn = { x: BUTTON.x + BUTTON.w * 0.52, y: PILL_H / 2 + 10 };
  const bellPt = { x: BELL.x + BELL.size * 0.52, y: PILL_H / 2 + 8 };
  const legs = [
    { from: { x: PILL_W + 90, y: PILL_H + 120 }, to: btn, start: click - 22, dur: 20 },
    { from: btn, to: bellPt, start: click + 8, dur: 14 },
    { from: bellPt, to: { x: bellPt.x + 70, y: bellPt.y + 80 }, start: ring + 14, dur: 18 },
  ];
  const leg = legs.find((l, i) => t < l.start + l.dur || i === legs.length - 1) ?? legs[0];
  const m = glide(Math.min(1, Math.max(0, (t - leg.start) / leg.dur)));
  const cursorPos = { x: lerp(leg.from.x, leg.to.x, m), y: lerp(leg.from.y, leg.to.y, m) };
  const cursorOpacity = progress(t, click - 26, 6, "smooth") * (1 - progress(t, ring + 16, 10, "smooth"));

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "relative",
          width: d(PILL_W),
          height: d(PILL_H),
          flexShrink: 0,
          boxSizing: "border-box",
          borderRadius: d(PILL_H / 2),
          backgroundColor: th.bg,
          border: `${Math.max(1, s)}px solid ${th.edge}`,
          boxShadow: `0 ${d(24)}px ${d(60)}px ${th.shadow}`,
          fontFamily: fontStack(p.fontFamily),
          opacity: Math.min(1, pill * 1.6) * (1 - e),
          transform: `translateY(${(1 - pill) * d(28) + e * d(18)}px) scale(${lerp(0.94, 1, pill) - e * 0.03})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: d(22),
            top: d(22),
            width: d(92),
            height: d(92),
            borderRadius: "50%",
            overflow: "hidden",
            ...item(4),
          }}
        >
          {hasAvatar ? (
            <AssetMedia value={p.avatar} />
          ) : (
            <svg width="100%" height="100%" viewBox="0 0 24 24" style={{ display: "block" }}>
              <circle cx="12" cy="12" r="12" fill={p.buttonColor} />
              <path d="M9.6 7.9v8.2a.9.9 0 0 0 1.36.77l6.7-4.1a.9.9 0 0 0 0-1.54l-6.7-4.1A.9.9 0 0 0 9.6 7.9z" fill="#FFFFFF" />
            </svg>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: d(140),
            width: d(BUTTON.x - 140 - 24),
            top: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: d(4),
            ...item(7),
          }}
        >
          <div
            style={{
              fontSize: d(38),
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              color: th.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {p.channel}
          </div>
          {p.subscribers ? (
            <div style={{ fontSize: d(28), fontWeight: 500, lineHeight: 1.2, color: th.sub, whiteSpace: "nowrap" }}>{p.subscribers}</div>
          ) : null}
        </div>
        <div
          style={{
            position: "absolute",
            left: d(BUTTON.x),
            top: d((PILL_H - BUTTON.h) / 2),
            width: d(BUTTON.w),
            height: d(BUTTON.h),
            ...item(10),
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: d(BUTTON.h / 2),
              backgroundColor: mixColors(p.buttonColor, th.chip, subscribed),
              display: "grid",
              placeItems: "center",
              fontSize: d(32),
              fontWeight: 600,
              letterSpacing: "-0.01em",
              transform: `scale(${1 - 0.06 * pressAt(click)})`,
            }}
          >
            <span
              style={{ gridArea: "1 / 1", color: "#FFFFFF", opacity: 1 - subscribed, transform: `translateY(${-subscribed * d(10)}px)` }}
            >
              Subscribe
            </span>
            <span
              style={{
                gridArea: "1 / 1",
                display: "flex",
                alignItems: "center",
                gap: d(10),
                color: th.text,
                opacity: subscribed,
                transform: `translateY(${(1 - subscribed) * d(10)}px)`,
              }}
            >
              <svg width={d(30)} height={d(30)} viewBox="0 0 24 24" style={{ display: "block" }}>
                <path
                  d="M5 12.5l4.3 4.3L19 7.2"
                  fill="none"
                  stroke={th.text}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Subscribed
            </span>
          </div>
        </div>
        {p.bell ? (
          <div
            style={{
              position: "absolute",
              left: d(BELL.x),
              top: d((PILL_H - BELL.size) / 2),
              width: d(BELL.size),
              height: d(BELL.size),
              borderRadius: "50%",
              backgroundColor: th.chip,
              display: "grid",
              placeItems: "center",
              ...item(13),
            }}
          >
            <svg
              width={d(46)}
              height={d(46)}
              viewBox="0 0 24 24"
              style={{
                display: "block",
                overflow: "visible",
                transformOrigin: "50% 15%",
                transform: `rotate(${swing.toFixed(2)}deg) scale(${1 - 0.08 * pressAt(ring)})`,
              }}
            >
              <path d={BELL_PATH} fill={th.text} fillOpacity={bellOn} stroke={th.text} strokeWidth={1.8} strokeLinejoin="round" />
              <path d="M9.8 19.2a2.3 2.3 0 0 0 4.4 0" fill="none" stroke={th.text} strokeWidth={1.8} strokeLinecap="round" />
              <g opacity={bellOn} fill="none" stroke={th.text} strokeWidth={1.8} strokeLinecap="round">
                <path d="M3.6 5.6a9.5 9.5 0 0 0-1.5 4.2" />
                <path d="M20.4 5.6a9.5 9.5 0 0 1 1.5 4.2" />
              </g>
            </svg>
          </div>
        ) : null}
        {p.cursor && cursorOpacity > 0 ? (
          <CursorArrow
            x={d(cursorPos.x)}
            y={d(cursorPos.y)}
            height={d(52)}
            fill="#0A0A0A"
            outline="#FFFFFF"
            press={Math.max(pressAt(click), p.bell ? pressAt(ring) : 0)}
            opacity={cursorOpacity}
          />
        ) : null}
      </div>
    </div>
  );
};

export const subscribeCta = defineMotionComponent<Props>({
  id: "subscribe-cta",
  name: "Subscribe CTA",
  category: "social",
  description:
    "Generic video-channel subscribe pill: avatar (or a simple play-shape icon), channel name and count; a cursor presses Subscribe (it turns to Subscribed) and rings the bell. No real logos. Use as an end-screen or mid-roll call to action.",
  schema: {
    channel: { type: "string", label: "Channel", default: "Reframer" },
    subscribers: { type: "string", label: "Subscribers", default: "1.2M subscribers" },
    avatar: { type: "asset", label: "Avatar", default: "", description: "Channel image; empty shows a play-shape icon" },
    theme: { type: "enum", label: "Theme", default: "dark", options: ["dark", "light"] },
    buttonColor: { type: "color", label: "Button color", default: "#FF0033" },
    clickAt: { type: "number", label: "Click at (s)", default: 1.3, min: 0.4, max: 20, step: 0.05 },
    cursor: { type: "boolean", label: "Cursor", default: true },
    bell: { type: "boolean", label: "Bell", default: true },
    fontFamily: { type: "font", label: "Font", default: "Inter" },
    scale: { type: "number", label: "Scale", default: 1, min: 0.3, max: 3, step: 0.05 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    channel: "Reframer",
    subscribers: "1.2M subscribers",
    avatar: "",
    theme: "dark",
    buttonColor: "#FF0033",
    clickAt: 1.3,
    cursor: true,
    bell: true,
    fontFamily: "Inter",
    scale: 1,
    exit: true,
  },
  defaultDuration: 4.5,
  defaultBox: { x: 0.5, y: 0.82, width: 0.8, height: 0.2 },
  Component: SubscribeCta,
  tags: ["subscribe", "cta", "youtube", "end screen", "social", "button"],
});
