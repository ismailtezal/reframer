import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mixColors } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { formatNumber, lerp, progress } from "../helpers";
import { AssetMedia, useAssetSrc } from "../media";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  avatar: string;
  name: string;
  handle: string;
  time: string;
  verified: boolean;
  text: string;
  replies: number;
  reposts: number;
  likes: number;
  liked: boolean;
  theme: "dark" | "light";
  accentColor: string;
  likeColor: string;
  /** Seconds the counters take to count up. */
  countDuration: number;
  fontFamily: string;
  scale: number;
  exit: boolean;
};

const CARD_W = 920;

const THEMES = {
  dark: { bg: "#16181C", edge: "rgba(255,255,255,0.08)", shadow: "rgba(0,0,0,0.5)", text: "#F2F4F5", sub: "#7D8590" },
  light: { bg: "#FFFFFF", edge: "rgba(14,17,22,0.08)", shadow: "rgba(16,20,40,0.18)", text: "#0E1116", sub: "#5E6670" },
} as const;

const ICONS = {
  reply: "M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z",
  repost: "M17 2.8l3.4 3.4L17 9.6M3.6 11V9.6a3.4 3.4 0 0 1 3.4-3.4h13.4M7 21.2l-3.4-3.4L7 14.4M20.4 13v1.4a3.4 3.4 0 0 1-3.4 3.4H3.6",
  heart:
    "M12 20.2s-7.6-4.5-9.3-9.2C1.6 7.8 3.7 4.6 7 4.6c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.3 0 5.4 3.2 4.3 6.4-1.7 4.7-9.3 9.2-9.3 9.2z",
  share: "M12 3.5v12M7.5 8L12 3.5 16.5 8M5 13.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5",
} as const;

