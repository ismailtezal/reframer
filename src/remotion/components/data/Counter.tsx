import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { resolveEasing } from "../../../core/easing";
import { fontStack, useFonts } from "../../fonts";
import { formatNumber, progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  from: number;
  to: number;
  decimals: number;
  prefix: string;
  suffix: string;
  compact: boolean;
  label: string;
  fontFamily: string;
  fontWeight: number;
  color: string;
  labelColor: string;
  fontSize: number;
  /** seconds the count takes */
  countDuration: number;
  easing: "smooth" | "ease-in-out" | "linear" | "heavy";
  /** Tick-up digits slot-machine style */
  rolling: boolean;
};

const Counter: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([
    { family: p.fontFamily, weight: p.fontWeight },
    { family: p.fontFamily, weight: 500 },
  ]);
  const dur = Math.max(1, p.countDuration * fps);
  const t = Math.min(1, Math.max(0, frame / dur));
  const value = p.from + (p.to - p.from) * resolveEasing(p.easing)(t);
  const text = formatNumber(value, { decimals: p.decimals, compact: p.compact, prefix: p.prefix, suffix: p.suffix });
  const enter = progress(frame, 0, 14, "smooth");
  const labelP = progress(frame, 6, 16, "smooth");
  const size = p.fontSize * unit;
  // Settle "kick" when the count lands.
  const land = progress(frame, dur - 2, 10, "playful");
  const kick = frame >= dur - 2 ? 1 + 0.04 * Math.sin(land * Math.PI) : 1;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: size * 0.12,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 20 * unit}px) scale(${kick})`,
      }}
    >
      <div
        style={{
          fontFamily: fontStack(p.fontFamily),
          fontWeight: p.fontWeight,
          fontSize: size,
          lineHeight: 1,
          color: p.color,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          filter: p.rolling && t < 1 ? `blur(${(1 - t) * 1.5 * unit}px)` : undefined,
        }}
      >
        {text}
      </div>
      {p.label ? (
        <div
          style={{
            fontFamily: fontStack(p.fontFamily),
            fontWeight: 500,
            fontSize: Math.max(26 * unit, size * 0.22),
            color: p.labelColor,
            opacity: labelP,
            transform: `translateY(${(1 - labelP) * 10 * unit}px)`,
            letterSpacing: "0.01em",
          }}
        >
          {p.label}
        </div>
      ) : null}
    </div>
  );
};

export const counter = defineMotionComponent<Props>({
  id: "counter",
  name: "Counter",
  category: "data",
  description:
    "Big number that counts up with an eased landing (K/M/B compact formatting, prefix/suffix like $ or %). Use for stats, metrics, money, followers.",
  schema: {
    from: { type: "number", label: "From", default: 0 },
    to: { type: "number", label: "To", default: 12500 },
    decimals: { type: "number", label: "Decimals", default: 0, min: 0, max: 3, step: 1 },
    prefix: { type: "string", label: "Prefix", default: "" },
    suffix: { type: "string", label: "Suffix", default: "+" },
    compact: { type: "boolean", label: "Compact (12.5K)", default: false },
    label: { type: "string", label: "Label", default: "happy users" },
    fontFamily: { type: "font", label: "Font", default: "Inter Tight" },
    fontWeight: { type: "number", label: "Weight", default: 800, min: 100, max: 900, step: 100 },
    color: { type: "color", label: "Color", default: "#FFFFFF" },
    labelColor: { type: "color", label: "Label color", default: "#A1A1AA" },
    fontSize: { type: "number", label: "Size", default: 220, min: 24, max: 500, step: 1 },
    countDuration: { type: "number", label: "Count time (s)", default: 1.6, min: 0.2, max: 10, step: 0.1 },
    easing: { type: "enum", label: "Easing", default: "smooth", options: ["smooth", "ease-in-out", "linear", "heavy"] },
    rolling: { type: "boolean", label: "Motion blur while counting", default: true },
  },
  defaults: {
    from: 0,
    to: 12500,
    decimals: 0,
    prefix: "",
    suffix: "+",
    compact: false,
    label: "happy users",
    fontFamily: "Inter Tight",
    fontWeight: 800,
    color: "#FFFFFF",
    labelColor: "#A1A1AA",
    fontSize: 220,
    countDuration: 1.6,
    easing: "smooth",
    rolling: true,
  },
  defaultDuration: 3,
  defaultBox: { x: 0.5, y: 0.5, width: 0.7, height: 0.5 },
  Component: Counter,
  tags: ["stats", "number", "data", "money"],
});
