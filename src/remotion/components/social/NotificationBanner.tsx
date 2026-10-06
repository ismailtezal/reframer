import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mixColors } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { lerp, progress } from "../helpers";
import { AssetMedia, useAssetSrc } from "../media";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  icon: string;
  title: string;
  body: string;
  time: string;
  theme: "light" | "dark";
  accentColor: string;
  fontFamily: string;
  scale: number;
  exit: boolean;
};

const BANNER_W = 980;

const THEMES = {
  light: {
    bg: "rgba(246,246,248,0.95)",
    edge: "rgba(255,255,255,0.7)",
    shadow: "rgba(0,0,0,0.28)",
    title: "#000000",
    body: "#1C1C1E",
    time: "#8A8A8E",
  },
  dark: {
    bg: "rgba(30,30,32,0.93)",
    edge: "rgba(255,255,255,0.1)",
    shadow: "rgba(0,0,0,0.45)",
    title: "#FFFFFF",
    body: "#E5E5EA",
    time: "#98989F",
  },
} as const;

const NotificationBanner: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([
    { family: p.fontFamily, weight: 400 },
    { family: p.fontFamily, weight: 600 },
  ]);
  const hasIcon = useAssetSrc(p.icon) !== null;
  // Timeline in 30 fps frames.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const s = Math.min(unit * p.scale, p.width / BANNER_W);
  const d = (v: number) => v * s;
  const th = THEMES[p.theme] ?? THEMES.light;

  // Drops in from above and settles without bouncing; retracts upward on exit.
  const drop = progress(t, 0, 22, "smooth");
  const e = p.exit ? progress(t, last - 12, 12, "ease-in") : 0;
  const offset = 1 - drop + e;
  const fade = (delay: number) => progress(t, delay, 14, "smooth");

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div
        style={{
          width: d(BANNER_W),
          flexShrink: 0,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: d(26),
          padding: `${d(28)}px ${d(32)}px ${d(30)}px ${d(28)}px`,
          borderRadius: d(52),
          backgroundColor: th.bg,
          border: `${Math.max(1, s)}px solid ${th.edge}`,
          boxShadow: `0 ${d(18)}px ${d(54)}px ${th.shadow}`,
          fontFamily: fontStack(p.fontFamily),
          transformOrigin: "50% 0%",
          opacity: Math.min(1, drop * 3) * (1 - e),
          transform: `translateY(calc(${(-offset * 110).toFixed(3)}% - ${(offset * d(24)).toFixed(2)}px)) scale(${lerp(0.94, 1, drop) - e * 0.03})`,
        }}
      >
        <div style={{ width: d(88), height: d(88), flexShrink: 0, borderRadius: d(20), overflow: "hidden", opacity: fade(4) }}>
          {hasIcon ? (
            <AssetMedia value={p.icon} />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
                backgroundImage: `linear-gradient(180deg, ${mixColors(p.accentColor, "#FFFFFF", 0.18)}, ${mixColors(p.accentColor, "#000000", 0.18)})`,
              }}
            >
              <svg width={d(50)} height={d(50)} viewBox="0 0 24 24" style={{ display: "block" }}>
                <path
                  d="M12 3.4a5.6 5.6 0 0 0-5.6 5.6v3.6l-1.7 2.9a.8.8 0 0 0 .7 1.2h13.2a.8.8 0 0 0 .7-1.2l-1.7-2.9V9A5.6 5.6 0 0 0 12 3.4z"
                  fill="#FFFFFF"
                />
                <path d="M9.6 18.9a2.5 2.5 0 0 0 4.8 0z" fill="#FFFFFF" />
              </svg>
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: d(16), opacity: fade(6) }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: d(37),
                fontWeight: 600,
                lineHeight: 1.25,
                letterSpacing: "-0.015em",
                color: th.title,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {p.title}
            </div>
            {p.time ? <div style={{ flexShrink: 0, fontSize: d(30), color: th.time }}>{p.time}</div> : null}
          </div>
          {p.body ? (
            <div style={{ marginTop: d(4), fontSize: d(37), lineHeight: 1.28, letterSpacing: "-0.01em", color: th.body, opacity: fade(8) }}>
              {p.body}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const notificationBanner = defineMotionComponent<Props>({
  id: "notification-banner",
  name: "Notification banner",
  category: "social",
  description:
    "Phone-style push notification that drops in from the top: app icon (or a generic bell icon), bold title, time and body, light or dark material. Put the box near the top of the frame. Use for story beats, app demos and 'you've got a sale' moments.",
  schema: {
    icon: { type: "asset", label: "App icon", default: "", description: "Square image; empty shows a generic bell icon" },
    title: { type: "string", label: "Title", default: "New order from Lisbon" },
    body: { type: "text", label: "Body", default: "Someone just bought the Studio plan. That's 12 sales today." },
    time: { type: "string", label: "Time", default: "now" },
    theme: { type: "enum", label: "Theme", default: "light", options: ["light", "dark"] },
    accentColor: { type: "color", label: "Icon color", default: "#0A84FF", description: "Used for the placeholder icon" },
    fontFamily: { type: "font", label: "Font", default: "Inter" },
    scale: { type: "number", label: "Scale", default: 1, min: 0.3, max: 3, step: 0.05 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    icon: "",
    title: "New order from Lisbon",
    body: "Someone just bought the Studio plan. That's 12 sales today.",
    time: "now",
    theme: "light",
    accentColor: "#0A84FF",
    fontFamily: "Inter",
    scale: 1,
    exit: true,
  },
  defaultDuration: 4,
  defaultBox: { x: 0.5, y: 0.15, width: 0.9, height: 0.24 },
  Component: NotificationBanner,
  tags: ["notification", "ios", "push", "phone", "app", "alert"],
});
