import { getLength, getPointAtLength } from "@remotion/paths";
import type React from "react";
import { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { luminance, mixColors, withAlpha } from "../../../core/color";
import { resolveEasing } from "../../../core/easing";
import { fontStack, useFonts } from "../../fonts";
import { formatNumber, progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";
import { commonAffixes, type Datum, formatLike, type NumericValue, niceStep, parseDataLines, tickFormatter } from "./BarChart";

type Props = {
  data: string;
  /** Optional context series (same order), drawn as a muted line. */
  compare: string;
  seriesLabel: string;
  compareLabel: string;
  title: string;
  subtitle: string;
  source: string;
  calloutLabel: string;
  showChange: boolean;
  accentColor: string;
  compareColor: string;
  textColor: string;
  labelColor: string;
  fontFamily: string;
  titleSize: number;
  labelSize: number;
  lineWidth: number;
  smooth: boolean;
  area: boolean;
  dots: boolean;
  gridlines: boolean;
  zeroBaseline: boolean;
  /** seconds */
  drawDuration: number;
  card: boolean;
  exit: boolean;
};

type Pt = { x: number; y: number };
type Row = Datum & { num: NumericValue };

/** Monotone cubic segments (Fritsch–Carlson): smooth, never overshoots the data. */
const segments = (pts: Pt[], smooth: boolean): string[] => {
  const n = pts.length;
  if (n < 2) return [];
  if (!smooth || n === 2) return pts.slice(1).map((q) => `L${q.x} ${q.y}`);
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x || 1e-6);
    m.push((pts[i + 1].y - pts[i].y) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t.push(0);
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      t.push((w1 + w2) / (w1 / m[i - 1] + w2 / m[i]));
    }
  }
  t.push(m[n - 2]);
  const out: string[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h3 = dx[i] / 3;
    out.push(
      `C${pts[i].x + h3} ${pts[i].y + t[i] * h3} ${pts[i + 1].x - h3} ${pts[i + 1].y - t[i + 1] * h3} ${pts[i + 1].x} ${pts[i + 1].y}`,
    );
  }
  return out;
};