const Icon: React.FC<{ d: string; size: number; color: string; fill?: string; style?: React.CSSProperties }> = ({
  d,
  size,
  color,
  fill,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", overflow: "visible", ...style }}>
    <path d={d} fill={fill ?? "none"} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** "12.4K", "842", "1.2M" — no trailing ".0". */
const compact = (v: number) => formatNumber(v, { compact: true, decimals: v >= 1000 ? 1 : 0 }).replace(".0", "");

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const SocialPost: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([
    { family: p.fontFamily, weight: 400 },
    { family: p.fontFamily, weight: 500 },
    { family: p.fontFamily, weight: 700 },
  ]);
  const hasAvatar = useAssetSrc(p.avatar) !== null;
  // Timeline in 30 fps frames.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const s = Math.min(unit * p.scale, p.width / CARD_W);
  const d = (v: number) => v * s;
  const th = THEMES[p.theme] ?? THEMES.dark;

  const card = progress(t, 0, 26, "apple");
  const rise = (delay: number): React.CSSProperties => {
    const q = progress(t, delay, 20, "apple");
    return { opacity: q, transform: `translateY(${(1 - q) * d(14)}px)` };
  };
  const countStart = 18;
  const countLen = Math.max(1, p.countDuration * 30);
  const counted = progress(t, countStart, countLen, "smooth");
  const likeAt = countStart + countLen * 0.55;
  const heart = p.liked ? progress(t, likeAt, 20, "playful") : 0;
  const burst = p.liked ? progress(t, likeAt, 16, "smooth") : 0;
  const e = p.exit ? progress(t, last - 12, 12, "ease-in") : 0;

  /** Icon + counter; `active` (0..1) tints it with the like color. */
  const stat = (key: keyof typeof ICONS, value: number, active = 0) => (
    <div style={{ display: "flex", alignItems: "center", gap: d(12), color: mixColors(th.sub, p.likeColor, active) }}>
      <div style={{ position: "relative", width: d(34), height: d(34) }}>
        <Icon
          d={ICONS[key]}
          size={d(34)}
          color={mixColors(th.sub, p.likeColor, active)}
          style={{ opacity: key === "heart" ? 1 - Math.min(1, heart) : 1 }}
        />
        {key === "heart" && p.liked ? (
          <>
            {burst > 0 && burst < 1
              ? Array.from({ length: 7 }, (_, i) => {
                  const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
                  const r = d(10 + 22 * burst);
                  return (
                    <div
                      key={`b${a.toFixed(3)}`}
                      style={{
                        position: "absolute",
                        left: d(17) + Math.cos(a) * r - d(3.5),
                        top: d(17) + Math.sin(a) * r - d(3.5),
                        width: d(7),
                        height: d(7),
                        borderRadius: "50%",
                        backgroundColor: i % 2 ? p.accentColor : p.likeColor,
                        transform: `scale(${1 - burst})`,
                      }}
                    />
                  );
                })
              : null}
            <Icon
              d={ICONS.heart}
              size={d(34)}
              color={p.likeColor}
              fill={p.likeColor}
              style={{ position: "absolute", left: 0, top: 0, transform: `scale(${Math.max(0, heart)})` }}
            />
          </>
        ) : null}
      </div>
      <span style={{ fontSize: d(30), fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{compact(Math.round(value * counted))}</span>
    </div>
  );

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: d(CARD_W),
          flexShrink: 0,
          boxSizing: "border-box",
          padding: `${d(44)}px ${d(48)}px ${d(36)}px`,
          borderRadius: d(36),
          backgroundColor: th.bg,
          border: `${Math.max(1, s)}px solid ${th.edge}`,
          boxShadow: `0 ${d(30)}px ${d(80)}px ${th.shadow}`,
          fontFamily: fontStack(p.fontFamily),
          color: th.text,
          opacity: Math.min(1, card * 1.5) * (1 - e),
          transform: `translateY(${(1 - card) * d(40) + e * d(16)}px) scale(${lerp(0.97, 1, card) - e * 0.015})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: d(22), ...rise(5) }}>
          <div style={{ width: d(92), height: d(92), borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
            {hasAvatar ? (
              <AssetMedia value={p.avatar} />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  backgroundImage: `linear-gradient(135deg, ${p.accentColor}, ${mixColors(p.accentColor, "#000000", 0.45)})`,
                  color: "#FFFFFF",
                  fontSize: d(36),
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                {initials(p.name)}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: d(10) }}>
              <span
                style={{
                  fontSize: d(36),
                  fontWeight: 700,
                  letterSpacing: "-0.015em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.name}
              </span>
              {p.verified ? (
                <svg width={d(32)} height={d(32)} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="11" fill={p.accentColor} />
                  <path
                    d="M7.2 12.4l3.2 3.1 6.4-6.8"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </div>
            <div
              style={{
                marginTop: d(4),
                fontSize: d(30),
                color: th.sub,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {[p.handle, p.time].filter(Boolean).join(" · ")}
            </div>
          </div>
          <svg width={d(36)} height={d(36)} viewBox="0 0 24 24" style={{ display: "block", alignSelf: "flex-start", marginTop: d(6) }}>
            {[5, 12, 19].map((x) => (
              <circle key={x} cx={x} cy="12" r="1.9" fill={th.sub} />
            ))}
          </svg>
        </div>
        <div style={{ marginTop: d(28), fontSize: d(40), lineHeight: 1.38, letterSpacing: "-0.01em", whiteSpace: "pre-wrap", ...rise(9) }}>
          {p.text.split(/(\s+)/).map((w, i) =>
            /^[#@]\w/.test(w) ? (
              <span key={`${i}-${w}`} style={{ color: p.accentColor }}>
                {w}
              </span>
            ) : (
              w
            ),
          )}
        </div>
        <div style={{ marginTop: d(32), height: Math.max(1, s), backgroundColor: th.edge, ...rise(12) }} />
        {/* Fixed columns so counters never shift the row while they tick up. */}
        <div style={{ marginTop: d(26), display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", ...rise(13) }}>
          {stat("reply", p.replies)}
          {stat("repost", p.reposts)}
          {stat("heart", p.likes, Math.min(1, heart))}
          <Icon d={ICONS.share} size={d(34)} color={th.sub} />
        </div>
      </div>
    </div>
  );
};

export const socialPost = defineMotionComponent<Props>({
  id: "social-post",
  name: "Social post",
  category: "social",
  description:
    "Generic social media post card (no real logos): avatar, name, verified dot, handle, text with #tags/@mentions in the accent color, and reply/repost/like counts that count up before the heart pops. Light or dark theme. Use to show reactions, testimonials or viral posts.",
  schema: {
    avatar: { type: "asset", label: "Avatar", default: "", description: "Profile image; empty shows initials" },
    name: { type: "string", label: "Name", default: "Maya Chen" },
    handle: { type: "string", label: "Handle", default: "@mayamakes" },
    time: { type: "string", label: "Time", default: "2h" },
    verified: { type: "boolean", label: "Verified", default: true },
    text: {
      type: "text",
      label: "Text",
      default:
        "Cut a full launch video in one afternoon. The AI drafted it, I tweaked every frame by hand. This is how editing should feel. #buildinpublic",
    },
    replies: { type: "number", label: "Replies", default: 482, min: 0, step: 1 },
    reposts: { type: "number", label: "Reposts", default: 2140, min: 0, step: 1 },
    likes: { type: "number", label: "Likes", default: 18400, min: 0, step: 1 },
    liked: { type: "boolean", label: "Heart pops", default: true },
    theme: { type: "enum", label: "Theme", default: "dark", options: ["dark", "light"] },
    accentColor: { type: "color", label: "Accent", default: "#3D8BFF" },
    likeColor: { type: "color", label: "Like color", default: "#FF3B6B" },
    countDuration: { type: "number", label: "Count time (s)", default: 1.4, min: 0.2, max: 10, step: 0.1 },
    fontFamily: { type: "font", label: "Font", default: "Inter" },
    scale: { type: "number", label: "Scale", default: 1, min: 0.3, max: 3, step: 0.05 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    avatar: "",
    name: "Maya Chen",
    handle: "@mayamakes",
    time: "2h",
    verified: true,
    text: "Cut a full launch video in one afternoon. The AI drafted it, I tweaked every frame by hand. This is how editing should feel. #buildinpublic",
    replies: 482,
    reposts: 2140,
    likes: 18400,
    liked: true,
    theme: "dark",
    accentColor: "#3D8BFF",
    likeColor: "#FF3B6B",
    countDuration: 1.4,
    fontFamily: "Inter",
    scale: 1,
    exit: true,
  },
  defaultDuration: 5,
  defaultBox: { x: 0.5, y: 0.5, width: 0.86, height: 0.66 },
  Component: SocialPost,
  tags: ["social", "post", "tweet", "testimonial", "card", "likes"],
});
