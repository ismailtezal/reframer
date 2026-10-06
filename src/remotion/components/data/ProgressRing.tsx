import type React from "react";
import { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mixColors, withAlpha } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { formatNumber, progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  value: number;
  max: number;
  decimals: number;
  prefix: string;
  suffix: string;
  label: string;
  accentColor: string;
  /** colour at the tail of the arc */
  accentColor2: string;
  trackColor: string;
  trackOpacity: number;
  textColor: string;
  labelColor: string;
  fontFamily: string;
  /** px at 1080p */
  thickness: number;
  valueSize: number;
  labelSize: number;
  ticks: boolean;
  glow: number;
  /** seconds */
  countDuration: number;
  exit: boolean;
};

const TAU = Math.PI * 2;
const START = -Math.PI / 2;

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number): string => {
  const sweep = a1 - a0;
  if (sweep >= TAU - 1e-4) {
    // A full turn can't be one arc command: draw two halves.
    return `${arcPath(cx, cy, r, a0, a0 + Math.PI)}${arcPath(cx, cy, r, a0 + Math.PI, a0 + TAU - 1e-4).replace(/^M[^A]+/, "")}`;
  }
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M${x0} ${y0}A${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
};

const ProgressRing: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  useFonts([
    { family: p.fontFamily, weight: 500 },
    { family: p.fontFamily, weight: 700 },
  ]);
  const font = fontStack(p.fontFamily);
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const size = Math.min(w, h) * 0.94;
  const cx = w / 2;
  const cy = h / 2;
  const thick = Math.max(2, Math.min(p.thickness * unit, size * 0.16));
  const r = Math.max(4, size / 2 - thick * 1.45);

  const countF = Math.max(1, Math.round(p.countDuration * fps));
  const ringIn = progress(frame, 0, 20, "smooth");
  const sweepP = progress(frame, 8, countF, "smooth");
  const land = progress(frame, 8 + countF - 6, 26, "ease-out");
  const pulse = Math.sin(Math.PI * land);
  const labelP = progress(frame, 12, 18, "smooth");
  const exitP = p.exit ? progress(frame, p.durationInFrames - 13, 12, "ease-in") : 0;

  const frac = p.max > 0 ? Math.max(0, Math.min(1, p.value / p.max)) : 0;
  const A = frac * sweepP * TAU;
  const segN = Math.max(1, Math.ceil(A / (TAU / 72)));
  const segs =
    A > 0.0005
      ? Array.from({ length: segN }, (_, j) => ({
          id: `s${j}`,
          d: arcPath(cx, cy, r, START + (A * j) / segN, START + (A * (j + 1)) / segN + (j < segN - 1 ? 0.012 : 0)),
          color: mixColors(p.accentColor2, p.accentColor, (j + 0.5) / segN),
        }))
      : [];
  const headA = START + A;
  const head = { x: cx + r * Math.cos(headA), y: cy + r * Math.sin(headA) };
  const tail = { x: cx + r * Math.cos(START), y: cy + r * Math.sin(START) };
  const glowAmt = p.glow * (1 + 0.8 * pulse);

  let ticksD = "";
  if (p.ticks) {
    for (let k = 0; k < 60; k++) {
      const a = START + (k / 60) * TAU;
      const r0 = r + thick * 0.95;
      const r1 = r + thick * (k % 5 === 0 ? 1.4 : 1.2);
      ticksD += `M${cx + r0 * Math.cos(a)} ${cy + r0 * Math.sin(a)}L${cx + r1 * Math.cos(a)} ${cy + r1 * Math.sin(a)}`;
    }
  }

  const value = p.value * sweepP;
  const numberText = formatNumber(value, { decimals: Math.max(0, Math.round(p.decimals)), prefix: p.prefix });
  const chars = numberText.length * 0.6 + p.suffix.length * 0.28;
  const valueFs = Math.max(24 * unit, Math.min(p.valueSize * unit, r * 0.62, (r * 1.35) / Math.max(1, chars)));
  const labelFs = Math.max(24 * unit, Math.min(p.labelSize * unit, r * 0.14));

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        opacity: 1 - exitP,
        transform: `scale(${1 - 0.04 * exitP})`,
        filter: exitP > 0 ? `blur(${(exitP * 6 * unit).toFixed(2)}px)` : undefined,
      }}
    >
      <svg
        aria-hidden="true"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <radialGradient id={`hd${uid}`}>
            <stop offset="0" stopColor={p.accentColor} stopOpacity={0.7} />
            <stop offset="0.4" stopColor={p.accentColor} stopOpacity={0.22} />
            <stop offset="1" stopColor={p.accentColor} stopOpacity={0} />
          </radialGradient>
        </defs>
        <g
          opacity={ringIn}
          transform={`rotate(${(1 - ringIn) * -28} ${cx} ${cy}) translate(${cx} ${cy}) scale(${0.9 + 0.1 * ringIn}) translate(${-cx} ${-cy})`}
        >
          {ticksD ? (
            <path d={ticksD} stroke={withAlpha(p.labelColor, 0.3)} strokeWidth={Math.max(1, 1.5 * unit)} strokeLinecap="round" />
          ) : null}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={withAlpha(p.trackColor, p.trackOpacity)} strokeWidth={thick} />
          {segs.length > 0 ? (
            <>
              {/* Soft halo: wide, faint strokes instead of a blur filter. */}
              <path
                d={arcPath(cx, cy, r, START, headA)}
                fill="none"
                stroke={p.accentColor}
                strokeWidth={thick * 3.4}
                strokeLinecap="round"
                opacity={0.045 * glowAmt}
              />
              <path
                d={arcPath(cx, cy, r, START, headA)}
                fill="none"
                stroke={p.accentColor}
                strokeWidth={thick * 2}
                strokeLinecap="round"
                opacity={0.09 * glowAmt}
              />
              <circle cx={tail.x} cy={tail.y} r={thick / 2} fill={p.accentColor2} />
              {segs.map((s) => (
                <path key={s.id} d={s.d} fill="none" stroke={s.color} strokeWidth={thick} />
              ))}
              <circle cx={head.x} cy={head.y} r={thick / 2} fill={p.accentColor} />
              <circle cx={head.x} cy={head.y} r={thick * 2.2} fill={`url(#hd${uid})`} opacity={Math.min(1, 0.5 * glowAmt)} />
              <circle cx={head.x} cy={head.y} r={thick * 0.2} fill="#FFFFFF" opacity={0.65} />
            </>
          ) : null}
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: cx - r,
          top: cy - r,
          width: r * 2,
          height: r * 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: labelFs * 0.35,
          textAlign: "center",
          fontFamily: font,
          opacity: ringIn,
          transform: `translateY(${(1 - ringIn) * 14 * unit}px)`,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: valueFs,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            color: p.textColor,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <span>{numberText}</span>
          {p.suffix ? (
            <span
              style={{
                fontSize: valueFs * 0.45,
                lineHeight: 1,
                marginTop: valueFs * 0.08,
                marginLeft: valueFs * 0.04,
                letterSpacing: "-0.02em",
              }}
            >
              {p.suffix}
            </span>
          ) : null}
        </div>
        {p.label ? (
          <div
            style={{
              maxWidth: r * 1.35,
              fontWeight: 500,
              fontSize: labelFs,
              lineHeight: 1.25,
              color: p.labelColor,
              opacity: labelP,
              transform: `translateY(${(1 - labelP) * 8 * unit}px)`,
            }}
          >
            {p.label}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const progressRing = defineMotionComponent<Props>({
  id: "progress-ring",
  name: "Progress ring",
  category: "data",
  description:
    "A circular progress ring whose gradient arc sweeps to the value while the centre number counts up in sync, with a glowing head and a soft pulse on landing. Use for a single percentage or completion stat (goal reached, uptime, adoption, battery); value/max sets the fill.",
  schema: {
    value: { type: "number", label: "Value", default: 76, min: 0, max: 100000, step: 0.1 },
    max: { type: "number", label: "Max", default: 100, min: 0.0001, max: 100000, step: 1 },
    decimals: { type: "number", label: "Decimals", default: 0, min: 0, max: 3, step: 1 },
    prefix: { type: "string", label: "Prefix", default: "" },
    suffix: { type: "string", label: "Suffix", default: "%" },
    label: { type: "string", label: "Label", default: "of teams ship weekly" },
    accentColor: { type: "color", label: "Accent", default: "#FFB224" },
    accentColor2: { type: "color", label: "Accent (tail)", default: "#FF6A3D" },
    trackColor: { type: "color", label: "Track", default: "#FFFFFF" },
    trackOpacity: { type: "number", label: "Track opacity", default: 0.08, min: 0, max: 1, step: 0.01 },
    textColor: { type: "color", label: "Number color", default: "#F4F4F5" },
    labelColor: { type: "color", label: "Label color", default: "#A1A1AA" },
    fontFamily: { type: "font", label: "Font", default: "Inter Tight" },
    thickness: { type: "number", label: "Thickness", default: 34, min: 4, max: 120, step: 1 },
    valueSize: { type: "number", label: "Number size", default: 180, min: 40, max: 400, step: 1 },
    labelSize: { type: "number", label: "Label size", default: 32, min: 20, max: 72, step: 1 },
    ticks: { type: "boolean", label: "Dial ticks", default: false },
    glow: { type: "number", label: "Glow", default: 0.6, min: 0, max: 1, step: 0.05 },
    countDuration: { type: "number", label: "Count time (s)", default: 1.6, min: 0.2, max: 6, step: 0.05 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    value: 76,
    max: 100,
    decimals: 0,
    prefix: "",
    suffix: "%",
    label: "of teams ship weekly",
    accentColor: "#FFB224",
    accentColor2: "#FF6A3D",
    trackColor: "#FFFFFF",
    trackOpacity: 0.08,
    textColor: "#F4F4F5",
    labelColor: "#A1A1AA",
    fontFamily: "Inter Tight",
    thickness: 34,
    valueSize: 180,
    labelSize: 32,
    ticks: false,
    glow: 0.6,
    countDuration: 1.6,
    exit: true,
  },
  defaultDuration: 4,
  defaultBox: { x: 0.5, y: 0.5, width: 0.5, height: 0.6 },
  Component: ProgressRing,
  tags: ["data", "progress", "percentage", "ring", "kpi", "goal"],
});
