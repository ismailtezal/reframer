import type React from "react";
import { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fontStack, useFonts } from "../../fonts";
import { progress, random01 } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";
import { boundsOf, brushPath, type Pt, sliceStroke, smoothstep, wobble } from "./brush";

type Props = {
  label: string;
  /** Arrow tip, 0..1 of the box. */
  targetX: number;
  targetY: number;
  /** Direction the arrow travels, degrees (0 = right, 90 = down). */
  angle: number;
  /** px at 1080p */
  length: number;
  curve: number;
  color: string;
  strokeWidth: number;
  roughness: number;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  /** Frames the shaft takes to draw. */
  drawDuration: number;
  shadow: boolean;
  seed: number;
  exit: boolean;
};

const quad = (a: Pt, c: Pt, b: Pt, s: number): Pt => ({
  x: (1 - s) ** 2 * a.x + 2 * (1 - s) * s * c.x + s * s * b.x,
  y: (1 - s) ** 2 * a.y + 2 * (1 - s) * s * c.y + s * s * b.y,
});

const ArrowCallout: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const id = useId().replace(/:/g, "");
  useFonts([{ family: p.fontFamily, weight: p.fontWeight }]);
  // Timeline in 30 fps frames so the draw speed is the same at any frame rate.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const rough = p.roughness;
  const sw = Math.max(1, p.strokeWidth * unit);

  // Shaft: a quadratic arc from the tail to the tip, with a gentle hand wobble (zero at both ends).
  const tip: Pt = { x: p.targetX * p.width, y: p.targetY * p.height };
  const a = (p.angle * Math.PI) / 180;
  const dir: Pt = { x: Math.cos(a), y: Math.sin(a) };
  const side: Pt = { x: dir.y, y: -dir.x };
  const len = Math.max(24 * unit, p.length * unit);
  const tail: Pt = { x: tip.x - dir.x * len, y: tip.y - dir.y * len };
  const bend = p.curve * len * 0.5;
  const ctrl: Pt = { x: (tail.x + tip.x) / 2 + side.x * bend, y: (tail.y + tip.y) / 2 + side.y * bend };
  const N = 64;
  const shaft: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const q = quad(tail, ctrl, tip, s);
    const off = rough * len * 0.022 * Math.sin(Math.PI * s) * wobble(s * 4.5, p.seed);
    shaft.push({ x: q.x + side.x * off, y: q.y + side.y * off });
  }

  // Head: two barbs drawn outward from the tip, slightly asymmetric like a real pen.
  const prev = shaft[N - 3];
  const backLen = Math.hypot(prev.x - tip.x, prev.y - tip.y) || 1;
  const back: Pt = { x: (prev.x - tip.x) / backLen, y: (prev.y - tip.y) / backLen };
  const headLen = Math.max(sw * 3.4, Math.min(len * 0.17, 76 * unit));
  const barb = (sign: number, seed: number): Pt[] => {
    const spread = (((28 + rough * 8 * (random01(seed) - 0.5)) * Math.PI) / 180) * sign;
    const l = headLen * (1 + rough * 0.16 * (random01(seed + 1) - 0.5));
    const v: Pt = {
      x: back.x * Math.cos(spread) - back.y * Math.sin(spread),
      y: back.x * Math.sin(spread) + back.y * Math.cos(spread),
    };
    const end: Pt = { x: tip.x + v.x * l, y: tip.y + v.y * l };
    const bow = rough * l * 0.08 * sign;
    const mid: Pt = { x: (tip.x + end.x) / 2 - v.y * bow, y: (tip.y + end.y) / 2 + v.x * bow };
    return Array.from({ length: 13 }, (_, i) => quad(tip, mid, end, i / 12));
  };
  const barbA = barb(1, p.seed + 11);
  const barbB = barb(-1, p.seed + 17);

  // Choreography: label lands, the shaft draws from the label to the target, then the head.
  const labelIn = progress(t, 0, 16, "smooth");
  const draw = progress(t, 6, p.drawDuration, "ease-in-out");
  const headAt = 6 + p.drawDuration - 2;
  const e = p.exit ? progress(t, last - 12, 12, "ease-in") : 0;
  const shaftWidth = (u: number) => sw * (0.6 + 0.4 * smoothstep(0, 0.14, u)) * (1 + rough * 0.1 * wobble(u * 6, p.seed + 5));
  const barbWidth = (u: number) => sw * (1 - 0.42 * u);
  // On exit the shaft retracts into the tip, then the head fades.
  const shaftD = brushPath(sliceStroke(shaft, e, draw), shaftWidth);
  const barbAD = brushPath(sliceStroke(barbA, 0, progress(t, headAt, 6, "smooth")), barbWidth);
  const barbBD = brushPath(sliceStroke(barbB, 0, progress(t, headAt + 3, 6, "smooth")), barbWidth);
  const b = boundsOf([shaft, barbA, barbB], sw + 12 * unit);

  // Label sits behind the tail, on the side the arrow leaves from.
  const d0Len = Math.hypot(ctrl.x - tail.x, ctrl.y - tail.y) || 1;
  const d0: Pt = { x: (ctrl.x - tail.x) / d0Len, y: (ctrl.y - tail.y) / d0Len };
  const gap = 18 * unit + sw;
  const anchor: Pt = { x: tail.x - d0.x * gap, y: tail.y - d0.y * gap };
  const m = Math.max(Math.abs(d0.x), Math.abs(d0.y)) || 1;
  const tx = -50 - 50 * (d0.x / m);
  const ty = -50 - 50 * (d0.y / m);
  const textAlign = d0.x / m > 0.5 ? "right" : d0.x / m < -0.5 ? "left" : "center";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        width={b.w}
        height={b.h}
        viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
        style={{ position: "absolute", left: b.x, top: b.y, display: "block", overflow: "visible" }}
      >
        {p.shadow ? (
          <defs>
            <filter id={`s${id}`} filterUnits="userSpaceOnUse" x={b.x} y={b.y} width={b.w} height={b.h}>
              <feDropShadow dx="0" dy={2 * unit} stdDeviation={3 * unit} floodColor="#000000" floodOpacity="0.32" />
            </filter>
          </defs>
        ) : null}
        <g fill={p.color} filter={p.shadow ? `url(#s${id})` : undefined}>
          <path d={shaftD} />
          <g opacity={1 - smoothstep(0.55, 1, e)}>
            <path d={barbAD} />
            <path d={barbBD} />
          </g>
        </g>
      </svg>
      {p.label ? (
        <div
          style={{
            position: "absolute",
            left: anchor.x,
            top: anchor.y,
            width: "max-content",
            maxWidth: "14em",
            fontFamily: fontStack(p.fontFamily),
            fontWeight: p.fontWeight,
            fontSize: p.fontSize * unit,
            lineHeight: 1.04,
            color: p.color,
            textAlign,
            whiteSpace: "pre-wrap",
            textShadow: p.shadow ? `0 ${2 * unit}px ${8 * unit}px rgba(0,0,0,0.35)` : undefined,
            opacity: labelIn * (1 - e),
            transform: `translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%) translateY(${((1 - labelIn) * 12 + e * 8) * unit}px) rotate(${(-2.5 * rough).toFixed(2)}deg)`,
          }}
        >
          {p.label}
        </div>
      ) : null}
    </div>
  );
};

