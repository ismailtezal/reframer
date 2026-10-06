import type React from "react";
import { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mixColors, withAlpha } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { formatNumber, progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

// ---------------------------------------------------------------------------
// Shared data parsing ("Label: value" lines) — also used by line-chart and stat-grid.
// ---------------------------------------------------------------------------

export type NumericValue = {
  /** The number as typed ("1.2" for "1.2M"). */
  value: number;
  /** Value × K/M/B multiplier, for comparing magnitudes. */
  scaled: number;
  prefix: string;
  suffix: string;
  decimals: number;
  separator: boolean;
};

const MULTIPLIER_RE = /^(bn|mn|k|m|b)(?![a-z])/i;
const MULTIPLIERS: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, bn: 1e9, mn: 1e6 };

/** Parses "$1.2M", "42%", "1,240", "-3.5x" into a number plus its formatting. */
export const parseNumeric = (raw: string): NumericValue | null => {
  const m = raw.trim().match(/^(.*?)([-+−]?(?:\d[\d,]*(?:\.\d+)?|\.\d+))(.*)$/);
  if (!m) return null;
  const [, prefix, num, suffix] = m;
  const clean = num.replace(/,/g, "").replace("−", "-");
  const value = Number.parseFloat(clean);
  if (!Number.isFinite(value)) return null;
  const decimals = clean.includes(".") ? (clean.split(".")[1]?.length ?? 0) : 0;
  const mult = suffix.trim().match(MULTIPLIER_RE);
  return {
    value,
    scaled: value * (mult ? (MULTIPLIERS[mult[1].toLowerCase()] ?? 1) : 1),
    prefix,
    suffix,
    decimals,
    separator: num.includes(",") || Math.abs(value) >= 10000,
  };
};

/** Formats `v` with the prefix/suffix/decimals of a parsed value (for count-ups). */
export const formatLike = (v: number, n: NumericValue) =>
  formatNumber(v, { decimals: n.decimals, prefix: n.prefix, suffix: n.suffix, separator: n.separator });

export type Datum = { id: string; label: string; raw: string; num: NumericValue | null; marked: boolean; extra: string };

/**
 * One datum per line: "Label: value", optional " | extra" text, and a leading
 * (or wrapping) `*` to mark the line as highlighted.
 */
export const parseDataLines = (text: string): Datum[] => {
  const out: Datum[] = [];
  for (const rawLine of text.split("\n")) {
    let body = rawLine.trim();
    if (!body) continue;
    let marked = false;
    if (body.startsWith("*")) {
      marked = true;
      body = body.slice(1).trim();
    }
    if (body.endsWith("*")) {
      marked = true;
      body = body.slice(0, -1).trim();
    }
    let extra = "";
    const bar = body.indexOf("|");
    if (bar >= 0) {
      extra = body.slice(bar + 1).trim();
      body = body.slice(0, bar).trim();
    }
    const colon = body.lastIndexOf(":");
    if (colon < 0) continue;
    const raw = body.slice(colon + 1).trim();
    out.push({ id: `d${out.length}`, label: body.slice(0, colon).trim(), raw, num: parseNumeric(raw), marked, extra });
  }
  return out;
};

/** 1 / 2 / 2.5 / 5 × 10^k step for about `count` intervals. */
export const niceStep = (range: number, count: number) => {
  const raw = Math.max(1e-9, range) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
};

/** Axis tick formatter: one shared K/M/B unit and just enough decimals. */
export const tickFormatter = (axisMax: number, step: number, prefix: string, suffix: string) => {
  const div = axisMax >= 1e9 ? 1e9 : axisMax >= 1e6 ? 1e6 : axisMax >= 1e4 ? 1e3 : 1;
  const unitSuffix = div === 1e9 ? "B" : div === 1e6 ? "M" : div === 1e3 ? "K" : "";
  const stepU = step / div;
  const dec = Math.abs(stepU - Math.round(stepU)) < 1e-9 ? 0 : Math.abs(stepU * 10 - Math.round(stepU * 10)) < 1e-9 ? 1 : 2;
  return (v: number) =>
    Math.abs(v) < 1e-12 ? `${prefix}0${suffix}` : formatNumber(v / div, { decimals: dec, prefix, suffix: `${unitSuffix}${suffix}` });
};

