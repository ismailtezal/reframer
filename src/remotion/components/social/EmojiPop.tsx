import type React from "react";
import { Img, useCurrentFrame, useVideoConfig } from "remotion";
import { useFonts } from "../../fonts";
import { lerp, progress, random01 } from "../helpers";
import { useAssetSrc } from "../media";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  emoji: string;
  /** Optional sticker image (PNG with transparency works best); replaces the emoji. */
  image: string;
  /** Size as a fraction of the box's shorter side. */
  size: number;
  rotation: number;
  sticker: boolean;
  burst: boolean;
  burstEmoji: string;
  burstCount: number;
  sparks: boolean;
  sparkColor: string;
  float: boolean;
  seed: number;
  exit: boolean;
};

// Loaded from Google Fonts so emoji look identical in preview and server renders.
const EMOJI_FONT = "Noto Color Emoji";
const EMOJI_STACK = `"${EMOJI_FONT}", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const Glyph: React.FC<{ emoji: string; src: string | null; size: number; style?: React.CSSProperties }> = ({ emoji, src, size, style }) =>
  src ? (
    <Img src={src} style={{ width: size, height: size, objectFit: "contain", display: "block", ...style }} />
  ) : (
    <div style={{ fontFamily: EMOJI_STACK, fontSize: size * 0.86, lineHeight: 1, width: size, textAlign: "center", ...style }}>{emoji}</div>
  );

const EmojiPop: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([{ family: EMOJI_FONT, weight: 400 }]);
  const media = useAssetSrc(p.image);
  const src = media?.kind === "image" ? media.src : null;
  // Timeline in 30 fps frames.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const S = Math.min(p.width, p.height) * p.size;
  const cx = p.width / 2;
  const cy = p.height / 2;

  // Pop: playful spring (overshoot is the point here), unwinding a little rotation.
  const pop = progress(t, 0, 26, "playful");
  const e = p.exit ? progress(t, last - 10, 10, "anticipate") : 0;
  const settled = Math.min(1, Math.max(0, (t - 18) / 22));
  const bob = p.float ? Math.sin(((t - 18) / 30) * Math.PI * 0.9) * settled : 0;
  const scale = Math.max(0, pop * (1 - e));
  const rot = p.rotation - (1 - pop) * 28 + bob * 2.5;
  const lift = (1 - pop) * S * 0.18 + bob * S * 0.025;

  const o = (S * 0.032).toFixed(2);
  const outline = p.sticker
    ? `drop-shadow(${o}px 0 0 #fff) drop-shadow(-${o}px 0 0 #fff) drop-shadow(0 ${o}px 0 #fff) drop-shadow(0 -${o}px 0 #fff) `
    : "";
  const shadow = `drop-shadow(0 ${(S * 0.035).toFixed(2)}px ${Math.min(12 * unit, S * 0.05).toFixed(2)}px rgba(0,0,0,0.28))`;

  const count = p.burst ? Math.max(0, Math.min(12, Math.round(p.burstCount))) : 0;
  const particles = Array.from({ length: count }, (_, i) => {
    const r = (k: number) => random01(p.seed * 31 + i * 7 + k);
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2 + (r(1) - 0.5) * (Math.PI / count);
    const start = 3 + r(4) * 3;
    const life = clamp01((t - start) / 32);
    const travel = progress(t, start, 32, "smooth");
    const dist = S * (0.75 + 0.35 * r(2));
    const size = S * (0.2 + 0.1 * r(3));
    const grow = life < 0.15 ? life / 0.15 : 1 - clamp01((life - 0.45) / 0.55) ** 2;
    return {
      key: `p${i}`,
      x: Math.cos(angle) * dist * travel,
      y: Math.sin(angle) * dist * travel + life * life * S * 0.22,
      size,
      scale: life > 0 && life < 1 ? grow : 0,
      rot: (r(5) - 0.5) * 90 * life,
    };
  });

  const sparkHead = progress(t, 2, 9, "smooth");
  const sparkTail = progress(t, 6, 10, "smooth");
  const sparkBox = S * 2.1;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {p.sparks && sparkHead > sparkTail + 0.01 ? (
        <svg
          width={sparkBox}
          height={sparkBox}
          viewBox={`${-sparkBox / 2} ${-sparkBox / 2} ${sparkBox} ${sparkBox}`}
          style={{ position: "absolute", left: cx - sparkBox / 2, top: cy - sparkBox / 2, display: "block" }}
        >
          {Array.from({ length: 8 }, (_, j) => {
            const ang = (j / 8) * Math.PI * 2 + Math.PI / 8;
            const r0 = S * 0.6;
            const r1 = S * (j % 2 ? 0.8 : 0.95);
            const from = lerp(r0, r1, sparkTail);
            const to = lerp(r0, r1, sparkHead);
            return (
              <line
                key={`s${ang.toFixed(3)}`}
                x1={Math.cos(ang) * from}
                y1={Math.sin(ang) * from}
                x2={Math.cos(ang) * to}
                y2={Math.sin(ang) * to}
                stroke={p.sparkColor}
                strokeWidth={S * 0.034}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      ) : null}
      {particles.map((q) =>
        q.scale > 0 ? (
          <div
            key={q.key}
            style={{
              position: "absolute",
              left: cx + q.x - q.size / 2,
              top: cy + q.y - q.size / 2,
              transform: `rotate(${q.rot.toFixed(2)}deg) scale(${q.scale.toFixed(4)})`,
            }}
          >
            <Glyph emoji={p.burstEmoji || p.emoji} src={p.burstEmoji ? null : src} size={q.size} />
          </div>
        ) : null,
      )}
      <div
        style={{
          position: "absolute",
          left: cx - S / 2,
          top: cy - S / 2,
          width: S,
          height: S,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translateY(${lift.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`,
          filter: `${outline}${shadow}`,
        }}
      >
        <Glyph emoji={p.emoji} src={src} size={S} />
      </div>
    </div>
  );
};

export const emojiPop = defineMotionComponent<Props>({
  id: "emoji-pop",
  name: "Emoji pop",
  category: "social",
  description:
    "Emoji or sticker image that pops in on a playful spring with a little twist, optional die-cut white outline, impact sparks and a burst of mini emoji, then floats. Scales with its box. Use for reactions and punchlines in shorts and social edits.",
  schema: {
    emoji: { type: "string", label: "Emoji", default: "🔥" },
    image: { type: "asset", label: "Sticker image", default: "", description: "Optional image that replaces the emoji" },
    size: { type: "number", label: "Size", default: 0.72, min: 0.1, max: 1, step: 0.01, description: "Fraction of the box's shorter side" },
    rotation: { type: "number", label: "Tilt", default: -8, min: -45, max: 45, step: 1 },
    sticker: { type: "boolean", label: "Sticker outline", default: true },
    burst: { type: "boolean", label: "Burst", default: true },
    burstEmoji: { type: "string", label: "Burst emoji", default: "✨", description: "Empty = same as the main emoji" },
    burstCount: { type: "number", label: "Burst count", default: 8, min: 0, max: 12, step: 1 },
    sparks: { type: "boolean", label: "Sparks", default: true },
    sparkColor: { type: "color", label: "Spark color", default: "#FFD60A" },
    float: { type: "boolean", label: "Float", default: true },
    seed: { type: "number", label: "Seed", default: 4, min: 0, max: 100, step: 1 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    emoji: "🔥",
    image: "",
    size: 0.72,
    rotation: -8,
    sticker: true,
    burst: true,
    burstEmoji: "✨",
    burstCount: 8,
    sparks: true,
    sparkColor: "#FFD60A",
    float: true,
    seed: 4,
    exit: true,
  },
  defaultDuration: 2.5,
  defaultBox: { x: 0.5, y: 0.5, width: 0.3, height: 0.3 },
  Component: EmojiPop,
  tags: ["emoji", "sticker", "reaction", "social", "pop", "shorts"],
});