export const arrowCallout = defineMotionComponent<Props>({
  id: "arrow-callout",
  name: "Arrow callout",
  category: "annotation",
  description:
    "Hand-drawn marker arrow that draws itself from a handwritten label to a target point, then inks its head. Place the box over the area, set the tip with targetX/targetY (0..1 of the box) and the approach with angle/length/curve. Use to point at UI, products or details in footage.",
  schema: {
    label: { type: "text", label: "Label", default: "Try this" },
    targetX: {
      type: "number",
      label: "Target X",
      default: 0.82,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Arrow tip, fraction of the box width",
    },
    targetY: {
      type: "number",
      label: "Target Y",
      default: 0.74,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Arrow tip, fraction of the box height",
    },
    angle: {
      type: "number",
      label: "Angle",
      default: 20,
      min: -180,
      max: 180,
      step: 1,
      description: "Direction the arrow travels (0 = right, 90 = down)",
    },
    length: { type: "number", label: "Length", default: 300, min: 40, max: 1600, step: 1, description: "px at 1080p" },
    curve: { type: "number", label: "Curve", default: 0.45, min: -1, max: 1, step: 0.01 },
    color: { type: "color", label: "Color", default: "#FF5A36" },
    strokeWidth: { type: "number", label: "Stroke", default: 9, min: 2, max: 30, step: 0.5, description: "px at 1080p" },
    roughness: { type: "number", label: "Hand-drawn", default: 0.6, min: 0, max: 1, step: 0.05 },
    fontFamily: { type: "font", label: "Font", default: "Caveat" },
    fontWeight: { type: "number", label: "Weight", default: 700, min: 100, max: 900, step: 100 },
    fontSize: { type: "number", label: "Label size", default: 72, min: 20, max: 200, step: 1, description: "px at 1080p" },
    drawDuration: { type: "number", label: "Draw time (frames)", default: 18, min: 4, max: 60, step: 1 },
    shadow: { type: "boolean", label: "Shadow", default: true },
    seed: { type: "number", label: "Seed", default: 3, min: 0, max: 100, step: 1 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    label: "Try this",
    targetX: 0.82,
    targetY: 0.74,
    angle: 20,
    length: 300,
    curve: 0.45,
    color: "#FF5A36",
    strokeWidth: 9,
    roughness: 0.6,
    fontFamily: "Caveat",
    fontWeight: 700,
    fontSize: 72,
    drawDuration: 18,
    shadow: true,
    seed: 3,
    exit: true,
  },
  defaultDuration: 3,
  defaultBox: { x: 0.5, y: 0.5, width: 0.4, height: 0.36 },
  Component: ArrowCallout,
  tags: ["arrow", "annotation", "callout", "pointer", "hand-drawn", "explainer"],
});