/** Shared prefix / unit suffix (without K/M/B) when all values agree. */
export const commonAffixes = (values: NumericValue[]) => {
  const first = values[0];
  if (!first) return { prefix: "", suffix: "" };
  const unitOf = (n: NumericValue) => n.suffix.trim().replace(MULTIPLIER_RE, "");
  return {
    prefix: values.every((v) => v.prefix === first.prefix) ? first.prefix : "",
    suffix: values.every((v) => unitOf(v) === unitOf(first)) ? unitOf(first) : "",
  };
};

// ---------------------------------------------------------------------------

type Props = {
  data: string;
  title: string;
  subtitle: string;
  source: string;
  orientation: "vertical" | "horizontal";
  highlight: "max" | "last" | "first" | "all" | "none";
  accentColor: string;
  barColor: string;
  textColor: string;
  labelColor: string;
  fontFamily: string;
  titleSize: number;
  labelSize: number;
  gridlines: boolean;
  showValues: boolean;
  barRadius: number;
  /** 0..0.9 gap between bars, fraction of each slot */
  gap: number;
  stagger: number;
  /** seconds each bar takes to grow */
  growDuration: number;
  card: boolean;
  exit: boolean;
};

const roundedBar = (x: number, y: number, bw: number, bh: number, r: number, horizontal: boolean) => {
  if (bw <= 0 || bh <= 0) return "";
  if (horizontal) {
    const rr = Math.max(0, Math.min(r, bh / 2, bw));
    return `M${x} ${y}H${x + bw - rr}A${rr} ${rr} 0 0 1 ${x + bw} ${y + rr}V${y + bh - rr}A${rr} ${rr} 0 0 1 ${x + bw - rr} ${y + bh}H${x}Z`;
  }
  const rr = Math.max(0, Math.min(r, bw / 2, bh));
  return `M${x} ${y + bh}V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}H${x + bw - rr}A${rr} ${rr} 0 0 1 ${x + bw} ${y + rr}V${y + bh}Z`;
};