const LineChart: React.FC<Props & BoxProps> = (p) => {
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
  const series = parseDataLines(p.data)
    .filter((d): d is Row => d.num !== null)
    .slice(0, 40);
  const compare = parseDataLines(p.compare)
    .filter((d): d is Row => d.num !== null)
    .slice(0, series.length);
  const n = series.length;
  const pad = p.card ? 56 * unit : 0;
  const innerW = Math.max(1, w - pad * 2);

  // --- header -------------------------------------------------------------
  const titleBase = p.titleSize * unit;
  const titleFs = p.title ? Math.min(titleBase, (2 * innerW) / Math.max(1, p.title.length * 0.52)) : 0;
  const titleLines = p.title ? (p.title.length * 0.52 * titleFs > innerW ? 2 : 1) : 0;
  const labelBase = p.labelSize * unit;
  const subFs = Math.max(26 * unit, labelBase);
  const headerH = titleLines * titleFs * 1.08 + (p.title && p.subtitle ? 12 * unit : 0) + (p.subtitle ? subFs * 1.35 : 0);
  const legend = compare.length > 1 && (p.seriesLabel !== "" || p.compareLabel !== "");
  const legendFs = Math.max(24 * unit, labelBase * 0.85);
  const legendH = legend ? legendFs * 1.4 + 12 * unit : 0;
  const chartTop = pad + headerH + (headerH > 0 ? 40 * unit : 0) + legendH;
  const sourceFs = Math.max(28 * unit, labelBase * 0.85);
  const sourceH = p.source ? sourceFs * 1.3 + 24 * unit : 0;
  const chartH = Math.max(60 * unit, h - pad - sourceH - chartTop);

  // --- scale --------------------------------------------------------------
  const values = [...series, ...compare].map((d) => d.num.scaled);
  const maxV = values.length ? Math.max(...values) : 1;
  const minV = values.length ? Math.min(...values) : 0;
  const lo0 = p.zeroBaseline ? Math.min(0, minV) : minV;
  const step = niceStep(Math.max(1e-9, maxV - lo0) || 1, 4);
  const axisLo = p.zeroBaseline && minV >= 0 ? 0 : Math.floor(lo0 / step) * step;
  const axisHi = Math.max(axisLo + step, Math.ceil(maxV / step - 1e-9) * step);
  const ticks: number[] = [];
  if (p.gridlines) for (let k = 0; axisLo + k * step <= axisHi + step * 1e-6; k++) ticks.push(axisLo + k * step);
  const affix = commonAffixes(series.map((d) => d.num));
  const fmtTick = tickFormatter(Math.max(Math.abs(axisHi), Math.abs(axisLo)), step, affix.prefix, affix.suffix);
  const tickLabels = ticks.map((v) => ({ v, text: fmtTick(v) }));

  // --- layout -------------------------------------------------------------
  const tickFs = Math.max(28 * unit, labelBase * 0.85);
  const axisW = p.gridlines ? Math.max(1, ...tickLabels.map((t) => t.text.length)) * tickFs * 0.58 + 18 * unit : 0;
  const labelFs = Math.max(28 * unit, labelBase * 0.9);
  const calloutFs = Math.max(34 * unit, labelBase * 1.25);
  const calloutH = calloutFs * 1.9 + 30 * unit;
  const lw = Math.max(1.5, p.lineWidth * unit);
  const dotR = Math.max(3, lw * 1.25);
  const plotX = pad + axisW + dotR;
  const plotW = Math.max(1, innerW - axisW - dotR * 4);
  const plotTop = chartTop + calloutH;
  const baseY = chartTop + chartH - (labelFs * 1.2 + 20 * unit);
  const plotH = Math.max(1, baseY - plotTop);
  const xAt = (i: number) => plotX + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const yAt = (v: number) => baseY - ((v - axisLo) / (axisHi - axisLo)) * plotH;
  const pts = series.map((d, i) => ({ x: xAt(i), y: yAt(d.num.scaled) }));
  const cmpPts = compare.map((d, i) => ({ x: xAt(i), y: yAt(d.num.scaled) }));

  const segs = segments(pts, p.smooth);
  const start = pts.length ? `M${pts[0].x} ${pts[0].y}` : "";
  const d = start + segs.join("");
  const L = n > 1 ? getLength(d) : 0;
  const cum = pts.map((_, i) => (i === 0 || L === 0 ? 0 : getLength(start + segs.slice(0, i).join(""))));
  const cmpD = cmpPts.length > 1 ? `M${cmpPts[0].x} ${cmpPts[0].y}${segments(cmpPts, p.smooth).join("")}` : "";
  const cmpL = cmpD ? getLength(cmpD) : 0;

  // --- timing -------------------------------------------------------------
  const headerP = progress(frame, 0, 20, "smooth");
  const gridP = progress(frame, 4, 20, "smooth");
  const t0 = 12;
  const drawF = Math.max(8, Math.round(p.drawDuration * fps));
  const ease = resolveEasing("ease-in-out");
  const drawP = ease(Math.min(1, Math.max(0, (frame - t0) / drawF)));
  const head = L > 0 ? (getPointAtLength(d, L * drawP) ?? pts[0]) : pts[0];
  /** Frame at which the pen reaches `fraction` of the path. */
  const crossFrame = (fraction: number) => {
    let a = 0;
    let b = 1;
    for (let k = 0; k < 16; k++) {
      const mid = (a + b) / 2;
      if (ease(mid) >= fraction) b = mid;
      else a = mid;
    }
    return t0 + b * drawF;
  };
  const endF = t0 + drawF;
  const calloutP = progress(frame, endF - 4, 18, "smooth");
  const pulse = progress(frame, endF, 28, "ease-out");
  const exitP = p.exit ? progress(frame, p.durationInFrames - 13, 12, "ease-in") : 0;

  // --- callout ------------------------------------------------------------
  const last = series[n - 1];
  const first = series[0];
  const end = pts[n - 1];
  const change =
    p.showChange && n > 1 && first && last && Math.abs(first.num.scaled) > 1e-9
      ? ((last.num.scaled - first.num.scaled) / Math.abs(first.num.scaled)) * 100
      : null;
  const changeText =
    change === null ? "" : `${change >= 0 ? "+" : "−"}${formatNumber(Math.abs(change), { decimals: Math.abs(change) < 10 ? 1 : 0 })}%`;
  const valueText = last ? formatLike(last.num.value, last.num) : "";
  const onAccent = luminance(p.accentColor) > 0.42 ? "#0B0B0F" : "#FFFFFF";
  const pillPadX = calloutFs * 0.55;
  const pillW =
    (valueText.length * 0.6 +
      (p.calloutLabel ? p.calloutLabel.length * 0.36 + 0.5 : 0) +
      (changeText ? changeText.length * 0.42 + 0.9 : 0)) *
      calloutFs +
    pillPadX * 2;
  const pillCenter = end ? Math.min(w - pad - pillW / 2, Math.max(pad + pillW / 2, end.x)) : 0;

  const labelIdx = (() => {
    if (n <= 8) return series.map((_, i) => i);
    const k = Math.ceil((n - 1) / 6);
    const out: number[] = [];
    for (let i = 0; i < n - 1; i += k) out.push(i);
    if (n - 1 - (out[out.length - 1] ?? 0) < k / 2) out.pop();
    out.push(n - 1);
    return out;
  })();

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
            opacity: progress(frame, 4, 20, "smooth"),
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {p.subtitle}
        </div>
      ) : null}
      {legend ? (
        <div
          style={{
            position: "absolute",
            left: pad + axisW,
            top: chartTop - legendH,
            display: "flex",
            gap: 28 * unit,
            fontFamily: font,
            fontWeight: 500,
            fontSize: legendFs,
            color: p.labelColor,
            opacity: gridP,
          }}
        >
          {[
            { key: "s", label: p.seriesLabel, color: p.accentColor },
            { key: "c", label: p.compareLabel, color: p.compareColor },
          ]
            .filter((l) => l.label)
            .map((l) => (
              <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 10 * unit }}>
                <div style={{ width: 22 * unit, height: Math.max(2, 4 * unit), borderRadius: 4 * unit, background: l.color }} />
                {l.label}
              </div>
            ))}
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
          <linearGradient id={`ln${uid}`} gradientUnits="userSpaceOnUse" x1={plotX} y1={0} x2={plotX + plotW} y2={0}>
            <stop offset="0" stopColor={p.accentColor} stopOpacity={0.6} />
            <stop offset="1" stopColor={p.accentColor} stopOpacity={1} />
          </linearGradient>
          <linearGradient
            id={`ar${uid}`}
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={pts.length ? Math.min(...pts.map((q) => q.y)) : plotTop}
            x2={0}
            y2={baseY}
          >
            <stop offset="0" stopColor={p.accentColor} stopOpacity={0.3} />
            <stop offset="0.6" stopColor={p.accentColor} stopOpacity={0.08} />
            <stop offset="1" stopColor={p.accentColor} stopOpacity={0} />
          </linearGradient>
          <radialGradient id={`hd${uid}`}>
            <stop offset="0" stopColor={p.accentColor} stopOpacity={0.55} />
            <stop offset="0.45" stopColor={p.accentColor} stopOpacity={0.16} />
            <stop offset="1" stopColor={p.accentColor} stopOpacity={0} />
          </radialGradient>
          <clipPath id={`cl${uid}`}>
            <rect x={plotX - lw * 2} y={0} width={Math.max(0, (head?.x ?? plotX) - plotX + lw * 2)} height={h} />
          </clipPath>
        </defs>
        {/* Grid */}
        {tickLabels.map((t) => {
          const y = yAt(t.v);
          return (
            <g key={`t${t.v}`} opacity={gridP}>
              <line
                x1={plotX - dotR}
                x2={plotX + plotW + dotR}
                y1={y}
                y2={y}
                stroke={withAlpha(p.textColor, Math.abs(t.v) < 1e-12 ? 0.26 : 0.09)}
                strokeWidth={Math.max(1, (Math.abs(t.v) < 1e-12 ? 1.5 : 1) * unit)}
                strokeDasharray={`${plotW + dotR * 2} ${plotW + dotR * 2}`}
                strokeDashoffset={(plotW + dotR * 2) * (1 - gridP)}
              />
              <text
                x={plotX - dotR - 18 * unit}
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
        })}
        {/* X labels */}
        {labelIdx.map((i) => (
          <text
            key={series[i].id}
            x={xAt(i)}
            y={baseY + 20 * unit + labelFs * 0.9}
            textAnchor="middle"
            fontFamily={font}
            fontWeight={500}
            fontSize={labelFs}
            fill={p.labelColor}
            opacity={gridP}
          >
            {series[i].label}
          </text>
        ))}
        {/* Context series */}
        {cmpD && drawP > 0 ? (
          <path
            d={cmpD}
            fill="none"
            stroke={p.compareColor}
            strokeWidth={lw * 0.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${cmpL} ${cmpL}`}
            strokeDashoffset={cmpL * (1 - drawP)}
            opacity={0.85}
          />
        ) : null}
        {/* Area */}
        {p.area && n > 1 && drawP > 0 ? (
          <path d={`${d}L${pts[n - 1].x} ${baseY}L${pts[0].x} ${baseY}Z`} fill={`url(#ar${uid})`} clipPath={`url(#cl${uid})`} />
        ) : null}
        {/* Line */}
        {L > 0 && drawP > 0 ? (
          <path
            d={d}
            fill="none"
            stroke={`url(#ln${uid})`}
            strokeWidth={lw}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${L} ${L}`}
            strokeDashoffset={L * (1 - drawP)}
          />
        ) : null}
        {/* Dots pop as the pen passes them */}
        {p.dots && n <= 16
          ? pts.slice(0, -1).map((q, i) => {
              const dp = progress(frame, crossFrame(L > 0 ? cum[i] / L : 0), 12, "smooth");
              if (dp <= 0) return null;
              return (
                <g key={series[i].id}>
                  <circle cx={q.x} cy={q.y} r={dotR * 1.9 * dp} fill={p.accentColor} opacity={0.2} />
                  <circle cx={q.x} cy={q.y} r={dotR * dp} fill={p.accentColor} />
                </g>
              );
            })
          : null}
        {/* Pen head glow while drawing */}
        {head && drawP > 0 && drawP < 1 ? <circle cx={head.x} cy={head.y} r={dotR * 7} fill={`url(#hd${uid})`} /> : null}
        {/* End point */}
        {end && calloutP > 0 ? (
          <g>
            <circle
              cx={end.x}
              cy={end.y}
              r={dotR * (2 + 5 * pulse)}
              fill="none"
              stroke={p.accentColor}
              strokeWidth={Math.max(1, 2 * unit)}
              opacity={0.6 * (1 - pulse)}
            />
            <circle cx={end.x} cy={end.y} r={dotR * 2.3 * calloutP} fill={p.accentColor} opacity={0.22} />
            <circle cx={end.x} cy={end.y} r={dotR * 1.35 * calloutP} fill={p.accentColor} />
            <circle cx={end.x} cy={end.y} r={dotR * 0.55 * calloutP} fill={onAccent} opacity={0.9} />
          </g>
        ) : null}
      </svg>
      {end && last ? (
        <>
          <div
            style={{
              position: "absolute",
              left: end.x - 9 * unit,
              top: end.y - 30 * unit - 9 * unit,
              width: 18 * unit,
              height: 18 * unit,
              background: p.accentColor,
              transform: `translateY(${(1 - calloutP) * 10 * unit}px) rotate(45deg)`,
              borderRadius: 3 * unit,
              opacity: calloutP,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: pillCenter,
              top: end.y - 30 * unit,
              transform: `translate(-50%, -100%) translateY(${(1 - calloutP) * 10 * unit}px) scale(${0.94 + 0.06 * calloutP})`,
              transformOrigin: "50% 100%",
              opacity: calloutP,
              display: "flex",
              alignItems: "baseline",
              gap: calloutFs * 0.32,
              padding: `${calloutFs * 0.28}px ${pillPadX}px`,
              borderRadius: calloutFs,
              background: p.accentColor,
              color: onAccent,
              fontFamily: font,
              whiteSpace: "nowrap",
              boxShadow: `0 ${12 * unit}px ${32 * unit}px ${withAlpha(mixColors(p.accentColor, "#000000", 0.6), 0.45)}`,
            }}
          >
            {p.calloutLabel ? <span style={{ fontSize: calloutFs * 0.7, fontWeight: 600, opacity: 0.7 }}>{p.calloutLabel}</span> : null}
            <span style={{ fontSize: calloutFs, fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
              {valueText}
            </span>
            {changeText ? (
              <span style={{ fontSize: calloutFs * 0.7, fontWeight: 600, opacity: 0.72, fontVariantNumeric: "tabular-nums" }}>
                {changeText}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
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

export const lineChart = defineMotionComponent<Props>({
  id: "line-chart",
  name: "Line chart",
  category: "data",
  description:
    "A trend line that draws on left to right with a soft gradient area, dots that pop as the pen passes, and an accent callout at the end point (value + % change). Data is one 'Label: value' per line in time order; `compare` adds a muted context series. Use for growth and trends over time — title it with the takeaway.",
  schema: {
    data: {
      type: "text",
      label: "Data",
      default: "Jan: 18\nFeb: 24\nMar: 22\nApr: 35\nMay: 41\nJun: 56\nJul: 72",
      description: "One 'Label: value' per line, in order",
    },
    compare: { type: "text", label: "Compare series", default: "", description: "Optional context series, same order" },
    seriesLabel: { type: "string", label: "Series name", default: "" },
    compareLabel: { type: "string", label: "Compare name", default: "" },
    title: { type: "string", label: "Title", default: "Weekly active teams quadrupled" },
    subtitle: { type: "string", label: "Subtitle", default: "Active teams (K), Jan–Jul 2026" },
    source: { type: "string", label: "Source", default: "" },
    calloutLabel: { type: "string", label: "Callout label", default: "" },
    showChange: { type: "boolean", label: "Show % change", default: true },
    accentColor: { type: "color", label: "Accent", default: "#FFB224" },
    compareColor: { type: "color", label: "Compare color", default: "#5A5A63" },
    textColor: { type: "color", label: "Text", default: "#F4F4F5" },
    labelColor: { type: "color", label: "Labels", default: "#A1A1AA" },
    fontFamily: { type: "font", label: "Font", default: "Inter" },
    titleSize: { type: "number", label: "Title size", default: 64, min: 28, max: 160, step: 1 },
    labelSize: { type: "number", label: "Label size", default: 32, min: 20, max: 72, step: 1 },
    lineWidth: { type: "number", label: "Line width", default: 6, min: 1, max: 24, step: 0.5 },
    smooth: { type: "boolean", label: "Smooth curve", default: true },
    area: { type: "boolean", label: "Area fill", default: true },
    dots: { type: "boolean", label: "Dots", default: true },
    gridlines: { type: "boolean", label: "Gridlines", default: true },
    zeroBaseline: { type: "boolean", label: "Start at zero", default: true },
    drawDuration: { type: "number", label: "Draw time (s)", default: 1.4, min: 0.3, max: 6, step: 0.05 },
    card: { type: "boolean", label: "Glass card", default: false },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    data: "Jan: 18\nFeb: 24\nMar: 22\nApr: 35\nMay: 41\nJun: 56\nJul: 72",
    compare: "",
    seriesLabel: "",
    compareLabel: "",
    title: "Weekly active teams quadrupled",
    subtitle: "Active teams (K), Jan–Jul 2026",
    source: "",
    calloutLabel: "",
    showChange: true,
    accentColor: "#FFB224",
    compareColor: "#5A5A63",
    textColor: "#F4F4F5",
    labelColor: "#A1A1AA",
    fontFamily: "Inter",
    titleSize: 64,
    labelSize: 32,
    lineWidth: 6,
    smooth: true,
    area: true,
    dots: true,
    gridlines: true,
    zeroBaseline: true,
    drawDuration: 1.4,
    card: false,
    exit: true,
  },
  defaultDuration: 6,
  defaultBox: { x: 0.5, y: 0.5, width: 0.74, height: 0.72 },
  Component: LineChart,
  tags: ["data", "chart", "line", "trend", "growth", "stats"],
});
