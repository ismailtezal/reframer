import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fontStack, useFonts } from "../../fonts";
import { lerp, progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  mode: "numbers" | "timer";
  /** Numbers: first number shown. Timer: seconds to count down from. */
  from: number;
  /** Seconds per number (numbers mode). */
  interval: number;
  animation: "scale" | "flip";
  /** Shown after the last number (numbers mode), e.g. "Go". */
  endText: string;
  ring: boolean;
  fontFamily: string;
  fontWeight: number;
  color: string;
  ringColor: string;
  cardColor: string;
  /** Fraction of the box's shorter side. */
  size: number;
  exit: boolean;
};

type CardStyle = { w: number; h: number; fontSize: number; font: string; weight: number; color: string; card: string };

/** One half of a split-flap card showing the top or bottom half of `label`. */
const Half: React.FC<{ c: CardStyle; label: string; half: "top" | "bottom"; shade?: number; transform?: string }> = ({
  c,
  label,
  half,
  shade = 0,
  transform,
}) => {
  const r = c.h * 0.09;
  const top = half === "top";
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: top ? 0 : c.h / 2,
        width: c.w,
        height: c.h / 2,
        overflow: "hidden",
        borderRadius: top ? `${r}px ${r}px 0 0` : `0 0 ${r}px ${r}px`,
        backgroundColor: c.card,
        backgroundImage: top
          ? "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))"
          : "linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0))",
        transformOrigin: top ? "50% 100%" : "50% 0%",
        transform,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: top ? 0 : -c.h / 2,
          width: c.w,
          height: c.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: c.font,
          fontWeight: c.weight,
          fontSize: c.fontSize,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          color: c.color,
        }}
      >
        {label}
      </div>
      {shade > 0.002 ? <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${shade.toFixed(3)})` }} /> : null}
    </div>
  );
};

/** Split-flap card flipping from `prev` to `next`; `lt` = 30 fps frames since the change. */
const FlipCard: React.FC<{ c: CardStyle; prev: string; next: string; lt: number }> = ({ c, prev, next, lt }) => {
  const fall = progress(lt, 0, 7, "ease-in");
  const land = progress(lt, 7, 7, "ease-out");
  const flipping = prev !== next && lt < 14;
  const persp = `perspective(${(c.h * 3.2).toFixed(1)}px)`;
  return (
    <div style={{ position: "relative", width: c.w, height: c.h, flexShrink: 0 }}>
      <Half c={c} label={next} half="top" />
      <Half c={c} label={flipping ? prev : next} half="bottom" shade={flipping ? 0.22 * fall * (1 - land) : 0} />
      {flipping && fall < 1 ? (
        <Half c={c} label={prev} half="top" shade={0.35 * fall} transform={`${persp} rotateX(${(-90 * fall).toFixed(2)}deg)`} />
      ) : null}
      {flipping && fall >= 1 ? (
        <Half
          c={c}
          label={next}
          half="bottom"
          shade={0.28 * (1 - land)}
          transform={`${persp} rotateX(${(90 * (1 - land)).toFixed(2)}deg)`}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: c.h / 2 - Math.max(1, c.h * 0.006),
          height: Math.max(2, c.h * 0.012),
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      />
    </div>
  );
};

const timerText = (secs: number) => {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

const Countdown: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([{ family: p.fontFamily, weight: p.fontWeight }]);
  // Timeline in 30 fps frames.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const S = Math.min(p.width, p.height) * p.size;
  const font = fontStack(p.fontFamily);
  const intro = progress(t, 0, 16, "smooth");
  const e = p.exit ? progress(t, last - 12, 12, "ease-in") : 0;
  const wrap: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 1 - e,
    transform: `scale(${1 - e * 0.06})`,
    filter: e > 0 ? `blur(${(e * 8 * unit).toFixed(2)}px)` : undefined,
  };

  if (p.mode === "timer") {
    const total = Math.max(0, Math.round(p.from));
    const tick = Math.min(total, Math.floor(t / 30));
    const lt = t - tick * 30;
    const now = timerText(total - tick);
    const before = timerText(total - Math.max(0, tick - 1));
    const chars = now.split("");
    const digits = chars.filter((ch) => ch !== ":").length;
    const colons = chars.length - digits;
    const flip = p.animation === "flip";
    // Fit the row into the box: digit slots + colons, in em of the font size.
    const rowEm = flip ? digits * 0.82 + colons * 0.34 : digits * 0.62 + colons * 0.32;
    const fs = Math.min((p.width * 0.9) / rowEm, (p.height * 0.62) / (flip ? 1.15 : 1));
    const card: CardStyle = {
      w: fs * 0.74,
      h: fs * 1.12,
      fontSize: fs * 0.9,
      font,
      weight: p.fontWeight,
      color: p.color,
      card: p.cardColor,
    };
    return (
      <div style={wrap}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: flip ? fs * 0.08 : 0,
            fontFamily: font,
            fontWeight: p.fontWeight,
            fontSize: fs,
            lineHeight: 1,
            color: p.color,
            opacity: intro,
            transform: `translateY(${(1 - intro) * 24 * unit}px)`,
          }}
        >
          {chars.map((ch, i) => {
            const key = `${chars.length - i}`;
            if (ch === ":") {
              return (
                <div key={key} style={{ width: "0.32em", textAlign: "center", transform: "translateY(-0.06em)", opacity: 0.85 }}>
                  :
                </div>
              );
            }
            const prevCh = before.length === now.length ? before[i] : ch;
            if (flip) return <FlipCard key={key} c={card} prev={prevCh} next={ch} lt={lt} />;
            const changed = prevCh !== ch && tick > 0;
            const q = changed ? progress(lt, 0, 10, "smooth") : 1;
            const old = changed ? 1 - progress(lt, 0, 6, "ease-in") : 0;
            return (
              <div
                key={key}
                style={{
                  position: "relative",
                  width: "0.62em",
                  height: "1em",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.02em",
                }}
              >
                {old > 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      textAlign: "center",
                      opacity: old,
                      transform: `translateY(${(-(1 - old) * 0.25).toFixed(3)}em) scale(${lerp(0.85, 1, old)})`,
                    }}
                  >
                    {prevCh}
                  </div>
                ) : null}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    textAlign: "center",
                    opacity: q,
                    transform: `scale(${lerp(1.2, 1, q).toFixed(4)})`,
                    filter: q < 1 ? `blur(${((1 - q) * 8 * unit).toFixed(2)}px)` : undefined,
                  }}
                >
                  {ch}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Numbers: from..1, then the optional end text.
  const count = Math.max(1, Math.round(p.from));
  const steps = count + (p.endText ? 1 : 0);
  const stepLen = Math.max(0.2, p.interval) * 30;
  const k = Math.min(steps - 1, Math.floor(t / stepLen));
  const lt = t - k * stepLen;
  const labelAt = (i: number) => (i < count ? String(count - i) : p.endText);
  const label = labelAt(k);
  const isEnd = k === steps - 1;
  const fit = (text: string) => (text.length <= 1 ? 1 : text.length === 2 ? 0.8 : 1.6 / text.length);

  let content: React.ReactNode;
  if (p.animation === "flip") {
    // One card size for every step, sized for the longest label.
    const h = S * 0.72;
    const longest = Math.max(...Array.from({ length: steps }, (_, i) => labelAt(i).length));
    const card: CardStyle = {
      w: h * Math.max(0.78, 0.3 + 0.48 * Math.min(longest, 3)),
      h,
      fontSize: h * 0.74 * (longest <= 1 ? 1 : longest === 2 ? 0.86 : 1.9 / longest),
      font,
      weight: p.fontWeight,
      color: p.color,
      card: p.cardColor,
    };
    content = (
      <div
        style={{
          opacity: intro,
          transform: `scale(${lerp(0.9, 1, intro)})`,
          filter: `drop-shadow(0 ${S * 0.04}px ${Math.min(12 * unit, S * 0.04)}px rgba(0,0,0,0.35))`,
        }}
      >
        <FlipCard c={card} prev={k > 0 ? labelAt(k - 1) : label} next={label} lt={k > 0 ? lt : 99} />
      </div>
    );
  } else {
    const enter = progress(lt, 0, 12, "smooth");
    const leave = isEnd ? 0 : progress(lt, stepLen - 6, 6, "ease-in");
    const drift = 1 - 0.04 * Math.min(1, lt / stepLen);
    const blur = (1 - enter) * 10 * unit + leave * 6 * unit;
    content = (
      <div
        style={{
          fontFamily: font,
          fontWeight: p.fontWeight,
          fontSize: S * 0.5 * fit(label),
          lineHeight: 1,
          letterSpacing: "-0.04em",
          fontVariantNumeric: "tabular-nums",
          color: p.color,
          opacity: Math.min(1, enter * 1.6) * (1 - leave),
          transform: `scale(${(lerp(1.35, 1, enter) * drift * lerp(1, 0.82, leave)).toFixed(4)})`,
          filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        {label}
      </div>
    );
  }

  // Ring: refills at each number, then drains until the next one.
  const R = S * 0.46;
  const ringW = Math.max(2, S * 0.028);
  const C = 2 * Math.PI * R;
  const frac = isEnd && p.endText ? 1 : lt < 8 ? progress(lt, 0, 8, "smooth") : 1 - Math.min(1, (lt - 8) / Math.max(1, stepLen - 8));
  const ringFade = isEnd && p.endText ? 1 - progress(lt, 0, 10, "smooth") : 1;
  const showRing = p.ring && p.animation === "scale";

  return (
    <div style={wrap}>
      <div style={{ position: "relative", width: S, height: S, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {showRing ? (
          <svg
            width={S}
            height={S}
            viewBox={`0 0 ${S} ${S}`}
            style={{
              position: "absolute",
              inset: 0,
              display: "block",
              opacity: intro * ringFade,
              transform: `scale(${lerp(0.9, 1, intro)})`,
            }}
          >
            <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke={p.ringColor} strokeOpacity={0.16} strokeWidth={ringW} />
            {frac > 0.004 ? (
              <circle
                cx={S / 2}
                cy={S / 2}
                r={R}
                fill="none"
                stroke={p.ringColor}
                strokeWidth={ringW}
                strokeLinecap="round"
                strokeDasharray={`${C} ${C}`}
                strokeDashoffset={C * (1 - frac)}
                transform={`rotate(-90 ${S / 2} ${S / 2})`}
              />
            ) : null}
          </svg>
        ) : null}
        {content}
      </div>
    </div>
  );
};

export const countdown = defineMotionComponent<Props>({
  id: "countdown",
  name: "Countdown",
  category: "data",
  description:
    "Countdown in two modes: numbers (3-2-1 with an optional end word like 'Go', one per interval) or timer (m:ss ticking down each second). Animate with a punchy scale + blur (numbers get a draining ring) or a split-flap flip. Scales with its box. Use for launches, reveals, races and timers.",
  schema: {
    mode: { type: "enum", label: "Mode", default: "numbers", options: ["numbers", "timer"] },
    from: { type: "number", label: "From", default: 3, min: 1, max: 5999, step: 1, description: "Numbers: first number. Timer: seconds" },
    interval: {
      type: "number",
      label: "Interval (s)",
      default: 1,
      min: 0.2,
      max: 10,
      step: 0.05,
      description: "Seconds per number (numbers mode)",
    },
    animation: { type: "enum", label: "Animation", default: "scale", options: ["scale", "flip"] },
    endText: { type: "string", label: "End text", default: "", description: "Shown after the last number, e.g. 'Go' (numbers mode)" },
    ring: { type: "boolean", label: "Ring", default: true },
    fontFamily: { type: "font", label: "Font", default: "Inter Tight" },
    fontWeight: { type: "number", label: "Weight", default: 700, min: 100, max: 900, step: 100 },
    color: { type: "color", label: "Color", default: "#FFFFFF" },
    ringColor: { type: "color", label: "Ring color", default: "#FFFFFF" },
    cardColor: { type: "color", label: "Flip card", default: "#1C1C1F" },
    size: { type: "number", label: "Size", default: 0.86, min: 0.2, max: 1, step: 0.01, description: "Fraction of the box's shorter side" },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    mode: "numbers",
    from: 3,
    interval: 1,
    animation: "scale",
    endText: "",
    ring: true,
    fontFamily: "Inter Tight",
    fontWeight: 700,
    color: "#FFFFFF",
    ringColor: "#FFFFFF",
    cardColor: "#1C1C1F",
    size: 0.86,
    exit: true,
  },
  defaultDuration: 3.2,
  defaultBox: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
  Component: Countdown,
  tags: ["countdown", "timer", "3-2-1", "flip clock", "launch", "numbers"],
});