const BarChart: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  useFonts([
    { family: p.fontFamily, weight: 500 },
    { family: p.fontFamily, weight: 600 },
    { family: p.fontFamily, weight: 700 },
  ]);
  const font = fontStack(p.fontFamily);
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const horizontal = p.orientation === "horizontal";
  const data = parseDataLines(p.data)
    .filter((d): d is Datum & { num: NumericValue } => d.num !== null)
    .slice(0, 16);
  const n = data.length;
  const pad = p.card ? 56 * unit : 0;
  const innerW = Math.max(1, w - pad * 2);

  // --- header -------------------------------------------------------------
  const titleBase = p.titleSize * unit;
  const titleFs = p.title ? Math.min(titleBase, (2 * innerW) / Math.max(1, p.title.length * 0.52)) : 0;
  const titleLines = p.title ? (p.title.length * 0.52 * titleFs > innerW ? 2 : 1) : 0;
  const labelBase = p.labelSize * unit;
  const subFs = Math.max(26 * unit, labelBase);
  const headerH = titleLines * titleFs * 1.08 + (p.title && p.subtitle ? 12 * unit : 0) + (p.subtitle ? subFs * 1.35 : 0);
  const chartTop = pad + headerH + (headerH > 0 ? 48 * unit : 0);
  const sourceFs = Math.max(28 * unit, labelBase * 0.85);
  const sourceH = p.source ? sourceFs * 1.3 + 24 * unit : 0;
  const chartH = Math.max(60 * unit, h - pad - sourceH - chartTop);

  // --- scale --------------------------------------------------------------
  const maxV = Math.max(0, ...data.map((d) => d.num.scaled));
  const step = niceStep(maxV > 0 ? maxV : 1, 4);
  const axisMax = p.gridlines ? Math.max(step, Math.ceil(maxV / step - 1e-9) * step) : maxV > 0 ? maxV : 1;
  const ticks: number[] = [];
  if (p.gridlines) for (let k = 0; k * step <= axisMax + step * 1e-6; k++) ticks.push(k * step);
  const affix = commonAffixes(data.map((d) => d.num));
  const fmtTick = tickFormatter(axisMax, step, affix.prefix, affix.suffix);
  const tickLabels = ticks.map((v) => ({ v, text: fmtTick(v) }));
  const tickFs = Math.max(28 * unit, labelBase * 0.85);
  const valueBase = Math.max(30 * unit, labelBase * 1.2);
  const maxLabelChars = Math.max(1, ...data.map((d) => d.label.length));
  const maxValueChars = Math.max(1, ...data.map((d) => formatLike(d.num.value, d.num).length));
  const gap = Math.max(0, Math.min(0.9, p.gap));

  // --- timing ------------------------------------------------------------
  const headerP = progress(frame, 0, 20, "smooth");
  const subP = progress(frame, 4, 20, "smooth");
  const gridP = progress(frame, 4, 22, "smooth");
  const t0 = 10;
  const grow = Math.max(6, Math.round(p.growDuration * fps));
  const stagger = Math.max(0, p.stagger);
  const done = t0 + Math.max(0, n - 1) * stagger + grow;
  const focusP = progress(frame, done + 2, 18, "smooth");
  const exitP = p.exit ? progress(frame, p.durationInFrames - 13, 12, "ease-in") : 0;

  const marked = data.some((d) => d.marked);
  let maxI = 0;
  for (let i = 1; i < n; i++) if (data[i].num.scaled > data[maxI].num.scaled) maxI = i;
  const isHi = (i: number) =>
    marked
      ? data[i].marked
      : p.highlight === "all" ||
        (p.highlight === "max" && i === maxI) ||
        (p.highlight === "last" && i === n - 1) ||
        (p.highlight === "first" && i === 0);
  const anyHi = data.some((_, i) => isHi(i));
  const accentAmount = (i: number) => (!isHi(i) ? 0 : !marked && p.highlight === "all" ? 1 : focusP);

  // --- geometry ----------------------------------------------------------
  type BarGeo = {
    d: Datum & { num: NumericValue };
    g: number;
    path: string;
    color: string;
    dim: number;
    labelX: number;
    labelY: number;
    valueX: number;
    valueY: number;
    gx2: number;
    gy2: number;
  };
  let labelFs = labelBase;
  let valueFs = valueBase;
  let plotX = pad;
  let plotW = innerW;
  let baseY = chartTop + chartH;
  let plotTop = chartTop;
  const bars: BarGeo[] = [];

  if (!horizontal) {
    const axisW = p.gridlines ? Math.max(1, ...tickLabels.map((t) => t.text.length)) * tickFs * 0.58 + 18 * unit : 0;
    plotX = pad + axisW;
    plotW = Math.max(1, innerW - axisW);
    const slot = plotW / Math.max(1, n);
    const barW = Math.min(slot * (1 - gap), 200 * unit);
    labelFs = Math.max(20 * unit, Math.min(labelBase, (slot * 0.94) / (maxLabelChars * 0.56)));
    valueFs = Math.max(20 * unit, Math.min(valueBase, (slot * 1.02) / (maxValueChars * 0.6)));
    const labelH = labelFs * 1.2 + 18 * unit;
    const valueH = p.showValues ? valueFs * 1.15 + 14 * unit : 0;
    plotTop = chartTop + valueH;
    baseY = chartTop + chartH - labelH;
    const plotHeight = Math.max(1, baseY - plotTop);
    data.forEach((d, i) => {
      const g = progress(frame, t0 + i * stagger, grow, "smooth");
      const bh = Math.max(0, (d.num.scaled / axisMax) * plotHeight * g);
      const x = plotX + slot * i + (slot - barW) / 2;
      bars.push({
        d,
        g,
        path: roundedBar(x, baseY - bh, barW, bh, p.barRadius * unit, false),
        color: mixColors(p.barColor, p.accentColor, accentAmount(i)),
        dim: anyHi && !isHi(i) ? focusP : 0,
        labelX: x + barW / 2,
        labelY: baseY + 14 * unit + labelFs * 0.9,
        valueX: x + barW / 2,
        valueY: baseY - bh - 14 * unit,
        gx2: 0,
        gy2: 1,
      });
    });
  } else {
    const labelColW = Math.min(innerW * 0.36, maxLabelChars * labelBase * 0.56 + 28 * unit);
    const valueColW = p.showValues ? maxValueChars * valueBase * 0.6 + 24 * unit : 0;
    plotX = pad + labelColW;
    plotW = Math.max(1, innerW - labelColW - valueColW);
    const slot = chartH / Math.max(1, n);
    const barH = Math.min(slot * (1 - gap), 96 * unit);
    labelFs = Math.max(20 * unit, Math.min(labelBase, slot * 0.6, (labelColW - 28 * unit) / (maxLabelChars * 0.56)));
    valueFs = Math.max(20 * unit, Math.min(valueBase, slot * 0.62));
    data.forEach((d, i) => {
      const g = progress(frame, t0 + i * stagger, grow, "smooth");
      const bw = Math.max(0, (d.num.scaled / axisMax) * plotW * g);
      const y = chartTop + slot * i + (slot - barH) / 2;
      bars.push({
        d,
        g,
        path: roundedBar(plotX, y, bw, barH, p.barRadius * unit, true),
        color: mixColors(p.barColor, p.accentColor, accentAmount(i)),
        dim: anyHi && !isHi(i) ? focusP : 0,
        labelX: plotX - 20 * unit,
        labelY: y + barH / 2,
        valueX: plotX + bw + 16 * unit,
        valueY: y + barH / 2,
        gx2: 1,
        gy2: 0,
      });
    });
  }

  const gridColor = withAlpha(p.textColor, 0.1);
  const plotH = baseY - plotTop;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        opacity: 1 - exitP,
        transform: `translateY(${exitP * 16 * unit}px)`,
        filter: exitP > 0 ? `blur(${(exitP * 6 * unit).toFixed(2)}px)` : undefined,
      }}
    >
      {p.card ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 32 * unit,
            background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)",
            border: `${Math.max(1, unit)}px solid rgba(255,255,255,0.1)`,
            boxShadow: `inset 0 ${Math.max(1, unit)}px 0 rgba(255,255,255,0.07), 0 ${30 * unit}px ${80 * unit}px rgba(0,0,0,0.35)`,
            opacity: headerP,
          }}
        />
      ) : null}
      {p.title ? (
        <div
          style={{
            position: "absolute",
            left: pad,
            top: pad,
            width: innerW,
            fontFamily: font,
            fontWeight: 700,
            fontSize: titleFs,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: p.textColor,
            opacity: headerP,
            transform: `translateY(${(1 - headerP) * 18 * unit}px)`,
            filter: headerP < 1 ? `blur(${((1 - headerP) * 8 * unit).toFixed(2)}px)` : undefined,
          }}
        >
          {p.title}
        </div>
      ) : null}
      {p.subtitle ? (
        <div
          style={{
            position: "absolute",
            left: pad,
            top: pad + titleLines * titleFs * 1.08 + (p.title ? 12 * unit : 0),
            width: innerW,
            fontFamily: font,
            fontWeight: 500,
            fontSize: subFs,
            lineHeight: 1.3,
            color: p.labelColor,
            opacity: subP,
            transform: `translateY(${(1 - subP) * 12 * unit}px)`,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {p.subtitle}
        </div>
      ) : null}
      <svg
        aria-hidden="true"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          {bars.map((b) => (
            <linearGradient key={b.d.id} id={`${b.d.id}${uid}`} x1="0" y1="0" x2={b.gx2} y2={b.gy2}>
              <stop offset="0" stopColor={horizontal ? b.color : mixColors(b.color, "#FFFFFF", 0.16)} />
              <stop offset="1" stopColor={horizontal ? mixColors(b.color, "#FFFFFF", 0.16) : b.color} />
            </linearGradient>
          ))}
        </defs>
        {/* Grid */}
        {!horizontal
          ? tickLabels.map((t) => {
              const y = baseY - (t.v / axisMax) * plotH;
              return (
                <g key={`t${t.v}`} opacity={gridP}>
                  {t.v > 0 ? (
                    <line
                      x1={plotX}
                      x2={plotX + plotW}
                      y1={y}
                      y2={y}
                      stroke={gridColor}
                      strokeWidth={Math.max(1, unit)}
                      strokeDasharray={`${plotW} ${plotW}`}
                      strokeDashoffset={plotW * (1 - gridP)}
                    />
                  ) : null}
                  <text
                    x={plotX - 18 * unit}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="central"
                    fontFamily={font}
                    fontWeight={500}
                    fontSize={tickFs}
                    fill={p.labelColor}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {t.text}
                  </text>
                </g>
              );
            })
          : tickLabels
              .filter((t) => t.v > 0)
              .map((t) => {
                const x = plotX + (t.v / axisMax) * plotW;
                return (
                  <line
                    key={`t${t.v}`}
                    x1={x}
                    x2={x}
                    y1={chartTop}
                    y2={chartTop + chartH}
                    stroke={gridColor}
                    strokeWidth={Math.max(1, unit)}
                    opacity={gridP}
                  />
                );
              })}
        {/* Baseline */}
        {horizontal ? (
          <line
            x1={plotX}
            x2={plotX}
            y1={chartTop}
            y2={chartTop + chartH}
            stroke={withAlpha(p.textColor, 0.28)}
            strokeWidth={Math.max(1, 1.5 * unit)}
            opacity={gridP}
          />
        ) : (
          <line
            x1={plotX}
            x2={plotX + plotW * gridP}
            y1={baseY}
            y2={baseY}
            stroke={withAlpha(p.textColor, 0.28)}
            strokeWidth={Math.max(1, 1.5 * unit)}
          />
        )}
        {/* Bars */}
        {bars.map((b) => (b.path ? <path key={b.d.id} d={b.path} fill={`url(#${b.d.id}${uid})`} opacity={1 - 0.3 * b.dim} /> : null))}
        {/* Category labels */}
        {bars.map((b, i) => {
          const q = progress(frame, t0 + i * stagger - 4, 16, "smooth");
          const hi = isHi(i) && accentAmount(i) > 0;
          return (
            <text
              key={`l${b.d.id}`}
              x={b.labelX}
              y={b.labelY}
              textAnchor={horizontal ? "end" : "middle"}
              dominantBaseline={horizontal ? "central" : undefined}
              fontFamily={font}
              fontWeight={hi ? 600 : 500}
              fontSize={labelFs}
              fill={hi ? mixColors(p.labelColor, p.textColor, accentAmount(i)) : p.labelColor}
              opacity={q * (1 - 0.35 * b.dim)}
            >
              {b.d.label}
            </text>
          );
        })}
        {/* Values */}
        {p.showValues
          ? bars.map((b, i) => (
              <text
                key={`v${b.d.id}`}
                x={b.valueX}
                y={b.valueY}
                textAnchor={horizontal ? "start" : "middle"}
                dominantBaseline={horizontal ? "central" : undefined}
                fontFamily={font}
                fontWeight={600}
                fontSize={valueFs}
                letterSpacing="-0.01em"
                fill={mixColors(p.textColor, p.accentColor, accentAmount(i))}
                opacity={Math.min(1, b.g * 2.5) * (1 - 0.4 * b.dim)}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatLike(b.d.num.value * b.g, b.d.num)}
              </text>
            ))
          : null}
      </svg>
      {p.source ? (
        <div
          style={{
            position: "absolute",
            left: pad,
            bottom: pad,
            width: innerW,
            fontFamily: font,
            fontWeight: 500,
            fontSize: sourceFs,
            color: p.labelColor,
            opacity: 0.75 * gridP,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {p.source}
        </div>
      ) : null}
    </div>
  );
};

export const barChart = defineMotionComponent<Props>({
  id: "bar-chart",
  name: "Bar chart",
  category: "data",
  description:
    "Staggered bars that grow from zero with counting value labels, gridlines and a takeaway title; once they land, the focus bar lights up in the accent while the rest stay muted. Data is one 'Label: value' per line (values like 1,240 / $1.2M / 42%); prefix a line with * to choose the highlighted bar. Use for comparisons and rankings (≤ 7 bars reads best).",
  schema: {
    data: {
      type: "text",
      label: "Data",
      default: "Jan: 1,240\nFeb: 1,610\nMar: 2,150\nApr: 2,780\nMay: 3,520\nJun: 4,650",
      description: "One 'Label: value' per line; start a line with * to highlight it",
    },
    title: { type: "string", label: "Title", default: "Signups grew 3.7× in six months" },
    subtitle: { type: "string", label: "Subtitle", default: "Monthly new signups, 2026" },
    source: { type: "string", label: "Source", default: "" },
    orientation: { type: "enum", label: "Orientation", default: "vertical", options: ["vertical", "horizontal"] },
    highlight: {
      type: "enum",
      label: "Highlight",
      default: "max",
      options: ["max", "last", "first", "all", "none"],
      description: "Used when no line is marked with *",
    },
    accentColor: { type: "color", label: "Accent", default: "#FFB224" },
    barColor: { type: "color", label: "Bar color", default: "#3A3A42" },
    textColor: { type: "color", label: "Text", default: "#F4F4F5" },
    labelColor: { type: "color", label: "Labels", default: "#A1A1AA" },
    fontFamily: { type: "font", label: "Font", default: "Inter" },
    titleSize: { type: "number", label: "Title size", default: 64, min: 28, max: 160, step: 1 },
    labelSize: { type: "number", label: "Label size", default: 32, min: 20, max: 72, step: 1 },
    gridlines: { type: "boolean", label: "Gridlines", default: true },
    showValues: { type: "boolean", label: "Value labels", default: true },
    barRadius: { type: "number", label: "Bar radius", default: 10, min: 0, max: 60, step: 1 },
    gap: { type: "number", label: "Bar gap", default: 0.34, min: 0, max: 0.9, step: 0.01 },
    stagger: { type: "number", label: "Stagger (frames)", default: 3, min: 0, max: 12, step: 1 },
    growDuration: { type: "number", label: "Grow time (s)", default: 0.75, min: 0.2, max: 3, step: 0.05 },
    card: { type: "boolean", label: "Glass card", default: false },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    data: "Jan: 1,240\nFeb: 1,610\nMar: 2,150\nApr: 2,780\nMay: 3,520\nJun: 4,650",
    title: "Signups grew 3.7× in six months",
    subtitle: "Monthly new signups, 2026",
    source: "",
    orientation: "vertical",
    highlight: "max",
    accentColor: "#FFB224",
    barColor: "#3A3A42",
    textColor: "#F4F4F5",
    labelColor: "#A1A1AA",
    fontFamily: "Inter",
    titleSize: 64,
    labelSize: 32,
    gridlines: true,
    showValues: true,
    barRadius: 10,
    gap: 0.34,
    stagger: 3,
    growDuration: 0.75,
    card: false,
    exit: true,
  },
  defaultDuration: 6,
  defaultBox: { x: 0.5, y: 0.5, width: 0.74, height: 0.72 },
  Component: BarChart,
  tags: ["data", "chart", "bars", "stats", "ranking", "comparison"],
});
