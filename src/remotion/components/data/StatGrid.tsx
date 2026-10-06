import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { withAlpha } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";
import { formatLike, parseDataLines } from "./BarChart";

type Props = {
  data: string;
  /** 0 = automatic */
  columns: number;
  accentColor: string;
  textColor: string;
  labelColor: string;
  cardColor: string;
  cardOpacity: number;
  fontFamily: string;
  valueSize: number;
  labelSize: number;
  align: "left" | "center";
  radius: number;
  stagger: number;
  /** seconds */
  countDuration: number;
  exit: boolean;
};

const NEGATIVE = "#FF6B6B";

/** Picks the column count whose cards come closest to a pleasant ~1.1 aspect. */
const autoColumns = (count: number, w: number, h: number, gap: number) => {
  let best = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let c = 1; c <= count; c++) {
    const rows = Math.ceil(count / c);
    const cw = (w - gap * (c - 1)) / c;
    const ch = (h - gap * (rows - 1)) / rows;
    const score = Math.abs(Math.log(cw / Math.max(1, ch) / 1.1));
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
};

const Delta: React.FC<{ text: string; accent: string; size: number; unit: number }> = ({ text, accent, size, unit }) => {
  const negative = /^[-−–]/.test(text);
  const color = negative ? NEGATIVE : accent;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.3,
        padding: `${size * 0.16}px ${size * 0.42}px`,
        borderRadius: size,
        background: withAlpha(color, 0.14),
        color,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <svg aria-hidden="true" width={size * 0.55} height={size * 0.55} viewBox="0 0 10 10" style={{ display: "block" }}>
        <path d={negative ? "M5 9L1 3H9Z" : "M5 1L9 7H1Z"} fill={color} />
      </svg>
      <span style={{ marginTop: -unit }}>{text.replace(/^[+\-−–]\s*/, "")}</span>
    </span>
  );
};

const StatGrid: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([
    { family: p.fontFamily, weight: 500 },
    { family: p.fontFamily, weight: 600 },
    { family: p.fontFamily, weight: 700 },
  ]);
  const font = fontStack(p.fontFamily);
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const stats = parseDataLines(p.data).slice(0, 4);
  const count = Math.max(1, stats.length);
  const gap = 24 * unit;
  const cols = Math.max(1, Math.min(count, Math.round(p.columns) || autoColumns(count, w, h, gap)));
  const rows = Math.ceil(count / cols);
  const cardW = (w - gap * (cols - 1)) / cols;
  const cardH = (h - gap * (rows - 1)) / rows;
  const padIn = Math.max(24 * unit, Math.min(48 * unit, Math.min(cardW, cardH) * 0.12));
  const labelFs = Math.max(24 * unit, Math.min(p.labelSize * unit, cardH * 0.13));
  const captionFs = Math.max(22 * unit, labelFs * 0.86);
  const maxChars = Math.max(1, ...stats.map((s) => s.raw.length));
  const valueFs = Math.max(
    28 * unit,
    Math.min(p.valueSize * unit, (cardW - padIn * 2) / (maxChars * 0.6), cardH - padIn * 2 - labelFs * 1.4 - captionFs * 2.2),
  );
  const countF = Math.max(1, Math.round(p.countDuration * fps));
  // Cards leave with a small stagger; the last one is gone on the clip's final frame.
  const exitStart = p.durationInFrames - 13 - (count - 1) * 1.5;
  const radius = p.radius * unit;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {stats.map((s, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const delay = i * p.stagger;
        const enter = progress(frame, delay, 20, "smooth");
        const exitP = p.exit ? progress(frame, exitStart + i * 1.5, 12, "ease-in") : 0;
        const countP = progress(frame, delay + 4, countF, "smooth");
        const captionP = progress(frame, delay + 4 + countF * 0.55, 16, "smooth");
        const display = s.num ? formatLike(s.num.value * countP, s.num) : s.raw;
        const hi = s.marked;
        const isDelta = /^[+\-−–]\s*\d/.test(s.extra);
        const alignItems = p.align === "center" ? "center" : "flex-start";
        return (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: col * (cardW + gap),
              top: row * (cardH + gap),
              width: cardW,
              height: cardH,
              boxSizing: "border-box",
              padding: padIn,
              borderRadius: radius,
              background: `linear-gradient(180deg, ${withAlpha(p.cardColor, p.cardOpacity * 1.5)} 0%, ${withAlpha(p.cardColor, p.cardOpacity * 0.55)} 100%)`,
              border: `${Math.max(1, unit)}px solid ${hi ? withAlpha(p.accentColor, 0.45) : withAlpha(p.cardColor, 0.11)}`,
              boxShadow: `inset 0 ${Math.max(1, unit)}px 0 ${withAlpha("#FFFFFF", 0.07)}, 0 ${28 * unit}px ${70 * unit}px rgba(0,0,0,0.32)`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems,
              textAlign: p.align,
              opacity: Math.min(1, enter * 1.4) * (1 - exitP),
              transform: `translateY(${((1 - enter) * 34 + exitP * 18) * unit}px) scale(${0.97 + 0.03 * enter})`,
              filter: enter < 1 || exitP > 0 ? `blur(${(((1 - enter) * 8 + exitP * 6) * unit).toFixed(2)}px)` : undefined,
            }}
          >
            {hi ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `radial-gradient(120% 90% at ${p.align === "center" ? "50%" : "0%"} 0%, ${withAlpha(p.accentColor, 0.16)} 0%, ${withAlpha(p.accentColor, 0)} 60%)`,
                }}
              />
            ) : null}
            <div
              style={{
                position: "relative",
                fontFamily: font,
                fontWeight: 500,
                fontSize: labelFs,
                lineHeight: 1.2,
                color: p.labelColor,
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                position: "relative",
                fontFamily: font,
                fontWeight: 700,
                fontSize: valueFs,
                lineHeight: 1,
                letterSpacing: "-0.035em",
                color: hi ? p.accentColor : p.textColor,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {display}
            </div>
            <div
              style={{
                position: "relative",
                minHeight: captionFs * 1.5,
                fontFamily: font,
                fontWeight: 500,
                fontSize: captionFs,
                color: p.labelColor,
                opacity: captionP,
                transform: `translateY(${(1 - captionP) * 8 * unit}px)`,
                display: "flex",
                alignItems: "center",
                gap: captionFs * 0.45,
                whiteSpace: "nowrap",
              }}
            >
              {s.extra ? (
                isDelta ? (
                  <>
                    <Delta text={s.extra.split(/\s+/)[0]} accent={p.accentColor} size={captionFs} unit={unit} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{s.extra.split(/\s+/).slice(1).join(" ")}</span>
                  </>
                ) : (
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{s.extra}</span>
                )
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const statGrid = defineMotionComponent<Props>({
  id: "stat-grid",
  name: "Stat grid",
  category: "data",
  description:
    "2-4 glass KPI cards that rise in with a stagger while their numbers count up and land exactly; an optional caption per card renders '+18% MoM'-style deltas as a colored chip. One 'Label: value | caption' per line; prefix a line with * to make that card the accent. Use for proof points and summaries (real numbers only).",
  schema: {
    data: {
      type: "text",
      label: "Stats",
      default:
        "Active users: 48.2K | +24% vs last quarter\n*Revenue: $1.28M | +31% YoY\nUptime: 99.98% | Last 90 days\nNPS: 72 | Top quartile",
      description: "One 'Label: value | caption' per line (2-4 lines); * marks the accent card",
    },
    columns: { type: "number", label: "Columns (0 = auto)", default: 0, min: 0, max: 4, step: 1 },
    accentColor: { type: "color", label: "Accent", default: "#FFB224" },
    textColor: { type: "color", label: "Value color", default: "#F4F4F5" },
    labelColor: { type: "color", label: "Label color", default: "#A1A1AA" },
    cardColor: { type: "color", label: "Card tint", default: "#FFFFFF" },
    cardOpacity: { type: "number", label: "Card opacity", default: 0.045, min: 0, max: 0.4, step: 0.005 },
    fontFamily: { type: "font", label: "Font", default: "Inter" },
    valueSize: { type: "number", label: "Value size", default: 104, min: 32, max: 240, step: 1 },
    labelSize: { type: "number", label: "Label size", default: 32, min: 20, max: 64, step: 1 },
    align: { type: "enum", label: "Align", default: "left", options: ["left", "center"] },
    radius: { type: "number", label: "Corner radius", default: 30, min: 0, max: 80, step: 1 },
    stagger: { type: "number", label: "Stagger (frames)", default: 4, min: 0, max: 12, step: 1 },
    countDuration: { type: "number", label: "Count time (s)", default: 1.3, min: 0.2, max: 5, step: 0.05 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    data: "Active users: 48.2K | +24% vs last quarter\n*Revenue: $1.28M | +31% YoY\nUptime: 99.98% | Last 90 days\nNPS: 72 | Top quartile",
    columns: 0,
    accentColor: "#FFB224",
    textColor: "#F4F4F5",
    labelColor: "#A1A1AA",
    cardColor: "#FFFFFF",
    cardOpacity: 0.045,
    fontFamily: "Inter",
    valueSize: 104,
    labelSize: 32,
    align: "left",
    radius: 30,
    stagger: 4,
    countDuration: 1.3,
    exit: true,
  },
  defaultDuration: 5,
  defaultBox: { x: 0.5, y: 0.5, width: 0.86, height: 0.42 },
  Component: StatGrid,
  tags: ["data", "kpi", "stats", "metrics", "cards", "glass", "proof"],
});
